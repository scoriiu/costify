export type {
  CategoryKind,
  MappingScope,
  CostCategoryNode,
  ResolvedCategory,
  AccountMappingRow,
  CategoryBreakdownItem,
} from "./types";

export {
  listCategoryTree,
  listMappings,
  listMappingVersions,
  createCategory,
  renameCategory,
  deleteCategory,
  mapAccount,
  unmapAccount,
  type CreateCategoryInput,
  type MapAccountInput,
} from "./service";

export {
  buildResolverState,
  buildResolverStateAsOf,
  resolveCategoryForCont,
  type ResolverState,
  type CategoryMappingVersion,
} from "./resolver";

export {
  seedOmfpDefaults,
  EXPENSE_SEEDS,
  REVENUE_SEEDS,
  type SeedReport,
} from "./seed";

export {
  loadMapariCashflow,
  computeCoverage,
  aggregateCategoryInflows,
  type MapariCashflowData,
  type AccountListItem,
  type CoverageStats,
  type CategoryInflow,
  type CategoryInflowSource,
} from "./loader";
