/**
 * KPI coverage matrix: every KPI from the two spec files
 * (docs/kpi/KPI_Formule_CFO.xlsx, docs/kpi/Checklist_Controlling_Industrii.xlsx)
 * reconciled against the live registry.
 *
 * Status is DERIVED from KPI_BY_ID at call time, never hardcoded:
 *  - "computed":    registry definition exists and computes from the journal
 *  - "placeholder": registry definition exists but returns null until
 *                   operational data arrives (unavailableReason set)
 *  - "omitted":     not in the registry; `note` explains why
 */

import { KPI_BY_ID, KPI_REGISTRY, type KpiDefinition } from "./registry";
import { INPUT_SOURCES } from "./inputs";
import {
  auxInputsFor,
  auxiliaryUnlockReport,
  unlockedBy,
  type AuxiliaryInput,
  type AuxiliaryInputId,
  type AuxiliaryUnlock,
} from "./auxiliary";

export type CoverageStatus = "computed" | "placeholder" | "omitted";

export interface KpiCoverageSpecItem {
  /** Name exactly as it appears in the spec file. */
  specName: string;
  registryId: string | null;
  /** Omission reason or approximation caveat. */
  note?: string;
}

export interface KpiCoverageSection {
  source: string;
  title: string;
  items: KpiCoverageSpecItem[];
}

/** Serializable formula trace for one implemented KPI (no compute fn). */
export interface KpiCoverageDetail {
  group: string;
  labelAntreprenor: string;
  formulaContabil: string;
  formulaAntreprenor: string;
  interpretationContabil: string;
  thresholdLabel: string | null;
  /** Balance aggregates entering the formula, with their exact source. */
  inputs: Array<{ label: string; source: string }>;
  unavailableReason: string | null;
}

export interface KpiCoverageRow extends KpiCoverageSpecItem {
  status: CoverageStatus;
  /** Label the contabil sees in the app, when implemented. */
  appLabel: string | null;
  /** Full formula trace, present iff the KPI exists in the registry. */
  detail: KpiCoverageDetail | null;
  /** Auxiliary (operational) inputs that would make this KPI computable.
   *  Empty when the KPI is already computed or genuinely out of scope. */
  missingAux: AuxiliaryInput[];
}

/** What-if summary for a single auxiliary input. */
export interface AuxiliaryUnlockView {
  id: AuxiliaryInputId;
  label: string;
  cadence: string;
  source: string;
  /** KPIs this input unlocks on its own. */
  unlocksAlone: string[];
  /** KPIs it contributes to but which still need other inputs. */
  contributesTo: string[];
}

export interface KpiCoverageReport {
  sections: Array<{ source: string; title: string; rows: KpiCoverageRow[] }>;
  /** Registry KPIs that exist beyond the spec files. */
  extraRows: KpiCoverageRow[];
  totals: { computed: number; placeholder: number; omitted: number; total: number };
  /** Per-auxiliary-input unlock breakdown, sorted by impact. */
  auxiliary: AuxiliaryUnlockView[];
}

const OPERATIONAL = "Necesita date operationale (nu exista in jurnalul contabil).";

const CFO_ESSENTIALS: KpiCoverageSection = {
  source: "KPI_Formule_CFO.xlsx",
  title: "KPI Complet (esentiale)",
  items: [
    { specName: "Marja Bruta %", registryId: "marjaBruta" },
    { specName: "Marja EBITDA %", registryId: "marjaEbitda" },
    { specName: "Marja EBIT %", registryId: "marjaEbit" },
    { specName: "Marja Neta %", registryId: "marjaNeta" },
    { specName: "ROE %", registryId: "roe" },
    { specName: "ROA %", registryId: "roa" },
    { specName: "ROCE %", registryId: "roce" },
    { specName: "ROI %", registryId: null, note: "Definit la nivel de proiect sau investitie. " + OPERATIONAL },
    { specName: "Rata Curenta", registryId: "currentRatio" },
    { specName: "Rata Rapida", registryId: "quickRatio" },
    { specName: "Cash Ratio", registryId: "cashRatio" },
    { specName: "Capitalul de Lucru (NWC)", registryId: "workingCapital" },
    { specName: "Flux Numerar Operational (OCF)", registryId: null, note: "Necesita variatia capitalului de lucru intre perioade. Aproximat partial de Free Cash Flow aproximat." },
    { specName: "DSO (zile)", registryId: "dso" },
    { specName: "DPO (zile)", registryId: "dpo" },
    { specName: "DIO (zile)", registryId: "dio" },
    { specName: "Ciclu Numerar (CCC)", registryId: "ccc" },
    { specName: "Rotatie Active", registryId: "rotatieActive" },
    { specName: "Rotatie Stocuri", registryId: "rotatieStocuri" },
    { specName: "Debt / Equity", registryId: "debtToEquity" },
    { specName: "Debt / EBITDA", registryId: "debtToEbitda" },
    { specName: "Acoperire Dobanzi", registryId: "interestCoverage" },
    { specName: "Grad Indatorare", registryId: "gradIndatorare" },
    { specName: "Crestere Venituri YoY", registryId: "revenueGrowth" },
    { specName: "Crestere Organica", registryId: null, note: "Necesita separarea veniturilor pe unitati existente vs noi. " + OPERATIONAL },
    { specName: "CAC", registryId: null, note: "Cost de marketing per client nou. " + OPERATIONAL },
    { specName: "LTV", registryId: null, note: OPERATIONAL },
    { specName: "LTV / CAC", registryId: null, note: OPERATIONAL },
    { specName: "Churn Rate", registryId: "churn" },
    { specName: "Net Promoter Score", registryId: null, note: "Necesita sondaje de satisfactie. " + OPERATIONAL },
    { specName: "Venit / Angajat", registryId: "venitPerAngajat" },
    { specName: "Cost Personal %", registryId: "costPersonal" },
    { specName: "Absenteism %", registryId: null, note: "Necesita pontaje. " + OPERATIONAL },
    { specName: "Fluctuatie Personal %", registryId: null, note: "Necesita evidenta de personal. " + OPERATIONAL },
    { specName: "Profit / Angajat", registryId: "profitPerAngajat" },
    { specName: "OEE %", registryId: null, note: "Productie: necesita date de echipamente. Nu exista inca profil de productie." },
    { specName: "Rebut %", registryId: null, note: "Productie: necesita date de calitate. " + OPERATIONAL },
    { specName: "Cost / Unitate", registryId: null, note: "Productie: necesita volume fizice. " + OPERATIONAL },
    { specName: "On-Time Delivery %", registryId: null, note: "Productie: necesita date logistice. " + OPERATIONAL },
    { specName: "Utilizare Capacitate %", registryId: null, note: "Productie: necesita capacitati instalate. " + OPERATIONAL },
    { specName: "MRR", registryId: "mrr" },
    { specName: "ARR", registryId: null, note: "Derivabil din MRR (× 12) cand vor exista date de abonamente." },
    { specName: "MRR Churn %", registryId: null, note: OPERATIONAL },
    { specName: "Net Revenue Retention", registryId: null, note: OPERATIONAL },
    { specName: "CAC Payback", registryId: null, note: OPERATIONAL },
  ],
};

const CFO_ADVANCED: KpiCoverageSection = {
  source: "KPI_Formule_CFO.xlsx",
  title: "Formule Avansate",
  items: [
    { specName: "CAGR", registryId: null, note: "Necesita minim doi ani complecti de istoric in jurnal." },
    { specName: "Crestere Like-for-Like (LFL)", registryId: null, note: "Necesita venituri separate pe unitati. " + OPERATIONAL },
    { specName: "Varianta fata de Budget (F/N)", registryId: null, note: "Necesita modulul de bugete (inexistent inca)." },
    { specName: "EV (Enterprise Value)", registryId: null, note: "Valoare de piata. Nu se aplica firmelor nelistate." },
    { specName: "EV / EBITDA", registryId: null, note: "Valoare de piata. Nu se aplica firmelor nelistate." },
    { specName: "P/E Ratio", registryId: null, note: "Valoare de piata. Nu se aplica firmelor nelistate." },
    { specName: "WACC", registryId: null, note: "Necesita costul capitalului. Nu se aplica firmelor nelistate." },
    { specName: "Free Cash Flow (FCF)", registryId: "fcfAprox", note: "Aproximare: fara variatia capitalului de lucru." },
    { specName: "Conversie Cash %", registryId: null, note: "Depinde de FCF exact (cu variatia capitalului de lucru)." },
    { specName: "Capitalul de Lucru Net (NWC)", registryId: "workingCapital" },
    { specName: "LTV (SaaS)", registryId: null, note: OPERATIONAL },
    { specName: "Magic Number (SaaS)", registryId: null, note: OPERATIONAL },
    { specName: "Rule of 40", registryId: "ruleOf40" },
    { specName: "Burn Multiple", registryId: null, note: OPERATIONAL },
    { specName: "OEE", registryId: null, note: "Productie: necesita date de echipamente. " + OPERATIONAL },
    { specName: "Throughput", registryId: null, note: "Necesita separarea costurilor variabile. " + OPERATIONAL },
    { specName: "Costul Calitatii Slabe", registryId: null, note: "Necesita date de calitate si garantii. " + OPERATIONAL },
  ],
};

const AGGREGATE_ONLY = "Implementat doar la nivel agregat de firma. Granularitatea per proiect/categorie necesita date operationale.";

const CHECKLIST_DRIVERS: KpiCoverageSection[] = [
  {
    source: "Checklist_Controlling_Industrii.xlsx",
    title: "Driveri Consultanta",
    items: [
      { specName: "D1 Rata ore facturabile", registryId: "oreFacturabile" },
      { specName: "D2 Venituri per consultant", registryId: "venitPerAngajat" },
      { specName: "D3 Marja bruta per proiect", registryId: "marjaBruta", note: AGGREGATE_ONLY },
      { specName: "D4 Rata de realizare", registryId: null, note: "Necesita ore si tarife. " + OPERATIONAL },
      { specName: "D5 Rata de retentie clienti", registryId: "retentieClienti" },
      { specName: "D6 Zile incasare creante (DSO)", registryId: "dso" },
      { specName: "D7 Cheltuieli personal / Venituri", registryId: "costPersonal" },
      { specName: "D8 Rata de crestere venituri", registryId: "revenueGrowth" },
    ],
  },
  {
    source: "Checklist_Controlling_Industrii.xlsx",
    title: "Driveri Retail-DIY",
    items: [
      { specName: "D1 Vanzari pe metru patrat", registryId: "vanzariPerMp" },
      { specName: "D2 Bon mediu", registryId: "bonMediu" },
      { specName: "D3 Trafic clienti", registryId: null, note: "Necesita date POS / footfall. " + OPERATIONAL },
      { specName: "D4 Marja bruta pe categorie", registryId: "marjaBruta", note: AGGREGATE_ONLY },
      { specName: "D5 Zile stoc (DIO)", registryId: "dio" },
      { specName: "D6 Shrinkage", registryId: null, note: "Necesita inventarul fizic. " + OPERATIONAL },
      { specName: "D7 SSSG (crestere organica)", registryId: null, note: "Necesita venituri per magazin. " + OPERATIONAL },
      { specName: "D8 Cost personal / Vanzari", registryId: "costPersonal" },
      { specName: "D9 Rata de returnare produse", registryId: null, note: "Necesita date POS. " + OPERATIONAL },
      { specName: "D10 Raport chirie / vanzari", registryId: "chirieVanzari" },
    ],
  },
  {
    source: "Checklist_Controlling_Industrii.xlsx",
    title: "Driveri Telecom",
    items: [
      { specName: "D1 MRR", registryId: "mrr" },
      { specName: "D2 Churn", registryId: "churn" },
      { specName: "D3 ARPU", registryId: "arpu" },
      { specName: "D4 Marja EBITDA", registryId: "marjaEbitda" },
      { specName: "D5 Intensitate CapEx", registryId: "capexIntensity" },
      { specName: "D6 LCR", registryId: null, note: "Indicator prudential: necesita clasificarea iesirilor nete pe 30 zile." },
      { specName: "D7 Net Adds", registryId: null, note: "Necesita evidenta abonatilor. " + OPERATIONAL },
      { specName: "D8 Cost retea / Venituri", registryId: null, note: "Necesita separarea costurilor de retea. " + OPERATIONAL },
      { specName: "D9 Facturi restante > 60 zile", registryId: null, note: "Necesita aging-ul creantelor (posibil din jurnal in viitor, nu din balanta)." },
      { specName: "D10 Datorie / EBITDA", registryId: "debtToEbitda" },
    ],
  },
  {
    source: "Checklist_Controlling_Industrii.xlsx",
    title: "Driveri Banking-Finantare",
    items: [
      { specName: "D1 NIM", registryId: "nim" },
      { specName: "D2 NPL", registryId: "npl" },
      { specName: "D3 Cost of Risk (CoR)", registryId: null, note: "Necesita clasificarea portofoliului de credite. " + OPERATIONAL },
      { specName: "D4 Cost / Income (CIR)", registryId: "cir" },
      { specName: "D5 LCR", registryId: null, note: "Indicator prudential BNR. Necesita date de lichiditate zilnice." },
      { specName: "D6 CAR", registryId: null, note: "Indicator prudential BNR. Necesita active ponderate la risc." },
      { specName: "D7 ROE", registryId: "roe" },
      { specName: "D8 Acoperire NPL cu provizioane", registryId: null, note: "Necesita clasificarea creditelor neperformante. " + OPERATIONAL },
      { specName: "D9 NSFR", registryId: null, note: "Indicator prudential BNR. Necesita structura finantarii." },
      { specName: "D10 ROA", registryId: "roa" },
    ],
  },
  {
    source: "Checklist_Controlling_Industrii.xlsx",
    title: "Driveri Contabilitate-Servicii",
    items: [
      { specName: "D1 Rata ore facturabile", registryId: "oreFacturabile" },
      { specName: "D2 Venituri per contabil", registryId: "venitPerAngajat" },
      { specName: "D3 Profitabilitate per client", registryId: null, note: "Necesita costul intern alocat per client. " + OPERATIONAL },
      { specName: "D4 DSO", registryId: "dso" },
      { specName: "D5 Rata de retentie clienti", registryId: "retentieClienti" },
      { specName: "D6 Declaratii la termen, fara erori", registryId: null, note: "Necesita evidenta declaratiilor depuse. " + OPERATIONAL },
      { specName: "D7 Cost personal / Venituri", registryId: "costPersonal" },
      { specName: "D8 Concentrare top 3 clienti", registryId: "top3Concentration" },
    ],
  },
];

const ALL_SECTIONS: KpiCoverageSection[] = [CFO_ESSENTIALS, CFO_ADVANCED, ...CHECKLIST_DRIVERS];

function toDetail(def: KpiDefinition): KpiCoverageDetail {
  return {
    group: def.group,
    labelAntreprenor: def.labelAntreprenor,
    formulaContabil: def.formulaContabil,
    formulaAntreprenor: def.formulaAntreprenor,
    interpretationContabil: def.interpretationContabil,
    thresholdLabel: def.thresholds?.label ?? null,
    inputs: def.inputIds.map((id) => INPUT_SOURCES[id]),
    unavailableReason: def.unavailableReason ?? null,
  };
}

/** Aux requirements are keyed by registryId when present, else the spec name. */
function missingAuxFor(registryId: string | null, specName: string, computed: boolean): AuxiliaryInput[] {
  if (computed) return [];
  return auxInputsFor(registryId ?? specName);
}

function resolveRow(item: KpiCoverageSpecItem): KpiCoverageRow {
  const def = item.registryId ? KPI_BY_ID.get(item.registryId) : undefined;
  if (!def) {
    return {
      ...item,
      registryId: null,
      status: "omitted",
      appLabel: null,
      detail: null,
      missingAux: missingAuxFor(item.registryId, item.specName, false),
    };
  }
  const computed = !def.unavailableReason;
  return {
    ...item,
    status: computed ? "computed" : "placeholder",
    appLabel: def.labelContabil,
    detail: toDetail(def),
    missingAux: missingAuxFor(def.id, item.specName, computed),
  };
}

export function getKpiCoverage(): KpiCoverageReport {
  const sections = ALL_SECTIONS.map((s) => ({
    source: s.source,
    title: s.title,
    rows: s.items.map(resolveRow),
  }));

  const mappedIds = new Set(
    ALL_SECTIONS.flatMap((s) => s.items.map((i) => i.registryId)).filter(Boolean)
  );
  const extraRows: KpiCoverageRow[] = KPI_REGISTRY.filter((d) => !mappedIds.has(d.id)).map(
    (d) => ({
      specName: d.labelContabil,
      registryId: d.id,
      status: d.unavailableReason ? "placeholder" : "computed",
      appLabel: d.labelContabil,
      note: "Adaugat de Costify peste specificatiile din Excel.",
      detail: toDetail(d),
      missingAux: missingAuxFor(d.id, d.labelContabil, !d.unavailableReason),
    })
  );

  const allRows = [...sections.flatMap((s) => s.rows), ...extraRows];
  const totals = {
    computed: allRows.filter((r) => r.status === "computed").length,
    placeholder: allRows.filter((r) => r.status === "placeholder").length,
    omitted: allRows.filter((r) => r.status === "omitted").length,
    total: allRows.length,
  };

  const auxiliary: AuxiliaryUnlockView[] = auxiliaryUnlockReport()
    .map((u: AuxiliaryUnlock) => ({
      id: u.input.id,
      label: u.input.label,
      cadence: u.input.cadence,
      source: u.input.source,
      unlocksAlone: u.unlocksAlone,
      contributesTo: u.contributesTo,
    }))
    .sort(
      (a, b) =>
        b.unlocksAlone.length - a.unlocksAlone.length ||
        b.contributesTo.length - a.contributesTo.length
    );

  return { sections, extraRows, totals, auxiliary };
}

/** How many currently-uncomputable KPIs become computable for a given set of
 *  collected auxiliary inputs. Used by the what-if summary on the page. */
export function countUnlocked(collected: ReadonlySet<AuxiliaryInputId>): number {
  return unlockedBy(collected).length;
}
