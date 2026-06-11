export type {
  IndustryId,
  IndustryResolution,
  IndustryOption,
  IndustryKpi,
  IndustryKpiGroup,
  IndustryKpiSection,
  JournalIndustryHint,
  KpiBaseInputs,
  KpiInputValue,
  KpiThreshold,
  KpiState,
  KpiFormat,
  KpiGroupId,
} from "./types";
export {
  detectIndustryFromJournal,
  isJournalMismatch,
  journalActivityLabel,
  type JournalIndustrySignal,
  type JournalActivity,
} from "./detect-journal";
export { INDUSTRY_OPTIONS, industryFromCaen, industryLabel } from "./caen-map";
export { resolveIndustry, isIndustryId } from "./detect";
export { computeIndustryKpis, kpiState } from "./compute";
export { extractKpiBaseInputs, INPUT_SOURCES } from "./inputs";
export { KPI_REGISTRY, KPI_BY_ID, fmtNum } from "./registry";
export { INDUSTRY_PROFILES, GROUP_INFO } from "./profiles";
