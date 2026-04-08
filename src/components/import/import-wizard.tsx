"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ImportWizardProps {
  clientId: string;
  clientSlug: string;
}

export function ImportWizard({ clientId, clientSlug }: ImportWizardProps) {
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
    else setError("Only .xlsx and .xls files are supported");
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
      if (!res.ok) { setError(data.error || "Import failed"); setUploading(false); return; }
      router.push(`/clients/${clientSlug}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <Link
        href={`/clients/${clientSlug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Back to client
      </Link>

      <h2 className="mb-2 text-lg font-bold text-white">Import Jurnal Contabil</h2>
      <p className="mb-6 text-sm text-gray">
        Upload the journal exported from Saga or other accounting software (.xlsx)
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!file ? (
        <DropZone
          dragging={dragging}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onFileSelect={handleFileSelect}
        />
      ) : (
        <FilePreview file={file} uploading={uploading} onUpload={handleUpload} onClear={() => setFile(null)} />
      )}
    </div>
  );
}

function DropZone({ dragging, onDragOver, onDragLeave, onDrop, onFileSelect }: {
  dragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-dark-3 hover:border-dark-4"
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
  );
}

function FilePreview({ file, uploading, onUpload, onClear }: {
  file: File; uploading: boolean; onUpload: () => void; onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-dark-3 bg-dark-2 p-5">
        <FileSpreadsheet size={24} className="text-accent shrink-0" />
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
