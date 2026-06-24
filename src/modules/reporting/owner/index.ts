export type {
  FinancialSummary,
  CashPosition,
  CashPositionItem,
  OwnerWithdrawals,
  OwnerWithdrawalsItem,
  MonthlyTrendPoint,
  Insight,
  OutstandingPartner,
  OwnerSnapshot,
  CategoryBreakdownItem,
  TopMonthlyExpense,
  RunwayProjection,
  SalaryAffordability,
  YearOverYearComparison,
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

export {
  computeFinancialSummary,
  computeCashPosition,
  computeOwnerWithdrawals,
  computeOutstanding,
  computeInsights,
  computeExpenseBreakdown,
  computeRevenueBreakdown,
  computeExpenseBreakdownFromCategories,
  computeRevenueBreakdownFromCategories,
  computeTopMonthlyExpenses,
  computeRunway,
  computeSalaryAffordability,
  computeYoy,
  computeVerticalBreakdown,
  computeCashflowBreakdown,
  computePatrimoniu,
  computeVerdict,
  computeKpiStrip,
  computeHealthScore,
  computeRatios,
  computeObligations,
  computeTopCustomersByActivity,
  computeTopSuppliersByActivity,
} from "./compute";

export { loadOwnerSnapshot } from "./snapshot";
export type { LoadOwnerSnapshotInput } from "./snapshot";

export {
  buildWindow,
  computeLineSeriesGeneric,
  computeCostLineSeries,
  computeBusinessLineSeries,
} from "./line-series";
export type {
  LineSeries,
  LineSeriesResult,
  SeriesMonth,
  LineBreakdownItem,
  BusinessLineMetric,
  CostLineSeriesInput,
  BusinessLineSeriesInput,
} from "./line-series";

export { loadLineTrends } from "./line-trends";
export type { LoadLineTrendsInput, LineTrendsData } from "./line-trends";
export { computeCategoryConfigChanges } from "./config-timeline";
export type {
  CategoryConfigChanges,
  MonthConfigChange,
  ContMembershipChange,
} from "./config-timeline";
export { computePeriodConfigOverview } from "./config-overview";
export type {
  PeriodConfigItem,
  ConfigSegment,
  ConfigGroup,
} from "./config-overview";
export { computeConfigChangelog } from "./config-changelog";
export type { ConfigChange } from "./config-changelog";
