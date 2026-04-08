"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ImportWizardProps {
  clientId: string;
  clientSlug: string;
  clientName: string;
}

export function ImportWizard({ clientId, clientSlug, clientName }: ImportWizardProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls"))) setFile(f);
    else setError("Doar fisiere .xlsx si .xls sunt acceptate");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(null); }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("name", file.name.replace(/\.(xlsx|xls)$/i, ""));

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Importul a esuat"); setUploading(false); return; }
      router.push(`/clients/${clientSlug}`);
      router.refresh();
    } catch {
      setError("Eroare de retea. Incearca din nou.");
      setUploading(false);
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

      <div className="text-center mb-8">
        <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Import Jurnal Contabil
        </h1>
        <p className="mt-2 text-sm text-gray">
          Upload registrul jurnal exportat din Saga C sau alt program contabil (.xlsx)
        </p>
      </div>

      <div className="mx-auto max-w-lg">
        {!file ? (
          <DropZone
            dragging={dragging}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            error={!file ? error : null}
          />
        ) : (
          <FilePreview file={file} uploading={uploading} onUpload={handleUpload} onClear={() => setFile(null)} error={error} />
        )}
      </div>

      <div className="mt-8">
        <FormatGuide />
      </div>
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
          error ? "border-danger/40" : dragging ? "border-primary bg-primary/5" : "border-dark-3 hover:border-dark-4"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Upload size={40} className="mb-3 text-gray/40" />
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

function FilePreview({ file, uploading, onUpload, onClear, error }: {
  file: File; uploading: boolean; onUpload: () => void; onClear: () => void; error: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-4 rounded-xl border p-5 ${error ? "border-danger/30 bg-danger/5" : "border-dark-3 bg-dark-2"}`}>
        <FileSpreadsheet size={24} className={error ? "text-danger shrink-0" : "text-accent shrink-0"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{file.name}</div>
          <div className="text-xs text-gray">{(file.size / 1024).toFixed(0)} KB</div>
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
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClear} disabled={uploading} className="flex-1">
          Cancel
        </Button>
        <Button onClick={onUpload} disabled={uploading} className="flex-1">
          {uploading ? <><Loader2 size={14} className="animate-spin" /> Importing...</> : <><Upload size={14} /> Import</>}
        </Button>
      </div>
    </div>
  );
}

const EXAMPLE_ROWS = [
  { data: "15.01.2026", ndp: "FV-0042", felD: "Intrari", contD: "4111.00015", contC: "7015", suma: "12.500,00", explicatie: "Factura servicii IT — Client SRL" },
  { data: "15.01.2026", ndp: "FV-0042", felD: "Intrari", contD: "4111.00015", contC: "4427", suma: "2.625,00", explicatie: "TVA 21% — Factura servicii IT" },
  { data: "18.01.2026", ndp: "OP-117", felD: "Banca", contD: "5121", contC: "4111.00015", suma: "15.125,00", explicatie: "Incasare Client SRL" },
  { data: "20.01.2026", ndp: "FF-2891", felD: "Iesiri", contD: "628", contC: "401.00023", suma: "1.200,00", explicatie: "Abonament hosting — Provider SA" },
  { data: "20.01.2026", ndp: "FF-2891", felD: "Iesiri", contD: "4426", contC: "401.00023", suma: "252,00", explicatie: "TVA 21% — Abonament hosting" },
];

const COLUMNS = [
  { key: "data", label: "Data", required: true },
  { key: "ndp", label: "NDP", required: false },
  { key: "felD", label: "Tip", required: false },
  { key: "contD", label: "Cont Debit", required: true },
  { key: "contC", label: "Cont Credit", required: true },
  { key: "suma", label: "Suma", required: true },
  { key: "explicatie", label: "Explicatie", required: false },
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

      <div className="mt-4 overflow-x-auto rounded-lg border border-dark-3">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-dark-2 border-b border-dark-3">
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray ${
                    col.key === "suma" ? "text-right" : "text-left"
                  } ${i < COLUMNS.length - 1 ? "border-r border-white/[0.04]" : ""}`}
                >
                  {col.label}
                  {col.required && <span className="ml-0.5 text-primary">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_ROWS.map((row, ri) => (
              <tr key={ri} className="border-b border-dark-3/50">
                {COLUMNS.map((col, ci) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-1.5 font-mono text-xs text-gray-light ${
                      col.key === "suma" ? "text-right" : "text-left"
                    } ${ci < COLUMNS.length - 1 ? "border-r border-white/[0.04]" : ""}`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[11px] text-gray">
          <span className="font-mono font-medium text-gray-light">Data</span> — format DD.MM.YYYY sau YYYY-MM-DD
        </p>
        <p className="text-[11px] text-gray">
          <span className="font-mono font-medium text-gray-light">Cont Debit / Credit</span> — conturi analitice (ex: 4111.00015) sau sintetice (ex: 5121)
        </p>
        <p className="text-[11px] text-gray">
          <span className="font-mono font-medium text-gray-light">Suma</span> — format romanesc (1.234,56) sau international (1234.56)
        </p>
        <p className="text-[11px] text-gray">
          Acceptam export din <span className="font-medium text-gray-light">Saga C</span>, <span className="font-medium text-gray-light">Ciel</span>, <span className="font-medium text-gray-light">WinMentor</span> si alte programe contabile.
        </p>
      </div>
    </div>
  );
}
