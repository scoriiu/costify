"use client";

/**
 * Premium treemap visualisation of a firm's expense + revenue categories.
 *
 * Single-level treemap: each cell = one root category (Cheltuieli or
 * Venituri side). Click a cell to "select" it — the cell stays highlighted
 * with a primary border and a detail panel appears below the treemap with
 * the full list of accounts + sub-groups in that category, as a flat table.
 *
 * No drill stack, no zoom transitions — easier to learn, faster to use.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CostCategoryNode, AccountListItem } from "@/modules/categories";
import { squarify } from "@/lib/squarify";

interface Props {
  tree: CostCategoryNode[];
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
}

type Kind = "expense" | "revenue";

export function CategoryTreemap({
  tree,
  accountsByCategory,
  aggregatedRulaj,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return findNode(tree, selectedId);
  }, [tree, selectedId]);

  // Escape clears the current selection across both the treemap + tree view.
  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-[15px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Harta rulajului
          </h3>
          <p
            className="text-[11px] text-gray mt-0.5 max-w-2xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Fiecare dreptunghi reprezinta un grup, marimea lui = rulajul.
            Apasa pe un grup ca sa vezi conturile lui jos.
          </p>
        </div>
        {selectedId && (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[11px] text-primary hover:text-primary-light underline underline-offset-2 shrink-0 mt-1"
            style={{ letterSpacing: "-0.02em" }}
            title="Sau apasa Esc"
          >
            Reseteaza selectia
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TreemapPanel
          title="Cheltuieli"
          subtitle="Iesirile firmei"
          kind="expense"
          tree={tree}
          aggregatedRulaj={aggregatedRulaj}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <TreemapPanel
          title="Venituri"
          subtitle="Intrarile firmei"
          kind="revenue"
          tree={tree}
          aggregatedRulaj={aggregatedRulaj}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {selectedNode && (
        <CategoryDetail
          node={selectedNode}
          accountsByCategory={accountsByCategory}
          aggregatedRulaj={aggregatedRulaj}
          onClose={() => setSelectedId(null)}
        />
      )}

      <CategoryTreeView
        tree={tree}
        accountsByCategory={accountsByCategory}
        aggregatedRulaj={aggregatedRulaj}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              TREEMAP PANEL                                 */
/* -------------------------------------------------------------------------- */

function TreemapPanel({
  title,
  subtitle,
  kind,
  tree,
  aggregatedRulaj,
  selectedId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  kind: Kind;
  tree: CostCategoryNode[];
  aggregatedRulaj: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const roots = tree.filter((n) => n.kind === kind);
  const items = roots
    .map((n) => ({
      value: Math.max(0, aggregatedRulaj.get(n.id) ?? 0),
      data: n,
    }))
    .filter((it) => it.value > 0);

  const totalRulaj = items.reduce((s, it) => s + it.value, 0);

  return (
    <div className="rounded-lg border border-dark-3 bg-dark/40 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h4
            className="text-[13px] font-semibold text-white"
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
        <span
          className="font-mono text-[12px] text-gray-light tabular-nums shrink-0"
          style={{ letterSpacing: "-0.02em" }}
        >
          {formatRon(totalRulaj)} lei
        </span>
      </div>

      {items.length === 0 ? (
        <div className="h-[420px] flex items-center justify-center rounded-md border border-dashed border-dark-3 bg-dark-3/10">
          <p
            className="text-[12px] text-gray italic"
            style={{ letterSpacing: "-0.02em" }}
          >
            Niciun rulaj inregistrat in aceasta sectiune.
          </p>
        </div>
      ) : (
        <TreemapCanvas
          items={items}
          kind={kind}
          totalRulaj={totalRulaj}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              TREEMAP CANVAS                                */
/* -------------------------------------------------------------------------- */

function TreemapCanvas({
  items,
  kind,
  totalRulaj,
  selectedId,
  onSelect,
}: {
  items: { value: number; data: CostCategoryNode }[];
  kind: Kind;
  totalRulaj: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 420 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setSize({ w: Math.floor(cr.width), h: 420 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w > 0) {
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    }
  }, [size.w]);

  const rects = useMemo(() => {
    if (size.w === 0) return [];
    return squarify(items, { x: 0, y: 0, w: size.w, h: size.h });
  }, [items, size]);

  return (
    <div
      ref={ref}
      className="relative rounded-md overflow-hidden bg-dark-3/30"
      style={{ height: size.h }}
    >
      {rects.map((rect, idx) => {
        const isSelected = selectedId === rect.data.id;
        const isHovered = hovered === rect.data.id;
        const isDimmed =
          (selectedId !== null && !isSelected) ||
          (hovered !== null && !isHovered && selectedId === null);
        const item = items.find((it) => it.data.id === rect.data.id);
        return (
          <TreemapCell
            key={rect.data.id}
            rect={rect}
            rulaj={item?.value ?? 0}
            kind={kind}
            mounted={mounted}
            isSelected={isSelected}
            isHovered={isHovered}
            dimmed={isDimmed}
            stagger={idx * 30}
            onEnter={() => setHovered(rect.data.id)}
            onLeave={() => setHovered(null)}
            onClick={() => onSelect(isSelected ? null : rect.data.id)}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              TREEMAP CELL                                  */
/* -------------------------------------------------------------------------- */

function TreemapCell({
  rect,
  rulaj,
  kind,
  mounted,
  isSelected,
  isHovered,
  dimmed,
  stagger,
  onEnter,
  onLeave,
  onClick,
}: {
  rect: { x: number; y: number; w: number; h: number; data: CostCategoryNode };
  rulaj: number;
  kind: Kind;
  mounted: boolean;
  isSelected: boolean;
  isHovered: boolean;
  dimmed: boolean;
  stagger: number;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const node = rect.data;

  // Tiered tipography by absolute area in pixels.
  const area = rect.w * rect.h;
  const tier: "xl" | "lg" | "md" | "sm" | "xs" =
    area >= 28000 ? "xl" : area >= 14000 ? "lg" : area >= 5000 ? "md" : area >= 1800 ? "sm" : "xs";

  const palette = kind === "expense" ? EXPENSE_PALETTE : REVENUE_PALETTE;
  // Color by node position deterministically so each category keeps the same
  // colour across renders, and so adjacent cells get visibly different shades.
  const colorIdx = hashStringToInt(node.id) % palette.length;
  const bg = palette[colorIdx];

  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      title={node.name}
      className={`absolute group text-left overflow-hidden transition-all duration-300 ease-out cursor-pointer ${
        isSelected || isHovered ? "z-10" : ""
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: mounted ? rect.w : 0,
        height: mounted ? rect.h : 0,
        opacity: mounted ? (dimmed ? 0.35 : 1) : 0,
        transitionDelay: mounted ? "0ms" : `${stagger}ms`,
        background: bg,
        outline: isSelected
          ? "2px solid var(--color-primary)"
          : isHovered
          ? "1px solid rgba(255,255,255,0.5)"
          : "1px solid rgba(0,0,0,0.25)",
        outlineOffset: isSelected ? "-2px" : "-1px",
        boxShadow: isSelected || isHovered ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(0,0,0,0.18))",
        }}
        aria-hidden
      />
      <CellContent name={node.name} rulaj={rulaj} tier={tier} />
    </button>
  );
}

function CellContent({
  name,
  rulaj,
  tier,
}: {
  name: string;
  rulaj: number;
  tier: "xl" | "lg" | "md" | "sm" | "xs";
}) {
  if (tier === "xs") return null;

  if (tier === "xl") {
    return (
      <div className="relative h-full w-full p-4 flex flex-col justify-between " style={{ color: "#fff" }}>
        <h4
          className="text-[15px] font-semibold leading-tight"
          style={{ letterSpacing: "-0.04em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {name}
        </h4>
        <div
          className="font-mono text-[20px] font-bold tabular-nums leading-none"
          style={{ letterSpacing: "-0.04em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {formatRon(rulaj)}{" "}
          <span className="text-[11px] font-normal opacity-75">lei</span>
        </div>
      </div>
    );
  }

  if (tier === "lg") {
    return (
      <div className="relative h-full w-full p-3 flex flex-col justify-between " style={{ color: "#fff" }}>
        <h4
          className="text-[13px] font-semibold leading-tight line-clamp-2"
          style={{ letterSpacing: "-0.04em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {name}
        </h4>
        <div
          className="font-mono text-[14px] font-semibold tabular-nums leading-none"
          style={{ letterSpacing: "-0.04em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {formatRon(rulaj)}
        </div>
      </div>
    );
  }

  if (tier === "md") {
    return (
      <div className="relative h-full w-full p-2 flex flex-col justify-between " style={{ color: "#fff" }}>
        <h4
          className="text-[11px] font-semibold leading-tight line-clamp-2"
          style={{ letterSpacing: "-0.04em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {name}
        </h4>
        <div
          className="font-mono text-[11px] font-semibold tabular-nums"
          style={{ letterSpacing: "-0.02em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {formatRon(rulaj)}
        </div>
      </div>
    );
  }

  // sm — name only
  return (
    <div className="relative h-full w-full p-1.5 flex items-center " style={{ color: "#fff" }}>
      <span
        className="text-[10px] font-medium leading-tight line-clamp-2"
        style={{ letterSpacing: "-0.02em", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
      >
        {name}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          DETAIL PANEL (selected)                           */
/* -------------------------------------------------------------------------- */

function CategoryDetail({
  node,
  accountsByCategory,
  aggregatedRulaj,
  onClose,
}: {
  node: CostCategoryNode;
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
  onClose: () => void;
}) {
  // Flatten the subtree into a list of "lines" — each line is either a
  // sub-category header or an account row. This gives the contabil a single
  // scrollable table that shows everything inside the selected category.
  const lines = useMemo(() => flattenForDetail(node, accountsByCategory), [
    node,
    accountsByCategory,
  ]);
  const totalRulaj = aggregatedRulaj.get(node.id) ?? 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div
            className="font-mono text-[10px] uppercase tracking-wider text-primary"
            style={{ letterSpacing: "-0.02em" }}
          >
            Grup selectat ·{" "}
            {node.kind === "expense" ? "cheltuieli" : "venituri"}
          </div>
          <h4
            className="text-[16px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
            title={node.name}
          >
            {node.name}
          </h4>
          <p
            className="font-mono text-[12px] text-gray-light tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            {formatRon(totalRulaj)} lei
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray hover:text-white rounded"
          aria-label="Inchide"
        >
          <X size={14} />
        </button>
      </div>

      {lines.length === 0 ? (
        <p
          className="text-[12px] text-gray italic py-4 text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun cont mapat la acest grup.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {lines.map((line, idx) => (
            <DetailLine key={idx} line={line} />
          ))}
        </ul>
      )}
    </div>
  );
}

type DetailLineData =
  | { kind: "subcategory"; depth: number; name: string; total: number; isOmfp: boolean }
  | { kind: "account"; depth: number; cont: string; denumire: string; rulaj: number };

function DetailLine({ line }: { line: DetailLineData }) {
  if (line.kind === "subcategory") {
    return (
      <li
        className="flex items-baseline gap-3 py-1.5 border-b border-dark-3/40"
        style={{ paddingLeft: `${line.depth * 16}px` }}
      >
        <span
          className="flex-1 text-[12px] font-semibold text-gray-light truncate"
          style={{ letterSpacing: "-0.04em" }}
          title={line.name}
        >
          {line.name}
        </span>
        {line.isOmfp && (
          <span
            className="font-mono text-[9px] uppercase tracking-wider text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            OMFP
          </span>
        )}
        <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0">
          {formatRon(line.total)} lei
        </span>
      </li>
    );
  }
  return (
    <li
      className="flex items-baseline gap-3 py-1 hover:bg-dark-3/20 rounded"
      style={{ paddingLeft: `${line.depth * 16}px` }}
    >
      <span className="font-mono text-[11px] text-gray tabular-nums shrink-0 min-w-[60px]">
        {line.cont}
      </span>
      <span
        className="flex-1 text-[12px] text-gray-light truncate"
        style={{ letterSpacing: "-0.02em" }}
        title={line.denumire}
      >
        {line.denumire}
      </span>
      <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0">
        {formatRon(line.rulaj)} lei
      </span>
    </li>
  );
}

function flattenForDetail(
  root: CostCategoryNode,
  accountsByCategory: Map<string, AccountListItem[]>
): DetailLineData[] {
  const lines: DetailLineData[] = [];
  function walk(node: CostCategoryNode, depth: number) {
    if (depth > 0) {
      const total = sumCategory(node, accountsByCategory);
      lines.push({
        kind: "subcategory",
        depth,
        name: node.name,
        total,
        isOmfp: node.isOmfpDefault,
      });
    }
    const directAccounts = accountsByCategory.get(node.id) ?? [];
    for (const a of directAccounts) {
      lines.push({
        kind: "account",
        depth: depth + 1,
        cont: a.cont,
        denumire: a.denumire,
        rulaj: a.kind === "expense" ? a.rulajD : a.rulajC,
      });
    }
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }
  walk(root, 0);
  return lines;
}

function sumCategory(
  node: CostCategoryNode,
  accountsByCategory: Map<string, AccountListItem[]>
): number {
  const direct = (accountsByCategory.get(node.id) ?? []).reduce(
    (s, a) => s + (a.kind === "expense" ? a.rulajD : a.rulajC),
    0
  );
  const childrenSum = node.children.reduce(
    (s, c) => s + sumCategory(c, accountsByCategory),
    0
  );
  return direct + childrenSum;
}

/* -------------------------------------------------------------------------- */
/*                          TREE VIEW (alt visual)                            */
/* -------------------------------------------------------------------------- */

/**
 * Hierarchical tree view of the same data shown in the treemap above. Same
 * categories, same numbers, but rendered as an expandable tree with inline
 * proportion bars (each row's bar length = its share of the panel total).
 *
 * Trade-off:
 *   - Treemap shows magnitude through area, very fast at "where do the big
 *     numbers live" but cramps small leaves.
 *   - Tree view shows hierarchy + exact numbers + every leaf no matter how
 *     small, but loses the proportional visual punch.
 *
 * Selecting a row here highlights the same node in the treemap above and
 * vice-versa, so the two views are always in sync.
 */
function CategoryTreeView({
  tree,
  accountsByCategory,
  aggregatedRulaj,
  selectedId,
  onSelect,
}: {
  tree: CostCategoryNode[];
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const expenseRoots = tree.filter((n) => n.kind === "expense");
  const revenueRoots = tree.filter((n) => n.kind === "revenue");

  const expenseTotal = expenseRoots.reduce(
    (s, n) => s + (aggregatedRulaj.get(n.id) ?? 0),
    0
  );
  const revenueTotal = revenueRoots.reduce(
    (s, n) => s + (aggregatedRulaj.get(n.id) ?? 0),
    0
  );

  return (
    <div className="rounded-lg border border-dark-3 bg-dark/40 p-4 space-y-4">
      <div>
        <h4
          className="text-[13px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Vedere ierarhica
        </h4>
        <p
          className="text-[11px] text-gray mt-0.5"
          style={{ letterSpacing: "-0.02em" }}
        >
          Aceleasi date, structurate ca arbore cu bara de proportie. Apasa pe
          un grup ca sa-l vezi evidentiat si in harta.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TreeSide
          title="Cheltuieli"
          roots={expenseRoots}
          panelTotal={expenseTotal}
          accountsByCategory={accountsByCategory}
          aggregatedRulaj={aggregatedRulaj}
          selectedId={selectedId}
          onSelect={onSelect}
          accent="bg-primary"
        />
        <TreeSide
          title="Venituri"
          roots={revenueRoots}
          panelTotal={revenueTotal}
          accountsByCategory={accountsByCategory}
          aggregatedRulaj={aggregatedRulaj}
          selectedId={selectedId}
          onSelect={onSelect}
          accent="bg-violet-400"
        />
      </div>
    </div>
  );
}

function TreeSide({
  title,
  roots,
  panelTotal,
  accountsByCategory,
  aggregatedRulaj,
  selectedId,
  onSelect,
  accent,
}: {
  title: string;
  roots: CostCategoryNode[];
  panelTotal: number;
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  accent: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2 pb-2 border-b border-dark-3">
        <h5
          className="text-[12px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {title}
        </h5>
        <span className="font-mono text-[11px] text-gray-light tabular-nums">
          {formatRon(panelTotal)} lei
        </span>
      </div>
      {roots.length === 0 ? (
        <p
          className="text-[11px] text-gray italic py-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun grup cu rulaj.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {roots.map((n) => (
            <TreeRow
              key={n.id}
              node={n}
              depth={0}
              panelTotal={panelTotal}
              accountsByCategory={accountsByCategory}
              aggregatedRulaj={aggregatedRulaj}
              selectedId={selectedId}
              onSelect={onSelect}
              accent={accent}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  panelTotal,
  accountsByCategory,
  aggregatedRulaj,
  selectedId,
  onSelect,
  accent,
}: {
  node: CostCategoryNode;
  depth: number;
  panelTotal: number;
  accountsByCategory: Map<string, AccountListItem[]>;
  aggregatedRulaj: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0); // roots open by default
  const rulaj = aggregatedRulaj.get(node.id) ?? 0;
  const percent = panelTotal > 0 ? (rulaj / panelTotal) * 100 : 0;
  const directAccounts = accountsByCategory.get(node.id) ?? [];
  const hasChildren = node.children.length > 0 || directAccounts.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(isSelected ? null : node.id)}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded transition-colors text-left ${
          isSelected
            ? "bg-primary/15 outline outline-1 outline-primary/40"
            : "hover:bg-dark-3/40"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`text-gray hover:text-gray-light shrink-0 ${
            hasChildren ? "" : "invisible"
          }`}
          aria-label={expanded ? "Pliaza" : "Desfasoara"}
        >
          {expanded ? "▾" : "▸"}
        </button>

        <span
          className={`flex-1 truncate text-[12px] ${
            depth === 0 ? "font-semibold text-white" : "text-gray-light"
          }`}
          style={{ letterSpacing: "-0.04em" }}
          title={node.name}
        >
          {node.name}
        </span>

        {/* Proportion bar — light track + accent fill scaled to percent */}
        <div className="w-24 h-1.5 bg-dark-3/60 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full ${accent} transition-all`}
            style={{ width: `${Math.min(100, percent)}%` }}
            aria-hidden
          />
        </div>

        <span className="font-mono text-[11px] text-gray-light tabular-nums tabular shrink-0 w-12 text-right">
          {percent.toFixed(1)}%
        </span>
        <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0 w-24 text-right">
          {formatRon(rulaj)} lei
        </span>
      </button>

      {expanded && (
        <ul className="space-y-0.5">
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              panelTotal={panelTotal}
              accountsByCategory={accountsByCategory}
              aggregatedRulaj={aggregatedRulaj}
              selectedId={selectedId}
              onSelect={onSelect}
              accent={accent}
            />
          ))}
          {directAccounts.map((a) => (
            <li
              key={a.cont}
              className="flex items-center gap-2 py-1 px-2 hover:bg-dark-3/20 rounded"
              style={{ paddingLeft: `${(depth + 1) * 14 + 22}px` }}
            >
              <span className="font-mono text-[11px] text-gray tabular-nums shrink-0 min-w-[50px]">
                {a.cont}
              </span>
              <span
                className="flex-1 text-[11px] text-gray truncate"
                style={{ letterSpacing: "-0.02em" }}
                title={a.denumire}
              >
                {a.denumire}
              </span>
              <span className="font-mono text-[11px] text-gray tabular-nums shrink-0 w-24 text-right">
                {formatRon(
                  a.kind === "expense" ? a.rulajD : a.rulajC
                )}{" "}
                lei
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                    */
/* -------------------------------------------------------------------------- */

function findNode(tree: CostCategoryNode[], id: string): CostCategoryNode | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/* All palette entries are dark enough that white text on them keeps high
 * contrast — no light tints in the mix. Cells are differentiated by hue and
 * subtle saturation, not by brightness. */
/* Wine / burgundy palette for expenses — semantically "money going out",
 * dark enough that white text stays readable, but never the bright fire-red
 * of an error state. Inspired by aged wine, terracotta, oxblood. */
const EXPENSE_PALETTE = [
  "#5C2A2A",
  "#6B2F32",
  "#7A3438",
  "#85393E",
  "#723034",
  "#5E2628",
  "#80363A",
  "#6F2D31",
  "#542225",
  "#6A2F33",
];

/* Brand teal palette for revenues — "money coming in", calm and positive.
 * Same family as the primary brand so revenues read as the firm's intended
 * direction. */
const REVENUE_PALETTE = [
  "#0A5A4F",
  "#0D6B5E",
  "#15786A",
  "#1E8675",
  "#287E6F",
  "#194E48",
  "#0F6457",
  "#196D63",
  "#235E55",
  "#2F8175",
];

const RON = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
