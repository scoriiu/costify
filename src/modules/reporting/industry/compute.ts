import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";
import type {
  IndustryId,
  IndustryKpi,
  IndustryKpiGroup,
  IndustryKpiSection,
  IndustryResolution,
  KpiBaseInputs,
  KpiGroupId,
  KpiState,
  KpiThreshold,
  JournalIndustryHint,
} from "./types";
import { extractKpiBaseInputs, INPUT_SOURCES } from "./inputs";
import { KPI_REGISTRY, type KpiDefinition } from "./registry";
import { GROUP_INFO, INDUSTRY_PROFILES } from "./profiles";
import { industryLabel } from "./caen-map";
import {
  detectIndustryFromJournal,
  isJournalMismatch,
  journalActivityLabel,
} from "./detect-journal";

const ESSENTIAL_GROUPS: KpiGroupId[] = [
  "profitabilitate",
  "lichiditate",
  "eficienta",
  "indatorare",
  "crestere",
];

/**
 * Traffic-light state per the scorecard convention from KPI_Formule_CFO.xlsx:
 * past the target = good, past the alarm = danger, in between = warn.
 */
export function kpiState(value: number | null, t: KpiThreshold | null): KpiState {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (!t) return "neutral";
  if (t.direction === "higher") {
    if (value >= t.target) return "good";
    if (value <= t.alarm) return "danger";
    return "warn";
  }
  if (value <= t.target) return "good";
  if (value >= t.alarm) return "danger";
  return "warn";
}

function materializeKpi(
  def: KpiDefinition,
  inputs: KpiBaseInputs,
  thresholdOverride: KpiThreshold | undefined
): IndustryKpi {
  const thresholds = thresholdOverride ?? def.thresholds;
  const { value, calculation } = def.compute(inputs);

  const inputValues = def.inputIds.map((id) => {
    const meta = INPUT_SOURCES[id];
    const raw = inputs[id];
    return {
      id,
      label: meta.label,
      source: meta.source,
      value: typeof raw === "number" ? raw : 0,
    };
  });

  const unavailableReason =
    def.unavailableReason ??
    (value === null
      ? "Nu se poate calcula pe aceasta perioada (numitor zero sau date lipsa)."
      : null);

  return {
    id: def.id,
    group: def.group,
    labelContabil: def.labelContabil,
    labelAntreprenor: def.labelAntreprenor,
    formulaContabil: def.formulaContabil,
    formulaAntreprenor: def.formulaAntreprenor,
    inputs: value === null ? [] : inputValues,
    calculation,
    value,
    format: def.format,
    thresholds,
    state: kpiState(value, thresholds),
    interpretationContabil: def.interpretationContabil,
    interpretationAntreprenor: def.interpretationAntreprenor,
    unavailableReason: value === null ? unavailableReason : null,
  };
}

export interface ComputeIndustryKpisOptions {
  industry: IndustryId;
  industrySource: IndustryResolution;
  caen: string | null;
  year: number;
  month: number;
  /** Rows of the SAME period in the previous year, for YoY growth. */
  prevYearRows?: BalanceRowView[];
  /** Average employee count for this month (accountant-entered auxiliary
   *  input). Null/undefined when not set; headcount KPIs then stay "in curand". */
  numberOfEmployees?: number | null;
}

interface EffectiveIndustry {
  industry: IndustryId;
  source: IndustryResolution;
  hint: JournalIndustryHint | null;
}

/**
 * Journal fallback + validator:
 *  - source "default" (no CAEN, no manual) and the journal recognizes an
 *    activity with a matching profile -> the journal decides ("journal").
 *  - otherwise, when the journal contradicts the configured industry, we
 *    keep the configuration but attach a mismatch hint. Never override.
 */
function applyJournalSignal(
  rows: BalanceRowView[],
  industry: IndustryId,
  source: IndustryResolution
): EffectiveIndustry {
  const signal = detectIndustryFromJournal(rows);
  if (!signal) return { industry, source, hint: null };

  if (source === "default" && signal.industry) {
    return {
      industry: signal.industry,
      source: "journal",
      hint: {
        kind: "fallback",
        activity: journalActivityLabel(signal.activity),
        message: `Industria a fost dedusa din registru jurnal: ${signal.evidence} Seteaza CAEN sau alege manual industria din Setari pentru un profil exact.`,
      },
    };
  }

  if (isJournalMismatch(industry, signal)) {
    return {
      industry,
      source,
      hint: {
        kind: "mismatch",
        activity: journalActivityLabel(signal.activity),
        message: `Jurnalul arata ${journalActivityLabel(signal.activity)}: ${signal.evidence} Verifica industria setata (${industryLabel(industry)}) din Setari.`,
      },
    };
  }

  return { industry, source, hint: null };
}

/**
 * Pure assembly of the full KPI section: essentials (always, with
 * industry-adjusted thresholds) + the industry-specific group.
 */
export function computeIndustryKpis(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  opts: ComputeIndustryKpisOptions
): IndustryKpiSection {
  const effective = applyJournalSignal(rows, opts.industry, opts.industrySource);
  const profile = INDUSTRY_PROFILES[effective.industry] ?? INDUSTRY_PROFILES.general;
  const inputs = extractKpiBaseInputs(
    rows,
    catalog,
    opts.month,
    opts.prevYearRows,
    opts.numberOfEmployees ?? null
  );

  const groups: IndustryKpiGroup[] = [];

  for (const groupId of ESSENTIAL_GROUPS) {
    const defs = KPI_REGISTRY.filter((d) => d.group === groupId);
    const info = GROUP_INFO[groupId];
    groups.push({
      id: groupId,
      label: info.label,
      descriptionContabil: info.contabil,
      descriptionAntreprenor: info.antreprenor,
      kpis: defs.map((d) =>
        materializeKpi(d, inputs, profile.thresholdOverrides[d.id])
      ),
    });
  }

  const industryDefs = profile.industryKpiIds
    .map((id) => KPI_REGISTRY.find((d) => d.id === id))
    .filter((d): d is KpiDefinition => d !== undefined);
  groups.push({
    id: "industrie",
    label: GROUP_INFO.industrie.label,
    descriptionContabil: profile.industryGroupContabil,
    descriptionAntreprenor: profile.industryGroupAntreprenor,
    kpis: industryDefs.map((d) =>
      materializeKpi(d, inputs, profile.thresholdOverrides[d.id])
    ),
  });

  return {
    industry: effective.industry,
    industryLabel: industryLabel(effective.industry),
    industrySource: effective.source,
    caen: opts.caen,
    year: opts.year,
    month: opts.month,
    journalHint: effective.hint,
    groups,
  };
}
