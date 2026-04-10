import type { BalanceRowView } from "@/modules/balances";

export function makeBalanceRow(
  overrides: Partial<BalanceRowView> & Pick<BalanceRowView, "cont" | "contBase">
): BalanceRowView {
  return {
    denumire: "",
    tip: "A",
    unmapped: false,
    isLeaf: true,
    hasChild: false,
    debInit: 0,
    credInit: 0,
    soldInD: 0,
    soldInC: 0,
    debPrec: 0,
    credPrec: 0,
    rulajD: 0,
    rulajC: 0,
    rulajTD: 0,
    rulajTC: 0,
    totalDeb: 0,
    totalCred: 0,
    finD: 0,
    finC: 0,
    ...overrides,
  };
}
