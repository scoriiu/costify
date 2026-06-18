"use client";

/**
 * "Linii de business" — the single, designed home for the line-of-business
 * dimension. Three clean blocks, generous air:
 *
 *   A · Cum sta firma   — firm totals (venituri / cheltuieli / rezultat) +
 *                         one split bar showing how the result divides across
 *                         lines, plus the firm default split.
 *   B · Liniile         — a calm grid of line cards (rezultat big, V/C small,
 *                         share bar, conturi count). Add / rename / delete a
 *                         line from here. Click a card to inspect it.
 *   C · Compozitia      — for the selected line, the drill-down: categorii →
 *                         conturi → parteneri, expandable in place, editable.
 *
 * Everything is computed live from each cont's RESOLVED allocation (the full
 * firma → categorie → cont → partener cascade), so the numbers always match
 * what the patron sees on /firma.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Check, X, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useEscapeKey } from "@/lib/use-escape-key";
import type {
  AccountListItem,
  CostCategoryNode,
  CategoryInflow,
} from "@/modules/categories";
import type {
  VerticalView,
  AllocationSplit,
  CategoryAllocationView,
} from "@/modules/verticals";
import {
  enableVerticalsAction,
  createVerticalAction,
  renameVerticalAction,
  deleteVerticalAction,
} from "@/modules/verticals/actions";
import {
  EditAllocationDialog,
  EditCategoryAllocationDialog,
  EditFirmDefaultAllocationDialog,
} from "./edit-allocation-dialog";

const LINE_COLORS = [
  { dot: "bg-primary", text: "text-primary", soft: "bg-primary/10", border: "border-primary/30", stroke: "var(--color-primary)" },
  { dot: "bg-amber-400", text: "text-amber-300", soft: "bg-amber-400/10", border: "border-amber-400/30", stroke: "#fbbf24" },
  { dot: "bg-sky-400", text: "text-sky-300", soft: "bg-sky-400/10", border: "border-sky-400/30", stroke: "#38bdf8" },
  { dot: "bg-emerald-400", text: "text-emerald-300", soft: "bg-emerald-400/10", border: "border-emerald-400/30", stroke: "#34d399" },
  { dot: "bg-rose-400", text: "text-rose-300", soft: "bg-rose-400/10", border: "border-rose-400/30", stroke: "#fb7185" },
] as const;
const NEUTRAL = { dot: "bg-gray/40", text: "text-gray", soft: "bg-dark-3/40", border: "border-dark-3", stroke: "var(--color-gray)" };

function colorFor(index: number) {
  return index < 0 ? NEUTRAL : LINE_COLORS[index % LINE_COLORS.length];
}

// Synthetic "Toata firma" line — the residue of everything not assigned to a
// real line of business. It's not a DB Vertical; it's computed so the patron's
// unallocated money is visible at the top instead of vanishing into a gap.
const FIRMA_ID = "__firma__";
const FIRMA_VERTICAL: VerticalView = {
  id: FIRMA_ID,
  clientId: "",
  name: "Toata firma",
  position: -1,
  isDefault: true,
  allocationCount: 0,
};

/* -------------------------------- model ---------------------------------- */

type ContSlice = { account: AccountListItem; amount: number };
type SubgroupSlice = {
  categoryId: string;
  name: string;
  expenses: number;
  revenues: number;
  conts: ContSlice[];
};
type CatSlice = {
  categoryId: string | null;
  name: string;
  expenses: number;
  revenues: number;
  /** Conts mapped directly to this (root) category. */
  conts: ContSlice[];
  /** Nested subgroups (descendant categories) with their own conts/totals. */
  subgroups: SubgroupSlice[];
};
type LineModel = {
  vertical: VerticalView;
  colorIndex: number;
  expenses: number;
  revenues: number;
  contCount: number;
  categories: CatSlice[];
};

function buildModel(
  accounts: AccountListItem[],
  verticals: VerticalView[],
  tree: CostCategoryNode[]
): { lines: LineModel[]; firmExpenses: number; firmRevenues: number } {
  // Resolve any category to its TOP-LEVEL group AND the subgroup directly under
  // that group on the path to it. The Linii composition preserves the
  // hierarchy: group -> subgroup -> conturi. A cont mapped straight to the
  // group has no subgroup; a cont mapped deeper rolls up to the first-level
  // subgroup under the group.
  type Resolved = {
    root: { id: string; name: string };
    subgroup: { id: string; name: string } | null;
  };
  const resolvedById = new Map<string, Resolved>();
  const walk = (
    nodes: CostCategoryNode[],
    root: { id: string; name: string } | null,
    subgroup: { id: string; name: string } | null
  ) => {
    for (const n of nodes) {
      const r = root ?? { id: n.id, name: n.name };
      // Subgroup is the first node BELOW the root on this path. At depth 0 it's
      // null (the node IS the root); at depth >= 1 it's fixed to the first
      // descendant under the root.
      const sg = root === null ? null : subgroup ?? { id: n.id, name: n.name };
      resolvedById.set(n.id, { root: r, subgroup: sg });
      walk(n.children, r, sg);
    }
  };
  walk(tree, null, null);

  const realVerticals = verticals.filter((v) => !v.isDefault);
  const realVerticalIds = new Set(realVerticals.map((v) => v.id));

  // per line -> per category bucket. We always carry a synthetic FIRMA bucket
  // that catches everything NOT assigned to a real line (the residue that the
  // patron sees as "Toata firma"), so no money silently disappears.
  const lineCats = new Map<string, Map<string, CatSlice>>();
  const lineTotals = new Map<string, { expenses: number; revenues: number; conts: Set<string> }>();
  const ensureBucket = (id: string) => {
    if (!lineCats.has(id)) lineCats.set(id, new Map());
    if (!lineTotals.has(id))
      lineTotals.set(id, { expenses: 0, revenues: 0, conts: new Set() });
  };
  for (const v of realVerticals) ensureBucket(v.id);
  ensureBucket(FIRMA_ID);

  let firmExpenses = 0;
  let firmRevenues = 0;

  for (const a of accounts) {
    const rulaj = a.kind === "expense" ? a.rulajD : a.rulajC;
    if (!rulaj) continue;
    if (a.kind === "expense") firmExpenses += rulaj;
    else firmRevenues += rulaj;

    // Only splits that target a REAL line count as assigned; anything else
    // (no rule, or a default-vertical split) falls to the FIRMA residue.
    const realSplits = a.effectiveAllocation.splits.filter((s) =>
      realVerticalIds.has(s.verticalId)
    );
    const assignedPct = realSplits.reduce((s, x) => s + x.percent, 0);
    const splits =
      assignedPct >= 100
        ? realSplits
        : [...realSplits, { verticalId: FIRMA_ID, percent: 100 - assignedPct }];

    const resolved = a.currentMapping
      ? resolvedById.get(a.currentMapping.categoryId) ?? null
      : null;
    const root = resolved?.root ?? null;
    const subgroup = resolved?.subgroup ?? null;
    const catKey = root?.id ?? "__none__";
    const catName = root?.name ?? "Fara grup";

    for (const s of splits) {
      if (s.percent <= 0) continue;
      const cats = lineCats.get(s.verticalId);
      const totals = lineTotals.get(s.verticalId);
      if (!cats || !totals) continue;
      const part = (rulaj * s.percent) / 100;

      let slice = cats.get(catKey);
      if (!slice) {
        slice = {
          categoryId: root?.id ?? null,
          name: catName,
          expenses: 0,
          revenues: 0,
          conts: [],
          subgroups: [],
        };
        cats.set(catKey, slice);
      }
      // Root totals always include the cont (the subgroup is part of the group).
      if (a.kind === "expense") {
        slice.expenses += part;
        totals.expenses += part;
      } else {
        slice.revenues += part;
        totals.revenues += part;
      }
      totals.conts.add(a.cont);

      // Route the cont to the group itself or to its subgroup bucket.
      if (subgroup) {
        let sg = slice.subgroups.find((x) => x.categoryId === subgroup.id);
        if (!sg) {
          sg = {
            categoryId: subgroup.id,
            name: subgroup.name,
            expenses: 0,
            revenues: 0,
            conts: [],
          };
          slice.subgroups.push(sg);
        }
        if (a.kind === "expense") sg.expenses += part;
        else sg.revenues += part;
        sg.conts.push({ account: a, amount: part });
      } else {
        slice.conts.push({ account: a, amount: part });
      }
    }
  }

  const buildLine = (vertical: VerticalView, colorIndex: number): LineModel => {
    const totals = lineTotals.get(vertical.id)!;
    const byActivity = (a: { expenses: number; revenues: number }, b: { expenses: number; revenues: number }) =>
      b.expenses + b.revenues - (a.expenses + a.revenues);
    const cats = Array.from(lineCats.get(vertical.id)!.values())
      .map((c) => ({
        ...c,
        conts: [...c.conts].sort((x, y) => y.amount - x.amount),
        subgroups: c.subgroups
          .map((sg) => ({ ...sg, conts: [...sg.conts].sort((x, y) => y.amount - x.amount) }))
          .sort(byActivity),
      }))
      .sort(byActivity);
    return {
      vertical,
      colorIndex,
      expenses: totals.expenses,
      revenues: totals.revenues,
      contCount: totals.conts.size,
      categories: cats,
    };
  };

  // "Toata firma" first (the residue), then the real lines in definition order.
  const firmaLine = buildLine(FIRMA_VERTICAL, -1);
  const realLines = realVerticals.map((v, i) => buildLine(v, i));
  const lines: LineModel[] = [
    ...(firmaLine.expenses > 0 || firmaLine.revenues > 0 ? [firmaLine] : []),
    ...realLines,
  ];

  return { lines, firmExpenses, firmRevenues };
}

/* -------------------------------- view ----------------------------------- */

export function LinesView({
  accounts,
  verticals,
  tree,
  clientId,
  enabled,
  firmDefaultSplits,
  categoryAllocationsById,
  inflowByCategoryId,
  onMutate,
  onOpenPartners,
}: {
  accounts: AccountListItem[];
  verticals: VerticalView[];
  tree: CostCategoryNode[];
  clientId: string;
  enabled: boolean;
  firmDefaultSplits: AllocationSplit[] | null;
  categoryAllocationsById: Map<string, CategoryAllocationView>;
  inflowByCategoryId: Map<string, CategoryInflow>;
  onMutate: () => void;
  onOpenPartners: (account: AccountListItem) => void;
}) {
  const realVerticalCount = verticals.filter((v) => !v.isDefault).length;
  if (!enabled || realVerticalCount === 0) {
    return <ActivateLines clientId={clientId} enabled={enabled} onMutate={onMutate} />;
  }
  return (
    <LinesViewInner
      accounts={accounts}
      verticals={verticals}
      tree={tree}
      clientId={clientId}
      firmDefaultSplits={firmDefaultSplits}
      categoryAllocationsById={categoryAllocationsById}
      inflowByCategoryId={inflowByCategoryId}
      onMutate={onMutate}
      onOpenPartners={onOpenPartners}
    />
  );
}

function ActivateLines({
  clientId,
  enabled,
  onMutate,
}: {
  clientId: string;
  enabled: boolean;
  onMutate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function enableThenAdd() {
    if (enabled) {
      setAdding(true);
      return;
    }
    startTransition(async () => {
      const r = await enableVerticalsAction({ clientId });
      if (r.error) alert(r.error);
      else {
        setAdding(true);
        onMutate();
      }
    });
  }

  return (
    <section className="rounded-xl border border-dark-3 bg-dark-2 p-8">
      <div className="max-w-xl">
        <h3 className="text-[18px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Liniile de business
        </h3>
        <p className="mt-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          Imparte firma pe activitati (Outsourcing, Recrutare, Coworking) ca sa
          vezi cat aduce si cat costa fiecare. Apoi mapezi linii de cost, conturi sau
          parteneri pe fiecare linie, in procente.
        </p>
        {adding ? (
          <div className="mt-5 max-w-sm">
            <AddLineInline
              clientId={clientId}
              onDone={() => {
                setAdding(false);
                onMutate();
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button onClick={enableThenAdd} disabled={pending} className="mt-5">
            <Plus size={14} className="mr-1" />
            {enabled ? "Adauga prima linie" : "Activeaza liniile de business"}
          </Button>
        )}
      </div>
    </section>
  );
}

function LinesViewInner({
  accounts,
  verticals,
  tree,
  clientId,
  firmDefaultSplits,
  categoryAllocationsById,
  inflowByCategoryId,
  onMutate,
  onOpenPartners,
}: {
  accounts: AccountListItem[];
  verticals: VerticalView[];
  tree: CostCategoryNode[];
  clientId: string;
  firmDefaultSplits: AllocationSplit[] | null;
  categoryAllocationsById: Map<string, CategoryAllocationView>;
  inflowByCategoryId: Map<string, CategoryInflow>;
  onMutate: () => void;
  onOpenPartners: (account: AccountListItem) => void;
}) {
  // Optimistic lines: a newly added line shows instantly, before the
  // background refetch (which recomputes from the full journal and can take a
  // few seconds) lands. Once the server payload includes the line, the prop
  // wins and we drop the optimistic copy.
  const [optimisticLines, setOptimisticLines] = useState<VerticalView[]>([]);
  useEffect(() => {
    const known = new Set(verticals.map((v) => v.id));
    setOptimisticLines((prev) => prev.filter((v) => !known.has(v.id)));
  }, [verticals]);

  // Optimistically removed lines: hidden instantly on delete, before the
  // background refetch confirms the line is gone from the server payload.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const known = new Set(verticals.map((v) => v.id));
    setRemovedIds((prev) => {
      const next = new Set([...prev].filter((id) => known.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [verticals]);

  const mergedVerticals = useMemo(
    () => [...verticals, ...optimisticLines].filter((v) => !removedIds.has(v.id)),
    [verticals, optimisticLines, removedIds]
  );

  const { lines, firmExpenses, firmRevenues } = useMemo(
    () => buildModel(accounts, mergedVerticals, tree),
    [accounts, mergedVerticals, tree]
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    lines.find((l) => !l.vertical.isDefault)?.vertical.id ?? null
  );
  const [adding, setAdding] = useState(false);
  const [editingFirm, setEditingFirm] = useState(false);
  const [editingCont, setEditingCont] = useState<AccountListItem | null>(null);
  const [editingCat, setEditingCat] =
    useState<{ id: string; name: string; kind: "expense" | "revenue" } | null>(null);

  const firmResult = firmRevenues - firmExpenses;
  const firmActivity = firmExpenses + firmRevenues;

  return (
    <div className="space-y-4">
      {/* The firm split — the pillars the firm stands on, as one bar. */}
      <section className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <FirmStat label="Venituri" value={firmRevenues} tone="pos" />
          <FirmStat label="Cheltuieli" value={firmExpenses} tone="neg" />
          <FirmStat
            label="Rezultat"
            value={firmResult}
            tone={firmResult >= 0 ? "pos" : "neg"}
            emphatic
          />
        </div>
        <FirmSplitBar
          lines={lines}
          firmActivity={firmActivity}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((c) => (c === id ? null : id))}
        />
        <div className="mt-4 border-t border-dark-3/60 pt-4">
          <FirmDefaultControl
            firmDefaultSplits={firmDefaultSplits}
            verticals={verticals}
            onEdit={() => setEditingFirm(true)}
          />
        </div>
      </section>

      {/* The pillars — each line of business as a standing column. The
          selected pillar grows to give its composition tree full width; the
          others compress to thin spines so the chosen one reads clearly. */}
      <section className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        {lines.map((line) => (
          <Pillar
            key={line.vertical.id}
            line={line}
            firmActivity={firmActivity}
            selected={!adding && line.vertical.id === selectedId}
            anySelected={selectedId !== null || adding}
            clientId={clientId}
            onSelect={() =>
              setSelectedId((c) =>
                c === line.vertical.id ? null : line.vertical.id
              )
            }
            onMutate={onMutate}
            onRemoved={(id) => {
              setRemovedIds((prev) => new Set(prev).add(id));
              setSelectedId((c) => (c === id ? null : c));
            }}
            onEditCont={(a) => setEditingCont(a)}
            onEditCategory={(c) => setEditingCat(c)}
            onOpenPartners={onOpenPartners}
          />
        ))}
        {adding ? (
          <div className="flex flex-col overflow-hidden rounded-xl border border-dashed border-primary/40 bg-primary/5 ring-1 ring-inset ring-primary/30 lg:flex-[5]">
            <div className="h-1 w-full bg-primary/30" aria-hidden />
            <div className="p-4">
              <div
                className="text-[14px] font-semibold text-white"
                style={{ letterSpacing: "-0.04em" }}
              >
                Linie de business noua
              </div>
              <p
                className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray"
                style={{ letterSpacing: "-0.02em" }}
              >
                Da-i un nume (ex: Outsourcing, Coworking)
              </p>
              <div className="mt-3 max-w-sm">
                <AddLineInline
                  clientId={clientId}
                  onDone={(created) => {
                    setAdding(false);
                    if (created) {
                      setOptimisticLines((prev) => [
                        ...prev,
                        {
                          id: created.id,
                          clientId,
                          name: created.name,
                          position: mergedVerticals.length,
                          isDefault: false,
                          allocationCount: 0,
                        },
                      ]);
                      setSelectedId(created.id);
                    }
                    onMutate();
                  }}
                  onCancel={() => setAdding(false)}
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="group flex flex-col overflow-hidden rounded-xl border border-dashed border-dark-3 bg-dark-2 text-left text-gray hover:border-primary/60 hover:text-primary transition-colors lg:flex-1 lg:min-w-[150px] cursor-pointer"
            aria-label="Adauga linie"
          >
            <span className="h-1 w-full" aria-hidden />
            <span className="p-4">
              <span
                className="block text-[14px] font-semibold"
                style={{ letterSpacing: "-0.04em" }}
              >
                Adauga linie
              </span>
              <span className="mt-3 flex items-center" style={{ height: "32px" }}>
                <Plus size={32} strokeWidth={1.5} className="-ml-1 leading-none" />
              </span>
              <span
                className="mt-1 block font-mono text-[10px] uppercase tracking-wider"
                style={{ letterSpacing: "-0.02em" }}
              >
                linie de business noua
              </span>
            </span>
          </button>
        )}
      </section>

      {/* dialogs */}
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
      {editingCont && (
        <EditAllocationDialog
          open
          account={editingCont}
          verticals={verticals}
          clientId={clientId}
          onClose={() => setEditingCont(null)}
          onSaved={() => {
            setEditingCont(null);
            onMutate();
          }}
        />
      )}
      {editingCat && (
        <EditCategoryAllocationDialog
          open
          categoryId={editingCat.id}
          categoryName={editingCat.name}
          kind={editingCat.kind}
          inflow={inflowByCategoryId.get(editingCat.id)?.amount ?? 0}
          currentSplits={categoryAllocationsById.get(editingCat.id)?.splits ?? []}
          verticals={verticals}
          clientId={clientId}
          onClose={() => setEditingCat(null)}
          onSaved={() => {
            setEditingCat(null);
            onMutate();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Block A bits ------------------------------ */

function FirmStat({
  label,
  value,
  tone,
  emphatic = false,
}: {
  label: string;
  value: number;
  tone: "pos" | "neg";
  emphatic?: boolean;
}) {
  const color = emphatic ? (tone === "pos" ? "text-pos" : "text-neg") : "text-white";
  return (
    <div>
      <div
        className="font-mono text-[10px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        {label}
      </div>
      <div
        className={`font-mono tabular-nums ${emphatic ? "text-[26px]" : "text-[22px]"} ${color}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {formatLei(value)}
        <span className="text-[12px] text-gray ml-1">lei</span>
      </div>
    </div>
  );
}

function FirmDefaultControl({
  firmDefaultSplits,
  verticals,
  onEdit,
}: {
  firmDefaultSplits: AllocationSplit[] | null;
  verticals: VerticalView[];
  onEdit: () => void;
}) {
  const has = firmDefaultSplits !== null && firmDefaultSplits.length > 0;
  const realVerticals = verticals.filter((v) => !v.isDefault);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Impartirea implicita
        </span>
        <Tooltip content="Tot ce nu are o regula proprie (linie de cost, cont, partener) se imparte asa. O setezi o data.">
          <span className="font-mono text-[9px] text-gray cursor-help">?</span>
        </Tooltip>
      </div>
      {has ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {firmDefaultSplits!.map((s) => {
            const idx = realVerticals.findIndex((v) => v.id === s.verticalId);
            const c = colorFor(idx);
            const v = realVerticals[idx] ?? verticals.find((x) => x.id === s.verticalId);
            return (
              <span
                key={s.verticalId}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-gray-light"
                style={{ letterSpacing: "-0.02em" }}
              >
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${c.dot}`} aria-hidden />
                <span className="text-white">{s.percent}%</span>
                <span className="truncate max-w-[110px]">{v?.name ?? "?"}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-gray italic" style={{ letterSpacing: "-0.02em" }}>
          Neimpartita. Totul pe &quot;Toata firma&quot;.
        </p>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-light hover:text-white transition-colors"
        style={{ letterSpacing: "-0.02em" }}
      >
        {has ? <Pencil size={12} /> : <Plus size={12} />}
        {has ? "Editeaza" : "Imparte firma"}
      </button>
    </div>
  );
}

/** The firm as one bar split into the pillars it stands on. Each segment's
 *  width is that line's share of total activity (V+C); a trailing gap is the
 *  money not yet assigned to any line. Clicking a segment selects its pillar.
 *  This is the "the firm rests on these columns" overview, kept compact so the
 *  pillars themselves below are the main event. */
function FirmSplitBar({
  lines,
  firmActivity,
  selectedId,
  onSelect,
}: {
  lines: LineModel[];
  firmActivity: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const withMoney = lines.filter((l) => l.expenses + l.revenues > 0);
  const denom = firmActivity > 0 ? firmActivity : 1;
  const assigned = withMoney.reduce((s, l) => s + l.expenses + l.revenues, 0);
  const unassigned = Math.max(0, denom - assigned);

  if (withMoney.length === 0) {
    return (
      <p className="text-[11px] text-gray italic" style={{ letterSpacing: "-0.02em" }}>
        Nicio miscare alocata inca pe linii.
      </p>
    );
  }

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-dark-3">
        {withMoney.map((l) => {
          const c = colorFor(l.colorIndex);
          const pct = ((l.expenses + l.revenues) / denom) * 100;
          const dim = selectedId !== null && selectedId !== l.vertical.id;
          return (
            <button
              key={l.vertical.id}
              type="button"
              onClick={() => onSelect(l.vertical.id)}
              className={`h-full ${c.dot} transition-opacity ${dim ? "opacity-30" : ""} ${
                selectedId === l.vertical.id ? "ring-1 ring-inset ring-white/40" : ""
              }`}
              style={{ width: `${pct}%` }}
              title={`${l.vertical.name} · ${Math.round(pct)}%`}
              aria-label={`${l.vertical.name} ${Math.round(pct)}%`}
            />
          );
        })}
        {unassigned > 0 && (
          <div
            className="h-full bg-transparent"
            style={{ width: `${(unassigned / denom) * 100}%` }}
            title={`Nealocat · ${Math.round((unassigned / denom) * 100)}%`}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Pillar -------------------------------- */

/** A line of business rendered as a standing column — a pillar the firm rests
 *  on. Header carries the identity (name, share of firm, result, V/C). When
 *  selected, the pillar grows and reveals its composition (categorii → conturi)
 *  INSIDE the column, so "this all belongs to Outsourcing" reads at a glance.
 *  Unselected pillars compress so the chosen one dominates. */
function Pillar({
  line,
  firmActivity,
  selected,
  anySelected,
  clientId,
  onSelect,
  onMutate,
  onRemoved,
  onEditCont,
  onEditCategory,
  onOpenPartners,
}: {
  line: LineModel;
  firmActivity: number;
  selected: boolean;
  anySelected: boolean;
  clientId: string;
  onSelect: () => void;
  onMutate: () => void;
  onRemoved: (id: string) => void;
  onEditCont: (a: AccountListItem) => void;
  onEditCategory: (c: { id: string; name: string; kind: "expense" | "revenue" }) => void;
  onOpenPartners: (a: AccountListItem) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const c = colorFor(line.colorIndex);
  const result = line.revenues - line.expenses;
  const activity = line.expenses + line.revenues;
  const share = firmActivity > 0 ? activity / firmActivity : 0;

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(true);
  }

  // Optimistic delete: hide the line instantly, then fire the server action
  // in the background. The parent's onMutate refetch reconciles; if the
  // delete somehow fails, the refetch brings the line back.
  function confirmRemove() {
    setConfirmingDelete(false);
    onRemoved(line.vertical.id);
    onMutate();
    void deleteVerticalAction({ clientId, verticalId: line.vertical.id }).then(
      (r) => {
        if (r.error) alert(r.error);
      }
    );
  }

  // Selected pillar takes the lion's share of the row; others shrink to a calm
  // column. On narrow screens everything stacks full width.
  const widthClass = selected
    ? "lg:flex-[5]"
    : anySelected
    ? "lg:flex-[1] lg:min-w-[150px]"
    : "lg:flex-1";

  // A compressed (someone-else-selected) pillar shows only name + share +
  // result so a narrow column never crams the full header.
  const compact = anySelected && !selected;

  return (
    <div
      data-testid="line-card"
      data-line-name={line.vertical.name}
      onClick={renaming ? undefined : onSelect}
      role={renaming ? undefined : "button"}
      aria-pressed={renaming ? undefined : selected}
      tabIndex={renaming ? undefined : 0}
      onKeyDown={
        renaming
          ? undefined
          : (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
      }
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-dark-2 transition-all ${widthClass} ${
        renaming ? "" : "cursor-pointer"
      } ${
        selected ? `${c.border} ring-1 ring-inset ${c.border.replace("border", "ring")}` : "border-dark-3 hover:border-dark-3/60"
      }`}
    >
      {/* The pillar's color spine — a column cap that brands the whole card. */}
      <div className={`h-1 w-full ${c.dot}`} aria-hidden />

      {renaming ? (
        <div className="p-4">
          <RenameLineInline
            vertical={line.vertical}
            clientId={clientId}
            onDone={() => {
              setRenaming(false);
              onMutate();
            }}
            onCancel={() => setRenaming(false)}
          />
        </div>
      ) : (
        <div className="text-left p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-[14px] font-semibold text-white truncate"
                style={{ letterSpacing: "-0.04em" }}
                title={line.vertical.name}
              >
                {line.vertical.name}
              </span>
            </div>
            {!line.vertical.isDefault && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenaming(true);
                  }}
                  className="p-1 text-gray hover:text-primary"
                  aria-label="Redenumeste"
                >
                  <Pencil size={11} />
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={remove}
                  className="p-1 text-gray hover:text-neg"
                  aria-label="Sterge"
                >
                  <Trash2 size={11} />
                </span>
              </div>
            )}
          </div>

          {/* Compact (compressed) pillar: just the share % and result, given
              room to breathe. Full pillar: the whole header. */}
          {compact ? (
            <div className="mt-4 flex flex-col gap-2">
              <div
                className={`font-mono tabular-nums text-[28px] leading-none ${c.text}`}
                style={{ letterSpacing: "-0.04em" }}
              >
                {Math.round(share * 100)}%
              </div>
              <div
                className={`font-mono tabular-nums text-[13px] ${
                  result >= 0 ? "text-pos" : "text-neg"
                }`}
                style={{ letterSpacing: "-0.04em" }}
              >
                {formatLei(result)} lei
              </div>
              <div className="font-mono text-[10px] tabular-nums text-gray leading-relaxed">
                <span>
                  <span className="text-gray/70">V</span> {formatLei(line.revenues)}
                </span>
                <span className="ml-2">
                  <span className="text-gray/70">C</span> {formatLei(line.expenses)}
                </span>
                <span className="block">{line.contCount} conturi</span>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div
                    className={`font-mono tabular-nums text-[32px] leading-none ${c.text}`}
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {Math.round(share * 100)}%
                  </div>
                  <div
                    className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    din activitatea firmei
                  </div>
                </div>
                <div
                  className={`text-right font-mono tabular-nums text-[15px] ${
                    result >= 0 ? "text-pos" : "text-neg"
                  }`}
                  style={{ letterSpacing: "-0.04em" }}
                >
                  {formatLei(result)}
                  <span className="block text-[9px] uppercase tracking-wider text-gray">
                    rezultat
                  </span>
                </div>
              </div>

              <div className="mt-3 h-1.5 rounded-full bg-dark-3 overflow-hidden">
                <div className={`h-full ${c.dot}`} style={{ width: `${Math.round(share * 100)}%` }} />
              </div>

              <div className="mt-2 flex items-center gap-4 font-mono text-[11px] tabular-nums text-gray-light">
                <span>
                  <span className="text-gray">V</span> {formatLei(line.revenues)}
                </span>
                <span>
                  <span className="text-gray">C</span> {formatLei(line.expenses)}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray group-hover:text-gray-light">
                  {line.contCount} conturi
                  <ChevronRight size={11} className={selected ? "rotate-90 transition-transform" : "transition-transform"} />
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* The composition lives INSIDE the pillar when it's the selected one.
          Clicks here must not bubble up to the card's select handler, or
          interacting with the tree would collapse the pillar. */}
      {selected && !renaming && (
        <div
          className="border-t border-dark-3/60 px-4 pb-4 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <PillarComposition
            line={line}
            onEditCont={onEditCont}
            onEditCategory={onEditCategory}
            onOpenPartners={onOpenPartners}
          />
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDeleteLine
          name={line.vertical.name}
          contCount={line.contCount}
          onConfirm={confirmRemove}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

/* ------------------------- Confirm delete line modal ---------------------- */

function ConfirmDeleteLine({
  name,
  contCount,
  onConfirm,
  onCancel,
}: {
  name: string;
  contCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEscapeKey(onCancel, true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Sterge linia ${name}`}
        className="w-full max-w-md rounded-xl border border-dark-3 bg-dark-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-dark-3 p-5">
          <div className="min-w-0">
            <div
              className="text-[14px] font-semibold text-white truncate"
              style={{ letterSpacing: "-0.04em" }}
              title={name}
            >
              Sterge linia {name}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-gray hover:text-white rounded"
            aria-label="Inchide"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <p
            className="text-[13px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {contCount > 0 ? (
              <>
                Cele{" "}
                <strong className="text-white">
                  {contCount} {contCount === 1 ? "cont" : "conturi"}
                </strong>{" "}
                de pe aceasta linie vor trece la{" "}
                <strong className="text-white">Toata firma</strong>. Linia se
                sterge definitiv.
              </>
            ) : (
              <>
                Linia se sterge definitiv. Nu are conturi alocate, deci nimic
                nu se muta.
              </>
            )}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-dark-3 p-5 pt-4">
          <Button variant="ghost" onClick={onCancel}>
            Renunta
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Sterge linia
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Pillar composition -------------------------- */

type LineColor = typeof NEUTRAL;

/** The composition of one pillar: its categories → conturi, rendered INSIDE
 *  the selected line column. Each row carries its share of THIS line so the
 *  patron reads "how much of Outsourcing is this". */
function PillarComposition({
  line,
  onEditCont,
  onEditCategory,
  onOpenPartners,
}: {
  line: LineModel;
  onEditCont: (a: AccountListItem) => void;
  onEditCategory: (c: { id: string; name: string; kind: "expense" | "revenue" }) => void;
  onOpenPartners: (a: AccountListItem) => void;
}) {
  const lineActivity = line.expenses + line.revenues;
  // Route each category to the side it predominantly belongs to. A category
  // that is mostly revenue lands under Venituri, mostly expense under
  // Cheltuieli — so the patron reads the two sides of the line separately.
  const revenueCats = line.categories.filter((c) => c.revenues >= c.expenses);
  const expenseCats = line.categories.filter((c) => c.revenues < c.expenses);

  return (
    <div>
      <h4
        className="mb-3 font-mono text-[10px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Din ce e compusa linia {line.vertical.name}
      </h4>

      {line.categories.length === 0 ? (
        <p className="text-[12px] text-gray italic" style={{ letterSpacing: "-0.02em" }}>
          Nimic alocat pe aceasta linie inca.
        </p>
      ) : (
        <div className="space-y-4">
          <CompositionSection
            label="Venituri"
            tone="pos"
            total={line.revenues}
            cats={revenueCats}
            lineId={line.vertical.id}
            lineActivity={lineActivity}
            onEditCont={onEditCont}
            onEditCategory={onEditCategory}
            onOpenPartners={onOpenPartners}
          />
          <CompositionSection
            label="Cheltuieli"
            tone="neg"
            total={line.expenses}
            cats={expenseCats}
            lineId={line.vertical.id}
            lineActivity={lineActivity}
            onEditCont={onEditCont}
            onEditCategory={onEditCategory}
            onOpenPartners={onOpenPartners}
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------- composition table layout ------------------------ */

// One shared column grid for the whole composition table so categories,
// subgroups and conturi line up perfectly. The name column flexes; the
// numeric columns are fixed-width and right-aligned. Indentation is applied
// inside the name cell only, never to the numeric columns.
const GRID = "grid-cols-[1fr_72px_52px_120px_56px]";

type SortKey = "name" | "count" | "amount";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

function sortRows<T extends { name: string; count: number; amount: number }>(
  rows: T[],
  sort: Sort
): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.key === "name") return sign * a.name.localeCompare(b.name, "ro");
    if (sort.key === "count") return sign * (a.count - b.count);
    return sign * (a.amount - b.amount);
  });
}

function SortHeader({
  sort,
  onSort,
}: {
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const arrow = (key: SortKey) =>
    sort.key === key ? (sort.dir === "asc" ? "\u2191" : "\u2193") : "";
  const cell = (key: SortKey, label: string, align: "left" | "right") => (
    <button
      type="button"
      onClick={() => onSort(key)}
      className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-gray hover:text-gray-light ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
      style={{ letterSpacing: "-0.02em" }}
    >
      {align === "right" && <span className="tabular-nums">{arrow(key)}</span>}
      {label}
      {align === "left" && <span className="tabular-nums">{arrow(key)}</span>}
    </button>
  );
  return (
    <div className={`grid ${GRID} items-center gap-2 px-3 pb-1`}>
      {cell("name", "Linie de cost", "left")}
      {cell("count", "Conturi", "right")}
      <span className="text-right font-mono text-[9px] uppercase tracking-wider text-gray" style={{ letterSpacing: "-0.02em" }}>
        %
      </span>
      {cell("amount", "Suma", "right")}
      <span aria-hidden />
    </div>
  );
}

/** One side (Venituri or Cheltuieli) of a line's composition. Green header
 *  for venituri, red for cheltuieli — the two halves of the line read apart. */
function CompositionSection({
  label,
  tone,
  total,
  cats,
  lineId,
  lineActivity,
  onEditCont,
  onEditCategory,
  onOpenPartners,
}: {
  label: string;
  tone: "pos" | "neg";
  total: number;
  cats: CatSlice[];
  lineId: string;
  lineActivity: number;
  onEditCont: (a: AccountListItem) => void;
  onEditCategory: (c: { id: string; name: string; kind: "expense" | "revenue" }) => void;
  onOpenPartners: (a: AccountListItem) => void;
}) {
  const [sort, setSort] = useState<Sort>({ key: "amount", dir: "desc" });
  function onSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  if (cats.length === 0) return null;
  const kind: "expense" | "revenue" = tone === "pos" ? "revenue" : "expense";
  const toneClass = tone === "pos" ? "text-pos" : "text-neg";
  // Semantic, calm framing per the design system: low-opacity colored border
  // + faint tint, green for Venituri, red for Cheltuieli.
  const frameClass =
    tone === "pos"
      ? "border-pos/30 bg-pos/[0.04]"
      : "border-neg/30 bg-neg/[0.04]";

  const sortedCats = sortRows(
    cats.map((cat) => ({
      cat,
      name: cat.name,
      count: cat.conts.length + cat.subgroups.reduce((n, sg) => n + sg.conts.length, 0),
      amount: kind === "revenue" ? cat.revenues : cat.expenses,
    })),
    sort
  );

  return (
    <div className={`rounded-lg border ${frameClass} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${toneClass}`}
          style={{ letterSpacing: "-0.02em" }}
        >
          {label}
        </span>
        <span className={`font-mono text-[11px] tabular-nums ${toneClass}`}>
          {formatLei(total)} lei
        </span>
      </div>
      <SortHeader sort={sort} onSort={onSort} />
      <ul className="space-y-1">
        {sortedCats.map(({ cat }) => (
          <CategoryRow
            // Key includes the line id so switching lines remounts the rows
            // and re-applies the expanded default for the new selection.
            key={`${lineId}:${cat.categoryId ?? "__none__"}`}
            cat={cat}
            lineActivity={lineActivity}
            sort={sort}
            defaultOpen
            onEditCont={onEditCont}
            onEditCategory={onEditCategory}
            onOpenPartners={onOpenPartners}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({
  cat,
  lineActivity,
  sort,
  defaultOpen = false,
  onEditCont,
  onEditCategory,
  onOpenPartners,
}: {
  cat: CatSlice;
  lineActivity: number;
  sort: Sort;
  defaultOpen?: boolean;
  onEditCont: (a: AccountListItem) => void;
  onEditCategory: (c: { id: string; name: string; kind: "expense" | "revenue" }) => void;
  onOpenPartners: (a: AccountListItem) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const kind: "expense" | "revenue" = cat.expenses >= cat.revenues ? "expense" : "revenue";
  // Inside a single-sided section (Venituri / Cheltuieli) we show the side
  // amount, in its own tone, not a net result.
  const sideAmount = kind === "revenue" ? cat.revenues : cat.expenses;
  const toneClass = kind === "revenue" ? "text-pos" : "text-neg";
  const subgroupContCount = cat.subgroups.reduce((n, sg) => n + sg.conts.length, 0);
  const contCount = cat.conts.length + subgroupContCount;
  // This category's weight inside the selected line.
  const catShare = formatShare(cat.expenses + cat.revenues, lineActivity);

  const sortedSubs = sortRows(
    cat.subgroups.map((sg) => ({
      sg,
      name: sg.name,
      count: sg.conts.length,
      amount: kind === "revenue" ? sg.revenues : sg.expenses,
    })),
    sort
  );
  const sortedConts = sortRows(
    cat.conts.map(({ account, amount }) => ({
      account,
      amount,
      name: account.cont,
      count: 0,
    })),
    sort
  );

  return (
    <li className="rounded-lg border border-dark-3/60 bg-dark/30">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`grid flex-1 ${GRID} items-center gap-2 px-3 py-2 text-left`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <ChevronRight
              size={13}
              className={`text-gray shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            />
            <span
              className="min-w-0 truncate text-[13px] text-white"
              style={{ letterSpacing: "-0.02em" }}
              title={cat.name}
            >
              {cat.name}
            </span>
          </span>
          <span className="text-right font-mono text-[11px] text-gray tabular-nums">
            {contCount}
          </span>
          <span className="text-right font-mono text-[11px] text-gray-light tabular-nums">
            {catShare}
          </span>
          <span className={`text-right font-mono text-[12px] tabular-nums ${toneClass}`}>
            {formatLei(sideAmount)}
          </span>
          <span className="flex items-center justify-end">
            {cat.categoryId && (
              <Tooltip content="Schimba pe ce linii merge aceasta linie de cost.">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory({ id: cat.categoryId!, name: cat.name, kind });
                  }}
                  className="p-1 text-gray hover:text-primary"
                  aria-label="Editeaza impartirea liniei de cost"
                >
                  <Pencil size={12} />
                </span>
              </Tooltip>
            )}
          </span>
        </button>
      </div>

      {open && (
        <ul className="border-t border-dark-3/50 px-1 py-1 space-y-0.5">
          {sortedSubs.map(({ sg }) => (
            <SubgroupRow
              key={sg.categoryId}
              sub={sg}
              tone={kind}
              sideTotal={sideAmount}
              sort={sort}
              onEditCont={onEditCont}
              onEditCategory={onEditCategory}
              onOpenPartners={onOpenPartners}
            />
          ))}
          {sortedConts.map(({ account, amount }, idx) => (
            <ContRow
              key={`${account.cont}-${idx}`}
              account={account}
              amount={amount}
              sideTotal={sideAmount}
              indent={1}
              onEditCont={onEditCont}
              onOpenPartners={onOpenPartners}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A subgroup nested inside its parent category: group -> subgroup -> conturi.
 *  Expands to show its own conts, with its own subtotal. */
function SubgroupRow({
  sub,
  tone,
  sideTotal,
  sort,
  onEditCont,
  onEditCategory,
  onOpenPartners,
}: {
  sub: SubgroupSlice;
  tone: "expense" | "revenue";
  sideTotal: number;
  sort: Sort;
  onEditCont: (a: AccountListItem) => void;
  onEditCategory: (c: { id: string; name: string; kind: "expense" | "revenue" }) => void;
  onOpenPartners: (a: AccountListItem) => void;
}) {
  const [open, setOpen] = useState(true);
  const sideAmount = tone === "revenue" ? sub.revenues : sub.expenses;
  const toneClass = tone === "revenue" ? "text-pos" : "text-neg";

  const sortedConts = sortRows(
    sub.conts.map(({ account, amount }) => ({
      account,
      amount,
      name: account.cont,
      count: 0,
    })),
    sort
  );

  return (
    <li className="rounded-md bg-dark-3/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`grid w-full ${GRID} items-center gap-2 py-1 pr-3 text-left`}
      >
        <span className="flex items-center gap-1.5 min-w-0 pl-4">
          <ChevronRight
            size={12}
            className={`text-gray shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span
            className="min-w-0 truncate text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
            title={sub.name}
          >
            {sub.name}
          </span>
          <span className="shrink-0 rounded border border-dark-3 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gray">
            sub-grup
          </span>
        </span>
        <span className="text-right font-mono text-[10px] text-gray tabular-nums">
          {sub.conts.length}
        </span>
        <span className="text-right font-mono text-[10px] text-gray-light tabular-nums">
          {formatShare(sideAmount, sideTotal)}
        </span>
        <span className={`text-right font-mono text-[11px] tabular-nums ${toneClass}`}>
          {formatLei(sideAmount)}
        </span>
        <span className="flex items-center justify-end">
          <Tooltip content="Schimba pe ce linii merge acest sub-grup.">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onEditCategory({ id: sub.categoryId, name: sub.name, kind: tone });
              }}
              className="p-1 text-gray hover:text-primary"
              aria-label="Editeaza linia sub-grupului"
            >
              <Pencil size={11} />
            </span>
          </Tooltip>
        </span>
      </button>

      {open && (
        <ul className="border-t border-dark-3/40 py-1 space-y-0.5">
          {sortedConts.map(({ account, amount }, idx) => (
            <ContRow
              key={`${account.cont}-${idx}`}
              account={account}
              amount={amount}
              sideTotal={sideTotal}
              indent={2}
              onEditCont={onEditCont}
              onOpenPartners={onOpenPartners}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A single cont line inside a category or subgroup. Share is relative to the
 *  enclosing section's side total so the percentages stay comparable. */
function ContRow({
  account,
  amount,
  sideTotal,
  indent,
  onEditCont,
  onOpenPartners,
}: {
  account: AccountListItem;
  amount: number;
  sideTotal: number;
  indent: 1 | 2;
  onEditCont: (a: AccountListItem) => void;
  onOpenPartners: (a: AccountListItem) => void;
}) {
  const indentClass = indent === 2 ? "pl-9" : "pl-6";
  return (
    <li className={`group grid ${GRID} items-center gap-2 rounded pr-3 py-1 hover:bg-dark-3/30`}>
      <span className={`flex items-center gap-2 min-w-0 ${indentClass}`}>
        <span className="font-mono text-[10px] text-gray tabular-nums shrink-0 w-12">
          {account.cont}
        </span>
        <span
          className="min-w-0 truncate text-[12px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
          title={account.denumire}
        >
          {account.denumire}
        </span>
        {account.partnerLobOverrideCount > 0 && (
          <Tooltip
            content={`${account.partnerLobOverrideCount} ${
              account.partnerLobOverrideCount === 1 ? "partener are exceptie" : "parteneri au exceptie"
            }, diferita de a contului. Click pe parteneri ca sa vezi.`}
          >
            <span
              className="shrink-0 inline-flex items-center gap-1 rounded border border-dark-3 px-1.5 py-0.5 font-mono text-[10px] text-gray tabular-nums"
              style={{ letterSpacing: "-0.02em" }}
            >
              <Users size={9} />
              {account.partnerLobOverrideCount}
            </span>
          </Tooltip>
        )}
      </span>
      <span aria-hidden />
      <span className="text-right font-mono text-[10px] text-gray tabular-nums">
        {formatShare(amount, sideTotal)}
      </span>
      <span className="text-right font-mono text-[11px] text-gray-light tabular-nums">
        {formatLei(amount)}
      </span>
      <span className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip content="Vezi / imparte partenerii pe linii.">
          <button
            type="button"
            onClick={() => onOpenPartners(account)}
            className="p-1 text-gray hover:text-gray-light"
            aria-label="Parteneri"
          >
            <Users size={12} />
          </button>
        </Tooltip>
        <Tooltip content="Schimba pe ce linii merge acest cont.">
          <button
            type="button"
            onClick={() => onEditCont(account)}
            className="p-1 text-gray hover:text-primary"
            aria-label="Editeaza linia contului"
          >
            <Pencil size={12} />
          </button>
        </Tooltip>
      </span>
    </li>
  );
}

/* ------------------------------ inline forms ------------------------------ */

function AddLineInline({
  clientId,
  onDone,
  onCancel,
}: {
  clientId: string;
  onDone: (created?: { id: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  function submit() {
    const t = name.trim();
    if (!t) return;
    startTransition(async () => {
      const r = await createVerticalAction({ clientId, name: t });
      if (r.error) alert(r.error);
      else onDone(r.data ? { id: r.data.id, name: t } : undefined);
    });
  }
  return (
    <div className="w-full space-y-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume linie (ex: Outsourcing)"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !name.trim()}>
          Adauga
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Renunta
        </Button>
      </div>
    </div>
  );
}

function RenameLineInline({
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
    const t = name.trim();
    if (!t || t === vertical.name) {
      onCancel();
      return;
    }
    startTransition(async () => {
      const r = await renameVerticalAction({ clientId, verticalId: vertical.id, name: t });
      if (r.error) {
        alert(r.error);
        onCancel();
      } else onDone();
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
      />
      <button type="button" onClick={submit} disabled={pending} className="p-1 text-primary hover:text-primary-light">
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} className="p-1 text-gray hover:text-gray-light">
        <X size={14} />
      </button>
    </div>
  );
}

function formatLei(n: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
}

// Share of a part in a whole, as a rounded integer percent. Sub-1% non-zero
// shares show "<1%" so a real-but-tiny cont never reads as "0%".
function formatShare(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const pct = (Math.abs(part) / Math.abs(whole)) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}
