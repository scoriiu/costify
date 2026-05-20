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
import type {
  FinancialSummary,
  CashPosition,
  CashPositionItem,
  OwnerWithdrawals,
  OwnerWithdrawalsItem,
  OutstandingPartner,
  Insight,
} from "./types";

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
