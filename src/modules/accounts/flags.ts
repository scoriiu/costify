/**
 * Pure functions that derive behavioral flags from an account code.
 *
 * Source of truth: the accountant's answers in section 1.4 and 2.4 of
 * `docs/ro/intrebari-contabil-plan-conturi.md`, plus our divergences
 * documented in `docs/decisions/0001-plan-de-conturi-refactor.md`.
 *
 * These functions are used:
 *   1. To seed the AccountCatalog columns on a fresh install.
 *   2. As a fallback when the DB row has nullable columns not yet backfilled.
 *   3. As the canonical specification that tests pin against.
 *
 * They operate on the BASE code (no dot suffix). For analytics,
 * call getContBase() first and pass the result.
 */

import type {
  ApRole,
  ArRole,
  CashRole,
  CppGroup,
  PayrollRole,
  VatRole,
  AccountSpecial,
} from "./types";

export interface DerivedFlags {
  isClosing: boolean;
  isProfitTax: boolean;
  isProfitDistribution: boolean;
  isExtraBilantier: boolean;

  cashRole: CashRole | null;
  arRole: ArRole | null;
  apRole: ApRole | null;
  vatRole: VatRole | null;
  payrollRole: PayrollRole | null;

  cppGroup: CppGroup | null;
}

/**
 * Derive all behavioral flags from a base account code.
 * Falls back to the `special` string when code matching is ambiguous.
 */
export function deriveFlags(
  code: string,
  legacySpecial: AccountSpecial | null = null
): DerivedFlags {
  return {
    isClosing: isClosingCode(code) || legacySpecial === "pl_closing",
    isProfitTax:
      isProfitTaxCode(code) ||
      legacySpecial === "profit_tax" ||
      legacySpecial === "micro_tax",
    isProfitDistribution:
      isProfitDistributionCode(code) || legacySpecial === "profit_distribution",
    isExtraBilantier: isExtraBilantierCode(code),

    cashRole: deriveCashRole(code),
    arRole: deriveArRole(code),
    apRole: deriveApRole(code),
    vatRole: deriveVatRole(code),
    payrollRole: derivePayrollRole(code),

    cppGroup: null, // cppGroup comes from seed, not derived
  };
}

// ---------- D5 special flags ----------

export function isClosingCode(code: string): boolean {
  // 121, 1211, 1212 — profit or loss, closing
  return code === "121" || code === "1211" || code === "1212";
}

export function isProfitTaxCode(code: string): boolean {
  // 691 profit tax, 694/695/697/698 variants
  // Per accountant section 1.4: all of these are "separate CPP line, not in cheltuieli exploatare"
  return (
    code === "691" ||
    code === "694" ||
    code === "695" ||
    code === "697" ||
    code === "698"
  );
}

export function isProfitDistributionCode(code: string): boolean {
  return code === "129";
}

export function isExtraBilantierCode(code: string): boolean {
  // D11: class 8 and 9 are memorandum accounts
  if (!code) return false;
  const first = code[0];
  return first === "8" || first === "9";
}

// ---------- D8 cash KPI roles ----------

/**
 * Per D8 (our divergence from accountant 2.4):
 *   - cash_direct: 5121, 5124, 5125 (banca), 5311, 5314 (casa) — included in cash KPI
 *   - cash_advance: 542 (avansuri trezorerie) — included (money with employee)
 *   - transit: 581 (viramente interne), 5125 (sume in curs decontare) — EXCLUDED from KPI
 *
 * Note: 5125 appears in both accountant's list and transit — we classify as transit.
 * The accountant's reasoning ("sold should be 0, warn if not") is exactly the
 * definition of a transit account and supports exclusion.
 */
export function deriveCashRole(code: string): CashRole | null {
  if (code === "5121" || code === "5124") return "cash_direct";
  if (code === "5311" || code === "5314") return "cash_direct";
  if (code === "542") return "cash_advance";
  if (code === "581" || code === "5125") return "transit";
  return null;
}

// ---------- D8 receivables roles ----------

export function deriveArRole(code: string): ArRole | null {
  // Per accountant 2.4: Creante = (4111 + 4118 + 418) finD − 419 finC
  if (code === "4111") return "ar_primary";
  if (code === "4118") return "ar_doubtful";
  if (code === "418") return "ar_pending";
  if (code === "419") return "customer_advance";
  return null;
}

// ---------- D8 payables roles ----------

export function deriveApRole(code: string): ApRole | null {
  // Per accountant 2.4: Datorii = (401 + 404 + 408) finC − 409 finD
  if (code === "401" || code === "404") return "ap_primary";
  if (code === "408") return "ap_pending";
  if (code === "409") return "supplier_advance";
  return null;
}

// ---------- D9 VAT family ----------

export function deriveVatRole(code: string): VatRole | null {
  if (code === "4427") return "vat_collected";
  if (code === "4426") return "vat_deductible";
  if (code === "4423") return "vat_payable";
  if (code === "4424") return "vat_receivable";
  if (code === "4428") return "vat_pending";
  return null;
}

// ---------- Payroll family (future use) ----------

export function derivePayrollRole(code: string): PayrollRole | null {
  // Per accountant 1.4: 421-428 salary family; 4311-4318, 4371, 4372, 4441 social contrib
  const salaryCodes = new Set(["421", "423", "425", "426", "427", "428"]);
  if (salaryCodes.has(code)) return "salary";

  const socialContribCodes = new Set([
    "4311",
    "4312",
    "4313",
    "4314",
    "4315",
    "4316",
    "4317",
    "4318",
    "4371",
    "4372",
    "4441",
  ]);
  if (socialContribCodes.has(code)) return "social_contrib";

  return null;
}
