export {
  getCatalogAccount,
  getCatalogByBase,
  getCatalogMap,
  getClientAccounts,
  resolveAccountName,
  resolveFromMaps,
  upsertClientAccount,
  bulkUpsertFromImport,
} from "./service";

export { decideImportUpsert, filterImportableNames } from "./import-upsert";
export type { ImportUpsertDecision } from "./import-upsert";

export { loadCatalog, invalidateCatalog } from "./catalog-cache";
export { loadCatalogSync, resetSyncCache } from "./catalog-sync";

export type {
  AccountType,
  CppGroup,
  AccountSpecial,
  AccountSource,
  CatalogAccount,
  ClientAccountRecord,
  ResolvedAccountName,
  OmfpSeedFile,
  OmfpSeedAccount,
} from "./types";
