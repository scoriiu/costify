"use client";

/**
 * Compact month selector for in-card drill-downs. Shows the published months
 * as pills; the active one is teal. Unlike the sticky-bar PeriodSelector this
 * never navigates — selection is pure client state, the parent swaps data.
 */

const MONTH_SHORT = [
  "Ian",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Iun",
  "Iul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface MonthChipOption {
  year: number;
  month: number;
}

interface MonthChipsProps {
  options: MonthChipOption[];
  activeYear: number;
  activeMonth: number;
  onSelect: (year: number, month: number) => void;
  /** Maximum chips shown (most recent first). */
  limit?: number;
}

export function MonthChips({
  options,
  activeYear,
  activeMonth,
  onSelect,
  limit = 12,
}: MonthChipsProps) {
  if (options.length < 2) return null;

  const sorted = [...options]
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, limit)
    .reverse();

  const showYears = new Set(sorted.map((o) => o.year)).size > 1;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Alege luna"
      data-testid="month-chips"
    >
      {sorted.map((o) => {
        const isActive = o.year === activeYear && o.month === activeMonth;
        return (
          <button
            key={`${o.year}-${o.month}`}
            type="button"
            onClick={() => onSelect(o.year, o.month)}
            className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              isActive
                ? "border-primary bg-primary text-[#E9E8E3]"
                : "border-dark-3 bg-dark-2 text-gray hover:text-gray-light hover:border-dark-3/70"
            }`}
          >
            {MONTH_SHORT[o.month - 1]}
            {showYears && <span className="opacity-70"> &apos;{String(o.year).slice(2)}</span>}
          </button>
        );
      })}
    </div>
  );
}
