"use client";

/**
 * Centralised "Toate exceptiile" view — every PartnerCategoryOverride the
 * contabil has set across the entire firm, in one place, with inline edit
 * and delete.
 *
 * Use case: the contabil wants to audit "what overrides have we
 * accumulated?", change a category for a partner that appears across
 * multiple conts, or clean up historical overrides that no longer matter.
 *
 * Per-cont slide-panel (partner-panel.tsx) is for working ON one cont; this
 * dialog is for the cross-cont, cross-partner overview.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { X, AlertCircle, Trash2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  loadAllExceptionsAction,
  upsertPartnerOverrideAction,
  deletePartnerOverrideAction,
} from "@/modules/partner-mappings/actions";
import type { AllExceptionsRow } from "@/modules/partner-mappings";
import type { CostCategoryNode, AccountListItem } from "@/modules/categories";

interface Props {
  clientId: string;
  period: { year: number; month: number };
  tree: CostCategoryNode[];
  /** Used to enrich the override rows with the cont's display name. We
   *  receive the full account list from the parent (already loaded) to
   *  avoid a second round-trip. */
  accounts: AccountListItem[];
  onClose: () => void;
  /** Called after every save/delete so the parent re-fetches its data. */
  onMutate: () => void;
}

export function AllExceptionsDialog({
  clientId,
  period,
  tree,
  accounts,
  onClose,
  onMutate,
}: Props) {
  const [rows, setRows] = useState<AllExceptionsRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAllExceptionsAction({
      clientId,
      year: period.year,
      month: period.month,
    }).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else if (res.data) setRows(res.data.items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, period.year, period.month]);

  // ESC closes.
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

  // cont -> denumire from the loaded accounts list. Multiple analytics
  // (628.01, 628.02) share a contBase; we pick the first available.
  const contDenumireByBase = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) {
      if (!map.has(a.contBase)) map.set(a.contBase, a.denumire);
    }
    return map;
  }, [accounts]);

  // cont -> the categoryId currently mapped on the cont itself. Lets us
  // surface the "Urmeaza contul ([X])" option per row so the contabil
  // sees WHAT category the exception would revert to before clicking.
  // In this cross-cont view each row's cont may have a different default,
  // unlike the slide-panel where one cont anchors the whole list.
  const contCategoryByBase = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) {
      // Prefer base-scope mapping when present; otherwise any current
      // mapping (analytic still tells us where it goes by default).
      if (!a.currentMapping) continue;
      if (!map.has(a.contBase)) map.set(a.contBase, a.currentMapping.categoryId);
    }
    return map;
  }, [accounts]);

  // Category options grouped by expense/revenue. We use leaves only since
  // an override on a parent category has the same semantics problem as a
  // cont-mapping on a parent (already enforced as leaf-only in the panel).
  const categoryOptionsByKind = useMemo(() => {
    const expense: { value: string; label: string }[] = [];
    const revenue: { value: string; label: string }[] = [];
    function walk(nodes: CostCategoryNode[], prefix: string) {
      for (const n of nodes) {
        const label = prefix ? `${prefix} › ${n.name}` : n.name;
        if (n.children.length === 0) {
          (n.kind === "expense" ? expense : revenue).push({
            value: n.id,
            label,
          });
        } else {
          walk(n.children, label);
        }
      }
    }
    walk(tree, "");
    return { expense, revenue };
  }, [tree]);

  // Filter: diacritic-insensitive substring match across partner name and
  // cont code. Same normalization logic as the partner panel.
  const normalizedQuery = useMemo(() => normalize(query.trim()), [query]);
  const visibleRows = useMemo(() => {
    if (!rows) return [];
    if (!normalizedQuery) return rows;
    return rows.filter((r) => {
      const partnerNorm = normalize(r.partnerNameOriginal);
      const contMatch = r.contBase.includes(normalizedQuery);
      const partnerMatch = partnerNorm.includes(normalizedQuery);
      const categoryName = categoryNameById.get(r.categoryId) ?? "";
      const categoryMatch = normalize(categoryName).includes(normalizedQuery);
      return contMatch || partnerMatch || categoryMatch;
    });
  }, [rows, normalizedQuery, categoryNameById]);

  function handleRowMutated() {
    // Re-fetch the full list so counts, sums and freshly-deleted rows
    // disappear/appear correctly without a full page refresh.
    loadAllExceptionsAction({
      clientId,
      year: period.year,
      month: period.month,
    }).then((res) => {
      if (res.data) setRows(res.data.items);
    });
    onMutate();
  }

  const totalRulaj = rows?.reduce((sum, r) => sum + Math.abs(r.rulaj), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        className="relative bg-dark-2 border border-dark-3 rounded-xl w-full max-w-4xl mx-4 max-h-[90vh] shadow-2xl flex flex-col"
        role="dialog"
        aria-label="Toate exceptiile"
      >
        <header className="flex items-center justify-between border-b border-dark-3 px-5 py-3 shrink-0">
          <div>
            <h3
              className="text-[15px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Toate exceptiile pe parteneri
            </h3>
            {!loading && rows && (
              <p
                className="font-mono text-[10px] uppercase tracking-wider text-gray mt-0.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {rows.length}{" "}
                {rows.length === 1 ? "exceptie" : "exceptii"} ·{" "}
                {formatRon(totalRulaj)} lei rulaj cumulat
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

        <div className="px-5 py-3 border-b border-dark-3 shrink-0">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cauta dupa partener, cont, sau categorie..."
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <Skeleton />}
          {error && <ErrorState error={error} />}
          {!loading && !error && rows && rows.length === 0 && <EmptyState />}
          {!loading && !error && rows && rows.length > 0 && (
            <>
              {visibleRows.length === 0 ? (
                <p
                  className="text-[12px] text-gray italic py-6 text-center"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Nicio exceptie nu se potriveste cautarii.
                </p>
              ) : (
                <ul className="space-y-1">
                  {visibleRows.map((row) => {
                    const contDefaultCategoryId = contCategoryByBase.get(
                      row.contBase
                    );
                    const contDefaultCategoryName = contDefaultCategoryId
                      ? categoryNameById.get(contDefaultCategoryId) ?? null
                      : null;
                    return (
                      <ExceptionRow
                        key={row.overrideId}
                        row={row}
                        clientId={clientId}
                        contDenumire={contDenumireByBase.get(row.contBase) ?? ""}
                        contDefaultCategoryName={contDefaultCategoryName}
                        categoryOptions={
                          row.contKind === "expense"
                            ? categoryOptionsByKind.expense
                            : categoryOptionsByKind.revenue
                        }
                        onMutated={handleRowMutated}
                      />
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="border-t border-dark-3 px-5 py-3 flex justify-end shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Inchide
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 SUB-COMPONENTS                             */
/* -------------------------------------------------------------------------- */

/** Sentinel value used in the per-row Select to represent the "Urmeaza
 *  contul (sterge exceptia)" option. Picking it triggers deletion of the
 *  override, NOT an upsert. Must be impossible to collide with a real
 *  CostCategory id (cuid2 format). */
const DELETE_SENTINEL = "__delete__";

function ExceptionRow({
  row,
  clientId,
  contDenumire,
  contDefaultCategoryName,
  categoryOptions,
  onMutated,
}: {
  row: AllExceptionsRow;
  clientId: string;
  contDenumire: string;
  /** Name of the category the cont itself maps to. Used as the label of
   *  the synthetic "Urmeaza contul" option so the contabil knows EXACTLY
   *  what category the exception reverts to. Null = the cont has no
   *  current mapping (unmapped → the option still works as "delete the
   *  override", we just don't have a target name to advertise). */
  contDefaultCategoryName: string | null;
  categoryOptions: { value: string; label: string }[];
  onMutated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synthetic "delete this override" option. Prepended to the leaf-
  // category list so the contabil can revert to the cont's default
  // from the same Select used to change categories — symmetry with the
  // slide-panel UX. The literal value is not a real categoryId; the
  // change handler intercepts it and calls deletePartnerOverrideAction
  // instead of upsertPartnerOverrideAction.
  const optionsWithDefault = useMemo(
    () => [
      {
        value: DELETE_SENTINEL,
        label: contDefaultCategoryName
          ? `Urmeaza contul (${contDefaultCategoryName})`
          : "Urmeaza contul (sterge exceptia)",
      },
      ...categoryOptions,
    ],
    [categoryOptions, contDefaultCategoryName]
  );

  function changeCategory(newCategoryId: string) {
    if (newCategoryId === row.categoryId) return;
    if (newCategoryId === DELETE_SENTINEL) {
      removeOverride({ skipConfirm: true });
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertPartnerOverrideAction({
        clientId,
        contBase: row.contBase,
        partnerNameOriginal: row.partnerNameOriginal,
        categoryId: newCategoryId,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      onMutated();
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function removeOverride(opts?: { skipConfirm?: boolean }) {
    if (
      !opts?.skipConfirm &&
      !confirm(
        `Sterg exceptia pentru "${row.partnerNameOriginal}" pe cont ${row.contBase}? Va reveni la categoria contului.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deletePartnerOverrideAction({
        clientId,
        id: row.overrideId,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onMutated();
    });
  }

  // Visual cue for historical overrides (no activity in current period).
  const isIdle = row.rulaj === 0;

  return (
    <li
      className={`group grid grid-cols-[auto_1fr_auto_220px_auto] items-center gap-3 px-3 py-2 rounded hover:bg-dark-3/40 ${
        isIdle ? "opacity-70" : ""
      } ${pending ? "opacity-60" : ""}`}
    >
      {/* Cont */}
      <div className="flex flex-col min-w-0 w-[140px]">
        <span
          className="font-mono text-[11px] text-gray tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          {row.contBase}
        </span>
        <span
          className="text-[10px] text-gray truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={contDenumire}
        >
          {contDenumire}
        </span>
      </div>

      {/* Partner */}
      <div className="min-w-0">
        <span
          className="block text-[12px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={row.partnerNameOriginal}
        >
          {row.partnerNameOriginal}
        </span>
        {isIdle && (
          <span
            className="text-[10px] text-gray italic"
            style={{ letterSpacing: "-0.02em" }}
          >
            fara activitate in aceasta perioada
          </span>
        )}
      </div>

      {/* Rulaj */}
      <span
        className="font-mono text-[11px] text-gray tabular-nums shrink-0 text-right w-[90px]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {formatRon(Math.abs(row.rulaj))}
      </span>

      {/* Category select */}
      <div className="shrink-0">
        <Select
          value={row.categoryId}
          options={optionsWithDefault}
          onChange={changeCategory}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {saved && <Check size={12} className="text-pos" />}
        {error && (
          <Tooltip content={error}>
            <span className="cursor-help">
              <AlertCircle size={12} className="text-neg" />
            </span>
          </Tooltip>
        )}
        <Tooltip content="Sterge exceptia (partenerul revine la categoria contului)">
          <button
            type="button"
            onClick={() => removeOverride()}
            disabled={pending}
            className="p-1.5 text-gray hover:text-neg disabled:opacity-50"
            aria-label="Sterge exceptia"
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 bg-dark-3/40 rounded animate-pulse" />
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-neg-border bg-neg-bg px-3 py-3 my-3">
      <AlertCircle size={14} className="text-neg shrink-0 mt-0.5" />
      <p className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
        {error}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <Search size={28} className="text-gray mx-auto mb-3 opacity-50" />
      <p
        className="text-[14px] font-semibold text-white mb-1"
        style={{ letterSpacing: "-0.04em" }}
      >
        Nicio exceptie inca
      </p>
      <p
        className="text-[12px] text-gray max-w-md mx-auto"
        style={{ letterSpacing: "-0.02em" }}
      >
        Cand suprascrii un partener pe un cont catre alta categorie decat
        cea a contului, exceptia va aparea aici. Pana atunci, toti
        partenerii urmeaza maparea contului.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function formatRon(n: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
