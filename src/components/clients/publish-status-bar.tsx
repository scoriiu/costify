"use client";

/**
 * Contextual publish bar shown above Balanta / CPP tabs.
 *
 * For the selected (year, month), shows whether it's published and lets the
 * accountant publish or re-publish with one click. Also flags "stale" — when
 * the journal has changed since the last publish for this period.
 *
 * Server actions handle the mutation; the bar refreshes via router.refresh().
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, AlertCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  publishPeriodAction,
  unpublishPeriodAction,
} from "@/modules/publishing/actions";

export interface PublishStatusInfo {
  isPublished: boolean;
  publishedAt: string | null; // ISO
  publisherName: string | null;
  noteForOwner: string | null;
  stale: boolean;
}

interface Props {
  clientId: string;
  clientSlug: string;
  year: number;
  month: number;
  status: PublishStatusInfo;
}

const MONTH_NAMES = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

function formatRoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PublishStatusBar({ clientId, year, month, status }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);

  function doPublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishPeriodAction({ clientId, year, month });
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
      const result = await unpublishPeriodAction({ clientId, year, month });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmingUnpublish(false);
      router.refresh();
    });
  }

  const monthName = MONTH_NAMES[month - 1];

  if (!status.isPublished) {
    return (
      <BarShell tone="warn">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle size={14} className="text-amber-300 shrink-0" />
          <span
            className="text-[13px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="font-medium text-white">{monthName} {year}</span>
            {" "}nu este publicat. Firma nu vede inca aceasta luna.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error && <ErrorChip msg={error} />}
          <Button onClick={doPublish} disabled={isPending}>
            <Send size={12} className="mr-1.5" />
            {isPending ? "Se publica..." : `Publica ${monthName}`}
          </Button>
        </div>
      </BarShell>
    );
  }

  if (status.stale) {
    return (
      <BarShell tone="warn">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={14} className="text-amber-300 shrink-0" />
          <span
            className="text-[13px] text-gray-light truncate"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="font-medium text-white">{monthName} {year}</span>
            {" "}a fost modificat dupa publicare ({formatRoDate(status.publishedAt!)}).
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error && <ErrorChip msg={error} />}
          <Button onClick={doPublish} disabled={isPending}>
            {isPending ? "Se publica..." : "Re-publica"}
          </Button>
        </div>
      </BarShell>
    );
  }

  return (
    <BarShell tone="ok">
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle2 size={14} className="text-emerald-300 shrink-0" />
        <span
          className="text-[13px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
        >
          <span className="font-medium text-white">{monthName} {year}</span>
          {" "}publicat la {formatRoDate(status.publishedAt!)}
          {status.publisherName ? ` de ${status.publisherName}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {error && <ErrorChip msg={error} />}
        {confirmingUnpublish ? (
          <>
            <Button variant="danger" onClick={doUnpublish} disabled={isPending}>
              <X size={12} className="mr-1.5" />
              {isPending ? "Se retrage..." : "Confirma retragerea"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingUnpublish(false)}>
              Anuleaza
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirmingUnpublish(true)}>
              Retrage
            </Button>
            <Button onClick={doPublish} disabled={isPending}>
              {isPending ? "Se publica..." : "Re-publica"}
            </Button>
          </>
        )}
      </div>
    </BarShell>
  );
}

function BarShell({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  const border = tone === "ok" ? "border-emerald-400/20" : "border-amber-300/20";
  const bg = tone === "ok" ? "bg-emerald-500/5" : "bg-amber-300/5";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[10px] border ${border} ${bg} px-4 py-2.5`}>
      {children}
    </div>
  );
}

function ErrorChip({ msg }: { msg: string }) {
  return (
    <span
      className="text-[11px] text-red-300 border border-red-500/30 bg-red-500/10 rounded px-2 py-0.5 max-w-[260px] truncate"
      title={msg}
      style={{ letterSpacing: "-0.02em" }}
    >
      {msg}
    </span>
  );
}
