export type AccountType = "A" | "P" | "B";

export type CppGroup =
  | "VENITURI_EXPLOATARE"
  | "CHELTUIELI_EXPLOATARE"
  | "VENITURI_FINANCIARE"
  | "CHELTUIELI_FINANCIARE";

export type AccountSpecial =
  | "pl_closing"
  | "profit_distribution"
  | "profit_tax"
  | "micro_tax";

export type AccountSource = "saga_import" | "user_edit";

export interface CatalogAccount {
  code: string;
  name: string;
  type: AccountType;
  classDigit: number;
  cppGroup: CppGroup | null;
  cppLabel: string | null;
  special: AccountSpecial | null;
}

export interface ClientAccountRecord {
  code: string;
  customName: string;
  source: AccountSource;
  partnerCode: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface ResolvedAccountName {
  name: string;
  unmapped: boolean;
  source: "client_edit" | "client_import" | "omfp_catalog" | "fallback";
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
}
