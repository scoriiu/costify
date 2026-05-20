/**
 * Top N monthly expense accounts as a compact ranked list.
 * Patron sees the "Denumire" from the journal (Saga partner name) — not the
 * account code, which is hidden by D7 rules.
 */

import type { TopMonthlyExpense } from "@/modules/reporting/owner";
import { lei, pct } from "@/lib/owner-format";

interface Props {
  items: TopMonthlyExpense[];
  title?: string;
  subtitle?: string;
}

export function TopExpensesList({
  items,
  title = "Top cheltuieli ale lunii",
  subtitle,
}: Props) {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
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
      {items.length === 0 ? (
        <p
          className="mt-4 text-[13px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nicio cheltuiala inregistrata luna aceasta.
        </p>
      ) : (
        <ol className="mt-5 divide-y divide-dark-3">
          {items.map((item, idx) => (
            <li
              key={item.cont}
              className="flex items-center gap-3 py-2.5"
            >
              <span
                className="font-mono text-[10px] text-gray w-5 shrink-0 tabular-nums"
                aria-hidden
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                className="flex-1 min-w-0 text-[13px] text-gray-light truncate"
                style={{ letterSpacing: "-0.02em" }}
                title={item.denumire}
              >
                {item.denumire}
              </span>
              <span className="font-mono text-[10px] text-gray w-12 text-right tabular-nums shrink-0">
                {pct(item.percent)}
              </span>
              <span className="font-mono text-[13px] text-white tabular-nums shrink-0">
                {lei(item.value)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
