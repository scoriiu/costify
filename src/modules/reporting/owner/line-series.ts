/**
 * Per-month line series engine (ADR-0004 D5/D11).
 *
 * Pure pivot: given a provider that returns one period's line breakdown, build
 * a rolling window of monthly totals per line, ready for the trend chart and
 * for any "resolve each month with that month's mapping, then aggregate"
 * computation (the corrected YTD of D5).
 *
 * The breakdown provider is INJECTED (`itemsFor`), so this module is I/O-free
 * and the period-scoped resolver of PR-3 plugs in without touching it: only
 * what `itemsFor(year, month)` returns changes (today the current global
 * mapping; later the as-of mapping for that month). That single seam is the
 * whole reason this is a separate pure function.
 */

import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";
import type { ResolverState } from "@/modules/categories";
import type { VerticalResolverState } from "@/modules/verticals";
import type { PartnerCategoryAdjustment } from "@/modules/partner-mappings";
import {
  computeExpenseBreakdownFromCategories,
  computeRevenueBreakdownFromCategories,
  computeVerticalBreakdown,
} from "./compute";

const MONTH_NAMES_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One line's contribution for a single period, as returned by a breakdown
 *  provider. `id` is the stable line key (category code or vertical id). */
export interface LineBreakdownItem {
  id: string;
  label: string;
  value: number;
}

export interface SeriesMonth {
  year: number;
  month: number;
  monthLabel: string;
}

/** One line across the whole window. `values` is aligned 1:1 with the result's
 *  `months` array (oldest first); absent months are 0. */
export interface LineSeries {
  id: string;
  label: string;
  values: number[];
  total: number;
}

export interface LineSeriesResult {
  months: SeriesMonth[];
  lines: LineSeries[];
}

/**
 * The `count` calendar months ending at (endYear, endMonth), oldest first,
 * crossing year boundaries. Mirrors the window logic of `computeMonthlyTrends`.
 */
export function buildWindow(
  endYear: number,
  endMonth: number,
  count: number
): SeriesMonth[] {
  const out: SeriesMonth[] = [];
  let y = endYear;
  let m = endMonth;
  for (let i = 0; i < count; i++) {
    out.unshift({ year: y, month: m, monthLabel: MONTH_NAMES_SHORT[m - 1] });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/**
 * Pivot per-month breakdowns into per-line series over the window.
 *
 * - Values are rounded per month (each is a displayed bar) and `total` is the
 *   sum of those rounded values, so the chart's total always equals the sum of
 *   its visible bars (no drift between bars and label).
 * - Lines are sorted by descending absolute total.
 * - A line's label is taken from the most recent month in which it appears.
 */
export function computeLineSeriesGeneric(
  endYear: number,
  endMonth: number,
  windowMonths: number,
  itemsFor: (year: number, month: number) => LineBreakdownItem[]
): LineSeriesResult {
  const months = buildWindow(endYear, endMonth, windowMonths);

  const monthMaps = months.map((mm) => {
    const map = new Map<string, { label: string; value: number }>();
    for (const item of itemsFor(mm.year, mm.month)) {
      const existing = map.get(item.id);
      if (existing) existing.value += item.value;
      else map.set(item.id, { label: item.label, value: item.value });
    }
    return map;
  });

  // Union of line ids; the most recent month's label wins (months are ordered
  // oldest -> newest, so a later write overwrites an earlier one).
  const labelById = new Map<string, string>();
  for (const map of monthMaps) {
    for (const [id, entry] of map) labelById.set(id, entry.label);
  }

  const lines: LineSeries[] = [];
  for (const [id, label] of labelById) {
    const values = monthMaps.map((map) => round2(map.get(id)?.value ?? 0));
    const total = round2(values.reduce((a, b) => a + b, 0));
    lines.push({ id, label, values, total });
  }

  lines.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  return { months, lines };
}

/* -------------------------------------------------------------------------- */
/*  Production adapters — wrap the existing per-period breakdown functions.    */
/*  These are the only place that knows about balance rows / catalog /         */
/*  resolvers; the pivot above stays axis-agnostic. `resolverFor` is a         */
/*  function of (year, month) so PR-3 swaps a global resolver for an as-of     */
/*  resolver per month without touching anything here.                        */
/* -------------------------------------------------------------------------- */

export interface CostLineSeriesInput {
  endYear: number;
  endMonth: number;
  windowMonths?: number;
  catalog: Map<string, CatalogAccount>;
  kind: "expense" | "revenue";
  rowsFor: (year: number, month: number) => BalanceRowView[];
  resolverFor: (year: number, month: number) => ResolverState;
  adjustmentsFor?: (year: number, month: number) => PartnerCategoryAdjustment[];
}

/**
 * Monthly series for linii de cost (axis A). Emits only root lines (depth 0) so
 * the patron-facing totals are not double-counted with their indented children.
 */
export function computeCostLineSeries(input: CostLineSeriesInput): LineSeriesResult {
  const breakdownFor =
    input.kind === "expense"
      ? computeExpenseBreakdownFromCategories
      : computeRevenueBreakdownFromCategories;

  return computeLineSeriesGeneric(
    input.endYear,
    input.endMonth,
    input.windowMonths ?? 12,
    (year, month) => {
      const items = breakdownFor(
        input.rowsFor(year, month),
        input.catalog,
        input.resolverFor(year, month),
        input.adjustmentsFor?.(year, month) ?? []
      );
      return items
        .filter((it) => (it.depth ?? 0) === 0)
        .map((it) => ({ id: it.code, label: it.label, value: it.value }));
    }
  );
}

export type BusinessLineMetric = "revenue" | "expenses" | "profit";

export interface BusinessLineSeriesInput {
  endYear: number;
  endMonth: number;
  windowMonths?: number;
  metric: BusinessLineMetric;
  catalog: Map<string, CatalogAccount>;
  verticals: Array<{ id: string; name: string; isDefault: boolean }>;
  rowsFor: (year: number, month: number) => BalanceRowView[];
  resolverFor: (year: number, month: number) => VerticalResolverState;
  categoryResolverFor?: (year: number, month: number) => ResolverState | null;
  adjustmentsFor?: (year: number, month: number) => PartnerCategoryAdjustment[];
}

/** Monthly series for linii de business (axis B), for one metric. */
export function computeBusinessLineSeries(input: BusinessLineSeriesInput): LineSeriesResult {
  return computeLineSeriesGeneric(
    input.endYear,
    input.endMonth,
    input.windowMonths ?? 12,
    (year, month) => {
      const items = computeVerticalBreakdown(
        input.rowsFor(year, month),
        input.catalog,
        input.resolverFor(year, month),
        input.verticals,
        input.adjustmentsFor?.(year, month) ?? [],
        input.categoryResolverFor?.(year, month) ?? null
      );
      return items.map((it) => ({
        id: it.verticalId,
        label: it.name,
        value: it[input.metric],
      }));
    }
  );
}
