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
import { Send, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  hasJournalData: boolean;
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
  const visible = useMemo(
    () => (showAll ? rows : defaultVisibleRows(rows)),
    [rows, showAll]
  );
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
        <div className="flex items-center gap-2.5">
          <Send size={16} className="text-primary" />
          <h2
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Publicare catre firma
          </h2>
        </div>
        <p
          className="mt-1.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Patronul vede doar lunile publicate. Re-publica dupa orice corectie.
        </p>
      </header>

      <ul className="mt-5 divide-y divide-dark-3">
        {visible.map((row) => (
          <PublishRow key={`${row.year}-${row.month}`} clientId={clientId} row={row} />
        ))}
      </ul>

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
    </section>
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
        className="font-mono text-[10px] uppercase tracking-wider text-amber-300/80"
        aria-hidden
      >
        Nepublicat
      </span>
    );
  } else if (row.stale) {
    status = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
        <AlertTriangle size={10} />
        Modificat dupa publicare
      </span>
    );
  } else {
    status = (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300/80">
        <CheckCircle2 size={10} />
        Publicat {formatRoDate(row.publishedAt!)}
        {row.publisherName ? ` · ${row.publisherName}` : ""}
      </span>
    );
  }

  return (
    <li className="py-3 flex items-center justify-between gap-3">
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
            className="mt-1 text-[11px] text-red-300"
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
        {row.isPublished && row.stale && (
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
    </li>
  );
}
