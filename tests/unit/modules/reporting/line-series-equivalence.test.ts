/**
 * Engine-equivalence golden master (ADR-0004 testing strategy, Layer 2).
 *
 * Proves the per-month line-series adapters faithfully reproduce the SAME
 * numbers the production breakdown functions return, month by month, over a
 * real client's journal (QHM21, ~17k entries from the baked snapshot).
 *
 * Because the adapter calls the very same `computeExpenseBreakdownFromCategories`
 * / `computeVerticalBreakdown`, equivalence is true by construction for a single
 * month; this suite guards the WIRING (rows-per-month, depth-0 filtering, the
 * pivot) and locks it against future drift across all 12 months.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadJournal } from "@tests/fixtures/reference/helpers";
import { getAccountName } from "@/lib/account-names";
import {
  computeBalanceFromContext,
  type BalanceContext,
  type SlimEntry,
  type BalanceRowView,
} from "@/modules/balances";
import { getCatalogMap, type CatalogAccount } from "@/modules/accounts";
import { buildResolverState } from "@/modules/categories";
import { buildVerticalResolver } from "@/modules/verticals";
import {
  computeExpenseBreakdownFromCategories,
  computeRevenueBreakdownFromCategories,
  computeVerticalBreakdown,
} from "@/modules/reporting/owner/compute";
import {
  computeCostLineSeries,
  computeBusinessLineSeries,
} from "@/modules/reporting/owner/line-series";

const JOURNAL = "qhm-registru-jurnal.xlsx";
const YEAR = 2025;
const END_MONTH = 12;

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

let ctx: BalanceContext;
let catalog: Map<string, CatalogAccount>;
const rowsCache = new Map<string, BalanceRowView[]>();

function rowsFor(year: number, month: number): BalanceRowView[] {
  const key = `${year}-${month}`;
  let rows = rowsCache.get(key);
  if (!rows) {
    rows = computeBalanceFromContext(ctx, year, month);
    rowsCache.set(key, rows);
  }
  return rows;
}

// Empty resolver: every class 6/7 leaf resolves through the OMFP fallback path,
// which still exercises the full breakdown + the adapter's mapping/filtering on
// real data without depending on any DB-stored client mappings.
const resolver = buildResolverState([], []);

beforeAll(async () => {
  const parsed = loadJournal(JOURNAL);
  const accountNames = new Map<string, string>();
  for (const e of parsed.entries) {
    if (!accountNames.has(e.contD)) accountNames.set(e.contD, getAccountName(e.contDBase));
    if (!accountNames.has(e.contC)) accountNames.set(e.contC, getAccountName(e.contCBase));
  }
  ctx = {
    entries: parsed.entries as unknown as SlimEntry[],
    accountNames,
    unmappedBases: new Set<string>(),
  };
  catalog = await getCatalogMap();
}, 60_000);

function refCost(year: number, month: number, kind: "expense" | "revenue"): Map<string, number> {
  const fn =
    kind === "expense"
      ? computeExpenseBreakdownFromCategories
      : computeRevenueBreakdownFromCategories;
  const items = fn(rowsFor(year, month), catalog, resolver, []);
  const map = new Map<string, number>();
  for (const it of items) {
    if ((it.depth ?? 0) === 0) map.set(it.code, r2(it.value));
  }
  return map;
}

describe("cost line series equivalence (QHM21)", () => {
  for (const kind of ["expense", "revenue"] as const) {
    it(`${kind}: each month's series value equals the production breakdown`, () => {
      const series = computeCostLineSeries({
        endYear: YEAR,
        endMonth: END_MONTH,
        windowMonths: 12,
        catalog,
        kind,
        rowsFor,
        resolverFor: () => resolver,
      });

      let nonEmptyMonths = 0;
      series.months.forEach((mm, i) => {
        const ref = refCost(mm.year, mm.month, kind);
        const fromSeries = new Map<string, number>();
        for (const line of series.lines) {
          const v = line.values[i];
          if (Math.abs(v) > 0.001) fromSeries.set(line.id, r2(v));
        }
        if (ref.size > 0) nonEmptyMonths++;
        expect(new Set(fromSeries.keys())).toEqual(new Set(ref.keys()));
        for (const [id, value] of ref) {
          expect(fromSeries.get(id)).toBeCloseTo(value, 2);
        }
      });

      // Guard against a vacuous pass: the fixture must actually have lines.
      expect(nonEmptyMonths).toBeGreaterThan(6);
    }, 60_000);
  }
});

describe("business line series equivalence (QHM21, default vertical)", () => {
  it("expenses metric equals the production vertical breakdown per month", () => {
    const defaultId = "v-toata-firma";
    const verticals = [{ id: defaultId, name: "Toata firma", isDefault: true }];
    const vResolver = buildVerticalResolver([], defaultId, [], null);

    const series = computeBusinessLineSeries({
      endYear: YEAR,
      endMonth: END_MONTH,
      windowMonths: 12,
      metric: "expenses",
      catalog,
      verticals,
      rowsFor,
      resolverFor: () => vResolver,
    });

    series.months.forEach((mm, i) => {
      const ref = computeVerticalBreakdown(rowsFor(mm.year, mm.month), catalog, vResolver, verticals, [], null);
      const refExpenses = r2(ref.find((v) => v.verticalId === defaultId)?.expenses ?? 0);
      const line = series.lines.find((l) => l.id === defaultId);
      const seriesValue = line ? r2(line.values[i]) : 0;
      expect(seriesValue).toBeCloseTo(refExpenses, 2);
    });
  }, 60_000);
});
