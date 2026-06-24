/**
 * Period configuration overview (ADR-0004 "helicopter" view).
 *
 * For every target that can carry a period-scoped rule (a cont's cost-line
 * mapping, a cont split, a category split, the firm default split) this walks
 * the visible window month by month, resolves the EFFECTIVE rule for each month
 * with the same `pickEffective` semantics the report uses, and collapses
 * consecutive equal months into segments.
 *
 * A target is surfaced only when its configuration is NOT constant across the
 * window, i.e. it has two or more segments. This deliberately avoids a
 * "baseline vs special" framing: when a timeline is genuinely split (Jan-Jun
 * one rule, Jul-Dec another) both halves are shown as peers. The user sees the
 * whole evolution, not just an "exception".
 */

import { pickEffective, periodKey } from "@/lib/period";
import {
  buildResolverStateAsOf,
  resolveCategoryForCont,
  type CostCategoryNode,
  type CategoryMappingVersion,
  type ResolverState,
} from "@/modules/categories";
import type {
  AllocationVersion,
  CategoryAllocationVersion,
  FirmDefaultVersion,
  AllocationSplit,
} from "@/modules/verticals";
import type { CatalogAccount } from "@/modules/accounts";

/** Hard cap on how many months the helicopter timeline spans, so a very old
 *  change far in the past never produces a giant row. */
const MAX_SPAN_MONTHS = 36;

interface YearMonth {
  year: number;
  month: number;
}

export type ConfigGroup =
  | "mapping"
  | "cont-split"
  | "category-split"
  | "firm-split";

/** A finer-grained rule (a cont) whose split DEVIATES from the line's headline
 *  split inside a segment window. This is what makes a "50% / 50%" not the whole
 *  truth: part of the money in the line is allocated differently. Carries its own
 *  sub-timeline so month-by-month deviations are visible, not just "an exception". */
export interface SegmentOverride {
  kind: "cont";
  /** The cont whose split deviates (the map key). */
  key: string;
  /** Display label ("cont 707.01 · Venituri marfa"). */
  label: string;
  segments: {
    fromYear: number;
    fromMonth: number;
    toYear: number;
    toMonth: number;
    valueLabel: string;
  }[];
}

export interface ConfigSegment {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  /** Human label of the rule active in this segment ("50% Outsourcing, 50% Recrutare"). */
  valueLabel: string;
  /** True when the segment covers the currently selected period. */
  current: boolean;
  /** Finer rules that carve out part of this line differently in this window.
   *  Present only on category-split items, omitted when the line is uniform. */
  overrides?: SegmentOverride[];
}

export interface PeriodConfigItem {
  id: string;
  group: ConfigGroup;
  /** What the rule is about ("Marfa, materii prime si materiale", "cont 6123"). */
  title: string;
  segments: ConfigSegment[];
}



export interface ConfigOverviewInput {
  /** Latest month that has journal data. The timeline ends here (or at the last
   *  version boundary, whichever is later) so reverts AFTER the viewed month are
   *  visible - a "Doar feb" must show its March revert even while viewing Feb. */
  latestYear: number;
  latestMonth: number;
  /** The month the user is on now, marked "acum" in the UI. */
  selectedYear: number;
  selectedMonth: number;
  /** Minimum span (months) the timeline covers even with no early changes. */
  windowMonths: number;
  tree: CostCategoryNode[];
  verticals: { id: string; name: string }[];
  catalog: Map<string, CatalogAccount>;
  mappingVersions: CategoryMappingVersion[];
  allocVersions: AllocationVersion[];
  catAllocVersions: CategoryAllocationVersion[];
  firmVersions: FirmDefaultVersion[];
  verticalsEnabled: boolean;
}

interface EvalResult {
  key: string;
  label: string;
}

function buildCategoryNames(tree: CostCategoryNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: CostCategoryNode[]) => {
    for (const n of nodes) {
      map.set(n.id, n.name);
      walk(n.children);
    }
  };
  walk(tree);
  return map;
}

function contLabel(cont: string, catalog: Map<string, CatalogAccount>): string {
  const name =
    catalog.get(cont)?.name ?? catalog.get(cont.split(".")[0])?.name ?? null;
  return name ? `cont ${cont} · ${name}` : `cont ${cont}`;
}

function splitsLabel(
  splits: AllocationSplit[],
  verticalName: (id: string) => string
): string {
  if (splits.length === 0) return "Fara impartire proprie";
  return [...splits]
    .sort((a, b) => b.percent - a.percent)
    .map((s) => `${s.percent}% ${verticalName(s.verticalId)}`)
    .join(", ");
}

/** Only worth walking a target when it has at least one dated/bounded version
 *  or more than one version. A single inception version is constant by
 *  definition and never produces a change. */
function hasTimeVariation(
  versions: { effectiveFrom: number; effectiveTo: number | null }[]
): boolean {
  if (versions.length > 1) return true;
  return versions.some((v) => v.effectiveFrom !== 0 || v.effectiveTo !== null);
}

function keyToIndex(key: number): number {
  return Math.floor(key / 100) * 12 + ((key % 100) - 1);
}

function indexToYearMonth(idx: number): YearMonth {
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** All dated boundaries across every version set: where a rule turns on
 *  (effectiveFrom > 0) or a bounded window ends (effectiveTo). Used to anchor
 *  the timeline so every change AND its revert land inside the window. */
function collectBoundaries(input: ConfigOverviewInput): number[] {
  const out: number[] = [];
  const add = (vs: { effectiveFrom: number; effectiveTo: number | null }[]) => {
    for (const v of vs) {
      if (v.effectiveFrom !== 0) out.push(v.effectiveFrom);
      if (v.effectiveTo !== null) out.push(v.effectiveTo);
    }
  };
  add(input.mappingVersions);
  if (input.verticalsEnabled) {
    add(input.allocVersions);
    add(input.catAllocVersions);
    add(input.firmVersions);
  }
  return out;
}

function buildWindowMonths(input: ConfigOverviewInput): YearMonth[] {
  const latestKey = periodKey(input.latestYear, input.latestMonth);
  const selectedKey = periodKey(input.selectedYear, input.selectedMonth);
  const boundaries = collectBoundaries(input);
  // End at the latest data month, the selected month, or a future-dated change,
  // whichever is last - so future rules and post-selection reverts both show.
  const endIdx = Math.max(
    keyToIndex(latestKey),
    keyToIndex(selectedKey),
    ...boundaries.map(keyToIndex)
  );
  // Start a month before the earliest change (to show the "before" state), but
  // never less than the minimum window, and clamp the total span.
  let startIdx = endIdx - (input.windowMonths - 1);
  if (boundaries.length > 0) {
    startIdx = Math.min(startIdx, Math.min(...boundaries.map(keyToIndex)) - 1);
  }
  startIdx = Math.min(startIdx, keyToIndex(selectedKey));
  startIdx = Math.max(startIdx, endIdx - (MAX_SPAN_MONTHS - 1));
  const months: YearMonth[] = [];
  for (let i = startIdx; i <= endIdx; i++) months.push(indexToYearMonth(i));
  return months;
}

function buildSegments(
  months: YearMonth[],
  selectedKey: number,
  evalAt: (key: number) => EvalResult
): ConfigSegment[] {
  const ordered = [...months].sort(
    (a, b) => periodKey(a.year, a.month) - periodKey(b.year, b.month)
  );
  const segments: ConfigSegment[] = [];
  let cur: (ConfigSegment & { key: string }) | null = null;
  for (const m of ordered) {
    const k = periodKey(m.year, m.month);
    const { key, label } = evalAt(k);
    if (cur && cur.key === key) {
      cur.toYear = m.year;
      cur.toMonth = m.month;
      if (k === selectedKey) cur.current = true;
    } else {
      if (cur) segments.push(cur);
      cur = {
        key,
        valueLabel: label,
        fromYear: m.year,
        fromMonth: m.month,
        toYear: m.year,
        toMonth: m.month,
        current: k === selectedKey,
      };
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

export function computePeriodConfigOverview(
  input: ConfigOverviewInput
): PeriodConfigItem[] {
  const months = buildWindowMonths(input);
  if (months.length === 0) return [];
  const selectedKey = periodKey(input.selectedYear, input.selectedMonth);
  const categoryNames = buildCategoryNames(input.tree);
  const verticalNames = new Map(input.verticals.map((v) => [v.id, v.name]));
  const vName = (id: string) => verticalNames.get(id) ?? "Linie stearsa";
  const items: PeriodConfigItem[] = [];

  groupBy(input.mappingVersions, (v) => v.cont).forEach((versions, cont) => {
    if (!hasTimeVariation(versions)) return;
    const segments = buildSegments(months, selectedKey, (k) => {
      const pick = pickEffective(versions, k);
      const id = pick?.categoryId ?? null;
      return {
        key: id ?? "∅",
        label: id ? categoryNames.get(id) ?? "Linie stearsa" : "Fara linie de cost",
      };
    });
    if (segments.length >= 2) {
      items.push({ id: `map:${cont}`, group: "mapping", title: contLabel(cont, input.catalog), segments });
    }
  });

  if (input.verticalsEnabled) {
    groupBy(input.allocVersions, (v) => v.cont).forEach((versions, cont) => {
      if (!hasTimeVariation(versions)) return;
      const segments = buildSegments(months, selectedKey, (k) =>
        splitsEval(pickEffective(versions, k)?.splits, vName)
      );
      if (segments.length >= 2) {
        items.push({ id: `cs:${cont}`, group: "cont-split", title: contLabel(cont, input.catalog), segments });
      }
    });

    const allocByCont = groupBy(input.allocVersions, (v) => v.cont);
    const stateCache = new Map<number, ResolverState>();
    const stateFor = (k: number) => {
      let s = stateCache.get(k);
      if (!s) {
        s = buildResolverStateAsOf(input.tree, input.mappingVersions, k);
        stateCache.set(k, s);
      }
      return s;
    };

    // Every category that has an OWN split is a candidate - it surfaces if its
    // own split changes over time OR a finer cont rule deviates from it in any
    // month (the line is not uniform even if the headline never moves).
    groupBy(input.catAllocVersions, (v) => v.categoryId).forEach((versions, catId) => {
      const exByMonth = months.map((m) =>
        categoryExceptions(catId, periodKey(m.year, m.month), stateFor(periodKey(m.year, m.month)), allocByCont, versions, input.catalog)
      );
      const hasOverride = exByMonth.some((e) => e.size > 0);
      const idxSegs = segmentizeIndexed(months, selectedKey, (k) =>
        splitsEval(pickEffective(versions, k)?.splits, vName)
      );
      if (idxSegs.length < 2 && !hasOverride) return;
      const segments: ConfigSegment[] = idxSegs.map((s) => {
        const overrides = buildSegmentOverrides(months, s.startIdx, s.endIdx, exByMonth, vName);
        return {
          fromYear: months[s.startIdx].year,
          fromMonth: months[s.startIdx].month,
          toYear: months[s.endIdx].year,
          toMonth: months[s.endIdx].month,
          valueLabel: s.valueLabel,
          current: s.current,
          ...(overrides.length > 0 ? { overrides } : {}),
        };
      });
      items.push({
        id: `cat:${catId}`,
        group: "category-split",
        title: categoryNames.get(catId) ?? "Linie de cost stearsa",
        segments,
      });
    });

    if (hasTimeVariation(input.firmVersions)) {
      const segments = buildSegments(months, selectedKey, (k) =>
        splitsEval(pickEffective(input.firmVersions, k)?.splits, vName)
      );
      if (segments.length >= 2) {
        items.push({
          id: "firm",
          group: "firm-split",
          title: "Impartirea implicita a firmei",
          segments,
        });
      }
    }
  }

  return items.sort((a, b) => a.title.localeCompare(b.title, "ro"));
}

function splitFp(splits: AllocationSplit[] | undefined): string {
  const list = splits ?? [];
  const key = [...list]
    .sort((a, b) => a.verticalId.localeCompare(b.verticalId))
    .map((s) => `${s.verticalId}:${s.percent}`)
    .join("|");
  return key || "∅";
}

function splitsEval(
  splits: AllocationSplit[] | undefined,
  vName: (id: string) => string
): EvalResult {
  const list = splits ?? [];
  return { key: splitFp(list), label: splitsLabel(list, vName) };
}

interface IndexedSegment {
  startIdx: number;
  endIdx: number;
  key: string;
  valueLabel: string;
  current: boolean;
}

function segmentizeIndexed(
  months: YearMonth[],
  selectedKey: number,
  evalAt: (key: number) => EvalResult
): IndexedSegment[] {
  const segs: IndexedSegment[] = [];
  let cur: IndexedSegment | null = null;
  months.forEach((m, idx) => {
    const k = periodKey(m.year, m.month);
    const { key, label } = evalAt(k);
    if (cur && cur.key === key) {
      cur.endIdx = idx;
      if (k === selectedKey) cur.current = true;
    } else {
      if (cur) segs.push(cur);
      cur = { startIdx: idx, endIdx: idx, key, valueLabel: label, current: k === selectedKey };
    }
  });
  if (cur) segs.push(cur);
  return segs;
}

interface MonthException {
  label: string;
  splits: AllocationSplit[];
  fp: string;
}

/** Conts that land in `catId` this month but carry their OWN split that differs
 *  from the category's split. Each is a deviation from the headline. A cont whose
 *  own split equals the category split is NOT a deviation and is skipped. */
function categoryExceptions(
  catId: string,
  key: number,
  state: ResolverState,
  allocByCont: Map<string, AllocationVersion[]>,
  catVersions: CategoryAllocationVersion[],
  catalog: Map<string, CatalogAccount>
): Map<string, MonthException> {
  const catFp = splitFp(pickEffective(catVersions, key)?.splits ?? []);
  const out = new Map<string, MonthException>();
  for (const [cont, vs] of allocByCont) {
    const picked = pickEffective(vs, key);
    if (!picked) continue;
    const resolved = resolveCategoryForCont(cont, state);
    if (!resolved || resolved.category.id !== catId) continue;
    const fp = splitFp(picked.splits);
    if (fp === catFp) continue;
    out.set(cont, { label: contLabel(cont, catalog), splits: picked.splits, fp });
  }
  return out;
}

/** Build the per-cont deviation sub-timelines inside one headline segment window
 *  [startIdx..endIdx]. A cont that deviates only in some months produces a sub-
 *  segment only for those months; a gap (month where it matches again) closes the
 *  run so the next deviation starts a fresh sub-segment. */
function buildSegmentOverrides(
  months: YearMonth[],
  startIdx: number,
  endIdx: number,
  exByMonth: Map<string, MonthException>[],
  vName: (id: string) => string
): SegmentOverride[] {
  const keys = new Set<string>();
  for (let i = startIdx; i <= endIdx; i++)
    for (const c of exByMonth[i].keys()) keys.add(c);

  const overrides: SegmentOverride[] = [];
  for (const cont of keys) {
    const segs: SegmentOverride["segments"] = [];
    let run: { startIdx: number; endIdx: number; fp: string; splits: AllocationSplit[] } | null = null;
    let label = "";
    for (let i = startIdx; i <= endIdx; i++) {
      const ex = exByMonth[i].get(cont);
      if (ex) {
        label = ex.label;
        if (run && run.fp === ex.fp) run.endIdx = i;
        else {
          if (run) segs.push(toOverrideSegment(months, run, vName));
          run = { startIdx: i, endIdx: i, fp: ex.fp, splits: ex.splits };
        }
      } else if (run) {
        segs.push(toOverrideSegment(months, run, vName));
        run = null;
      }
    }
    if (run) segs.push(toOverrideSegment(months, run, vName));
    overrides.push({ kind: "cont", key: cont, label, segments: segs });
  }
  overrides.sort((a, b) => a.label.localeCompare(b.label, "ro"));
  return overrides;
}

function toOverrideSegment(
  months: YearMonth[],
  run: { startIdx: number; endIdx: number; splits: AllocationSplit[] },
  vName: (id: string) => string
): SegmentOverride["segments"][number] {
  return {
    fromYear: months[run.startIdx].year,
    fromMonth: months[run.startIdx].month,
    toYear: months[run.endIdx].year,
    toMonth: months[run.endIdx].month,
    valueLabel: splitsLabel(run.splits, vName),
  };
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}
