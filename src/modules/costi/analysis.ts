/**
 * Pure analysis helpers behind Costi's CFO-grade tools (ADR-0005).
 *
 * Everything here is side-effect free so it can be unit-tested without a
 * database. Handlers in tool-handlers.ts fetch the inputs (ComputedPeriod
 * payloads, partner totals) and delegate the math to this module.
 */
import { round2 } from "@/lib/money";
import type { CppData, KpiSnapshot } from "@/modules/reporting";

/* -------------------------------------------------------------------------- */
/*                       CPP → per-business-line totals                        */
/* -------------------------------------------------------------------------- */

export interface CppLineTotals {
  venituri: Record<string, number>;
  cheltuieli: Record<string, number>;
}

/**
 * Aggregate per-line revenue/expenses from CPP section detail rows. The
 * current section header decides sign; section totals/headers are skipped.
 * All section details precede the first REZULTAT total, after which only
 * result subtotals and the tax line follow (tax must NOT count as an
 * operating/financial expense), so we stop there. byVertical already sums
 * to value with no leak, keeping each line reconciled to the firm total.
 */
export function aggregateCppByLine(cpp: CppData): CppLineTotals {
  const venituri: Record<string, number> = {};
  const cheltuieli: Record<string, number> = {};
  let bucket: "rev" | "exp" | null = null;
  for (const line of cpp.lines) {
    if (line.isTotal && line.denumire.toUpperCase().includes("REZULTAT")) break;
    if (line.isHeader) {
      const d = line.denumire.toUpperCase();
      bucket = d.includes("VENITURI") ? "rev" : d.includes("CHELTUIELI") ? "exp" : null;
      continue;
    }
    if (line.isTotal || !line.byVertical || bucket === null) continue;
    const target = bucket === "rev" ? venituri : cheltuieli;
    for (const [vid, amt] of Object.entries(line.byVertical)) {
      target[vid] = (target[vid] ?? 0) + amt;
    }
  }
  return { venituri, cheltuieli };
}

/* -------------------------------------------------------------------------- */
/*                        YTD snapshots → monthly trend                        */
/* -------------------------------------------------------------------------- */

export interface PeriodFigures {
  year: number;
  month: number;
  kpis: KpiSnapshot | null;
  cpp: CppData | null;
}

export interface LineFigures {
  venituri: number;
  cheltuieli: number;
  rezultat: number;
}

export interface TrendPoint {
  year: number;
  month: number;
  /** Monthly flow (delta between consecutive YTD snapshots). */
  venituri: number;
  cheltuieli: number;
  rezultatBrut: number;
  /** rezultatBrut / venituri × 100 for the month; null when venituri = 0. */
  marjaPct: number | null;
  /** End-of-month cash position (point-in-time, NOT a delta). */
  cash: number | null;
  /** How many calendar months the deltas cover. 1 in the normal case; >1
   *  when the journal skips months (the flow then spans the gap). */
  monthsCovered: number;
  /** Per business-line monthly flows, keyed by line name. Present only
   *  when requested and the CPP carries a byVertical breakdown. */
  byLine?: Record<string, LineFigures>;
}

interface YtdState {
  year: number;
  month: number;
  venituri: number;
  cheltuieli: number;
  byLine: Map<string, { venituri: number; cheltuieli: number }>;
}

/**
 * Turn a series of YTD CPP snapshots into monthly flows. CPP figures are
 * cumulated January → month, resetting each fiscal year, so:
 *   - within the same year: flow(m) = ytd(m) − ytd(previous snapshot)
 *   - first snapshot of a year: flow = ytd itself (January baseline is 0)
 * Cash comes from the KPI snapshot and stays point-in-time.
 */
export function computeTrendPoints(
  figures: PeriodFigures[],
  includeLines = false
): TrendPoint[] {
  const sorted = [...figures].sort((a, b) => a.year - b.year || a.month - b.month);
  const points: TrendPoint[] = [];
  let prev: YtdState | null = null;

  for (const f of sorted) {
    if (!f.cpp) continue;
    const ytdV = f.cpp.venituriExploatare + f.cpp.venituriFinanciare;
    const ytdC = f.cpp.cheltuieliExploatare + f.cpp.cheltuieliFinanciare;
    const lineTotals = includeLines ? aggregateCppByLine(f.cpp) : null;

    const sameYear = prev !== null && prev.year === f.year;
    const base = sameYear ? prev! : null;
    const venituri = round2(ytdV - (base?.venituri ?? 0));
    const cheltuieli = round2(ytdC - (base?.cheltuieli ?? 0));
    const rezultatBrut = round2(venituri - cheltuieli);

    let byLine: Record<string, LineFigures> | undefined;
    const nextByLine = new Map<string, { venituri: number; cheltuieli: number }>();
    if (lineTotals && f.cpp.verticals && f.cpp.verticals.length > 0) {
      byLine = {};
      for (const v of f.cpp.verticals) {
        const ytdLineV = lineTotals.venituri[v.id] ?? 0;
        const ytdLineC = lineTotals.cheltuieli[v.id] ?? 0;
        nextByLine.set(v.id, { venituri: ytdLineV, cheltuieli: ytdLineC });
        const prevLine = base?.byLine.get(v.id);
        const lv = round2(ytdLineV - (prevLine?.venituri ?? 0));
        const lc = round2(ytdLineC - (prevLine?.cheltuieli ?? 0));
        byLine[v.name] = { venituri: lv, cheltuieli: lc, rezultat: round2(lv - lc) };
      }
    }

    points.push({
      year: f.year,
      month: f.month,
      venituri,
      cheltuieli,
      rezultatBrut,
      marjaPct: venituri !== 0 ? round2((rezultatBrut / venituri) * 100) : null,
      cash: f.kpis ? round2(f.kpis.cashBank) : null,
      monthsCovered: base ? f.month - base.month : f.month,
      byLine,
    });

    prev = { year: f.year, month: f.month, venituri: ytdV, cheltuieli: ytdC, byLine: nextByLine };
  }

  return points;
}

/* -------------------------------------------------------------------------- */
/*                          Partner concentration                              */
/* -------------------------------------------------------------------------- */

export interface Concentration {
  top1Pct: number;
  top3Pct: number;
  top5Pct: number;
}

/**
 * Share of a total held by the biggest 1 / 3 / 5 contributors. `amounts`
 * need not be sorted; `total` is the denominator the caller cares about
 * (e.g. total firm revenue including partner-unresolved rulaj, so the
 * percentages stay honest). Returns null when the total is 0.
 */
export function computeConcentration(
  amounts: number[],
  total: number
): Concentration | null {
  if (total === 0) return null;
  const sorted = [...amounts].sort((a, b) => Math.abs(b) - Math.abs(a));
  const share = (n: number) =>
    round2(
      (sorted.slice(0, n).reduce((s, v) => s + Math.abs(v), 0) / Math.abs(total)) * 100
    );
  return { top1Pct: share(1), top3Pct: share(3), top5Pct: share(5) };
}

/* -------------------------------------------------------------------------- */
/*                     Client diagnostic (P00 flash, computed)                 */
/* -------------------------------------------------------------------------- */

export type FlagSeverity = "alarma" | "atentie" | "info";

export interface DiagnosticFlag {
  id: string;
  severity: FlagSeverity;
  /** Pre-worded Romanian sentence with the numbers already in it. */
  text: string;
}

export interface TopPartner {
  name: string;
  rulaj: number;
  pct: number;
}

export interface DiagnosticInputs {
  latest: { year: number; month: number };
  kpis: KpiSnapshot;
  /** Monthly trend points, oldest -> newest, last one = latest period. */
  trend: TrendPoint[];
  /** Top revenue partners with firm-total share, sorted desc. */
  topPartners: TopPartner[];
  /** Mapping coverage of the latest period. */
  unmapped: { count: number; rulaj: number } | null;
  /** Share of YTD figures sitting on the default vertical; null when
   *  business lines are disabled. */
  defaultLineShare: { venituriPct: number; cheltuieliPct: number } | null;
  /** Latest known employee count and how many months behind it is. */
  employee: { count: number; year: number; month: number; staleMonths: number } | null;
}

export interface DiagnosticResult {
  flags: DiagnosticFlag[];
  burnLunar: number | null;
  runwayLuni: number | null;
  marjaTrend: "in crestere" | "in scadere" | "stabila" | null;
  lunaPartialaSuspecta: boolean;
}

const MONTH_NAMES = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function fmtLei(n: number): string {
  return `${Math.round(n).toLocaleString("ro-RO")} lei`;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Exception rule from the CFO response contract: relative AND absolute. */
export function isException(
  delta: number,
  reference: number,
  ytdRevenue: number
): boolean {
  if (reference === 0) return Math.abs(delta) > Math.max(1000, 0.005 * ytdRevenue);
  const relPct = Math.abs(delta / reference) * 100;
  return relPct > 10 && Math.abs(delta) > Math.max(1000, 0.005 * ytdRevenue);
}

const PARTIAL_MONTH_RATIO = 0.4;
const RUNWAY_ALARM_MONTHS = 3;
const RUNWAY_WATCH_MONTHS = 6;
const CONCENTRATION_WATCH_PCT = 30;
const CONCENTRATION_ALARM_PCT = 50;
const DEFAULT_LINE_HONESTY_PCT = 50;
const MARGIN_DRIFT_PP = 5;
const RECEIVABLE_MONTHS_WATCH = 2;

/**
 * The computed P00 flash: every insight Costi must never miss, derived
 * deterministically so answer quality does not depend on model discretion.
 * Flags come pre-worded (Romanian, numbers included) and sorted by severity.
 */
export function computeDiagnostic(inputs: DiagnosticInputs): DiagnosticResult {
  const { latest, kpis, trend, topPartners, unmapped, defaultLineShare, employee } = inputs;
  const flags: DiagnosticFlag[] = [];
  const latestLabel = monthLabel(latest.year, latest.month);

  // Partial-month detection first: it decides which points feed the averages.
  const last = trend.length > 0 ? trend[trend.length - 1] : null;
  const priorPoints = trend.slice(0, -1);
  const prior3Rev = avg(priorPoints.slice(-3).map((p) => p.venituri));
  const lunaPartialaSuspecta =
    last !== null &&
    prior3Rev !== null &&
    prior3Rev > 0 &&
    last.venituri < PARTIAL_MONTH_RATIO * prior3Rev;

  if (lunaPartialaSuspecta && last) {
    flags.push({
      id: "luna_partiala",
      severity: "atentie",
      text: `Luna ${latestLabel} pare incompleta: venituri ${fmtLei(last.venituri)} fata de media ${fmtLei(prior3Rev!)} pe ultimele 3 luni. Nu da verdict final pe luna asta inainte de confirmarea inchiderii.`,
    });
  }

  // Burn and runway on full months only.
  const fullPoints = lunaPartialaSuspecta ? priorPoints : trend;
  const burn = avg(fullPoints.slice(-3).map((p) => p.cheltuieli));
  const netAvg = avg(fullPoints.slice(-3).map((p) => p.rezultatBrut));
  const cash = kpis.cashBank;

  let runway: number | null = null;
  if (cash <= 0) {
    flags.push({
      id: "cash_negativ",
      severity: "alarma",
      text: `Cash negativ la ${latestLabel}: ${fmtLei(cash)}. Fie descoperit de cont, fie lipsesc incasari din jurnal. De verificat cu extrasul inainte de orice alta discutie.`,
    });
    runway = 0;
  } else if (burn !== null && burn > 0) {
    // Playbook P02: runway uses NET burn and only matters when the firm is
    // losing money; a self-financing firm has no runway problem by definition.
    const selfFinancing = netAvg === null || netAvg >= 0;
    if (selfFinancing) {
      runway = null;
    } else {
      runway = round2(cash / -netAvg);
      if (runway < RUNWAY_ALARM_MONTHS) {
        flags.push({
          id: "runway",
          severity: "alarma",
          text: `Rezistenta cash sub prag: ${fmtLei(cash)} in banca acopera ~${runway.toFixed(1)} luni la ritmul actual de pierdere (${fmtLei(-netAvg)}/luna neta). Sub 3 luni inseamna prioritate absoluta pe incasari.`,
        });
      } else if (runway < RUNWAY_WATCH_MONTHS) {
        flags.push({
          id: "runway",
          severity: "atentie",
          text: `Rezistenta cash de urmarit: ~${runway.toFixed(1)} luni (${fmtLei(cash)} in banca, ardere neta ${fmtLei(-netAvg)}/luna).`,
        });
      }
    }
  }

  // Concentration with names: the "Roche" deduction, never missed again.
  const top1 = topPartners[0];
  if (top1 && top1.pct >= CONCENTRATION_WATCH_PCT) {
    const severity = top1.pct >= CONCENTRATION_ALARM_PCT ? "alarma" : "atentie";
    flags.push({
      id: "concentrare",
      severity,
      text: `${top1.pct >= CONCENTRATION_ALARM_PCT ? "Mai mult de jumatate" : `${Math.round(top1.pct)}%`} din venituri vine de la un singur partener: ${top1.name} (${fmtLei(top1.rulaj)}, ${top1.pct}% YTD). Daca acest partener intarzie sau pleaca, impactul e imediat.`,
    });
  }

  // Honesty check: results per business line are cosmetic when the default
  // line holds most of the money.
  if (defaultLineShare) {
    const worst = Math.max(defaultLineShare.venituriPct, defaultLineShare.cheltuieliPct);
    if (worst >= DEFAULT_LINE_HONESTY_PCT) {
      const parts: string[] = [];
      if (defaultLineShare.venituriPct >= DEFAULT_LINE_HONESTY_PCT)
        parts.push(`${Math.round(defaultLineShare.venituriPct)}% din venituri`);
      if (defaultLineShare.cheltuieliPct >= DEFAULT_LINE_HONESTY_PCT)
        parts.push(`${Math.round(defaultLineShare.cheltuieliPct)}% din cheltuieli`);
      flags.push({
        id: "linii_nealocate",
        severity: "atentie",
        text: `Alocarea pe linii de business e in mare parte nefolosita: ${parts.join(" si ")} stau pe linia default. Orice rezultat pe linii e cosmetizat pana la alocare. Nu prezenta cifrele pe linii ca fiind concludente.`,
      });
    }
  }

  if (unmapped && unmapped.count > 0 && Math.abs(unmapped.rulaj) > 0) {
    flags.push({
      id: "conturi_nemapate",
      severity: "info",
      text: `${unmapped.count} conturi nemapate cu rulaj total ${fmtLei(unmapped.rulaj)}. Cifrele pe linii de cost sunt incomplete pana la mapare.`,
    });
  }

  // Margin drift: average of last 3 full months vs the 3 before them.
  const m = fullPoints.map((p) => p.marjaPct).filter((v): v is number => v !== null);
  const recent = avg(m.slice(-3));
  const before = avg(m.slice(-6, -3));
  let marjaTrend: DiagnosticResult["marjaTrend"] = null;
  if (recent !== null && before !== null) {
    const drift = recent - before;
    marjaTrend = drift > MARGIN_DRIFT_PP ? "in crestere" : drift < -MARGIN_DRIFT_PP ? "in scadere" : "stabila";
    if (marjaTrend === "in scadere") {
      flags.push({
        id: "marja_scade",
        severity: "atentie",
        text: `Marja e in scadere: media ${recent.toFixed(1)}% pe ultimele 3 luni fata de ${before.toFixed(1)}% pe cele 3 dinainte. Merita descompusa cauza (venituri vs linii de cost).`,
      });
    }
  }

  // Loss streak (P15 signal).
  let streak = 0;
  for (let i = fullPoints.length - 1; i >= 0 && fullPoints[i].rezultatBrut < 0; i--) streak++;
  if (streak >= 3) {
    flags.push({
      id: "pierderi_consecutive",
      severity: "alarma",
      text: `Rezultat negativ ${streak} luni la rand. Tiparul cere analiza acum, cat optiunile sunt deschise, nu inca o luna de monitorizare.`,
    });
  }

  // Receivables pressure relative to monthly invoicing.
  const avgRev = avg(fullPoints.slice(-6).map((p) => p.venituri));
  if (avgRev !== null && avgRev > 0 && kpis.clientiCreante > RECEIVABLE_MONTHS_WATCH * avgRev) {
    const months = round2(kpis.clientiCreante / avgRev);
    flags.push({
      id: "creante_mari",
      severity: "atentie",
      text: `Clientii datoreaza ${fmtLei(kpis.clientiCreante)}, echivalentul a ~${months.toFixed(1)} luni de facturare. Banii castigati exista, dar nu sunt inca in cont.`,
    });
  }

  // Month-over-month exceptions on the last two comparable points.
  const cmp = fullPoints.slice(-2);
  if (cmp.length === 2) {
    const [prev, cur] = cmp;
    const ytdRev = kpis.totalVenituri;
    for (const [id, label, d, ref] of [
      ["venituri_variatie", "Veniturile", cur.venituri - prev.venituri, prev.venituri],
      ["cheltuieli_variatie", "Cheltuielile", cur.cheltuieli - prev.cheltuieli, prev.cheltuieli],
    ] as const) {
      if (isException(d, ref, ytdRev)) {
        const dir = d > 0 ? "au crescut cu" : "au scazut cu";
        flags.push({
          id,
          severity: "info",
          text: `${label} lunii ${monthLabel(cur.year, cur.month)} ${dir} ${fmtLei(Math.abs(d))} (${Math.abs(round2((d / ref) * 100))}%) fata de ${monthLabel(prev.year, prev.month)}. Cauza merita numita inainte de orice comentariu.`,
        });
      }
    }
  }

  if (employee && employee.staleMonths > 0) {
    flags.push({
      id: "angajati_neactualizati",
      severity: "info",
      text: `Numarul de angajati e cunoscut pana in ${monthLabel(employee.year, employee.month)} (${employee.count}). Pentru calcule per angajat foloseste aceasta ultima valoare si spune-o intr-o singura fraza; nu transforma lipsa intr-o recomandare separata.`,
    });
  }

  const order: Record<FlagSeverity, number> = { alarma: 0, atentie: 1, info: 2 };
  flags.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    flags,
    burnLunar: burn !== null ? round2(burn) : null,
    runwayLuni: runway,
    marjaTrend,
    lunaPartialaSuspecta,
  };
}
