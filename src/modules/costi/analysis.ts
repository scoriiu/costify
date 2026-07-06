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
