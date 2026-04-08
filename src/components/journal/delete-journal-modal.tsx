"use client";

import { useState, useCallback, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = "date" | "confirm" | "done";

interface Props {
  clientId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function DeleteJournalModal({ clientId, clientName, open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("date");
  const [fromDate, setFromDate] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletedCount, setDeletedCount] = useState(0);

  useEffect(() => {
    if (open) {
      setStep("date");
      setFromDate("");
      setCount(null);
      setTotal(null);
      setConfirmation("");
      setError("");
      setDeletedCount(0);
    }
  }, [open]);

  const fetchCount = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/journal/count?clientId=${clientId}&fromDate=${date}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setCount(data.count);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  function handleDateChange(date: string) {
    setFromDate(date);
    setCount(null);
    fetchCount(date);
  }

  async function handleDelete() {
    if (confirmation !== "STERGE") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/journal/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, fromDate, confirmation }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDeletedCount(data.deletedCount);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-dark-3 bg-dark-2 p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray hover:text-white transition-colors">
          <X size={18} />
        </button>

        {step === "date" && (
          <DateStep
            clientName={clientName}
            fromDate={fromDate}
            count={count}
            total={total}
            loading={loading}
            error={error}
            onDateChange={handleDateChange}
            onNext={() => count !== null && count > 0 && setStep("confirm")}
          />
        )}

        {step === "confirm" && (
          <ConfirmStep
            clientName={clientName}
            fromDate={fromDate}
            count={count!}
            confirmation={confirmation}
            loading={loading}
            error={error}
            onConfirmationChange={setConfirmation}
            onPaste={handlePaste}
            onBack={() => setStep("date")}
            onDelete={handleDelete}
          />
        )}

        {step === "done" && (
          <DoneStep
            deletedCount={deletedCount}
            onClose={() => { onClose(); onComplete(); }}
          />
        )}
      </div>
    </div>
  );
}

function DateStep({
  clientName, fromDate, count, total, loading, error, onDateChange, onNext,
}: {
  clientName: string; fromDate: string; count: number | null; total: number | null;
  loading: boolean; error: string;
  onDateChange: (d: string) => void; onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle size={20} className="text-danger" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            Corecteaza date istorice
          </h2>
          <p className="text-sm text-gray">{clientName}</p>
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-light">
        Selecteaza data de la care vrei sa stergi intrarile din registrul jurnal.
        Intrarile vor fi sterse soft (recuperabile din audit).
      </p>

      <label className="mb-1 block font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
        Sterge intrarile de la
      </label>
      <input
        type="date"
        value={fromDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="mb-4 h-10 w-full rounded-[10px] border border-dark-3 bg-dark-2 px-4 font-mono text-sm text-white focus:border-primary focus:outline-none"
      />

      {loading && <p className="mb-4 text-sm text-gray">Se calculeaza...</p>}
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {count !== null && !loading && (
        <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3">
          <p className="font-mono text-sm text-danger">
            {count === 0 ? (
              "Nu exista intrari de la aceasta data."
            ) : (
              <>Se vor sterge <strong>{count.toLocaleString("ro-RO")}</strong> intrari din {total?.toLocaleString("ro-RO")} totale.</>
            )}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="danger" disabled={!count || count === 0 || loading} onClick={onNext}>
          Continua
        </Button>
      </div>
    </div>
  );
}

function ConfirmStep({
  clientName, fromDate, count, confirmation, loading, error,
  onConfirmationChange, onPaste, onBack, onDelete,
}: {
  clientName: string; fromDate: string; count: number;
  confirmation: string; loading: boolean; error: string;
  onConfirmationChange: (v: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onBack: () => void; onDelete: () => void;
}) {
  const formattedDate = new Date(fromDate).toLocaleDateString("ro-RO", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle size={20} className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Confirma stergerea
        </h2>
      </div>

      <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-4">
        <p className="text-sm text-gray-light">
          Se vor sterge <strong className="text-danger">{count.toLocaleString("ro-RO")} intrari</strong> din
          registrul jurnal al <strong className="text-white">{clientName}</strong> de
          la <strong className="text-white">{formattedDate}</strong> pana in prezent.
        </p>
      </div>

      <label className="mb-1 block font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
        Scrie STERGE pentru a confirma
      </label>
      <input
        type="text"
        value={confirmation}
        onChange={(e) => onConfirmationChange(e.target.value.toUpperCase())}
        onPaste={onPaste}
        placeholder="STERGE"
        autoComplete="off"
        spellCheck={false}
        className="mb-4 h-10 w-full rounded-[10px] border border-danger/30 bg-dark-2 px-4 font-mono text-sm text-white placeholder:text-gray focus:border-danger focus:outline-none"
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack} disabled={loading}>Inapoi</Button>
        <Button variant="danger" onClick={onDelete} disabled={confirmation !== "STERGE" || loading}>
          {loading ? "Se sterge..." : "Sterge definitiv"}
        </Button>
      </div>
    </div>
  );
}

function DoneStep({ deletedCount, onClose }: { deletedCount: number; onClose: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green/10">
        <span className="text-xl text-green">&#10003;</span>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        Stergere finalizata
      </h2>
      <p className="mb-6 text-sm text-gray-light">
        {deletedCount.toLocaleString("ro-RO")} intrari au fost sterse.
        Uploadeaza un registru jurnal actualizat pentru a repopula datele.
      </p>
      <Button onClick={onClose}>Inchide</Button>
    </div>
  );
}
