"use client";

/**
 * Category breakdown — interactive donut + linked list.
 *
 * Donut on the left: each slice = one root category. Hover slice → highlight
 * the corresponding row in the list (and vice-versa). Center of the donut
 * shows either the total or, when hovering a slice, the slice's value+name.
 *
 * List on the right: rows still expandable to show sub-categories. The hover
 * affordance is bidirectional (hovering a row dims the other slices in the
 * donut).
 *
 * Tone follows the prop: "expenses" = warm red palette, "revenue" = cool teal.
 * Empty state preserved.
 */

import { useMemo, useState } from "react";
import { ChevronRight, PieChart as PieIcon } from "lucide-react";
import type { CategoryBreakdownItem } from "@/modules/reporting/owner";
import { lei, pct } from "@/lib/owner-format";

interface Props {
  title: string;
  subtitle?: string;
  items: CategoryBreakdownItem[];
  /** Visual tone for the bars; "expenses" = warm/red, "revenue" = teal/positive */
  tone: "expenses" | "revenue";
  emptyMessage?: string;
}

interface GroupedItem {
  root: CategoryBreakdownItem;
  children: CategoryBreakdownItem[];
}

export function CategoryBreakdownCard({
  title,
  subtitle,
  items,
  tone,
  emptyMessage,
}: Props) {
  const grouped = useMemo(() => groupItems(items), [items]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // Build a palette by tone — every root gets its own hue within the family.
  // Using fixed positions so the chart is deterministic across renders.
  const palette = useMemo(
    () => buildPalette(grouped.length, tone),
    [grouped.length, tone]
  );

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <Header title={title} subtitle={subtitle} />
        <p
          className="mt-4 text-[13px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          {emptyMessage ?? "Nimic de afisat pentru aceasta luna."}
        </p>
      </div>
    );
  }

  const total = grouped.reduce((s, g) => s + Math.abs(g.root.value), 0);
  const rootMax = Math.max(...grouped.map((g) => Math.abs(g.root.value)), 1);

  function toggle(rootCode: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rootCode)) next.delete(rootCode);
      else next.add(rootCode);
      return next;
    });
  }

  const hovered = hoverKey ? grouped.find((g) => g.root.code === hoverKey) : null;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <Header title={title} subtitle={subtitle} />

      <div className="mt-5 flex flex-col lg:flex-row gap-6 items-center lg:items-start">
        {/* Donut */}
        <div className="relative shrink-0">
          <Donut
            groups={grouped}
            total={total}
            palette={palette}
            hoverKey={hoverKey}
            onHoverKey={setHoverKey}
          />
          <DonutCenter
            total={total}
            hovered={hovered ?? null}
            tone={tone}
          />
        </div>

        {/* List */}
        <ul className="flex-1 w-full space-y-2.5 min-w-0">
          {grouped.map((group, idx) => (
            <BreakdownGroup
              key={group.root.code}
              group={group}
              max={rootMax}
              color={palette[idx]}
              isExpanded={expanded.has(group.root.code)}
              isHovered={hoverKey === group.root.code}
              isDimmed={hoverKey !== null && hoverKey !== group.root.code}
              onToggle={() => toggle(group.root.code)}
              onHover={() => setHoverKey(group.root.code)}
              onLeave={() => setHoverKey(null)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------- Donut & center ----------------------------- */

const DONUT_SIZE = 200;
const DONUT_R = 84;
const DONUT_STROKE = 28;

function Donut({
  groups,
  total,
  palette,
  hoverKey,
  onHoverKey,
}: {
  groups: GroupedItem[];
  total: number;
  palette: string[];
  hoverKey: string | null;
  onHoverKey: (key: string | null) => void;
}) {
  const center = DONUT_SIZE / 2;
  const circumference = 2 * Math.PI * DONUT_R;

  // Filter zero-value groups so they don't take up arc length.
  const renderable = groups
    .map((g, idx) => ({ g, idx, value: Math.abs(g.root.value) }))
    .filter((x) => x.value > 0.01);

  let cumulative = 0;
  return (
    <svg
      width={DONUT_SIZE}
      height={DONUT_SIZE}
      viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
      role="img"
      aria-label="Distributie pe categorii"
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={DONUT_R}
        fill="none"
        stroke="var(--color-dark-3)"
        strokeWidth={DONUT_STROKE}
        opacity={0.5}
      />
      {renderable.map(({ g, idx, value }) => {
        const fraction = total > 0 ? value / total : 0;
        const dash = circumference * fraction;
        const gap = circumference - dash;
        const offset = circumference * (cumulative / total) - circumference / 4;
        cumulative += value;
        const isHovered = hoverKey === g.root.code;
        const dimmed = hoverKey !== null && !isHovered;
        return (
          <circle
            key={g.root.code}
            cx={center}
            cy={center}
            r={DONUT_R}
            fill="none"
            stroke={palette[idx]}
            strokeWidth={isHovered ? DONUT_STROKE + 4 : DONUT_STROKE}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            opacity={dimmed ? 0.35 : 1}
            onMouseEnter={() => onHoverKey(g.root.code)}
            onMouseLeave={() => onHoverKey(null)}
            style={{
              cursor: "pointer",
              transition: "stroke-width 120ms ease-out, opacity 120ms ease-out",
            }}
          />
        );
      })}
    </svg>
  );
}

function DonutCenter({
  total,
  hovered,
  tone,
}: {
  total: number;
  hovered: GroupedItem | null;
  tone: "expenses" | "revenue";
}) {
  const headlineTone =
    tone === "expenses" ? "text-rose-300" : "text-emerald-300";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
      <p
        className="font-mono text-[9px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "0.06em" }}
      >
        {hovered ? hovered.root.label : tone === "expenses" ? "Total" : "Total"}
      </p>
      <p
        className={`mt-1 font-mono text-[20px] font-semibold tabular-nums ${headlineTone}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {lei(hovered ? Math.abs(hovered.root.value) : total)}
      </p>
      {hovered && (
        <p
          className="mt-0.5 font-mono text-[10px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          {pct(hovered.root.percent)} din total
        </p>
      )}
    </div>
  );
}

/* ------------------------------- List rows -------------------------------- */

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3
        className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
        style={{ letterSpacing: "-0.04em" }}
      >
        <PieIcon size={14} className="text-primary" />
        {title}
      </h3>
      {subtitle && (
        <p
          className="mt-1 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function BreakdownGroup({
  group,
  max,
  color,
  isExpanded,
  isHovered,
  isDimmed,
  onToggle,
  onHover,
  onLeave,
}: {
  group: GroupedItem;
  max: number;
  color: string;
  isExpanded: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  onToggle: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const { root, children } = group;
  const hasChildren = children.length > 0;
  const widthPct = max > 0 ? (Math.abs(root.value) / max) * 100 : 0;

  return (
    <li onMouseEnter={onHover} onMouseLeave={onLeave}>
      <button
        type="button"
        onClick={hasChildren ? onToggle : undefined}
        disabled={!hasChildren}
        aria-expanded={hasChildren ? isExpanded : undefined}
        className={`w-full text-left rounded-md -mx-2 px-2 py-1.5 transition-all ${
          hasChildren ? "hover:bg-dark-3/40" : ""
        } ${isHovered ? "bg-dark-3/40" : ""} ${
          isDimmed ? "opacity-50" : "opacity-100"
        }`}
        style={{ cursor: hasChildren ? "pointer" : "default" }}
      >
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span
            className="text-[13px] text-gray-light flex items-center gap-1.5 min-w-0"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {hasChildren && (
              <ChevronRight
                size={12}
                className="text-gray shrink-0 transition-transform"
                style={{
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                }}
                aria-hidden
              />
            )}
            <span className="truncate text-white">{root.label}</span>
            {hasChildren && (
              <span
                className="font-mono text-[9px] text-gray uppercase tracking-wider shrink-0"
                aria-hidden
              >
                {children.length} detalii
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[13px] text-white tabular-nums">
              {lei(root.value)}
            </span>
            <span className="font-mono text-[10px] text-gray tabular-nums w-10 text-right">
              {pct(root.percent)}
            </span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-dark-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${widthPct}%`, backgroundColor: color, opacity: 0.7 }}
          />
        </div>
      </button>

      {hasChildren && isExpanded && (
        <ul className="mt-2 space-y-1.5 pb-1">
          {children.map((child) => (
            <li
              key={child.code}
              className="flex items-baseline justify-between gap-3"
              style={{ paddingLeft: `${(child.depth ?? 1) * 1.25 + 1}rem` }}
            >
              <span
                className="text-[12px] text-gray-light truncate flex items-center gap-1.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                <span className="text-gray" aria-hidden>
                  ›
                </span>
                {child.label}
              </span>
              <span className="font-mono text-[12px] text-gray-light tabular-nums shrink-0">
                {lei(child.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/* --------------------------------- Utils --------------------------------- */

/**
 * Build a palette with N colors in the requested family (rose-ish for
 * expenses, teal/emerald for revenue). Colors are spaced via HSL so the
 * donut reads as a coherent set, not a rainbow.
 */
function buildPalette(n: number, tone: "expenses" | "revenue"): string[] {
  if (n === 0) return [];
  // Anchor hues for the family.
  const anchor = tone === "expenses" ? 350 : 165;
  const range = 50; // total hue spread
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const hue = anchor - range / 2 + range * t;
    const saturation = 60;
    const lightness = 65 - t * 15; // gradient from light to slightly darker
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  });
}

function groupItems(items: CategoryBreakdownItem[]): GroupedItem[] {
  const out: GroupedItem[] = [];
  let current: GroupedItem | null = null;

  for (const item of items) {
    if ((item.depth ?? 0) === 0) {
      current = { root: item, children: [] };
      out.push(current);
    } else if (current) {
      current.children.push(item);
    }
  }

  return out;
}
