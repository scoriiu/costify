/**
 * Line-trends compute benchmark (ADR-0004 PR-1, "profile first, cache last").
 *
 * Measures the NEW work loadLineTrends adds on top of the single journal read:
 * deriving 12 monthly balances and running the cost (expense + revenue) and
 * business series engines over a real client's journal. The DB read itself
 * (prepareBalanceContext) is the same raw-SQL read the owner snapshot already
 * characterizes, so it's excluded here on purpose.
 *
 * Skipped by default (it's a measurement, not an assertion). Run explicitly:
 *   BENCH=1 pnpm vitest run tests/unit/modules/reporting/line-trends-bench.test.ts
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
  computeCostLineSeries,
  computeBusinessLineSeries,
} from "@/modules/reporting/owner/line-series";

const RUN = process.env.BENCH === "1";

interface Case {
  file: string;
  year: number;
  endMonth: number;
}

const CASES: Case[] = [
  { file: "qhm-registru-jurnal.xlsx", year: 2025, endMonth: 12 },
  { file: "upperhouse-registru-jurnal.xlsx", year: 2025, endMonth: 12 },
];

let catalog: Map<string, CatalogAccount>;

function buildContext(file: string): { ctx: BalanceContext; count: number } {
  const parsed = loadJournal(file);
  const accountNames = new Map<string, string>();
  for (const e of parsed.entries) {
    if (!accountNames.has(e.contD)) accountNames.set(e.contD, getAccountName(e.contDBase));
    if (!accountNames.has(e.contC)) accountNames.set(e.contC, getAccountName(e.contCBase));
  }
  return {
    ctx: {
      entries: parsed.entries as unknown as SlimEntry[],
      accountNames,
      unmappedBases: new Set<string>(),
    },
    count: parsed.entries.length,
  };
}

describe.skipIf(!RUN)("line-trends compute benchmark", () => {
  beforeAll(async () => {
    catalog = await getCatalogMap();
  }, 60_000);

  for (const c of CASES) {
    it(`${c.file}`, () => {
      const { ctx, count } = buildContext(c.file);
      const resolver = buildResolverState([], []);
      const defaultId = "v-toata-firma";
      const verticals = [{ id: defaultId, name: "Toata firma", isDefault: true }];
      const vResolver = buildVerticalResolver([], defaultId, [], null);

      const rowsCache = new Map<string, BalanceRowView[]>();
      const rowsFor = (year: number, month: number) => {
        const key = `${year}-${month}`;
        let rows = rowsCache.get(key);
        if (!rows) {
          rows = computeBalanceFromContext(ctx, year, month);
          rowsCache.set(key, rows);
        }
        return rows;
      };

      const t0 = performance.now();
      const expense = computeCostLineSeries({
        endYear: c.year, endMonth: c.endMonth, windowMonths: 12,
        catalog, kind: "expense", rowsFor, resolverFor: () => resolver,
      });
      const revenue = computeCostLineSeries({
        endYear: c.year, endMonth: c.endMonth, windowMonths: 12,
        catalog, kind: "revenue", rowsFor, resolverFor: () => resolver,
      });
      const business = computeBusinessLineSeries({
        endYear: c.year, endMonth: c.endMonth, windowMonths: 12,
        metric: "profit", catalog, verticals, rowsFor,
        resolverFor: () => vResolver, categoryResolverFor: () => resolver,
      });
      const elapsed = performance.now() - t0;

      // eslint-disable-next-line no-console
      console.log(
        `[bench] ${c.file}: entries=${count} window=12mo ` +
          `cost(${expense.lines.length}+${revenue.lines.length}) ` +
          `business(${business.lines.length}) in ${elapsed.toFixed(1)}ms`
      );

      expect(elapsed).toBeLessThan(5000);
    }, 120_000);
  }
});
