"use client";

/**
 * "Mapari Cashflow" tab — accountant-only screen on /clients/[slug].
 *
 * Two-panel layout:
 *   - Left: category tree (expense + revenue roots), with mapping counts and
 *     a button to add a new category under any node.
 *   - Right: list of class 6/7 accounts present in the firm's journal, each
 *     with a Select to pick its category and small badges showing where the
 *     mapping comes from (analytic override vs inherited from contBase).
 *
 * All mutations go through server actions and the page revalidates afterwards.
 * No client-side optimistic state — feels slower by a tick but eliminates the
 * "saved but UI lies" class of bugs entirely.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import type {
  CostCategoryNode,
  MappingScope,
  AccountListItem,
  MapariCashflowData,
} from "@/modules/categories";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  mapAccountAction,
  unmapAccountAction,
} from "@/modules/categories/actions";
import { flattenTreeForPicker, pickerLabel, type FlatNode } from "./tree-utils";
import { VerticalPicker } from "./vertical-picker";
import type { VerticalView } from "@/modules/verticals";

interface Props {
  data: MapariCashflowData;
}

type Filter = "all" | "unmapped" | "expense" | "revenue";

export function MapariCashflowTab({ data }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const filteredAccounts = data.accounts.filter((a) => {
    if (filter === "expense") return a.kind === "expense";
    if (filter === "revenue") return a.kind === "revenue";
    if (filter === "unmapped") return a.currentMapping === null;
    return true;
  });

  const unmappedCount = data.accounts.filter((a) => a.currentMapping === null).length;

  return (
    <div className="space-y-6">
      <PageHeader period={data.period} freshlySeeded={data.freshlySeeded} />

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <CategoryTreePanel
          tree={data.tree}
          clientId={data.clientId}
          onMutate={() => router.refresh()}
        />
        <AccountListPanel
          accounts={filteredAccounts}
          totalAccounts={data.accounts.length}
          unmappedCount={unmappedCount}
          filter={filter}
          onFilterChange={setFilter}
          tree={data.tree}
          clientId={data.clientId}
          verticalsEnabled={data.verticalsEnabled}
          verticals={data.verticals}
          onMutate={() => router.refresh()}
        />
      </div>
    </div>
  );
}

function PageHeader({
  period,
  freshlySeeded,
}: {
  period: { year: number; month: number } | null;
  freshlySeeded: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2
          className="text-[20px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Mapari Cashflow
        </h2>
        <p
          className="mt-1 max-w-3xl text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Organizeaza conturile firmei in categorii usor de inteles pentru
          antreprenor. Acestea apar pe /firma sub &quot;Unde s-au dus banii&quot;
          si &quot;De unde au venit banii&quot;. Sumele de mai jos sunt rulajul
          ultimei luni inregistrate
          {period
            ? ` (${monthLabel(period.year, period.month)})`
            : ""}{" "}
          — un reper rapid pentru ce conturi conteaza.
        </p>
      </div>

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
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-5 self-start">
      <CategorySection
        title="Cheltuieli"
        subtitle="Cum vede patronul iesirile firmei"
        kind="expense"
        roots={expenseRoots}
        clientId={clientId}
        onMutate={onMutate}
      />
      <div className="border-t border-dark-3 pt-5">
        <CategorySection
          title="Venituri"
          subtitle="Cum vede patronul intrarile firmei"
          kind="revenue"
          roots={revenueRoots}
          clientId={clientId}
          onMutate={onMutate}
        />
      </div>
    </div>
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
              <span
                className="font-mono text-[9px] uppercase tracking-wider text-gray shrink-0"
                title="Categorie default OMFP"
              >
                OMFP
              </span>
            )}
            {node.mappingCount > 0 && (
              <span className="font-mono text-[10px] text-gray tabular-nums shrink-0">
                {node.mappingCount}
              </span>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAddingAt(node.id)}
                title="Adauga subcategorie"
                className="p-1 text-gray hover:text-primary"
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                title="Redenumeste"
                className="p-1 text-gray hover:text-primary"
              >
                <Pencil size={11} />
              </button>
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
        <p className="text-[11px] text-rose-300 mt-1">{error}</p>
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
    <button
      type="button"
      onClick={submit}
      disabled={pending}
      title={error ?? "Sterge categoria"}
      className="p-1 text-gray hover:text-rose-300"
    >
      <Trash2 size={11} />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                           RIGHT — ACCOUNT LIST                             */
/* -------------------------------------------------------------------------- */

function AccountListPanel({
  accounts,
  totalAccounts,
  unmappedCount,
  filter,
  onFilterChange,
  tree,
  clientId,
  verticalsEnabled,
  verticals,
  onMutate,
}: {
  accounts: AccountListItem[];
  totalAccounts: number;
  unmappedCount: number;
  filter: Filter;
  onFilterChange: (v: Filter) => void;
  tree: CostCategoryNode[];
  clientId: string;
  verticalsEnabled: boolean;
  verticals: VerticalView[];
  onMutate: () => void;
}) {
  const expensePicker = flattenTreeForPicker(tree, "expense");
  const revenuePicker = flattenTreeForPicker(tree, "revenue");

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Conturile firmei
          </h3>
          <p
            className="text-[11px] text-gray mt-0.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            {totalAccounts} conturi clasa 6 si 7 cu rulaj. {unmappedCount}{" "}
            nemapate.
          </p>
        </div>
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

      {accounts.length === 0 ? (
        <p
          className="text-[13px] text-gray italic py-6 text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun cont pentru filtrul curent.
        </p>
      ) : (
        <ul className="divide-y divide-dark-3">
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
  onMutate,
}: {
  account: AccountListItem;
  picker: FlatNode[];
  clientId: string;
  verticalsEnabled: boolean;
  verticals: VerticalView[];
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

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
            {account.cont}
          </span>
          <span
            className="text-[13px] text-gray-light truncate"
            style={{ letterSpacing: "-0.02em" }}
            title={account.denumire}
          >
            {account.denumire}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="font-mono text-[11px] text-gray tabular-nums">
            rulaj {formatRon(rulaj)}
          </span>
          {account.currentMapping === null && (
            <span className="inline-flex items-center gap-1 text-[10px] text-rose-300">
              <AlertTriangle size={10} /> Nemapat
            </span>
          )}
          {account.hasAnalyticOverride && (
            <span
              className="text-[10px] text-amber-300"
              title="Acest cont analitic are o mapare proprie diferita de cea a bazei"
            >
              override analitic
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ScopeToggle
          scope={scope}
          isAnalytic={account.cont !== account.contBase}
          onChange={handleScopeChange}
          disabled={pending}
        />
        <div className="w-56">
          <Select
            value={value}
            options={options}
            onChange={handleChange}
          />
        </div>
        {verticalsEnabled && (
          <div className="w-48">
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
        )}
      </div>
    </li>
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
  const active = scope === "analytic";
  return (
    <button
      type="button"
      onClick={() => onChange(active ? "contBase" : "analytic")}
      disabled={disabled}
      title={
        active
          ? "Acest cont este mapat individual. Click pentru a folosi maparea bazei."
          : "Acest cont mosteneste maparea bazei. Click pentru a-l mapa individual."
      }
      className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
        active
          ? "border-amber-300/30 bg-amber-300/10 text-amber-300"
          : "border-dark-3 bg-dark-3/50 text-gray hover:text-gray-light"
      }`}
    >
      {active ? "individual" : "din baza"}
    </button>
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
