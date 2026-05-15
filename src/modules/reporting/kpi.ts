/**
 * KPI computation.
 *
 * Pure function: takes balance rows + the catalog and returns a snapshot.
 * Formulas are defined by D8 and D9 in docs/decisions/0001-plan-de-conturi-refactor.md.
 *
 * Divergences from the accountant's 2.4 recommendation are intentional and
 * documented in the ADR:
 *   - 581 and 5125 are EXCLUDED from the cash KPI (classified as transit).
 *   - TVA de plata uses the computed formula, not 4423 finC.
 */

import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";
import { loadCatalogSync } from "@/modules/accounts";
import type { KpiSnapshot } from "./types";

export function computeKpis(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>
): KpiSnapshot {
  const cat = catalog ?? loadCatalogSync();
  const leafRows = rows.filter((r) => r.isLeaf);

  const cashBank = computeCashKpi(leafRows, cat);
  const clientiCreante = computeReceivablesKpi(leafRows, cat);
  const furnizoriDatorii = computePayablesKpi(leafRows, cat);
  const tvaDePlata = computeVatKpi(leafRows, cat);

  const totalVenituri = computeTotalRevenue(leafRows, cat);
  const totalCheltuieli = computeTotalExpenses(leafRows, cat);
  const rezultat = round2(totalVenituri - totalCheltuieli);

  const marjaOperationala =
    totalVenituri > 0 ? round2((rezultat / totalVenituri) * 100) : null;

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

// ---------- D8: Cash KPI ----------
// cashBank = sum of finD on accounts with cashRole="cash_direct" or "cash_advance".
// Transit accounts (581, 5125) are EXCLUDED entirely (see D8 rationale).

function computeCashKpi(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): number {
  let total = 0;
  for (const row of rows) {
    const meta = lookupByBase(row.contBase, catalog);
    if (!meta) continue;
    if (meta.cashRole !== "cash_direct" && meta.cashRole !== "cash_advance") continue;
    total += row.finD - row.finC;
  }
  return total;
}

// ---------- D8: Receivables KPI ----------
// creante = (ar_primary + ar_doubtful + ar_pending) finD − customer_advance finC

function computeReceivablesKpi(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): number {
  let positive = 0;
  let advances = 0;
  for (const row of rows) {
    const meta = lookupByBase(row.contBase, catalog);
    if (!meta?.arRole) continue;

    if (meta.arRole === "customer_advance") {
      advances += row.finC;
    } else {
      positive += row.finD;
    }
  }
  return positive - advances;
}

// ---------- D8: Payables KPI ----------
// datorii = (ap_primary + ap_pending) finC − supplier_advance finD

function computePayablesKpi(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): number {
  let positive = 0;
  let advances = 0;
  for (const row of rows) {
    const meta = lookupByBase(row.contBase, catalog);
    if (!meta?.apRole) continue;

    if (meta.apRole === "supplier_advance") {
      advances += row.finD;
    } else {
      positive += row.finC;
    }
  }
  return positive - advances;
}

// ---------- D9: VAT KPI ----------
// Per accountant's most recent answer ("4 KPI-uri — conturi incluse"):
//   tvaDePlata = sold 4423 − sold 4424
// where positive = owed to state, negative = to recover.
//
// Behavior depends on whether the period has been closed (lunar regularization):
//   POST-CLOSE: 4426/4427/4428 are zeroed; 4423 (P) holds the payable;
//               4424 (A) holds the receivable. Formula = 4423.finC − 4424.finD.
//   PRE-CLOSE:  4423/4424 are zero; the components live in 4426 (deductible, A),
//               4427 (collected, P), 4428 (pending, B). Fallback to computed:
//               4427.finC − 4426.finD − 4428(net).
//
// We try the post-close formula first; if it's zero AND there are non-zero
// components, fall back to the computed one. This matches both regimes
// honestly without picking sides.

function computeVatKpi(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): number {
  let payable = 0; // 4423.finC
  let receivable = 0; // 4424.finD
  let collected = 0; // 4427.finC − finD (pre-close net)
  let deductible = 0; // 4426.finD − finC (pre-close net)
  let pending = 0; // 4428.finC − finD (pre-close net)

  for (const row of rows) {
    const meta = lookupByBase(row.contBase, catalog);
    if (!meta?.vatRole) continue;

    switch (meta.vatRole) {
      case "vat_payable":
        // 4423 — TVA de plata (P). Sold creditor = datorie.
        payable += row.finC - row.finD;
        break;
      case "vat_receivable":
        // 4424 — TVA de recuperat (A). Sold debitor = creanta.
        receivable += row.finD - row.finC;
        break;
      case "vat_collected":
        collected += row.finC - row.finD;
        break;
      case "vat_deductible":
        deductible += row.finD - row.finC;
        break;
      case "vat_pending":
        pending += row.finC - row.finD;
        break;
    }
  }

  // Primary formula per Claudia "4": 4423 − 4424
  const postCloseFormula = payable - receivable;

  // If 4423/4424 both zero but components exist, use pre-close formula
  if (postCloseFormula === 0 && (collected !== 0 || deductible !== 0 || pending !== 0)) {
    return round2(collected - deductible - pending);
  }

  return round2(postCloseFormula);
}

// ---------- Revenue / expense totals ----------
// Per D5 + accountant 2.4:
//  - Total venituri = class 7 rulajTC, EXCLUDING isClosing (121 is class 1 anyway)
//    and EXCLUDING isExtraBilantier (D11).
//  - Total cheltuieli = class 6 rulajTD, EXCLUDING isProfitTax (691/694/695/697/698)
//    and isClosing.
//
// IMPORTANT: we use pure rulajTC/rulajTD, NOT net (TC−TD). This is because
// when the monthly close is booked in the journal, class 6 gets credited
// (641 = 121, for example) and class 7 gets debited (121 = 706). Those
// closing debits/credits mirror the revenue/expense exactly, so (TC−TD)
// on class 7 = 0 and (TD−TC) on class 6 = 0 after close.
//
// The correct treatment: sum only the "natural" side. Class 7 revenue
// accounts accumulate credits during the period; class 6 expense accounts
// accumulate debits. The closing entry reverses them back, but that's an
// accounting artifact, not revenue/expense activity.

function computeTotalRevenue(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): number {
  let total = 0;
  for (const row of rows) {
    if (!row.contBase.startsWith("7")) continue;
    const meta = lookupByBase(row.contBase, catalog);
    if (meta?.isClosing || meta?.isExtraBilantier) continue;
    total += row.rulajTC;
  }
  return total;
}

function computeTotalExpenses(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): number {
  let total = 0;
  for (const row of rows) {
    if (!row.contBase.startsWith("6")) continue;
    const meta = lookupByBase(row.contBase, catalog);
    if (meta?.isClosing || meta?.isProfitTax || meta?.isExtraBilantier) continue;
    total += row.rulajTD;
  }
  return total;
}

// ---------- helpers ----------

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
