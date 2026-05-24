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
import { resolveAllocationForCont, applySplit } from "@/modules/verticals";
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
 *   2. Resolve the cont through the VerticalResolver to get its splits.
 *   3. Apply the percentages and add the slices to each vertical's bucket.
 *
 * Verticals with zero in both revenue and expenses are still returned with all
 * zeros — the UI may want to show them so the patron sees "yes, my Coworking
 * line is silent this month" rather than wondering if it broke.
 */
export function computeVerticalBreakdown(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  resolver: VerticalResolverState,
  verticals: Array<{ id: string; name: string; isDefault: boolean }>
): VerticalBreakdownItem[] {
  const totals = new Map<string, { revenue: number; expenses: number }>();
  for (const v of verticals) totals.set(v.id, { revenue: 0, expenses: 0 });

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
    if (Math.abs(amount) < 0.01) continue;

    const allocation = resolveAllocationForCont(row.cont, resolver);
    const slices = applySplit(amount, allocation.splits);
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
