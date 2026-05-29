/**
 * Pure computation functions for the owner view.
 *
 * All functions take BalanceRowView[] (already filtered for the period) plus
 * the account catalog. They return the typed payloads in types.ts.
 *
 * Ported from reference/tb-report/src/lib/balance/kpis.ts, adapted to use the
 * three-tier catalog (cashRole, arRole, apRole, vatRole, payrollRole, isClosing,
 * isProfitTax, isExtraBilantier) where possible. Hardcoded account prefixes
 * are kept only for accounts that don't yet have a role in the catalog
 * (455, 457, 463, 542, 473, 461, 4551) — those will get an `ownerRole`
 * field in a future catalog migration.
 */

import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";
import type { ResolverState } from "@/modules/categories";
import { resolveCategoryForCont } from "@/modules/categories";
import type { VerticalResolverState } from "@/modules/verticals";
import {
  resolveAllocationForCont,
  resolveAllocationForCategory,
  applySplit,
} from "@/modules/verticals";
import type { PartnerCategoryAdjustment } from "@/modules/partner-mappings";
import type {
  FinancialSummary,
  CashPosition,
  CashPositionItem,
  OwnerWithdrawals,
  OwnerWithdrawalsItem,
  OutstandingPartner,
  Insight,
  CategoryBreakdownItem,
  TopMonthlyExpense,
  RunwayProjection,
  SalaryAffordability,
  YearOverYearComparison,
  MonthlyTrendPoint,
  VerticalBreakdownItem,
  CashflowBreakdown,
  Patrimoniu,
  PatrimoniuBucket,
  Verdict,
  KpiStripItem,
  HealthScore,
  HealthSubscore,
  FinancialRatio,
  ObligationEntry,
  TopActivityPartner,
} from "./types";

/**
 * Patron-facing label per 2-digit class 6 account base.
 * Strips OMFP terminology in favor of words a patron uses.
 */
const EXPENSE_LABELS_PATRON: Record<string, string> = {
  "60": "Marfa, materii prime si materiale",
  "61": "Energie, apa, intretinere",
  "62": "Servicii externe (chirie, IT, contabilitate)",
  "63": "Taxe si impozite (altele decat profit)",
  "64": "Salarii si contributii",
  "65": "Comisioane bancare si diferente curs",
  "66": "Dobanzi si cheltuieli financiare",
  "67": "Cheltuieli exceptionale",
  "68": "Amortizare si provizioane",
  "69": "Impozit pe profit",
};

const REVENUE_LABELS_PATRON: Record<string, string> = {
  "70": "Vanzari (cifra de afaceri)",
  "71": "Productie in stoc",
  "72": "Lucrari executate",
  "74": "Subventii din exploatare",
  "75": "Alte venituri din exploatare",
  "76": "Venituri financiare",
  "77": "Venituri exceptionale",
  "78": "Reluari de amortizari si provizioane",
};

function lookupByBase(
  contBase: string,
  catalog: Map<string, CatalogAccount>
): CatalogAccount | null {
  const direct = catalog.get(contBase);
  if (direct) return direct;
  for (let len = contBase.length - 1; len >= 2; len--) {
    const prefix = contBase.slice(0, len);
    const match = catalog.get(prefix);
    if (match) return match;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeFinancialSummary(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): FinancialSummary {
  const leaves = rows.filter((r) => r.isLeaf);

  let cifraAfaceriTotal = 0;
  let cifraAfaceriLuna = 0;
  let cheltuieliTotal = 0;
  let cheltuieliLuna = 0;
  let venituriLuna = 0;
  let soldRegistruCasa = 0;
  let soldConturiBancare = 0;
  let creditareSocietate = 0;
  let clientiNeincasati = 0;
  let furnizoriNeachitati = 0;

  for (const row of leaves) {
    const meta = lookupByBase(row.contBase, catalog);
    const base = row.contBase;

    if (base.startsWith("7") && !meta?.isClosing && !meta?.isExtraBilantier) {
      if (base.startsWith("709")) {
        cifraAfaceriTotal -= row.totalDeb;
        cifraAfaceriLuna -= row.rulajD;
        venituriLuna -= row.rulajD;
      } else if (base.startsWith("70")) {
        cifraAfaceriTotal += row.totalCred;
        cifraAfaceriLuna += row.rulajC;
        venituriLuna += row.rulajC;
      } else if (!base.startsWith("71") && !base.startsWith("72")) {
        venituriLuna += row.rulajC;
      }
    }

    if (
      base.startsWith("6") &&
      !meta?.isClosing &&
      !meta?.isProfitTax &&
      !meta?.isExtraBilantier
    ) {
      if (base.startsWith("609")) {
        cheltuieliTotal -= row.totalCred;
        cheltuieliLuna -= row.rulajC;
      } else {
        cheltuieliTotal += row.totalDeb;
        cheltuieliLuna += row.rulajD;
      }
    }

    if (base.startsWith("531")) {
      soldRegistruCasa += row.finD - row.finC;
    }
    if (base.startsWith("512") && !base.startsWith("5125")) {
      soldConturiBancare += row.finD - row.finC;
    }
    if (base.startsWith("455")) {
      creditareSocietate += row.finC - row.finD;
    }
    if (base.startsWith("411") && row.finD > row.finC) {
      clientiNeincasati += row.finD - row.finC;
    }
    if (base.startsWith("401") && row.finC > row.finD) {
      furnizoriNeachitati += row.finC - row.finD;
    }
  }

  return {
    cifraAfaceriTotal: round2(cifraAfaceriTotal),
    cifraAfaceriLuna: round2(cifraAfaceriLuna),
    cheltuieliTotal: round2(cheltuieliTotal),
    cheltuieliLuna: round2(cheltuieliLuna),
    venituriLuna: round2(venituriLuna),
    soldRegistruCasa: round2(soldRegistruCasa),
    soldConturiBancare: round2(soldConturiBancare),
    creditareSocietate: round2(creditareSocietate),
    clientiNeincasati: round2(clientiNeincasati),
    furnizoriNeachitati: round2(furnizoriNeachitati),
  };
}

export function computeCashPosition(rows: BalanceRowView[]): CashPosition {
  const leaves = rows.filter((r) => r.isLeaf);

  let soldCasa = 0;
  let soldBanca = 0;
  let clienti = 0;
  let furnizori = 0;
  let tva = 0;
  let salarii = 0;
  let asigurari = 0;

  for (const row of leaves) {
    const base = row.contBase;
    if (base.startsWith("531")) soldCasa += row.finD - row.finC;
    if (base.startsWith("512") && !base.startsWith("5125")) soldBanca += row.finD - row.finC;
    if (base.startsWith("411") && row.finD > row.finC) clienti += row.finD - row.finC;
    if (base.startsWith("401") && row.finC > row.finD) furnizori += row.finC - row.finD;
    if (base.startsWith("4423") && row.finC > row.finD) tva += row.finC - row.finD;
    if (base.startsWith("421") && row.finC > row.finD) salarii += row.finC - row.finD;
    if (base.startsWith("431") && row.finC > row.finD) asigurari += row.finC - row.finD;
  }

  const disponibil: CashPositionItem[] = [
    { id: "bankAccounts", label: "Conturi bancare", value: round2(soldBanca) },
    { id: "cashRegister", label: "Casa", value: round2(soldCasa) },
    { id: "clientsReceivable", label: "De primit de la clienti", value: round2(clienti) },
  ].filter((d) => d.value > 0);

  const obligatii: CashPositionItem[] = [
    { id: "suppliersPayable", label: "De platit furnizorilor", value: round2(furnizori) },
    { id: "vatPayable", label: "TVA de plata", value: round2(tva) },
    { id: "wagesPayable", label: "Salarii de plata", value: round2(salarii) },
    { id: "socialInsurance", label: "Contributii sociale", value: round2(asigurari) },
  ].filter((o) => o.value > 0);

  const totalDisponibil = round2(disponibil.reduce((s, d) => s + d.value, 0));
  const totalObligatii = round2(obligatii.reduce((s, o) => s + o.value, 0));

  return {
    disponibil,
    obligatii,
    totalDisponibil,
    totalObligatii,
    net: round2(totalDisponibil - totalObligatii),
  };
}

export function computeOwnerWithdrawals(rows: BalanceRowView[]): OwnerWithdrawals {
  const leaves = rows.filter((r) => r.isLeaf);

  let dividendeInterimare = 0;
  let dividendeInterimareNeridicate = 0;
  let dividendeAnualePlatite = 0;
  let dividendeNeridicate = 0;
  let avansuriNedecontate = 0;
  let sumeNeclarificate = 0;
  let debitoriDiversi = 0;
  let creditareAsociati = 0;

  for (const row of leaves) {
    const base = row.contBase;

    if (base.startsWith("463")) {
      dividendeInterimare += row.totalDeb;
      dividendeInterimareNeridicate += Math.max(row.finD - row.finC, 0);
    }
    if (base.startsWith("457")) {
      dividendeAnualePlatite += row.totalDeb;
      dividendeNeridicate += Math.max(row.finC - row.finD, 0);
    }
    if (base.startsWith("542")) {
      avansuriNedecontate += Math.max(row.finD - row.finC, 0);
    }
    if (base.startsWith("473")) {
      sumeNeclarificate += Math.max(row.finD - row.finC, 0);
    }
    if (base.startsWith("461")) {
      debitoriDiversi += Math.max(row.finD - row.finC, 0);
    }
    if (base.startsWith("4551")) {
      creditareAsociati += Math.max(row.finC - row.finD, 0);
    }
  }

  const items: OwnerWithdrawalsItem[] = [
    {
      id: "dividendeAnualePlatite",
      label: "Dividende deja luate anul acesta",
      description: "Sume distribuite dupa aprobarea bilantului si platite catre tine ca actionar.",
      value: round2(dividendeAnualePlatite),
    },
    {
      id: "dividendeNeridicate",
      label: "Dividende repartizate dar inca neluate",
      description: "Sume aprobate de AGA dar care nu au fost inca platite. Pot fi luate oricand.",
      value: round2(dividendeNeridicate),
    },
    {
      id: "dividendeInterimareRidicate",
      label: "Dividende interimare distribuite anul acesta",
      description: "Sume luate in avans, inainte de bilant. Trebuie regularizate la sfarsit de an.",
      value: round2(dividendeInterimare),
    },
    {
      id: "dividendeInterimareNeridicate",
      label: "Dividende interimare neregularizate inca",
      description: "Sume luate in avans care asteapta bilantul anual pentru a fi confirmate.",
      value: round2(dividendeInterimareNeridicate),
    },
    {
      id: "avansuriNejustificate",
      label: "Avansuri din trezorerie nejustificate",
      description: "Bani luati ca avans (de exemplu pentru deplasari) pentru care nu ai inca documente.",
      value: round2(avansuriNedecontate),
    },
    {
      id: "sumeInCursDeClarificare",
      label: "Plati nelamurite",
      description: "Sume iesite din firma care nu au fost inca clasificate ca dividend, salariu sau cheltuiala.",
      value: round2(sumeNeclarificate),
    },
    {
      id: "debitoriDiversi",
      label: "Bani de recuperat de la diversi debitori",
      description: "Sume pe care firma le are de incasat de la persoane care nu sunt clienti curenti.",
      value: round2(debitoriDiversi),
    },
    {
      id: "sumeAsociatiInFirma",
      label: "Bani lasati de tine in firma",
      description: "Sume pe care le-ai imprumutat firmei. Le poti retrage oricand fara impozit.",
      value: round2(creditareAsociati),
    },
  ].filter((item) => item.value > 0);

  return {
    items,
    total: round2(items.reduce((s, i) => s + i.value, 0)),
  };
}

export function computeOutstanding(
  rows: BalanceRowView[]
): { clienti: OutstandingPartner[]; furnizori: OutstandingPartner[] } {
  const clienti: OutstandingPartner[] = [];
  const furnizori: OutstandingPartner[] = [];

  for (const row of rows) {
    if (!row.isLeaf) continue;
    if (!row.cont.includes(".")) continue;

    if (row.contBase.startsWith("411") && row.finD > row.finC) {
      clienti.push({
        cont: row.cont,
        partnerName: row.denumire || row.cont,
        sold: round2(row.finD - row.finC),
      });
    }
    if (row.contBase.startsWith("401") && row.finC > row.finD) {
      furnizori.push({
        cont: row.cont,
        partnerName: row.denumire || row.cont,
        sold: round2(row.finC - row.finD),
      });
    }
  }

  clienti.sort((a, b) => b.sold - a.sold);
  furnizori.sort((a, b) => b.sold - a.sold);

  return { clienti: clienti.slice(0, 15), furnizori: furnizori.slice(0, 15) };
}

export function computeInsights(
  summary: FinancialSummary,
  cashPosition: CashPosition,
  tvaDePlata: number,
  marjaOperationala: number | null
): Insight[] {
  const insights: Insight[] = [];
  const fmt = (n: number) =>
    new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);

  const profit = summary.cifraAfaceriTotal - summary.cheltuieliTotal;
  const totalCash = summary.soldRegistruCasa + summary.soldConturiBancare;

  if (profit > 0 && summary.cifraAfaceriTotal > 0) {
    insights.push({
      type: "positive",
      category: "profitabilitate",
      title: "Firma e pe plus",
      message: `Anul acesta ai facut ${fmt(profit)} lei profit din ${fmt(summary.cifraAfaceriTotal)} lei vanzari. Marja ta e ${(marjaOperationala ?? 0).toFixed(1)}%.`,
    });
  } else if (profit < 0) {
    insights.push({
      type: "negative",
      category: "profitabilitate",
      title: "Firma e pe minus",
      message: `Cheltuielile depasesc veniturile cu ${fmt(Math.abs(profit))} lei. Verifica unde se duc banii si vezi ce poti reduce.`,
      action: "Discuta cu contabilul",
    });
  }

  if (cashPosition.net < 0) {
    insights.push({
      type: "warning",
      category: "cash_flow",
      title: "Obligatiile depasesc disponibilul",
      message: `Ai ${fmt(cashPosition.totalDisponibil)} lei disponibili dar ${fmt(cashPosition.totalObligatii)} lei de platit. Lipsesc ${fmt(Math.abs(cashPosition.net))} lei.`,
      action: "Vorbeste cu clientii care iti datoreaza bani",
    });
  } else if (cashPosition.net > 0 && cashPosition.totalObligatii > 0) {
    const coverage = (cashPosition.totalDisponibil / cashPosition.totalObligatii) * 100;
    if (coverage > 200) {
      insights.push({
        type: "positive",
        category: "cash_flow",
        title: "Stai bine cu cash-ul",
        message: `Ai de ${(coverage / 100).toFixed(1)}× mai multi bani disponibili decat obligatii. Poti acoperi tot ce ai de platit.`,
      });
    }
  }

  if (summary.clientiNeincasati > 0 && summary.furnizoriNeachitati > 0) {
    const ratio = summary.clientiNeincasati / summary.furnizoriNeachitati;
    if (ratio > 2) {
      insights.push({
        type: "warning",
        category: "cash_flow",
        title: "Clientii intarzie cu platile",
        message: `Iti datoreaza ${fmt(summary.clientiNeincasati)} lei, in timp ce tu datorezi doar ${fmt(summary.furnizoriNeachitati)} lei furnizorilor. Incaseaza mai rapid.`,
        action: "Trimite reminder-uri",
      });
    }
  }

  if (tvaDePlata > 50_000) {
    insights.push({
      type: "warning",
      category: "operatiuni",
      title: "TVA de plata e mare",
      message: `Datorezi ${fmt(tvaDePlata)} lei TVA la ANAF. Termenul de plata e 25 ale lunii urmatoare.`,
      action: "Asigura-te ca ai bani pana atunci",
    });
  } else if (tvaDePlata > 0) {
    insights.push({
      type: "info",
      category: "operatiuni",
      title: "TVA de plata",
      message: `Datorezi ${fmt(tvaDePlata)} lei TVA, scadent pe 25 ale lunii urmatoare.`,
    });
  }

  if (totalCash > 100_000) {
    insights.push({
      type: "info",
      category: "cash_flow",
      title: "Cash disponibil sanatos",
      message: `Ai ${fmt(totalCash)} lei in casa si in conturi. Suficient pentru cateva luni de operare.`,
    });
  }

  return insights.slice(0, 6);
}

/**
 * Monthly expense breakdown by 2-digit class 6 account.
 * Skips closing accounts (already covered by catalog flag) and profit tax (697,
 * but kept under "69" for visibility — patrons want to see it).
 *
 * Returns sorted desc, with percent of total month-expenses.
 */
export function computeExpenseBreakdown(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): CategoryBreakdownItem[] {
  const leaves = rows.filter((r) => r.isLeaf);
  const groups = new Map<string, number>();

  for (const row of leaves) {
    const base = row.contBase;
    if (!base.startsWith("6")) continue;
    const meta = lookupByBase(base, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;

    const code = base.substring(0, 2);
    const current = groups.get(code) || 0;
    if (base.startsWith("609")) {
      // contra-expense: subtract its monthly rulajC
      groups.set(code, current - row.rulajC);
    } else {
      groups.set(code, current + row.rulajD);
    }
  }

  const total = Array.from(groups.values()).reduce((s, v) => s + v, 0);

  return Array.from(groups.entries())
    .map(([code, value]) => ({
      code,
      label: EXPENSE_LABELS_PATRON[code] ?? `Categoria ${code}`,
      value: round2(value),
      percent: total > 0 ? round2((value / total) * 100) : 0,
    }))
    .filter((item) => item.value > 0.01)
    .sort((a, b) => b.value - a.value);
}

/**
 * Monthly revenue breakdown by 2-digit class 7 account.
 * Excludes production accounts 71/72 from the patron view (they belong to CPP
 * detail, not the headline "where the money comes from" answer).
 */
export function computeRevenueBreakdown(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): CategoryBreakdownItem[] {
  const leaves = rows.filter((r) => r.isLeaf);
  const groups = new Map<string, number>();

  for (const row of leaves) {
    const base = row.contBase;
    if (!base.startsWith("7")) continue;
    const code = base.substring(0, 2);
    if (code === "71" || code === "72") continue;
    const meta = lookupByBase(base, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;

    const current = groups.get(code) || 0;
    if (base.startsWith("709")) {
      groups.set(code, current - row.rulajD);
    } else {
      groups.set(code, current + row.rulajC);
    }
  }

  const total = Array.from(groups.values()).reduce((s, v) => s + Math.abs(v), 0);

  return Array.from(groups.entries())
    .map(([code, value]) => ({
      code,
      label: REVENUE_LABELS_PATRON[code] ?? `Categoria ${code}`,
      value: round2(value),
      percent: total > 0 ? round2((Math.abs(value) / total) * 100) : 0,
    }))
    .filter((item) => Math.abs(item.value) > 0.01)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/**
 * Top individual expense accounts for the current month, sorted by rulajD.
 * Returns up to N items (default 10) with percent of total monthly expenses.
 * Used by "Top cheltuieli ale lunii" card.
 */
export function computeTopMonthlyExpenses(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  limit = 10
): TopMonthlyExpense[] {
  const leaves = rows.filter((r) => r.isLeaf);
  let totalMonthly = 0;
  const candidates: { cont: string; denumire: string; value: number }[] = [];

  for (const row of leaves) {
    const base = row.contBase;
    if (!base.startsWith("6")) continue;
    if (base.startsWith("609")) continue;
    const meta = lookupByBase(base, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;

    const value = row.rulajD;
    if (value <= 0.01) continue;
    totalMonthly += value;
    candidates.push({
      cont: row.cont,
      denumire: row.denumire || row.cont,
      value: round2(value),
    });
  }

  return candidates
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((c) => ({
      ...c,
      percent: totalMonthly > 0 ? round2((c.value / totalMonthly) * 100) : 0,
    }));
}

/**
 * Cash runway: months of operation possible at the current burn rate.
 *
 * Burn rate is averaged over the trailing `windowMonths` months of expenses
 * from the trends list (default 3). If trends are missing or all zeros,
 * status="unknown".
 *
 * Thresholds:
 *   - >= 6 months: comfortable
 *   - 3..6:      tight
 *   - <  3:      critical
 */
export function computeRunway(
  summary: FinancialSummary,
  trends: MonthlyTrendPoint[],
  windowMonths = 3
): RunwayProjection {
  const cashAvailable = round2(summary.soldRegistruCasa + summary.soldConturiBancare);
  const recent = trends.slice(-windowMonths).filter((t) => t.expenses > 0);

  if (recent.length === 0) {
    return {
      cashAvailable,
      monthlyBurnRate: 0,
      monthsRemaining: 0,
      windowMonths,
      status: "unknown",
    };
  }

  const avgBurn = recent.reduce((s, t) => s + t.expenses, 0) / recent.length;
  const monthlyBurnRate = round2(avgBurn);

  const monthsRemaining = monthlyBurnRate > 0 ? round2(cashAvailable / monthlyBurnRate) : 0;

  let status: RunwayProjection["status"];
  if (cashAvailable <= 0) status = "critical";
  else if (monthsRemaining >= 6) status = "comfortable";
  else if (monthsRemaining >= 3) status = "tight";
  else status = "critical";

  return {
    cashAvailable,
    monthlyBurnRate,
    monthsRemaining,
    windowMonths,
    status,
  };
}

/**
 * Can the firm pay its salaries?
 * monthlyPayroll = trailing-3-months average of class 64 expenses, derived
 * from the period's expense breakdown if available, else from leaves directly.
 */
export function computeSalaryAffordability(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  cashAvailable: number
): SalaryAffordability {
  const leaves = rows.filter((r) => r.isLeaf);
  let monthlyPayroll = 0;

  for (const row of leaves) {
    if (!row.contBase.startsWith("64")) continue;
    const meta = lookupByBase(row.contBase, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;
    monthlyPayroll += row.rulajD;
  }

  monthlyPayroll = round2(monthlyPayroll);

  if (monthlyPayroll <= 0.01) {
    return {
      monthlyPayroll: 0,
      cashAvailable,
      monthsCovered: 0,
      status: "no_payroll",
    };
  }

  const monthsCovered = round2(cashAvailable / monthlyPayroll);
  let status: SalaryAffordability["status"];
  if (cashAvailable <= 0) status = "critical";
  else if (monthsCovered >= 3) status = "comfortable";
  else if (monthsCovered >= 1) status = "tight";
  else status = "critical";

  return { monthlyPayroll, cashAvailable, monthsCovered, status };
}

/**
 * Year-over-year comparison using the trends array. Picks the point for the
 * "same month one year ago" if present, otherwise reports hasPreviousYear=false.
 */
export function computeYoy(
  trends: MonthlyTrendPoint[],
  currentYear: number,
  currentMonth: number,
  currentSummary: FinancialSummary
): YearOverYearComparison {
  const current = {
    revenue: currentSummary.cifraAfaceriLuna,
    expenses: currentSummary.cheltuieliLuna,
    profit: currentSummary.cifraAfaceriLuna - currentSummary.cheltuieliLuna,
    cashEnd: currentSummary.soldRegistruCasa + currentSummary.soldConturiBancare,
  };

  const prev = trends.find(
    (t) => t.year === currentYear - 1 && t.month === currentMonth
  );

  const buildSlot = (curr: number, previous: number | null) => {
    if (previous === null) {
      return { current: round2(curr), previous: 0, delta: round2(curr), deltaPct: null };
    }
    const delta = round2(curr - previous);
    const deltaPct = previous !== 0 ? round2((delta / Math.abs(previous)) * 100) : null;
    return { current: round2(curr), previous: round2(previous), delta, deltaPct };
  };

  return {
    revenue: buildSlot(current.revenue, prev?.revenue ?? null),
    expenses: buildSlot(current.expenses, prev?.expenses ?? null),
    profit: buildSlot(current.profit, prev?.profit ?? null),
    cashEnd: buildSlot(current.cashEnd, prev?.cashEnd ?? null),
    hasPreviousYear: prev !== undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*           CATEGORY-AWARE BREAKDOWNS (Axa A) — PR-2b                        */
/* -------------------------------------------------------------------------- */

/**
 * Same shape as computeExpenseBreakdown / computeRevenueBreakdown but groups
 * by the firm's own CostCategory tree instead of the hardcoded 2-digit OMFP
 * labels. Used by the owner snapshot when the client has at least one mapping.
 *
 * Grouping rule:
 *   - Each leaf account in class 6 (or 7 for revenue) is resolved to a
 *     CostCategory via the resolver chain (analytic > contBase > prefix walk).
 *   - The amount accumulates into the ROOT category of that resolution chain
 *     — so "Salarii brut" and "Bonus QHM" both roll up under the user-visible
 *     root, but the patron sees a single line "Salarii si contributii" with
 *     the combined amount. The accountant's sub-tree is the configuration; the
 *     patron view stays flat by design.
 *   - Accounts with no mapping fall back to the OMFP 2-digit code so the
 *     patron view never goes blank during the migration window.
 *
 * Returns sorted desc, percent of total month-expenses.
 */
export function computeExpenseBreakdownFromCategories(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  resolver: ResolverState,
  partnerAdjustments: PartnerCategoryAdjustment[] = []
): CategoryBreakdownItem[] {
  return computeBreakdownByCategory(
    rows,
    catalog,
    resolver,
    "expense",
    partnerAdjustments
  );
}

export function computeRevenueBreakdownFromCategories(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  resolver: ResolverState,
  partnerAdjustments: PartnerCategoryAdjustment[] = []
): CategoryBreakdownItem[] {
  return computeBreakdownByCategory(
    rows,
    catalog,
    resolver,
    "revenue",
    partnerAdjustments
  );
}

function computeBreakdownByCategory(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  resolver: ResolverState,
  kind: "expense" | "revenue",
  partnerAdjustments: PartnerCategoryAdjustment[] = []
): CategoryBreakdownItem[] {
  const leaves = rows.filter((r) => r.isLeaf);
  const classDigit = kind === "expense" ? "6" : "7";

  // Accumulate by EXACT category id (the one the mapping points at). Children
  // and ancestors are tracked separately so the patron can see both the rolled-
  // up total ("Salarii: 50.000 lei") and the sub-totals ("Brut: 35.000",
  // "Bonus: 15.000") indented underneath.
  const byCategoryId = new Map<string, { value: number; node: typeof resolver.byId extends Map<string, infer N> ? N : never }>();
  const byFallbackCode = new Map<string, number>();

  for (const row of leaves) {
    const base = row.contBase;
    if (!base.startsWith(classDigit)) continue;
    if (kind === "revenue") {
      const code2 = base.substring(0, 2);
      if (code2 === "71" || code2 === "72") continue;
    }
    const meta = lookupByBase(base, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;

    let amount: number;
    if (kind === "expense") {
      amount = base.startsWith("609") ? -row.rulajC : row.rulajD;
    } else {
      amount = base.startsWith("709") ? -row.rulajD : row.rulajC;
    }
    if (Math.abs(amount) < 0.01) continue;

    const resolved = resolveCategoryForCont(row.cont, resolver);
    if (resolved) {
      const matched = resolved.category;
      if (resolved.path[0].kind !== kind) continue; // defensive
      const existing = byCategoryId.get(matched.id);
      if (existing) {
        existing.value += amount;
      } else {
        byCategoryId.set(matched.id, { value: amount, node: matched });
      }
    } else {
      const code = base.substring(0, 2);
      byFallbackCode.set(code, (byFallbackCode.get(code) ?? 0) + amount);
    }
  }

  // Sprint 6: apply partner-override redistribution.
  //
  // For each (analyticCont, targetCategoryId, amount) adjustment, subtract
  // `amount` from whatever category the analytic cont currently lives at
  // (its resolved default OR its OMFP fallback) and add it to the target
  // category. The net effect: the partner's slice of that cont's rulaj
  // flows to the chosen category instead of the cont's default.
  //
  // This runs BEFORE the ancestor roll-up so the parent totals reflect the
  // redistributed values. Adjustments for analytics outside this kind's
  // class are silently ignored (the line wasn't included in the loop
  // above and won't be in the maps).
  for (const adjustment of partnerAdjustments) {
    // Class-filter: an adjustment on cont 6022 is for expense breakdown,
    // not revenue. Skip mismatches.
    const adjBase = adjustment.analyticCont.split(".")[0]
      .replace(/[^0-9]/g, "");
    if (!adjBase.startsWith(classDigit)) continue;

    const resolved = resolveCategoryForCont(adjustment.analyticCont, resolver);
    const target =
      adjustment.targetCategoryId === resolved?.category.id
        ? null // no-op: override matches the cont's default category
        : resolver.byId.get(adjustment.targetCategoryId);
    if (!target) continue; // target category not in tree (deleted?) — skip safely

    // Subtract from the default bucket (categoryId OR fallback code).
    if (resolved) {
      const existing = byCategoryId.get(resolved.category.id);
      if (existing) {
        existing.value -= adjustment.amount;
      }
      // No else: if the cont didn't contribute to its default bucket (no
      // rulaj, no row), we can't subtract — but the addition still applies
      // because the adjustment came from real lines we may or may not have
      // in `rows` (e.g. analytic without a balance entry but with journal
      // activity). This is defensive; in normal flow `rows` and `lines`
      // come from the same period query.
    } else {
      const code = adjBase.substring(0, 2);
      byFallbackCode.set(
        code,
        (byFallbackCode.get(code) ?? 0) - adjustment.amount
      );
    }

    // Add to the target bucket.
    const existingTarget = byCategoryId.get(target.id);
    if (existingTarget) {
      existingTarget.value += adjustment.amount;
    } else {
      byCategoryId.set(target.id, { value: adjustment.amount, node: target });
    }
  }

  // Roll-up ancestor totals: if "Salarii brut" got 35k mapped to it, the parent
  // "Salarii" should reflect 35k (plus its own direct mappings, if any).
  // Walk each touched node up the parent chain and accumulate.
  const rolledUp = new Map<string, number>();
  for (const { value, node } of byCategoryId.values()) {
    let cur: typeof node | undefined = node;
    while (cur) {
      rolledUp.set(cur.id, (rolledUp.get(cur.id) ?? 0) + value);
      cur = cur.parentId ? resolver.byId.get(cur.parentId) : undefined;
    }
  }

  // Build display items: a depth-first walk over the category tree, emitting
  // a row for every node that has either a direct mapping or a non-zero
  // rolled-up total. Root → indented children.
  const items: CategoryBreakdownItem[] = [];
  const visited = new Set<string>();

  function emit(nodeId: string, depth: number): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = resolver.byId.get(nodeId);
    if (!node) return;
    const rolled = rolledUp.get(nodeId) ?? 0;
    if (Math.abs(rolled) < 0.01) return;
    items.push({
      code: nodeId,
      label: node.name,
      value: round2(rolled),
      percent: 0,
      depth,
    });
    for (const child of node.children) {
      emit(child.id, depth + 1);
    }
  }

  // Find roots — nodes whose parent is null AND that have any rolled value.
  // Need to iterate resolver state, not just byCategoryId, since a leaf-only
  // mapping still requires emitting its ancestor roots.
  const allRoots = Array.from(resolver.byId.values()).filter(
    (n) => n.parentId === null && n.kind === kind
  );
  for (const root of allRoots) {
    emit(root.id, 0);
  }

  // Fallback rows (no mapping in resolver) at depth 0.
  const labelsForFallback =
    kind === "expense" ? EXPENSE_LABELS_PATRON : REVENUE_LABELS_PATRON;
  for (const [code, value] of byFallbackCode.entries()) {
    items.push({
      code: `fallback:${code}`,
      label: labelsForFallback[code] ?? `Categoria ${code}`,
      value: round2(value),
      percent: 0,
      depth: 0,
    });
  }

  // Total for percentages = sum of ROOT items only (depth=0). Otherwise we
  // double-count parents and children.
  const rootSum = items
    .filter((i) => (i.depth ?? 0) === 0)
    .reduce((s, i) => s + Math.abs(i.value), 0);
  for (const item of items) {
    item.percent = rootSum > 0 ? round2((Math.abs(item.value) / rootSum) * 100) : 0;
  }

  return items.filter((i) => Math.abs(i.value) > 0.01);
}

/* -------------------------------------------------------------------------- */
/*            VERTICAL BREAKDOWN (Axa B) — PR-2c                              */
/* -------------------------------------------------------------------------- */

/**
 * Decompose this month's revenue and expenses across the firm's verticals.
 *
 * For every leaf class 6 / 7 account:
 *   1. Determine the monthly amount (rulajD for expenses, rulajC for revenues,
 *      contra-account 609/709 subtracts).
 *   2. Subtract the partner-override adjustments that target OTHER categories
 *      from this analytic cont — these slices leave the cont's horizontal and
 *      will be re-distributed below according to their target category's own
 *      allocation. What stays on the cont is the "reziduu".
 *   3. Resolve the cont through the VerticalResolver and split the reziduu.
 * Then, for every partner adjustment:
 *   4. Resolve the TARGET CATEGORY through the same resolver (category-level
 *      allocations win; otherwise fall back to the firm's default vertical).
 *   5. Add slices to the target vertical buckets.
 *
 * Without (4)+(5), axa B would double-count: the rulaj appears in axa A under
 * the override's target category but stays on the cont's horizontal here.
 *
 * Verticals with zero in both revenue and expenses are still returned with all
 * zeros — the UI may want to show them so the patron sees "yes, my Coworking
 * line is silent this month" rather than wondering if it broke.
 */
export function computeVerticalBreakdown(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  resolver: VerticalResolverState,
  verticals: Array<{ id: string; name: string; isDefault: boolean }>,
  partnerAdjustments: PartnerCategoryAdjustment[] = [],
  categoryResolver: ResolverState | null = null
): VerticalBreakdownItem[] {
  const totals = new Map<string, { revenue: number; expenses: number }>();
  for (const v of verticals) totals.set(v.id, { revenue: 0, expenses: 0 });

  // Bucket adjustments by analyticCont so a single pass over rows can ask
  // "how much was diverted away from THIS cont?" in O(1).
  const adjustedAwayByCont = new Map<string, number>();
  for (const adj of partnerAdjustments) {
    adjustedAwayByCont.set(
      adj.analyticCont,
      (adjustedAwayByCont.get(adj.analyticCont) ?? 0) + adj.amount
    );
  }

  const leaves = rows.filter((r) => r.isLeaf);
  for (const row of leaves) {
    const base = row.contBase;
    const first = base.charAt(0);
    if (first !== "6" && first !== "7") continue;
    const meta = lookupByBase(base, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;

    let amount: number;
    let bucket: "revenue" | "expenses";
    if (first === "6") {
      if (base.startsWith("609")) {
        amount = -row.rulajC; // contra-expense
      } else {
        amount = row.rulajD;
      }
      bucket = "expenses";
    } else {
      const code2 = base.substring(0, 2);
      if (code2 === "71" || code2 === "72") continue;
      if (base.startsWith("709")) {
        amount = -row.rulajD;
      } else {
        amount = row.rulajC;
      }
      bucket = "revenue";
    }

    // Subtract whatever this cont has redirected to other categories via
    // partner overrides. The redirected slices follow the TARGET category's
    // own allocation in the second loop below.
    const adjustedAway = adjustedAwayByCont.get(row.cont) ?? 0;
    const residual = amount - adjustedAway;

    if (Math.abs(residual) < 0.01) continue;

    const resolvedCat = categoryResolver
      ? resolveCategoryForCont(row.cont, categoryResolver)
      : null;
    const categoryPath = resolvedCat
      ? resolvedCat.path.map((n) => n.id).reverse()
      : [];
    const allocation = resolveAllocationForCont(row.cont, resolver, categoryPath);
    const slices = applySplit(residual, allocation.splits);
    for (const slice of slices) {
      const entry = totals.get(slice.verticalId);
      if (!entry) continue;
      entry[bucket] += slice.amount;
    }
  }

  // Apply each partner-override adjustment to the TARGET category's vertical
  // allocation (or the firm default if the category has no allocation).
  for (const adj of partnerAdjustments) {
    const adjBase = adj.analyticCont.split(".")[0].replace(/[^0-9]/g, "");
    const first = adjBase.charAt(0);
    if (first !== "6" && first !== "7") continue;
    const bucket: "revenue" | "expenses" =
      first === "6" ? "expenses" : "revenue";

    const resolved = resolveAllocationForCategory(adj.targetCategoryId, resolver);
    const slices = applySplit(adj.amount, resolved.splits);
    for (const slice of slices) {
      const entry = totals.get(slice.verticalId);
      if (!entry) continue;
      entry[bucket] += slice.amount;
    }
  }

  const totalExpensesAll = Array.from(totals.values()).reduce(
    (s, t) => s + t.expenses,
    0
  );

  return verticals.map((v) => {
    const t = totals.get(v.id) ?? { revenue: 0, expenses: 0 };
    const revenue = round2(t.revenue);
    const expenses = round2(t.expenses);
    return {
      verticalId: v.id,
      name: v.name,
      revenue,
      expenses,
      profit: round2(revenue - expenses),
      expenseSharePct:
        totalExpensesAll > 0 ? round2((t.expenses / totalExpensesAll) * 100) : 0,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*           CASHFLOW O/I/F SPLIT (§8) — derived from account ranges          */
/* -------------------------------------------------------------------------- */

/**
 * Decompose this month's net cash change into Operating / Investing / Financing.
 *
 * Approximation rules (account-class based, no per-movement tagging required):
 *
 *   INVESTING (class 2 — imobilizari):
 *     - Net DEB on 21x/23x = buying assets (outflow)
 *     - Net CRED on 21x/23x = selling assets (inflow)
 *
 *   FINANCING:
 *     - 162, 167 (long-term loans): CRED = drawn (in), DEB = repaid (out)
 *     - 519 (credite bancare scurte): CRED = drawn, DEB = repaid
 *     - 457 (dividende de plata): DEB rulaj = dividends paid out
 *     - 1012, 1041, 456 (capital): CRED = aporturi (in), DEB = retrageri (out)
 *
 *   OPERATING:
 *     - residual: netChange − investing − financing
 *
 * `operatingDetail`, `investingDetail`, `financingDetail` carry the top contributors.
 */
export function computeCashflowBreakdown(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  prevPeriodCashEnd: number,
  currentCashEnd: number
): CashflowBreakdown {
  const leaves = rows.filter((r) => r.isLeaf);

  let investing = 0;
  let financing = 0;
  const investingDetail: Array<{ label: string; value: number; kind: "in" | "out" }> = [];
  const financingDetail: Array<{ label: string; value: number; kind: "in" | "out" }> = [];

  for (const row of leaves) {
    const base = row.contBase;
    const meta = lookupByBase(base, catalog);
    if (meta?.isExtraBilantier) continue;

    const debCent = row.rulajD;
    const credCent = row.rulajC;

    if (base.startsWith("21") || base.startsWith("23")) {
      // Imobilizari corporale + in curs
      const net = credCent - debCent;
      if (Math.abs(net) >= 0.01) {
        investing += net;
        if (net < 0) {
          investingDetail.push({
            label: row.denumire || `Investitie ${base}`,
            value: round2(-net),
            kind: "out",
          });
        } else {
          investingDetail.push({
            label: row.denumire || `Vanzare ${base}`,
            value: round2(net),
            kind: "in",
          });
        }
      }
    } else if (base.startsWith("26") || base.startsWith("27")) {
      // Imobilizari financiare
      const net = credCent - debCent;
      if (Math.abs(net) >= 0.01) {
        investing += net;
        investingDetail.push({
          label: row.denumire || `Investitie financiara ${base}`,
          value: round2(Math.abs(net)),
          kind: net < 0 ? "out" : "in",
        });
      }
    } else if (
      base.startsWith("162") ||
      base.startsWith("167") ||
      base.startsWith("519")
    ) {
      const net = credCent - debCent;
      if (Math.abs(net) >= 0.01) {
        financing += net;
        financingDetail.push({
          label: row.denumire || `Credit ${base}`,
          value: round2(Math.abs(net)),
          kind: net > 0 ? "in" : "out",
        });
      }
    } else if (base.startsWith("457")) {
      // Dividende platite: rulajD = plati catre actionari
      if (debCent >= 0.01) {
        financing -= debCent;
        financingDetail.push({
          label: "Dividende platite actionari",
          value: round2(debCent),
          kind: "out",
        });
      }
    } else if (
      base.startsWith("1011") ||
      base.startsWith("1012") ||
      base.startsWith("1041") ||
      base.startsWith("1043") ||
      base.startsWith("456")
    ) {
      const net = credCent - debCent;
      if (Math.abs(net) >= 0.01) {
        financing += net;
        financingDetail.push({
          label: row.denumire || `Capital ${base}`,
          value: round2(Math.abs(net)),
          kind: net > 0 ? "in" : "out",
        });
      }
    } else if (base.startsWith("4551")) {
      // Creditare asociati: CRED = imprumut primit, DEB = restituire
      const net = credCent - debCent;
      if (Math.abs(net) >= 0.01) {
        financing += net;
        financingDetail.push({
          label: "Creditare asociati",
          value: round2(Math.abs(net)),
          kind: net > 0 ? "in" : "out",
        });
      }
    }
  }

  const netChange = currentCashEnd - prevPeriodCashEnd;
  const operating = netChange - investing - financing;

  // Build operatingDetail from class-7 (incasari clienti) and class-6 (plati)
  // proxies. We can't perfectly attribute without journal-level data, but this
  // gives the user a sense of the magnitude.
  const operatingDetail: Array<{ label: string; value: number; kind: "in" | "out" }> = [];

  // Top 3 inflow proxies from 411/4111/418 net credit movements
  let clientiIn = 0;
  let statRefund = 0;
  let salariiOut = 0;
  let furnizoriOut = 0;
  let taxeOut = 0;

  for (const row of leaves) {
    const base = row.contBase;
    if (base.startsWith("411") || base.startsWith("418") || base.startsWith("413")) {
      const n = row.rulajC - row.rulajD;
      if (n > 0) clientiIn += n;
    } else if (base.startsWith("4424")) {
      statRefund += row.rulajD;
    } else if (base.startsWith("421") || base.startsWith("423") || base.startsWith("425")) {
      salariiOut += row.rulajD;
    } else if (base.startsWith("401") || base.startsWith("403") || base.startsWith("404") || base.startsWith("408")) {
      const n = row.rulajD - row.rulajC;
      if (n > 0) furnizoriOut += n;
    } else if (
      base.startsWith("4423") ||
      base.startsWith("431") ||
      base.startsWith("436") ||
      base.startsWith("4371") ||
      base.startsWith("4372") ||
      base.startsWith("441") ||
      base.startsWith("4441") ||
      base.startsWith("446") ||
      base.startsWith("447")
    ) {
      taxeOut += row.rulajD;
    }
  }

  if (clientiIn > 0.01) {
    operatingDetail.push({ label: "Incasari de la clienti", value: round2(clientiIn), kind: "in" });
  }
  if (statRefund > 0.01) {
    operatingDetail.push({ label: "Recuperare TVA / impozit", value: round2(statRefund), kind: "in" });
  }
  if (furnizoriOut > 0.01) {
    operatingDetail.push({ label: "Plati catre furnizori", value: round2(furnizoriOut), kind: "out" });
  }
  if (salariiOut > 0.01) {
    operatingDetail.push({ label: "Plati salarii", value: round2(salariiOut), kind: "out" });
  }
  if (taxeOut > 0.01) {
    operatingDetail.push({ label: "Plati taxe si contributii", value: round2(taxeOut), kind: "out" });
  }

  // Sort each detail list by value desc
  operatingDetail.sort((a, b) => b.value - a.value);
  investingDetail.sort((a, b) => b.value - a.value);
  financingDetail.sort((a, b) => b.value - a.value);

  return {
    cashStart: round2(prevPeriodCashEnd),
    cashEnd: round2(currentCashEnd),
    netChange: round2(netChange),
    operating: round2(operating),
    investing: round2(investing),
    financing: round2(financing),
    operatingDetail: operatingDetail.slice(0, 8),
    investingDetail: investingDetail.slice(0, 6),
    financingDetail: financingDetail.slice(0, 6),
  };
}

/* -------------------------------------------------------------------------- */
/*           PATRIMONIU (§12) — Activ vs Pasiv at period end                  */
/* -------------------------------------------------------------------------- */

interface BucketDef {
  id: string;
  label: string;
  description: string;
  /** Functions to assign rows. Returns +value to add, -value to subtract,
   *  0/null to skip. */
  match: (row: BalanceRowView, catalog: Map<string, CatalogAccount>) => number;
}

const ACTIV_BUCKETS: BucketDef[] = [
  {
    id: "imobilizari",
    label: "Bunuri si echipamente",
    description: "Cladiri, masini, utilaje, IT — lucruri care raman ani in firma. Activele scad pe masura ce se amortizeaza.",
    match: (row) => {
      const b = row.contBase;
      // 20x, 21x, 23x, 26x, 27x = brut; 28x = amortizare cumulata (contra)
      if (b.startsWith("20") || b.startsWith("21") || b.startsWith("23") || b.startsWith("26") || b.startsWith("27")) {
        return row.finD - row.finC;
      }
      if (b.startsWith("28") || b.startsWith("29")) {
        // amortizari / ajustari de valoare — subtract from net
        return -(row.finC - row.finD);
      }
      return 0;
    },
  },
  {
    id: "stocuri",
    label: "Marfa si materii prime",
    description: "Stocul firmei: marfa, materii prime, produse finite, ambalaje.",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("3") && b.length >= 2 && b[1] !== "9") {
        return row.finD - row.finC;
      }
      // 39x = ajustari de valoare la stocuri (contra)
      if (b.startsWith("39")) return -(row.finC - row.finD);
      return 0;
    },
  },
  {
    id: "creante",
    label: "De primit de la clienti",
    description: "Facturi emise neincasate inca, plus alte sume de incasat (TVA de recuperat, debitori).",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("411") || b.startsWith("413") || b.startsWith("418")) {
        return Math.max(row.finD - row.finC, 0);
      }
      if (b.startsWith("461") || b.startsWith("4424") || b.startsWith("4428")) {
        return Math.max(row.finD - row.finC, 0);
      }
      if (b.startsWith("428") && row.finD > row.finC) {
        return row.finD - row.finC;
      }
      // 419 = clienti creditori (contra)
      if (b.startsWith("419")) return -(row.finC - row.finD);
      return 0;
    },
  },
  {
    id: "cash",
    label: "Bani in casa si banca",
    description: "Soldul conturilor curente, casa, valori in tranzit, avansuri trezorerie.",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("512") && !b.startsWith("5125")) return Math.max(row.finD - row.finC, 0);
      if (b.startsWith("531")) return Math.max(row.finD - row.finC, 0);
      if (b.startsWith("532")) return Math.max(row.finD - row.finC, 0);
      if (b.startsWith("541")) return Math.max(row.finD - row.finC, 0);
      if (b.startsWith("542")) return Math.max(row.finD - row.finC, 0);
      if (b.startsWith("581")) return Math.max(row.finD - row.finC, 0);
      return 0;
    },
  },
  {
    id: "cheltuieliInAvans",
    label: "Cheltuieli platite in avans",
    description: "Abonamente, asigurari, chirii platite acum pentru luni viitoare.",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("471")) return Math.max(row.finD - row.finC, 0);
      return 0;
    },
  },
];

const PASIV_BUCKETS: BucketDef[] = [
  {
    id: "capital",
    label: "Capital social si rezerve",
    description: "Capitalul depus la infiintare plus rezerve construite din profituri trecute.",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("101") || b.startsWith("104") || b.startsWith("105") || b.startsWith("106")) {
        return row.finC - row.finD;
      }
      // 109 = actiuni proprii (contra capital)
      if (b.startsWith("109")) return -(row.finD - row.finC);
      return 0;
    },
  },
  {
    id: "rezultat",
    label: "Profit / pierdere acumulata",
    description: "Profitul firmei: ce e in 121 (anul curent), 117 (anii precedenti), minus repartizari (129).",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("121") || b.startsWith("117")) {
        return row.finC - row.finD;
      }
      if (b.startsWith("129")) return -(row.finD - row.finC);
      return 0;
    },
  },
  {
    id: "datoriiLT",
    label: "Datorii pe termen lung",
    description: "Credite bancare > 1 an, leasing, imprumuturi de la asociati.",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("162") || b.startsWith("166") || b.startsWith("167") || b.startsWith("168")) {
        return Math.max(row.finC - row.finD, 0);
      }
      if (b.startsWith("4551")) return Math.max(row.finC - row.finD, 0);
      return 0;
    },
  },
  {
    id: "datoriiCT",
    label: "Datorii pe termen scurt",
    description: "Furnizori, salarii, contributii, TVA — tot ce trebuie platit in urmatoarele 12 luni.",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("401") || b.startsWith("403") || b.startsWith("404") || b.startsWith("405") || b.startsWith("408")) {
        return Math.max(row.finC - row.finD, 0);
      }
      if (b.startsWith("421") || b.startsWith("423") || b.startsWith("425") || b.startsWith("426") || b.startsWith("427") || b.startsWith("428")) {
        return Math.max(row.finC - row.finD, 0);
      }
      if (b.startsWith("431") || b.startsWith("436") || b.startsWith("437") || b.startsWith("438")) {
        return Math.max(row.finC - row.finD, 0);
      }
      if (b.startsWith("441") || b.startsWith("4423") || b.startsWith("4426") || b.startsWith("4427") || b.startsWith("4428") || b.startsWith("444") || b.startsWith("446") || b.startsWith("447") || b.startsWith("448")) {
        return Math.max(row.finC - row.finD, 0);
      }
      if (b.startsWith("455") && !b.startsWith("4551")) return Math.max(row.finC - row.finD, 0);
      if (b.startsWith("457") || b.startsWith("462") || b.startsWith("509") || b.startsWith("519")) {
        return Math.max(row.finC - row.finD, 0);
      }
      // 409 = furnizori debitori (contra)
      if (b.startsWith("409")) return -(row.finD - row.finC);
      return 0;
    },
  },
  {
    id: "venituriInAvans",
    label: "Venituri incasate in avans",
    description: "Bani primiti deja pentru servicii viitoare (abonamente, contracte multi-luna).",
    match: (row) => {
      const b = row.contBase;
      if (b.startsWith("472")) return Math.max(row.finC - row.finD, 0);
      return 0;
    },
  },
];

export function computePatrimoniu(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  asOfYear: number,
  asOfMonth: number
): Patrimoniu {
  const leaves = rows.filter((r) => r.isLeaf);

  function buildBucket(def: BucketDef): PatrimoniuBucket {
    let total = 0;
    const items: Array<{ code: string; label: string; value: number }> = [];
    for (const row of leaves) {
      const meta = lookupByBase(row.contBase, catalog);
      if (meta?.isExtraBilantier) continue;
      const contribution = def.match(row, catalog);
      if (Math.abs(contribution) < 0.01) continue;
      total += contribution;
      items.push({
        code: row.cont,
        label: row.denumire || row.cont,
        value: round2(contribution),
      });
    }
    items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      value: round2(total),
      items: items.slice(0, 20),
    };
  }

  const activ = ACTIV_BUCKETS.map(buildBucket);
  const pasiv = PASIV_BUCKETS.map(buildBucket);

  const totalActiv = round2(activ.reduce((s, b) => s + b.value, 0));
  const totalPasiv = round2(pasiv.reduce((s, b) => s + b.value, 0));
  const difference = round2(totalActiv - totalPasiv);

  return {
    asOfYear,
    asOfMonth,
    activ,
    pasiv,
    totalActiv,
    totalPasiv,
    difference,
    isBalanced: Math.abs(difference) < 1,
  };
}

/* -------------------------------------------------------------------------- */
/*           VERDICT NARATIV (§6)                                             */
/* -------------------------------------------------------------------------- */

function fmtLei(n: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(Math.abs(n));
}

export function computeVerdict(
  summary: FinancialSummary,
  cashPosition: CashPosition,
  runway: RunwayProjection,
  yoy: YearOverYearComparison,
  marja: number | null
): Verdict {
  const profit = summary.cifraAfaceriLuna - summary.cheltuieliLuna;
  const profitable = profit > 0;
  const cashCovers = cashPosition.net >= 0;
  const runwayOk = runway.status === "comfortable";
  const runwayTight = runway.status === "tight";
  const runwayCritical = runway.status === "critical";

  const positivesCount =
    Number(profitable) + Number(cashCovers) + Number(runwayOk);
  const warningsCount =
    Number(!profitable) + Number(!cashCovers) + Number(runwayCritical);

  let tone: Verdict["tone"];
  if (warningsCount >= 2) tone = "negative";
  else if (warningsCount === 1) tone = "warning";
  else if (positivesCount >= 2) tone = "positive";
  else tone = "neutral";

  // Headline
  let headline: string;
  if (tone === "positive") {
    headline = `Firma e pe plus si lichiditatea e in regula`;
  } else if (tone === "negative") {
    headline = `Atentie: firma are mai multe probleme financiare`;
  } else if (tone === "warning") {
    headline = profitable
      ? `Firma face profit, dar atentie la cash`
      : `Firma e in pierdere luna asta`;
  } else {
    headline = `Luna obisnuita, fara probleme majore`;
  }

  // Body
  const parts: string[] = [];
  if (summary.cifraAfaceriLuna > 0) {
    if (profitable) {
      parts.push(
        `Ai facut ${fmtLei(summary.cifraAfaceriLuna)} lei venituri si ${fmtLei(summary.cheltuieliLuna)} lei cheltuieli, deci ${fmtLei(profit)} lei profit.`
      );
    } else {
      parts.push(
        `Veniturile (${fmtLei(summary.cifraAfaceriLuna)} lei) au fost mai mici decat cheltuielile (${fmtLei(summary.cheltuieliLuna)} lei), pierdere ${fmtLei(profit)} lei.`
      );
    }
  }
  if (cashPosition.net >= 0) {
    parts.push(
      `Cash-ul disponibil (${fmtLei(cashPosition.totalDisponibil)} lei) acopera obligatiile (${fmtLei(cashPosition.totalObligatii)} lei).`
    );
  } else {
    parts.push(
      `Obligatiile depasesc disponibilul cu ${fmtLei(cashPosition.net)} lei.`
    );
  }
  if (runway.status !== "unknown" && runway.monthlyBurnRate > 0) {
    if (runwayCritical) {
      parts.push(
        `La ritmul actual de cheltuieli, banii ajung pentru aproximativ ${runway.monthsRemaining.toFixed(1)} luni — sub pragul de siguranta.`
      );
    } else if (runwayTight) {
      parts.push(
        `Banii din casa si banca acopera ${runway.monthsRemaining.toFixed(1)} luni de operare la ritmul actual.`
      );
    } else {
      parts.push(
        `Banii ajung pentru ${runway.monthsRemaining.toFixed(1)} luni la ritmul actual de cheltuieli — confortabil.`
      );
    }
  }

  const body = parts.join(" ");

  const highlights: string[] = [];
  if (marja !== null && summary.cifraAfaceriLuna > 0) {
    highlights.push(`Marja ${marja.toFixed(1)}%`);
  }
  if (runway.status !== "unknown" && runway.monthlyBurnRate > 0) {
    highlights.push(`Cash ${runway.monthsRemaining.toFixed(1)} luni`);
  }
  if (yoy.hasPreviousYear && yoy.revenue.deltaPct !== null) {
    const sign = yoy.revenue.deltaPct >= 0 ? "+" : "";
    highlights.push(`Venituri ${sign}${yoy.revenue.deltaPct.toFixed(0)}% YoY`);
  }

  return { tone, headline, body, highlights: highlights.slice(0, 3) };
}

/* -------------------------------------------------------------------------- */
/*           KPI STRIP (§6) — 4-6 power KPIs                                  */
/* -------------------------------------------------------------------------- */

export function computeKpiStrip(
  summary: FinancialSummary,
  cashPosition: CashPosition,
  runway: RunwayProjection,
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  topCustomersByActivity: TopActivityPartner[]
): KpiStripItem[] {
  const items: KpiStripItem[] = [];

  // 1. Working capital = active curente - datorii curente (proxy)
  const totalCash = summary.soldRegistruCasa + summary.soldConturiBancare;
  const workingCapital =
    totalCash + summary.clientiNeincasati - summary.furnizoriNeachitati;
  items.push({
    id: "workingCapital",
    label: "Capital de lucru",
    value: `${fmtLei(workingCapital)} lei`,
    hint: "Cash + clienti − datorii furnizori. Pozitiv = poti opera fara presiune.",
    state: workingCapital >= 0 ? "good" : "danger",
  });

  // 2. Burn rate
  if (runway.monthlyBurnRate > 0) {
    items.push({
      id: "burnRate",
      label: "Cheltuieli medii lunare",
      value: `${fmtLei(runway.monthlyBurnRate)} lei`,
      hint: `Media ultimelor ${runway.windowMonths} luni — cu cati bani opereaza firma pe luna.`,
      state: "neutral",
    });
  }

  // 3. Runway
  if (runway.monthlyBurnRate > 0 && runway.status !== "unknown") {
    items.push({
      id: "runway",
      label: "Cash runway",
      value: `${runway.monthsRemaining.toFixed(1)} luni`,
      hint: "Cati luni mai poate functiona firma daca nu mai intra venituri.",
      state:
        runway.status === "comfortable"
          ? "good"
          : runway.status === "tight"
          ? "warn"
          : "danger",
    });
  }

  // 4. TVA de plata
  let tvaPayable = 0;
  for (const row of rows.filter((r) => r.isLeaf)) {
    if (row.contBase.startsWith("4423") && row.finC > row.finD) {
      tvaPayable += row.finC - row.finD;
    }
  }
  if (tvaPayable > 0.01) {
    items.push({
      id: "tva",
      label: "TVA de plata",
      value: `${fmtLei(tvaPayable)} lei`,
      hint: "Suma datorata la ANAF. Scadenta: 25 ale lunii urmatoare.",
      state: tvaPayable > 50_000 ? "warn" : "neutral",
    });
  }

  // 5. Top client concentration
  if (topCustomersByActivity.length > 0) {
    const top = topCustomersByActivity[0];
    const concentrationState =
      top.percent > 50 ? "warn" : top.percent > 35 ? "neutral" : "good";
    items.push({
      id: "concentration",
      label: "Concentrare top client",
      value: `${top.percent.toFixed(0)}%`,
      hint: `${top.partnerName} reprezinta ${top.percent.toFixed(0)}% din incasarile lunii. Peste 50% = risc concentrare.`,
      state: concentrationState,
    });
  }

  // 6. Cash coverage of obligations
  if (cashPosition.totalObligatii > 0) {
    const coverage = cashPosition.totalDisponibil / cashPosition.totalObligatii;
    items.push({
      id: "coverage",
      label: "Acoperire obligatii",
      value: `${coverage.toFixed(1)}×`,
      hint: "De cate ori cash-ul tau acopera obligatiile imediate. Sub 1× = lipsa lichiditate.",
      state: coverage >= 1.5 ? "good" : coverage >= 1 ? "neutral" : "danger",
    });
  }

  return items.slice(0, 6);
}

/* -------------------------------------------------------------------------- */
/*           HEALTH SCORE (§10) — composite 0-100                             */
/* -------------------------------------------------------------------------- */

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function tierFromScore(score: number): {
  tier: HealthScore["tier"];
  tierLabel: string;
  message: string;
} {
  if (score >= 80) {
    return {
      tier: "excellent",
      tierLabel: "Sanatate excelenta",
      message: "Firma sta foarte bine din toate punctele de vedere principale.",
    };
  }
  if (score >= 60) {
    return {
      tier: "good",
      tierLabel: "Sanatate buna",
      message: "Firma e in regula in ansamblu, cu cateva zone de imbunatatit.",
    };
  }
  if (score >= 40) {
    return {
      tier: "watch",
      tierLabel: "Necesita atentie",
      message: "Cativa indicatori sunt sub prag — vezi detaliile mai jos.",
    };
  }
  return {
    tier: "alert",
    tierLabel: "Risc semnificativ",
    message: "Mai multi indicatori critici trag firma in jos. Discuta cu contabilul.",
  };
}

export function computeHealthScore(
  summary: FinancialSummary,
  runway: RunwayProjection,
  marja: number | null,
  patrimoniu: Patrimoniu
): HealthScore {
  // 1. Liquidity: runway-based. 6+ months = 100, 0 months = 0.
  let liquidityScore = 50;
  let liquidityMsg = "Indisponibil — nu avem cheltuieli istorice suficiente.";
  let liquidityState: HealthSubscore["state"] = "neutral";
  if (runway.status !== "unknown" && runway.monthlyBurnRate > 0) {
    liquidityScore = clamp((runway.monthsRemaining / 6) * 100, 0, 100);
    if (runway.monthsRemaining >= 6) {
      liquidityMsg = `${runway.monthsRemaining.toFixed(1)} luni de operare — peste pragul de 6 luni.`;
      liquidityState = "good";
    } else if (runway.monthsRemaining >= 3) {
      liquidityMsg = `${runway.monthsRemaining.toFixed(1)} luni — confortabil dar nu generos.`;
      liquidityState = "neutral";
    } else if (runway.monthsRemaining >= 1) {
      liquidityMsg = `${runway.monthsRemaining.toFixed(1)} luni — strans. Lichiditatea trebuie urmarita.`;
      liquidityState = "warn";
    } else {
      liquidityMsg = `Sub o luna — risc critic. Discuta urgent cu contabilul.`;
      liquidityState = "danger";
    }
  }

  // 2. Profitability: monthly margin. 20%+ = 100, <0% = 0.
  let profitScore = 50;
  let profitMsg = "Indisponibil — nu sunt venituri luna asta.";
  let profitState: HealthSubscore["state"] = "neutral";
  if (marja !== null) {
    profitScore = clamp(((marja - 0) / 20) * 100, 0, 100);
    if (marja >= 15) {
      profitMsg = `Marja ${marja.toFixed(1)}% — afacerea genereaza profit solid.`;
      profitState = "good";
    } else if (marja >= 5) {
      profitMsg = `Marja ${marja.toFixed(1)}% — modesta dar pozitiva.`;
      profitState = "neutral";
    } else if (marja >= 0) {
      profitMsg = `Marja ${marja.toFixed(1)}% — foarte subtire, costuri aproape de venituri.`;
      profitState = "warn";
    } else {
      profitMsg = `Marja ${marja.toFixed(1)}% — pierdere. Cheltuielile depasesc veniturile.`;
      profitState = "danger";
    }
  }

  // 3. Efficiency: receivables as share of monthly revenue (proxy for DSO).
  //    <30 days equiv (≤1× monthly revenue) = 100, >120 days (≥4×) = 0.
  let efficiencyScore = 50;
  let efficiencyMsg = "Indisponibil — nu sunt clienti sau venituri.";
  let efficiencyState: HealthSubscore["state"] = "neutral";
  if (summary.cifraAfaceriLuna > 0 && summary.clientiNeincasati > 0) {
    const ratio = summary.clientiNeincasati / summary.cifraAfaceriLuna;
    efficiencyScore = clamp(100 - ((ratio - 1) / 3) * 100, 0, 100);
    if (ratio <= 1) {
      efficiencyMsg = `Creantele sub o luna de venituri — clientii platesc rapid.`;
      efficiencyState = "good";
    } else if (ratio <= 2) {
      efficiencyMsg = `Creantele cat ${ratio.toFixed(1)} luni de venituri — perioada normala de incasare.`;
      efficiencyState = "neutral";
    } else if (ratio <= 3) {
      efficiencyMsg = `Creantele cat ${ratio.toFixed(1)} luni de venituri — incasarile incep sa intarzie.`;
      efficiencyState = "warn";
    } else {
      efficiencyMsg = `Creantele cat ${ratio.toFixed(1)} luni de venituri — risc semnificativ de neincasare.`;
      efficiencyState = "danger";
    }
  } else if (summary.clientiNeincasati === 0) {
    efficiencyScore = 100;
    efficiencyMsg = "Nu ai clienti restanti — toate facturile sunt incasate.";
    efficiencyState = "good";
  }

  // 4. Solvency: equity ratio = (capital + rezultat) / totalActiv. >50% = 100, <0 = 0.
  let solvencyScore = 50;
  let solvencyMsg = "Indisponibil — bilantul nu poate fi calculat.";
  let solvencyState: HealthSubscore["state"] = "neutral";
  if (patrimoniu.totalActiv > 0) {
    const capital = patrimoniu.pasiv.find((b) => b.id === "capital")?.value ?? 0;
    const rezultat = patrimoniu.pasiv.find((b) => b.id === "rezultat")?.value ?? 0;
    const equity = capital + rezultat;
    const equityRatio = (equity / patrimoniu.totalActiv) * 100;
    solvencyScore = clamp(((equityRatio - 0) / 50) * 100, 0, 100);
    if (equityRatio >= 40) {
      solvencyMsg = `Capitalul propriu reprezinta ${equityRatio.toFixed(0)}% din activ — autonomie financiara solida.`;
      solvencyState = "good";
    } else if (equityRatio >= 25) {
      solvencyMsg = `Capitalul propriu reprezinta ${equityRatio.toFixed(0)}% din activ — nivel acceptabil.`;
      solvencyState = "neutral";
    } else if (equityRatio >= 10) {
      solvencyMsg = `Capitalul propriu reprezinta doar ${equityRatio.toFixed(0)}% din activ — firma e finantata in mare parte de datorii.`;
      solvencyState = "warn";
    } else {
      solvencyMsg = `Capitalul propriu sub 10% din activ — risc de insolventa.`;
      solvencyState = "danger";
    }
  }

  const subscores: HealthSubscore[] = [
    { id: "liquidity", label: "Lichiditate", score: Math.round(liquidityScore), message: liquidityMsg, state: liquidityState },
    { id: "profitability", label: "Profitabilitate", score: Math.round(profitScore), message: profitMsg, state: profitState },
    { id: "efficiency", label: "Eficienta incasari", score: Math.round(efficiencyScore), message: efficiencyMsg, state: efficiencyState },
    { id: "solvency", label: "Solvabilitate", score: Math.round(solvencyScore), message: solvencyMsg, state: solvencyState },
  ];

  const composite = Math.round(
    (liquidityScore * 0.3 + profitScore * 0.3 + efficiencyScore * 0.2 + solvencyScore * 0.2)
  );
  const { tier, tierLabel, message } = tierFromScore(composite);

  return { score: composite, tier, tierLabel, message, subscores };
}

/* -------------------------------------------------------------------------- */
/*           FINANCIAL RATIOS CATALOG (§10 L2)                                */
/* -------------------------------------------------------------------------- */

function ratioState(
  value: number | null,
  rules: Array<{ gte?: number; lte?: number; state: FinancialRatio["state"] }>,
  defaultState: FinancialRatio["state"] = "neutral"
): FinancialRatio["state"] {
  if (value === null || !Number.isFinite(value)) return "unknown";
  for (const r of rules) {
    if (r.gte !== undefined && value >= r.gte) return r.state;
    if (r.lte !== undefined && value <= r.lte) return r.state;
  }
  return defaultState;
}

export function computeRatios(
  summary: FinancialSummary,
  patrimoniu: Patrimoniu,
  runway: RunwayProjection,
  marja: number | null,
  yoy: YearOverYearComparison
): FinancialRatio[] {
  const list: FinancialRatio[] = [];

  // Helper buckets
  const cashAndEq = patrimoniu.activ.find((b) => b.id === "cash")?.value ?? 0;
  const stocuri = patrimoniu.activ.find((b) => b.id === "stocuri")?.value ?? 0;
  const creante = patrimoniu.activ.find((b) => b.id === "creante")?.value ?? 0;
  const imobilizari = patrimoniu.activ.find((b) => b.id === "imobilizari")?.value ?? 0;
  const datoriiCT = patrimoniu.pasiv.find((b) => b.id === "datoriiCT")?.value ?? 0;
  const datoriiLT = patrimoniu.pasiv.find((b) => b.id === "datoriiLT")?.value ?? 0;
  const capital = patrimoniu.pasiv.find((b) => b.id === "capital")?.value ?? 0;
  const rezultat = patrimoniu.pasiv.find((b) => b.id === "rezultat")?.value ?? 0;
  const equity = capital + rezultat;
  const totalDatorii = datoriiCT + datoriiLT;
  const activeCurente = cashAndEq + stocuri + creante;

  // ---- LICHIDITATE ----
  list.push({
    id: "currentRatio",
    label: "Lichiditate curenta",
    formula: "Active curente / Datorii curente",
    group: "lichiditate",
    value: datoriiCT > 0 ? round2(activeCurente / datoriiCT) : null,
    format: "ratio",
    target: "> 1.5",
    state: ratioState(datoriiCT > 0 ? activeCurente / datoriiCT : null, [
      { gte: 1.5, state: "good" },
      { gte: 1, state: "neutral" },
      { gte: 0.5, state: "warn" },
      { lte: 0.5, state: "danger" },
    ]),
    interpretation:
      "De cate ori activele curente acopera datoriile pe termen scurt. Peste 1.5 = comfort.",
  });

  list.push({
    id: "quickRatio",
    label: "Lichiditate imediata",
    formula: "(Cash + Creante) / Datorii curente",
    group: "lichiditate",
    value: datoriiCT > 0 ? round2((cashAndEq + creante) / datoriiCT) : null,
    format: "ratio",
    target: "> 1",
    state: ratioState(datoriiCT > 0 ? (cashAndEq + creante) / datoriiCT : null, [
      { gte: 1, state: "good" },
      { gte: 0.7, state: "neutral" },
      { gte: 0.4, state: "warn" },
      { lte: 0.4, state: "danger" },
    ]),
    interpretation: "Capacitatea de plata fara a vinde stocul.",
  });

  list.push({
    id: "cashRatio",
    label: "Lichiditate cash",
    formula: "Cash / Datorii curente",
    group: "lichiditate",
    value: datoriiCT > 0 ? round2(cashAndEq / datoriiCT) : null,
    format: "ratio",
    target: "> 0.3",
    state: ratioState(datoriiCT > 0 ? cashAndEq / datoriiCT : null, [
      { gte: 0.5, state: "good" },
      { gte: 0.2, state: "neutral" },
      { gte: 0.1, state: "warn" },
      { lte: 0.1, state: "danger" },
    ]),
    interpretation: "Cat din datoriile pe termen scurt poti achita pe loc, din banii din cont.",
  });

  list.push({
    id: "workingCapital",
    label: "Capital de lucru",
    formula: "Active curente − Datorii curente",
    group: "lichiditate",
    value: round2(activeCurente - datoriiCT),
    format: "lei",
    target: "Pozitiv",
    state: ratioState(activeCurente - datoriiCT, [
      { gte: 1, state: "good" },
      { gte: 0, state: "neutral" },
      { lte: 0, state: "danger" },
    ]),
    interpretation: "Diferenta dintre ce poti incasa pe termen scurt si ce trebuie sa platesti.",
  });

  // ---- PROFITABILITATE ----
  list.push({
    id: "netMargin",
    label: "Marja neta",
    formula: "Profit / Cifra de afaceri",
    group: "profitabilitate",
    value: marja !== null ? round2(marja) : null,
    format: "percent",
    target: "> 10%",
    state: ratioState(marja, [
      { gte: 15, state: "good" },
      { gte: 5, state: "neutral" },
      { gte: 0, state: "warn" },
      { lte: 0, state: "danger" },
    ]),
    interpretation: "Cati lei profit raman din fiecare 100 lei vanduti.",
  });

  if (summary.cifraAfaceriLuna > 0 && summary.cheltuieliLuna >= 0) {
    const opMargin = ((summary.cifraAfaceriLuna - summary.cheltuieliLuna) / summary.cifraAfaceriLuna) * 100;
    list.push({
      id: "operatingMargin",
      label: "Marja operationala (luna)",
      formula: "(Venituri − Cheltuieli) / Venituri",
      group: "profitabilitate",
      value: round2(opMargin),
      format: "percent",
      state: ratioState(opMargin, [
        { gte: 15, state: "good" },
        { gte: 5, state: "neutral" },
        { gte: 0, state: "warn" },
        { lte: 0, state: "danger" },
      ]),
      interpretation: "Marja generata strict de activitatea operationala, fara efecte financiare.",
    });
  }

  if (equity > 0 && (summary.cifraAfaceriTotal - summary.cheltuieliTotal) !== 0) {
    const roe = ((summary.cifraAfaceriTotal - summary.cheltuieliTotal) / equity) * 100;
    list.push({
      id: "roe",
      label: "ROE (Return on Equity)",
      formula: "Profit anual / Capital propriu",
      group: "profitabilitate",
      value: round2(roe),
      format: "percent",
      target: "> 15%",
      state: ratioState(roe, [
        { gte: 15, state: "good" },
        { gte: 5, state: "neutral" },
        { gte: 0, state: "warn" },
        { lte: 0, state: "danger" },
      ]),
      interpretation: "Cati lei profit aduce fiecare 100 lei pe care i-ai investit in firma.",
    });
  }

  if (patrimoniu.totalActiv > 0) {
    const roa = ((summary.cifraAfaceriTotal - summary.cheltuieliTotal) / patrimoniu.totalActiv) * 100;
    list.push({
      id: "roa",
      label: "ROA (Return on Assets)",
      formula: "Profit anual / Total activ",
      group: "profitabilitate",
      value: round2(roa),
      format: "percent",
      target: "> 5%",
      state: ratioState(roa, [
        { gte: 10, state: "good" },
        { gte: 3, state: "neutral" },
        { gte: 0, state: "warn" },
        { lte: 0, state: "danger" },
      ]),
      interpretation: "Cat de eficient sunt folosite resursele firmei pentru a genera profit.",
    });
  }

  // ---- SOLVABILITATE ----
  if (patrimoniu.totalActiv > 0) {
    const equityRatio = (equity / patrimoniu.totalActiv) * 100;
    list.push({
      id: "equityRatio",
      label: "Autonomie financiara",
      formula: "Capital propriu / Total activ",
      group: "solvabilitate",
      value: round2(equityRatio),
      format: "percent",
      target: "> 30%",
      state: ratioState(equityRatio, [
        { gte: 40, state: "good" },
        { gte: 25, state: "neutral" },
        { gte: 10, state: "warn" },
        { lte: 10, state: "danger" },
      ]),
      interpretation:
        "Cat din firma este finantata din banii tai vs imprumuturi. Peste 30% = autonomie buna.",
    });
  }

  if (equity > 0) {
    const debtToEquity = totalDatorii / equity;
    list.push({
      id: "debtToEquity",
      label: "Datorii / Capital propriu",
      formula: "Total datorii / Capital propriu",
      group: "solvabilitate",
      value: round2(debtToEquity),
      format: "ratio",
      target: "< 1",
      state: ratioState(debtToEquity, [
        { lte: 0.5, state: "good" },
        { lte: 1, state: "neutral" },
        { lte: 2, state: "warn" },
        { gte: 2, state: "danger" },
      ]),
      interpretation: "De cate ori datoriile depasesc capitalul propriu. Sub 1 = sanatos.",
    });
  }

  // ---- EFICIENTA ----
  if (summary.cifraAfaceriLuna > 0 && creante > 0) {
    const dsoMonths = creante / summary.cifraAfaceriLuna;
    const dsoDays = dsoMonths * 30;
    list.push({
      id: "dsoApprox",
      label: "DSO aproximativ (zile incasare)",
      formula: "Creante / Vanzari medii zilnice",
      group: "eficienta",
      value: round2(dsoDays),
      format: "days",
      target: "< 60 zile",
      state: ratioState(dsoDays, [
        { lte: 30, state: "good" },
        { lte: 60, state: "neutral" },
        { lte: 90, state: "warn" },
        { gte: 90, state: "danger" },
      ]),
      interpretation:
        "Cate zile in medie astepti pana incasezi facturile. Calculat aproximativ — pentru DSO exact e nevoie de data factura.",
    });
  }

  if (summary.cheltuieliLuna > 0 && summary.furnizoriNeachitati > 0) {
    const dpoMonths = summary.furnizoriNeachitati / summary.cheltuieliLuna;
    const dpoDays = dpoMonths * 30;
    list.push({
      id: "dpoApprox",
      label: "DPO aproximativ (zile de plata)",
      formula: "Furnizori / Cheltuieli medii zilnice",
      group: "eficienta",
      value: round2(dpoDays),
      format: "days",
      state: ratioState(dpoDays, [
        { lte: 30, state: "neutral" },
        { lte: 60, state: "good" },
        { lte: 90, state: "neutral" },
        { gte: 90, state: "warn" },
      ]),
      interpretation:
        "Cate zile in medie iei pana platesti furnizorii. Mai mult inseamna mai mult timp cu banii in cont.",
    });
  }

  if (yoy.hasPreviousYear && yoy.revenue.deltaPct !== null) {
    list.push({
      id: "revenueGrowth",
      label: "Crestere venituri YoY",
      formula: "Venituri luna curenta vs aceeasi luna anul trecut",
      group: "eficienta",
      value: yoy.revenue.deltaPct,
      format: "percent",
      target: "> 0%",
      state: ratioState(yoy.revenue.deltaPct, [
        { gte: 15, state: "good" },
        { gte: 0, state: "neutral" },
        { gte: -10, state: "warn" },
        { lte: -10, state: "danger" },
      ]),
      interpretation: "Cu cat ai crescut vs aceeasi luna anul trecut.",
    });
  }

  if (runway.monthlyBurnRate > 0 && runway.monthsRemaining > 0) {
    list.push({
      id: "runwayMonths",
      label: "Cash runway (luni)",
      formula: "Cash disponibil / Cheltuieli lunare medii",
      group: "eficienta",
      value: round2(runway.monthsRemaining),
      format: "ratio",
      target: "> 6 luni",
      state:
        runway.status === "comfortable"
          ? "good"
          : runway.status === "tight"
          ? "warn"
          : "danger",
      interpretation:
        "Cati luni mai poate functiona firma daca veniturile s-ar opri complet.",
    });
  }

  return list;
}

/* -------------------------------------------------------------------------- */
/*           OBLIGATIONS CALENDAR (§11)                                       */
/* -------------------------------------------------------------------------- */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateIso: string, today: Date): number {
  const d = new Date(dateIso + "T00:00:00");
  const diffMs = d.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function computeObligations(
  rows: BalanceRowView[],
  asOfYear: number,
  asOfMonth: number,
  today: Date = new Date()
): ObligationEntry[] {
  const items: ObligationEntry[] = [];
  const leaves = rows.filter((r) => r.isLeaf);

  // TVA scadent — 25 luna urmatoare
  let tva = 0;
  let salariiPayable = 0;
  let contribPayable = 0;
  let impozitProfit = 0;

  for (const row of leaves) {
    const b = row.contBase;
    if (b.startsWith("4423") && row.finC > row.finD) tva += row.finC - row.finD;
    if (
      b.startsWith("421") ||
      b.startsWith("423") ||
      b.startsWith("425") ||
      b.startsWith("426") ||
      b.startsWith("428")
    ) {
      if (row.finC > row.finD) salariiPayable += row.finC - row.finD;
    }
    if (
      b.startsWith("431") ||
      b.startsWith("436") ||
      b.startsWith("4371") ||
      b.startsWith("4372") ||
      b.startsWith("4441")
    ) {
      if (row.finC > row.finD) contribPayable += row.finC - row.finD;
    }
    if (b.startsWith("441") && row.finC > row.finD) {
      impozitProfit += row.finC - row.finD;
    }
  }

  // Build dates
  const nextMonth = new Date(asOfYear, asOfMonth, 1); // month index is 0-based, so this is the 1st of asOfMonth+1
  const tvaDueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 25);
  const salariiDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 10);
  const contribDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 25);

  if (tva > 0.01) {
    const iso = isoDate(tvaDueDate);
    items.push({
      id: "tva",
      label: "TVA de plata la ANAF",
      dueDate: iso,
      amount: round2(tva),
      hint: "TVA declarat in D300 pentru luna precedenta. Termen: 25 ale lunii.",
      kind: "tax",
      daysUntil: daysUntil(iso, today),
    });
  }

  if (salariiPayable > 0.01) {
    const iso = isoDate(salariiDate);
    items.push({
      id: "salarii",
      label: "Plata salarii nete angajati",
      dueDate: iso,
      amount: round2(salariiPayable),
      hint: "Salariile nete pentru luna anterioara. De obicei platite in jurul datei de 10.",
      kind: "salary",
      daysUntil: daysUntil(iso, today),
    });
  }

  if (contribPayable > 0.01) {
    const iso = isoDate(contribDate);
    items.push({
      id: "contributii",
      label: "Contributii sociale (CAS, CASS, CAM)",
      dueDate: iso,
      amount: round2(contribPayable),
      hint: "Contributii angajat/angajator declarate in D112. Termen: 25 ale lunii.",
      kind: "contrib",
      daysUntil: daysUntil(iso, today),
    });
  }

  if (impozitProfit > 0.01) {
    // Profit tax quarterly, 25 of month following quarter
    const q = Math.floor((asOfMonth - 1) / 3);
    const quarterEndMonth = (q + 1) * 3; // 3, 6, 9, 12
    const dueYear = quarterEndMonth >= 12 ? asOfYear + 1 : asOfYear;
    const dueMonth = quarterEndMonth >= 12 ? 0 : quarterEndMonth;
    const profitDate = new Date(dueYear, dueMonth, 25);
    const iso = isoDate(profitDate);
    items.push({
      id: "impozitProfit",
      label: "Impozit pe profit",
      dueDate: iso,
      amount: round2(impozitProfit),
      hint: "Plata trimestriala estimata pentru impozitul pe profit. Termen: 25 ale lunii urmatoare trimestrului.",
      kind: "tax",
      daysUntil: daysUntil(iso, today),
    });
  }

  items.sort((a, b) => a.daysUntil - b.daysUntil);
  return items;
}

/* -------------------------------------------------------------------------- */
/*           TOP CUSTOMERS/SUPPLIERS BY ACTIVITY (§9)                         */
/* -------------------------------------------------------------------------- */

export function computeTopCustomersByActivity(rows: BalanceRowView[]): TopActivityPartner[] {
  const candidates: TopActivityPartner[] = [];
  let total = 0;
  for (const row of rows) {
    if (!row.isLeaf) continue;
    if (!row.cont.includes(".")) continue;
    if (!row.contBase.startsWith("411")) continue;
    // Incoming cash from this client = rulajC (credit reduces 411 balance)
    const amount = row.rulajC;
    if (amount <= 0.01) continue;
    candidates.push({
      cont: row.cont,
      partnerName: row.denumire || row.cont,
      amount: round2(amount),
      percent: 0,
    });
    total += amount;
  }
  candidates.sort((a, b) => b.amount - a.amount);
  for (const c of candidates) {
    c.percent = total > 0 ? round2((c.amount / total) * 100) : 0;
  }
  return candidates.slice(0, 10);
}

export function computeTopSuppliersByActivity(rows: BalanceRowView[]): TopActivityPartner[] {
  const candidates: TopActivityPartner[] = [];
  let total = 0;
  for (const row of rows) {
    if (!row.isLeaf) continue;
    if (!row.cont.includes(".")) continue;
    if (!row.contBase.startsWith("401")) continue;
    // Outgoing cash to this supplier = rulajD (debit reduces 401 balance)
    const amount = row.rulajD;
    if (amount <= 0.01) continue;
    candidates.push({
      cont: row.cont,
      partnerName: row.denumire || row.cont,
      amount: round2(amount),
      percent: 0,
    });
    total += amount;
  }
  candidates.sort((a, b) => b.amount - a.amount);
  for (const c of candidates) {
    c.percent = total > 0 ? round2((c.amount / total) * 100) : 0;
  }
  return candidates.slice(0, 10);
}
