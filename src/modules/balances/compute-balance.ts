import { getContBase, isPnlAccount, getAccountType, computeLeafFlags } from "@/lib/accounts";
import { getAccountName } from "@/lib/account-names";
import { round2 } from "@/lib/money";
import type { JournalEntry, BalanceRowData } from "@/modules/ingestion/types";

interface AccountAgg {
  cumDBefore: number;
  cumCBefore: number;
  rulajtD: number;
  rulajtC: number;
  rulajD: number;
  rulajC: number;
}

export function computeBalanceFromJournal(
  entries: JournalEntry[],
  year: number,
  month?: number,
  accountNames?: Map<string, string>
): (BalanceRowData & { contBase: string; isLeaf: boolean; hasChild: boolean })[] {
  const periodMonth = month ?? findLastMonth(entries, year);
  const openingBal = computeOpeningBalances(entries, year);
  const accounts = buildAccountAggregations(entries, year, periodMonth, openingBal);
  const rawRows = buildRawRows(accounts, openingBal, accountNames);

  rawRows.sort((a, b) => a.cont.localeCompare(b.cont, undefined, { numeric: true }));
  return computeLeafFlags(rawRows);
}

function findLastMonth(entries: JournalEntry[], year: number): number {
  let max = 0;
  for (const e of entries) {
    if (e.year === year && e.month > max) max = e.month;
  }
  return max || 12;
}

function computeOpeningBalances(entries: JournalEntry[], year: number): Map<string, { d: number; c: number }> {
  const cumBal = new Map<string, { d: number; c: number }>();
  const ensure = (cont: string) => {
    let b = cumBal.get(cont);
    if (!b) { b = { d: 0, c: 0 }; cumBal.set(cont, b); }
    return b;
  };

  const priorYears = [...new Set(entries.filter((e) => e.year < year).map((e) => e.year))].sort((a, b) => a - b);

  for (const priorYear of priorYears) {
    for (const e of entries) {
      if (e.year !== priorYear || e.contD === "%" || e.contC === "%") continue;
      ensure(e.contD).d += e.suma;
      ensure(e.contC).c += e.suma;
    }

    let closeD = 0;
    let closeC = 0;
    for (const [cont, bal] of cumBal) {
      if (!isPnlAccount(cont)) continue;
      const net = bal.d - bal.c;
      if (net > 0) closeD += net;
      if (net < 0) closeC += -net;
      bal.d = 0;
      bal.c = 0;
    }
    if (closeD > 0 || closeC > 0) {
      const b121 = ensure("121");
      b121.d += closeD;
      b121.c += closeC;
    }
  }

  return cumBal;
}

function buildAccountAggregations(
  entries: JournalEntry[], year: number, periodMonth: number,
  openingBal: Map<string, { d: number; c: number }>
): Map<string, AccountAgg> {
  const accounts = new Map<string, AccountAgg>();

  const ensure = (cont: string): AccountAgg => {
    let agg = accounts.get(cont);
    if (!agg) {
      const cum = openingBal.get(cont);
      agg = { cumDBefore: cum?.d ?? 0, cumCBefore: cum?.c ?? 0, rulajtD: 0, rulajtC: 0, rulajD: 0, rulajC: 0 };
      accounts.set(cont, agg);
    }
    return agg;
  };

  for (const [cont, cum] of openingBal) {
    if (Math.abs(cum.d - cum.c) > 0.001) ensure(cont);
  }

  for (const e of entries) {
    if (e.year !== year || e.contD === "%" || e.contC === "%" || e.month > periodMonth) continue;
    const aggD = ensure(e.contD);
    aggD.rulajtD += e.suma;
    if (e.month === periodMonth) aggD.rulajD += e.suma;

    const aggC = ensure(e.contC);
    aggC.rulajtC += e.suma;
    if (e.month === periodMonth) aggC.rulajC += e.suma;
  }

  return accounts;
}

function buildRawRows(
  accounts: Map<string, AccountAgg>,
  _openingBal: Map<string, { d: number; c: number }>,
  accountNames?: Map<string, string>
): BalanceRowData[] {
  const rows: BalanceRowData[] = [];

  for (const [cont, agg] of accounts) {
    const debInit = Math.max(agg.cumDBefore - agg.cumCBefore, 0);
    const credInit = Math.max(agg.cumCBefore - agg.cumDBefore, 0);
    const debPrecTotal = debInit + (agg.rulajtD - agg.rulajD);
    const credPrecTotal = credInit + (agg.rulajtC - agg.rulajC);
    const soldInD = Math.max(debPrecTotal - credPrecTotal, 0);
    const soldInC = Math.max(credPrecTotal - debPrecTotal, 0);
    const totalDeb = debInit + agg.rulajtD;
    const totalCred = credInit + agg.rulajtC;
    const finD = Math.max(totalDeb - totalCred, 0);
    const finC = Math.max(totalCred - totalDeb, 0);
    const contBase = getContBase(cont);

    rows.push({
      cont,
      denumire: accountNames?.get(cont) ?? getAccountName(contBase),
      tip: getAccountType(contBase),
      debInit: round2(debInit), credInit: round2(credInit),
      soldInD: round2(soldInD), soldInC: round2(soldInC),
      debPrec: round2(debPrecTotal), credPrec: round2(credPrecTotal),
      rulajD: round2(agg.rulajD), rulajC: round2(agg.rulajC),
      rulajTD: round2(agg.rulajtD), rulajTC: round2(agg.rulajtC),
      totalDeb: round2(totalDeb), totalCred: round2(totalCred),
      finD: round2(finD), finC: round2(finC),
    });
  }

  return rows;
}
