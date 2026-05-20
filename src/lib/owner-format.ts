/**
 * Owner-mode formatting helpers.
 *
 * Owner-facing copy uses "lei" lowercase, Romanian thousand separators,
 * and elides decimals for amounts over 1000 (an entrepreneur reading
 * "142.300 lei" feels confident; "142.300,00 lei" feels like a contabil
 * report).
 */

const fmtRon0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const fmtRon2 = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtPct1 = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "142.300 lei" for large amounts, "142,50 lei" under 1000. */
export function lei(value: number): string {
  if (value === 0) return "0 lei";
  if (Math.abs(value) >= 1000) return `${fmtRon0.format(Math.round(value))} lei`;
  return `${fmtRon2.format(value)} lei`;
}

/** Short form without "lei" suffix — for inside larger labels. */
export function leiShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${fmtPct1.format(value / 1_000_000)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${fmtRon0.format(Math.round(value / 1000))}K`;
  }
  return fmtRon0.format(value);
}

/** "+4,2%" or "-12,3%" with sign and one decimal. Null = previous baseline
 *  missing or zero, rendered as "n/a". */
export function pctSigned(value: number | null): string {
  if (value === null) return "n/a";
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtPct1.format(value)}%`;
}

/** "16,5%" — no sign. */
export function pct(value: number): string {
  return `${fmtPct1.format(value)}%`;
}

const MONTH_NAMES = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
