/**
 * Horizontal-bar breakdown of monthly expenses (or revenues) by 2-digit class.
 *
 * One row per category, sorted desc. Bar width is relative to the top item.
 * Patron labels (no OMFP terms, no account codes in the headline).
 */

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

export function CategoryBreakdownCard({
  title,
  subtitle,
  items,
  tone,
  emptyMessage,
}: Props) {
  if (items.length === 0) {
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

  const max = Math.max(...items.map((i) => Math.abs(i.value)));

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <Header title={title} subtitle={subtitle} />
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <BreakdownBar key={item.code} item={item} max={max} tone={tone} />
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

function BreakdownBar({
  item,
  max,
  tone,
}: {
  item: CategoryBreakdownItem;
  max: number;
  tone: "expenses" | "revenue";
}) {
  const widthPct = max > 0 ? (Math.abs(item.value) / max) * 100 : 0;
  const barColor =
    tone === "expenses"
      ? "bg-rose-400/60"
      : "bg-emerald-400/60";

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span
          className="text-[13px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
        >
          {item.label}
        </span>
        <span className="font-mono text-[13px] text-white tabular-nums shrink-0">
          {lei(item.value)}
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
          {pct(item.percent)}
        </span>
      </div>
    </li>
  );
}
