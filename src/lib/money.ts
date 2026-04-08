/**
 * Normalize a money value from various formats to a number.
 * Handles Romanian format: 1.234.567,89 (dots = thousands, comma = decimal)
 * Also handles ambiguous "1.234" (dot + exactly 3 trailing digits = thousands separator).
 */
export function normalizeMoney(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  if (typeof value !== "string") return 0;

  let cleaned = value.trim().replace(/\s/g, "");
  if (cleaned === "") return 0;

  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "");
    cleaned = cleaned.replace(",", ".");
  } else if (cleaned.includes(".")) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      cleaned = cleaned.replace(/\./g, "");
    } else {
      const match = cleaned.match(/^-?\d{1,3}\.(\d{3})$/);
      if (match) cleaned = cleaned.replace(".", "");
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
