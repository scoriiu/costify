/**
 * Horizontal-bar breakdown of monthly expenses (or revenues) by 2-digit class.
 *
 * One row per root category, sorted desc. Bar width is relative to the top
 * item. Sub-categories are collapsed by default and revealed when the patron
 * clicks the parent row — keeps the initial view calm while still letting
 * curious owners drill in.
 *
 * Patron labels (no OMFP terms, no account codes in the headline).
 */

"use client";

import { useState, useMemo } from "react";
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

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <Header title={title} subtitle={subtitle} />
        <p
          className="mt-4 text-[13px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          {emptyMessage ?? "Nimic de afisat pentru aceasta luna."}
        </p>
      </div>
    );
  }

  const rootMax = Math.max(...grouped.map((g) => Math.abs(g.root.value)), 1);

  function toggle(rootCode: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rootCode)) next.delete(rootCode);
      else next.add(rootCode);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <Header title={title} subtitle={subtitle} />
      <ul className="mt-5 space-y-3">
        {grouped.map((group) => (
          <BreakdownGroup
            key={group.root.code}
            group={group}
            max={rootMax}
            tone={tone}
            isExpanded={expanded.has(group.root.code)}
            onToggle={() => toggle(group.root.code)}
          />
        ))}
      </ul>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3
        className="text-[16px] font-semibold text-white"
        style={{ letterSpacing: "-0.04em" }}
      >
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
  tone,
  isExpanded,
  onToggle,
}: {
  group: GroupedItem;
  max: number;
  tone: "expenses" | "revenue";
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { root, children } = group;
  const hasChildren = children.length > 0;
  const widthPct = max > 0 ? (Math.abs(root.value) / max) * 100 : 0;
  const barColor = tone === "expenses" ? "bg-rose-400/60" : "bg-emerald-400/60";

  return (
    <li>
      <button
        type="button"
        onClick={hasChildren ? onToggle : undefined}
        disabled={!hasChildren}
        aria-expanded={hasChildren ? isExpanded : undefined}
        className={`w-full text-left ${hasChildren ? "hover:bg-dark-3/30 rounded-md -mx-2 px-2 py-1 transition-colors" : ""}`}
        style={{ cursor: hasChildren ? "pointer" : "default" }}
      >
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <span
            className="text-[13px] text-gray-light truncate flex items-center gap-1.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            {hasChildren && (
              <span
                className="text-gray-light text-[14px] inline-block transition-transform shrink-0"
                style={{
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  lineHeight: 1,
                }}
                aria-hidden
              >
                ▸
              </span>
            )}
            <span className="truncate">{root.label}</span>
            {hasChildren && (
              <span
                className="font-mono text-[9px] text-gray uppercase tracking-wider shrink-0"
                aria-hidden
              >
                {children.length} detalii
              </span>
            )}
          </span>
          <span className="font-mono text-[13px] text-white tabular-nums shrink-0">
            {lei(root.value)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-dark-3 overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${widthPct}%` }}
            />
          </div>
          <span
            className="font-mono text-[10px] text-gray shrink-0 w-12 text-right tabular-nums"
            aria-hidden
          >
            {pct(root.percent)}
          </span>
        </div>
      </button>

      {hasChildren && isExpanded && (
        <ul className="mt-2 space-y-1.5">
          {children.map((child) => (
            <li
              key={child.code}
              className="flex items-baseline justify-between gap-3"
              style={{ paddingLeft: `${(child.depth ?? 1) * 1.25}rem` }}
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

/**
 * Reshape the flat depth-tagged item list into root groups so we can render
 * one collapsible block per root and only walk the child list when it is
 * expanded. The compute layer guarantees depth-first order (root, its kids,
 * next root, etc.) so a single pass is enough.
 */
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
