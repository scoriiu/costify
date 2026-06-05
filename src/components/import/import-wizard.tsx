"use client";

/**
 * Queue-based journal import wizard.
 *
 * The user picks a file -> we POST it to /api/import -> the server saves
 * it to MinIO and returns an importEventId (status: queued) within
 * ~200 ms. We then navigate to `?event=<id>` so the URL is the source of
 * truth: refreshing, sharing, or returning to the page later all resume
 * the same poll loop.
 *
 * Progress is driven by the real ImportEvent row, which the worker updates
 * as it parses, stores, and finalizes. No fake curve, no time-based
 * animation — the bar moves when there is genuine work to report.
 */
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface ImportWizardProps {
  clientId: string;
  clientSlug: string;
  clientName: string;
  existingEntries: number;
}

interface ImportStatus {
  id: string;
  status: "queued" | "parsing" | "storing" | "finalizing" | "ready" | "failed";
  progress: number;
  progressLabel: string;
  totalEntries: number | null;
  processedEntries: number | null;
  entriesAdded: number;
  dateStart: string | null;
  dateEnd: string | null;
  errorMessage: string | null;
  fileName: string;
}

export function ImportWizard({ clientId, clientSlug, clientName, existingEntries }: ImportWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Real upload progress driven by XHR's upload.onprogress event. `null`
  // means we haven't started uploading yet; `0..100` reflects bytes sent /
  // total bytes. We keep `submitting` separate because the upload can
  // finish (100%) seconds before the server's 202 response arrives — the
  // server still has to parse the multipart, PUT to MinIO, and INSERT the
  // row. During that window we show 100% bar with the "Finalizez
  // incarcarea..." label.
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) setFile(f);
    else setSubmitError("Doar fisiere .xlsx si .xls sunt acceptate");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setSubmitError(null); }
  }, []);

  const handleUpload = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setUploadPercent(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("name", file.name.replace(/\.(xlsx|xls)$/i, ""));

    // We use XHR not fetch because fetch() can't report upload progress
    // in any browser yet. xhr.upload.onprogress fires per chunk written
    // to the network buffer with { loaded, total } in bytes.
    try {
      const result = await new Promise<{ importEventId: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/import");
        xhr.responseType = "json";
        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setUploadPercent(pct);
        };
        xhr.upload.onload = () => {
          // Bytes are fully sent — the server is now parsing + S3 PUT +
          // DB write. Snap to 100% so the bar looks done while the user
          // waits the remaining ~1-2s for the 202.
          setUploadPercent(100);
        };
        xhr.onload = () => {
          if (xhr.status === 202 && xhr.response?.importEventId) {
            resolve(xhr.response);
          } else {
            const msg = xhr.response?.error || `Eroare server (HTTP ${xhr.status})`;
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("Eroare de retea"));
        xhr.send(formData);
      });
      // Hand off to the polling view by putting the event id in the URL.
      // Refreshing the page from this point on resumes the same poll.
      router.replace(`?event=${encodeURIComponent(result.importEventId)}`, { scroll: false });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Eroare la incarcare");
      setSubmitting(false);
      setUploadPercent(null);
    }
  };

  return (
    <div>
      <Link
        href={`/clients/${clientSlug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> {clientName}
      </Link>

      <div className="mx-auto max-w-3xl text-center mb-8">
        <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Import Jurnal Contabil
        </h1>
        <p className="mt-2 text-sm text-gray">
          Upload registrul jurnal exportat din Saga C sau alt program contabil (.xlsx)
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
        {!eventId && <ReplaceWarning existingEntries={existingEntries} />}
        {eventId ? (
          <ImportPolling
            eventId={eventId}
            clientSlug={clientSlug}
            onCancel={() => {
              router.replace(window.location.pathname, { scroll: false });
              setFile(null);
              setSubmitting(false);
            }}
          />
        ) : !file ? (
          <DropZone
            dragging={dragging}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            error={submitError}
          />
        ) : (
          <FilePreview
            file={file}
            uploading={submitting}
            uploadPercent={uploadPercent}
            onUpload={handleUpload}
            onClear={() => setFile(null)}
            error={submitError}
          />
        )}
      </div>

      {!eventId && (
        <div className="mx-auto mt-8 max-w-3xl">
          <FormatGuide />
        </div>
      )}
    </div>
  );
}

/**
 * Full-replace notice. Every upload wipes the client's existing journal and
 * re-imports the whole file. Partial/append imports are not supported for
 * now, so this banner makes the destructive behaviour explicit before the
 * accountant picks a file.
 */
function ReplaceWarning({ existingEntries }: { existingEntries: number }) {
  return (
    <div className="mb-4 rounded-xl border border-warn/30 bg-warn/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0 text-xs leading-relaxed text-gray-light">
          <div className="text-sm font-medium text-white" style={{ letterSpacing: "-0.04em" }}>
            Importul inlocuieste tot jurnalul
          </div>
          <p className="mt-1">
            {existingEntries > 0 ? (
              <>
                Acest client are deja{" "}
                <span className="font-mono text-white">
                  {existingEntries.toLocaleString("ro-RO")}
                </span>{" "}
                de intrari. La import, toate vor fi sterse si inlocuite cu
                continutul fisierului nou. Incarca un export complet al
                jurnalului, nu doar lunile noi.
              </>
            ) : (
              <>
                La fiecare import, jurnalul existent este sters complet si
                inlocuit cu continutul fisierului. Incarca intotdeauna un
                export complet al jurnalului, nu doar lunile noi.
              </>
            )}
          </p>
          <p className="mt-2 text-gray">
            Maparile pe categorii raman neschimbate si se aplica automat
            intrarilor noi.
          </p>
        </div>
      </div>
    </div>
  );
}

function ImportPolling({
  eventId,
  clientSlug,
  onCancel,
}: {
  eventId: string;
  clientSlug: string;
  onCancel: () => void;
}) {
  const [state, setState] = useState<ImportStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let handle: number | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/import/${encodeURIComponent(eventId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (cancelled) return;
          const data = await res.json().catch(() => ({}));
          setPollError(data.error || "Nu pot urmari progresul importului");
          return;
        }
        const data = (await res.json()) as ImportStatus;
        if (cancelled) return;
        setState(data);
        setPollError(null);

        // Stop polling once the job reaches a terminal state. The user
        // stays on a persistent success screen and chooses where to go
        // next — no involuntary redirect that flashes the result away.
        if (data.status === "ready" || data.status === "failed") {
          if (handle !== undefined) window.clearInterval(handle);
        }
      } catch {
        if (!cancelled) setPollError("Conexiune intrerupta. Se reincearca...");
      }
    };

    poll();
    handle = window.setInterval(poll, 500);
    return () => {
      cancelled = true;
      if (handle !== undefined) window.clearInterval(handle);
    };
  }, [eventId]);

  if (!state) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 text-center text-sm text-gray">
        Se incarca statusul importului...
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Importul a esuat</div>
              <div className="mt-1 text-xs text-gray break-words">
                {state.errorMessage ?? "Eroare necunoscuta"}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Inapoi
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "ready") {
    return <ImportSuccess state={state} clientSlug={clientSlug} onImportAnother={onCancel} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-xl border border-dark-3 bg-dark-2 p-5">
        <FileSpreadsheet size={24} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{state.fileName}</div>
          <div className="text-xs text-gray">
            {translateStatus(state.status)}
          </div>
        </div>
      </div>

      <ProgressBlock state={state} />

      {pollError && (
        <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-xs text-warn">
          {pollError}
        </div>
      )}

      <p className="text-xs text-gray">
        Poti inchide aceasta pagina, importul continua in fundal. Reincarcand pagina o sa vezi
        progresul actualizat.
      </p>
    </div>
  );
}

/**
 * Persistent post-import success screen. We deliberately do NOT auto-redirect:
 * a full-replace import is a consequential action, so the accountant gets a
 * clear confirmation of what landed (count + period covered) and chooses the
 * next step instead of having the result flashed away after 600 ms.
 */
function ImportSuccess({
  state,
  clientSlug,
  onImportAnother,
}: {
  state: ImportStatus;
  clientSlug: string;
  onImportAnother: () => void;
}) {
  const router = useRouter();
  // Invalidate the client-side router cache once, so navigating to the
  // client page via the CTAs below lands on freshly recomputed server data
  // (the import bumped the client's dataVersion).
  useEffect(() => {
    router.refresh();
  }, [router]);

  const period = formatPeriodRange(state.dateStart, state.dateEnd);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
              Import finalizat
            </div>
            <p className="mt-1 text-xs text-gray-light">
              Jurnalul a fost inlocuit complet cu fisierul incarcat. Balanta si Contul de
              profit si pierdere s-au recalculat.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <SummaryStat
            label="Intrari in jurnal"
            value={state.entriesAdded.toLocaleString("ro-RO")}
          />
          <SummaryStat label="Perioada acoperita" value={period ?? "Nedeterminata"} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/clients/${clientSlug}`} className="sm:flex-1">
          <Button variant="primary" className="w-full">
            Vezi jurnalul
          </Button>
        </Link>
        <Link href={`/clients/${clientSlug}?tab=balanta`} className="sm:flex-1">
          <Button variant="ghost" className="w-full">
            Vezi balanta
          </Button>
        </Link>
      </div>

      <button
        onClick={onImportAnother}
        className="w-full text-center text-xs text-gray hover:text-white transition-colors cursor-pointer"
      >
        Importa alt fisier
      </button>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2 px-4 py-3">
      <div className="font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function formatPeriodRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const s = fmt(start);
  const e = fmt(end);
  return s === e ? s : `${s} - ${e}`;
}

function translateStatus(s: ImportStatus["status"]): string {
  switch (s) {
    case "queued":
      return "In coada de procesare";
    case "parsing":
      return "In procesare, citire";
    case "storing":
      return "In procesare, salvare";
    case "finalizing":
      return "In procesare, finalizare";
    case "ready":
      return "Finalizat";
    case "failed":
      return "Esuat";
  }
}

function ProgressBlock({ state }: { state: ImportStatus }) {
  const widthPct = Math.min(100, Math.max(0, state.progress)).toFixed(1);
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-white">{state.progressLabel || "Se proceseaza"}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray">
          {Math.round(state.progress)}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-dark-3">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${widthPct}%`, boxShadow: "0 0 16px rgba(13,107,94,0.35)" }}
        />
      </div>
      {state.totalEntries !== null && state.totalEntries > 0 && (
        <div className="mt-3 font-mono text-[11px] text-gray">
          {(state.processedEntries ?? 0).toLocaleString("ro-RO")} /{" "}
          {state.totalEntries.toLocaleString("ro-RO")} intrari
        </div>
      )}
    </div>
  );
}

function DropZone({ dragging, onDragOver, onDragLeave, onDrop, onFileSelect, error }: {
  dragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition-colors ${
          error
            ? "border-danger/40"
            : dragging
              ? "border-primary bg-primary/[0.1]"
              : "border-primary/40 bg-primary/[0.05] hover:border-primary/60 hover:bg-primary/[0.08]"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Upload size={40} className="mb-3 text-primary/60" />
        <span className="mb-1 text-sm font-medium text-white">Drop your XLSX file here</span>
        <span className="text-xs text-gray">or click to browse</span>
        <input type="file" accept=".xlsx,.xls" onChange={onFileSelect} className="hidden" />
      </label>
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

function FilePreview({ file, uploading, uploadPercent, onUpload, onClear, error }: {
  file: File;
  uploading: boolean;
  uploadPercent: number | null;
  onUpload: () => void;
  onClear: () => void;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-4 rounded-xl border p-5 ${error ? "border-danger/30 bg-danger/5" : "border-dark-3 bg-dark-2"}`}>
        <FileSpreadsheet size={24} className={error ? "text-danger shrink-0" : "text-accent shrink-0"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{file.name}</div>
          <div className="text-xs text-gray">{formatBytes(file.size)}</div>
        </div>
        {!uploading && (
          <button onClick={onClear} className="text-xs text-gray hover:text-white cursor-pointer">
            Remove
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
          {error}
        </div>
      )}
      {uploading && uploadPercent !== null ? (
        <UploadProgressBar percent={uploadPercent} fileSize={file.size} />
      ) : (
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClear} disabled={uploading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onUpload} disabled={uploading} className="flex-1">
            <Upload size={14} /> Import
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Real upload progress driven by XHR's upload.onprogress event in the
 * parent. At 100% we switch the label to "Finalizez incarcarea..." to
 * cover the ~1-2s window between the last byte going out and the
 * server's 202 arriving — when the multipart parse + S3 PUT + DB write
 * happen. After that we transition into the queue-status polling view
 * via a router.replace().
 */
function UploadProgressBar({ percent, fileSize }: { percent: number; fileSize: number }) {
  const bytesSent = Math.round((fileSize * percent) / 100);
  const widthPct = Math.min(100, Math.max(0, percent)).toFixed(1);
  const label =
    percent < 100 ? "Se incarca fisierul pe server" : "Finalizez incarcarea pe server";
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-gray">
          {Math.round(percent)}%
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-dark-3">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${widthPct}%`, boxShadow: "0 0 16px rgba(13,107,94,0.35)" }}
        />
      </div>
      <div className="mt-3 font-mono text-[11px] text-gray">
        {formatBytes(bytesSent)} / {formatBytes(fileSize)}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

const EXAMPLE_ROWS = [
  { data: "15.01.2026", ndp: "FV-0042", felD: "Intrari", contD: "4111.00015", contC: "7015", suma: "12.500,00", explicatie: "Factura servicii IT, Client SRL" },
  { data: "15.01.2026", ndp: "FV-0042", felD: "Intrari", contD: "4111.00015", contC: "4427", suma: "2.625,00", explicatie: "TVA 21%, Factura servicii IT" },
  { data: "18.01.2026", ndp: "OP-117", felD: "Banca", contD: "5121", contC: "4111.00015", suma: "15.125,00", explicatie: "Incasare Client SRL" },
  { data: "20.01.2026", ndp: "FF-2891", felD: "Iesiri", contD: "628", contC: "401.00023", suma: "1.200,00", explicatie: "Abonament hosting, Provider SA" },
  { data: "20.01.2026", ndp: "FF-2891", felD: "Iesiri", contD: "4426", contC: "401.00023", suma: "252,00", explicatie: "TVA 21%, Abonament hosting" },
];

const COLUMNS = [
  { key: "data", label: "Data", required: true },
  { key: "ndp", label: "NDP", required: false },
  { key: "felD", label: "Tip", required: false },
  { key: "contD", label: "Cont Debit", required: true },
  { key: "contC", label: "Cont Credit", required: true },
  { key: "suma", label: "Suma", required: true },
  { key: "explicatie", label: "Explicatie", required: true },
] as const;

function FormatGuide() {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <h3 className="text-sm font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        Formatul asteptat
      </h3>
      <p className="mt-1 text-xs text-gray">
        Fisierul XLSX trebuie sa contina un registru jurnal cu urmatoarele coloane.
        Coloanele marcate cu <span className="text-white font-semibold">*</span> sunt obligatorii.
      </p>
      <p className="mt-1.5 text-xs text-gray">
        Explicatie este obligatorie: din ea identificam automat partenerii.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-dark-3">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-dark-2 border-b border-dark-3">
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-3 py-2.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray ${
                    i < COLUMNS.length - 1 ? "border-r border-white/[0.04]" : ""
                  } text-left`}
                >
                  {col.label}
                  {col.required && <span className="text-primary"> *</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_ROWS.map((row, i) => (
              <tr key={i} className="border-b border-dark-3/50 last:border-b-0">
                {COLUMNS.map((col, j) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-light ${
                      j < COLUMNS.length - 1 ? "border-r border-white/[0.04]" : ""
                    }`}
                  >
                    {row[col.key as keyof typeof row]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
