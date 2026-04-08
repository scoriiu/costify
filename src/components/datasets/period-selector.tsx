"use client";

import type { DatasetPeriod } from "@/modules/balances";
import { Select } from "@/components/ui/select";

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
      <Select
        value={String(selectedYear)}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        onChange={(v) => handleYearChange(parseInt(v))}
      />
      <Select
        value={String(selectedMonth)}
        options={monthsForYear.map((m) => ({ value: String(m), label: MONTH_NAMES[m] }))}
        onChange={(v) => onChange(selectedYear, parseInt(v))}
      />
    </div>
  );
}
