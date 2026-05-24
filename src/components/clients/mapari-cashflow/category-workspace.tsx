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

import { useState, useTransition, useMemo, createContext, useContext } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, ArrowRightLeft, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import type {
  CostCategoryNode,
  AccountListItem,
} from "@/modules/categories";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  mapAccountAction,
  unmapAccountAction,
} from "@/modules/categories/actions";
import { CategoryTreemap } from "./category-treemap";
import { PartnerPanel } from "./partner-panel";

type Filter = "all" | "unmapped" | "expense" | "revenue";

interface Props {
  tree: CostCategoryNode[];
  accounts: AccountListItem[];
  clientId: string;
  period: { year: number; month: number } | null;
  onMutate: () => void;
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

type ViewMode = "list" | "treemap";

export function CategoryWorkspace({ tree, accounts, clientId, period, onMutate }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [panelAccount, setPanelAccount] = useState<AccountListItem | null>(null);

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
      </div>

      <PartnerPanel
        account={panelAccount}
        clientId={clientId}
        period={period}
        tree={tree}
        contCategoryName={panelContCategoryName}
        onClose={() => setPanelAccount(null)}
        onMutate={onMutate}
      />
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
  // Show the partner badge only when there's enough partner activity to
  // make the panel worth opening. Below the threshold the panel would just
  // restate "1 partener: <name>" which is more noise than signal.
  const showPartnersBadge =
    partnerPanel !== null && account.partnerCount >= MIN_PARTNERS_FOR_BADGE;
  const hasPartnerOverrides = account.partnerOverrideCount > 0;

  return (
    <li className={`group flex items-center gap-2 ${compact ? "py-0.5" : "px-2 py-1 rounded hover:bg-dark-3/30"}`}>
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
      {showPartnersBadge && (
        <Tooltip
          content={
            hasPartnerOverrides
              ? `${account.partnerCount} parteneri · ${account.partnerOverrideCount} mapati explicit.`
              : `${account.partnerCount} parteneri pe acest cont. Mapeaza partenerii mari individual.`
          }
        >
          <button
            type="button"
            onClick={() => partnerPanel.open(account)}
            disabled={pending}
            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              hasPartnerOverrides
                ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
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

/** Below this threshold (inclusive), showing a "X parteneri" badge is more
 *  noise than signal — a cont with 1-2 parteneri is fully expressed by its
 *  cont-mapping. Above the threshold, partners deserve their own panel. */
const MIN_PARTNERS_FOR_BADGE = 3;

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
