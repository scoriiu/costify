"use client";

import type { DatasetPeriod } from "@/modules/balances";

const MONTH_NAMES = [
  "", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

interface Props {
  periods: DatasetPeriod[];
  selectedYear: number;
  selectedMonth: number;
  onChange: (year: number, month: number) => void;
}

export function PeriodSelector({ periods, selectedYear, selectedMonth, onChange }: Props) {
  const years = [...new Set(periods.map((p) => p.year))].sort((a, b) => a - b);
  const monthsForYear = periods
    .filter((p) => p.year === selectedYear)
    .map((p) => p.month)
    .sort((a, b) => a - b);

  function handleYearChange(year: number) {
    const monthsInYear = periods.filter((p) => p.year === year).map((p) => p.month);
    const month = monthsInYear.includes(selectedMonth)
      ? selectedMonth
      : monthsInYear[monthsInYear.length - 1];
    onChange(year, month);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedYear}
        onChange={(e) => handleYearChange(parseInt(e.target.value))}
        className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-1.5 font-mono text-xs text-white focus:border-primary focus:outline-none"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select
        value={selectedMonth}
        onChange={(e) => onChange(selectedYear, parseInt(e.target.value))}
        className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-1.5 font-mono text-xs text-white focus:border-primary focus:outline-none"
      >
        {monthsForYear.map((m) => (
          <option key={m} value={m}>{MONTH_NAMES[m]}</option>
        ))}
      </select>
    </div>
  );
}
