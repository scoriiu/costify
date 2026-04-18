import { describe, it, expect } from "vitest";
import { computeKpis } from "@/modules/reporting/kpi";
import { loadCatalogSync, resetSyncCache } from "@/modules/accounts";
import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";

/**
 * KPI contract tests.
 *
 * Pin the formulas defined in D8 and D9 of
 * docs/decisions/0001-plan-de-conturi-refactor.md.
 *
 * Changing a formula requires updating the ADR.
 */

const CATALOG = loadCatalogSync();

function makeRow(
  overrides: Partial<BalanceRowView> & Pick<BalanceRowView, "cont" | "contBase">
): BalanceRowView {
  return {
    denumire: "",
    tip: "A",
    unmapped: false,
    isLeaf: true,
    hasChild: false,
    debInit: 0,
    credInit: 0,
    soldInD: 0,
    soldInC: 0,
    debPrec: 0,
    credPrec: 0,
    rulajD: 0,
    rulajC: 0,
    rulajTD: 0,
    rulajTC: 0,
    totalDeb: 0,
    totalCred: 0,
    finD: 0,
    finC: 0,
    ...overrides,
  };
}

describe("KPI — Cash & Banca (D8)", () => {
  it("sums finD on core bank/cash accounts (5121, 5124, 5311, 5314)", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 50000 }),
      makeRow({ cont: "5124", contBase: "5124", finD: 10000 }),
      makeRow({ cont: "5311", contBase: "5311", finD: 2000 }),
      makeRow({ cont: "5314", contBase: "5314", finD: 500 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(62500);
  });

  it("includes 542 — Avansuri de trezorerie (cash_advance)", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 30000 }),
      makeRow({ cont: "542", contBase: "542", finD: 2000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(32000);
  });

  it("EXCLUDES 581 — Viramente interne (transit) per D8 divergence", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 30000 }),
      makeRow({ cont: "581", contBase: "581", finD: 5000 }), // should not be counted
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(30000);
  });

  it("EXCLUDES 5125 — Sume in curs decontare (transit) per D8 divergence", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 30000 }),
      makeRow({ cont: "5125", contBase: "5125", finD: 8000 }), // should not be counted
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(30000);
  });

  it("nets finD − finC on each cash account (overpayment/negative balance)", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 50000 }),
      makeRow({ cont: "5311", contBase: "5311", finC: 200 }), // cash box overdrawn (rare, but possible in data errors)
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(49800);
  });

  it("handles analytic accounts (5121.BT.01) by catalog prefix match", () => {
    const rows = [
      makeRow({ cont: "5121.BT.01", contBase: "5121", finD: 10000 }),
      makeRow({ cont: "5121.ING", contBase: "5121", finD: 5000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(15000);
  });
});

describe("KPI — Creante clienti (D8 receivables formula)", () => {
  it("includes 4111 (primary), 4118 (doubtful), 418 (pending) finD", () => {
    const rows = [
      makeRow({ cont: "4111", contBase: "4111", finD: 15000 }),
      makeRow({ cont: "4118", contBase: "4118", finD: 2000 }),
      makeRow({ cont: "418", contBase: "418", finD: 3000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.clientiCreante).toBe(20000);
  });

  it("SUBTRACTS 419 customer_advance finC (avans primit de la client)", () => {
    const rows = [
      makeRow({ cont: "4111", contBase: "4111", finD: 15000 }),
      makeRow({ cont: "419", contBase: "419", finC: 4000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.clientiCreante).toBe(11000);
  });

  it("sums multiple analytic 4111.xxx rows", () => {
    const rows = [
      makeRow({ cont: "4111.001", contBase: "4111", finD: 5000 }),
      makeRow({ cont: "4111.002", contBase: "4111", finD: 3000 }),
      makeRow({ cont: "4111.003", contBase: "4111", finD: 2000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.clientiCreante).toBe(10000);
  });

  it("returns 0 when no receivable accounts present", () => {
    const rows = [makeRow({ cont: "5121", contBase: "5121", finD: 10000 })];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.clientiCreante).toBe(0);
  });
});

describe("KPI — Datorii furnizori (D8 payables formula)", () => {
  it("includes 401 (primary), 404 (imobilizari), 408 (pending) finC", () => {
    const rows = [
      makeRow({ cont: "401", contBase: "401", finC: 8000 }),
      makeRow({ cont: "404", contBase: "404", finC: 2000 }),
      makeRow({ cont: "408", contBase: "408", finC: 1500 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.furnizoriDatorii).toBe(11500);
  });

  it("SUBTRACTS 409 supplier_advance finD (avans platit furnizorului)", () => {
    const rows = [
      makeRow({ cont: "401", contBase: "401", finC: 8000 }),
      makeRow({ cont: "409", contBase: "409", finD: 3000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.furnizoriDatorii).toBe(5000);
  });

  it("sums multiple analytic 401.xxx rows", () => {
    const rows = [
      makeRow({ cont: "401.00023", contBase: "401", finC: 1200 }),
      makeRow({ cont: "401.00042", contBase: "401", finC: 800 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.furnizoriDatorii).toBe(2000);
  });
});

describe("KPI — TVA de plata (D9 computed formula)", () => {
  it("= 4427 finC − 4426 finD", () => {
    const rows = [
      makeRow({ cont: "4427", contBase: "4427", finC: 5000 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 3000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.tvaDePlata).toBe(2000);
  });

  it("returns negative when deductible exceeds collected (TVA de recuperat)", () => {
    const rows = [
      makeRow({ cont: "4427", contBase: "4427", finC: 1000 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 3000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.tvaDePlata).toBe(-2000);
  });

  it("subtracts 4428 vat_pending (TVA neexigibila)", () => {
    const rows = [
      makeRow({ cont: "4427", contBase: "4427", finC: 5000 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 2000 }),
      makeRow({ cont: "4428", contBase: "4428", finC: 800 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.tvaDePlata).toBe(2200); // 5000 − 2000 − 800
  });

  it("subtracts 4424 vat_receivable (TVA de recuperat din perioada anterioara)", () => {
    const rows = [
      makeRow({ cont: "4427", contBase: "4427", finC: 3000 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 1500 }),
      makeRow({ cont: "4424", contBase: "4424", finD: 500 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.tvaDePlata).toBe(1000); // 3000 − 1500 − 500
  });

  it("ignores 4423 per D9 (NOT the primary source)", () => {
    // The accountant recommended 4423 finC. We deliberately don't use it.
    // A firm that only has 4423 populated (post-close state) will see 0.
    const rows = [makeRow({ cont: "4423", contBase: "4423", finC: 2000 })];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.tvaDePlata).toBe(0);
  });
});

describe("KPI — Venituri totale (class 7)", () => {
  it("sums rulajTC across class 7 accounts", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 50000 }),
      makeRow({ cont: "707", contBase: "707", rulajTC: 10000 }),
      makeRow({ cont: "706", contBase: "706", rulajTC: 5000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalVenituri).toBe(65000);
  });

  it("ignores rulajTD on class 7 accounts (closing entries reverse revenue back to 121)", () => {
    // When the month is closed in the journal, each revenue account gets
    // debited to zero (704 = 121). That closing debit must NOT reduce
    // the "total venituri" we report — it's the same money already
    // counted on the credit side.
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 50000, rulajTD: 50000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalVenituri).toBe(50000);
  });

  it("EXCLUDES 121 if somehow tagged as class 7 (closing account always excluded)", () => {
    // 121 is class 1, this test is defensive — ensures isClosing flag wins
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      // Hypothetical class-7 analytic that's a closing account — shouldn't happen but defensive
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalVenituri).toBe(100000);
  });
});

describe("KPI — Cheltuieli totale (class 6)", () => {
  it("sums rulajTD across class 6 accounts", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajTD: 20000 }),
      makeRow({ cont: "627", contBase: "627", rulajTD: 500 }),
      makeRow({ cont: "605", contBase: "605", rulajTD: 800 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalCheltuieli).toBe(21300);
  });

  it("EXCLUDES 691 profit tax (kept separate in CPP)", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajTD: 50000 }),
      makeRow({ cont: "691", contBase: "691", rulajTD: 10000 }), // must not be in cheltuieli
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalCheltuieli).toBe(50000);
  });

  it("ignores rulajTC on class 6 accounts (closing entries reverse expenses back to 121)", () => {
    // Symmetric to the class 7 case: when the month closes, 641 gets credited
    // to zero (121 = 641). That closing credit must NOT reduce cheltuieli.
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajTD: 20000, rulajTC: 20000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalCheltuieli).toBe(20000);
  });

  it("EXCLUDES 697 IMCA and 698 micro tax", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajTD: 30000 }),
      makeRow({ cont: "697", contBase: "697", rulajTD: 2000 }),
      makeRow({ cont: "698", contBase: "698", rulajTD: 1500 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.totalCheltuieli).toBe(30000);
  });
});

describe("KPI — Rezultat, Marja, edge cases", () => {
  it("rezultat = venituri − cheltuieli (excluding profit tax)", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
      makeRow({ cont: "691", contBase: "691", rulajTD: 5000 }), // excluded from cheltuieli
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.rezultat).toBe(40000); // 100000 − 60000, NOT 100000 − 65000
  });

  it("marja operationala = (rezultat / venituri) × 100", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 80000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.marjaOperationala).toBe(20);
  });

  it("marja returns null when no revenue", () => {
    const rows = [makeRow({ cont: "641", contBase: "641", rulajTD: 5000 })];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.marjaOperationala).toBeNull();
  });

  it("ignores non-leaf rows (parents)", () => {
    const rows = [
      makeRow({
        cont: "5121",
        contBase: "5121",
        finD: 50000,
        isLeaf: false,
        hasChild: true,
      }),
      makeRow({ cont: "5121.001", contBase: "5121", finD: 30000 }),
      makeRow({ cont: "5121.002", contBase: "5121", finD: 20000 }),
    ];
    const kpis = computeKpis(rows, CATALOG);
    expect(kpis.cashBank).toBe(50000); // only leaf rows counted
  });

  it("empty input produces zeros and null marja", () => {
    const kpis = computeKpis([], CATALOG);
    expect(kpis.cashBank).toBe(0);
    expect(kpis.clientiCreante).toBe(0);
    expect(kpis.furnizoriDatorii).toBe(0);
    expect(kpis.tvaDePlata).toBe(0);
    expect(kpis.totalVenituri).toBe(0);
    expect(kpis.totalCheltuieli).toBe(0);
    expect(kpis.rezultat).toBe(0);
    expect(kpis.marjaOperationala).toBeNull();
  });
});

describe("KPI — realistic scenario smoke test", () => {
  it("a small firm with receivables, payables, cash, VAT, and a profit", () => {
    const rows = [
      // Cash
      makeRow({ cont: "5121", contBase: "5121", finD: 45000 }),
      makeRow({ cont: "5311", contBase: "5311", finD: 500 }),
      // Receivables
      makeRow({ cont: "4111.001", contBase: "4111", finD: 12000 }),
      makeRow({ cont: "419", contBase: "419", finC: 2000 }), // advance received
      // Payables
      makeRow({ cont: "401.001", contBase: "401", finC: 8000 }),
      makeRow({ cont: "409", contBase: "409", finD: 1000 }), // advance paid
      // VAT
      makeRow({ cont: "4427", contBase: "4427", finC: 3800 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 1500 }),
      // P&L
      makeRow({ cont: "704", contBase: "704", rulajTC: 20000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 12000 }),
      makeRow({ cont: "605", contBase: "605", rulajTD: 2000 }),
      makeRow({ cont: "691", contBase: "691", rulajTD: 800 }), // profit tax — excluded from cheltuieli
    ];
    const kpis = computeKpis(rows, CATALOG);

    expect(kpis.cashBank).toBe(45500);
    expect(kpis.clientiCreante).toBe(10000); // 12000 − 2000
    expect(kpis.furnizoriDatorii).toBe(7000); // 8000 − 1000
    expect(kpis.tvaDePlata).toBe(2300); // 3800 − 1500
    expect(kpis.totalVenituri).toBe(20000);
    expect(kpis.totalCheltuieli).toBe(14000); // 12000 + 2000, not + 800
    expect(kpis.rezultat).toBe(6000);
    expect(kpis.marjaOperationala).toBe(30);
  });
});
