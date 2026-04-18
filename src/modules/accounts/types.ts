export type AccountType = "A" | "P" | "B";

export type CppGroup =
  | "VENITURI_EXPLOATARE"
  | "CHELTUIELI_EXPLOATARE"
  | "VENITURI_FINANCIARE"
  | "CHELTUIELI_FINANCIARE";

/** @deprecated Use explicit boolean flags on CatalogAccount instead. Kept for backward compat. */
export type AccountSpecial =
  | "pl_closing"
  | "profit_distribution"
  | "profit_tax"
  | "micro_tax";

export type AccountSource = "saga_import" | "user_edit" | "saga_explicatie" | "auto_created";

export type CashRole = "cash_direct" | "cash_advance" | "transit";
export type ArRole = "ar_primary" | "ar_doubtful" | "ar_pending" | "customer_advance";
export type ApRole = "ap_primary" | "ap_pending" | "supplier_advance";
export type VatRole = "vat_collected" | "vat_deductible" | "vat_payable" | "vat_receivable" | "vat_pending";
export type PayrollRole = "salary" | "social_contrib";

export type TaxRegime =
  | "profit_standard"
  | "profit_micro_1"
  | "profit_micro_3"
  | "profit_specific"
  | "imca"
  | "deferred";

export interface CatalogAccount {
  code: string;
  name: string;
  type: AccountType;
  classDigit: number;
  cppGroup: CppGroup | null;
  cppLabel: string | null;
  /** @deprecated Use boolean flags below. */
  special: AccountSpecial | null;

  // D5: explicit behavioral flags
  isClosing: boolean;
  isProfitTax: boolean;
  isProfitDistribution: boolean;
  isExtraBilantier: boolean;
  isIfrsOnly: boolean;

  // D8/D9: KPI membership roles
  cashRole: CashRole | null;
  arRole: ArRole | null;
  apRole: ApRole | null;
  vatRole: VatRole | null;
  payrollRole: PayrollRole | null;
}

export interface ClientAccountRecord {
  code: string;
  customName: string;
  source: AccountSource;
  partnerCode: string | null;
  needsReview: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface ResolvedAccountName {
  name: string;
  unmapped: boolean;
  source:
    | "client_edit"
    | "client_import"
    | "partner_extract"
    | "omfp_catalog"
    | "fallback";
}

export interface OmfpSeedFile {
  version: string;
  source: string;
  description: string;
  accounts: OmfpSeedAccount[];
}

export interface OmfpSeedAccount {
  code: string;
  name: string;
  type: AccountType;
  cppGroup?: CppGroup;
  cppLabel?: string;
  special?: AccountSpecial;

  // New optional fields (backward-compatible with existing seed)
  isClosing?: boolean;
  isProfitTax?: boolean;
  isProfitDistribution?: boolean;
  isExtraBilantier?: boolean;
  isIfrsOnly?: boolean;
  cashRole?: CashRole;
  arRole?: ArRole;
  apRole?: ApRole;
  vatRole?: VatRole;
  payrollRole?: PayrollRole;
}
