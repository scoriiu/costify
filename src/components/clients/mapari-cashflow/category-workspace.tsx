"use client";

/**
 * Unified workspace for the Categorii axis. Replaces the previous dual-
 * surface design (separate "Numele grupurilor" tree editor + "Conturile
 * firmei pe grupuri" mapper) with a single integrated layout where each
 * category is a group header and the accounts mapped to it are listed
 * underneath. Sub-categories nest naturally.
 *
 * Single mental model:
 *   - Category = container with a patron-friendly name.
 *   - Accounts mapped to it = the content.
 *   - All actions (rename/delete category, add sub-category, add/move/
 *     unmap account) are inline, where they apply, with no separate
 *     mapping screen.
 *
 * Account adding is gated by validity: the picker only offers accounts
 * with the same kind (expense vs revenue) that are not already mapped
 * to this exact category — so you can't accidentally put cont 707 into
 * a Cheltuieli category.
 */

import { useState, useTransition, useMemo, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, ArrowRightLeft, X, Users, CornerUpRight, CornerDownLeft, FolderPlus, FolderTree, Check, List, LayoutGrid, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEscapeKey } from "@/lib/use-escape-key";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import type {
  CostCategoryNode,
  AccountListItem,
  CategoryInflow,
} from "@/modules/categories";
import type {
  VerticalView,
  CategoryAllocationView,
  AllocationSplit,
} from "@/modules/verticals";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  mapAccountAction,
  unmapAccountAction,
} from "@/modules/categories/actions";
import { CategoryTreemap } from "./category-treemap";
import { LinesView } from "./lines-view";
import { PartnerLobPanel } from "./partner-lob-panel";
import {
  EditCategoryAllocationDialog,
  EditAllocationDialog,
} from "./edit-allocation-dialog";

type Filter = "all" | "unmapped" | "expense" | "revenue";

interface Props {
  tree: CostCategoryNode[];
  accounts: AccountListItem[];
  clientId: string;
  period: { year: number; month: number } | null;
  onMutate: () => void;
  /** Whether the firm has activated the lines-of-business dimension. Drives
   *  the Linii view's activate CTA vs. the full workspace. */
  verticalsEnabled?: boolean;
  /** Verticals for this firm — drives the category-allocation dialog. Empty
   *  array when verticalsEnabled = false; in that case markers/CTAs hide. */
  verticals?: VerticalView[];
  /** Per-categoryId vertical allocations. Drives the marker tooltip's
   *  "100% Outsourcing" line and pre-populates the dialog. */
  categoryAllocations?: CategoryAllocationView[];
  /** The firm-top default split — top of the cascade. null = not configured.
   *  Drives the firm-split band and the "mosteneste firma" inherited state on
   *  each category. */
  firmDefaultSplits?: AllocationSplit[] | null;
  /** Per-categoryId inflow from partner-override residue. Missing key = no
   *  inflow this period. Drives the inflow marker on the category row. */
  categoryInflows?: Record<string, CategoryInflow>;
  /** Optional initial filter — set when arriving here via a deep-link from
   *  the PageHeader KPI cards (e.g. "X nemapate" → jumps + filters to
   *  unmapped). Defaults to "all" when not provided. Changes after mount
   *  propagate (so external nav still updates the view). Only "unmapped"
   *  is propagated from the parent for now; other values stay local. */
  initialFilter?: "all" | "unmapped" | "expense" | "revenue";
  /** When set, the workspace opens the partner slide-panel for the cont
   *  whose contBase matches this value on next render. Used to drill in
   *  from satellite dialogs (AllExceptionsDialog, ReviewQueueDialog) —
   *  the user clicks a cont, the dialog closes, the workspace opens the
   *  panel so they continue editing in the right place. The parent should
   *  clear this back to undefined once the panel opens so re-clicking the
   *  same cont later re-fires the open. */
  initialPanelContBase?: string;
  /** Called by the workspace when it consumes initialPanelContBase. The
   *  parent can use this to reset the prop to undefined so re-clicks
   *  re-fire properly. */
  onInitialPanelOpened?: () => void;
}

/**
 * Context for the residue indicators (cont marker, category marker, allocation
 * dialog trigger). Lives at the workspace root so any nested AccountRow or
 * CategoryNode can opt in without prop drilling.
 */
interface ResidueContextValue {
  verticals: VerticalView[];
  /** Lookup helper: per-categoryId vertical allocations. */
  categoryAllocations: Map<string, CategoryAllocationView>;
  /** Lookup helper: per-categoryId inflow rolled up to category + descendants.
   *  Roll-up so a parent category shows the sum of its children's inflows. */
  inflowByCategoryId: Map<string, CategoryInflow>;
  openCategoryAllocation: (category: CostCategoryNode) => void;
  /** Firm-top default split — what categories/conts inherit when they have no
   *  own rule. null = not configured (falls to "Toata firma"). */
  firmDefaultSplits: AllocationSplit[] | null;
  /** clientId — needed by per-cont override dialogs opened from AccountRow. */
  clientId: string;
  onMutate: () => void;
  /** Instant category delete (optimistic). Hides the node now, persists in
   *  the background, reparents/unmaps its conturi locally. */
  deleteCategory: (node: CostCategoryNode) => void;
}

const ResidueContext = createContext<ResidueContextValue | null>(null);
function useResidue() {
  return useContext(ResidueContext);
}

/** Lets any nested AccountRow open the partner LOB panel for its cont without
 *  prop-drilling through the category tree. */
const PartnerPanelContext = createContext<{
  open: (account: AccountListItem) => void;
} | null>(null);
function usePartnerPanel() {
  return useContext(PartnerPanelContext);
}

/** Drag-and-drop a cont into a group/subgroup. AccountRow registers the
 *  dragged cont; CategoryNode headers are drop targets that remap it. Kept in
 *  context so we avoid prop-drilling the handler through the whole tree. */
interface ContDragContextValue {
  draggingCont: string | null;
  setDraggingCont: (cont: string | null) => void;
  dropOnCategory: (cont: string, categoryId: string) => void;
  /** The cont that was just moved — flashes a highlight for ~2s so the move
   *  is never silent. null when nothing was recently moved. */
  recentlyMovedCont: string | null;
}
const ContDragContext = createContext<ContDragContextValue | null>(null);
function useContDrag() {
  return useContext(ContDragContext);
}

const CONT_DND_MIME = "application/x-costify-cont";

type ViewMode = "list" | "treemap" | "verticals";

// Single source of truth for the primary view switcher — order, labels and
// icons. Ordered by increasing aggregation: raw list -> visual map -> rolled
// up into business lines. Both render sites share this so they never drift.
const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: "list", label: "Linii de cost", icon: List },
  { value: "treemap", label: "Harta de cost", icon: LayoutGrid },
  { value: "verticals", label: "Linii de business", icon: Columns3 },
];

// URL slugs for the view toggle, kept friendly/stable so deep links read well
// (?cashflow-view=harta). The internal ViewMode names stay as-is.
const VIEW_PARAM = "cashflow-view";
const VIEW_TO_SLUG: Record<ViewMode, string> = {
  list: "list",
  treemap: "harta",
  verticals: "linii",
};
const SLUG_TO_VIEW: Record<string, ViewMode> = {
  list: "list",
  harta: "treemap",
  linii: "verticals",
};

function readViewFromUrl(): ViewMode {
  if (typeof window === "undefined") return "list";
  const slug = new URLSearchParams(window.location.search).get(VIEW_PARAM);
  return (slug && SLUG_TO_VIEW[slug]) || "list";
}

function writeViewToUrl(view: ViewMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (view === "list") url.searchParams.delete(VIEW_PARAM);
  else url.searchParams.set(VIEW_PARAM, VIEW_TO_SLUG[view]);
  window.history.replaceState(window.history.state, "", url.toString());
}

export function CategoryWorkspace({
  tree,
  accounts,
  clientId,
  period,
  onMutate,
  verticalsEnabled = false,
  verticals = [],
  categoryAllocations = [],
  firmDefaultSplits = null,
  categoryInflows = {},
  initialFilter,
  initialPanelContBase,
  onInitialPanelOpened,
}: Props) {
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "all");
  // Re-apply the requested filter when the parent changes initialFilter
  // (e.g. user clicks "Mapeaza nemapatele" KPI again later). This is the
  // controlled-on-demand pattern — local state owns the filter, but an
  // external signal can push it.
  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  // Adopt the view from the URL after mount (avoids SSR/hydration mismatch),
  // then keep the URL in sync on every change via history.replaceState — no
  // navigation, no server re-render, so the toggle stays instant.
  useEffect(() => {
    const fromUrl = readViewFromUrl();
    if (fromUrl !== "list") setView(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const changeView = useCallback((next: ViewMode) => {
    setView(next);
    writeViewToUrl(next);
  }, []);
  const [editingCategoryAlloc, setEditingCategoryAlloc] =
    useState<CostCategoryNode | null>(null);
  const [panelAccount, setPanelAccount] = useState<AccountListItem | null>(null);
  const [draggingCont, setDraggingCont] = useState<string | null>(null);
  const [recentlyMovedCont, setRecentlyMovedCont] = useState<string | null>(
    null
  );
  const movedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Optimistic cont→category overrides applied INSTANTLY on drop. We do NOT
  // refetch on success (that round-trip is what felt sluggish); the local
  // override stays until fresh server data arrives, then it's pruned. On
  // failure we drop the override so the UI snaps back to the truth.
  const [optimisticMappings, setOptimisticMappings] = useState<
    Map<string, string>
  >(new Map());
  // Categories hidden instantly on delete (persisted in the background).
  const [optimisticDeleted, setOptimisticDeleted] = useState<Set<string>>(
    new Set()
  );

  // When fresh `accounts` arrive from the server, prune any optimistic entry
  // the server already reflects (so we don't keep stale overrides forever).
  useEffect(() => {
    setOptimisticMappings((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [cont, catId] of prev) {
        const a = accounts.find((x) => x.cont === cont);
        if (a && a.currentMapping?.categoryId === catId) {
          next.delete(cont);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [accounts]);

  // Prune optimistic deletions the server tree no longer contains.
  useEffect(() => {
    setOptimisticDeleted((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set<string>();
      const walk = (nodes: CostCategoryNode[]) => {
        for (const n of nodes) {
          present.add(n.id);
          walk(n.children);
        }
      };
      walk(tree);
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!present.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tree]);

  const dropOnCategory = useCallback(
    (cont: string, categoryId: string) => {
      // Clear the drag state NOW. On a successful drop the dragged row is
      // re-rendered into its new home before the browser fires `dragend`, so
      // relying on onDragEnd alone would leave the row greyed until refresh.
      setDraggingCont(null);
      const account = accounts.find((a) => a.cont === cont);
      if (!account) return;
      if (account.currentMapping?.categoryId === categoryId) return;
      // Instant: move the cont locally now, persist in the background.
      setOptimisticMappings((prev) => new Map(prev).set(cont, categoryId));
      // Flash a "just moved" highlight for ~2s so the move is never silent.
      setRecentlyMovedCont(cont);
      if (movedTimer.current) clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setRecentlyMovedCont(null), 2200);
      void mapAccountAction({
        clientId,
        cont: account.cont,
        scope: account.cont !== account.contBase ? "analytic" : "contBase",
        categoryId,
      }).then((r) => {
        if (r.error) {
          alert(r.error);
          setOptimisticMappings((prev) => {
            const next = new Map(prev);
            next.delete(cont);
            return next;
          });
        }
      });
    },
    [accounts, clientId]
  );

  useEffect(
    () => () => {
      if (movedTimer.current) clearTimeout(movedTimer.current);
    },
    []
  );

  const dragValue: ContDragContextValue = useMemo(
    () => ({ draggingCont, setDraggingCont, dropOnCategory, recentlyMovedCont }),
    [draggingCont, dropOnCategory, recentlyMovedCont]
  );

  // Instant category delete: hide the node + locally reparent/unmap its conturi
  // now, persist in the background. On failure, snap back.
  const deleteCategoryOptimistic = useCallback(
    (node: CostCategoryNode) => {
      setOptimisticDeleted((prev) => new Set(prev).add(node.id));
      if (node.mappingCount > 0) {
        const targetCat = node.parentId; // null => unmap
        setOptimisticMappings((prev) => {
          const next = new Map(prev);
          for (const a of accounts) {
            if (a.currentMapping?.categoryId === node.id && targetCat) {
              next.set(a.cont, targetCat);
            }
          }
          return next;
        });
      }
      void deleteCategoryAction({ clientId, categoryId: node.id }).then((r) => {
        if (r.error) {
          alert(r.error);
          setOptimisticDeleted((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      });
    },
    [accounts, clientId]
  );

  // Pre-index category allocations for O(1) lookup in the tree walk.
  const categoryAllocationsById = useMemo(() => {
    const m = new Map<string, CategoryAllocationView>();
    for (const ca of categoryAllocations) m.set(ca.categoryId, ca);
    return m;
  }, [categoryAllocations]);

  // Roll up inflows so a parent category shows the SUM of its children's
  // direct inflows (if any) plus its own. Walks the tree once per render.
  const inflowByCategoryId = useMemo(
    () => rollUpInflows(tree, categoryInflows),
    [tree, categoryInflows]
  );

  const residueValue: ResidueContextValue = useMemo(
    () => ({
      verticals,
      categoryAllocations: categoryAllocationsById,
      inflowByCategoryId,
      openCategoryAllocation: setEditingCategoryAlloc,
      firmDefaultSplits,
      clientId,
      onMutate,
      deleteCategory: deleteCategoryOptimistic,
    }),
    [
      verticals,
      categoryAllocationsById,
      inflowByCategoryId,
      firmDefaultSplits,
      clientId,
      onMutate,
      deleteCategoryOptimistic,
    ]
  );

  // Apply optimistic drag-drop overrides so the tree reflects an in-flight
  // move instantly, before the server confirms.
  const effectiveAccounts = useMemo(() => {
    if (optimisticMappings.size === 0) return accounts;
    return accounts.map((a) => {
      const catId = optimisticMappings.get(a.cont);
      if (!catId || a.currentMapping?.categoryId === catId) return a;
      return {
        ...a,
        currentMapping: {
          categoryId: catId,
          scope: a.cont !== a.contBase ? "analytic" : "contBase",
        } as AccountListItem["currentMapping"],
      };
    });
  }, [accounts, optimisticMappings]);

  // Build per-category mapping index so each row knows which accounts it owns
  // and roots can compute their aggregated rulaj including descendants.
  const accountsByCategory = useMemo(
    () => buildAccountsByCategory(effectiveAccounts),
    [effectiveAccounts]
  );
  const aggregatedRulaj = useMemo(
    () => buildAggregatedRulaj(tree, accountsByCategory),
    [tree, accountsByCategory]
  );

  const unmappedAccounts = effectiveAccounts.filter(
    (a) => a.currentMapping === null
  );

  // Hide optimistically-deleted categories (and any of their children) from
  // the rendered tree until the server confirms.
  const visibleTree = useMemo(() => {
    if (optimisticDeleted.size === 0) return tree;
    const prune = (nodes: CostCategoryNode[]): CostCategoryNode[] =>
      nodes
        .filter((n) => !optimisticDeleted.has(n.id))
        .map((n) => ({ ...n, children: prune(n.children) }));
    return prune(tree);
  }, [tree, optimisticDeleted]);

  const expenseRoots = visibleTree.filter((n) => n.kind === "expense");
  const revenueRoots = visibleTree.filter((n) => n.kind === "revenue");

  if (view === "treemap") {
    return (
      <WorkspaceShell view={view} onViewChange={changeView}>
        <CategoryTreemap
          tree={tree}
          accountsByCategory={accountsByCategory}
          aggregatedRulaj={aggregatedRulaj}
        />
      </WorkspaceShell>
    );
  }

  if (view === "verticals") {
    return (
      <>
        <WorkspaceShell view={view} onViewChange={changeView}>
          <LinesView
            accounts={accounts}
            verticals={verticals}
            tree={tree}
            clientId={clientId}
            enabled={verticalsEnabled}
            firmDefaultSplits={firmDefaultSplits}
            categoryAllocationsById={categoryAllocationsById}
            inflowByCategoryId={inflowByCategoryId}
            onMutate={onMutate}
            onOpenPartners={setPanelAccount}
          />
        </WorkspaceShell>
        <PartnerLobPanel
          account={panelAccount}
          clientId={clientId}
          period={period}
          verticals={verticals}
          onClose={() => setPanelAccount(null)}
          onMutate={onMutate}
        />
      </>
    );
  }

  return (
    <PartnerPanelContext.Provider value={{ open: setPanelAccount }}>
     <ContDragContext.Provider value={dragValue}>
     <ResidueContext.Provider value={residueValue}>
      <WorkspaceShell view={view} onViewChange={changeView}>
       <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-5">
        <WorkspaceFilters
          unmappedCount={unmappedAccounts.length}
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
        />

        {filter === "unmapped" || unmappedAccounts.length > 0 ? (
          <UnmappedAccountsCallout
            accounts={unmappedAccounts}
            tree={tree}
            clientId={clientId}
            onMutate={onMutate}
            expanded={filter === "unmapped"}
          />
        ) : null}

        {(filter === "all" || filter === "expense" || filter === "unmapped") && (
          <CategoryGroup
            title="Cheltuieli"
            subtitle="Iesirile firmei"
            kind="expense"
            roots={expenseRoots}
            accountsByCategory={accountsByCategory}
            aggregatedRulaj={aggregatedRulaj}
            query={query}
            accounts={accounts}
            clientId={clientId}
            onMutate={onMutate}
          />
        )}

        {(filter === "all" || filter === "revenue" || filter === "unmapped") && (
          <CategoryGroup
            title="Venituri"
            subtitle="Intrarile firmei"
            kind="revenue"
            roots={revenueRoots}
            accountsByCategory={accountsByCategory}
            aggregatedRulaj={aggregatedRulaj}
            query={query}
            accounts={accounts}
            clientId={clientId}
            onMutate={onMutate}
          />
        )}

        {editingCategoryAlloc && (
          <EditCategoryAllocationDialog
            open
            categoryId={editingCategoryAlloc.id}
            categoryName={editingCategoryAlloc.name}
            kind={editingCategoryAlloc.kind}
            inflow={inflowByCategoryId.get(editingCategoryAlloc.id)?.amount ?? 0}
            currentSplits={
              categoryAllocationsById.get(editingCategoryAlloc.id)?.splits ?? []
            }
            verticals={verticals}
            clientId={clientId}
            onClose={() => setEditingCategoryAlloc(null)}
            onSaved={() => {
              setEditingCategoryAlloc(null);
              onMutate();
            }}
           />
         )}
       </div>
      </WorkspaceShell>
       <PartnerLobPanel
         account={panelAccount}
         clientId={clientId}
         period={period}
         verticals={verticals}
         onClose={() => setPanelAccount(null)}
         onMutate={onMutate}
       />
     </ResidueContext.Provider>
     </ContDragContext.Provider>
    </PartnerPanelContext.Provider>
  );
}

// Title + one-line intro per view. The header LAYOUT stays identical across
// views (title left, switcher right, inside the same card) — only the copy
// changes — so the switcher never appears to "move" between views.
const VIEW_INTRO: Record<ViewMode, { title: string; desc: string }> = {
  list: {
    title: "Conturile firmei pe linii de cost",
    desc: "Fiecare linie de cost arata cum apare pe pagina patronului (/firma). Conturile sunt indentate sub linia lor de cost. Adauga, redenumeste sau muta direct de aici.",
  },
  treemap: {
    title: "Harta liniilor de cost",
    desc: "Aceleasi linii de cost, dimensionate dupa cat cantaresc. Vezi dintr-o privire unde se duc banii firmei.",
  },
  verticals: {
    title: "Liniile de business",
    desc: "Imparte firma pe activitati si vezi cat aduce si cat costa fiecare linie. Mapezi linii de cost, conturi sau parteneri pe fiecare linie.",
  },
};

/**
 * The one consistent frame for all three views. Renders the card, the title
 * on the left and the primary view switcher on the right — in the SAME place
 * and SAME size regardless of which view is active. Each view supplies its
 * own body (and the list view its own filters) as children.
 */
function WorkspaceShell({
  view,
  onViewChange,
  children,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  children: React.ReactNode;
}) {
  const intro = VIEW_INTRO[view];
  return (
    <div className="space-y-4">
      {/* The view switcher is a full-width 3-way segmented bar on its own row,
          ABOVE the title. It never moves or resizes when the active view (and
          its title/description below) changes, because it owns its own row and
          each segment is an equal third of the card width. */}
      <ViewSwitcher view={view} onViewChange={onViewChange} />
      <div>
        <h3
          className="text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {intro.title}
        </h3>
        <p
          className="text-[11px] text-gray mt-0.5 max-w-2xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          {intro.desc}
        </p>
      </div>
      {children}
    </div>
  );
}

/**
 * Full-width 3-way segmented control for the primary view switch. Each segment
 * is an equal third so the bar is stable regardless of label length, and the
 * active segment never shifts the inactive ones. Color follows the design
 * system: active segment is `bg-primary text-[#E9E8E3]` (never `text-white`
 * on teal), inactive is muted with hover.
 */
function ViewSwitcher({
  view,
  onViewChange,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Schimba vizualizarea"
      className="grid grid-cols-3 gap-1 rounded-[10px] bg-dark-2 p-1.5"
    >
      {VIEW_OPTIONS.map((opt) => {
        const active = view === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onViewChange(opt.value)}
            data-state={active ? "active" : "inactive"}
            aria-pressed={active}
            className={`flex h-10 items-center justify-center gap-2.5 rounded-lg font-mono text-[15px] font-medium transition-colors ${
              active ? "bg-primary text-[#E9E8E3]" : "text-gray hover:text-white"
            }`}
          >
            <Icon size={16} aria-hidden className="shrink-0" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          LIST-VIEW FILTERS                                 */
/* -------------------------------------------------------------------------- */

// Search + kind/unmapped filters. List-view only — the map and lines views
// have no per-row filtering, so this lives outside the shared shell header.
function WorkspaceFilters({
  unmappedCount,
  query,
  onQueryChange,
  filter,
  onFilterChange,
}: {
  unmappedCount: number;
  query: string;
  onQueryChange: (v: string) => void;
  filter: Filter;
  onFilterChange: (v: Filter) => void;
}) {
  return (
    <div className="space-y-3">
      {unmappedCount > 0 && (
        <p className="text-[11px] text-neg" style={{ letterSpacing: "-0.02em" }}>
          {unmappedCount === 1
            ? "1 cont nu e inca asezat in nicio linie de cost."
            : `${unmappedCount} conturi nu sunt inca asezate in nicio linie de cost.`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Cauta dupa cont, denumire sau linie de cost..."
          className="flex-1 min-w-[240px] max-w-md"
        />
        <ToggleGroup<Filter>
          value={filter}
          onChange={onFilterChange}
          options={[
            { value: "all", label: "Toate" },
            {
              value: "unmapped",
              label: "Nemapate",
              count: unmappedCount,
              countTone: unmappedCount > 0 ? "danger" : "neutral",
            },
            { value: "expense", label: "Cheltuieli" },
            { value: "revenue", label: "Venituri" },
          ]}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                       UNMAPPED ACCOUNTS CALLOUT                            */
/* -------------------------------------------------------------------------- */

function UnmappedAccountsCallout({
  accounts,
  tree,
  clientId,
  onMutate,
  expanded: forceExpanded,
}: {
  accounts: AccountListItem[];
  tree: CostCategoryNode[];
  clientId: string;
  onMutate: () => void;
  expanded: boolean;
}) {
  const [expanded, setExpanded] = useState(forceExpanded);

  if (accounts.length === 0) return null;

  return (
    <div className="rounded-lg border border-neg-border bg-neg-bg p-4 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span
          className="text-[13px] font-semibold text-neg"
          style={{ letterSpacing: "-0.04em" }}
        >
          {accounts.length === 1
            ? "1 cont fara linie de cost"
            : `${accounts.length} conturi fara linie de cost`}
        </span>
        <span
          className="text-[11px] text-gray flex-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Aceste conturi apar pe /firma intr-o linie de cost generica. Aseaza-le in
          linia de cost potrivita ca patronul sa vada nume clare.
        </span>
      </button>

      {expanded && (
        <ul className="space-y-1.5 pt-1">
          {accounts.map((a) => (
            <AccountRow
              key={a.cont}
              account={a}
              tree={tree}
              clientId={clientId}
              onMutate={onMutate}
              compact
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         CATEGORY GROUP (Cheltuieli/Venituri)               */
/* -------------------------------------------------------------------------- */

function CategoryGroup({
  title,
  subtitle,
  kind,
  roots,
  accountsByCategory,
  aggregatedRulaj,
  query,
  accounts,
  clientId,
  onMutate,
}: {
  title: string;
  subtitle: string;
  kind: "expense" | "revenue";
  roots: CostCategoryNode[];
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
  query: string;
  accounts: AccountListItem[];
  clientId: string;
  onMutate: () => void;
}) {
  const [addingRoot, setAddingRoot] = useState(false);
  const trimmedQuery = query.trim().toLowerCase();

  // When a query is present, only render categories that have a matching
  // descendant (category name or mapped account). Empty categories without
  // matches collapse out so the contabil sees only relevant rows.
  const visibleRoots = trimmedQuery
    ? roots.filter((r) =>
        matchesQuery(r, accountsByCategory, trimmedQuery)
      )
    : roots;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <h4
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h4>
          <p
            className="text-[11px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            {subtitle}
          </p>
        </div>
        {!addingRoot && (
          <button
            type="button"
            onClick={() => setAddingRoot(true)}
            className="inline-flex items-center gap-1 text-[12px] text-primary hover:text-primary-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <Plus size={14} /> Adauga linie de cost
          </button>
        )}
      </div>

      {addingRoot && (
        <div className="mb-2">
          <NewCategoryInline
            clientId={clientId}
            parentId={null}
            kind={kind}
            onDone={() => {
              setAddingRoot(false);
              onMutate();
            }}
            onCancel={() => setAddingRoot(false)}
          />
        </div>
      )}

      {visibleRoots.length === 0 ? (
        <p
          className="text-[12px] text-gray italic py-4 text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          {trimmedQuery
            ? "Nicio linie de cost nu se potriveste cautarii."
            : "Nicio linie de cost inca. Apasa +Adauga linie de cost."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRoots.map((root) => (
            <CategoryNode
              key={root.id}
              node={root}
              depth={0}
              accountsByCategory={accountsByCategory}
              aggregatedRulaj={aggregatedRulaj}
              query={trimmedQuery}
              tree={roots}
              accounts={accounts}
              clientId={clientId}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              CATEGORY NODE                                 */
/* -------------------------------------------------------------------------- */

function CategoryNode({
  node,
  depth,
  accountsByCategory,
  aggregatedRulaj,
  query,
  tree,
  accounts,
  clientId,
  onMutate,
}: {
  node: CostCategoryNode;
  depth: number;
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
  query: string;
  tree: CostCategoryNode[];
  accounts: AccountListItem[];
  clientId: string;
  onMutate: () => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0); // roots open, leaves closed
  const [renaming, setRenaming] = useState(false);
  const [addingSubcategory, setAddingSubcategory] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const contDrag = useContDrag();

  const directAccounts = accountsByCategory.get(node.id) ?? [];
  const totalRulaj = aggregatedRulaj.get(node.id) ?? 0;
  const hasContent = node.children.length > 0 || directAccounts.length > 0;
  const containerStyle = depth === 0
    ? "rounded-lg border border-dark-3 bg-dark-3/20 p-3"
    : "rounded-lg border border-dark-3/60 border-l-2 border-l-primary/50 bg-dark-3/10 pl-3 pr-2 py-2 ml-4";

  // When a query is active, force-expand any category that has a match
  // somewhere in its sub-tree so the contabil sees what matched.
  const forceExpanded = query.length > 0 && matchesQuery(node, accountsByCategory, query);
  const isExpanded = expanded || forceExpanded;

  // A cont can be dropped here unless it is already mapped to THIS category.
  const dragActive = contDrag?.draggingCont != null;
  const contIsHere = accountsByCategory
    .get(node.id)
    ?.some((a) => a.cont === contDrag?.draggingCont) === true;
  const canAcceptDrop = dragActive && !contIsHere;
  // The subgroup the dragged cont currently lives in is explicitly excluded as
  // a target — dim it so the only live target reads as the rest of the surface.
  const isExcludedTarget = dragActive && contIsHere && depth > 0;

  return (
    <li
      className={`${containerStyle} transition-colors ${
        dropActive && canAcceptDrop ? "ring-2 ring-primary bg-primary/10" : ""
      } ${
        isExcludedTarget
          ? "opacity-60 outline-dashed outline-1 outline-dark-3 !bg-dark-2 cursor-not-allowed"
          : ""
      }`}
      onDragOver={(e) => {
        if (!dragActive) return;
        // The cont's own category consumes the gesture as a no-op (so a drop
        // back on itself does NOT bubble up and accidentally move it out), but
        // shows a "no-drop" cursor and never the green target highlight.
        if (isExcludedTarget || contIsHere) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "none";
          return;
        }
        if (!canAcceptDrop) return;
        e.preventDefault();
        e.stopPropagation(); // innermost category wins over ancestors
        e.dataTransfer.dropEffect = "move";
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(e) => {
        // Ignore moves between descendants; only clear when leaving the card.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropActive(false);
      }}
      onDrop={(e) => {
        if (!dragActive) return;
        // Dropping on the cont's own category is a no-op: consume it so it
        // never bubbles to an ancestor and silently moves the cont.
        if (isExcludedTarget || contIsHere) {
          e.preventDefault();
          e.stopPropagation();
          setDropActive(false);
          return;
        }
        if (!canAcceptDrop) return;
        const cont = e.dataTransfer.getData(CONT_DND_MIME);
        if (cont && contDrag) {
          e.preventDefault();
          e.stopPropagation();
          setDropActive(false);
          setExpanded(true); // reveal the cont in its new home immediately
          contDrag.dropOnCategory(cont, node.id);
        }
      }}
    >
      <div className="flex items-center gap-2 group rounded-md">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-gray hover:text-gray-light shrink-0 -ml-0.5"
          aria-label={isExpanded ? "Pliaza" : "Desfasoara"}
          disabled={!hasContent}
        >
          {hasContent ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="inline-block w-3" />
          )}
        </button>

        {renaming ? (
          <RenameCategoryInline
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
            <button
              type="button"
              onClick={() => hasContent && setExpanded((v) => !v)}
              disabled={!hasContent}
              className={`flex flex-1 items-center gap-2 min-w-0 text-left ${
                hasContent ? "cursor-pointer" : "cursor-default"
              }`}
              aria-label={
                hasContent
                  ? isExpanded
                    ? `Pliaza ${node.name}`
                    : `Desfasoara ${node.name}`
                  : node.name
              }
            >
              {depth > 0 && (
                <FolderTree size={13} className="text-primary/70 shrink-0" aria-hidden />
              )}
              <span
                className={`truncate ${depth === 0 ? "text-[13px] font-semibold text-white" : "text-[12px] font-medium text-gray-light"}`}
                style={{ letterSpacing: "-0.04em" }}
                title={node.name}
              >
                {node.name}
              </span>
            </button>
            {depth > 0 && (
              <span
                className="font-mono text-[9px] uppercase tracking-wider text-primary/70 border border-primary/30 rounded px-1 py-0.5 shrink-0"
                style={{ letterSpacing: "0.04em" }}
              >
                sub-linie
              </span>
            )}
            {node.isOmfpDefault && (
              <Tooltip content="Linie de cost generata automat la prima vizita din planul de conturi standard OMFP. Poti redenumi sau sterge fara probleme.">
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray shrink-0 cursor-help">
                  OMFP
                </span>
              </Tooltip>
            )}
            <span className="font-mono text-[10px] text-gray tabular-nums shrink-0">
              {directAccounts.length > 0 && `${directAccounts.length} ${directAccounts.length === 1 ? "cont" : "conturi"}`}
              {directAccounts.length > 0 && totalRulaj !== 0 && " · "}
              {totalRulaj !== 0 && `${formatRon(totalRulaj)} lei`}
            </span>
            <CategorySplitControl node={node} />
            <CategoryResidueMarker node={node} />
            <div className="flex items-center gap-0.5 shrink-0">
              {depth === 0 && (
                <Tooltip content="Adauga sub-linie de cost. Apare indentata sub aceasta pe /firma.">
                  <button
                    type="button"
                    onClick={() => setAddingSubcategory(true)}
                    className="p-1.5 text-gray hover:text-primary"
                    aria-label="Adauga sub-linie de cost"
                  >
                    <FolderPlus size={14} />
                  </button>
                </Tooltip>
              )}
              <Tooltip content="Adauga un cont la aceasta linie de cost.">
                <button
                  type="button"
                  onClick={() => setAddingAccount(true)}
                  className="p-1.5 text-gray hover:text-primary"
                  aria-label="Adauga cont"
                >
                  <Plus size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Redenumeste linia de cost.">
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="p-1.5 text-gray hover:text-primary"
                >
                  <Pencil size={14} />
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

      {isExpanded && (
        <div className="mt-2 space-y-1.5">
          {addingAccount && (
            <AddAccountToCategory
              category={node}
              accounts={accounts}
              clientId={clientId}
              onDone={() => {
                setAddingAccount(false);
                onMutate();
              }}
              onCancel={() => setAddingAccount(false)}
            />
          )}

          {directAccounts.length > 0 && (
            <ul className="space-y-1">
              {directAccounts.map((a) => (
                <AccountRow
                  key={a.cont}
                  account={a}
                  tree={tree}
                  clientId={clientId}
                  onMutate={onMutate}
                />
              ))}
            </ul>
          )}

          {addingSubcategory && (
            <div className="ml-3 mt-2">
              <NewCategoryInline
                clientId={clientId}
                parentId={node.id}
                kind={node.kind}
                onDone={() => {
                  setAddingSubcategory(false);
                  onMutate();
                }}
                onCancel={() => setAddingSubcategory(false)}
              />
            </div>
          )}

          {node.children.length > 0 && (
            <ul className="space-y-1.5">
              {node.children.map((child) => (
                <CategoryNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  accountsByCategory={accountsByCategory}
                  aggregatedRulaj={aggregatedRulaj}
                  query={query}
                  tree={tree}
                  accounts={accounts}
                  clientId={clientId}
                  onMutate={onMutate}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                       LINII DE BUSINESS — CASCADA                          */
/* -------------------------------------------------------------------------- */

/** Stable color per vertical, keyed by its position among the real (non-
 *  default) verticals. Matches the palette used in the allocation dialog so a
 *  vertical looks the same everywhere it appears. */
const SPLIT_DOT_COLORS = [
  "bg-primary",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
] as const;

function buildVerticalColorMap(verticals: VerticalView[]): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const v of verticals) {
    if (v.isDefault) continue;
    map.set(v.id, SPLIT_DOT_COLORS[i % SPLIT_DOT_COLORS.length]);
    i += 1;
  }
  return map;
}

/** Inline colored chips for a split: "● 40% Outsourcing  ● 60% Recruitment".
 *  Pure presentational — used on the firm band, category headers and conts. */
function SplitChips({
  splits,
  verticals,
  size = "sm",
}: {
  splits: AllocationSplit[];
  verticals: VerticalView[];
  size?: "sm" | "xs";
}) {
  const colors = buildVerticalColorMap(verticals);
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {splits.map((s) => {
        const v = verticals.find((x) => x.id === s.verticalId);
        return (
          <span
            key={s.verticalId}
            className={`inline-flex items-center gap-1.5 font-mono ${text} tabular-nums text-gray-light`}
            style={{ letterSpacing: "-0.02em" }}
          >
            <span
              className={`inline-block h-2 w-2 rounded-sm shrink-0 ${
                colors.get(s.verticalId) ?? "bg-gray/40"
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

/**
 * Top of the cascade. A calm band above the categories showing how the whole
 * firm splits across lines of business by default — what every category, cont
 * and partener inherits unless it has its own rule. Click to edit.
 */
function FirmSplitBand({
  firmDefaultSplits,
  verticals,
  onEdit,
}: {
  firmDefaultSplits: AllocationSplit[] | null;
  verticals: VerticalView[];
  onEdit: () => void;
}) {
  const hasSplit = firmDefaultSplits !== null && firmDefaultSplits.length > 0;
  return (
    <div
      data-testid="firm-split-band"
      className="rounded-lg border border-dark-3 bg-dark-3/20 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
    >
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Impartirea firmei
        </span>
        <Tooltip content="Impartirea implicita pe linii de business. Tot ce nu are o regula proprie (linie de cost, cont sau partener) o mosteneste automat. O singura regula, aplicata live in fiecare luna.">
          <span className="font-mono text-[9px] text-gray cursor-help">?</span>
        </Tooltip>
      </div>

      <div className="flex-1 min-w-[180px]">
        {hasSplit ? (
          <SplitChips splits={firmDefaultSplits} verticals={verticals} />
        ) : (
          <span
            className="text-[11px] text-gray italic"
            style={{ letterSpacing: "-0.02em" }}
          >
            Neimpartita. Totul merge pe &quot;Toata firma&quot; pana setezi o
            impartire.
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-dark-3 px-3 py-1.5 text-[12px] font-medium text-gray-light hover:text-white hover:border-gray transition-colors"
        style={{ letterSpacing: "-0.02em" }}
      >
        {hasSplit ? (
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
  );
}

/**
 * Per-category line-of-business control on the category header. The PRIMARY
 * editing unit of the cascade: set "Marfa → 40/60" here and every cont +
 * partener under the category inherits it. Shows three states:
 *   - own split        → colored chips (click to edit)
 *   - inherits firm    → subtle "↳ firma X/Y" (click to override)
 *   - inherits default → subtle "↳ Toata firma" (click to set a split)
 */
function CategorySplitControl({ node }: { node: CostCategoryNode }) {
  const residue = useResidue();
  if (!residue || residue.verticals.length === 0) return null;

  const allocation = residue.categoryAllocations.get(node.id);
  const own = allocation && allocation.splits.length > 0 ? allocation.splits : null;
  const firm = residue.firmDefaultSplits;

  const open = () => residue.openCategoryAllocation(node);

  if (own) {
    return (
      <Tooltip content="Impartirea pe linii de business a acestei linii de cost. Se aplica tuturor conturilor si partenerilor din ea. Click pentru a edita.">
        <button
          type="button"
          data-testid={`category-split-${node.id}`}
          onClick={open}
          className="shrink-0 inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 hover:bg-primary/20 transition-colors"
        >
          <SplitChips splits={own} verticals={residue.verticals} size="xs" />
          <Pencil size={10} className="text-primary-light shrink-0" />
        </button>
      </Tooltip>
    );
  }

  // Inherited — subtle, invites an override.
  const inheritsLabel = firm && firm.length > 0 ? "mosteneste firma" : "Toata firma";
  return (
    <Tooltip
      content={
        firm && firm.length > 0
          ? "Aceasta linie de cost mosteneste impartirea firmei. Click ca sa-i dai o impartire proprie."
          : "Aceasta linie de cost merge integral pe \"Toata firma\". Click ca sa o imparti pe linii de business."
      }
    >
      <button
        type="button"
        data-testid={`category-split-${node.id}`}
        onClick={open}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-dashed border-dark-3 px-2 py-0.5 font-mono text-[10px] text-gray hover:text-gray-light hover:border-gray transition-colors"
        style={{ letterSpacing: "-0.02em" }}
      >
        <CornerDownLeft size={10} aria-hidden />
        {inheritsLabel}
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*                            RESIDUE MARKERS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Tiny marker shown on a cont row whenever partner overrides redirect some
 * of its rulaj to other categories. Visual: subtle gray "↗ X lei" with a
 * tooltip explaining that the cont's horizontal applies only to the
 * REMAINING rulaj.
 *
 * Returns null when there's no override activity, so the row stays as clean
 * as before for the 90% of conts where this is irrelevant.
 */
function ContResidueMarker({
  account,
  grossRulaj,
}: {
  account: AccountListItem;
  grossRulaj: number;
}) {
  const redirected = account.partnerOverriddenRulaj;
  if (redirected <= 0) return null;
  const residual = grossRulaj - redirected;
  const tooltip = (
    <>
      Acest cont are <strong>{formatRon(redirected)} lei</strong> redirectati
      la alte linii de cost prin exceptii de partener. Orizontala contului se
      aplica doar pe reziduul de <strong>{formatRon(residual)} lei</strong>.
    </>
  );
  return (
    <Tooltip content={tooltip}>
      <span
        data-testid={`cont-residue-marker-${account.cont}`}
        className="shrink-0 inline-flex items-center gap-0.5 font-mono text-[10px] text-gray tabular-nums cursor-help"
        style={{ letterSpacing: "-0.02em" }}
      >
        <CornerUpRight size={11} aria-hidden />
        {formatRon(redirected)} lei
      </span>
    </Tooltip>
  );
}

/**
 * Marker shown on a category row that RECEIVES partner-override residue.
 * Visual: subtle primary-tinted "↙ X lei" with a tooltip that also acts as
 * a CTA when the category has no horizontal allocation set ("Seteaza
 * orizontala categoriei pentru a controla unde se duc banii").
 *
 * Clicks open the EditCategoryAllocationDialog through the residue context.
 * Returns null when the category receives nothing this period.
 */
function CategoryResidueMarker({
  node,
}: {
  node: CostCategoryNode;
}) {
  const residue = useResidue();
  if (!residue) return null;
  const inflow = residue.inflowByCategoryId.get(node.id);
  if (!inflow || inflow.amount <= 0) return null;

  const allocation = residue.categoryAllocations.get(node.id);
  const hasAllocation = allocation !== undefined && allocation.splits.length > 0;
  const verticalsAvailable = residue.verticals.length > 0;
  const canEdit = verticalsAvailable; // even without allocation, opening lets user create one

  // Build a friendly distribution sentence for the tooltip.
  const distributionLine = (() => {
    if (!verticalsAvailable) {
      return "Activeaza Liniile de business ca sa controlezi unde merg acesti bani.";
    }
    if (hasAllocation) {
      const pieces = allocation!.splits
        .map((s) => {
          const v = residue.verticals.find((x) => x.id === s.verticalId);
          return `${s.percent}% ${v?.name ?? "?"}`;
        })
        .join(" · ");
      return `Se distribuie: ${pieces}.`;
    }
    const def = residue.verticals.find((v) => v.isDefault);
    return `Merg la ${def?.name ?? "verticala implicita"}. Click pentru a seta orizontala liniei de cost.`;
  })();

  const topSources = inflow.sources.slice(0, 3);
  const tooltip = (
    <>
      <div>
        Aceasta linie de cost primeste <strong>{formatRon(inflow.amount)} lei</strong>{" "}
        din exceptii de partener.
      </div>
      {topSources.length > 0 && (
        <div className="mt-1 text-[10px] opacity-80">
          Provine din:{" "}
          {topSources.map((s, i) => (
            <span key={s.cont}>
              {i > 0 && ", "}
              cont {s.cont} ({formatRon(s.amount)} lei)
            </span>
          ))}
          {inflow.sources.length > topSources.length &&
            ` si inca ${inflow.sources.length - topSources.length}`}
          .
        </div>
      )}
      <div className="mt-1">{distributionLine}</div>
    </>
  );

  const ariaLabel = `Reziduu primit: ${formatRon(inflow.amount)} lei`;

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        data-testid={`category-residue-marker-${node.id}`}
        onClick={canEdit ? () => residue.openCategoryAllocation(node) : undefined}
        disabled={!canEdit}
        aria-label={ariaLabel}
        className={`shrink-0 inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums rounded px-1 -mx-1 transition-colors ${
          canEdit
            ? "text-primary-light hover:bg-primary/15 cursor-pointer"
            : "text-primary-light/60 cursor-help"
        }`}
        style={{ letterSpacing: "-0.02em" }}
      >
        <CornerDownLeft size={11} aria-hidden />
        {formatRon(inflow.amount)} lei
      </button>
    </Tooltip>
  );
}

/**
 * Per-cont line-of-business indicator. Shows the split the cont ACTUALLY
 * resolves to through the cascade and where it came from:
 *   - own rule          → primary pill with percents (most specific)
 *   - inherited (cat/firm) with a real split → muted dashed pill "↳ 60/40"
 *   - default (Toata firma) → a quiet "+ linii" affordance on row hover
 * Click always opens the cont-level override dialog.
 */
function ContSplitBadge({
  account,
  onEdit,
}: {
  account: AccountListItem;
  onEdit: () => void;
}) {
  const residue = useResidue();
  if (!residue || residue.verticals.length === 0) return null;

  const { splits, source } = account.effectiveAllocation;
  const colors = buildVerticalColorMap(residue.verticals);

  // No meaningful split → quiet hover affordance to create an override.
  if (source === "default" || splits.length === 0) {
    return (
      <Tooltip content="Acest cont merge pe &quot;Toata firma&quot;. Click ca sa-l imparti pe linii de business doar pentru el.">
        <button
          type="button"
          data-testid={`cont-split-${account.cont}`}
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-dashed border-dark-3 px-1.5 py-0.5 font-mono text-[10px] text-gray opacity-0 group-hover:opacity-100 hover:text-gray-light hover:border-gray transition-all"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Plus size={10} /> linii
        </button>
      </Tooltip>
    );
  }

  const isOwn = source === "own";
  const percents = splits.map((s) => s.percent).join("/");
  const fullNames = splits
    .map((s) => {
      const v = residue.verticals.find((x) => x.id === s.verticalId);
      return `${s.percent}% ${v?.name ?? "?"}`;
    })
    .join(" · ");
  const sourceLabel = isOwn
    ? "Regula proprie a contului."
    : source === "category"
    ? "Mosteneste impartirea liniei de cost."
    : "Mosteneste impartirea firmei.";

  return (
    <Tooltip
      content={
        <>
          <div>{fullNames}</div>
          <div className="mt-1 opacity-80">
            {sourceLabel} Click pentru o regula proprie.
          </div>
        </>
      }
    >
      <button
        type="button"
        data-testid={`cont-split-${account.cont}`}
        data-source={source}
        onClick={onEdit}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors ${
          isOwn
            ? "border border-primary/40 bg-primary/10 text-primary-light hover:bg-primary/20"
            : "border border-dashed border-dark-3 text-gray hover:text-gray-light hover:border-gray"
        }`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {!isOwn && <CornerDownLeft size={10} aria-hidden />}
        <span className="inline-flex items-center gap-0.5">
          {splits.map((s) => (
            <span
              key={s.verticalId}
              className={`inline-block h-2 w-2 rounded-sm ${
                colors.get(s.verticalId) ?? "bg-gray/40"
              }`}
              aria-hidden
            />
          ))}
        </span>
        {percents}
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ACCOUNT ROW                                   */
/* -------------------------------------------------------------------------- */

function AccountRow({
  account,
  tree,
  clientId,
  onMutate,
  compact = false,
}: {
  account: AccountListItem;
  tree: CostCategoryNode[];
  clientId: string;
  onMutate: () => void;
  compact?: boolean;
}) {
  const [moving, setMoving] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(false);
  const [pending, startTransition] = useTransition();
  const residue = useResidue();
  const partnerPanel = usePartnerPanel();
  const contDrag = useContDrag();
  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;
  const showPartnersBadge =
    partnerPanel !== null &&
    (residue?.verticals.length ?? 0) > 0 &&
    account.partnerCount >= MIN_PARTNERS_FOR_BADGE;

  function unmap() {
    if (
      !confirm(
        `Scot ${account.cont} din linia de cost? Va aparea pe /firma intr-o linie de cost generica.`
      )
    )
      return;
    startTransition(async () => {
      await unmapAccountAction({
        clientId,
        cont: account.cont,
      });
      onMutate();
    });
  }

  if (moving) {
    return (
      <li className="bg-dark-3/30 rounded-md px-2 py-1.5">
        <MoveAccountInline
          account={account}
          tree={tree}
          clientId={clientId}
          onDone={() => {
            setMoving(false);
            onMutate();
          }}
          onCancel={() => setMoving(false)}
        />
      </li>
    );
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(CONT_DND_MIME, account.cont);
        e.dataTransfer.effectAllowed = "move";
        contDrag?.setDraggingCont(account.cont);
      }}
      onDragEnd={() => contDrag?.setDraggingCont(null)}
      data-just-moved={contDrag?.recentlyMovedCont === account.cont ? "true" : undefined}
      className={`group flex items-center gap-2 cursor-grab active:cursor-grabbing ${
        compact ? "py-0.5" : "px-2 py-1 rounded hover:bg-dark-3/30"
      } ${contDrag?.draggingCont === account.cont ? "opacity-40" : ""} ${
        contDrag?.recentlyMovedCont === account.cont
          ? "animate-cont-moved ring-1 ring-primary/50"
          : ""
      }`}
    >
      {contDrag?.recentlyMovedCont === account.cont && (
        <span
          className="shrink-0 inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 font-mono text-[9px] uppercase tracking-wider text-primary"
          style={{ letterSpacing: "0.04em" }}
        >
          <Check size={9} /> mutat
        </span>
      )}
      <span className="font-mono text-[11px] text-gray tabular-nums shrink-0 min-w-[60px]">
        {account.cont}
      </span>
      <span
        className="flex-1 min-w-0 text-[12px] text-gray-light truncate"
        style={{ letterSpacing: "-0.02em" }}
        title={account.denumire}
      >
        {account.denumire}
      </span>
      <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
        {formatRon(rulaj)} lei
      </span>
      {!compact && <ContSplitBadge account={account} onEdit={() => setEditingAlloc(true)} />}
      {!compact && showPartnersBadge && (
        <Tooltip
          content={
            account.partnerLobOverrideCount > 0
              ? `${account.partnerCount} parteneri pe acest cont. ${account.partnerLobOverrideCount} ${
                  account.partnerLobOverrideCount === 1 ? "are exceptie" : "au exceptie"
                }, se imparte diferit de cont. Click ca sa vezi.`
              : `${account.partnerCount} parteneri pe acest cont. Click ca sa le dai linia de business individual sau in bloc.`
          }
        >
          <button
            type="button"
            onClick={() => partnerPanel!.open(account)}
            disabled={pending}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-dark-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray hover:text-gray-light hover:border-gray transition-colors"
            style={{ letterSpacing: "-0.02em" }}
          >
            <Users size={10} />
            {account.partnerCount}
            {account.partnerLobOverrideCount > 0 && (
              <span
                className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-light"
                aria-hidden
                title="Are parteneri cu exceptie"
              />
            )}
          </button>
        </Tooltip>
      )}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
        <Tooltip content="Muta acest cont la alta linie de cost.">
          <button
            type="button"
            onClick={() => setMoving(true)}
            disabled={pending}
            className="p-1.5 text-gray hover:text-primary"
          >
            <ArrowRightLeft size={14} />
          </button>
        </Tooltip>
        {account.currentMapping && (
          <Tooltip content="Scoate contul din linia de cost. Revine la 'fara linie de cost'.">
            <button
              type="button"
              onClick={unmap}
              disabled={pending}
              className="p-1.5 text-gray hover:text-neg"
            >
              <X size={14} />
            </button>
          </Tooltip>
        )}
      </div>

      {editingAlloc && residue && (
        <EditAllocationDialog
          open
          account={account}
          verticals={residue.verticals}
          clientId={residue.clientId}
          onClose={() => setEditingAlloc(false)}
          onSaved={() => {
            setEditingAlloc(false);
            residue.onMutate();
          }}
        />
      )}
    </li>
  );
}

/** A cont with a single partener has no exception story — the cont-mapping
 *  alone fully expresses where the money goes. Starting at 2 partners, one
 *  of them might belong somewhere else, and that's exactly what the panel
 *  is for. Lowered from 3 → 2 after measuring real distribution (Nov 2026):
 *  ~14% of conts have exactly 2 partners and that's where most accidental
 *  mis-classifications hide. */
const MIN_PARTNERS_FOR_BADGE = 2;

/* -------------------------------------------------------------------------- */
/*                          ADD / MOVE / RENAME INLINE                        */
/* -------------------------------------------------------------------------- */

function NewCategoryInline({
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      onCancel();
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createCategoryAction({
        clientId,
        parentId,
        kind,
        name: trimmed,
      });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Numele liniei de cost (cum apare pe /firma)"
        disabled={pending}
        className="flex-1"
      />
      <Button onClick={submit} disabled={pending || !name.trim()}>
        Adauga
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Renunta
      </Button>
      {error && <p className="text-[11px] text-neg">{error}</p>}
    </div>
  );
}

function RenameCategoryInline({
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
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === node.name) {
      onCancel();
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await renameCategoryAction({
        clientId,
        categoryId: node.id,
        name: trimmed,
      });
      if (r.error) setError(r.error);
      else onDone();
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
        disabled={pending}
        className="flex-1"
      />
      <Button onClick={submit} disabled={pending || !name.trim()}>
        Salveaza
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Renunta
      </Button>
      {error && <p className="text-[11px] text-neg">{error}</p>}
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
  const [open, setOpen] = useState(false);
  const isSubgroup = node.parentId !== null;

  return (
    <>
      <Tooltip
        content={
          isSubgroup
            ? "Sterge sub-linia de cost. Conturile ei se muta in linia de cost parinte."
            : "Sterge linia de cost. Conturile ei raman fara linie de cost."
        }
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1.5 text-gray hover:text-neg"
          aria-label="Sterge linia de cost"
        >
          <Trash2 size={14} />
        </button>
      </Tooltip>
      <DeleteCategoryModal
        open={open}
        node={node}
        clientId={clientId}
        onClose={() => setOpen(false)}
        onDeleted={() => {
          setOpen(false);
          onDone();
        }}
      />
    </>
  );
}

function DeleteCategoryModal({
  open,
  node,
  clientId,
  onClose,
  onDeleted,
}: {
  open: boolean;
  node: CostCategoryNode;
  clientId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const residue = useResidue();

  useEscapeKey(onClose, open);

  if (!open) return null;

  const isSubgroup = node.parentId !== null;
  const hasChildren = node.children.length > 0;
  const contCount = node.mappingCount;

  function handleDelete() {
    // Instant: hide + reparent locally, persist in the background.
    residue?.deleteCategory(node);
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-dark-3 bg-dark-2 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray hover:text-white transition-colors"
          aria-label="Inchide"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <Trash2 size={18} className="text-danger" />
          </div>
          <h2
            className="text-lg font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {isSubgroup ? "Sterge sub-linia de cost" : "Sterge linia de cost"}
          </h2>
        </div>

        <p className="mb-4 text-sm text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          Stergi {isSubgroup ? "sub-linia de cost" : "linia de cost"}{" "}
          <strong className="text-white">{node.name}</strong>?
        </p>

        {contCount > 0 && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              {isSubgroup ? (
                <>
                  Cele{" "}
                  <strong className="text-white">
                    {contCount} {contCount === 1 ? "cont" : "conturi"}
                  </strong>{" "}
                  din ea se vor muta automat in linia de cost parinte. Nu se pierde
                  nimic.
                </>
              ) : (
                <>
                  Cele{" "}
                  <strong className="text-white">
                    {contCount} {contCount === 1 ? "cont" : "conturi"}
                  </strong>{" "}
                  din ea vor ramane fara linie de cost (le poti reasigna oricand).
                </>
              )}
            </p>
          </div>
        )}

        {hasChildren && (
          <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3">
            <p className="text-sm text-danger" style={{ letterSpacing: "-0.02em" }}>
              Aceasta linie de cost are sub-linii. Sterge-le intai.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Renunta
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={hasChildren}>
            Sterge
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddAccountToCategory({
  category,
  accounts,
  clientId,
  onDone,
  onCancel,
}: {
  category: CostCategoryNode;
  accounts: AccountListItem[];
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [selectedCont, setSelectedCont] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Valid options: same kind as the category, not already mapped to this
  // exact category. Accounts mapped elsewhere are still allowed (this is
  // a remap operation) but we mark them so the contabil knows.
  const options = useMemo(() => {
    return accounts
      .filter((a) => a.kind === category.kind)
      .filter((a) => a.currentMapping?.categoryId !== category.id)
      .map((a) => ({
        value: a.cont,
        label:
          a.currentMapping !== null
            ? `${a.cont} · ${a.denumire} (mutat de la alta linie de cost)`
            : `${a.cont} · ${a.denumire}`,
      }));
  }, [accounts, category]);

  function submit() {
    if (!selectedCont) {
      onCancel();
      return;
    }
    setError(null);
    const account = accounts.find((a) => a.cont === selectedCont);
    if (!account) return;
    startTransition(async () => {
      const r = await mapAccountAction({
        clientId,
        cont: account.cont,
        scope: account.cont !== account.contBase ? "analytic" : "contBase",
        categoryId: category.id,
      });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-md p-2 space-y-2">
      <p
        className="text-[11px] text-gray italic"
        style={{ letterSpacing: "-0.02em" }}
      >
        Alege un cont {category.kind === "expense" ? "de cheltuieli (6xx)" : "de venituri (7xx)"} ca sa-l asezi in "{category.name}".
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedCont}
            onChange={setSelectedCont}
            placeholder="Alege contul..."
            options={options}
          />
        </div>
        <Button onClick={submit} disabled={pending || !selectedCont}>
          Aseaza aici
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Renunta
        </Button>
      </div>
      {error && <p className="text-[11px] text-neg">{error}</p>}
    </div>
  );
}

function MoveAccountInline({
  account,
  tree,
  clientId,
  onDone,
  onCancel,
}: {
  account: AccountListItem;
  tree: CostCategoryNode[];
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Flatten tree of the right kind into a picker, sub-categories prefixed
  // with their parent so the contabil sees the full path.
  const options = useMemo(() => {
    const result: { value: string; label: string }[] = [];
    function walk(nodes: CostCategoryNode[], prefix: string) {
      for (const n of nodes) {
        if (n.kind !== account.kind) continue;
        const label = prefix ? `${prefix} › ${n.name}` : n.name;
        // The cont's current category is not a valid move target, but its
        // children still are — so we omit only this option and keep walking
        // into the subtree (otherwise moving a cont from a parent down into
        // one of its own subgroups would be impossible).
        if (n.id !== account.currentMapping?.categoryId) {
          result.push({ value: n.id, label });
        }
        if (n.children.length > 0) walk(n.children, label);
      }
    }
    walk(tree, "");
    return result;
  }, [tree, account]);

  function submit() {
    if (!targetId) {
      onCancel();
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await mapAccountAction({
        clientId,
        cont: account.cont,
        scope: account.cont !== account.contBase ? "analytic" : "contBase",
        categoryId: targetId,
      });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0">
        {account.cont}
      </span>
      <span
        className="text-[12px] text-gray shrink-0"
        style={{ letterSpacing: "-0.02em" }}
      >
        muta la:
      </span>
      <div className="flex-1">
        <Select
          value={targetId}
          onChange={setTargetId}
          placeholder="Alege linia de cost..."
          options={options}
        />
      </div>
      <Button onClick={submit} disabled={pending || !targetId}>
        Muta
      </Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>
        Renunta
      </Button>
      {error && <p className="text-[11px] text-neg">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                    */
/* -------------------------------------------------------------------------- */

function buildAccountsByCategory(
  accounts: AccountListItem[]
): Map<string, AccountListItem[]> {
  const m = new Map<string, AccountListItem[]>();
  for (const a of accounts) {
    if (a.currentMapping === null) continue;
    const id = a.currentMapping.categoryId;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(a);
  }
  return m;
}

function buildAggregatedRulaj(
  tree: CostCategoryNode[],
  accountsByCategory: Map<string, AccountListItem[]>
): Map<string, number> {
  const m = new Map<string, number>();
  function walk(node: CostCategoryNode): number {
    const direct = (accountsByCategory.get(node.id) ?? []).reduce(
      (s, a) => s + (a.kind === "expense" ? a.rulajD : a.rulajC),
      0
    );
    const childrenSum = node.children.reduce((s, c) => s + walk(c), 0);
    const total = direct + childrenSum;
    m.set(node.id, total);
    return total;
  }
  for (const root of tree) walk(root);
  return m;
}

/**
 * Compute per-categoryId inflow totals, rolled up through descendants. So a
 * parent category's marker reflects its OWN direct inflow plus everything
 * funneling into its children. The rolled-up sources list is the union of
 * all per-cont sources across the sub-tree, summed by cont.
 *
 * Pure — exported indirectly through useMemo. Easy to unit-test in isolation
 * if we ever extract it.
 */
function rollUpInflows(
  tree: CostCategoryNode[],
  directByCategoryId: Record<string, CategoryInflow>
): Map<string, CategoryInflow> {
  const out = new Map<string, CategoryInflow>();

  function walk(node: CostCategoryNode): CategoryInflow {
    const direct = directByCategoryId[node.id];
    const combined: CategoryInflow = {
      amount: direct?.amount ?? 0,
      sources: direct ? [...direct.sources] : [],
    };
    for (const child of node.children) {
      const childRolled = walk(child);
      if (childRolled.amount === 0) continue;
      combined.amount = round2(combined.amount + childRolled.amount);
      for (const src of childRolled.sources) {
        const existing = combined.sources.find((s) => s.cont === src.cont);
        if (existing) {
          existing.amount = round2(existing.amount + src.amount);
        } else {
          combined.sources.push({ ...src });
        }
      }
    }
    combined.sources.sort((a, b) => b.amount - a.amount);
    if (combined.amount > 0) out.set(node.id, combined);
    return combined;
  }
  for (const root of tree) walk(root);
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function matchesQuery(
  node: CostCategoryNode,
  accountsByCategory: Map<string, AccountListItem[]>,
  query: string
): boolean {
  if (stripDiacritics(node.name.toLowerCase()).includes(query)) return true;
  const accounts = accountsByCategory.get(node.id) ?? [];
  if (
    accounts.some((a) =>
      stripDiacritics(
        `${a.cont} ${a.contBase} ${a.denumire}`.toLowerCase()
      ).includes(query)
    )
  )
    return true;
  return node.children.some((c) => matchesQuery(c, accountsByCategory, query));
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const RON = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
