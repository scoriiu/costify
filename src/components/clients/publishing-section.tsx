"use client";

/**
 * "Publicare" section in the Setari tab.
 *
 * Shows the full timeline of published periods for this client. The accountant
 * can re-publish or retract any of them. Periods that have journal data but
 * are NOT yet published show up with an explicit "Publica" action.
 *
 * Server data: PublishingSectionRow[] = union of published periods + periods
 * with journal data but no publication.
 */

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, AlertTriangle, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  publishPeriodAction,
  unpublishPeriodAction,
} from "@/modules/publishing/actions";

export interface PublishingSectionRow {
  year: number;
  month: number;
  isPublished: boolean;
  publishedAt: string | null; // ISO
  publisherName: string | null;
  noteForOwner: string | null;
  stale: boolean;
  /** True when the live data no longer matches what the patron sees (snapshot
   *  hash diverged since publish, e.g. after a journal re-import). Only ever
   *  true for published periods. */
  outOfSync: boolean;
  hasJournalData: boolean;
  /** The 4 CPP result figures for this month, when computed. Null when no
   *  materialized snapshot exists yet (e.g. a period with no journal data). */
  results: {
    rezultatExploatare: number;
    rezultatFinanciar: number;
    rezultatBrut: number;
    rezultatNet: number;
  } | null;
}

interface Props {
  clientId: string;
  clientSlug: string;
  rows: PublishingSectionRow[];
}

/**
 * By default we hide unpublished historical months — the cabinet doesn't need
 * to scroll through 60+ rows on every visit. We always show:
 *   - all published months (any year)
 *   - the most recent month with journal data, even if unpublished (so the
 *     accountant can publish it with one click during onboarding)
 *
 * A toggle reveals the full list when the accountant explicitly asks.
 */
function defaultVisibleRows(rows: PublishingSectionRow[]): PublishingSectionRow[] {
  const visible: PublishingSectionRow[] = [];
  const seenLatestUnpublished = { value: false };
  for (const r of rows) {
    if (r.isPublished) {
      visible.push(r);
      continue;
    }
    if (!seenLatestUnpublished.value && r.hasJournalData) {
      visible.push(r);
      seenLatestUnpublished.value = true;
    }
  }
  return visible;
}

/**
 * Once the visible list grows past this many rows we cap its height and let it
 * scroll, so a client with many published months (e.g. after bulk-publishing a
 * full history) doesn't stretch the Setari page indefinitely.
 */
const SCROLL_AFTER_ROWS = 8;

const MONTH_NAMES = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
];

function formatRoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PublishingSection({ clientId, rows }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [onlyDesynced, setOnlyDesynced] = useState(false);

  const desyncCount = useMemo(
    () => rows.filter((r) => r.outOfSync).length,
    [rows]
  );

  const visible = useMemo(() => {
    if (onlyDesynced) return rows.filter((r) => r.outOfSync);
    return showAll ? rows : defaultVisibleRows(rows);
  }, [rows, showAll, onlyDesynced]);

  const hiddenCount = rows.length - visible.length;

  if (rows.length === 0) {
    return (
      <section
        className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
        data-testid="setari-publicare"
      >
        <header className="flex items-center gap-2.5">
          <Send size={16} className="text-primary" />
          <h2
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Publicare catre firma
          </h2>
        </header>
        <p
          className="mt-3 text-[13px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun jurnal nu a fost incarcat inca. Cand vor exista date, vei putea
          publica fiecare luna catre patron.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="setari-publicare"
    >
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Send size={16} className="text-primary" />
            <h2
              className="text-[16px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Publicare catre firma
            </h2>
          </div>
          {desyncCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyDesynced((v) => !v)}
              aria-pressed={onlyDesynced}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors ${
                onlyDesynced
                  ? "border-tone-warn/40 bg-tone-warn/15 text-tone-warn"
                  : "border-tone-warn/25 bg-tone-warn/[0.06] text-tone-warn hover:bg-tone-warn/10"
              }`}
              title={
                onlyDesynced
                  ? "Arata toate lunile"
                  : "Arata doar lunile nesincronizate"
              }
            >
              <RefreshCw size={11} />
              {desyncCount} {desyncCount === 1 ? "nesincronizata" : "nesincronizate"}
            </button>
          )}
        </div>
        <p
          className="mt-1.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Patronul vede doar lunile publicate. Re-publica dupa orice corectie.
        </p>
      </header>

      {!onlyDesynced && <BulkPublish clientId={clientId} rows={rows} />}

      <ul
        className={`mt-5 divide-y divide-dark-3 ${
          visible.length > SCROLL_AFTER_ROWS
            ? "max-h-[28rem] overflow-y-auto pr-1 -mr-1 [scrollbar-gutter:stable]"
            : ""
        }`}
      >
        {visible.map((row) => (
          <PublishRow key={`${row.year}-${row.month}`} clientId={clientId} row={row} />
        ))}
      </ul>

      {onlyDesynced ? (
        <button
          type="button"
          onClick={() => setOnlyDesynced(false)}
          className="mt-4 w-full text-center font-mono text-[11px] font-medium uppercase tracking-wider text-gray hover:text-gray-light transition-colors"
        >
          Arata toate lunile
        </button>
      ) : (
        <>
          {hiddenCount > 0 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-4 w-full text-center font-mono text-[11px] font-medium uppercase tracking-wider text-gray hover:text-gray-light transition-colors"
            >
              Vezi toate lunile cu date ({hiddenCount} ascunse)
            </button>
          )}
          {showAll && hiddenCount === 0 && rows.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mt-4 w-full text-center font-mono text-[11px] font-medium uppercase tracking-wider text-gray hover:text-gray-light transition-colors"
            >
              Ascunde lunile vechi
            </button>
          )}
        </>
      )}
    </section>
  );
}

interface BulkProgress {
  total: number;
  done: number;
  currentLabel: string;
  failed: Array<{ label: string; error: string }>;
}

/**
 * "Publica tot pana la <luna>" bulk action.
 *
 * Publishing is driven from the client one month at a time by calling the
 * same audited `publishPeriodAction` per period. We loop sequentially
 * (oldest -> target) instead of in one server action so the accountant sees
 * real month-by-month progress, and so a single failing month doesn't roll
 * back the rest. Already-published-and-fresh months are skipped (idempotent);
 * stale and unpublished months in range are (re)published.
 */
function BulkPublish({
  clientId,
  rows,
}: {
  clientId: string;
  rows: PublishingSectionRow[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>("");
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [running, setRunning] = useState(false);

  // Candidate target months: everything with journal data, oldest -> newest,
  // so the dropdown reads chronologically and "pana la" is intuitive.
  const candidates = useMemo(
    () =>
      rows
        .filter((r) => r.hasJournalData)
        .sort((a, b) => a.year - b.year || a.month - b.month),
    [rows]
  );

  // Dropdown reads newest -> oldest (descending), matching the list below.
  // The publish loop still runs oldest -> newest off `candidates`.
  const options = useMemo(
    () =>
      [...candidates]
        .reverse()
        .map((r) => ({
          value: `${r.year}-${r.month}`,
          label: `${MONTH_NAMES[r.month - 1]} ${r.year}`,
        })),
    [candidates]
  );

  if (candidates.length === 0) return null;

  function periodsToPublish(targetKey: string): PublishingSectionRow[] {
    const [ty, tm] = targetKey.split("-").map((n) => parseInt(n, 10));
    const targetOrd = ty * 12 + tm;
    return candidates.filter((r) => {
      const ord = r.year * 12 + r.month;
      if (ord > targetOrd) return false;
      // Skip months already published and not stale (nothing to do).
      if (r.isPublished && !r.stale) return false;
      return true;
    });
  }

  async function run() {
    if (!target || running) return;
    const batch = periodsToPublish(target);
    if (batch.length === 0) {
      setProgress({ total: 0, done: 0, currentLabel: "", failed: [] });
      return;
    }
    setRunning(true);
    const failed: BulkProgress["failed"] = [];
    setProgress({ total: batch.length, done: 0, currentLabel: "", failed: [] });

    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      const label = `${MONTH_NAMES[r.month - 1]} ${r.year}`;
      setProgress({ total: batch.length, done: i, currentLabel: label, failed: [...failed] });
      const result = await publishPeriodAction({ clientId, year: r.year, month: r.month });
      if (!result.ok) failed.push({ label, error: result.error });
      setProgress({ total: batch.length, done: i + 1, currentLabel: label, failed: [...failed] });
    }

    setRunning(false);
    router.refresh();
  }

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="mt-4 rounded-lg border border-dark-3 bg-dark/40 p-3.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray"
        >
          Publica tot pana la
        </span>
        <div className="sm:w-52">
          <Select
            value={target}
            options={options}
            onChange={setTarget}
            placeholder="Alege luna"
          />
        </div>
        <Button
          onClick={run}
          disabled={!target || running}
          className="sm:ml-auto"
        >
          {running ? (
            <>
              <Loader2 size={12} className="mr-1.5 animate-spin" />
              Public...
            </>
          ) : (
            <>
              <Send size={12} className="mr-1.5" />
              Publica
            </>
          )}
        </Button>
      </div>

      {progress && (
        <div className="mt-3">
          {progress.total === 0 ? (
            <p className="text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
              Toate lunile pana la data aleasa sunt deja publicate.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                  {running && progress.currentLabel
                    ? `Public ${progress.currentLabel}`
                    : "Publicare finalizata"}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-gray">
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-dark-3">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(13,107,94,0.35)" }}
                />
              </div>
              {!running && progress.failed.length > 0 && (
                <p className="mt-2 text-[11px] text-neg" style={{ letterSpacing: "-0.02em" }}>
                  {progress.failed.length}{" "}
                  {progress.failed.length === 1 ? "luna a esuat" : "luni au esuat"}:{" "}
                  {progress.failed.map((f) => f.label).join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PublishRow({
  clientId,
  row,
}: {
  clientId: string;
  row: PublishingSectionRow;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [isPending, startTransition] = useTransition();

  const label = `${MONTH_NAMES[row.month - 1]} ${row.year}`;

  function doPublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishPeriodAction({
        clientId,
        year: row.year,
        month: row.month,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function doUnpublish() {
    setError(null);
    startTransition(async () => {
      const result = await unpublishPeriodAction({
        clientId,
        year: row.year,
        month: row.month,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmingUnpublish(false);
      router.refresh();
    });
  }

  let status: React.ReactNode;
  if (!row.isPublished) {
    status = (
      <span
        className="font-mono text-[10px] uppercase tracking-wider text-tone-warn"
        aria-hidden
      >
        Nepublicat
      </span>
    );
  } else if (row.outOfSync) {
    status = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-tone-warn">
        <RefreshCw size={10} />
        Nesincronizat. Datele s-au schimbat dupa publicare
      </span>
    );
  } else if (row.stale) {
    status = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-tone-warn">
        <AlertTriangle size={10} />
        Modificat dupa publicare
      </span>
    );
  } else {
    status = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-pos">
        <CheckCircle2 size={10} />
        Publicat {formatRoDate(row.publishedAt!)}
        {row.publisherName ? ` · ${row.publisherName}` : ""}
      </span>
    );
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p
          className="text-[14px] font-medium text-white"
          style={{ letterSpacing: "-0.02em" }}
        >
          {label}
        </p>
        <div className="mt-0.5">{status}</div>
        {error && (
          <p
            className="mt-1 text-[11px] text-neg"
            style={{ letterSpacing: "-0.02em" }}
          >
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!row.isPublished && (
          <Button onClick={doPublish} disabled={isPending}>
            <Send size={12} className="mr-1.5" />
            {isPending ? "..." : "Publica"}
          </Button>
        )}
        {row.isPublished && (row.stale || row.outOfSync) && (
          <Button onClick={doPublish} disabled={isPending}>
            {isPending ? "..." : "Re-publica"}
          </Button>
        )}
        {row.isPublished &&
          (confirmingUnpublish ? (
            <>
              <Button
                variant="danger"
                onClick={doUnpublish}
                disabled={isPending}
              >
                <X size={12} className="mr-1.5" />
                {isPending ? "..." : "Confirma"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingUnpublish(false)}>
                Anuleaza
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmingUnpublish(true)}
            >
              Retrage
            </Button>
          ))}
      </div>
      </div>

      {row.results && <ResultFigures results={row.results} />}
    </li>
  );
}

function formatLei(n: number): string {
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Compact strip of the four CPP results for a month. Read-only indicator the
 * accountant scans to sanity-check a period before publishing. Brut/Net carry
 * a sign tone (green positive, red negative); exploatare/financiar stay neutral
 * to avoid a noisy rainbow.
 */
function ResultFigures({
  results,
}: {
  results: NonNullable<PublishingSectionRow["results"]>;
}) {
  const items: Array<{ label: string; value: number; signed: boolean }> = [
    { label: "Exploatare", value: results.rezultatExploatare, signed: false },
    { label: "Financiar", value: results.rezultatFinanciar, signed: false },
    { label: "Brut", value: results.rezultatBrut, signed: true },
    { label: "Net", value: results.rezultatNet, signed: true },
  ];
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {items.map((it) => {
        const tone = it.signed
          ? it.value < 0
            ? "text-neg"
            : "text-pos"
          : "text-gray-light";
        return (
          <div key={it.label} className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-wider text-gray">
              Rezultat {it.label}
            </div>
            <div
              className={`mt-0.5 truncate font-mono text-[12px] ${tone}`}
              style={{ letterSpacing: "-0.02em" }}
              title={`${formatLei(it.value)} lei`}
            >
              {formatLei(it.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
