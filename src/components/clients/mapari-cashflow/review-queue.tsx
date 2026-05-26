"use client";

/**
 * Card-by-card review queue for cross-cont suggestions. Surfaces every
 * suggestion across every cont in one focused mini-flow.
 *
 * Sprint 5 of the Mapari Cashflow rewrite. The Sprint 4 yellow indicator
 * on PartnerRow tells the contabil suggestions exist; this dialog lets
 * them work through all of them in one pass without opening N panels.
 *
 * Flow per card:
 *   [Confirma]  → upserts the suggestion as a real manual override
 *   [Schimba ▾] → pick a different category from the dropdown
 *   [Sari peste] → skip without writing anything (suggestion stays for
 *                  next time, contabil can return)
 */

import { useEffect, useState, useTransition, useMemo } from "react";
import { X, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  loadSuggestionQueueAction,
  upsertPartnerOverrideAction,
} from "@/modules/partner-mappings/actions";
import type { SuggestionQueueItem } from "@/modules/partner-mappings";
import type { CostCategoryNode } from "@/modules/categories";

interface Props {
  clientId: string;
  period: { year: number; month: number };
  tree: CostCategoryNode[];
  onClose: () => void;
  onMutate: () => void;
  /** Drill-in: when the contabil clicks the "Pe contul X" header in a
   *  queue card, the dialog closes and the parent opens the partner
   *  slide-panel for that cont so they can see ALL partners on it
   *  (not just the one suggested). Optional. */
  onOpenContPanel?: (contBase: string) => void;
}

export function ReviewQueueDialog({
  clientId,
  period,
  tree,
  onClose,
  onMutate,
  onOpenContPanel,
}: Props) {
  const [items, setItems] = useState<SuggestionQueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadSuggestionQueueAction({ clientId, year: period.year, month: period.month })
      .then((res) => {
        if (cancelled) return;
        if (res.error) setError(res.error);
        else if (res.data) setItems(res.data.items);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, period.year, period.month]);

  // ESC closes the dialog. Disabled while a save is in flight (handled
  // inside the card via the Button disabled state).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    function walk(nodes: CostCategoryNode[]) {
      for (const n of nodes) {
        map.set(n.id, n.name);
        walk(n.children);
      }
    }
    walk(tree);
    return map;
  }, [tree]);

  function advance(updatedItems?: SuggestionQueueItem[]) {
    const next = updatedItems ?? items;
    if (!next) return;
    if (index >= next.length - 1) {
      // Last card processed — close the dialog and let the parent refresh.
      onMutate();
      onClose();
    } else {
      setIndex(index + 1);
    }
  }

  const currentItem = items?.[index] ?? null;
  const total = items?.length ?? 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        className="relative bg-dark-2 border border-dark-3 rounded-xl w-full max-w-xl mx-4 shadow-2xl"
        role="dialog"
        aria-label="Coada de revizuire"
      >
        <header className="flex items-center justify-between border-b border-dark-3 px-5 py-3">
          <div>
            <h3
              className="text-[15px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Coada de revizuire
            </h3>
            {!loading && total > 0 && (
              <p
                className="font-mono text-[10px] uppercase tracking-wider text-gray mt-0.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {index + 1} / {total}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray hover:text-white"
            aria-label="Inchide"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-5 py-6 min-h-[260px]">
          {loading && <QueueSkeleton />}
          {error && <QueueError error={error} />}
          {!loading && !error && items && items.length === 0 && <QueueEmpty />}
          {!loading && !error && currentItem && (
            <QueueCard
              key={`${currentItem.contBase}-${currentItem.partnerNameNormalized}`}
              item={currentItem}
              clientId={clientId}
              tree={tree}
              categoryNameById={categoryNameById}
              onOpenContPanel={onOpenContPanel}
              onResolved={() => {
                // Remove the just-handled item from local state so the
                // counter and progress reflect reality without a refetch.
                const next = items!.filter((_, i) => i !== index);
                setItems(next);
                if (index >= next.length && next.length > 0) {
                  // We were on the last card — back up by one.
                  setIndex(Math.max(0, next.length - 1));
                }
                if (next.length === 0) {
                  onMutate();
                  onClose();
                }
              }}
              onSkip={() => advance()}
            />
          )}
        </div>

        {items && items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-4">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-primary"
                    : i < index
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-dark-3"
                }`}
                aria-hidden
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  CARD                                       */
/* -------------------------------------------------------------------------- */

function QueueCard({
  item,
  clientId,
  tree,
  categoryNameById,
  onOpenContPanel,
  onResolved,
  onSkip,
}: {
  item: SuggestionQueueItem;
  clientId: string;
  tree: CostCategoryNode[];
  categoryNameById: Map<string, string>;
  onOpenContPanel?: (contBase: string) => void;
  onResolved: () => void;
  onSkip: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [pickedCategory, setPickedCategory] = useState(item.suggestedCategoryId);

  const categoryOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    walkLeaves(tree, item.contKind, "", out);
    return out;
  }, [tree, item.contKind]);

  const suggestedName = categoryNameById.get(item.suggestedCategoryId) ?? "—";

  function applyOverride(categoryId: string) {
    setError(null);
    startTransition(async () => {
      const res = await upsertPartnerOverrideAction({
        clientId,
        contBase: item.contBase,
        partnerNameOriginal: item.partnerNameOriginal,
        categoryId,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onResolved();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        {onOpenContPanel ? (
          <button
            type="button"
            data-testid={`queue-card-cont-${item.contBase}`}
            onClick={() => onOpenContPanel(item.contBase)}
            title={`Deschide panoul cu toti partenerii pe contul ${item.contBase}`}
            className="inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded font-mono text-[11px] uppercase tracking-wider text-gray hover:text-primary hover:bg-primary/10 transition-colors"
            style={{ letterSpacing: "-0.02em" }}
          >
            Pe contul {item.contBase} →
          </button>
        ) : (
          <p
            className="font-mono text-[11px] uppercase tracking-wider text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Pe contul {item.contBase}
          </p>
        )}
        <h4
          className="text-[20px] font-semibold text-white mt-1"
          style={{ letterSpacing: "-0.04em" }}
        >
          {item.partnerNameOriginal}
        </h4>
        <p
          className="font-mono text-[11px] text-gray tabular-nums mt-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          {formatRon(item.rulaj)} lei in aceasta perioada
        </p>
      </div>

      <div className="rounded-lg border border-dark-3 bg-dark-2 p-3 space-y-2">
        <p
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Sistemul propune
        </p>
        <p
          className="text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {suggestedName}
        </p>
        {item.reasonContBases.length > 0 && (
          <p
            className="text-[11px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Pentru ca pe{" "}
            {item.reasonContBases.length === 1
              ? `contul ${item.reasonContBases[0]}`
              : `conturile ${item.reasonContBases.join(", ")}`}{" "}
            partenerul a fost mapat la <strong>{suggestedName}</strong>.
          </p>
        )}
      </div>

      {changing && (
        <div className="space-y-2">
          <p
            className="font-mono text-[10px] uppercase tracking-wider text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Alege alta categorie
          </p>
          <Select
            value={pickedCategory}
            options={categoryOptions}
            onChange={setPickedCategory}
          />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-neg-border bg-neg-bg px-3 py-2">
          <AlertCircle size={14} className="text-neg shrink-0 mt-0.5" />
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {error}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={onSkip}
          disabled={pending}
          className="h-9 px-3 text-[13px]"
        >
          Sari peste
        </Button>
        <div className="flex items-center gap-2">
          {!changing ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setChanging(true)}
                disabled={pending}
                className="h-9 px-3 text-[13px]"
              >
                Schimba
              </Button>
              <Button
                variant="primary"
                onClick={() => applyOverride(item.suggestedCategoryId)}
                disabled={pending}
                className="h-9 px-4 text-[13px]"
              >
                {pending ? "Se salveaza..." : "Confirma"}{" "}
                <ArrowRight size={12} />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setChanging(false);
                  setPickedCategory(item.suggestedCategoryId);
                }}
                disabled={pending}
                className="h-9 px-3 text-[13px]"
              >
                Anuleaza
              </Button>
              <Button
                variant="primary"
                onClick={() => applyOverride(pickedCategory)}
                disabled={pending || !pickedCategory}
                className="h-9 px-4 text-[13px]"
              >
                {pending ? "Se salveaza..." : "Aplica"}{" "}
                <ArrowRight size={12} />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              SUB-COMPONENTS                                */
/* -------------------------------------------------------------------------- */

function QueueSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/3 bg-dark-2 rounded animate-pulse" />
      <div className="h-7 w-2/3 bg-dark-2 rounded animate-pulse" />
      <div className="h-20 bg-dark-2 rounded animate-pulse" />
      <div className="h-9 bg-dark-2 rounded animate-pulse" />
    </div>
  );
}

function QueueError({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-neg-border bg-neg-bg px-3 py-2">
      <AlertCircle size={14} className="text-neg shrink-0 mt-0.5" />
      <p
        className="text-[12px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        {error}
      </p>
    </div>
  );
}

function QueueEmpty() {
  return (
    <div className="text-center py-8">
      <p
        className="text-[14px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Nicio sugestie de revizuit acum.
      </p>
      <p
        className="text-[12px] text-gray mt-2"
        style={{ letterSpacing: "-0.02em" }}
      >
        Cand mapezi un partener pe un cont, sistemul propune aceeasi categorie
        cand acelasi partener apare pe alt cont.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function walkLeaves(
  nodes: CostCategoryNode[],
  kind: "expense" | "revenue",
  prefix: string,
  out: { value: string; label: string }[]
) {
  for (const node of nodes) {
    if (node.kind !== kind) continue;
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    if (node.children.length === 0) {
      out.push({ value: node.id, label });
    } else {
      walkLeaves(node.children, kind, label, out);
    }
  }
}

const RON = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
