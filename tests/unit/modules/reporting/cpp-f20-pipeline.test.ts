/**
 * End-to-end F20 pipeline test, mirroring exactly the call chain the
 * /api/balance route uses in production:
 *
 *   journal XLSX  →  loadJournal()
 *               →  computeBalanceFromJournal()  (returns BalanceRowData)
 *               →  toBalanceRowView (adds unmapped, isExtraBilantier)
 *               →  computeCpp / computeCppF20 (catalog, taxRegime)
 *
 * If F20 detaliat and Simplificat diverge in production, this test must
 * fail — no isolation between compute layers and no fabricated rows.
 *
 * Reproduces the QHM21 Apr 2026 incident: user reported -68 RON brut on
 * F20 vs +399.733,88 on Simplificat. Root cause was info-row routing
 * stealing leaf accounts from their parent total.
 */
import { describe, it, expect } from "vitest";
import { computeBalance } from "@tests/fixtures/reference/helpers";
import { computeCpp, computeCppF20 } from "@/modules/reporting";
import { loadCatalogSync, resetSyncCache } from "@/modules/accounts";
import { isExtraBilantierCode } from "@/modules/accounts/flags";
import { resetF20Cache } from "@/modules/reporting/f20-structure";
import type { BalanceRowView } from "@/modules/balances";

/**
 * Mirror of `toBalanceRowView` from `src/modules/balances/service.ts`.
 * The service file is async (Prisma-bound), so we inline the same
 * transformation here to keep the test pure.
 */
function toView(row: {
  cont: string;
  contBase: string;
  denumire: string;
  tip: string;
  unmapped: boolean;
  isLeaf: boolean;
  hasChild: boolean;
  debInit: number;
  credInit: number;
  soldInD: number;
  soldInC: number;
  debPrec: number;
  credPrec: number;
  rulajD: number;
  rulajC: number;
  rulajTD: number;
  rulajTC: number;
  totalDeb: number;
  totalCred: number;
  finD: number;
  finC: number;
}): BalanceRowView {
  return { ...row, isExtraBilantier: isExtraBilantierCode(row.contBase) };
}

interface PipelineCase {
  label: string;
  journalFile: string;
  year: number;
  month: number;
}

const CASES: PipelineCase[] = [
  { label: "QHM21 Apr 2026", journalFile: "qhm-registru-jurnal.xlsx", year: 2026, month: 4 },
  { label: "QHM21 Dec 2025", journalFile: "qhm-registru-jurnal.xlsx", year: 2025, month: 12 },
  { label: "QHM21 Dec 2024", journalFile: "qhm-registru-jurnal.xlsx", year: 2024, month: 12 },
  { label: "QHM21 Dec 2023", journalFile: "qhm-registru-jurnal.xlsx", year: 2023, month: 12 },
  { label: "4Walls Kronis Dec 2025", journalFile: "4walls-kronis-registru-jurnal.xlsx", year: 2025, month: 12 },
];

for (const c of CASES) {
  describe(`F20 pipeline — ${c.label}`, () => {
    resetF20Cache();
    resetSyncCache();

    const { rows: rawRows } = computeBalance(c.journalFile, c.year, c.month);
    const balance = rawRows.map(toView);
    const catalog = loadCatalogSync();
    const simplified = computeCpp(balance, catalog);
    const f20 = computeCppF20(balance, catalog);

    it("balance is non-empty", () => {
      expect(balance.length).toBeGreaterThan(0);
    });

    it("F20 venituri exploatare matches Simplificat", () => {
      expect(f20.venituriExploatare).toBeCloseTo(simplified.venituriExploatare, 2);
    });

    it("F20 cheltuieli exploatare matches Simplificat", () => {
      expect(f20.cheltuieliExploatare).toBeCloseTo(simplified.cheltuieliExploatare, 2);
    });

    it("F20 rezultat exploatare matches Simplificat", () => {
      expect(f20.rezultatExploatare).toBeCloseTo(simplified.rezultatExploatare, 2);
    });

    it("F20 venituri financiare matches Simplificat", () => {
      expect(f20.venituriFinanciare).toBeCloseTo(simplified.venituriFinanciare, 2);
    });

    it("F20 cheltuieli financiare matches Simplificat", () => {
      expect(f20.cheltuieliFinanciare).toBeCloseTo(simplified.cheltuieliFinanciare, 2);
    });

    it("F20 rezultat financiar matches Simplificat", () => {
      expect(f20.rezultatFinanciar).toBeCloseTo(simplified.rezultatFinanciar, 2);
    });

    it("F20 rezultat brut matches Simplificat", () => {
      expect(f20.rezultatBrut).toBeCloseTo(simplified.rezultatBrut, 2);
    });

    it("F20 rezultat net matches Simplificat", () => {
      expect(f20.rezultatNet).toBeCloseTo(simplified.rezultatNet, 2);
    });
  });
}

// Lock the exact production numbers reported by the user so the QHM Apr 2026
// regression cannot quietly re-appear with a different breaking change.
describe("QHM21 Apr 2026 — production numbers from the reported screenshot", () => {
  resetF20Cache();
  resetSyncCache();

  const { rows: rawRows } = computeBalance("qhm-registru-jurnal.xlsx", 2026, 4);
  const balance = rawRows.map(toView);
  const f20 = computeCppF20(balance, loadCatalogSync());

  it("rezultat exploatare = 419.258,48", () => {
    expect(f20.rezultatExploatare).toBeCloseTo(419_258.48, 2);
  });

  it("rezultat financiar = -19.524,60", () => {
    expect(f20.rezultatFinanciar).toBeCloseTo(-19_524.60, 2);
  });

  it("rezultat brut = 399.733,88", () => {
    expect(f20.rezultatBrut).toBeCloseTo(399_733.88, 2);
  });

  it("rezultat net = 341.370,88 (without tax regime filter)", () => {
    expect(f20.rezultatNet).toBeCloseTo(341_370.88, 2);
  });
});
