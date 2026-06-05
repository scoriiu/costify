"use client";

/**
 * "Mapari Cashflow" tab — accountant-only screen on /clients/[slug].
 *
 * Wizard with two tabs, one per modelling axis:
 *
 *   Categorii (axa A)         — how to group costs/revenues for the patron.
 *                               Always present, obligatory. Sub-page contains
 *                               a collapsible "Numele grupurilor" + the full
 *                               account list with the category column only.
 *
 *   Linii de business (axa B) — optional firm-specific verticals (Outsourcing,
 *                               Recruitment, Coworking, etc). Sub-page
 *                               contains the verticals panel + the same
 *                               account list, this time with the vertical
 *                               column. Empty state with CTA when the firm
 *                               has not activated verticals yet.
 *
 * Active tab is persisted in the URL as ?cashflow-tab=categorii|verticale so
 * the contabil can refresh / deep-link without losing context. Filter state
 * (Toate / Nemapate / Cheltuieli / Venituri) persists across tab switches —
 * same conturi, different axis focus.
 *
 * All mutations go through server actions and the page revalidates afterwards.
 * No client-side optimistic state — eliminates "saved but UI lies" bugs.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Pencil, Trash2, Check, AlertTriangle, Sparkles, Info, Layers, Network, X, Users, CornerUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import { DocsLink } from "@/components/ui/docs-link";
import { DocsLinks } from "@/modules/docs/links";
import { useEscapeKey } from "@/lib/use-escape-key";
import type {
  CostCategoryNode,
  MappingScope,
  AccountListItem,
  MapariCashflowData,
  CoverageStats,
} from "@/modules/categories";
import type { PartnerSummary } from "@/modules/partner-mappings";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  mapAccountAction,
  unmapAccountAction,
} from "@/modules/categories/actions";
import {
  enableVerticalsAction,
  disableVerticalsAction,
  createVerticalAction,
  renameVerticalAction,
  deleteVerticalAction,
} from "@/modules/verticals/actions";
import { flattenTreeForPicker, pickerLabel, type FlatNode } from "./tree-utils";
import { VerticalPicker } from "./vertical-picker";
import {
  EditAllocationDialog,
  EditFirmDefaultAllocationDialog,
} from "./edit-allocation-dialog";
import { CategoryWorkspace } from "./category-workspace";
import { ReviewQueueDialog } from "./review-queue";
import { AllExceptionsDialog } from "./all-exceptions-dialog";
import type { VerticalView, AllocationSplit } from "@/modules/verticals";

interface Props {
  clientId: string;
  /** Server-rendered MapariCashflowData for the initial (or URL-specified)
   *  year. When the page was loaded directly with ?tab=mapari-cashflow,
   *  this is populated and the tab paints instantly with no client
   *  fetch. When the user reached Mapari via an in-page tab switch
   *  (e.g. from Jurnal), this is null and we fetch on mount. */
  initialData: MapariCashflowData | null;
  /** The year that `initialData` corresponds to, or the URL-specified
   *  year when initialData is null. Optional (undefined == newest). */
  initialYear?: number;
  /** The month within `initialYear` (URL-specified). Optional (undefined ==
   *  latest month of the year). */
  initialMonth?: number;
  /** Bumped by any client-data mutation. When the parent re-renders with
   *  a higher value, we refetch the active period. */
  dataVersion: number;
}

/** Stable string key for a (year, month) period — used as the cache key and
 *  for URL sync. */
function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

type Filter = "all" | "unmapped" | "expense" | "revenue" | "unallocated" | "split";

/** Per-cont breakdown of how much it contributes to default-vertical residue,
 *  with the absorbing target categories. Empty entries are omitted (use
 *  `Map.has(cont)` to check). Sorted desc by per-target amount. */
type ResidueSourceDetail = {
  totalAmount: number;
  targets: { categoryId: string; categoryName: string; amount: number }[];
};

type CashflowTab = "categorii" | "verticale";

/**
 * Public entry point — owns the per-year data cache and the current-year
 * state. Initial render is instant: `initialData` was fetched on the
 * server and arrives as a prop. Year changes are client-side: a per-year
 * `useState<Map>` cache means switching back to a previously-loaded year
 * is also instant. New years fetch once via /api/mapari-cashflow.
 *
 * After a server-side mutation, the parent re-renders with a higher
 * `dataVersion`. We drop the per-year cache (the entire client's data
 * picture may have shifted) and refetch the active year so the user
 * sees their change. The currently-rendered tab keeps its previous
 * payload on screen during the refetch — no spinner blink.
 */
export function MapariCashflowTab({
  clientId,
  initialData,
  initialYear,
  initialMonth,
  dataVersion,
}: Props) {
  // Resolved (year, month) for the payload we currently show. When initialData
  // is present we trust the server's choice; otherwise we keep the URL period
  // (or 0/0 — the empty placeholder meaning "ask the server for the newest").
  const initialResolvedYear = initialData?.period?.year ?? initialYear ?? 0;
  const initialResolvedMonth = initialData?.period?.month ?? initialMonth ?? 0;
  const [current, setCurrent] = useState<{ year: number; month: number }>({
    year: initialResolvedYear,
    month: initialResolvedMonth,
  });
  const [periodCache, setPeriodCache] = useState<
    Map<string, MapariCashflowData>
  >(() => {
    const m = new Map<string, MapariCashflowData>();
    if (initialData) {
      m.set(periodKey(initialResolvedYear, initialResolvedMonth), initialData);
    }
    return m;
  });
  const [error, setError] = useState(false);

  // Cancels any prior in-flight refetch when a new save happens. Without
  // this, a fast user (save, save, save) would race three responses and
  // the last to land wins — usually fine, but a stale early response
  // could overwrite a fresh later one. AbortController makes the contract
  // explicit: at most one in-flight refetch per (clientId, period).
  const inFlight = useRef<AbortController | null>(null);

  function refetchPeriod(
    year: number,
    month: number,
    onSuccess?: () => void
  ) {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setError(false);
    const params = new URLSearchParams({ clientId });
    if (year > 0) params.set("year", String(year));
    if (month > 0) params.set("month", String(month));
    fetch(`/api/mapari-cashflow?${params.toString()}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((payload: MapariCashflowData) => {
        if (ctrl.signal.aborted) return;
        const resolvedYear = payload.period?.year ?? year;
        const resolvedMonth = payload.period?.month ?? month;
        setPeriodCache((prev) => {
          const next = new Map(prev);
          next.set(periodKey(resolvedYear, resolvedMonth), payload);
          return next;
        });
        if (resolvedYear !== current.year || resolvedMonth !== current.month) {
          setCurrent({ year: resolvedYear, month: resolvedMonth });
        }
        onSuccess?.();
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(true);
      });
  }

  // Initial-mount fetch when the server didn't preload Mapari (user
  // arrived via in-page tab switch from Jurnal / Balanta / …). Fires
  // exactly once per mount; the period cache is empty so refetchPeriod's
  // success handler populates it and stops the spinner.
  const didMountFetch = useRef(false);
  useEffect(() => {
    if (initialData) return;
    if (didMountFetch.current) return;
    didMountFetch.current = true;
    refetchPeriod(current.year, current.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External bumps (journal upload, vertical alloc edit, anything that
  // called router.refresh) push a higher dataVersion AND a fresh
  // initialData prop. When initialData covers the active period, just
  // adopt it — no extra network call. Otherwise fall back to a
  // period-targeted refetch.
  const seenVersion = useRef(dataVersion);
  useEffect(() => {
    if (seenVersion.current === dataVersion) return;
    seenVersion.current = dataVersion;
    const initYear = initialData?.period?.year ?? 0;
    const initMonth = initialData?.period?.month ?? 0;
    if (initialData && initYear === current.year && initMonth === current.month) {
      setPeriodCache((prev) => {
        const next = new Map(prev);
        next.set(periodKey(current.year, current.month), initialData);
        return next;
      });
      return;
    }
    refetchPeriod(current.year, current.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  // Called by child save flows after the server action succeeds. Refetches
  // the period the user is currently looking at, with previous in-flight
  // requests cancelled so rapid saves don't stack up.
  function refreshAfterMutation() {
    refetchPeriod(current.year, current.month);
  }

  const data =
    periodCache.get(periodKey(current.year, current.month)) ??
    initialData ??
    null;

  function syncUrl(year: number, month: number) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("cashflow-year", String(year));
    url.searchParams.set("cashflow-month", String(month));
    window.history.replaceState({}, "", url.toString());
  }

  function selectPeriod(year: number, month: number) {
    if (year === current.year && month === current.month) return;

    // Mirror to URL so refresh + deep-link both work. No router.replace —
    // we don't want to re-run the server component (that's the slow path
    // we are deliberately avoiding for the period switch).
    syncUrl(year, month);
    setCurrent({ year, month });

    // Cache hit — render is already correct (data derives from cache).
    if (periodCache.has(periodKey(year, month))) return;
    refetchPeriod(year, month);
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Nu am putut incarca maparile.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Se incarca maparile...
      </div>
    );
  }

  return (
    <MapariCashflowContent
      data={data}
      onPeriodChange={selectPeriod}
      onMutated={refreshAfterMutation}
    />
  );
}

function MapariCashflowContent({
  data,
  onPeriodChange,
  onMutated,
}: {
  data: MapariCashflowData;
  onPeriodChange: (year: number, month: number) => void;
  /** Called by child mutation flows after a successful server-side save.
   *  Triggers a refetch of the current year's payload in the parent so
   *  outer-page badges, coverage, and lists stay in sync — without a
   *  Next router.refresh() (which would re-stream the entire page tree,
   *  ~2-4s on big clients). */
  onMutated: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false);
  const [allExceptionsOpen, setAllExceptionsOpen] = useState(false);
  // Active vertical filter on the "Linii de business" tab. Set when the
  // contabil clicks a vertical column (the column expands AND the conts
  // list below filters to that vertical's allocations). null = no filter.
  const [verticalFilter, setVerticalFilter] = useState<string | null>(null);
  // Sub-filter: when true, the conts list is narrowed further to only the
  // SOURCE conts that contribute residue absorbed by the default vertical
  // (i.e. conts with partner overrides whose target category has no own
  // horizontal). Triggered by clicking the default-vertical residue badge.
  // Implies verticalFilter === default vertical id (we set both together).
  const [residueFilterActive, setResidueFilterActive] = useState(false);
  // Initial filter to push into CategoryWorkspace when the user jumps in
  // via the PageHeader "X nemapate" KPI. Stored as state so we can reset
  // and re-trigger (CategoryWorkspace re-applies whenever this changes).
  // Typed narrower than the local Filter — CategoryWorkspace only knows
  // about category-level filters (no "unallocated" / "split").
  type CategoryInitialFilter = "all" | "unmapped" | "expense" | "revenue";
  const [categoryInitialFilter, setCategoryInitialFilter] = useState<
    CategoryInitialFilter | undefined
  >(undefined);
  // Drill-in target for the partner slide-panel — set when a satellite
  // dialog (AllExceptions / ReviewQueue) wants to navigate the user into
  // the slide-panel for a specific cont. Reset to undefined after the
  // workspace consumes it (one-shot trigger).
  const [pendingPanelContBase, setPendingPanelContBase] = useState<
    string | undefined
  >(undefined);

  /** Shared drill-in helper used by AllExceptionsDialog + ReviewQueueDialog
   *  to navigate the user into the partner slide-panel for a specific cont.
   *  Closes the active dialog, ensures we're on categorii tab (the only
   *  one that hosts the slide-panel), and asks CategoryWorkspace to open
   *  the panel for the matching account. */
  function openContPanelFromDialog(contBase: string) {
    setReviewQueueOpen(false);
    setAllExceptionsOpen(false);
    setActiveTab("categorii");
    setPendingPanelContBase(contBase);
  }
  const onMutate = onMutated;

  // Active wizard tab persisted in URL (?cashflow-tab=categorii|verticale)
  // so the contabil can deep-link straight to "Linii de business" and refresh
  // without losing context. Default = categorii (the obligatory axis A).
  const urlTab = searchParams.get("cashflow-tab");
  const activeTab: CashflowTab = urlTab === "verticale" ? "verticale" : "categorii";

  function setActiveTab(next: CashflowTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "categorii") params.delete("cashflow-tab");
    else params.set("cashflow-tab", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // Source conts that contribute to the default-vertical residue absorption:
  // for every category that RECEIVES partner-override inflow but has NO own
  // horizontal allocation (CategoryVerticalAllocation), every cont that
  // funneled money into it counts. Pre-computed once per render; only used
  // when the contabil clicks the residue badge to drill in.
  //
  // Output: a map keyed by cont with both the total residue amount and the
  // per-target breakdown (one entry per absorbed category). Empty when no
  // residue exists, so the consumer can detect "filter to nothing" upfront.
  const defaultVerticalResidueSourceDetails = useMemo(() => {
    const allocatedSet = new Set(
      data.categoryAllocations.map((a) => a.categoryId)
    );
    const categoryNamesById = new Map<string, string>();
    const walk = (n: CostCategoryNode) => {
      categoryNamesById.set(n.id, n.name);
      for (const child of n.children) walk(child);
    };
    for (const n of data.tree) walk(n);

    const out = new Map<
      string,
      {
        totalAmount: number;
        targets: { categoryId: string; categoryName: string; amount: number }[];
      }
    >();
    for (const [categoryId, inflow] of Object.entries(data.categoryInflows)) {
      if (allocatedSet.has(categoryId)) continue;
      const categoryName = categoryNamesById.get(categoryId) ?? "Necunoscut";
      for (const src of inflow.sources) {
        const entry = out.get(src.cont) ?? { totalAmount: 0, targets: [] };
        entry.totalAmount += src.amount;
        entry.targets.push({ categoryId, categoryName, amount: src.amount });
        out.set(src.cont, entry);
      }
    }
    for (const entry of out.values()) {
      entry.targets.sort((a, b) => b.amount - a.amount);
    }
    return out;
  }, [data.categoryAllocations, data.categoryInflows, data.tree]);

  const defaultVerticalResidueSourceConts = useMemo(
    () => new Set(defaultVerticalResidueSourceDetails.keys()),
    [defaultVerticalResidueSourceDetails]
  );

  const filteredAccounts = filterAccounts(
    data.accounts,
    filter,
    query,
    verticalFilter,
    data.verticals,
    residueFilterActive ? defaultVerticalResidueSourceConts : null
  );
  const unmappedCount = data.accounts.filter((a) => a.currentMapping === null).length;
  const unallocatedCount = data.accounts.filter(
    (a) => a.currentAllocation === null || a.currentAllocation.splits.length === 0
  ).length;
  const splitCount = data.accounts.filter(
    (a) =>
      a.currentAllocation !== null &&
      a.currentAllocation.splits.length > 1
  ).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        period={data.period}
        availableYears={data.availableYears}
        availablePeriods={data.availablePeriods}
        coverage={data.coverage}
        freshlySeeded={data.freshlySeeded}
        onPeriodChange={onPeriodChange}
        onJumpToUnmapped={() => {
          setCategoryInitialFilter("unmapped");
        }}
      />

      <CategoryAxisContent
        data={data}
        initialFilter={categoryInitialFilter}
        initialPanelContBase={pendingPanelContBase}
        onInitialPanelOpened={() => setPendingPanelContBase(undefined)}
        onMutate={onMutate}
      />
    </div>
  );
}

function CashflowTabBar({
  active,
  onChange,
  verticalsEnabled,
  unmappedCount,
}: {
  active: CashflowTab;
  onChange: (t: CashflowTab) => void;
  verticalsEnabled: boolean;
  unmappedCount: number;
}) {
  const tabs: {
    id: CashflowTab;
    label: string;
    hint: string;
    icon: typeof Layers;
    badge?: { text: string; tone: "danger" | "neutral" };
  }[] = [
    {
      id: "categorii",
      label: "Categorii",
      hint: "Cum se grupeaza cheltuielile si veniturile pentru patron",
      icon: Layers,
      badge:
        unmappedCount > 0
          ? { text: `${unmappedCount} nemapate`, tone: "danger" }
          : undefined,
    },
    {
      id: "verticale",
      label: "Linii de business",
      hint: verticalsEnabled
        ? "Cum se imparte firma pe linii de business"
        : "Optional · activeaza daca firma are mai multe linii",
      icon: Network,
    },
  ];

  return (
    <div>
      <div
        className="font-mono text-[10px] uppercase tracking-wider text-gray mb-2"
        style={{ letterSpacing: "-0.02em" }}
      >
        Axa de lucru
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="tablist">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`group relative text-left rounded-xl border p-4 transition-all ${
                isActive
                  ? "border-primary bg-primary/[0.08] shadow-[0_0_0_3px_rgba(13,107,94,0.12)]"
                  : "border-dark-3 bg-dark-2 hover:border-dark-4 hover:bg-dark-3/40"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <tab.icon
                    size={16}
                    strokeWidth={1.75}
                    className={`shrink-0 self-center ${
                      isActive ? "text-white" : "text-gray-light"
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`text-[16px] font-semibold ${
                      isActive ? "text-white" : "text-gray-light"
                    }`}
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {tab.label}
                  </span>
                  {tab.badge && (
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        tab.badge.tone === "danger"
                          ? "bg-neg-bg text-neg"
                          : "bg-dark-3 text-gray-light"
                      }`}
                    >
                      {tab.badge.text}
                    </span>
                  )}
                </div>
                {isActive && (
                  <span
                    aria-hidden
                    className="font-mono text-[10px] uppercase tracking-wider text-primary-light shrink-0"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Activ
                  </span>
                )}
              </div>
              <div
                className={`text-[12px] mt-1.5 ${
                  isActive ? "text-gray-light" : "text-gray"
                }`}
                style={{ letterSpacing: "-0.02em" }}
              >
                {tab.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryAxisContent({
  data,
  initialFilter,
  initialPanelContBase,
  onInitialPanelOpened,
  onMutate,
}: {
  data: MapariCashflowData;
  initialFilter?: "all" | "unmapped" | "expense" | "revenue";
  initialPanelContBase?: string;
  onInitialPanelOpened?: () => void;
  onMutate: () => void;
}) {
  return (
    <div className="space-y-5">
      <CategoryWorkspace
        tree={data.tree}
        accounts={data.accounts}
        clientId={data.clientId}
        period={data.period}
        onMutate={onMutate}
        verticalsEnabled={data.verticalsEnabled}
        verticals={data.verticals}
        categoryAllocations={data.categoryAllocations}
        firmDefaultSplits={data.firmDefaultSplits}
        categoryInflows={data.categoryInflows}
        initialFilter={initialFilter}
        initialPanelContBase={initialPanelContBase}
        onInitialPanelOpened={onInitialPanelOpened}
      />
    </div>
  );
}

/**
 * Unified top-of-page band: defines the firm's lines of business (the 3
 * verticals) once, plus the firm-wide default split everything inherits.
 * This is the entire "Linii de business" concept, collapsed into a header —
 * all the per-category / per-cont / per-partener work happens below in the
 * category workspace.
 */
function LinesOfBusinessBand({
  clientId,
  enabled,
  verticals,
  firmDefaultSplits,
  onMutate,
}: {
  clientId: string;
  enabled: boolean;
  verticals: VerticalView[];
  firmDefaultSplits: AllocationSplit[] | null;
  onMutate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [activating, setActivating] = useState(false);
  const [editingFirm, setEditingFirm] = useState(false);
  const realVerticals = verticals.filter((v) => !v.isDefault);

  if (!enabled || realVerticals.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="text-[16px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Linii de business
            </h3>
            <p
              className="mt-1 text-[12px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Imparte firma pe activitati (ex: Outsourcing, Recrutare,
              Coworking) ca sa vezi cat aduce si cat costa fiecare. Optional.
            </p>
          </div>
          <Button onClick={() => setActivating(true)}>
            <Plus size={14} className="mr-1" />
            Activeaza liniile de business
          </Button>
        </div>
        {activating && (
          <ActivateVerticalsModal
            clientId={clientId}
            onClose={() => setActivating(false)}
            onDone={() => {
              setActivating(false);
              onMutate();
            }}
          />
        )}
      </div>
    );
  }

  const hasFirmSplit = firmDefaultSplits !== null && firmDefaultSplits.length > 0;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Linii de business
          </h3>
          <Tooltip content="Activitatile firmei. Fiecare categorie, cont sau partener se imparte intre ele. Defineste-le o data aici.">
            <span className="font-mono text-[10px] text-gray cursor-help">?</span>
          </Tooltip>
        </div>
        <span className="font-mono text-[11px] text-gray tabular-nums">
          {realVerticals.length} linii
        </span>
      </div>

      {/* The lines themselves */}
      <div className="flex flex-wrap items-center gap-2">
        {realVerticals.map((v, i) => (
          <VerticalPill
            key={v.id}
            vertical={v}
            colorClass={PILL_COLORS[i % PILL_COLORS.length]}
            clientId={clientId}
            onMutate={onMutate}
          />
        ))}
        {adding ? (
          <AddVerticalInline
            clientId={clientId}
            onDone={() => {
              setAdding(false);
              onMutate();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-dark-3 px-3 py-1 text-[12px] text-gray hover:text-white hover:border-gray transition-colors"
            style={{ letterSpacing: "-0.02em" }}
          >
            <Plus size={12} /> Adauga linie
          </button>
        )}
      </div>

      {/* Firm-wide default split */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-dark-3">
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono text-[10px] uppercase tracking-wider text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Impartirea firmei (implicita)
          </span>
          <Tooltip content="Impartirea implicita pe linii de business. Tot ce nu are o regula proprie (categorie, cont sau partener) o mosteneste automat.">
            <span className="font-mono text-[9px] text-gray cursor-help">?</span>
          </Tooltip>
        </div>
        <div className="flex-1 min-w-[180px]">
          {hasFirmSplit ? (
            <BandSplitChips splits={firmDefaultSplits} verticals={verticals} />
          ) : (
            <span
              className="text-[11px] text-gray italic"
              style={{ letterSpacing: "-0.02em" }}
            >
              Neimpartita — totul merge pe &quot;Toata firma&quot; pana setezi o
              impartire.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditingFirm(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-dark-3 px-3 py-1.5 text-[12px] font-medium text-gray-light hover:text-white hover:border-gray transition-colors"
          style={{ letterSpacing: "-0.02em" }}
        >
          {hasFirmSplit ? (
            <>
              <Pencil size={12} /> Editeaza
            </>
          ) : (
            <>
              <Plus size={12} /> Imparte firma pe linii
            </>
          )}
        </button>
      </div>

      {editingFirm && (
        <EditFirmDefaultAllocationDialog
          open
          currentSplits={firmDefaultSplits ?? []}
          verticals={verticals}
          clientId={clientId}
          onClose={() => setEditingFirm(false)}
          onSaved={() => {
            setEditingFirm(false);
            onMutate();
          }}
        />
      )}
    </div>
  );
}

const PILL_COLORS = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-amber-400/15 text-amber-300 border-amber-400/30",
  "bg-sky-400/15 text-sky-300 border-sky-400/30",
  "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  "bg-rose-400/15 text-rose-300 border-rose-400/30",
] as const;

function VerticalPill({
  vertical,
  colorClass,
  clientId,
  onMutate,
}: {
  vertical: VerticalView;
  colorClass: string;
  clientId: string;
  onMutate: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !confirm(
        `Sterg linia "${vertical.name}"? Conturile alocate aici trec automat la "Toata firma".`
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteVerticalAction({ clientId, verticalId: vertical.id });
      if (r.error) alert(r.error);
      else onMutate();
    });
  }

  if (renaming) {
    return (
      <RenameVerticalInline
        vertical={vertical}
        clientId={clientId}
        onDone={() => {
          setRenaming(false);
          onMutate();
        }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <span
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1 ${colorClass}`}
    >
      <span
        className="text-[12px] font-medium"
        style={{ letterSpacing: "-0.02em" }}
      >
        {vertical.name}
      </span>
      <span className="font-mono text-[10px] opacity-70 tabular-nums">
        {vertical.allocationCount}
      </span>
      <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 transition-opacity">
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="p-0.5 hover:text-white"
          aria-label="Redenumeste"
        >
          <Pencil size={10} />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="p-0.5 hover:text-neg"
          aria-label="Sterge"
        >
          <Trash2 size={10} />
        </button>
      </span>
    </span>
  );
}

function BandSplitChips({
  splits,
  verticals,
}: {
  splits: AllocationSplit[];
  verticals: VerticalView[];
}) {
  const realVerticals = verticals.filter((v) => !v.isDefault);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {splits.map((s) => {
        const idx = realVerticals.findIndex((x) => x.id === s.verticalId);
        const v = realVerticals[idx] ?? verticals.find((x) => x.id === s.verticalId);
        return (
          <span
            key={s.verticalId}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm shrink-0 ${
                PILL_DOT[(idx >= 0 ? idx : 0) % PILL_DOT.length]
              }`}
              aria-hidden
            />
            <span className="text-white">{s.percent}%</span>
            <span className="truncate max-w-[140px]">{v?.name ?? "?"}</span>
          </span>
        );
      })}
    </span>
  );
}

const PILL_DOT = [
  "bg-primary",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
] as const;

type VerticalTotals = {
  id: string;
  name: string;
  isDefault: boolean;
  expenses: number;
  revenues: number;
};

/** Distribute each cont's rulaj across its RESOLVED lines of business (the
 *  full cascade), so the bar shows where the money actually lands today. */
function computeVerticalTotals(
  accounts: AccountListItem[],
  verticals: VerticalView[]
): VerticalTotals[] {
  const totals = new Map<string, { expenses: number; revenues: number }>();
  for (const v of verticals) totals.set(v.id, { expenses: 0, revenues: 0 });
  const defaultId = verticals.find((v) => v.isDefault)?.id ?? null;

  for (const a of accounts) {
    const rulaj = a.kind === "expense" ? a.rulajD : a.rulajC;
    if (!rulaj) continue;
    const splits =
      a.effectiveAllocation.splits.length > 0
        ? a.effectiveAllocation.splits
        : defaultId
        ? [{ verticalId: defaultId, percent: 100 }]
        : [];
    for (const s of splits) {
      const bucket = totals.get(s.verticalId);
      if (!bucket) continue;
      const part = (rulaj * s.percent) / 100;
      if (a.kind === "expense") bucket.expenses += part;
      else bucket.revenues += part;
    }
  }

  return verticals.map((v) => ({
    id: v.id,
    name: v.name,
    isDefault: v.isDefault,
    expenses: totals.get(v.id)?.expenses ?? 0,
    revenues: totals.get(v.id)?.revenues ?? 0,
  }));
}

/**
 * The headline visual: how the firm's real money divides across lines of
 * business right now. Two stacked bars (cheltuieli, venituri) + a legend with
 * lei + share per line. Computed live from the resolved cascade — this is the
 * "split" the contabil wants to see at a glance.
 */
function VerticalSplitVisual({
  accounts,
  verticals,
}: {
  accounts: AccountListItem[];
  verticals: VerticalView[];
}) {
  const totals = useMemo(
    () => computeVerticalTotals(accounts, verticals),
    [accounts, verticals]
  );
  const realVerticals = verticals.filter((v) => !v.isDefault);
  const colorFor = (id: string) => {
    const idx = realVerticals.findIndex((v) => v.id === id);
    return idx >= 0 ? PILL_DOT[idx % PILL_DOT.length] : DEFAULT_ACCENT;
  };

  const totalExpenses = totals.reduce((s, t) => s + t.expenses, 0);
  const totalRevenues = totals.reduce((s, t) => s + t.revenues, 0);

  // Only lines that carry money, biggest first.
  const expenseRows = totals
    .filter((t) => t.expenses > 0)
    .sort((a, b) => b.expenses - a.expenses);
  const revenueRows = totals
    .filter((t) => t.revenues > 0)
    .sort((a, b) => b.revenues - a.revenues);

  if (totalExpenses === 0 && totalRevenues === 0) return null;

  return (
    <div className="space-y-3 pt-1">
      <SplitStack
        label="Cheltuieli pe linii"
        rows={expenseRows.map((t) => ({
          id: t.id,
          name: t.name,
          amount: t.expenses,
          color: colorFor(t.id),
        }))}
        total={totalExpenses}
      />
      {totalRevenues > 0 && (
        <SplitStack
          label="Venituri pe linii"
          rows={revenueRows.map((t) => ({
            id: t.id,
            name: t.name,
            amount: t.revenues,
            color: colorFor(t.id),
          }))}
          total={totalRevenues}
        />
      )}
    </div>
  );
}

function SplitStack({
  label,
  rows,
  total,
}: {
  label: string;
  rows: { id: string; name: string; amount: number; color: string }[];
  total: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          {label}
        </span>
        <span className="font-mono text-[11px] text-gray-light tabular-nums">
          {formatLei(total)} lei
        </span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-dark-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`h-full ${r.color}`}
            style={{ width: `${(r.amount / total) * 100}%` }}
            title={`${r.name}: ${formatLei(r.amount)} lei`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((r) => (
          <li
            key={r.id}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm shrink-0 ${r.color}`}
              aria-hidden
            />
            <span className="truncate max-w-[140px]">{r.name}</span>
            <span className="text-white">{formatLei(r.amount)}</span>
            <span className="text-gray">
              · {Math.round((r.amount / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatLei(n: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
}

function VerticalAxisContent({
  data,
  filteredAccounts,
  unmappedCount,
  unallocatedCount,
  splitCount,
  filter,
  setFilter,
  query,
  setQuery,
  verticalFilter,
  setVerticalFilter,
  residueFilterActive,
  setResidueFilterActive,
  residueSourceContCount,
  residueSourceConts,
  residueSourceDetails,
  onMutate,
}: {
  data: MapariCashflowData;
  filteredAccounts: AccountListItem[];
  unmappedCount: number;
  unallocatedCount: number;
  splitCount: number;
  filter: Filter;
  setFilter: (v: Filter) => void;
  query: string;
  setQuery: (v: string) => void;
  verticalFilter: string | null;
  setVerticalFilter: (id: string | null) => void;
  residueFilterActive: boolean;
  setResidueFilterActive: (v: boolean) => void;
  residueSourceContCount: number;
  residueSourceConts: Set<string>;
  residueSourceDetails: Map<string, ResidueSourceDetail>;
  onMutate: () => void;
}) {
  return (
    <div className="space-y-6">
      <VerticalsPanel
        clientId={data.clientId}
        enabled={data.verticalsEnabled}
        verticals={data.verticals}
        accounts={data.accounts}
        defaultVerticalResidueAbsorbed={data.defaultVerticalResidueAbsorbed}
        partnerSummariesByCont={data.partnerSummariesByCont}
        residueSourceDetails={residueSourceDetails}
        verticalFilter={verticalFilter}
        setVerticalFilter={setVerticalFilter}
        residueFilterActive={residueFilterActive}
        setResidueFilterActive={setResidueFilterActive}
        residueSourceConts={residueSourceConts}
        onMutate={onMutate}
      />

      {data.verticalsEnabled && (
        <AccountListPanel
          accounts={filteredAccounts}
          totalAccounts={data.accounts.length}
          unmappedCount={unmappedCount}
          unallocatedCount={unallocatedCount}
          splitCount={splitCount}
          defaultVerticalName={
            data.verticals.find((v) => v.isDefault)?.name ?? "Toata firma"
          }
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          tree={data.tree}
          clientId={data.clientId}
          verticalsEnabled={data.verticalsEnabled}
          verticals={data.verticals}
          mode="vertical"
          verticalFilter={verticalFilter}
          onClearVerticalFilter={() => {
            setVerticalFilter(null);
            setResidueFilterActive(false);
          }}
          residueFilterActive={residueFilterActive}
          residueSourceContCount={residueSourceContCount}
          onClearResidueFilter={() => setResidueFilterActive(false)}
          onMutate={onMutate}
        />
      )}
    </div>
  );
}

/**
 * Generic collapsible section used inside a wizard tab — replaces the old
 * "StepSection" wrapper. No step numbering since the tabs themselves are the
 * navigation; just a clean expandable card with title, helper, and summary
 * line shown while collapsed.
 */
function CollapsibleSection({
  title,
  helper,
  summary,
  defaultCollapsed,
  children,
}: {
  title: string;
  helper: React.ReactNode;
  summary?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  return (
    <section className="rounded-xl border border-dark-3 bg-dark-2/40 p-5">
      <div className="flex items-baseline gap-3">
        <h3
          className="text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-[12px] text-primary hover:text-primary-light inline-flex items-center gap-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          {expanded ? "Ascunde" : "Personalizeaza"}
          <span aria-hidden>{expanded ? "▴" : "▾"}</span>
        </button>
      </div>
      <p
        className="mt-1 text-[12px] text-gray max-w-3xl"
        style={{ letterSpacing: "-0.02em" }}
      >
        {helper}
      </p>
      {!expanded && summary && (
        <p
          className="mt-2 text-[12px] text-gray-light italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          {summary}
        </p>
      )}
      {expanded && <div className="mt-4">{children}</div>}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                          VERTICALS PANEL                                   */
/* -------------------------------------------------------------------------- */

function VerticalsPanel({
  clientId,
  enabled,
  verticals,
  accounts,
  defaultVerticalResidueAbsorbed,
  partnerSummariesByCont,
  residueSourceDetails,
  verticalFilter,
  setVerticalFilter,
  residueFilterActive,
  setResidueFilterActive,
  residueSourceConts,
  onMutate,
}: {
  clientId: string;
  enabled: boolean;
  verticals: VerticalView[];
  accounts: AccountListItem[];
  defaultVerticalResidueAbsorbed: number;
  partnerSummariesByCont: MapariCashflowData["partnerSummariesByCont"];
  residueSourceDetails: Map<string, ResidueSourceDetail>;
  verticalFilter: string | null;
  setVerticalFilter: (id: string | null) => void;
  residueFilterActive: boolean;
  setResidueFilterActive: (v: boolean) => void;
  residueSourceConts: Set<string>;
  onMutate: () => void;
}) {
  if (!enabled) {
    return <VerticalsOff clientId={clientId} onMutate={onMutate} />;
  }
  return (
    <VerticalsOn
      clientId={clientId}
      verticals={verticals}
      accounts={accounts}
      defaultVerticalResidueAbsorbed={defaultVerticalResidueAbsorbed}
      partnerSummariesByCont={partnerSummariesByCont}
      residueSourceDetails={residueSourceDetails}
      verticalFilter={verticalFilter}
      setVerticalFilter={setVerticalFilter}
      residueFilterActive={residueFilterActive}
      setResidueFilterActive={setResidueFilterActive}
      residueSourceConts={residueSourceConts}
      onMutate={onMutate}
    />
  );
}

function VerticalsOff({
  clientId,
  onMutate,
}: {
  clientId: string;
  onMutate: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex items-start gap-3">
          <Layers size={16} className="text-gray mt-1 shrink-0" />
          <div className="flex-1">
            <p
              className="text-[13px] text-gray-light max-w-2xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Daca firma are mai multe linii distincte (Outsourcing, Recruitment,
              Coworking, sau proiecte separate), poti vedea cat aduce si
              cheltuieste fiecare. Datele existente raman neatinse — activezi si
              dezactivezi oricand.
            </p>
            <div className="mt-3">
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Activeaza verticale
              </Button>
            </div>
          </div>
        </div>
      </div>
      {modalOpen && (
        <ActivateVerticalsModal
          clientId={clientId}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            onMutate();
          }}
        />
      )}
    </>
  );
}

function VerticalsOn({
  clientId,
  verticals,
  accounts,
  defaultVerticalResidueAbsorbed,
  partnerSummariesByCont,
  residueSourceDetails,
  verticalFilter,
  setVerticalFilter,
  residueFilterActive,
  setResidueFilterActive,
  residueSourceConts,
  onMutate,
}: {
  clientId: string;
  verticals: VerticalView[];
  accounts: AccountListItem[];
  defaultVerticalResidueAbsorbed: number;
  partnerSummariesByCont: MapariCashflowData["partnerSummariesByCont"];
  residueSourceDetails: Map<string, ResidueSourceDetail>;
  verticalFilter: string | null;
  setVerticalFilter: (id: string | null) => void;
  residueFilterActive: boolean;
  setResidueFilterActive: (v: boolean) => void;
  /** Conts that contribute to default-vertical residue. When residueFilter
   *  is active, the default vertical's inner conts list is narrowed to
   *  this set so the visual inside-the-column matches the outer list. */
  residueSourceConts: Set<string>;
  onMutate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function deactivate() {
    if (
      !confirm(
        "Dezactivez verticalele? Datele se pastreaza si pot fi reactivate oricand."
      )
    )
      return;
    startTransition(async () => {
      await disableVerticalsAction({ clientId });
      onMutate();
    });
  }

  const realCount = verticals.filter((v) => !v.isDefault).length;
  // Default to "Toata firma" expanded so the contabil immediately sees which
  // conturi are inheriting the fallback — the bucket most likely to need work.
  const defaultVerticalId = verticals.find((v) => v.isDefault)?.id ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(defaultVerticalId);
  const [editingCont, setEditingCont] = useState<string | null>(null);
  const editingAccount = editingCont
    ? accounts.find((a) => a.cont === editingCont) ?? null
    : null;
  // Pre-compute which conturi land in which vertical so an expanded column
  // can reveal its own contents. Accounts with no explicit allocation fall
  // into the default vertical (Toata firma). This map is also the source of
  // truth for the per-vertical count shown in headers — backend's stored
  // allocationCount only counts explicit allocation rows and misses every
  // account that inherits the default, which would underreport drastically.
  const accountsByVertical = buildAccountsByVertical(verticals, accounts);
  const totalAccounts = Array.from(accountsByVertical.values()).reduce(
    (s, list) => s + list.length,
    0
  );

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <div className="flex items-baseline gap-3">
          <h3
            className="text-[15px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {realCount}{" "}
            {realCount === 1 ? "linie de business" : "linii de business"}
          </h3>
          {verticalFilter ? (
            <button
              type="button"
              onClick={() => {
                // Clear the filter but LEAVE the column expanded — once the
                // contabil has drilled in, collapsing it on filter-clear
                // would erase context they wanted to keep. They can still
                // collapse manually by clicking another column.
                setVerticalFilter(null);
                setResidueFilterActive(false);
              }}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:text-primary-light underline underline-offset-2 cursor-pointer"
              style={{ letterSpacing: "-0.02em" }}
              title="Sterge filtrul pe verticala"
            >
              <X size={11} />
              Anuleaza filtrul
            </button>
          ) : (
            <span
              className="font-mono text-[11px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              {totalAccounts}{" "}
              {totalAccounts === 1 ? "cont alocat" : "conturi alocate"}
            </span>
          )}
        </div>
        <Tooltip content="Ascunde verticalele peste tot. Datele se pastreaza si pot fi reactivate oricand.">
          <button
            type="button"
            onClick={deactivate}
            disabled={pending}
            className="text-[11px] text-gray hover:text-neg underline underline-offset-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Dezactiveaza
          </button>
        </Tooltip>
      </div>

      {/* Horizontal accordion. Each vertical is a tall column with its name
          rotated 90deg. Clicking opens that column, sliding the others into
          narrow collapsed columns. The expanded column reveals the list of
          accounts allocated to that vertical — no extra page, no modal. */}
      <div
        className="flex gap-2 h-[420px]"
        role="tablist"
        aria-label="Verticale firmei"
      >
        {verticals.map((v, i) => (
          <VerticalColumn
            key={v.id}
            vertical={v}
            colorIndex={i}
            accounts={(() => {
              const list = accountsByVertical.get(v.id) ?? [];
              // When the contabil drilled in via the residue badge, the
              // inside-the-column list mirrors the outer AccountListPanel:
              // narrowed to the source conts that contribute to residue.
              // Same filter, two views — consistent at all times.
              if (v.isDefault && residueFilterActive) {
                return list.filter((a) => residueSourceConts.has(a.cont));
              }
              return list;
            })()}
            residueAbsorbed={
              v.isDefault ? defaultVerticalResidueAbsorbed : 0
            }
            expanded={expandedId === v.id}
            anyExpanded={expandedId !== null}
            filtered={verticalFilter === v.id}
            residueFilterActive={v.isDefault && residueFilterActive}
            onToggle={() => {
              setExpandedId((curr) => {
                const next = curr === v.id ? null : v.id;
                // Sync the list filter below: opening a column filters the
                // conts list to that vertical, closing clears the filter.
                // Toggling AWAY from the default vertical also clears the
                // residue-source sub-filter so we don't leave a stale view.
                setVerticalFilter(next);
                if (!v.isDefault || next !== v.id) {
                  setResidueFilterActive(false);
                }
                return next;
              });
            }}
            onResidueBadgeClick={() => {
              // Clicking the residue badge implies "I want to see the source
              // conts". Expand the default column (so the visual context is
              // right), set the vertical filter to it, and turn on the
              // residue-source narrowing. Toggle off on re-click.
              setExpandedId(v.id);
              setVerticalFilter(v.id);
              setResidueFilterActive(!residueFilterActive);
            }}
            onAccountClick={(cont) => setEditingCont(cont)}
            partnerSummariesByCont={partnerSummariesByCont}
            residueSourceDetails={residueSourceDetails}
            clientId={clientId}
            onMutate={onMutate}
          />
        ))}
        {adding ? (
          <div className="flex items-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 min-w-[260px]">
            <AddVerticalInline
              clientId={clientId}
              onDone={() => {
                setAdding(false);
                onMutate();
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Tooltip content="Adauga o noua linie de business (exemplu: 'Consultanta strategica' separat de 'Outsourcing tehnic').">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-12 rounded-lg border border-dashed border-dark-3 hover:border-primary/60 hover:text-primary text-gray transition-colors flex flex-col items-center justify-center gap-2 shrink-0"
              style={{ letterSpacing: "-0.02em" }}
              aria-label="Adauga verticala"
            >
              <Plus size={16} />
              <span
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                Adauga
              </span>
            </button>
          </Tooltip>
        )}
      </div>

      {editingAccount && (
        <EditAllocationDialog
          open
          account={editingAccount}
          verticals={verticals}
          clientId={clientId}
          onClose={() => setEditingCont(null)}
          onSaved={() => {
            setEditingCont(null);
            onMutate();
          }}
        />
      )}
    </div>
  );
}

/** Group accounts by the vertical they primarily allocate to. An account with a
 *  split allocation appears in every vertical it touches. Accounts with no
 *  explicit allocation fall into the firm's default vertical (Toata firma). */
function buildAccountsByVertical(
  verticals: VerticalView[],
  accounts: AccountListItem[]
): Map<string, AccountListItem[]> {
  const result = new Map<string, AccountListItem[]>();
  for (const v of verticals) result.set(v.id, []);
  const defaultId = verticals.find((v) => v.isDefault)?.id;

  for (const a of accounts) {
    if (a.currentAllocation && a.currentAllocation.splits.length > 0) {
      for (const split of a.currentAllocation.splits) {
        const bucket = result.get(split.verticalId);
        if (bucket) bucket.push(a);
      }
    } else if (defaultId) {
      result.get(defaultId)!.push(a);
    }
  }
  return result;
}

/** Color accent per vertical — a single 2px top stripe on the column. Same
 *  order as SplitBar so each vertical reads consistent across the app. The
 *  default (Toata firma) gets neutral gray so it visibly differs from real
 *  business lines without screaming for attention. */
const VERTICAL_ACCENTS = [
  "bg-primary",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
] as const;
const DEFAULT_ACCENT = "bg-gray/40";

/** A vertical literally drawn as a vertical column. Closed = narrow column
 *  with name rotated 90deg + count at top. Open = expands horizontally and
 *  reveals the list of accounts allocated to this vertical. The pattern is
 *  intentional: makes the user *feel* the verticality of the concept.
 *  Inspired by horizontal accordion / image-strip galleries. */
function VerticalColumn({
  vertical,
  colorIndex,
  accounts,
  residueAbsorbed,
  expanded,
  anyExpanded,
  filtered,
  residueFilterActive,
  onToggle,
  onResidueBadgeClick,
  onAccountClick,
  partnerSummariesByCont,
  residueSourceDetails,
  clientId,
  onMutate,
}: {
  vertical: VerticalView;
  colorIndex: number;
  accounts: AccountListItem[];
  residueAbsorbed: number;
  expanded: boolean;
  anyExpanded: boolean;
  /** True when the conts list below is currently filtered to this vertical.
   *  Drives a subtle visual cue (stronger border + ring) so the contabil
   *  sees at a glance which column is actively scoping the list view. */
  filtered: boolean;
  /** True ONLY on the default vertical when the contabil has clicked the
   *  residue badge — applies an extra highlight on the badge itself so the
   *  "active drill-in" state reads at a glance. */
  residueFilterActive: boolean;
  onToggle: () => void;
  /** Fired when the contabil clicks the `↙ X lei reziduu` badge inside the
   *  expanded default vertical. Bubbles up to drill-in / drill-out the list
   *  to the source conts contributing to that residue. */
  onResidueBadgeClick: () => void;
  onAccountClick: (cont: string) => void;
  partnerSummariesByCont: MapariCashflowData["partnerSummariesByCont"];
  residueSourceDetails: Map<string, ResidueSourceDetail>;
  clientId: string;
  onMutate: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [pending, startTransition] = useTransition();

  const accent = vertical.isDefault
    ? DEFAULT_ACCENT
    : VERTICAL_ACCENTS[colorIndex % VERTICAL_ACCENTS.length];

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !confirm(
        `Sterg verticala "${vertical.name}"? Conturile alocate aici trec automat la "Toata firma".`
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteVerticalAction({ clientId, verticalId: vertical.id });
      if (r.error) alert(r.error);
      else onMutate();
    });
  }

  return (
    <div
      role="tab"
      aria-selected={expanded}
      data-filtered={filtered ? "true" : undefined}
      onClick={onToggle}
      title={
        filtered
          ? `Lista de mai jos e filtrata la conturile pe ${vertical.name}. Apasa din nou ca sa elimini filtrul.`
          : `Vezi conturile alocate la ${vertical.name}.`
      }
      className={`group relative h-full rounded-lg border bg-dark/40 cursor-pointer overflow-hidden transition-all duration-300 ease-out ${
        expanded
          ? filtered
            ? "flex-1 border-primary/50 ring-1 ring-primary/30"
            : "flex-1 border-dark-3"
          : anyExpanded
          ? "w-14 border-dark-3/60 hover:border-dark-3"
          : "flex-1 border-dark-3/80 hover:border-dark-3"
      }`}
    >
      {/* Top accent stripe — the only color on the whole column */}
      <div className={`absolute top-0 inset-x-0 h-0.5 ${accent}`} aria-hidden />

      {expanded ? (
        <ExpandedColumn
          vertical={vertical}
          accounts={accounts}
          residueAbsorbed={residueAbsorbed}
          residueFilterActive={residueFilterActive}
          onResidueBadgeClick={onResidueBadgeClick}
          partnerSummariesByCont={partnerSummariesByCont}
          residueSourceDetails={residueSourceDetails}
          renaming={renaming}
          onStartRename={() => setRenaming(true)}
          onEndRename={() => {
            setRenaming(false);
            onMutate();
          }}
          onCancelRename={() => setRenaming(false)}
          onRemove={remove}
          onAccountClick={onAccountClick}
          pending={pending}
          clientId={clientId}
        />
      ) : (
        <CollapsedColumn
          vertical={vertical}
          contCount={accounts.length}
          narrow={anyExpanded}
        />
      )}
    </div>
  );
}

function CollapsedColumn({
  vertical,
  contCount,
  narrow,
}: {
  vertical: VerticalView;
  contCount: number;
  narrow: boolean;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-between py-4 px-2">
      <span className="font-mono text-[18px] font-bold text-white tabular-nums leading-none">
        {contCount}
      </span>

      <div
        className="flex-1 flex items-center justify-center min-h-0"
        style={
          narrow
            ? {
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
              }
            : undefined
        }
      >
        <span
          className={`font-semibold text-white text-center ${
            narrow ? "text-[14px]" : "text-[18px]"
          }`}
          style={{ letterSpacing: "-0.04em" }}
          title={vertical.name}
        >
          {vertical.name}
        </span>
      </div>

      <span
        className="font-mono text-[9px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        {contCount === 1 ? "cont" : "conturi"}
      </span>
    </div>
  );
}

function ExpandedColumn({
  vertical,
  accounts,
  residueAbsorbed,
  residueFilterActive,
  onResidueBadgeClick,
  partnerSummariesByCont,
  residueSourceDetails,
  renaming,
  onStartRename,
  onEndRename,
  onCancelRename,
  onRemove,
  onAccountClick,
  pending,
  clientId,
}: {
  vertical: VerticalView;
  accounts: AccountListItem[];
  residueAbsorbed: number;
  residueFilterActive: boolean;
  onResidueBadgeClick: () => void;
  partnerSummariesByCont: MapariCashflowData["partnerSummariesByCont"];
  residueSourceDetails: Map<string, ResidueSourceDetail>;
  renaming: boolean;
  onStartRename: () => void;
  onEndRename: () => void;
  onCancelRename: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onAccountClick: (cont: string) => void;
  pending: boolean;
  clientId: string;
}) {
  return (
    <div
      className="h-full flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-dark-3">
        <div className="min-w-0">
          {renaming ? (
            <RenameVerticalInline
              vertical={vertical}
              clientId={clientId}
              onDone={onEndRename}
              onCancel={onCancelRename}
            />
          ) : (
            <>
              <h4
                className="text-[16px] font-semibold text-white truncate"
                style={{ letterSpacing: "-0.04em" }}
                title={vertical.name}
              >
                {vertical.name}
              </h4>
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span className="font-mono text-[11px] text-gray-light tabular-nums">
                  {accounts.length}{" "}
                  {residueFilterActive
                    ? accounts.length === 1
                      ? "cont sursa reziduu"
                      : "conturi sursa reziduu"
                    : accounts.length === 1
                      ? "cont alocat"
                      : "conturi alocate"}
                </span>
                {vertical.isDefault && (
                  <Tooltip content="Verticala implicita unde merg conturile fara alocare explicita. Nu poti sterge, doar redenumi.">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-gray cursor-help">
                      implicit
                    </span>
                  </Tooltip>
                )}
                {vertical.isDefault && residueAbsorbed > 0 && (
                  <Tooltip
                    content={
                      <>
                        Aceasta linie absoarbe{" "}
                        <strong>{formatRon(residueAbsorbed)} lei</strong> din
                        reziduul exceptiilor de partener, pentru ca acele
                        exceptii pica pe categorii fara orizontala proprie
                        setata.{" "}
                        {residueFilterActive
                          ? "Apasa din nou ca sa elimini filtrul."
                          : "Apasa ca sa vezi conturile sursa care contribuie."}
                      </>
                    }
                  >
                    <button
                      type="button"
                      data-testid="default-vertical-residue-badge"
                      data-active={residueFilterActive ? "true" : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        onResidueBadgeClick();
                      }}
                      className={`font-mono text-[10px] tabular-nums inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 transition-colors ${
                        residueFilterActive
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "text-primary-light hover:bg-primary/10 hover:text-primary border border-transparent"
                      }`}
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      ↙ {formatRon(residueAbsorbed)} lei reziduu
                    </button>
                  </Tooltip>
                )}
              </div>
            </>
          )}
        </div>
        {!renaming && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip content="Redenumeste">
              <button
                type="button"
                onClick={onStartRename}
                className="p-1.5 text-gray hover:text-white rounded"
                disabled={pending}
              >
                <Pencil size={13} />
              </button>
            </Tooltip>
            {!vertical.isDefault && (
              <Tooltip content="Sterge verticala. Conturile alocate aici trec la 'Toata firma'.">
                <button
                  type="button"
                  onClick={onRemove}
                  className="p-1.5 text-gray hover:text-neg rounded"
                  disabled={pending}
                >
                  <Trash2 size={13} />
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      <ExpandedColumnBody
        accounts={accounts}
        vertical={vertical}
        partnerSummariesByCont={partnerSummariesByCont}
        residueSourceDetails={residueSourceDetails}
        residueFilterActive={residueFilterActive}
        onAccountClick={onAccountClick}
      />
    </div>
  );
}

/**
 * The scrollable body of an expanded vertical column. Owns its own search
 * state so the contabil can quickly find a cont inside a long list without
 * leaving the column. Filters by cont number, contBase, or denumire —
 * diacritic-insensitive — same matching rules as the outer search.
 */
function ExpandedColumnBody({
  accounts,
  vertical,
  partnerSummariesByCont,
  residueSourceDetails,
  residueFilterActive,
  onAccountClick,
}: {
  accounts: AccountListItem[];
  vertical: VerticalView;
  partnerSummariesByCont: MapariCashflowData["partnerSummariesByCont"];
  residueSourceDetails: Map<string, ResidueSourceDetail>;
  residueFilterActive: boolean;
  onAccountClick: (cont: string) => void;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const filtered =
    trimmed.length === 0
      ? accounts
      : (() => {
          const needle = stripDiacritics(trimmed.toLowerCase());
          return accounts.filter((a) =>
            stripDiacritics(
              `${a.cont} ${a.contBase} ${a.denumire}`.toLowerCase()
            ).includes(needle)
          );
        })();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {accounts.length > 0 && (
        <div
          className="px-3 py-2 border-b border-dark-3/40"
          onClick={(e) => e.stopPropagation()}
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cauta in aceasta verticala..."
            className="h-8 text-[12px]"
          />
          {trimmed.length > 0 && (
            <p
              className="mt-1 text-[10px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              {filtered.length === 0
                ? "Niciun cont nu se potriveste."
                : `${filtered.length} din ${accounts.length} ${
                    accounts.length === 1 ? "cont" : "conturi"
                  }.`}
            </p>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {accounts.length === 0 ? (
          <p
            className="p-4 text-[12px] text-gray italic text-center"
            style={{ letterSpacing: "-0.02em" }}
          >
            Niciun cont alocat la aceasta verticala inca.
          </p>
        ) : filtered.length === 0 ? (
          <p
            className="p-4 text-[12px] text-gray italic text-center"
            style={{ letterSpacing: "-0.02em" }}
          >
            Niciun rezultat pentru &quot;{trimmed}&quot;.
          </p>
        ) : (
          <ul>
            {filtered.map((a) => (
              <VerticalContRow
                key={a.cont}
                account={a}
                vertical={vertical}
                partnerSummary={partnerSummariesByCont[a.contBase] ?? null}
                residueDetail={
                  vertical.isDefault
                    ? residueSourceDetails.get(a.cont) ?? null
                    : null
                }
                residueFilterActive={residueFilterActive}
                onAccountClick={onAccountClick}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * One cont row inside an expanded vertical column. Click on the row body
 * toggles an inline partner-breakdown drawer; the right-edge "Editeaza"
 * button still opens the slide-panel for full edit. Progressive disclosure:
 * compact by default, rich on demand, full editing in the panel.
 *
 * The drawer shows: distribution sentence, the 3-segment bar, breakdown
 * counts/amounts, plus — when the row is a residue source under the default
 * vertical — the absorbed-by category breakdown so the contabil reads
 * "this cont contributes X lei via these targets" in one glance.
 */
function VerticalContRow({
  account,
  vertical,
  partnerSummary,
  residueDetail,
  residueFilterActive,
  onAccountClick,
}: {
  account: AccountListItem;
  vertical: VerticalView;
  partnerSummary: PartnerSummary | null;
  residueDetail: ResidueSourceDetail | null;
  residueFilterActive: boolean;
  onAccountClick: (cont: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;
  const split = account.currentAllocation?.splits.find(
    (s) => s.verticalId === vertical.id
  );
  const percent = split?.percent ?? 100;
  // In residue mode on the default vertical, the displayed amount is the
  // cont's contribution to residue (not its full rulaj × percent). Same
  // truth shown both on outer banner and inside the column.
  const showResidueAmount =
    residueFilterActive && vertical.isDefault && residueDetail !== null;
  const displayAmount = showResidueAmount
    ? residueDetail!.totalAmount
    : rulaj * (percent / 100);
  const residuePct =
    showResidueAmount && rulaj !== 0
      ? Math.round((residueDetail!.totalAmount / Math.abs(rulaj)) * 100)
      : null;

  return (
    <li
      className="border-b border-dark-3/40 last:border-b-0"
      data-testid={`vertical-cont-row-${account.cont}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-dark-3/40 transition-colors"
        aria-expanded={open}
        aria-controls={`vertical-cont-detail-${account.cont}`}
      >
        <span
          className={`shrink-0 transition-colors ${
            open ? "text-primary" : "text-gray group-hover:text-gray-light"
          }`}
          aria-hidden
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="font-mono text-[11px] text-gray tabular-nums shrink-0 min-w-[50px]">
          {account.cont}
        </span>
        <span
          className="flex-1 min-w-0 text-[12px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={account.denumire}
        >
          {account.denumire}
        </span>
        {showResidueAmount ? (
          <span
            className="font-mono text-[10px] tabular-nums shrink-0 w-12 text-right text-primary"
            title="Cota din rulajul contului care contribuie la reziduul Toata firma"
          >
            {residuePct}%
          </span>
        ) : (
          <span className="font-mono text-[10px] tabular-nums shrink-0 w-10 text-right text-gray">
            {percent}%
          </span>
        )}
        <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0 min-w-[110px] text-right">
          {formatRon(displayAmount)} <span className="text-gray">lei</span>
        </span>
      </button>
      {open && (
        <div
          id={`vertical-cont-detail-${account.cont}`}
          className="bg-dark-3/30 px-4 py-3 border-t border-dark-3/40"
          onClick={(e) => e.stopPropagation()}
        >
          <ContInlineBreakdown
            account={account}
            rulaj={rulaj}
            vertical={vertical}
            verticalPercent={percent}
            residueFilterActive={residueFilterActive}
            partnerSummary={partnerSummary}
            residueDetail={
              vertical.isDefault ? residueDetail : null
            }
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onAccountClick(account.cont)}
              className="inline-flex items-center gap-1 rounded-md border border-dark-3 bg-dark-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-gray-light hover:text-white hover:border-primary/40"
              style={{ letterSpacing: "0.02em" }}
            >
              Vezi parteneri
              <CornerUpRight size={11} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Read-only drawer rendered inside a cont row in the expanded vertical
 * column. The drawer answers ONE question first, prominently: how much of
 * this cont's rulaj lands on the selected line of business. Then it shows
 * the cont-level partner distribution (informative context) and, on the
 * default vertical, which target categories absorbed residue here.
 *
 * The vertical-aware headline is the most important element — the contabil
 * shouldn't have to do math to know "100% = all 2.991 lei land here".
 */
function ContInlineBreakdown({
  rulaj,
  vertical,
  verticalPercent,
  residueFilterActive,
  partnerSummary,
  residueDetail,
}: {
  account: AccountListItem;
  rulaj: number;
  vertical: VerticalView;
  /** % of this cont's rulaj that lands on the displayed vertical (1-100).
   *  Comes from the cont's allocation split for this vertical, or 100 when
   *  the cont has no explicit allocation and the vertical is the default. */
  verticalPercent: number;
  /** True when the user drilled in via the residue badge. Changes the
   *  headline to talk about residue contribution instead of total flow. */
  residueFilterActive: boolean;
  partnerSummary: PartnerSummary | null;
  residueDetail: ResidueSourceDetail | null;
}) {
  const totalRulaj = Math.abs(rulaj);
  const amountOnVertical = (totalRulaj * verticalPercent) / 100;
  const residueAmount = residueDetail?.totalAmount ?? 0;
  const residuePct =
    totalRulaj > 0 ? Math.round((residueAmount / totalRulaj) * 100) : 0;

  const overridden = partnerSummary?.overriddenRulaj ?? 0;
  const unresolved = partnerSummary?.unresolvedRulaj ?? 0;
  const partnerRulaj = partnerSummary?.totalPartnerRulaj ?? 0;
  const followRulaj = Math.max(0, partnerRulaj - overridden);
  const overridePct =
    totalRulaj > 0 ? Math.round((overridden / totalRulaj) * 100) : 0;
  const followPct =
    totalRulaj > 0 ? Math.round((followRulaj / totalRulaj) * 100) : 0;
  const unresolvedPct =
    totalRulaj > 0 ? Math.round((unresolved / totalRulaj) * 100) : 0;
  const hasOverrides = (partnerSummary?.mappedPartnerCount ?? 0) > 0;
  const followCount =
    (partnerSummary?.partnerCount ?? 0) -
    (partnerSummary?.mappedPartnerCount ?? 0);
  const fullFlow = verticalPercent >= 100;

  return (
    <div className="space-y-3">
      {/* The headline — the answer to "how much of this cont lands here". */}
      <div className="rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2">
        {residueFilterActive && residueDetail ? (
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Contul contribuie cu{" "}
            <span className="font-mono text-white tabular-nums font-semibold">
              {formatRon(residueAmount)} lei
            </span>{" "}
            reziduu pe{" "}
            <span className="font-semibold text-white">{vertical.name}</span>
            {" "}({residuePct}% din rulajul cumulat de{" "}
            <span className="font-mono tabular-nums">
              {formatRon(totalRulaj)} lei
            </span>
            ).
          </p>
        ) : (
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Pe{" "}
            <span className="font-semibold text-white">{vertical.name}</span>{" "}
            ajung{" "}
            <span className="font-mono text-white tabular-nums font-semibold">
              {formatRon(amountOnVertical)} lei
            </span>
            {fullFlow ? (
              <>
                {" "}— tot rulajul contului ({formatRon(totalRulaj)} lei).
              </>
            ) : (
              <>
                {" "}din{" "}
                <span className="font-mono tabular-nums">
                  {formatRon(totalRulaj)} lei
                </span>{" "}
                rulaj cumulat ({verticalPercent}%).
              </>
            )}
          </p>
        )}
      </div>

      {/* Cont-level partner distribution — context, not the headline answer.
          When the cont has partner exceptions, show the 3-segment bar +
          breakdown. When no exceptions, a single italic line. */}
      {partnerSummary && (
        <div className="space-y-1.5">
          <p
            className="font-mono text-[9px] uppercase tracking-wider text-gray"
            style={{ letterSpacing: "0.06em" }}
          >
            Distributia contului intre parteneri
          </p>
          {hasOverrides ? (
            <>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-dark-2">
                {followPct > 0 && (
                  <div
                    className="h-full bg-gray/40"
                    style={{ width: `${followPct}%` }}
                    aria-hidden
                  />
                )}
                {overridePct > 0 && (
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${overridePct}%` }}
                    aria-hidden
                  />
                )}
                {unresolvedPct > 0 && (
                  <div
                    className="h-full bg-dark-3"
                    style={{ width: `${unresolvedPct}%` }}
                    aria-hidden
                  />
                )}
              </div>
              <ul
                className="font-mono text-[10px] text-gray tabular-nums space-y-0.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {partnerSummary.mappedPartnerCount > 0 && (
                  <li>
                    <span className="inline-block h-1.5 w-1.5 rounded-sm bg-primary mr-1.5 align-middle" />
                    {partnerSummary.mappedPartnerCount}{" "}
                    {partnerSummary.mappedPartnerCount === 1
                      ? "partener cu exceptie"
                      : "parteneri cu exceptie"}{" "}
                    · {formatRon(overridden)} lei · {overridePct}%
                  </li>
                )}
                {followCount > 0 && (
                  <li>
                    <span className="inline-block h-1.5 w-1.5 rounded-sm bg-gray/40 mr-1.5 align-middle" />
                    {followCount}{" "}
                    {followCount === 1
                      ? "partener urmeaza contul"
                      : "parteneri urmeaza contul"}{" "}
                    · {formatRon(followRulaj)} lei · {followPct}%
                  </li>
                )}
                {unresolved > 0 && (
                  <li>
                    <span className="inline-block h-1.5 w-1.5 rounded-sm bg-dark-3 border border-gray/30 mr-1.5 align-middle" />
                    Fara partener identificat · {formatRon(unresolved)} lei ·{" "}
                    {unresolvedPct}%
                  </li>
                )}
              </ul>
            </>
          ) : (
            <p
              className="text-[11px] text-gray italic"
              style={{ letterSpacing: "-0.02em" }}
            >
              Toti partenerii urmeaza maparea contului. Niciun partener cu
              exceptie individuala.
            </p>
          )}
        </div>
      )}

      {/* Residue absorption — ONLY when on default vertical and the cont
          actually contributes residue (its partner exceptions target
          categories without their own horizontal). */}
      {residueDetail && residueDetail.targets.length > 0 && (
        <div className="pt-2 border-t border-dark-3/60">
          <p
            className="text-[9px] uppercase tracking-wider text-gray font-mono mb-1"
            style={{ letterSpacing: "0.06em" }}
          >
            Cum ajung banii pe {vertical.name}: reziduu din exceptii partener
          </p>
          <ul
            className="font-mono text-[10px] text-gray-light tabular-nums space-y-0.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            {residueDetail.targets.map((t) => (
              <li key={t.categoryId} className="flex items-baseline gap-2">
                <span className="text-primary" aria-hidden>
                  ↙
                </span>
                <span className="flex-1 truncate" title={t.categoryName}>
                  {t.categoryName}
                </span>
                <span className="shrink-0">{formatRon(t.amount)} lei</span>
              </li>
            ))}
          </ul>
          <p
            className="mt-1 text-[10px] text-gray italic"
            style={{ letterSpacing: "-0.02em" }}
          >
            Banii cad pe {vertical.name} pentru ca aceste categorii nu au
            orizontala proprie setata.
          </p>
        </div>
      )}
    </div>
  );
}

function VerticalRow({
  vertical,
  clientId,
  onMutate,
}: {
  vertical: VerticalView;
  clientId: string;
  onMutate: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !confirm(
        `Sterg verticala "${vertical.name}"? Conturile alocate aici trec automat la "Toata firma".`
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteVerticalAction({ clientId, verticalId: vertical.id });
      if (r.error) alert(r.error);
      else onMutate();
    });
  }

  if (renaming) {
    return (
      <li>
        <RenameVerticalInline
          vertical={vertical}
          clientId={clientId}
          onDone={() => {
            setRenaming(false);
            onMutate();
          }}
          onCancel={() => setRenaming(false)}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-dark-3/50">
      <span
        className="flex-1 text-[13px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        {vertical.name}
        {vertical.isDefault && (
          <Tooltip content="Verticala implicita unde merg conturile fara alocare. Nu poti sterge, doar redenumi.">
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gray cursor-help">
              implicit
            </span>
          </Tooltip>
        )}
      </span>
      <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
        {vertical.allocationCount} conturi
      </span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <Tooltip content="Redenumeste">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="p-1 text-gray hover:text-primary"
          >
            <Pencil size={11} />
          </button>
        </Tooltip>
        {!vertical.isDefault && (
          <Tooltip content="Sterge verticala. Conturile alocate aici trec la 'Toata firma'.">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="p-1 text-gray hover:text-neg"
            >
              <Trash2 size={11} />
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}

function RenameVerticalInline({
  vertical,
  clientId,
  onDone,
  onCancel,
}: {
  vertical: VerticalView;
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(vertical.name);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === vertical.name) {
      onCancel();
      return;
    }
    startTransition(async () => {
      const r = await renameVerticalAction({
        clientId,
        verticalId: vertical.id,
        name: trimmed,
      });
      if (r.error) {
        alert(r.error);
        onCancel();
      } else {
        onDone();
      }
    });
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="p-1 text-primary hover:text-primary-light"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-gray hover:text-gray-light"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function AddVerticalInline({
  clientId,
  onDone,
  onCancel,
}: {
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await createVerticalAction({ clientId, name: trimmed });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume verticala"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button variant="primary" onClick={submit} disabled={pending || !name.trim()}>
        Adauga
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Renunta
      </Button>
      {error && <p className="text-[11px] text-neg">{error}</p>}
    </div>
  );
}

function ActivateVerticalsModal({
  clientId,
  onClose,
  onDone,
}: {
  clientId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEscapeKey(onClose);

  function updateName(idx: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === idx ? value : n)));
  }
  function addRow() {
    setNames((prev) => [...prev, ""]);
  }
  function removeRow(idx: number) {
    setNames((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    setError(null);
    const cleaned = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (cleaned.length === 0) {
      setError("Adauga cel putin o verticala (exemplu: 'Outsourcing').");
      return;
    }
    startTransition(async () => {
      const enableResult = await enableVerticalsAction({ clientId });
      if (enableResult.error) {
        setError(enableResult.error);
        return;
      }
      for (const name of cleaned) {
        const r = await createVerticalAction({ clientId, name });
        if (r.error) {
          setError(`Eroare la "${name}": ${r.error}`);
          return;
        }
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-dark-3 bg-dark-2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-[18px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Configureaza verticalele firmei
        </h2>
        <p
          className="mt-2 text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Scrie numele liniilor de business pe care vrei sa le urmaresti. Poti
          adauga sau modifica oricand.
        </p>
        <ul className="mt-5 space-y-2">
          {names.map((name, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-gray w-5 shrink-0 tabular-nums">
                {idx + 1}.
              </span>
              <Input
                value={name}
                onChange={(e) => updateName(idx, e.target.value)}
                placeholder={
                  idx === 0 ? "Outsourcing" : idx === 1 ? "Recruitment" : idx === 2 ? "Coworking" : "Alt nume"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-1 text-gray hover:text-neg"
                  title="Sterge"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Plus size={12} /> Adauga inca una
        </button>
        <p
          className="mt-5 text-[11px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Verticala &quot;Toata firma&quot; se creeaza automat pentru conturile
          care nu sunt atribuite niciunei linii de business.
        </p>
        {error && <p className="mt-3 text-[12px] text-neg">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Renunta
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending}>
            {pending ? "Se salveaza..." : "Salveaza si continua"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  period,
  availableYears,
  availablePeriods,
  coverage,
  freshlySeeded,
  onJumpToUnmapped,
  onPeriodChange,
}: {
  period: { year: number; month: number } | null;
  availableYears: number[];
  availablePeriods: { year: number; month: number }[];
  coverage: CoverageStats;
  freshlySeeded: boolean;
  onJumpToUnmapped: () => void;
  onPeriodChange: (year: number, month: number) => void;
}) {
  const periodDescription = period
    ? period.month === 12
      ? `anul ${period.year} complet`
      : `${monthLabel(period.year, 1)} → ${monthLabel(period.year, period.month)}`
    : null;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2
            className="text-[20px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Mapari Cashflow
          </h2>
          <div className="flex items-center gap-4 shrink-0">
            {availableYears.length > 0 && period && (
              <PeriodSelector
                availableYears={availableYears}
                availablePeriods={availablePeriods}
                selectedYear={period.year}
                selectedMonth={period.month}
                onChange={onPeriodChange}
              />
            )}
            <div className="flex items-center gap-3 text-[12px]">
              <DocsLink href={DocsLinks.mappingLanguage}>Limbajul maparii</DocsLink>
            </div>
          </div>
        </div>
        <p
          className="mt-1 max-w-3xl text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Organizeaza conturile firmei in categorii usor de inteles pentru
          antreprenor. Acestea apar pe /firma sub &quot;Unde s-au dus banii&quot;
          si &quot;De unde au venit banii&quot;. Sumele de mai jos sunt
          rulajul cumulat
          {periodDescription ? ` (${periodDescription})` : ""}. Un reper pentru
          ce conturi conteaza pe anul selectat.
        </p>
      </div>

      {coverage.totalAccountCount > 0 && (
        <CoveragePanel coverage={coverage} onJumpToUnmapped={onJumpToUnmapped} />
      )}

      {freshlySeeded && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Am pornit cu taxonomia standard OMFP. Editeaz&apos;o cum vrei —
            redenumeste, adauga subcategorii, sterge ce nu se aplica.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              COVERAGE STRIP                                */
/* -------------------------------------------------------------------------- */

/**
 * A single quiet line under the title: how many conturi are mapped + a
 * clickable pill when some are not. The stars of the page are the mappings
 * and the lines — coverage is just a reassuring footnote, not a panel.
 */
function CoveragePanel({
  coverage,
  onJumpToUnmapped,
}: {
  coverage: CoverageStats;
  onJumpToUnmapped: () => void;
}) {
  const mappedCount = coverage.totalAccountCount - coverage.unmappedCount;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px] text-gray tabular-nums"
      style={{ letterSpacing: "-0.02em" }}
    >
      <span>
        <span className="text-gray-light">{mappedCount}</span> conturi mapate ·{" "}
        <span className="text-gray-light">{formatRon(coverage.mappedRulaj)}</span>{" "}
        lei
      </span>
      {coverage.unmappedCount > 0 && (
        <button
          type="button"
          data-testid="coverage-card-unmapped"
          onClick={onJumpToUnmapped}
          className="inline-flex items-center gap-1.5 rounded-full border border-neg-border bg-neg-bg px-2.5 py-0.5 text-neg hover:bg-neg-bg/80 transition-colors"
        >
          <AlertTriangle size={11} />
          {coverage.unmappedCount}{" "}
          {coverage.unmappedCount === 1 ? "cont nemapat" : "conturi nemapate"} →
        </button>
      )}
    </div>
  );
}

function CoverageBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  const tone =
    safe >= 90 ? "bg-pos" : safe >= 60 ? "bg-primary" : "bg-tone-warn";
  return (
    <div
      className="h-2 w-full rounded-full bg-dark-3 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <div
        className={`h-full ${tone} transition-all`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              YEAR SELECTOR                                 */
/* -------------------------------------------------------------------------- */

/**
 * Switches the working period (luna + an). Calls the parent's
 * `onChange(year, month)` instead of `router.replace` so the switch is a pure
 * client-side state update — no server re-render, no full page round-trip. The
 * parent mirrors the selection to `?cashflow-year=YYYY&cashflow-month=M` via
 * `history.replaceState` so deep-links and reloads land on the chosen period.
 *
 * The rulaj amounts are cumulative Jan→selected month of the chosen year, so
 * picking an earlier month shows the YTD picture as of that month's close.
 */
function PeriodSelector({
  availableYears,
  availablePeriods,
  selectedYear,
  selectedMonth,
  onChange,
}: {
  availableYears: number[];
  availablePeriods: { year: number; month: number }[];
  selectedYear: number;
  selectedMonth: number;
  onChange: (year: number, month: number) => void;
}) {
  const monthsForYear = availablePeriods
    .filter((p) => p.year === selectedYear)
    .map((p) => p.month)
    .sort((a, b) => a - b);

  function handleYearChange(value: string) {
    const yearNum = parseInt(value, 10);
    if (!Number.isFinite(yearNum) || yearNum === selectedYear) return;
    // Switching year resets the month to the latest available in that year —
    // the most useful default (full YTD through the most recent close).
    const months = availablePeriods
      .filter((p) => p.year === yearNum)
      .map((p) => p.month);
    const latest = months.length > 0 ? Math.max(...months) : selectedMonth;
    onChange(yearNum, latest);
  }

  function handleMonthChange(value: string) {
    const monthNum = parseInt(value, 10);
    if (Number.isFinite(monthNum) && monthNum !== selectedMonth) {
      onChange(selectedYear, monthNum);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Luna
        </span>
        <Select
          value={String(selectedMonth)}
          onChange={handleMonthChange}
          options={monthsForYear.map((m) => ({
            value: String(m),
            label: capitalize(MONTHS[m - 1]),
          }))}
        />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          An
        </span>
        <Select
          value={String(selectedYear)}
          onChange={handleYearChange}
          options={availableYears.map((y) => ({
            value: String(y),
            label: String(y),
          }))}
        />
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -------------------------------------------------------------------------- */
/*                            LEFT — CATEGORY TREE                            */
/* -------------------------------------------------------------------------- */

function CategoryTreePanel({
  tree,
  clientId,
  onMutate,
}: {
  tree: CostCategoryNode[];
  clientId: string;
  onMutate: () => void;
}) {
  const expenseRoots = tree.filter((n) => n.kind === "expense");
  const revenueRoots = tree.filter((n) => n.kind === "revenue");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-4">
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <CategorySection
          title="Cheltuieli"
          subtitle="Iesirile firmei"
          kind="expense"
          roots={expenseRoots}
          clientId={clientId}
          onMutate={onMutate}
        />
      </div>
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <CategorySection
          title="Venituri"
          subtitle="Intrarile firmei"
          kind="revenue"
          roots={revenueRoots}
          clientId={clientId}
          onMutate={onMutate}
        />
      </div>
      <PatronPreview expenseRoots={expenseRoots} revenueRoots={revenueRoots} />
    </div>
  );
}

function PatronPreview({
  expenseRoots,
  revenueRoots,
}: {
  expenseRoots: CostCategoryNode[];
  revenueRoots: CostCategoryNode[];
}) {
  // Take top 5 of each to keep the preview compact. Sort by name to stay
  // deterministic since we don't have amounts here.
  const expensesSample = expenseRoots.slice(0, 5);
  const revenuesSample = revenueRoots.slice(0, 4);

  return (
    <aside className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 self-start">
      <div className="flex items-center gap-1.5">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-primary"
          aria-hidden
        >
          Preview /firma
        </span>
      </div>
      <p
        className="mt-1 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Asa apar etichetele pe pagina patronului.
      </p>

      <div className="mt-4">
        <p
          className="text-[11px] font-semibold text-gray-light"
          style={{ letterSpacing: "-0.04em" }}
        >
          Unde s-au dus banii
        </p>
        <ul className="mt-1.5 space-y-1">
          {expensesSample.map((n) => (
            <li
              key={n.id}
              className="text-[11px] text-gray-light truncate"
              style={{ letterSpacing: "-0.02em" }}
              title={n.name}
            >
              • {n.name}
            </li>
          ))}
          {expenseRoots.length > expensesSample.length && (
            <li className="text-[10px] text-gray italic">
              +{expenseRoots.length - expensesSample.length} mai multe
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4">
        <p
          className="text-[11px] font-semibold text-gray-light"
          style={{ letterSpacing: "-0.04em" }}
        >
          De unde au venit banii
        </p>
        <ul className="mt-1.5 space-y-1">
          {revenuesSample.map((n) => (
            <li
              key={n.id}
              className="text-[11px] text-gray-light truncate"
              style={{ letterSpacing: "-0.02em" }}
              title={n.name}
            >
              • {n.name}
            </li>
          ))}
          {revenueRoots.length > revenuesSample.length && (
            <li className="text-[10px] text-gray italic">
              +{revenueRoots.length - revenuesSample.length} mai multe
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

function CategorySection({
  title,
  subtitle,
  kind,
  roots,
  clientId,
  onMutate,
}: {
  title: string;
  subtitle: string;
  kind: "expense" | "revenue";
  roots: CostCategoryNode[];
  clientId: string;
  onMutate: () => void;
}) {
  const [addingAt, setAddingAt] = useState<string | "ROOT" | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h3>
          <p
            className="text-[11px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingAt("ROOT")}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Plus size={12} /> Adauga
        </button>
      </div>

      {addingAt === "ROOT" && (
        <NewCategoryRow
          clientId={clientId}
          parentId={null}
          kind={kind}
          onDone={() => {
            setAddingAt(null);
            onMutate();
          }}
          onCancel={() => setAddingAt(null)}
        />
      )}

      {roots.length === 0 && addingAt !== "ROOT" && (
        <p className="text-[12px] text-gray italic">Nicio categorie inca.</p>
      )}

      <ul className="space-y-0.5">
        {roots.map((node) => (
          <CategoryTreeNode
            key={node.id}
            node={node}
            depth={0}
            clientId={clientId}
            addingAt={addingAt}
            setAddingAt={setAddingAt}
            onMutate={onMutate}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryTreeNode({
  node,
  depth,
  clientId,
  addingAt,
  setAddingAt,
  onMutate,
}: {
  node: CostCategoryNode;
  depth: number;
  clientId: string;
  addingAt: string | "ROOT" | null;
  setAddingAt: (v: string | "ROOT" | null) => void;
  onMutate: () => void;
}) {
  const [renaming, setRenaming] = useState(false);

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-dark-3/50"
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
      >
        {renaming ? (
          <RenameInline
            node={node}
            clientId={clientId}
            onDone={() => {
              setRenaming(false);
              onMutate();
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span
              className="flex-1 truncate text-[13px] text-gray-light"
              style={{ letterSpacing: "-0.02em" }}
              title={node.name}
            >
              {node.name}
            </span>
            {node.isOmfpDefault && (
              <Tooltip content="Categorie generata automat la prima vizita din planul de conturi standard OMFP. Poti redenumi sau sterge fara probleme.">
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray shrink-0 cursor-help">
                  OMFP
                </span>
              </Tooltip>
            )}
            {node.mappingCount > 0 && (
              <Tooltip content={`${node.mappingCount} conturi mapate direct la aceasta categorie.`}>
                <span className="font-mono text-[10px] text-gray tabular-nums shrink-0 cursor-help">
                  {node.mappingCount}
                </span>
              </Tooltip>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <Tooltip content="Adauga sub-categorie. Va aparea indentata sub aceasta categorie pe /firma.">
                <button
                  type="button"
                  onClick={() => setAddingAt(node.id)}
                  className="p-1 text-gray hover:text-primary"
                >
                  <Plus size={11} />
                </button>
              </Tooltip>
              <Tooltip content="Redenumeste categoria.">
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="p-1 text-gray hover:text-primary"
                >
                  <Pencil size={11} />
                </button>
              </Tooltip>
              <DeleteCategoryButton
                node={node}
                clientId={clientId}
                onDone={onMutate}
              />
            </div>
          </>
        )}
      </div>

      {addingAt === node.id && (
        <div style={{ paddingLeft: `${0.5 + (depth + 1) * 1}rem` }}>
          <NewCategoryRow
            clientId={clientId}
            parentId={node.id}
            kind={node.kind}
            onDone={() => {
              setAddingAt(null);
              onMutate();
            }}
            onCancel={() => setAddingAt(null)}
          />
        </div>
      )}

      {node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              clientId={clientId}
              addingAt={addingAt}
              setAddingAt={setAddingAt}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function NewCategoryRow({
  clientId,
  parentId,
  kind,
  onDone,
  onCancel,
}: {
  clientId: string;
  parentId: string | null;
  kind: "expense" | "revenue";
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction({
        clientId,
        parentId,
        kind,
        name: trimmed,
      });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume categorie noua"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <Button
          variant="primary"
          onClick={submit}
          disabled={pending || name.trim().length === 0}
        >
          {pending ? "..." : "Adauga"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Renunta
        </Button>
      </div>
      {error && (
        <p className="text-[11px] text-neg mt-1">{error}</p>
      )}
    </div>
  );
}

function RenameInline({
  node,
  clientId,
  onDone,
  onCancel,
}: {
  node: CostCategoryNode;
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === node.name) {
      onCancel();
      return;
    }
    startTransition(async () => {
      const result = await renameCategoryAction({
        clientId,
        categoryId: node.id,
        name: trimmed,
      });
      if (!result.error) onDone();
      else onCancel();
    });
  }

  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={submit}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="p-1 text-primary hover:text-primary-light"
      >
        <Check size={12} />
      </button>
    </div>
  );
}

function DeleteCategoryButton({
  node,
  clientId,
  onDone,
}: {
  node: CostCategoryNode;
  clientId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (
      !confirm(
        `Sterg categoria "${node.name}"? Aceasta actiune se inregistreaza in istoric.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction({
        clientId,
        categoryId: node.id,
      });
      if (result.error) {
        setError(result.error);
        alert(result.error);
      } else {
        onDone();
      }
    });
  }

  return (
    <Tooltip content={error ?? "Sterge categoria. Trebuie sa muti intai conturile alocate la alta categorie."}>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="p-1 text-gray hover:text-neg"
      >
        <Trash2 size={11} />
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*                           ACCOUNT LIST                                     */
/* -------------------------------------------------------------------------- */

function AccountListPanel({
  accounts,
  totalAccounts,
  unmappedCount,
  unallocatedCount,
  splitCount,
  defaultVerticalName,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  tree,
  clientId,
  verticalsEnabled,
  verticals,
  mode,
  verticalFilter,
  onClearVerticalFilter,
  residueFilterActive,
  residueSourceContCount,
  onClearResidueFilter,
  onMutate,
}: {
  accounts: AccountListItem[];
  totalAccounts: number;
  unmappedCount: number;
  unallocatedCount: number;
  splitCount: number;
  /** Display name of the firm's implicit vertical (usually "Toata firma" but
   *  the contabil may have renamed it). Used in the filter label and in the
   *  vertical-mode header copy. */
  defaultVerticalName: string;
  filter: Filter;
  onFilterChange: (v: Filter) => void;
  query: string;
  onQueryChange: (v: string) => void;
  tree: CostCategoryNode[];
  clientId: string;
  verticalsEnabled: boolean;
  verticals: VerticalView[];
  /** Which axis this list is editing — controls which row column is shown
   *  + the surface header copy + the "Nemapat" definition (category mode
   *  flags conturi without category; vertical mode does not). */
  mode: "category" | "vertical";
  /** When set (vertical mode only), the list is scoped to conts allocated
   *  to this vertical id. Driven by clicking a column above. null = no
   *  vertical filter applied. */
  verticalFilter?: string | null;
  /** Callback fired when the contabil clicks the "Sterge filtru" affordance
   *  on the active-filter banner. */
  onClearVerticalFilter?: () => void;
  /** True when the list is narrowed to source conts contributing to
   *  default-vertical residue (clicked the `↙ X lei reziduu` badge). */
  residueFilterActive?: boolean;
  residueSourceContCount?: number;
  onClearResidueFilter?: () => void;
  onMutate: () => void;
}) {
  const activeVerticalFilterName =
    verticalFilter !== null && verticalFilter !== undefined
      ? verticals.find((v) => v.id === verticalFilter)?.name ?? null
      : null;
  const expensePicker = flattenTreeForPicker(tree, "expense");
  const revenuePicker = flattenTreeForPicker(tree, "revenue");

  const headerTitle =
    mode === "category"
      ? "Conturile firmei — pe grupuri"
      : "Conturile firmei — pe linii de business";
  const headerSubtitle =
    mode === "category"
      ? "Aseaza fiecare cont in grupul potrivit pentru patron. Lista e sortata dupa rulaj — incepe cu cele mai mari."
      : "Aloca fiecare cont pe verticala potrivita (sau lasa la 'Toata firma' daca e cheltuiala generala). Lista e sortata dupa rulaj.";

  const filterOptions: {
    value: Filter;
    label: string;
    count?: number;
    countTone?: "danger" | "neutral";
  }[] = [
    { value: "all", label: "Toate" },
    ...(mode === "category"
      ? [
          {
            value: "unmapped" as Filter,
            label: "Nemapate",
            count: unmappedCount,
            countTone: (unmappedCount > 0 ? "danger" : "neutral") as
              | "danger"
              | "neutral",
          },
        ]
      : [
          {
            value: "unallocated" as Filter,
            label: `Doar ${defaultVerticalName}`,
            count: unallocatedCount,
            countTone: (unallocatedCount > 0 ? "danger" : "neutral") as
              | "danger"
              | "neutral",
          },
          {
            value: "split" as Filter,
            label: "Split",
            count: splitCount,
            countTone: "neutral" as "danger" | "neutral",
          },
        ]),
    { value: "expense", label: "Cheltuieli" },
    { value: "revenue", label: "Venituri" },
  ];

  const visibleCount = accounts.length;
  const filterActive = filter !== "all" || query.trim() !== "";

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-4">
      <div>
        <h3
          className="text-[14px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {headerTitle}
        </h3>
        <p
          className="text-[11px] text-gray mt-0.5 max-w-2xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          {totalAccounts}{" "}
          {totalAccounts === 1
            ? "cont de cheltuieli/venituri"
            : "conturi de cheltuieli si venituri"}
          {mode === "category" && unmappedCount > 0 && (
            <>
              ,{" "}
              <span className="font-semibold text-neg">
                {unmappedCount === 1
                  ? "1 fara grupare"
                  : `${unmappedCount} fara grupare`}
              </span>
            </>
          )}
          {mode === "vertical" && unallocatedCount > 0 && (
            <>
              ,{" "}
              <span className="font-semibold text-neg">
                {unallocatedCount === 1
                  ? `1 doar pe ${defaultVerticalName}`
                  : `${unallocatedCount} doar pe ${defaultVerticalName}`}
              </span>
            </>
          )}
          . {headerSubtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Cauta dupa cont sau denumire..."
          className="flex-1 min-w-[240px] max-w-md"
        />
        <ToggleGroup<Filter>
          value={filter}
          onChange={onFilterChange}
          options={filterOptions}
        />
      </div>

      {activeVerticalFilterName && onClearVerticalFilter && (
        <div
          data-testid="vertical-filter-banner"
          data-residue-mode={residueFilterActive ? "true" : undefined}
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/[0.08] px-3 py-2"
        >
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {residueFilterActive ? (
              <>
                Lista e filtrata la conturile{" "}
                <span className="font-semibold text-white">sursa</span> care
                contribuie cu reziduu la{" "}
                <span className="font-semibold text-white">
                  {activeVerticalFilterName}
                </span>
                .{" "}
                <span className="text-gray">
                  {visibleCount} din {residueSourceContCount ?? visibleCount}{" "}
                  {(residueSourceContCount ?? visibleCount) === 1
                    ? "cont sursa"
                    : "conturi sursa"}
                  . Conturile au exceptii de partener redirectate la categorii
                  fara orizontala proprie — banii cad pe verticala implicita.
                </span>
              </>
            ) : (
              <>
                Lista e filtrata la conturile pe{" "}
                <span className="font-semibold text-white">
                  {activeVerticalFilterName}
                </span>
                .{" "}
                <span className="text-gray">
                  {visibleCount} din {totalAccounts}{" "}
                  {totalAccounts === 1 ? "cont" : "conturi"}.
                </span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onClearVerticalFilter}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-dark-3 bg-dark-3/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-gray-light hover:text-white hover:border-primary/40"
            style={{ letterSpacing: "0.02em" }}
          >
            <X size={11} />
            Sterge filtru
          </button>
        </div>
      )}

      {filterActive && (
        <p
          className="text-[11px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          {visibleCount === 0
            ? "Niciun cont nu se potriveste."
            : `${visibleCount} din ${totalAccounts} ${
                totalAccounts === 1 ? "cont" : "conturi"
              } afisate.`}{" "}
          {filterActive && (
            <button
              type="button"
              onClick={() => {
                onFilterChange("all");
                onQueryChange("");
              }}
              className="text-primary hover:text-primary-light underline underline-offset-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              Reseteaza filtrele
            </button>
          )}
        </p>
      )}

      {accounts.length === 0 ? (
        <p
          className="text-[13px] text-gray italic py-6 text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun cont pentru filtrul curent.
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <AccountRow
              key={account.cont}
              account={account}
              picker={
                account.kind === "expense" ? expensePicker : revenuePicker
              }
              clientId={clientId}
              verticalsEnabled={verticalsEnabled}
              verticals={verticals}
              mode={mode}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AccountRow({
  account,
  picker,
  clientId,
  verticalsEnabled,
  verticals,
  mode,
  onMutate,
}: {
  account: AccountListItem;
  picker: FlatNode[];
  clientId: string;
  verticalsEnabled: boolean;
  verticals: VerticalView[];
  /** Which axis this row is showing controls for. The other axis is hidden
   *  so the contabil focuses on one concern at a time. */
  mode: "category" | "vertical";
  onMutate: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<MappingScope>(
    account.currentMapping?.scope ?? "contBase"
  );

  const value = account.currentMapping?.categoryId ?? "";
  const options = [
    { value: "", label: "— Nemapat —" },
    ...picker.map((n) => ({ value: n.id, label: pickerLabel(n) })),
  ];

  function handleChange(newCategoryId: string) {
    startTransition(async () => {
      if (newCategoryId === "") {
        await unmapAccountAction({
          clientId,
          cont: scope === "analytic" ? account.cont : account.contBase,
        });
        // also clear analytic override if present
        if (scope === "analytic") {
          await unmapAccountAction({ clientId, cont: account.cont });
        }
      } else {
        await mapAccountAction({
          clientId,
          cont: scope === "analytic" ? account.cont : account.contBase,
          scope,
          categoryId: newCategoryId,
        });
      }
      onMutate();
    });
  }

  function handleScopeChange(newScope: MappingScope) {
    setScope(newScope);
    // when switching to analytic, copy the base mapping to analytic so the
    // accountant can immediately diverge it. When switching back to contBase,
    // remove the analytic override.
    if (
      newScope === "analytic" &&
      account.currentMapping &&
      !account.hasAnalyticOverride
    ) {
      startTransition(async () => {
        await mapAccountAction({
          clientId,
          cont: account.cont,
          scope: "analytic",
          categoryId: account.currentMapping!.categoryId,
        });
        onMutate();
      });
    } else if (newScope === "contBase" && account.hasAnalyticOverride) {
      startTransition(async () => {
        await unmapAccountAction({ clientId, cont: account.cont });
        onMutate();
      });
    }
  }

  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;
  const isAnalytic = account.cont !== account.contBase;

  return (
    <li className="rounded-lg border border-dark-3 bg-dark/40 hover:bg-dark/60 hover:border-dark-3 transition-colors p-4">
      {/* Row 1 — account identity (cont, name, rulaj, status badges) */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-[12px] text-white tabular-nums shrink-0 min-w-[60px]">
          {account.cont}
        </span>
        <span
          className="flex-1 min-w-0 text-[13px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={account.denumire}
        >
          {account.denumire}
        </span>
        <Tooltip content="Rulajul contului din ultima luna inregistrata. Reper rapid sa vezi ce conturi merita atentie.">
          <span className="font-mono text-[12px] text-gray tabular-nums cursor-help shrink-0">
            rulaj {formatRon(rulaj)}
          </span>
        </Tooltip>
        {account.currentMapping === null && (
          <Tooltip content="Acest cont nu are categorie atribuita. Pe /firma va aparea grupat generic dupa codul OMFP.">
            <span className="inline-flex items-center gap-1 text-[10px] text-neg cursor-help shrink-0">
              <AlertTriangle size={10} /> Nemapat
            </span>
          </Tooltip>
        )}
        {account.hasAnalyticOverride && (
          <Tooltip content="Acest cont analitic are propria mapare, diferita de cea a contului de baza.">
            <span className="text-[10px] text-tone-warn cursor-help shrink-0">
              override analitic
            </span>
          </Tooltip>
        )}
      </div>

      {/* Row 2 — controls relevant to the active axis. Category mode shows
          'Cum se aplica' + 'Grup patron'; vertical mode shows only the
          vertical picker on the full width. This keeps the screen focused
          on one decision at a time. */}
      {mode === "category" ? (
        <div className="grid gap-3 items-start grid-cols-[260px_minmax(0,1fr)]">
          <div>
            <FieldLabel
              text="Cum se aplica"
              tooltip="'Pentru toate sub-conturile cu acest prefix' (cont de baza, ex. 628) sau 'doar pentru acest cont specific' (analitic, ex. 628.01)."
            />
            <div className="mt-1">
              {isAnalytic ? (
                <ScopeToggle
                  scope={scope}
                  isAnalytic={isAnalytic}
                  onChange={handleScopeChange}
                  disabled={pending}
                />
              ) : (
                <span
                  className="font-mono text-[12px] text-gray italic h-10 px-4 flex items-center rounded-[10px] border border-dark-3 bg-dark-2/40"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Din contul de baza
                </span>
              )}
            </div>
          </div>
          <div>
            <FieldLabel
              text="Grup patron"
              tooltip="Cum apare contul pe pagina /firma (ex. 'Servicii externe', 'Salarii brut')."
            />
            <div className="mt-1">
              <Select
                value={value}
                options={options}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      ) : (
        verticalsEnabled && (
          <div>
            <FieldLabel
              text="Linie de business"
              tooltip="La care verticala a firmei contribuie acest cont (ex. Outsourcing 100% sau split 60/40 intre 2 verticale)."
            />
            <div className="mt-1">
              <VerticalPicker
                clientId={clientId}
                cont={account.cont}
                contBase={account.contBase}
                scope={
                  account.hasAnalyticVerticalOverride ? "analytic" : "contBase"
                }
                verticals={verticals}
                currentSplits={account.currentAllocation?.splits ?? null}
                defaultVertical={verticals.find((v) => v.isDefault) ?? null}
              />
            </div>
          </div>
        )
      )}
    </li>
  );
}

function FieldLabel({ text, tooltip }: { text: string; tooltip: string }) {
  return (
    <div
      className="font-mono text-[9px] uppercase tracking-wider text-gray"
      style={{ letterSpacing: "-0.02em" }}
    >
      {text}
      <Tooltip content={tooltip}>
        <span className="ml-1 text-gray-light cursor-help">?</span>
      </Tooltip>
    </div>
  );
}

function ScopeToggle({
  scope,
  isAnalytic,
  onChange,
  disabled,
}: {
  scope: MappingScope;
  isAnalytic: boolean;
  onChange: (s: MappingScope) => void;
  disabled: boolean;
}) {
  if (!isAnalytic) {
    // Cont is already the base (e.g. "641" with no analytic), scope toggle
    // makes no sense — always contBase.
    return null;
  }
  return (
    <Select
      value={scope}
      onChange={(v) => !disabled && onChange(v as MappingScope)}
      options={[
        { value: "contBase", label: "Din contul de baza" },
        { value: "analytic", label: "Individual (doar acest cont)" },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

const RON = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}

/** Apply the category-toggle filter + the fuzzy search query against an
 *  account list. Search matches on cont, contBase, and denumire — all
 *  case-insensitive, diacritic-insensitive, and supports partial matches.
 *  The toggle filter is applied first (cheaper), then the search, then the
 *  vertical filter (when clicking a column in the verticals accordion).
 *
 *  A cont matches `verticalFilter = X` when its allocation contains a split
 *  on vertical X. Accounts WITHOUT explicit allocation flow to the default
 *  vertical, so when X is the default they're included as well.
 */
function filterAccounts(
  accounts: AccountListItem[],
  filter: Filter,
  query: string,
  verticalFilter: string | null = null,
  verticals: VerticalView[] = [],
  /** When non-null, further narrows the result to only conts whose `cont`
   *  string is in this set. Used when the contabil clicks the default-
   *  vertical residue badge: we want to see ONLY the source conts that
   *  contribute to that residue absorption, not the entire default-vertical
   *  bucket. Applied last, AFTER all other filters. */
  residueSourceConts: Set<string> | null = null
): AccountListItem[] {
  const byCategory = accounts.filter((a) => {
    if (filter === "expense") return a.kind === "expense";
    if (filter === "revenue") return a.kind === "revenue";
    if (filter === "unmapped") return a.currentMapping === null;
    if (filter === "unallocated")
      return (
        a.currentAllocation === null || a.currentAllocation.splits.length === 0
      );
    if (filter === "split")
      return (
        a.currentAllocation !== null && a.currentAllocation.splits.length > 1
      );
    return true;
  });

  const trimmed = query.trim();
  const byQuery =
    trimmed.length === 0
      ? byCategory
      : (() => {
          const needle = stripDiacritics(trimmed.toLowerCase());
          return byCategory.filter((a) => {
            const haystack = stripDiacritics(
              `${a.cont} ${a.contBase} ${a.denumire}`.toLowerCase()
            );
            return haystack.includes(needle);
          });
        })();

  const byVertical = (() => {
    if (!verticalFilter) return byQuery;
    const defaultId = verticals.find((v) => v.isDefault)?.id;
    const filteringDefault = verticalFilter === defaultId;
    return byQuery.filter((a) => {
      const hasAlloc =
        a.currentAllocation !== null && a.currentAllocation.splits.length > 0;
      if (!hasAlloc) return filteringDefault;
      return a.currentAllocation!.splits.some(
        (s) => s.verticalId === verticalFilter
      );
    });
  })();

  if (!residueSourceConts) return byVertical;
  return byVertical.filter((a) => residueSourceConts.has(a.cont));
}

/** Remove Romanian diacritics so 'sosele' matches 'sosele' and 'cheltuieli'
 *  matches 'cheltuieli'. Uses NFD decomposition + combining mark removal. */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const MONTHS = [
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

function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}
