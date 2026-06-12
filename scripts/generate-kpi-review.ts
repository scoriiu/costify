/**
 * Generates the KPI-per-industry review workbook for the accountant.
 *
 * Usage:
 *   tsx scripts/generate-kpi-review.ts [output.xlsx]
 *   (default output: docs/kpi/KPI_Review_Industrii.xlsx)
 *
 * One sheet per industry, built from the SAME source of truth the app uses
 * (KPI_REGISTRY + INDUSTRY_PROFILES). Each row is a KPI with its formula,
 * thresholds (industry overrides applied) and implementation status. The
 * accountant marks relevance per industry via a dropdown (Esential / Util /
 * Nu se aplica) and writes free-text notes. The filled file is then used to
 * update profiles.ts (suppressions, overrides).
 */

import ExcelJS from "exceljs";
import { KPI_REGISTRY, type KpiDefinition } from "../src/modules/reporting/industry/registry";
import { INDUSTRY_PROFILES, GROUP_INFO } from "../src/modules/reporting/industry/profiles";
import { INDUSTRY_OPTIONS } from "../src/modules/reporting/industry/caen-map";
import type { IndustryId, KpiGroupId } from "../src/modules/reporting/industry/types";

const OUT = process.argv[2] ?? "docs/kpi/KPI_Review_Industrii.xlsx";

const ESSENTIAL_GROUPS: KpiGroupId[] = [
  "profitabilitate",
  "lichiditate",
  "eficienta",
  "indatorare",
  "crestere",
];

const RELEVANCE_OPTIONS = ["Esential", "Util", "Nu se aplica"] as const;
type Relevance = (typeof RELEVANCE_OPTIONS)[number];

/** Pre-filled review state capturing feedback already received. */
const PREFILL: Partial<Record<IndustryId, Record<string, { relevance: Relevance; note: string }>>> = {
  consultanta: {
    marjaBruta: {
      relevance: "Nu se aplica",
      note: "Feedback contabil: indicator de comert. Pentru servicii se urmareste marja per proiect (spec: Driveri Consultanta D3) sau marja EBITDA.",
    },
  },
  servicii_contabile: {
    marjaBruta: {
      relevance: "Nu se aplica",
      note: "Feedback contabil: indicator de comert. Pentru cabinete se urmareste profitabilitatea per client (spec: Driveri Contabilitate-Servicii D3).",
    },
  },
  telecom: {
    marjaBruta: {
      relevance: "Nu se aplica",
      note: "Spec Telecom foloseste marja EBITDA (D4), nu marja bruta pe marfa.",
    },
  },
  banking: {
    marjaBruta: {
      relevance: "Nu se aplica",
      note: "Spec Banking foloseste NIM (D1) ca marja principala, nu marja bruta pe marfa.",
    },
  },
  inchirieri: {
    marjaBruta: {
      relevance: "Nu se aplica",
      note: "In inchirieri nu exista cost al marfii; marja relevanta e EBITDA (> 60%).",
    },
  },
};

const COLORS = {
  header: "FF0D6B5E",
  headerText: "FFE9E8E3",
  section: "FFE6E4DE",
  inputFill: "FFFFF7E0",
  notApplicable: "FFFDE8E8",
  zebra: "FFF7F6F2",
};

const COLUMNS = [
  { header: "Grup", key: "grup", width: 22 },
  { header: "KPI", key: "kpi", width: 26 },
  { header: "Cum il vede antreprenorul", key: "antreprenor", width: 42 },
  { header: "Formula", key: "formula", width: 52 },
  { header: "Prag tinta", key: "target", width: 14 },
  { header: "Status in aplicatie", key: "status", width: 26 },
  { header: "Relevanta (de completat)", key: "relevanta", width: 22 },
  { header: "Observatii contabil", key: "observatii", width: 60 },
];

function statusLabel(def: KpiDefinition): string {
  return def.unavailableReason ? "Necesita date operationale" : "Calculat din jurnal";
}

function addGuideSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet("Ghid");
  ws.getColumn(1).width = 110;
  const lines = [
    ["KPI pe industrie. Fisa de revizuire pentru contabil", true],
    ["", false],
    ["Ce contine: cate o foaie pentru fiecare industrie din aplicatie. Fiecare foaie listeaza", false],
    ["indicatorii esentiali (afisati azi pentru toate industriile) si indicatorii specifici industriei,", false],
    ["exact asa cum ii calculeaza aplicatia, cu formula si pragurile aplicate.", false],
    ["", false],
    ["Ce completezi (doar coloanele galbene):", true],
    ["1. Relevanta: alege din lista Esential / Util / Nu se aplica.", false],
    ["   - Esential: ramane pe prima pagina de KPI pentru industria respectiva.", false],
    ["   - Util: ramane vizibil, dar secundar.", false],
    ["   - Nu se aplica: dispare pentru industria respectiva (ex. Marja bruta la servicii).", false],
    ["2. Observatii: orice corectie de formula, prag sau denumire. Scrie liber.", false],
    ["", false],
    ["Randurile marcate deja cu 'Nu se aplica' (fond rosu deschis) reflecta feedbackul primit", false],
    ["pana acum. Confirma sau schimba.", false],
    ["", false],
    ["Dupa completare, trimite fisierul inapoi. Modificarile se aplica in aplicatie per industrie.", false],
  ] as const;
  for (const [text, bold] of lines) {
    const row = ws.addRow([text]);
    row.font = { bold: Boolean(bold), size: bold ? 14 : 11 };
  }
}

function addSectionRow(ws: ExcelJS.Worksheet, label: string): void {
  const row = ws.addRow({ grup: label });
  ws.mergeCells(row.number, 1, row.number, COLUMNS.length);
  row.font = { bold: true, size: 11 };
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.section } };
}

function addKpiRow(
  ws: ExcelJS.Worksheet,
  def: KpiDefinition,
  industry: IndustryId,
  groupLabel: string,
  zebra: boolean
): void {
  const profile = INDUSTRY_PROFILES[industry];
  const threshold = profile.thresholdOverrides[def.id] ?? def.thresholds;
  const prefill = PREFILL[industry]?.[def.id];

  const row = ws.addRow({
    grup: groupLabel,
    kpi: def.labelContabil,
    antreprenor: def.labelAntreprenor,
    formula: def.formulaContabil,
    target: threshold?.label ?? "",
    status: statusLabel(def),
    relevanta: prefill?.relevance ?? "Esential",
    observatii: prefill?.note ?? "",
  });

  row.alignment = { vertical: "top", wrapText: true };
  if (zebra) {
    for (let c = 1; c <= COLUMNS.length; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.zebra } };
    }
  }

  const relevCell = row.getCell(7);
  const notesCell = row.getCell(8);
  relevCell.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [`"${RELEVANCE_OPTIONS.join(",")}"`],
    showErrorMessage: true,
    errorTitle: "Valoare invalida",
    error: "Alege din lista: Esential, Util, Nu se aplica.",
  };
  const editableFill = prefill?.relevance === "Nu se aplica" ? COLORS.notApplicable : COLORS.inputFill;
  relevCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: editableFill } };
  notesCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.inputFill } };
}

function addIndustrySheet(wb: ExcelJS.Workbook, industry: IndustryId, label: string): void {
  const ws = wb.addWorksheet(label.slice(0, 31));
  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  const title = ws.addRow([`KPI pentru industria: ${label}`]);
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  title.font = { bold: true, size: 14 };
  ws.addRow([]);

  const header = ws.addRow(COLUMNS.map((c) => c.header));
  header.font = { bold: true, color: { argb: COLORS.headerText } };
  header.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= COLUMNS.length; c++) {
    header.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.header } };
  }
  ws.views = [{ state: "frozen", ySplit: 3 }];

  let zebra = false;
  for (const groupId of ESSENTIAL_GROUPS) {
    const info = GROUP_INFO[groupId];
    addSectionRow(ws, `ESENTIALE: ${info.label.toUpperCase()}`);
    for (const def of KPI_REGISTRY.filter((d) => d.group === groupId)) {
      addKpiRow(ws, def, industry, info.label, zebra);
      zebra = !zebra;
    }
  }

  const profile = INDUSTRY_PROFILES[industry];
  addSectionRow(ws, "SPECIFICI INDUSTRIEI");
  for (const id of profile.industryKpiIds) {
    const def = KPI_REGISTRY.find((d) => d.id === id);
    if (def) {
      addKpiRow(ws, def, industry, "Specific industriei", zebra);
      zebra = !zebra;
    }
  }
}

async function main(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Costify";
  wb.created = new Date();

  addGuideSheet(wb);
  for (const opt of INDUSTRY_OPTIONS) {
    addIndustrySheet(wb, opt.id, opt.label);
  }

  await wb.xlsx.writeFile(OUT);

  const kpiCount = KPI_REGISTRY.length;
  console.log(`Scris: ${OUT}`);
  console.log(`Industrii: ${INDUSTRY_OPTIONS.length}, KPI in registru: ${kpiCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
