/**
 * Per-vertical breakdown card for /firma home.
 *
 * Shows the firm's revenue / expenses / profit decomposed by business line
 * (Outsourcing, Recruitment, Coworking for QHM21). Hidden entirely when the
 * verticals feature is off or no allocations exist.
 *
 * Each row is a compact horizontal mini-statement. Profit colored green if
 * positive, red if negative. The patron understands at a glance which line
 * is making money and which one is bleeding.
 */

import type { VerticalBreakdownItem } from "@/modules/reporting/owner";
import { lei, pct } from "@/lib/owner-format";

interface Props {
  items: VerticalBreakdownItem[];
  periodLabel: string;
}

export function VerticalBreakdownCard({ items, periodLabel }: Props) {
  if (items.length === 0) return null;

  // Filter out fully-empty verticals (revenue + expenses both 0) unless ALL
  // verticals are empty, in which case show them for visibility.
  const anyNonZero = items.some(
    (i) => Math.abs(i.revenue) > 0.01 || Math.abs(i.expenses) > 0.01
  );
  const visible = anyNonZero
    ? items.filter((i) => Math.abs(i.revenue) > 0.01 || Math.abs(i.expenses) > 0.01)
    : items;

  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <h3
        className="text-[16px] font-semibold text-white"
        style={{ letterSpacing: "-0.04em" }}
      >
        Pe linii de business
      </h3>
      <p
        className="mt-1 text-[12px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Cum a contribuit fiecare verticala in {periodLabel}. Sumele se impart
        din facturile firmei dupa regulile stabilite de contabil.
      </p>

      <ul className="mt-5 divide-y divide-dark-3">
        {visible.map((item) => (
          <VerticalRow key={item.verticalId} item={item} />
        ))}
      </ul>
    </div>
  );
}

function VerticalRow({ item }: { item: VerticalBreakdownItem }) {
  const profitTone =
    item.profit > 0
      ? "text-emerald-300"
      : item.profit < 0
      ? "text-rose-300"
      : "text-gray-light";

  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-[14px] font-semibold text-white truncate"
          style={{ letterSpacing: "-0.04em" }}
          title={item.name}
        >
          {item.name}
        </span>
        <span
          className={`font-mono text-[14px] tabular-nums shrink-0 ${profitTone}`}
        >
          {lei(item.profit)}
        </span>
      </div>
      <div
        className="mt-1 flex items-center gap-4 text-[12px] text-gray-light font-mono tabular-nums"
        style={{ letterSpacing: "-0.02em" }}
      >
        <span>
          <span className="text-gray">venituri</span> {lei(item.revenue)}
        </span>
        <span className="text-gray">·</span>
        <span>
          <span className="text-gray">cheltuieli</span> {lei(item.expenses)}
        </span>
        {item.expenseSharePct > 0.5 && (
          <>
            <span className="text-gray">·</span>
            <span className="text-gray">{pct(item.expenseSharePct)} din total</span>
          </>
        )}
      </div>
    </li>
  );
}
