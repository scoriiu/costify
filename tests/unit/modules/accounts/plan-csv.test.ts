import { describe, it, expect } from "vitest";
import { planRowsToCsv, planCsvFilename } from "@/modules/accounts/plan-csv";
import type { PlanRow } from "@/modules/accounts";

function row(overrides: Partial<PlanRow>): PlanRow {
  return {
    cont: "401.00023",
    contBase: "401",
    name: "Orange Romania",
    nameSource: "partner_extract",
    type: "B",
    classDigit: 4,
    kind: "analytic",
    isInCatalog: true,
    needsReview: false,
    partnerCode: null,
    usage: {
      firstSeen: new Date("2025-01-10"),
      lastSeen: new Date("2025-03-22"),
      entriesCount: 12,
    },
    currentSold: { finD: 0, finC: 1234.56 },
    ...overrides,
  };
}

describe("planRowsToCsv", () => {
  it("produces header row + one row per entry, CRLF separated", () => {
    const csv = planRowsToCsv([row({})]);
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(2);
    expect(lines[0].split(",")[0]).toBe("Cont");
    expect(lines[1].startsWith("401.00023,")).toBe(true);
  });

  it("empty input returns header-only CSV", () => {
    const csv = planRowsToCsv([]);
    expect(csv.split("\r\n").length).toBe(1);
  });

  it("quotes names containing commas", () => {
    const csv = planRowsToCsv([row({ name: "Furnizori, principali" })]);
    expect(csv).toContain('"Furnizori, principali"');
  });

  it("escapes embedded double quotes with doubled quotes", () => {
    const csv = planRowsToCsv([row({ name: 'Furnizor "Orange"' })]);
    expect(csv).toContain('"Furnizor ""Orange"""');
  });

  it("does not quote simple values", () => {
    const csv = planRowsToCsv([row({ name: "Orange Romania" })]);
    const secondLine = csv.split("\r\n")[1];
    expect(secondLine).toContain(",Orange Romania,");
  });

  it("formats dates as DD.MM.YYYY", () => {
    const csv = planRowsToCsv([
      row({
        usage: {
          firstSeen: new Date("2025-01-05"),
          lastSeen: new Date("2025-11-30"),
          entriesCount: 3,
        },
      }),
    ]);
    expect(csv).toContain("05.01.2025");
    expect(csv).toContain("30.11.2025");
  });

  it("formats money with dot decimal", () => {
    const csv = planRowsToCsv([
      row({ currentSold: { finD: 12345.67, finC: 0 } }),
    ]);
    expect(csv).toContain(",12345.67,");
  });

  it("blanks empty money values (no zero noise)", () => {
    const csv = planRowsToCsv([row({ currentSold: null })]);
    const cells = csv.split("\r\n")[1].split(",");
    // Sold D and Sold C columns (indexes 9, 10) should be empty
    expect(cells[9]).toBe("");
    expect(cells[10]).toBe("");
  });

  it("labels source in Romanian", () => {
    expect(planRowsToCsv([row({ nameSource: "client_edit" })])).toContain("Editat manual");
    expect(planRowsToCsv([row({ nameSource: "partner_extract" })])).toContain("Extras din explicatie");
    expect(planRowsToCsv([row({ nameSource: "omfp_catalog" })])).toContain("OMFP 1802");
    expect(planRowsToCsv([row({ nameSource: "fallback" })])).toContain("Nemapat");
  });

  it("renders boolean flags as Da/Nu", () => {
    const csv = planRowsToCsv([row({ isInCatalog: true, needsReview: false })]);
    const cells = csv.split("\r\n")[1].split(",");
    expect(cells[5]).toBe("Da"); // In catalog OMFP
    expect(cells[6]).toBe("Nu"); // De revizuit
  });

  it("handles null classDigit and type gracefully", () => {
    const csv = planRowsToCsv([
      row({ type: null, classDigit: null }),
    ]);
    const cells = csv.split("\r\n")[1].split(",");
    expect(cells[2]).toBe(""); // Tip
    expect(cells[3]).toBe(""); // Clasa
  });
});

describe("planCsvFilename", () => {
  it("no-period form", () => {
    expect(planCsvFilename("qhm21-network-srl")).toBe(
      "plan-conturi_qhm21-network-srl.csv"
    );
  });

  it("with period, pads single-digit month", () => {
    expect(
      planCsvFilename("4walls-studio-srl", { year: 2025, month: 3 })
    ).toBe("plan-conturi_4walls-studio-srl_2025-03.csv");
  });
});
