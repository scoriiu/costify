"use client";

/**
 * Cashflow Map — owner-side treemap of expense + revenue categories.
 *
 * Purpose (entrepreneur lens, NOT accountant lens):
 *   answers "pe ce s-au dus banii luna asta?" and "de unde au venit?"
 *   in two seconds without reading anything.
 *
 * Why not reuse the accountant CategoryTreemap from mapari-cashflow:
 *   - that component shows OMFP account codes, "denumire", and an
 *     "OMFP" badge in its detail panel. Those are jargon the
 *     entrepreneur should never see (AGENTS.md bilingual rule).
 *   - it also renders a duplicate hierarchical tree view ("Vedere
 *     ierarhica") below the map, which is redundant on /firma where
 *     the donut breakdown is already on the same page.
 *
 * What this component does instead:
 *   - takes the pre-computed flat breakdown lists from OwnerSnapshot
 *     (expenseBreakdown / revenueBreakdown). They are already in
 *     entrepreneur language with no conts, no OMFP codes.
 *   - renders ONE treemap per side (Cheltuieli / Venituri), root-level
 *     cells only. Cell size = magnitude of the root category.
 *   - on click, expands a detail panel showing the children of the
 *     selected root (depth > 0 items from the flat list), with names
 *     and amounts only. No codes, no OMFP, no "denumire".
 *
 * The mapping from flat list to (root, children) is implicit in the
 * list order: the breakdown comes out of computeBreakdownByCategory
 * as a depth-first walk, so every depth>0 item belongs to the most
 * recent depth=0 root.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CategoryBreakdownItem } from "@/modules/reporting/owner";
import { squarify } from "@/lib/squarify";
import { ChartInfo } from "./chart-info";
import { MonthChips, type MonthChipOption } from "./month-chips";
import { usePublishedSnapshot } from "./use-published-snapshot";

interface Props {
  expenseBreakdown: CategoryBreakdownItem[];
  revenueBreakdown: CategoryBreakdownItem[];
  /** Period label like "Aprilie 2026", used in the empty-state copy. */
  periodLabel: string;
  /** In-card month switching (drill-down pattern). All four are needed
   *  together; when absent the map is static, exactly as before. */
  clientId?: string;
  currentYear?: number;
  currentMonth?: number;
  publishedPeriods?: MonthChipOption[];
}

type Kind = "expense" | "revenue";

interface CategoryGroup {
  /** Stable identifier — the `code` field of the root (category id or "fallback:NN"). */
  id: string;
  label: string;
  value: number;
  /** Direct children of the root, depth=1. Empty when the root is atomic. */
  children: CategoryBreakdownItem[];
}

export function CashflowMap({
  expenseBreakdown,
  revenueBreakdown,
  periodLabel,
  clientId,
  currentYear,
  currentMonth,
  publishedPeriods = [],
}: Props) {
  const canSwitchMonths =
    clientId !== undefined &&
    currentYear !== undefined &&
    currentMonth !== undefined &&
    publishedPeriods.length > 1;

  const [viewed, setViewed] = useState<{ year: number; month: number } | null>(null);
  const fetched = usePublishedSnapshot(clientId ?? "");

  const isPageMonth =
    viewed === null || (viewed.year === currentYear && viewed.month === currentMonth);

  const activeExpense = isPageMonth
    ? expenseBreakdown
    : fetched.snapshot?.expenseBreakdown ?? [];
  const activeRevenue = isPageMonth
    ? revenueBreakdown
    : fetched.snapshot?.revenueBreakdown ?? [];
  const activeLabel = isPageMonth
    ? periodLabel
    : fetched.snapshot?.meta.periodLabel ?? periodLabel;

  const expenseGroups = useMemo(() => groupRoots(activeExpense), [activeExpense]);
  const revenueGroups = useMemo(() => groupRoots(activeRevenue), [activeRevenue]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  function selectMonth(year: number, month: number) {
    setSelectedId(null);
    if (year === currentYear && month === currentMonth) {
      setViewed(null);
      fetched.reset();
      return;
    }
    setViewed({ year, month });
    void fetched.load(year, month);
  }

  // Find the selected group across both sides — selection lives at the
  // CashflowMap level so clicking a Cheltuieli cell clears any Venituri
  // selection and vice versa. One thing-at-a-time keeps the page calm.
  const selected = useMemo(() => {
    if (!selectedId) return null;
    const exp = expenseGroups.find((g) => g.id === selectedId);
    if (exp) return { group: exp, kind: "expense" as Kind };
    const rev = revenueGroups.find((g) => g.id === selectedId);
    if (rev) return { group: rev, kind: "revenue" as Kind };
    return null;
  }, [selectedId, expenseGroups, revenueGroups]);

  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // Click anywhere outside a cell or the detail panel deselects. We listen
  // on `mousedown` so this fires BEFORE a cell's own click handler — clicks
  // landing inside `[data-cashflow-interactive]` (cells + detail) skip
  // the document-level deselect and let the local handlers run normally.
  useEffect(() => {
    if (!selectedId) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-cashflow-interactive]")) return;
      setSelectedId(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [selectedId]);

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Pe ce s-au dus banii, de unde au venit
            <ChartInfo text="Harta banilor lunii. Fiecare patrat e o linie de cost: in stanga cheltuielile, in dreapta veniturile. Cu cat patratul e mai mare, cu atat suma e mai mare. Apasa pe un patrat ca sa vezi ce contine. Cu butoanele de luni de deasupra schimbi luna afisata, fara sa parasesti pagina." />
          </h3>
          <p
            className="text-[11px] text-gray mt-0.5 max-w-2xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Cat e patratul mai mare, cu atat suma e mai mare. Apasa pe o
            linie de cost ca sa vezi ce contine.
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
            Inchide
          </button>
        )}
      </header>

      {canSwitchMonths && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonthChips
            options={publishedPeriods}
            activeYear={viewed?.year ?? currentYear ?? 0}
            activeMonth={viewed?.month ?? currentMonth ?? 0}
            onSelect={selectMonth}
          />
          {!isPageMonth && !fetched.loading && !fetched.error && (
            <p className="font-mono text-[11px] uppercase text-gray" data-testid="map-viewed-month">
              {activeLabel}
            </p>
          )}
        </div>
      )}

      {!isPageMonth && fetched.error && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {fetched.error}
        </p>
      )}

      <div
        className={`grid gap-4 lg:grid-cols-2 transition-opacity ${
          !isPageMonth && fetched.loading ? "animate-pulse opacity-50" : ""
        }`}
      >
        <MapPanel
          title="Cheltuieli"
          subtitle="Iesirile firmei"
          kind="expense"
          groups={expenseGroups}
          selectedId={selectedId}
          onSelect={setSelectedId}
          periodLabel={activeLabel}
        />
        <MapPanel
          title="Venituri"
          subtitle="Intrarile firmei"
          kind="revenue"
          groups={revenueGroups}
          selectedId={selectedId}
          onSelect={setSelectedId}
          periodLabel={activeLabel}
        />
      </div>

      {selected && (
        <CategoryDetail
          group={selected.group}
          kind={selected.kind}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  GROUPING                                   */
/* -------------------------------------------------------------------------- */

/**
 * Reduce the depth-encoded flat breakdown into a list of (root, children).
 * Each depth=0 item starts a new group; all subsequent depth>0 items belong
 * to that group until the next depth=0 row.
 *
 * Children deeper than depth=1 are intentionally flattened away — the
 * entrepreneur doesn't need a tree, just the immediate sub-groups under
 * the headline. Depth-2 items (rare in practice) would create visual
 * noise without adding decision value.
 */
function groupRoots(items: CategoryBreakdownItem[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const item of items) {
    const depth = item.depth ?? 0;
    if (depth === 0) {
      groups.push({
        id: item.code,
        label: item.label,
        value: item.value,
        children: [],
      });
      continue;
    }
    if (depth === 1) {
      const current = groups[groups.length - 1];
      if (current) current.children.push(item);
    }
    // depth >= 2 — drop on the floor for the owner view.
  }
  // Owner sees positives in BOTH expense and revenue as "money flowing".
  // Absolute value for ranking; small entries dropped to keep the map clean.
  return groups
    .filter((g) => Math.abs(g.value) >= 0.01)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/* -------------------------------------------------------------------------- */
/*                                  PANELS                                    */
/* -------------------------------------------------------------------------- */

function MapPanel({
  title,
  subtitle,
  kind,
  groups,
  selectedId,
  onSelect,
  periodLabel,
}: {
  title: string;
  subtitle: string;
  kind: Kind;
  groups: CategoryGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  periodLabel: string;
}) {
  const total = groups.reduce((s, g) => s + Math.abs(g.value), 0);

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
          {formatRon(total)} lei
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyPanel kind={kind} periodLabel={periodLabel} />
      ) : (
        <MapCanvas
          groups={groups}
          kind={kind}
          panelTotal={total}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function EmptyPanel({ kind, periodLabel }: { kind: Kind; periodLabel: string }) {
  const msg =
    kind === "expense"
      ? `Nicio cheltuiala in ${periodLabel.toLowerCase()}.`
      : `Niciun venit in ${periodLabel.toLowerCase()}.`;
  return (
    <div className="h-[420px] flex items-center justify-center rounded-md border border-dashed border-dark-3 bg-dark-3/10">
      <p
        className="text-[12px] text-gray italic"
        style={{ letterSpacing: "-0.02em" }}
      >
        {msg}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   CANVAS                                    */
/* -------------------------------------------------------------------------- */

function MapCanvas({
  groups,
  kind,
  panelTotal,
  selectedId,
  onSelect,
}: {
  groups: CategoryGroup[];
  kind: Kind;
  panelTotal: number;
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

  const items = useMemo(
    () => groups.map((g) => ({ value: Math.abs(g.value), data: g })),
    [groups],
  );

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
        return (
          <MapCell
            key={rect.data.id}
            rect={rect}
            kind={kind}
            panelTotal={panelTotal}
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
/*                                    CELL                                     */
/* -------------------------------------------------------------------------- */

function MapCell({
  rect,
  kind,
  panelTotal,
  mounted,
  isSelected,
  isHovered,
  dimmed,
  stagger,
  onEnter,
  onLeave,
  onClick,
}: {
  rect: { x: number; y: number; w: number; h: number; data: CategoryGroup };
  kind: Kind;
  panelTotal: number;
  mounted: boolean;
  isSelected: boolean;
  isHovered: boolean;
  dimmed: boolean;
  stagger: number;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const group = rect.data;
  const value = Math.abs(group.value);
  const sharePct =
    panelTotal > 0 ? Math.round((value / panelTotal) * 100) : 0;

  // Five typography tiers by cell area in pixels.
  const area = rect.w * rect.h;
  const tier: "xl" | "lg" | "md" | "sm" | "xs" =
    area >= 28000
      ? "xl"
      : area >= 14000
      ? "lg"
      : area >= 5000
      ? "md"
      : area >= 1800
      ? "sm"
      : "xs";

  const palette = kind === "expense" ? EXPENSE_PALETTE : REVENUE_PALETTE;
  const colorIdx = hashStringToInt(group.id) % palette.length;
  const bg = palette[colorIdx];

  // Title attribute gives accessibility + a comparison signal on hover
  // without needing a separate tooltip component.
  const titleText = `${group.label} · ${formatRon(value)} lei (${sharePct}%)`;

  return (
    <button
      type="button"
      data-cashflow-interactive
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      title={titleText}
      aria-label={titleText}
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
          ? "1px solid rgba(255,255,255,0.55)"
          : "1px solid rgba(0,0,0,0.22)",
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
      <CellContent
        label={group.label}
        value={value}
        sharePct={sharePct}
        tier={tier}
      />
    </button>
  );
}

function CellContent({
  label,
  value,
  sharePct,
  tier,
}: {
  label: string;
  value: number;
  sharePct: number;
  tier: "xl" | "lg" | "md" | "sm" | "xs";
}) {
  if (tier === "xs") return null;

  if (tier === "xl") {
    return (
      <div
        className="relative h-full w-full p-4 flex flex-col justify-between"
        style={{ color: "#fff" }}
      >
        <h4
          className="text-[15px] font-semibold leading-tight"
          style={{
            letterSpacing: "-0.04em",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          {label}
        </h4>
        <div className="space-y-0.5">
          <div
            className="font-mono text-[20px] font-bold tabular-nums leading-none"
            style={{
              letterSpacing: "-0.04em",
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {formatRon(value)}{" "}
            <span className="text-[11px] font-normal opacity-75">lei</span>
          </div>
          <div
            className="font-mono text-[11px] opacity-80"
            style={{ letterSpacing: "-0.02em" }}
          >
            {sharePct}% din total
          </div>
        </div>
      </div>
    );
  }

  if (tier === "lg") {
    return (
      <div
        className="relative h-full w-full p-3 flex flex-col justify-between"
        style={{ color: "#fff" }}
      >
        <h4
          className="text-[13px] font-semibold leading-tight line-clamp-2"
          style={{
            letterSpacing: "-0.04em",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          {label}
        </h4>
        <div className="space-y-0.5">
          <div
            className="font-mono text-[14px] font-semibold tabular-nums leading-none"
            style={{
              letterSpacing: "-0.04em",
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {formatRon(value)}
          </div>
          <div
            className="font-mono text-[10px] opacity-75"
            style={{ letterSpacing: "-0.02em" }}
          >
            {sharePct}%
          </div>
        </div>
      </div>
    );
  }

  if (tier === "md") {
    return (
      <div
        className="relative h-full w-full p-2 flex flex-col justify-between"
        style={{ color: "#fff" }}
      >
        <h4
          className="text-[11px] font-semibold leading-tight line-clamp-2"
          style={{
            letterSpacing: "-0.04em",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          {label}
        </h4>
        <div
          className="font-mono text-[11px] font-semibold tabular-nums"
          style={{
            letterSpacing: "-0.02em",
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          }}
        >
          {formatRon(value)}
        </div>
      </div>
    );
  }

  // sm — name only
  return (
    <div
      className="relative h-full w-full p-1.5 flex items-center"
      style={{ color: "#fff" }}
    >
      <span
        className="text-[10px] font-medium leading-tight line-clamp-2"
        style={{
          letterSpacing: "-0.02em",
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              DETAIL (selected)                              */
/* -------------------------------------------------------------------------- */

function CategoryDetail({
  group,
  kind,
  onClose,
}: {
  group: CategoryGroup;
  kind: Kind;
  onClose: () => void;
}) {
  const total = Math.abs(group.value);

  // Semantic framing: red for cheltuieli, green for venituri (same calm,
  // low-opacity treatment as the Linii view).
  const isExpense = kind === "expense";
  const frameClass = isExpense
    ? "border-neg/30 bg-neg/[0.04]"
    : "border-pos/30 bg-pos/[0.04]";
  const toneClass = isExpense ? "text-neg" : "text-pos";

  return (
    <div
      data-cashflow-interactive
      className={`rounded-lg border ${frameClass} p-4`}
    >
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div
            className={`font-mono text-[10px] uppercase tracking-wider ${toneClass}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {isExpense ? "Cheltuieli" : "Venituri"}
          </div>
          <h4
            className="text-[16px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
            title={group.label}
          >
            {group.label}
          </h4>
          <p
            className={`font-mono text-[12px] tabular-nums ${toneClass}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {formatRon(total)} lei
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray hover:text-white rounded"
          aria-label="Inchide detaliul"
        >
          <X size={14} />
        </button>
      </header>

      {group.children.length === 0 ? (
        <p
          className="text-[12px] text-gray italic py-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Aceasta linie de cost nu are sub-linii.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {group.children
            .slice()
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .map((child) => {
              const childValue = Math.abs(child.value);
              const childPct =
                total > 0 ? Math.round((childValue / total) * 100) : 0;
              return (
                <li
                  key={child.code}
                  className="flex items-baseline gap-3 py-1.5 px-2 rounded hover:bg-dark-3/20"
                >
                  <span
                    className="flex-1 text-[12px] text-gray-light truncate"
                    style={{ letterSpacing: "-0.02em" }}
                    title={child.label}
                  >
                    {child.label}
                  </span>
                  <span className="font-mono text-[11px] text-gray tabular-nums shrink-0 w-10 text-right">
                    {childPct}%
                  </span>
                  <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0">
                    {formatRon(childValue)} lei
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                    */
/* -------------------------------------------------------------------------- */

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Expense palette: warm wine/burgundy. Dark enough that white text stays
// readable; never the alarm-red of an error. Same family as the accountant
// treemap but a touch softer so the entrepreneur view doesn't feel
// confrontational.
const EXPENSE_PALETTE = [
  "#6B2F32",
  "#7A3438",
  "#85393E",
  "#723034",
  "#80363A",
  "#6F2D31",
  "#5C2A2A",
  "#6A2F33",
];

// Revenue palette: brand teal — "banii care vin", calm and positive.
const REVENUE_PALETTE = [
  "#0A5A4F",
  "#0D6B5E",
  "#15786A",
  "#1E8675",
  "#287E6F",
  "#194E48",
  "#0F6457",
  "#196D63",
];

const RON = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
