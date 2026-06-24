import { describe, it, expect } from "vitest";
import { computeCpp } from "@/modules/reporting/cpp";
import { computeCppF20 } from "@/modules/reporting/cpp-f20";
import type { CppVerticalContext } from "@/modules/reporting/cpp-vertical";
import { buildVerticalResolver } from "@/modules/verticals/resolver";
import type { AllocationView, AllocationSplit } from "@/modules/verticals";
import type { BalanceRowView } from "@/modules/balances";
import { makeBalanceRow } from "../../../fixtures/balance-rows";

const VA = { id: "A", name: "Alpha", isDefault: false };
const VB = { id: "B", name: "Beta", isDefault: false };
const VF = { id: "F", name: "Toata firma", isDefault: true };

function contAlloc(cont: string, splits: AllocationSplit[]): AllocationView {
  return { id: cont, clientId: "c", scope: "contBase", cont, splits };
}

function makeCtx(opts: {
  allocations?: AllocationView[];
  firmDefault?: AllocationSplit[] | null;
}): CppVerticalContext {
  const resolver = buildVerticalResolver(
    opts.allocations ?? [],
    VF.id,
    [],
    opts.firmDefault ?? null
  );
  return { resolver, verticals: [VA, VB, VF], categoryResolver: null };
}

function sumBy(byVertical: Record<string, number> | undefined): number {
  if (!byVertical) return 0;
  return Object.values(byVertical).reduce((s, v) => s + v, 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("computeCpp per business-line breakdown", () => {
  it("does not attach a breakdown when no context is provided", () => {
    const cpp = computeCpp([
      makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeBalanceRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
    ]);
    expect(cpp.verticals).toBeUndefined();
    expect(cpp.lines.every((l) => l.byVertical === undefined)).toBe(true);
  });

  it("exposes the business-line columns when context is provided", () => {
    const cpp = computeCpp(
      [makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 1000 })],
      undefined,
      { vertical: makeCtx({ firmDefault: [{ verticalId: "F", percent: 100 }] }) }
    );
    expect(cpp.verticals).toEqual([VA, VB, VF]);
  });

  it("never leaks: every line's split sums to its own value", () => {
    const rows: BalanceRowView[] = [
      makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeBalanceRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
      makeBalanceRow({ cont: "612", contBase: "612", rulajTD: 5000 }),
      makeBalanceRow({ cont: "766", contBase: "766", rulajTC: 1234 }),
      makeBalanceRow({ cont: "666", contBase: "666", rulajTD: 3210 }),
      makeBalanceRow({ cont: "691", contBase: "691", rulajTD: 9600 }),
    ];
    const ctx = makeCtx({
      allocations: [contAlloc("704", [{ verticalId: "A", percent: 60 }, { verticalId: "B", percent: 40 }])],
      firmDefault: [{ verticalId: "F", percent: 100 }],
    });
    const cpp = computeCpp(rows, undefined, { vertical: ctx });

    for (const line of cpp.lines) {
      if (line.isHeader) {
        expect(line.byVertical).toBeUndefined();
        continue;
      }
      expect(line.byVertical).toBeDefined();
      expect(round2(sumBy(line.byVertical))).toBe(line.value);
    }
  });

  it("splits a revenue account by its cont allocation", () => {
    const ctx = makeCtx({
      allocations: [contAlloc("704", [{ verticalId: "A", percent: 60 }, { verticalId: "B", percent: 40 }])],
      firmDefault: [{ verticalId: "F", percent: 100 }],
    });
    const cpp = computeCpp(
      [makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 100000 })],
      undefined,
      { vertical: ctx }
    );
    const line = cpp.lines.find((l) => l.cont === "704" || l.value === 100000);
    expect(line?.byVertical).toMatchObject({ A: 60000, B: 40000, F: 0 });
  });

  it("routes unallocated accounts to the firm default split", () => {
    const ctx = makeCtx({ firmDefault: [{ verticalId: "F", percent: 100 }] });
    const cpp = computeCpp(
      [makeBalanceRow({ cont: "641", contBase: "641", rulajTD: 60000 })],
      undefined,
      { vertical: ctx }
    );
    const line = cpp.lines.find((l) => l.value === 60000 && !l.isTotal);
    expect(line?.byVertical).toMatchObject({ A: 0, B: 0, F: 60000 });
  });

  it("rezultat net split equals brut minus tax and sums to the net value", () => {
    const rows: BalanceRowView[] = [
      makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeBalanceRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
      makeBalanceRow({ cont: "691", contBase: "691", rulajTD: 9600 }),
    ];
    const ctx = makeCtx({
      allocations: [contAlloc("704", [{ verticalId: "A", percent: 60 }, { verticalId: "B", percent: 40 }])],
      firmDefault: [{ verticalId: "F", percent: 100 }],
    });
    const cpp = computeCpp(rows, undefined, { vertical: ctx });
    const net = cpp.lines.find((l) => l.denumire === "REZULTAT NET");
    expect(net?.value).toBe(30400);
    expect(net?.byVertical).toMatchObject({ A: 60000, B: 40000, F: -69600 });
    expect(round2(sumBy(net?.byVertical))).toBe(30400);
  });

  it("F20 detailed view: every row sums to its value, with columns exposed", () => {
    const rows: BalanceRowView[] = [
      makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeBalanceRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
      makeBalanceRow({ cont: "6022", contBase: "6022", rulajTD: 5000 }),
      makeBalanceRow({ cont: "766", contBase: "766", rulajTC: 1234 }),
      makeBalanceRow({ cont: "666", contBase: "666", rulajTD: 3210 }),
      makeBalanceRow({ cont: "691", contBase: "691", rulajTD: 9600 }),
    ];
    const ctx = makeCtx({
      allocations: [contAlloc("704", [{ verticalId: "A", percent: 60 }, { verticalId: "B", percent: 40 }])],
      firmDefault: [{ verticalId: "F", percent: 100 }],
    });
    const f20 = computeCppF20(rows, undefined, { vertical: ctx });
    expect(f20.verticals).toEqual([VA, VB, VF]);
    let totalsChecked = 0;
    for (const line of f20.lines) {
      if (!line.byVertical) continue;
      expect(round2(sumBy(line.byVertical))).toBe(line.value);
      if (line.kind === "total" && line.value !== 0) totalsChecked++;
    }
    expect(totalsChecked).toBeGreaterThan(0);
  });

  it("F20 has no breakdown when context is absent", () => {
    const f20 = computeCppF20([
      makeBalanceRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
    ]);
    expect(f20.verticals).toBeUndefined();
    expect(f20.lines.every((l) => l.byVertical === undefined)).toBe(true);
  });

  it("reconciles three-way splits on odd amounts with no leak", () => {
    const ctx = makeCtx({
      firmDefault: [
        { verticalId: "A", percent: 33 },
        { verticalId: "B", percent: 33 },
        { verticalId: "F", percent: 34 },
      ],
    });
    const cpp = computeCpp(
      [makeBalanceRow({ cont: "641", contBase: "641", rulajTD: 100000.01 })],
      undefined,
      { vertical: ctx }
    );
    const line = cpp.lines.find((l) => !l.isTotal && !l.isHeader && l.value !== 0);
    expect(round2(sumBy(line?.byVertical))).toBe(line?.value);
  });
});
