import { describe, it, expect, beforeAll } from "vitest";
import * as XLSX from "xlsx";
import type { OwnerSnapshot } from "@/modules/reporting/owner";
import {
  buildOwnerExportWorkbook,
  ownerExportFileName,
} from "@/modules/reporting/owner/export";

function snap(overrides: Partial<OwnerSnapshot> = {}): OwnerSnapshot {
  return {
    meta: {
      clientId: "c1",
      name: "Brutăria Țăndărei SRL",
      cui: "RO123",
      slug: "brutaria",
      year: 2026,
      month: 4,
      periodLabel: "Aprilie 2026",
    },
    summary: {
      cifraAfaceriTotal: 400_000,
      cifraAfaceriLuna: 100_000,
      cheltuieliTotal: 240_000,
      cheltuieliLuna: 60_000,
      venituriLuna: 100_000,
      soldRegistruCasa: 5_000,
      soldConturiBancare: 50_000,
      creditareSocietate: 0,
      clientiNeincasati: 30_000,
      furnizoriNeachitati: 12_000,
    },
    cashPosition: {
      disponibil: [],
      obligatii: [],
      totalDisponibil: 55_000,
      totalObligatii: 20_000,
      net: 35_000,
    },
    trends: [
      {
        year: 2026,
        month: 3,
        monthLabel: "Mar",
        revenue: 90_000,
        expenses: 70_000,
        profit: 20_000,
        cashEnd: 40_000,
        receivables: 25_000,
        payables: 10_000,
      },
      {
        year: 2026,
        month: 4,
        monthLabel: "Apr",
        revenue: 100_000,
        expenses: 60_000,
        profit: 40_000,
        cashEnd: 55_000,
        receivables: 30_000,
        payables: 12_000,
      },
    ],
    outstanding: {
      clienti: [{ cont: "411.1", partnerName: "Client Alfa", sold: 30_000 }],
      furnizori: [{ cont: "401.1", partnerName: "Furnizor Beta", sold: 12_000 }],
    },
    expenseBreakdown: [
      { code: "64", label: "Salarii si contributii", value: 40_000, percent: 66.7, depth: 0 },
      { code: "64.1", label: "Salarii nete", value: 25_000, percent: 41.7, depth: 1 },
    ],
    revenueBreakdown: [
      { code: "70", label: "Vanzari", value: 100_000, percent: 100, depth: 0 },
    ],
    obligations: [
      {
        id: "tva",
        label: "TVA de plata",
        dueDate: "2026-05-25",
        amount: 8_000,
        hint: "",
        kind: "tax",
        daysUntilDue: 10,
      },
    ],
    ratios: [
      {
        id: "currentRatio",
        label: "Lichiditate curenta",
        formula: "Active curente / Datorii curente",
        group: "lichiditate",
        value: 1.52,
        format: "ratio",
        target: "> 1.5",
        state: "good",
        interpretation: "",
        calculation: "120.000 / 79.000 = 1,52",
      },
    ],
    ...overrides,
  } as OwnerSnapshot;
}

const KPI_SECTION = {
  industry: "general",
  industryLabel: "General",
  industrySource: "default",
  caen: null,
  year: 2026,
  month: 4,
  journalHint: null,
  groups: [
    {
      id: "profitabilitate",
      label: "Profitabilitate",
      descriptionContabil: "",
      descriptionAntreprenor: "",
      kpis: [
        {
          id: "marjaNeta",
          group: "profitabilitate",
          labelContabil: "Marja neta %",
          labelAntreprenor: "Cat ramane din venituri",
          formulaContabil: "Rezultat net / Venituri totale × 100",
          formulaAntreprenor: "Profitul impartit la venituri",
          inputs: [
            {
              id: "profitNet",
              label: "Profit net",
              source: "Rulaj creditor 7xx minus rulaj debitor 6xx, cumulat",
              value: 40_000,
            },
          ],
          calculation: "40.000 / 100.000 × 100 = 40,0%",
          value: 40,
          format: "percent",
          thresholds: { label: "> 10%" },
          state: "good",
          interpretationContabil: "",
          interpretationAntreprenor: "",
          unavailableReason: null,
        },
      ],
    },
  ],
} as unknown as NonNullable<OwnerSnapshot["industryKpis"]>;

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true }) as unknown[][];
}

/** Find the cell object in column B of the row whose column A equals label. */
function cellBForLabel(ws: XLSX.WorkSheet, label: string): XLSX.CellObject | undefined {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const a = ws[XLSX.utils.encode_cell({ r, c: 0 })] as XLSX.CellObject | undefined;
    if (a && String(a.v) === label) {
      return ws[XLSX.utils.encode_cell({ r, c: 1 })] as XLSX.CellObject | undefined;
    }
  }
  return undefined;
}

describe("buildOwnerExportWorkbook", () => {
  let buffer: Buffer;
  let wb: XLSX.WorkBook;

  beforeAll(async () => {
    buffer = await buildOwnerExportWorkbook(snap(), {
      publishedAt: new Date("2026-05-09T10:00:00Z"),
    });
    wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  });

  it("produces owner sheets plus Verificare; no Indicatori without industryKpis", () => {
    expect(wb.SheetNames).toEqual([
      "Sumar",
      "Luna de luna",
      "Cheltuieli",
      "Venituri",
      "De incasat",
      "De platit",
      "Verificare",
    ]);
  });

  it("Sumar derives Castig and totals through real Excel formulas", () => {
    const ws = wb.Sheets["Sumar"];
    const castig = cellBForLabel(ws, "Castig sau pierdere luna asta");
    expect(castig?.f).toMatch(/^B\d+-B\d+$/);
    const total = cellBForLabel(ws, "Bani in casa si banca (total)");
    expect(total?.f).toMatch(/^B\d+\+B\d+$/);
    const ramas = cellBForLabel(ws, "Ce ramane dupa obligatii");
    expect(ramas?.f).toMatch(/^B\d+-B\d+$/);
  });

  it("Sumar carries static values and provenance with publish date", () => {
    const rows = sheetRows(wb, "Sumar");
    const flat = rows.map((r) => r.join("|")).join("\n");
    expect(flat).toContain("Cum sta Brutăria Țăndărei SRL");
    expect(flat).toContain("Venituri luna asta|100000");
    expect(flat).toContain("publicate de contabil pe 9 mai 2026");
  });

  it("Luna de luna computes castig and marja as formulas per row plus a SUM total", () => {
    const ws = wb.Sheets["Luna de luna"];
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    let foundFormulaRow = false;
    let foundSum = false;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const d = ws[XLSX.utils.encode_cell({ r, c: 3 })] as XLSX.CellObject | undefined;
      const e = ws[XLSX.utils.encode_cell({ r, c: 4 })] as XLSX.CellObject | undefined;
      if (d?.f && /^B\d+-C\d+$/.test(d.f) && e?.f?.includes("/B")) foundFormulaRow = true;
      const b = ws[XLSX.utils.encode_cell({ r, c: 1 })] as XLSX.CellObject | undefined;
      if (b?.f?.startsWith("SUM(")) foundSum = true;
    }
    expect(foundFormulaRow).toBe(true);
    expect(foundSum).toBe(true);
  });

  it("breakdown percent is a formula against the Total row", () => {
    const ws = wb.Sheets["Cheltuieli"];
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    let found = false;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const c = ws[XLSX.utils.encode_cell({ r, c: 2 })] as XLSX.CellObject | undefined;
      if (c?.f?.includes("$B$")) found = true;
    }
    expect(found).toBe(true);
    const rows = sheetRows(wb, "Cheltuieli");
    const labels = rows.map((r) => String(r[0] ?? ""));
    expect(labels).toContain("Salarii si contributii");
    expect(labels).toContain("    Salarii nete");
  });

  it("De platit includes furnizori, a SUM total and the obligations block", () => {
    const rows = sheetRows(wb, "De platit");
    const flat = rows.map((r) => r.join("|")).join("\n");
    expect(flat).toContain("Furnizor Beta|12000");
    expect(flat).toContain("TVA de plata|2026-05-25|8000");
    const ws = wb.Sheets["De platit"];
    const totalCell = cellBForLabel(ws, "Total");
    expect(totalCell?.f).toMatch(/^SUM\(/);
  });

  it("Verificare lists ratios with formula and substituted calculation", () => {
    const rows = sheetRows(wb, "Verificare");
    const flat = rows.map((r) => r.join("|")).join("\n");
    expect(flat).toContain("Verificare pentru contabil");
    expect(flat).toContain(
      "lichiditate|Lichiditate curenta|Active curente / Datorii curente|120.000 / 79.000 = 1,52|1,52|> 1.5|Bine"
    );
  });

  it("with industry KPIs: adds Indicatori sheet and full trace on Verificare", async () => {
    const buf = await buildOwnerExportWorkbook(snap({ industryKpis: KPI_SECTION }), {
      publishedAt: null,
    });
    const wb2 = XLSX.read(buf, { type: "buffer" });
    expect(wb2.SheetNames).toContain("Indicatori");

    const ind = sheetRows(wb2, "Indicatori").map((r) => r.join("|")).join("\n");
    expect(ind).toContain(
      "Profitabilitate|Cat ramane din venituri|40%|Bine|Profitul impartit la venituri|40.000 / 100.000 × 100 = 40,0%"
    );

    const ver = sheetRows(wb2, "Verificare").map((r) => r.join("|")).join("\n");
    expect(ver).toContain("Marja neta %");
    expect(ver).toContain("Rezultat net / Venituri totale × 100");
    expect(ver).toContain("Profit net = 40.000 · Rulaj creditor 7xx minus rulaj debitor 6xx, cumulat");
    expect(ver).toContain("40.000 / 100.000 × 100 = 40,0%");
  });

  it("never emits an em dash in any cell", () => {
    for (const name of wb.SheetNames) {
      const rows = sheetRows(wb, name);
      for (const row of rows) {
        expect(row.join(" ").includes("\u2014")).toBe(false);
      }
    }
  });
});

describe("ownerExportFileName", () => {
  it("strips diacritics and spaces", () => {
    expect(ownerExportFileName(snap())).toBe("Brutaria-Tandarei-SRL-Aprilie-2026.xlsx");
  });
});
