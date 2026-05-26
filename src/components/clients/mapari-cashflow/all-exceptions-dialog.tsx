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

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { X, AlertCircle, Trash2, Check, Search, History, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  loadAllExceptionsAction,
  loadMapariCashflowAuditAction,
  upsertPartnerOverrideAction,
  deletePartnerOverrideAction,
  revalidateMapariCashflowAction,
} from "@/modules/partner-mappings/actions";
import type { AllExceptionsRow } from "@/modules/partner-mappings";
import type { CostCategoryNode, AccountListItem } from "@/modules/categories";
import type { AccountantAuditRow } from "@/modules/audit";

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
  /** Drill-in: when the contabil clicks a cont in any row, the dialog
   *  closes and the parent opens the partner slide-panel for that cont so
   *  they can keep editing in the richer view. Optional — when omitted,
   *  cont cells render as plain text. */
  onOpenContPanel?: (contBase: string) => void;
}

export function AllExceptionsDialog({
  clientId,
  period,
  tree,
  accounts,
  onClose,
  onMutate,
  onOpenContPanel,
}: Props) {
  const [tab, setTab] = useState<"exceptions" | "audit">("exceptions");
  const [rows, setRows] = useState<AllExceptionsRow[] | null>(null);
  // `loading` is ONLY true on the very first load of the dialog. Subsequent
  // background refetches do NOT flip it back to true — that would replace
  // the live row list with a skeleton on every save and is exactly the
  // jitter we are trying to eliminate.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Tracks whether any in-dialog mutation has happened. We only call the
  // parent's onMutate (router.refresh) ONCE on close, not on every save —
  // refreshing the entire page tree mid-edit causes the modal contents to
  // visibly flash and resets all in-flight inputs.
  const dirtyOnClose = useRef(false);

  // Audit tab state. Loaded lazily on first switch into the tab —
  // most contabili won't open it on every visit, no need to pay the
  // round-trip on dialog open.
  const [auditRows, setAuditRows] = useState<AccountantAuditRow[] | null>(null);
  // Same rule as `loading`: only true on first load. Background refreshes
  // after a save replace the array in place without showing the skeleton.
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

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

  // Lazy-load audit trail on first switch into the tab. Subsequent
  // refreshes go through refreshAuditSilently — never flip auditLoading.
  useEffect(() => {
    if (tab !== "audit") return;
    if (auditRows !== null) return; // already loaded
    let cancelled = false;
    setAuditLoading(true);
    loadMapariCashflowAuditAction({ clientId, limit: 100 }).then((res) => {
      if (cancelled) return;
      if (res.error) setAuditError(res.error);
      else if (res.data) setAuditRows(res.data.items);
      setAuditLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, clientId, auditRows]);

  function refreshAuditSilently() {
    // Refetch audit in the background WITHOUT clearing the existing list,
    // so the user never sees the skeleton when an event is just added.
    // If the audit tab has never been opened, do nothing — it will load
    // fresh the first time the user clicks it.
    if (auditRows === null) return;
    loadMapariCashflowAuditAction({ clientId, limit: 100 }).then((res) => {
      if (res.data) setAuditRows(res.data.items);
    });
  }

  // Close handler that flushes the deferred refresh once. The per-row
  // mutations passed skipRevalidate:true, so the server's path cache
  // is still stale at this point — we revalidate it on close, then
  // tell the parent to refresh its own client-side state.
  const handleClose = async () => {
    if (dirtyOnClose.current) {
      // Fire-and-forget revalidate; the parent's onMutate (router.refresh)
      // re-reads the now-fresh server data. We don't await to keep the
      // close instant.
      revalidateMapariCashflowAction({ clientId });
      onMutate();
    }
    onClose();
  };

  // ESC closes (via handleClose so deferred refresh fires).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Optimistic updates: the row component already knows what changed,
  // so we patch local `rows` immediately and never trigger a skeleton.
  // The parent refresh (router.refresh) is deferred to dialog close.
  function applyLocalUpdate(updated: AllExceptionsRow) {
    setRows((prev) =>
      prev
        ? prev.map((r) => (r.overrideId === updated.overrideId ? updated : r))
        : prev
    );
    dirtyOnClose.current = true;
    refreshAuditSilently();
  }

  function applyLocalDelete(overrideId: string) {
    setRows((prev) =>
      prev ? prev.filter((r) => r.overrideId !== overrideId) : prev
    );
    dirtyOnClose.current = true;
    refreshAuditSilently();
  }

  const totalRulaj = rows?.reduce((sum, r) => sum + Math.abs(r.rulaj), 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden />
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
            {tab === "exceptions" && !loading && rows && (
              <p
                className="font-mono text-[10px] uppercase tracking-wider text-gray mt-0.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {rows.length}{" "}
                {rows.length === 1 ? "exceptie" : "exceptii"} ·{" "}
                {formatRon(totalRulaj)} lei rulaj cumulat
              </p>
            )}
            {tab === "audit" && !auditLoading && auditRows && (
              <p
                className="font-mono text-[10px] uppercase tracking-wider text-gray mt-0.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {auditRows.length}{" "}
                {auditRows.length === 1 ? "actiune" : "actiuni"} inregistrate
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray hover:text-white"
            aria-label="Inchide"
          >
            <X size={16} />
          </button>
        </header>

        {/* Tab strip: Exceptii (current state) | Istoric (audit trail). */}
        <div className="flex items-center gap-1 border-b border-dark-3 px-5 shrink-0">
          <TabButton
            active={tab === "exceptions"}
            onClick={() => setTab("exceptions")}
            label="Exceptii"
            count={rows?.length}
          />
          <TabButton
            active={tab === "audit"}
            onClick={() => setTab("audit")}
            label="Istoric"
            icon={<History size={11} />}
          />
        </div>

        {tab === "exceptions" && (
          <>
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
                            contDefaultCategoryId={contDefaultCategoryId ?? null}
                            contDefaultCategoryName={contDefaultCategoryName}
                            categoryOptions={
                              row.contKind === "expense"
                                ? categoryOptionsByKind.expense
                                : categoryOptionsByKind.revenue
                            }
                            onLocalUpdate={applyLocalUpdate}
                            onLocalDelete={applyLocalDelete}
                            onOpenContPanel={onOpenContPanel}
                          />
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {tab === "audit" && (
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <AuditTab
              loading={auditLoading}
              error={auditError}
              rows={auditRows}
            />
          </div>
        )}

        <div className="border-t border-dark-3 px-5 py-3 flex justify-end shrink-0">
          <Button variant="ghost" onClick={handleClose}>
            Inchide
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                TAB CHROME                                  */
/* -------------------------------------------------------------------------- */

function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-white"
          : "border-transparent text-gray hover:text-gray-light"
      }`}
      style={{ letterSpacing: "-0.02em" }}
    >
      {icon}
      {label}
      {typeof count === "number" && (
        <span
          className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full font-mono text-[10px] ${
            active ? "bg-primary/15 text-primary" : "bg-dark-3 text-gray"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                AUDIT TAB                                   */
/* -------------------------------------------------------------------------- */

function AuditTab({
  loading,
  error,
  rows,
}: {
  loading: boolean;
  error: string | null;
  rows: AccountantAuditRow[] | null;
}) {
  if (loading) return <Skeleton />;
  if (error) return <ErrorState error={error} />;
  if (!rows || rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <History size={28} className="text-gray mx-auto mb-3 opacity-50" />
        <p
          className="text-[14px] font-semibold text-white mb-1"
          style={{ letterSpacing: "-0.04em" }}
        >
          Nicio actiune inregistrata
        </p>
        <p
          className="text-[12px] text-gray max-w-md mx-auto"
          style={{ letterSpacing: "-0.02em" }}
        >
          Aici apar toate modificarile facute pe maparile de parteneri:
          creari, schimbari, stergeri si aplicari in bulk. Fiecare actiune
          este inregistrata cu autorul si momentul exact.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-dark-3">
      {rows.map((r) => (
        <li key={r.id} className="py-3 flex items-start gap-3">
          <div
            className="font-mono text-[10px] uppercase tracking-wider text-gray shrink-0 w-28 pt-0.5"
            title={r.createdAt.toLocaleString("ro-RO")}
          >
            {timeAgo(r.createdAt)}
          </div>
          <p
            className="flex-1 min-w-0 text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="font-medium text-white">{r.actorName}</span>{" "}
            {r.description}
          </p>
        </li>
      ))}
    </ul>
  );
}

const MS_PER_MIN = 60_000;
const MS_PER_HR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < MS_PER_MIN) return "acum cateva secunde";
  if (diff < MS_PER_HR) return `acum ${Math.round(diff / MS_PER_MIN)} min`;
  if (diff < MS_PER_DAY) return `acum ${Math.round(diff / MS_PER_HR)} h`;
  if (diff < 7 * MS_PER_DAY) return `acum ${Math.round(diff / MS_PER_DAY)} zile`;
  return date.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  contDefaultCategoryId,
  contDefaultCategoryName,
  categoryOptions,
  onLocalUpdate,
  onLocalDelete,
  onOpenContPanel,
}: {
  row: AllExceptionsRow;
  clientId: string;
  contDenumire: string;
  /** Id of the category the cont itself maps to. Used to FILTER it out
   *  of the leaf list — we don't want a duplicate entry where the same
   *  category appears once as "Urmeaza contul (X)" and again as "X"
   *  in the leaf list. Both would do the same thing semantically (the
   *  partner ends up in X), but one keeps an explicit override row in
   *  the DB while the other deletes it. Cleaner UI = one entry. */
  contDefaultCategoryId: string | null;
  /** Name of the category the cont itself maps to. Used as the label of
   *  the synthetic "Urmeaza contul" option so the contabil knows EXACTLY
   *  what category the exception reverts to. Null = the cont has no
   *  current mapping (unmapped → the option still works as "delete the
   *  override", we just don't have a target name to advertise). */
  contDefaultCategoryName: string | null;
  categoryOptions: { value: string; label: string }[];
  /** Optimistic update: parent patches the local row list with the new
   *  category id, no refetch, no skeleton. Called only AFTER the server
   *  action succeeds. */
  onLocalUpdate: (updated: AllExceptionsRow) => void;
  /** Optimistic delete: parent removes the row from the local list. */
  onLocalDelete: (overrideId: string) => void;
  /** Drill-in: open the slide-panel for this cont. When provided, the
   *  cont cell becomes a button; otherwise it stays plain text. */
  onOpenContPanel?: (contBase: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picking from the dropdown only STAGES the change locally — nothing
  // hits the server until the contabil clicks Salveaza. Symmetry with
  // the slide-panel pattern: explicit save, reversible via Renunta, no
  // accidental DB writes from a misclick on a 10-option Select.
  const [stagedValue, setStagedValue] = useState<string>(row.categoryId);

  // If the persisted row changes (other mutations, refetch), resync —
  // but only when there's no in-flight edit, otherwise we'd overwrite
  // the contabil's pending change. Tracked by comparing the latest
  // persisted value with the previous one we synced from.
  useEffect(() => {
    setStagedValue(row.categoryId);
  }, [row.categoryId]);

  const isDirty = stagedValue !== row.categoryId;

  // Synthetic "delete this override" option. Prepended to the leaf-
  // category list so the contabil can revert to the cont's default
  // from the same Select used to change categories — symmetry with the
  // slide-panel UX. The literal value is not a real categoryId; the
  // save handler intercepts it and calls deletePartnerOverrideAction
  // instead of upsertPartnerOverrideAction.
  //
  // We also FILTER OUT the cont's default category from the leaf list
  // so the contabil doesn't see two entries for the same target (one
  // labelled "Urmeaza contul (X)" and another just "X"). Both would
  // route the partner to X, but the synthetic one deletes the override
  // (cleaner DB state). One entry = one decision.
  const optionsWithDefault = useMemo(() => {
    const leaves = contDefaultCategoryId
      ? categoryOptions.filter((o) => o.value !== contDefaultCategoryId)
      : categoryOptions;
    return [
      {
        value: DELETE_SENTINEL,
        label: contDefaultCategoryName
          ? `Urmeaza contul (${contDefaultCategoryName})`
          : "Urmeaza contul (sterge exceptia)",
      },
      ...leaves,
    ];
  }, [categoryOptions, contDefaultCategoryId, contDefaultCategoryName]);

  function commit() {
    if (!isDirty) return;
    setError(null);
    const valueToSave = stagedValue;
    startTransition(async () => {
      if (valueToSave === DELETE_SENTINEL) {
        const res = await deletePartnerOverrideAction({
          clientId,
          id: row.overrideId,
          skipRevalidate: true,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        // Optimistic: remove the row locally. No skeleton, no flicker.
        onLocalDelete(row.overrideId);
        return;
      }
      const res = await upsertPartnerOverrideAction({
        clientId,
        contBase: row.contBase,
        partnerNameOriginal: row.partnerNameOriginal,
        categoryId: valueToSave,
        skipRevalidate: true,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      // Optimistic: patch the row in place with the new categoryId.
      // Rulaj and partner identity stay the same; only the target changes.
      onLocalUpdate({ ...row, categoryId: valueToSave });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    });
  }

  function revert() {
    setError(null);
    setStagedValue(row.categoryId);
  }

  function removeOverride() {
    if (
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
        skipRevalidate: true,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onLocalDelete(row.overrideId);
    });
  }

  // Visual cue for historical overrides (no activity in current period).
  const isIdle = row.rulaj === 0;

  return (
    <li
      className={`group grid grid-cols-[auto_1fr_auto_220px_auto] items-center gap-3 px-3 py-2 rounded hover:bg-dark-3/40 ${
        isIdle ? "opacity-70" : ""
      } ${pending ? "opacity-60" : ""} ${isDirty ? "bg-primary/[0.04]" : ""}`}
    >
      {/* Cont — clickable when onOpenContPanel is wired (default in
          MapariCashflowTab). Clicking closes the dialog and drills into
          the partner slide-panel for this cont so the contabil can keep
          working on the same cont in a richer view. */}
      {onOpenContPanel ? (
        <button
          type="button"
          data-testid={`exception-row-cont-${row.contBase}`}
          onClick={() => onOpenContPanel(row.contBase)}
          title={`Deschide panoul cu partenerii pe contul ${row.contBase}`}
          className="flex flex-col min-w-0 w-[140px] text-left rounded -mx-1.5 px-1.5 py-0.5 hover:bg-primary/[0.08] hover:ring-1 hover:ring-primary/30 transition-colors"
        >
          <span
            className="font-mono text-[11px] text-gray-light tabular-nums group-hover:text-white"
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
        </button>
      ) : (
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
      )}

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
          value={stagedValue}
          options={optionsWithDefault}
          onChange={setStagedValue}
          className={pending ? "opacity-60" : ""}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isDirty ? (
          <>
            <Tooltip content="Salveaza schimbarea">
              <button
                type="button"
                onClick={commit}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#E9E8E3] hover:bg-primary-dark disabled:opacity-50"
                style={{ letterSpacing: "-0.02em" }}
              >
                <Save size={11} />
                Salveaza
              </button>
            </Tooltip>
            <Tooltip content="Anuleaza schimbarea">
              <button
                type="button"
                onClick={revert}
                disabled={pending}
                className="p-1 text-gray hover:text-gray-light disabled:opacity-50"
                aria-label="Anuleaza schimbarea"
              >
                <X size={12} />
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            {savedFlash && (
              <Tooltip content="Salvat">
                <Check size={14} className="text-pos" />
              </Tooltip>
            )}
            {error && (
              <Tooltip content={error}>
                <span className="cursor-help">
                  <AlertCircle size={14} className="text-neg" />
                </span>
              </Tooltip>
            )}
            <Tooltip content="Sterge exceptia (partenerul revine la categoria contului)">
              <button
                type="button"
                onClick={removeOverride}
                disabled={pending}
                className="p-1.5 text-gray hover:text-neg disabled:opacity-50"
                aria-label="Sterge exceptia"
              >
                <Trash2 size={14} />
              </button>
            </Tooltip>
          </>
        )}
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
