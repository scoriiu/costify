/**
 * Extract the base (synthetic) account before the dot.
 * "5121.00001" -> "5121", "5121" -> "5121"
 */
export function getContBase(cont: string): string {
  const dotIndex = cont.indexOf(".");
  return dotIndex >= 0 ? cont.substring(0, dotIndex) : cont;
}

/**
 * Determine account type (A/P/B) from account number per OMFP 1802/2014.
 */
export function getAccountType(contBase: string): "A" | "P" | "B" {
  const first = contBase.charAt(0);

  switch (first) {
    case "1":
      if (contBase.startsWith("129")) return "A";
      return "P";
    case "2":
      if (contBase.startsWith("28") || contBase.startsWith("29")) return "P";
      return "A";
    case "3":
      if (contBase.startsWith("39")) return "P";
      return "A";
    case "4":
      return "B";
    case "5":
      if (contBase.startsWith("519")) return "P";
      return "A";
    case "6":
      return "A";
    case "7":
      return "P";
    case "8":
      return "A";
    default:
      return "B";
  }
}

/**
 * Check if an account is P&L (class 6 = expenses, class 7 = revenues).
 */
export function isPnlAccount(cont: string): boolean {
  const cls = getContBase(cont).charAt(0);
  return cls === "6" || cls === "7";
}

/**
 * Determine leaf/parent status for all accounts.
 * A cont is a parent if another cont starts with `${cont}.`
 */
export function computeLeafFlags<T extends { cont: string }>(
  rows: T[]
): (T & { contBase: string; isLeaf: boolean; hasChild: boolean })[] {
  const conts = [...new Set(rows.map((r) => r.cont))].sort();
  const parentSet = new Set<string>();

  for (let i = 0; i < conts.length; i++) {
    const prefix = conts[i] + ".";
    let lo = i + 1;
    let hi = conts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (conts[mid] < prefix) lo = mid + 1;
      else hi = mid - 1;
    }
    if (lo < conts.length && conts[lo].startsWith(prefix)) {
      parentSet.add(conts[i]);
    }
  }

  return rows.map((row) => ({
    ...row,
    contBase: getContBase(row.cont),
    isLeaf: !parentSet.has(row.cont),
    hasChild: parentSet.has(row.cont),
  }));
}
