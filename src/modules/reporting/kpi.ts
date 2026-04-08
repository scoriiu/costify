import type { BalanceRowView } from "@/modules/balances";
import type { KpiSnapshot } from "./types";

export function computeKpis(rows: BalanceRowView[]): KpiSnapshot {
  const leafRows = rows.filter((r) => r.isLeaf);
  const byBase = groupByContBase(leafRows);

  const cashBank = sumFinD(byBase, ["5121", "5124", "5311", "5314"]);
  const clientiCreante = sumFinD(byBase, ["4111"]);
  const furnizoriDatorii = sumFinC(byBase, ["401", "404"]);
  const tvaColectata = sumFinC(byBase, ["4427"]);
  const tvaDeductibila = sumFinD(byBase, ["4426"]);
  const tvaDePlata = round2(tvaColectata - tvaDeductibila);

  const totalVenituri = sumRulajCByPrefix(leafRows, "7");
  const totalCheltuieli = sumRulajDByPrefix(leafRows, "6");
  const rezultat = round2(totalVenituri - totalCheltuieli);

  const marjaOperationala = totalVenituri > 0
    ? round2((rezultat / totalVenituri) * 100)
    : null;

  return {
    cashBank: round2(cashBank),
    clientiCreante: round2(clientiCreante),
    furnizoriDatorii: round2(furnizoriDatorii),
    tvaDePlata,
    rezultat,
    totalVenituri: round2(totalVenituri),
    totalCheltuieli: round2(totalCheltuieli),
    marjaOperationala,
  };
}

function groupByContBase(rows: BalanceRowView[]): Map<string, BalanceRowView[]> {
  const map = new Map<string, BalanceRowView[]>();
  for (const row of rows) {
    const group = map.get(row.contBase) ?? [];
    group.push(row);
    map.set(row.contBase, group);
  }
  return map;
}

function sumFinD(byBase: Map<string, BalanceRowView[]>, bases: string[]): number {
  let total = 0;
  for (const base of bases) {
    const rows = byBase.get(base);
    if (rows) {
      for (const r of rows) total += r.finD;
    }
  }
  return total;
}

function sumFinC(byBase: Map<string, BalanceRowView[]>, bases: string[]): number {
  let total = 0;
  for (const base of bases) {
    const rows = byBase.get(base);
    if (rows) {
      for (const r of rows) total += r.finC;
    }
  }
  return total;
}

function sumRulajDByPrefix(rows: BalanceRowView[], prefix: string): number {
  let total = 0;
  for (const r of rows) {
    if (r.contBase.startsWith(prefix)) total += r.rulajTD;
  }
  return total;
}

function sumRulajCByPrefix(rows: BalanceRowView[], prefix: string): number {
  let total = 0;
  for (const r of rows) {
    if (r.contBase.startsWith(prefix)) total += r.rulajTC;
  }
  return total;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
