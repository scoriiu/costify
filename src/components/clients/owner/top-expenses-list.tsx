"use client";

/**
 * Top monthly expense accounts as a ranked list with relative bars + an
 * optional 6-month sparkline per row (when historical data is available).
 *
 * The user sees not only "what cost most THIS month" but also "is this cost
 * going up or down over time?" — vital for cost-cutting decisions.
 *
 * Patron labels only — no account codes shown in the headline.
 */

import { useState } from "react";
import { Receipt, ArrowUp, ArrowDown } from "lucide-react";
import type { TopMonthlyExpense } from "@/modules/reporting/owner";
import { lei, pct } from "@/lib/owner-format";

interface Props {
  items: TopMonthlyExpense[];
  title?: string;
  subtitle?: string;
  /** Optional: per-account 6-point history (oldest..newest). When provided,
   *  a mini-sparkline is rendered next to the row so the user sees the
   *  trend without a click. Map key = cont code. */
  historyByCont?: Record<string, number[]>;
}

const VISIBLE_LIMIT = 8;

export function TopExpensesList({
  items,
  title = "Top cheltuieli ale lunii",
  subtitle,
  historyByCont,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, VISIBLE_LIMIT);
  const hasMore = items.length > VISIBLE_LIMIT;
  const max = items.length > 0 ? items[0].value : 1;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3
          className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          <Receipt size={15} className="text-primary" />
          {title}
        </h3>
        {subtitle && (
          <p
            className="mt-0.5 text-[12px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="px-5 py-8 text-[13px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nicio cheltuiala inregistrata luna aceasta.
        </p>
      ) : (
        <>
          <ol className="divide-y divide-dark-3">
            {visible.map((item, idx) => {
              const history = historyByCont?.[item.cont];
              return (
                <Row
                  key={item.cont}
                  item={item}
                  rank={idx + 1}
                  max={max}
                  history={history}
                />
              );
            })}
          </ol>

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="block w-full border-t border-dark-3 px-5 py-3 text-center text-[12px] font-medium text-gray-light hover:bg-dark-3/40 hover:text-white transition-colors cursor-pointer"
            >
              {expanded
                ? `Ascunde cele ${items.length - VISIBLE_LIMIT} cheltuieli`
                : `Vezi toate ${items.length} cheltuielile`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  item,
  rank,
  max,
  history,
}: {
  item: TopMonthlyExpense;
  rank: number;
  max: number;
  history?: number[];
}) {
  const barWidth = max > 0 ? (item.value / max) * 100 : 0;
  const trend = history && history.length >= 2 ? computeTrend(history) : null;

  return (
    <li className="px-5 py-3 hover:bg-dark-3/20 transition-colors">
      <div className="flex items-center gap-3 mb-1.5">
        <span
          className="font-mono text-[10px] text-gray w-6 shrink-0 tabular-nums"
          aria-hidden
        >
          {String(rank).padStart(2, "0")}
        </span>
        <span
          className="flex-1 min-w-0 text-[13px] text-white truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={item.denumire}
        >
          {item.denumire}
        </span>
        {history && history.length >= 2 && <TrendSpark values={history} />}
        {trend && <TrendBadge direction={trend.direction} pct={trend.pct} />}
        <span className="font-mono text-[10px] text-gray w-11 text-right tabular-nums shrink-0">
          {pct(item.percent)}
        </span>
        <span className="font-mono text-[13px] text-white tabular-nums shrink-0 w-24 text-right">
          {lei(item.value)}
        </span>
      </div>
      <div className="ml-9 h-1 rounded-full bg-dark-3 overflow-hidden">
        <div
          className="h-full bg-rose-400/60 rounded-full transition-all"
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </li>
  );
}

function TrendSpark({ values }: { values: number[] }) {
  const w = 48;
  const h = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const path = values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="shrink-0 opacity-70"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-gray-light)"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendBadge({
  direction,
  pct,
}: {
  direction: "up" | "down" | "flat";
  pct: number;
}) {
  if (direction === "flat") return null;
  // For an expense, UP is bad (red), DOWN is good (green).
  const isUp = direction === "up";
  const Icon = isUp ? ArrowUp : ArrowDown;
  const tone = isUp ? "text-neg" : "text-pos";
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums shrink-0 ${tone}`}
      style={{ letterSpacing: "-0.02em" }}
      title={`Trendul ultimelor 6 luni: ${isUp ? "in crestere" : "in scadere"}`}
    >
      <Icon size={10} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function computeTrend(values: number[]): {
  direction: "up" | "down" | "flat";
  pct: number;
} {
  // Compare the last value to the average of all but the last — gives a
  // smoother signal than just "vs previous month".
  if (values.length < 2) return { direction: "flat", pct: 0 };
  const last = values[values.length - 1];
  const earlier = values.slice(0, -1);
  const avg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
  if (avg === 0) return { direction: "flat", pct: 0 };
  const pct = ((last - avg) / Math.abs(avg)) * 100;
  if (Math.abs(pct) < 5) return { direction: "flat", pct };
  return { direction: pct > 0 ? "up" : "down", pct };
}
