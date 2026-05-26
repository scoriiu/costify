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

import { useState, useTransition, useMemo, useEffect, createContext, useContext } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, ArrowRightLeft, X, Users, CornerUpRight, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { VerticalView, CategoryAllocationView } from "@/modules/verticals";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  mapAccountAction,
  unmapAccountAction,
} from "@/modules/categories/actions";
import { CategoryTreemap } from "./category-treemap";
import { PartnerPanel } from "./partner-panel";
import { EditCategoryAllocationDialog } from "./edit-allocation-dialog";

type Filter = "all" | "unmapped" | "expense" | "revenue";

interface Props {
  tree: CostCategoryNode[];
  accounts: AccountListItem[];
  clientId: string;
  period: { year: number; month: number } | null;
  onMutate: () => void;
  /** Verticals for this firm — drives the category-allocation dialog. Empty
   *  array when verticalsEnabled = false; in that case markers/CTAs hide. */
  verticals?: VerticalView[];
  /** Per-categoryId vertical allocations. Drives the marker tooltip's
   *  "100% Outsourcing" line and pre-populates the dialog. */
  categoryAllocations?: CategoryAllocationView[];
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
 * Context for the partner-panel open trigger. Avoids drilling
 * `onOpenPartnerPanel` through CategoryGroup → CategoryRow → nested
 * CategoryRow → AccountRow. Any AccountRow inside CategoryWorkspace can
 * open the panel for its own cont without the intermediaries knowing.
 */
const PartnerPanelContext = createContext<{
  open: (account: AccountListItem) => void;
} | null>(null);

function usePartnerPanel() {
  return useContext(PartnerPanelContext);
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
}

const ResidueContext = createContext<ResidueContextValue | null>(null);
function useResidue() {
  return useContext(ResidueContext);
}

type ViewMode = "list" | "treemap";

export function CategoryWorkspace({
  tree,
  accounts,
  clientId,
  period,
  onMutate,
  verticals = [],
  categoryAllocations = [],
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
  const [panelAccount, setPanelAccount] = useState<AccountListItem | null>(null);
  const [editingCategoryAlloc, setEditingCategoryAlloc] =
    useState<CostCategoryNode | null>(null);

  // External drill-in: when the parent passes `initialPanelContBase`, find
  // the matching AccountListItem and open the panel for it. We pick the
  // first account whose contBase matches — analytics under the same base
  // share the partner list so any one of them is a valid anchor. After
  // opening we notify the parent so it can reset the prop (next click on
  // the same contBase re-fires this).
  useEffect(() => {
    if (!initialPanelContBase) return;
    const match = accounts.find((a) => a.contBase === initialPanelContBase);
    if (match) setPanelAccount(match);
    onInitialPanelOpened?.();
    // We intentionally re-run only on contBase changes — opening the panel
    // is a one-shot side-effect, not a render-tied invariant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPanelContBase]);

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
    }),
    [verticals, categoryAllocationsById, inflowByCategoryId]
  );

  // Lookup map: categoryId -> human display name. Used to label the panel's
  // "Default contului (X)" option so the contabil sees exactly which category
  // a partner's default would map to.
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
  const panelContCategoryName = panelAccount?.currentMapping
    ? categoryNameById.get(panelAccount.currentMapping.categoryId) ?? null
    : null;

  // Build per-category mapping index so each row knows which accounts it owns
  // and roots can compute their aggregated rulaj including descendants.
  const accountsByCategory = useMemo(
    () => buildAccountsByCategory(accounts),
    [accounts]
  );
  const aggregatedRulaj = useMemo(
    () => buildAggregatedRulaj(tree, accountsByCategory),
    [tree, accountsByCategory]
  );

  const unmappedAccounts = accounts.filter((a) => a.currentMapping === null);
  const expenseRoots = tree.filter((n) => n.kind === "expense");
  const revenueRoots = tree.filter((n) => n.kind === "revenue");

  if (view === "treemap") {
    return (
      <div className="space-y-5">
        <ViewToggle view={view} onChange={setView} />
        <CategoryTreemap
          tree={tree}
          accountsByCategory={accountsByCategory}
          aggregatedRulaj={aggregatedRulaj}
        />
      </div>
    );
  }

  return (
    <PartnerPanelContext.Provider value={{ open: setPanelAccount }}>
     <ResidueContext.Provider value={residueValue}>
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-5">
        <WorkspaceHeader
          totalAccounts={accounts.length}
          unmappedCount={unmappedAccounts.length}
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          view={view}
          onViewChange={setView}
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

        <PartnerPanel
          account={panelAccount}
          clientId={clientId}
          period={period}
          tree={tree}
          contCategoryName={panelContCategoryName}
          onClose={() => setPanelAccount(null)}
          onMutate={onMutate}
        />

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
     </ResidueContext.Provider>
    </PartnerPanelContext.Provider>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex justify-end">
      <ToggleGroup<ViewMode>
        value={view}
        onChange={onChange}
        options={[
          { value: "list", label: "Lista" },
          { value: "treemap", label: "Harta" },
        ]}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 HEADER                                     */
/* -------------------------------------------------------------------------- */

function WorkspaceHeader({
  totalAccounts,
  unmappedCount,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  view,
  onViewChange,
}: {
  totalAccounts: number;
  unmappedCount: number;
  query: string;
  onQueryChange: (v: string) => void;
  filter: Filter;
  onFilterChange: (v: Filter) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-[15px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Conturile firmei pe grupuri patron
          </h3>
          <p
            className="text-[11px] text-gray mt-0.5 max-w-2xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Fiecare grup arata cum apare pe pagina patronului ({"/firma"}).
            Conturile sunt indentate sub grupul lor. Adauga, redenumeste sau
            muta direct de aici.
            {unmappedCount > 0 && (
              <>
                {" "}
                <span className="text-neg">
                  {unmappedCount === 1
                    ? "1 cont nu e inca asezat in niciun grup."
                    : `${unmappedCount} conturi nu sunt inca asezate in niciun grup.`}
                </span>
              </>
            )}
          </p>
        </div>
        <ToggleGroup<ViewMode>
          value={view}
          onChange={onViewChange}
          options={[
            { value: "list", label: "Lista" },
            { value: "treemap", label: "Harta" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder="Cauta dupa cont, denumire sau grup..."
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
            ? "1 cont fara grupare"
            : `${accounts.length} conturi fara grupare`}
        </span>
        <span
          className="text-[11px] text-gray flex-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Aceste conturi apar pe /firma intr-un grup generic. Aseaza-le in
          grupul potrivit ca patronul sa vada nume clare.
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
            <Plus size={14} /> Adauga grup
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
            ? "Niciun grup nu se potriveste cautarii."
            : "Niciun grup inca. Apasa +Adauga grup."}
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

  const directAccounts = accountsByCategory.get(node.id) ?? [];
  const totalRulaj = aggregatedRulaj.get(node.id) ?? 0;
  const hasContent = node.children.length > 0 || directAccounts.length > 0;
  const containerStyle = depth === 0
    ? "rounded-lg border border-dark-3 bg-dark-3/20 p-3"
    : "border-l-2 border-dark-3 pl-3 ml-1 py-1";

  // When a query is active, force-expand any category that has a match
  // somewhere in its sub-tree so the contabil sees what matched.
  const forceExpanded = query.length > 0 && matchesQuery(node, accountsByCategory, query);
  const isExpanded = expanded || forceExpanded;

  return (
    <li className={containerStyle}>
      <div className="flex items-center gap-2 group">
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
            <span
              className={`flex-1 truncate ${depth === 0 ? "text-[13px] font-semibold text-white" : "text-[12px] text-gray-light"}`}
              style={{ letterSpacing: "-0.04em" }}
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
            <span className="font-mono text-[10px] text-gray tabular-nums shrink-0">
              {directAccounts.length > 0 && `${directAccounts.length} ${directAccounts.length === 1 ? "cont" : "conturi"}`}
              {directAccounts.length > 0 && totalRulaj !== 0 && " · "}
              {totalRulaj !== 0 && `${formatRon(totalRulaj)} lei`}
            </span>
            <CategoryResidueMarker node={node} />
            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip content="Adauga sub-grup. Apare indentat sub acesta pe /firma.">
                <button
                  type="button"
                  onClick={() => setAddingSubcategory(true)}
                  className="p-1.5 text-gray hover:text-primary"
                >
                  <Plus size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Adauga un cont la acest grup.">
                <button
                  type="button"
                  onClick={() => setAddingAccount(true)}
                  className="p-1.5 text-gray hover:text-primary"
                >
                  <ArrowRightLeft size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Redenumeste grupul.">
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
      la alte categorii prin exceptii de partener. Orizontala contului se
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
    return `Merg la ${def?.name ?? "verticala implicita"}. Click pentru a seta orizontala categoriei.`;
  })();

  const topSources = inflow.sources.slice(0, 3);
  const tooltip = (
    <>
      <div>
        Aceasta categorie primeste <strong>{formatRon(inflow.amount)} lei</strong>{" "}
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
  const [pending, startTransition] = useTransition();
  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;

  function unmap() {
    if (
      !confirm(
        `Sterg gruparea pentru ${account.cont}? Va aparea pe /firma intr-un grup generic.`
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

  const partnerPanel = usePartnerPanel();
  // Show the partner badge when there are at least 2 partners on the cont.
  // A single-partener cont (chirie, abonament unic) has no exception story
  // to tell — the decision is at the cont level. Two or more partners means
  // at least one might belong somewhere else, and that's exactly the
  // scenario the panel exists for. Validated against real data (Nov 2026):
  // ~43% of conts in the database have >=2 partners; ~14% have exactly 2
  // and that's the bucket where mis-classifications hide most often.
  const showPartnersBadge =
    partnerPanel !== null && account.partnerCount >= MIN_PARTNERS_FOR_BADGE;
  const hasPartnerOverrides = account.partnerOverrideCount > 0;

  return (
    <li
      className={`group flex items-center gap-2 ${
        compact ? "py-0.5" : "px-2 py-1 rounded hover:bg-dark-3/30"
      } ${
        // Visual cue at row level for conts with partner overrides: a thin
        // primary-tinted left border on the whole row. Scanning the list
        // top-to-bottom, conts with manual exceptions stand out without
        // requiring the contabil to read the badge.
        hasPartnerOverrides ? "border-l-2 border-primary/40 -ml-0.5 pl-1.5" : ""
      }`}
    >
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
      <ContResidueMarker account={account} grossRulaj={rulaj} />
      {showPartnersBadge && (
        <Tooltip
          content={
            hasPartnerOverrides
              ? `${account.partnerCount} parteneri · ${account.partnerOverrideCount} cu exceptie individuala. Click pentru a edita.`
              : `${account.partnerCount} parteneri pe acest cont. Click pentru a vedea sau a pune exceptii individuale.`
          }
        >
          <button
            type="button"
            onClick={() => partnerPanel.open(account)}
            disabled={pending}
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              hasPartnerOverrides
                ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                : "border-dark-3 text-gray hover:text-gray-light hover:border-gray"
            }`}
            style={{ letterSpacing: "-0.02em" }}
          >
            <Users size={10} />
            {account.partnerCount}
            {hasPartnerOverrides && ` · ${account.partnerOverrideCount}`}
          </button>
        </Tooltip>
      )}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
        <Tooltip content="Muta acest cont la alt grup patron.">
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
          <Tooltip content="Sterge gruparea — contul revine la 'fara grupare'.">
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
        placeholder="Numele grupului (cum apare pe /firma)"
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
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    const hasMappings = node.mappingCount > 0;
    const hasChildren = node.children.length > 0;
    let msg = `Sterg grupul "${node.name}"?`;
    if (hasMappings || hasChildren) {
      msg += "\n\n";
      if (hasMappings) msg += `Conturile mapate (${node.mappingCount}) vor reveni la "fara grupare".\n`;
      if (hasChildren) msg += `Sub-grupurile (${node.children.length}) vor fi sterse impreuna cu el.`;
    }
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await deleteCategoryAction({ clientId, categoryId: node.id });
      if (r.error) alert(r.error);
      else onDone();
    });
  }

  return (
    <Tooltip content="Sterge grupul. Conturile mapate revin la 'fara grupare'.">
      <button
        type="button"
        onClick={confirmDelete}
        disabled={pending}
        className="p-1.5 text-gray hover:text-neg"
      >
        <Trash2 size={14} />
      </button>
    </Tooltip>
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
            ? `${a.cont} · ${a.denumire} (mutat de la alt grup)`
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
        if (n.id === account.currentMapping?.categoryId) continue;
        const label = prefix ? `${prefix} › ${n.name}` : n.name;
        result.push({ value: n.id, label });
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
          placeholder="Alege grupul..."
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
