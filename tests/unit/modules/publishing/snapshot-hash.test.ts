import { describe, it, expect } from "vitest";
import {
  computeSnapshotHash,
  digestSnapshot,
} from "@/modules/publishing/snapshot-hash";
import type { OwnerSnapshot } from "@/modules/reporting/owner";

function snap(overrides: Partial<OwnerSnapshot> = {}): OwnerSnapshot {
  return {
    meta: {
      clientId: "c1",
      name: "X SRL",
      cui: null,
      slug: "x-srl",
      year: 2026,
      month: 4,
      periodLabel: "Aprilie 2026",
    },
    summary: {
      cifraAfaceriLuna: 100,
      cifraAfaceriYTD: 400,
      cheltuieliLuna: 60,
      cheltuieliYTD: 240,
      soldRegistruCasa: 5,
      soldConturiBancare: 50,
      clientiNeincasati: 30,
      furnizoriNeachitati: 12,
    } as never,
    cashPosition: {} as never,
    ownerWithdrawals: { items: [], total: 7 } as never,
    trends: [],
    insights: [],
    outstanding: {} as never,
    ...overrides,
  } as OwnerSnapshot;
}

describe("computeSnapshotHash", () => {
  it("is deterministic for the same logical snapshot", () => {
    expect(computeSnapshotHash(snap())).toBe(computeSnapshotHash(snap()));
  });

  it("ignores key insertion order", () => {
    const a = snap();
    const reordered = { ...a, summary: a.summary } as OwnerSnapshot;
    expect(computeSnapshotHash(a)).toBe(computeSnapshotHash(reordered));
  });

  it("changes when a value changes", () => {
    const a = snap();
    const b = snap({
      summary: { ...(snap().summary as object), cifraAfaceriLuna: 101 } as never,
    });
    expect(computeSnapshotHash(a)).not.toBe(computeSnapshotHash(b));
  });

  it("produces a 64-char hex string (SHA-256)", () => {
    const h = computeSnapshotHash(snap());
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("digestSnapshot", () => {
  it("extracts the 6 KPI numbers plus the hash", () => {
    const s = snap();
    const d = digestSnapshot(s, "abc");
    expect(d).toEqual({
      cifra: 100,
      profit: 40, // 100 - 60
      cash: 55, // 5 + 50
      receivables: 30,
      payables: 12,
      ownerWithdrawals: 7,
      snapshotHash: "abc",
    });
  });
});
