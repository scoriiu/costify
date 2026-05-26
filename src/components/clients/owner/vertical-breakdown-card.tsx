/**
 * VerticalBreakdownCard — how each business line contributed to the month.
 *
 * Each vertical gets a row with:
 *   - Name + share of total expenses
 *   - A two-segment bar: revenue (teal) + expenses (rose), proportional to
 *     the max across all verticals so widths are honestly comparable
 *   - Net profit on the right, colored by sign
 *
 * Hidden when nothing meaningful exists. PR-2c module.
 */

import { Layers } from "lucide-react";
import type { VerticalBreakdownItem } from "@/modules/reporting/owner";
import { lei, pct } from "@/lib/owner-format";

interface Props {
  items: VerticalBreakdownItem[];
  periodLabel: string;
}

export function VerticalBreakdownCard({ items, periodLabel }: Props) {
  if (items.length === 0) return null;

  const anyNonZero = items.some(
    (i) => Math.abs(i.revenue) > 0.01 || Math.abs(i.expenses) > 0.01
  );
  const visible = anyNonZero
    ? items.filter(
        (i) => Math.abs(i.revenue) > 0.01 || Math.abs(i.expenses) > 0.01
      )
    : items;

  if (visible.length === 0) return null;

  const maxValue = Math.max(
    ...visible.map((i) => Math.max(i.revenue, i.expenses)),
    1
  );

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3
          className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          <Layers size={15} className="text-primary" />
          Pe linii de business
        </h3>
        <p
          className="mt-0.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Cum a contribuit fiecare verticala in {periodLabel}.
        </p>
      </div>

      <ul className="divide-y divide-dark-3">
        {visible.map((item) => (
          <VerticalRow key={item.verticalId} item={item} max={maxValue} />
        ))}
      </ul>
    </div>
  );
}

function VerticalRow({
  item,
  max,
}: {
  item: VerticalBreakdownItem;
  max: number;
}) {
  const profitTone =
    item.profit > 0 ? "text-pos" : item.profit < 0 ? "text-neg" : "text-gray-light";
  const revPct = max > 0 ? (item.revenue / max) * 100 : 0;
  const expPct = max > 0 ? (item.expenses / max) * 100 : 0;

  return (
    <li className="px-5 py-4 hover:bg-dark-3/20 transition-colors">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <span
          className="text-[14px] font-semibold text-white truncate"
          style={{ letterSpacing: "-0.04em" }}
          title={item.name}
        >
          {item.name}
        </span>
        <div className="flex items-baseline gap-3 shrink-0">
          {item.expenseSharePct > 0.5 && (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-gray tabular-nums"
              style={{ letterSpacing: "0.04em" }}
            >
              {pct(item.expenseSharePct)} din total
            </span>
          )}
          <span
            className={`font-mono text-[14px] font-semibold tabular-nums ${profitTone}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {item.profit >= 0 ? "+" : ""}
            {lei(item.profit)}
          </span>
        </div>
      </div>

      <BiBar label="venituri" value={item.revenue} widthPct={revPct} tone="pos" />
      <div className="h-1.5" />
      <BiBar label="cheltuieli" value={item.expenses} widthPct={expPct} tone="neg" />
    </li>
  );
}

function BiBar({
  label,
  value,
  widthPct,
  tone,
}: {
  label: string;
  value: number;
  widthPct: number;
  tone: "pos" | "neg";
}) {
  const barClass = tone === "pos" ? "bg-pos/70" : "bg-neg/70";
  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-[10px] uppercase tracking-wider text-gray w-20 shrink-0"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-dark-3 overflow-hidden">
        <div
          className={`h-full ${barClass} rounded-full transition-all`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span
        className="font-mono text-[12px] text-gray-light tabular-nums w-24 text-right shrink-0"
        style={{ letterSpacing: "-0.02em" }}
      >
        {lei(value)}
      </span>
    </div>
  );
}
