/**
 * Owner XLSX export — turns a FROZEN published snapshot into a styled,
 * verifiable Excel workbook.
 *
 * Two audiences, one file:
 *   - the OWNER reads the first sheets in entrepreneur language (no conturi,
 *     no OMFP, no debit/credit);
 *   - the ACCOUNTANT verifies everything on the final "Verificare" sheet:
 *     OMFP formula, resolved inputs with their exact balance aggregation
 *     source, and the substituted calculation for every KPI.
 *
 * Derived cells (Castig = Venituri − Cheltuieli, Marja, totals) are REAL
 * Excel formulas, not baked values, so the accountant can click any number
 * and see where it comes from.
 *
 * Built with exceljs (SheetJS community cannot write styles). XLSX over CSV:
 * the snapshot is seven tables, RO-locale Excel mangles comma-separated
 * files, and numbers must stay numbers.
 */

import ExcelJS from "exceljs";
import type { OwnerSnapshot, FinancialRatio } from "./types";
import type { IndustryKpi } from "@/modules/reporting/industry";

/* ----------------------------- design tokens ----------------------------- */

const C = {
  teal: "FF0D6B5E",
  offwhite: "FFE9E8E3",
  cream: "FFF7F6F2",
  border: "FFD9D7D0",
  ink: "FF1A1918",
  inkSoft: "FF44413C",
  muted: "FF7A766E",
  good: "FF1F7A33",
  warn: "FFB45309",
  danger: "FFB91C1C",
} as const;

const FMT_LEI = '#,##0 "lei"';
const FMT_PCT = "0.0%";

const KPI_STATE_LABEL: Record<string, string> = {
  good: "Bine",
  warn: "Atentie",
  danger: "Alerta",
  neutral: "Informativ",
  unknown: "Indisponibil",
};

const STATE_COLOR: Record<string, string> = {
  good: C.good,
  warn: C.warn,
  danger: C.danger,
  neutral: C.inkSoft,
  unknown: C.muted,
};

export interface OwnerExportOptions {
  publishedAt: Date | null;
}

/* ------------------------------ public API ------------------------------- */

export async function buildOwnerExportWorkbook(
  snapshot: OwnerSnapshot,
  opts: OwnerExportOptions
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Costify";
  wb.created = new Date();

  buildSumar(wb.addWorksheet("Sumar"), snapshot, opts);
  buildLunaDeLuna(wb.addWorksheet("Luna de luna"), snapshot);
  buildBreakdown(wb.addWorksheet("Cheltuieli"), "Pe ce s-au dus banii", snapshot.expenseBreakdown);
  buildBreakdown(wb.addWorksheet("Venituri"), "De unde au venit banii", snapshot.revenueBreakdown);
  buildDeIncasat(wb.addWorksheet("De incasat"), snapshot);
  buildDePlatit(wb.addWorksheet("De platit"), snapshot);
  if (snapshot.industryKpis) {
    buildIndicatori(wb.addWorksheet("Indicatori"), snapshot);
  }
  buildVerificare(wb.addWorksheet("Verificare"), snapshot, opts);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function ownerExportFileName(snapshot: OwnerSnapshot): string {
  const name = snapshot.meta.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const period = snapshot.meta.periodLabel.replace(/\s+/g, "-");
  return `${name}-${period}.xlsx`;
}

/* ----------------------------- style helpers ----------------------------- */

function setWidths(ws: ExcelJS.Worksheet, widths: number[]): void {
  ws.columns = widths.map((wch) => ({ width: wch }));
}

function addTitle(ws: ExcelJS.Worksheet, title: string, subtitle: string, span: number): void {
  const t = ws.addRow([title]);
  t.getCell(1).font = { bold: true, size: 14, color: { argb: C.ink } };
  ws.mergeCells(t.number, 1, t.number, span);
  const s = ws.addRow([subtitle]);
  s.getCell(1).font = { size: 10, color: { argb: C.muted } };
  ws.mergeCells(s.number, 1, s.number, span);
  ws.addRow([]);
}

function addHeader(ws: ExcelJS.Worksheet, labels: string[]): ExcelJS.Row {
  const row = ws.addRow(labels);
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true, size: 10, color: { argb: C.offwhite } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.teal } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: C.border } } };
  });
  row.height = 20;
  return row;
}

function styleDataRow(row: ExcelJS.Row, stripe: boolean): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { size: 10, color: { argb: C.inkSoft }, ...cell.font };
    if (stripe) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.cream } };
    }
    cell.border = { bottom: { style: "thin", color: { argb: C.border } } };
    cell.alignment = { vertical: "top", wrapText: true, ...cell.alignment };
  });
}

function leiCell(cell: ExcelJS.Cell): void {
  cell.numFmt = FMT_LEI;
  cell.alignment = { horizontal: "right" };
}

function addProvenance(ws: ExcelJS.Worksheet, opts: OwnerExportOptions, span: number): void {
  const when = opts.publishedAt
    ? opts.publishedAt.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
    : null;
  ws.addRow([]);
  const row = ws.addRow([
    when
      ? `Generat din Costify pe baza datelor publicate de contabil pe ${when}.`
      : "Generat din Costify pe baza datelor publicate de contabil.",
  ]);
  row.getCell(1).font = { italic: true, size: 9, color: { argb: C.muted } };
  ws.mergeCells(row.number, 1, row.number, span);
}

/* -------------------------------- Sumar ---------------------------------- */

function buildSumar(ws: ExcelJS.Worksheet, snapshot: OwnerSnapshot, opts: OwnerExportOptions): void {
  const { summary, cashPosition, meta } = snapshot;
  setWidths(ws, [38, 18, 52]);
  addTitle(ws, `Cum sta ${meta.name}`, `Perioada: ${meta.periodLabel}`, 3);
  addHeader(ws, ["Ce inseamna", "Suma", "Cum se calculeaza"]);

  type Line = {
    label: string;
    value?: number;
    /** Real Excel formula; `result` is the cached value so the file renders
     *  correctly in viewers that never recalculate. */
    formula?: { expr: string; result: number };
    note?: string;
    bold?: boolean;
  };
  const addLine = (line: Line, stripe: boolean): number => {
    const row = ws.addRow([line.label, null, line.note ?? ""]);
    const cell = row.getCell(2);
    if (line.formula) cell.value = { formula: line.formula.expr, result: line.formula.result };
    else if (line.value !== undefined) cell.value = line.value;
    leiCell(cell);
    styleDataRow(row, stripe);
    if (line.bold) {
      row.getCell(1).font = { bold: true, size: 10, color: { argb: C.ink } };
      cell.font = { bold: true, size: 10, color: { argb: C.ink } };
    }
    row.getCell(3).font = { size: 9, color: { argb: C.muted } };
    return row.number;
  };

  const rCasa = addLine({ label: "Bani in casa (numerar)", value: summary.soldRegistruCasa }, false);
  const rBanca = addLine({ label: "Bani in banca", value: summary.soldConturiBancare }, true);
  addLine(
    {
      label: "Bani in casa si banca (total)",
      formula: {
        expr: `B${rCasa}+B${rBanca}`,
        result: summary.soldRegistruCasa + summary.soldConturiBancare,
      },
      note: "Numerarul plus banii din conturile bancare.",
      bold: true,
    },
    false
  );
  ws.addRow([]);
  const rVen = addLine({ label: "Venituri luna asta", value: summary.venituriLuna }, false);
  const rChe = addLine({ label: "Cheltuieli luna asta", value: summary.cheltuieliLuna }, true);
  addLine(
    {
      label: "Castig sau pierdere luna asta",
      formula: {
        expr: `B${rVen}-B${rChe}`,
        result: summary.venituriLuna - summary.cheltuieliLuna,
      },
      note: "Veniturile lunii minus cheltuielile lunii.",
      bold: true,
    },
    false
  );
  ws.addRow([]);
  addLine({ label: "De primit de la clienti", value: summary.clientiNeincasati, note: "Facturi emise si neincasate inca." }, false);
  addLine({ label: "De platit catre furnizori", value: summary.furnizoriNeachitati, note: "Facturi primite si neplatite inca." }, true);
  ws.addRow([]);
  const rVenY = addLine({ label: "Vanzari de la inceputul anului", value: summary.cifraAfaceriTotal }, false);
  const rCheY = addLine({ label: "Cheltuieli de la inceputul anului", value: summary.cheltuieliTotal }, true);
  addLine(
    {
      label: "Castig sau pierdere de la inceputul anului",
      formula: {
        expr: `B${rVenY}-B${rCheY}`,
        result: summary.cifraAfaceriTotal - summary.cheltuieliTotal,
      },
      note: "Vanzarile de la inceputul anului minus cheltuielile.",
      bold: true,
    },
    false
  );
  ws.addRow([]);
  const rDisp = addLine({ label: "Bani disponibili (total)", value: cashPosition.totalDisponibil }, false);
  const rObl = addLine({ label: "Obligatii apropiate (total)", value: cashPosition.totalObligatii }, true);
  addLine(
    {
      label: "Ce ramane dupa obligatii",
      formula: {
        expr: `B${rDisp}-B${rObl}`,
        result: cashPosition.totalDisponibil - cashPosition.totalObligatii,
      },
      note: "Banii disponibili minus obligatiile care urmeaza.",
      bold: true,
    },
    false
  );

  addProvenance(ws, opts, 3);
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

/* ----------------------------- Luna de luna ------------------------------ */

function buildLunaDeLuna(ws: ExcelJS.Worksheet, snapshot: OwnerSnapshot): void {
  setWidths(ws, [16, 14, 14, 16, 10, 14, 16, 16]);
  addTitle(
    ws,
    "Luna de luna",
    "Castigul si marja sunt formule Excel: apasa pe celula ca sa vezi calculul.",
    8
  );
  addHeader(ws, [
    "Luna",
    "Venituri",
    "Cheltuieli",
    "Castig sau pierdere",
    "Marja",
    "Bani la final",
    "De primit de la clienti",
    "De platit catre furnizori",
  ]);

  const first = ws.rowCount + 1;
  snapshot.trends.forEach((t, i) => {
    const row = ws.addRow([`${t.monthLabel} ${t.year}`, t.revenue, t.expenses, null, null, t.cashEnd, t.receivables, t.payables]);
    const n = row.number;
    row.getCell(4).value = { formula: `B${n}-C${n}`, result: t.revenue - t.expenses };
    row.getCell(5).value = {
      formula: `IF(B${n}=0,"",(B${n}-C${n})/B${n})`,
      result: t.revenue !== 0 ? (t.revenue - t.expenses) / t.revenue : "",
    };
    for (const col of [2, 3, 4, 6, 7, 8]) leiCell(row.getCell(col));
    row.getCell(5).numFmt = FMT_PCT;
    row.getCell(5).alignment = { horizontal: "right" };
    styleDataRow(row, i % 2 === 1);
  });
  const last = ws.rowCount;

  if (last >= first) {
    const sumRev = snapshot.trends.reduce((acc, t) => acc + t.revenue, 0);
    const sumExp = snapshot.trends.reduce((acc, t) => acc + t.expenses, 0);
    const total = ws.addRow(["Total", null, null, null, null, null, null, null]);
    const n = total.number;
    total.getCell(2).value = { formula: `SUM(B${first}:B${last})`, result: sumRev };
    total.getCell(3).value = { formula: `SUM(C${first}:C${last})`, result: sumExp };
    total.getCell(4).value = { formula: `B${n}-C${n}`, result: sumRev - sumExp };
    for (const col of [2, 3, 4]) leiCell(total.getCell(col));
    total.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, size: 10, color: { argb: C.ink } };
      cell.border = { top: { style: "thin", color: { argb: C.inkSoft } } };
    });
  }
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

/* ------------------------------- breakdowns ------------------------------ */

function buildBreakdown(
  ws: ExcelJS.Worksheet,
  title: string,
  items: OwnerSnapshot["expenseBreakdown"]
): void {
  setWidths(ws, [46, 16, 12]);
  addTitle(ws, title, "Procentul este formula Excel raportata la randul Total.", 3);
  addHeader(ws, ["Linie de cost", "Suma", "% din total"]);

  const first = ws.rowCount + 1;
  const rootCount = items.filter((i) => (i.depth ?? 0) === 0).length;
  const totalRowNum = first + items.length;
  const grandTotal = items
    .filter((i) => (i.depth ?? 0) === 0)
    .reduce((acc, i) => acc + i.value, 0);

  items.forEach((item, i) => {
    const depth = item.depth ?? 0;
    const row = ws.addRow([`${"    ".repeat(depth)}${item.label}`, item.value, null]);
    leiCell(row.getCell(2));
    row.getCell(3).value = {
      formula: `IF($B$${totalRowNum}=0,"",B${row.number}/$B$${totalRowNum})`,
      result: grandTotal !== 0 ? item.value / grandTotal : "",
    };
    row.getCell(3).numFmt = FMT_PCT;
    row.getCell(3).alignment = { horizontal: "right" };
    styleDataRow(row, i % 2 === 1);
    if (depth === 0) {
      row.getCell(1).font = { bold: true, size: 10, color: { argb: C.ink } };
    }
  });

  const total = ws.addRow([`Total (suma celor ${rootCount} linii de cost principale)`, grandTotal, null]);
  leiCell(total.getCell(2));
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 10, color: { argb: C.ink } };
    cell.border = { top: { style: "thin", color: { argb: C.inkSoft } } };
  });
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

/* --------------------------- partners + obligatii ------------------------ */

function buildDeIncasat(ws: ExcelJS.Worksheet, snapshot: OwnerSnapshot): void {
  setWidths(ws, [46, 18]);
  addTitle(ws, "Clienti care iti datoreaza bani", "Facturi emise si neincasate, dupa client.", 2);
  addHeader(ws, ["Client", "Suma de primit"]);
  addPartnerRows(ws, snapshot.outstanding.clienti, "Niciun client restant. Toate facturile sunt incasate.");
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

function buildDePlatit(ws: ExcelJS.Worksheet, snapshot: OwnerSnapshot): void {
  setWidths(ws, [46, 18, 14]);
  addTitle(ws, "Furnizori pe care ii ai de platit", "Facturi primite si neplatite, dupa furnizor.", 3);
  addHeader(ws, ["Furnizor", "Suma de platit"]);
  addPartnerRows(ws, snapshot.outstanding.furnizori, "Niciun furnizor restant.");

  if (snapshot.obligations.length > 0) {
    ws.addRow([]);
    const sub = ws.addRow(["Obligatii care urmeaza (taxe, salarii, rate)"]);
    sub.getCell(1).font = { bold: true, size: 11, color: { argb: C.ink } };
    addHeader(ws, ["Ce este", "Scadenta", "Suma"]);
    snapshot.obligations.forEach((o, i) => {
      const row = ws.addRow([o.label, o.dueDate, o.amount]);
      leiCell(row.getCell(3));
      styleDataRow(row, i % 2 === 1);
    });
  }
}

function addPartnerRows(
  ws: ExcelJS.Worksheet,
  partners: Array<{ partnerName: string; sold: number }>,
  emptyMessage: string
): void {
  if (partners.length === 0) {
    const row = ws.addRow([emptyMessage]);
    row.getCell(1).font = { italic: true, size: 10, color: { argb: C.muted } };
    return;
  }
  const first = ws.rowCount + 1;
  partners.forEach((p, i) => {
    const row = ws.addRow([p.partnerName, p.sold]);
    leiCell(row.getCell(2));
    styleDataRow(row, i % 2 === 1);
  });
  const total = ws.addRow(["Total", null]);
  total.getCell(2).value = {
    formula: `SUM(B${first}:B${ws.rowCount - 1})`,
    result: partners.reduce((acc, p) => acc + p.sold, 0),
  };
  leiCell(total.getCell(2));
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 10, color: { argb: C.ink } };
    cell.border = { top: { style: "thin", color: { argb: C.inkSoft } } };
  });
}

/* --------------------------- Indicatori (owner) -------------------------- */

function formatKpiValue(kpi: IndustryKpi): string {
  const v = kpi.value;
  if (v === null) return "indisponibil";
  const f0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
  const f1 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });
  const f2 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
  switch (kpi.format) {
    case "percent":
      return `${f1.format(v)}%`;
    case "days":
      return `${f0.format(v)} zile`;
    case "lei":
      return `${f0.format(Math.round(v))} lei`;
    default:
      return Math.abs(v) >= 100 ? f0.format(v) : f2.format(v);
  }
}

function buildIndicatori(ws: ExcelJS.Worksheet, snapshot: OwnerSnapshot): void {
  const section = snapshot.industryKpis;
  if (!section) return;
  setWidths(ws, [16, 36, 14, 12, 48, 48]);
  addTitle(
    ws,
    `Indicatorii afacerii tale (${section.industryLabel})`,
    "Fiecare indicator arata formula in cuvinte si calculul cu numerele reale.",
    6
  );
  addHeader(ws, ["Grup", "Indicator", "Valoare", "Stare", "Cum se calculeaza", "Calcul cu numerele firmei"]);

  let i = 0;
  for (const group of section.groups) {
    for (const kpi of group.kpis) {
      const row = ws.addRow([
        group.label,
        kpi.labelAntreprenor,
        formatKpiValue(kpi),
        KPI_STATE_LABEL[kpi.state] ?? kpi.state,
        kpi.formulaAntreprenor,
        kpi.value === null ? kpi.unavailableReason ?? "" : kpi.calculation ?? "",
      ]);
      styleDataRow(row, i % 2 === 1);
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(3).font = { size: 10, bold: true, color: { argb: STATE_COLOR[kpi.state] ?? C.inkSoft } };
      row.getCell(4).font = { size: 9, color: { argb: STATE_COLOR[kpi.state] ?? C.muted } };
      row.getCell(6).font = { size: 9, name: "Courier New", color: { argb: C.inkSoft } };
      i++;
    }
  }
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

/* ------------------------- Verificare (contabil) ------------------------- */

function buildVerificare(
  ws: ExcelJS.Worksheet,
  snapshot: OwnerSnapshot,
  opts: OwnerExportOptions
): void {
  setWidths(ws, [14, 26, 34, 52, 44, 14, 12, 12]);
  addTitle(
    ws,
    "Verificare pentru contabil",
    "Fiecare valoare din acest raport, cu formula OMFP, valorile folosite (cu sursa exacta din balanta) si calculul substituit. Reproductibil manual din Balanta de Verificare a lunii publicate.",
    8
  );

  const section = snapshot.industryKpis;
  if (section) {
    const sub = ws.addRow([`Indicatori de industrie (profil: ${section.industryLabel})`]);
    sub.getCell(1).font = { bold: true, size: 11, color: { argb: C.ink } };
    addHeader(ws, [
      "Grup",
      "Indicator",
      "Formula",
      "Valori folosite (sursa din balanta)",
      "Calcul",
      "Valoare",
      "Tinta",
      "Stare",
    ]);
    let i = 0;
    for (const group of section.groups) {
      for (const kpi of group.kpis) {
        const inputs = kpi.inputs
          .map(
            (inp) =>
              `${inp.label} = ${inp.value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} · ${inp.source}`
          )
          .join("\n");
        const row = ws.addRow([
          group.label,
          kpi.labelContabil,
          kpi.formulaContabil,
          inputs,
          kpi.value === null ? kpi.unavailableReason ?? "indisponibil" : kpi.calculation ?? "",
          formatKpiValue(kpi),
          kpi.thresholds?.label ?? "",
          KPI_STATE_LABEL[kpi.state] ?? kpi.state,
        ]);
        styleDataRow(row, i % 2 === 1);
        row.getCell(4).font = { size: 8.5, color: { argb: C.inkSoft } };
        row.getCell(5).font = { size: 9, name: "Courier New", color: { argb: C.inkSoft } };
        row.getCell(6).alignment = { horizontal: "right" };
        row.getCell(6).font = { size: 10, bold: true, color: { argb: STATE_COLOR[kpi.state] ?? C.inkSoft } };
        row.getCell(8).font = { size: 9, color: { argb: STATE_COLOR[kpi.state] ?? C.muted } };
        i++;
      }
    }
  }

  const ratios = snapshot.ratios ?? [];
  if (ratios.length > 0) {
    ws.addRow([]);
    const sub = ws.addRow(["Indicatori financiari detaliati (sectiunea Detaliat de pe /firma)"]);
    sub.getCell(1).font = { bold: true, size: 11, color: { argb: C.ink } };
    addHeader(ws, ["Grup", "Indicator", "Formula", "Calcul", "Valoare", "Tinta", "Stare", ""]);
    ratios.forEach((ratio, i) => {
      const row = ws.addRow([
        ratio.group,
        ratio.label,
        ratio.formula,
        ratio.calculation ?? "",
        formatRatioValue(ratio),
        ratio.target ?? "",
        KPI_STATE_LABEL[ratio.state] ?? ratio.state,
        "",
      ]);
      styleDataRow(row, i % 2 === 1);
      row.getCell(4).font = { size: 9, name: "Courier New", color: { argb: C.inkSoft } };
      row.getCell(5).alignment = { horizontal: "right" };
      row.getCell(5).font = { size: 10, bold: true, color: { argb: STATE_COLOR[ratio.state] ?? C.inkSoft } };
      row.getCell(7).font = { size: 9, color: { argb: STATE_COLOR[ratio.state] ?? C.muted } };
    });
  }

  addProvenance(ws, opts, 8);
}

function formatRatioValue(ratio: FinancialRatio): string {
  if (ratio.value === null || !Number.isFinite(ratio.value)) return "indisponibil";
  const f0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
  const f1 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });
  const f2 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
  switch (ratio.format) {
    case "percent":
      return `${f1.format(ratio.value)}%`;
    case "days":
      return `${f0.format(ratio.value)} zile`;
    case "lei":
      return `${f0.format(Math.round(ratio.value))} lei`;
    default:
      return f2.format(ratio.value);
  }
}
