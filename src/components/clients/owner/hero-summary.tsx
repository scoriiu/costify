"use client";

/**
 * HeroSummary — the firma's opening line.
 *
 * Replaces a flat 4-card grid with a hero composition that puts CASH (the
 * antreprenor's primary anxiety: "cati bani am acum?") in the center, with
 * three supporting metrics arranged around it. Each block is fully
 * clickable and links to its detail page.
 *
 * Visual hierarchy:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  BANI IN CASA SI BANCA           [in crestere/scadere]  │
 *   │  142.300 lei                                           │
 *   │  cu 12.400 lei mai mult ca luna trecuta (+9%)          │
 *   │  ──── 6-month spark ────                                │
 *   ├──────────────┬───────────────┬──────────────────────────┤
 *   │ De primit    │ De platit     │ Profit anul acesta      │
 *   │ 48.200 lei   │ 21.500 lei    │ 195.400 lei (24% marja) │
 *   │ 7 clienti    │ 4 furnizori   │ ▲ 12% vs anul trecut    │
 *   └──────────────┴───────────────┴──────────────────────────┘
 */

import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import type {
  FinancialSummary,
  MonthlyTrendPoint,
  YearOverYearComparison,
} from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface HeroSummaryProps {
  summary: FinancialSummary;
  trends: MonthlyTrendPoint[];
  outstandingClientiCount: number;
  outstandingFurnizoriCount: number;
  yoy: YearOverYearComparison;
  marjaOperationala: number | null;
}

export function HeroSummary({
  summary,
  trends,
  outstandingClientiCount,
  outstandingFurnizoriCount,
  yoy,
  marjaOperationala,
}: HeroSummaryProps) {
  const totalCash = summary.soldRegistruCasa + summary.soldConturiBancare;
  const profitYtd = summary.cifraAfaceriTotal - summary.cheltuieliTotal;

  // Trend deltas for the hero number — vs the previous month, computed
  // from the last two trend points.
  const cashDelta = computeCashDelta(trends);

  // YoY profit delta — used as supplementary signal under profit metric.
  const profitYoy = yoy.hasPreviousYear ? yoy.profit : null;

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 overflow-hidden">
      {/* Hero: cash — anchor jumps to the cashflow waterfall below */}
      <a
        href="#cashflow"
        className="block group relative px-6 sm:px-8 pt-6 pb-7 border-b border-dark-3 hover:bg-dark-3/20 transition-colors"
      >
        <CashHero
          totalCash={totalCash}
          casa={summary.soldRegistruCasa}
          banca={summary.soldConturiBancare}
          delta={cashDelta}
          spark={trends.slice(-6).map((t) => t.cashEnd)}
          sparkLabels={trends.slice(-6).map((t) => t.monthLabel)}
        />
        <ArrowRight
          size={16}
          className="absolute top-6 right-6 text-gray opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      </a>

      {/* Three supporting metrics — anchors jump to the matching section below */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-dark-3">
        <SecondaryMetric
          href="#parteneri"
          icon={<ArrowDownLeft size={14} />}
          label="De primit de la clienti"
          value={lei(summary.clientiNeincasati)}
          helper={
            outstandingClientiCount === 0
              ? "Toata lumea a platit la zi"
              : `${outstandingClientiCount} ${outstandingClientiCount === 1 ? "client" : "clienti"} cu facturi neincasate`
          }
          spark={trends.slice(-6).map((t) => t.receivables)}
        />
        <SecondaryMetric
          href="#parteneri"
          icon={<ArrowUpRight size={14} />}
          label="De platit furnizorilor"
          value={lei(summary.furnizoriNeachitati)}
          helper={
            outstandingFurnizoriCount === 0
              ? "Esti la zi cu toata lumea"
              : `${outstandingFurnizoriCount} ${outstandingFurnizoriCount === 1 ? "furnizor" : "furnizori"} cu facturi neplatite`
          }
          spark={trends.slice(-6).map((t) => t.payables)}
        />
        <SecondaryMetric
          href="#profit"
          icon={<TrendingUp size={14} />}
          label="Profit anul acesta"
          value={lei(profitYtd)}
          valueTone={profitYtd >= 0 ? "positive" : "negative"}
          helper={
            marjaOperationala !== null
              ? `Marja ${marjaOperationala.toFixed(1)}% din vanzari`
              : profitYtd >= 0
                ? "Firma e pe plus"
                : "Firma e pe minus"
          }
          yoyDelta={profitYoy}
          spark={trends.slice(-6).map((t) => t.profit)}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Cash hero block ---------------------------- */

function CashHero({
  totalCash,
  casa,
  banca,
  delta,
  spark,
  sparkLabels,
}: {
  totalCash: number;
  casa: number;
  banca: number;
  delta: { value: number; pct: number | null; previousLabel: string } | null;
  spark: number[];
  sparkLabels: string[];
}) {
  const direction = delta
    ? delta.value > 0
      ? "up"
      : delta.value < 0
        ? "down"
        : "flat"
    : "flat";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4 pr-8 sm:pr-10">
        <div>
          <p
            className="font-mono text-[11px] uppercase tracking-wider text-gray inline-flex items-center gap-2"
            style={{ letterSpacing: "0.04em" }}
          >
            <Wallet size={13} className="text-primary" />
            Bani in casa si banca
          </p>
          <p
            className="mt-2 font-mono text-[44px] sm:text-[52px] font-semibold text-white leading-none tabular-nums"
            style={{ letterSpacing: "-0.04em" }}
          >
            {lei(totalCash)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <CashSubItem label="In conturi" value={banca} />
            <span className="text-gray text-[10px]">·</span>
            <CashSubItem label="In casierie" value={casa} />
          </div>
        </div>

        {delta && (
          <DeltaPill direction={direction} delta={delta} />
        )}
      </div>

      {spark.length >= 2 && <BigSparkline values={spark} labels={sparkLabels} />}
    </div>
  );
}

function CashSubItem({ label, value }: { label: string; value: number }) {
  return (
    <span
      className="text-[12px] text-gray-light font-mono tabular-nums"
      style={{ letterSpacing: "-0.02em" }}
    >
      <span className="text-gray">{label}</span> {lei(value)}
    </span>
  );
}

function DeltaPill({
  direction,
  delta,
}: {
  direction: "up" | "down" | "flat";
  delta: { value: number; pct: number | null; previousLabel: string };
}) {
  if (direction === "flat") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-dark-3 bg-dark-3/40 px-3 py-1 font-mono text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        <Minus size={11} /> Stabil
      </span>
    );
  }
  const isUp = direction === "up";
  const Icon = isUp ? ArrowUp : ArrowDown;
  const cls = isUp
    ? "border-pos/30 bg-pos/[0.08] text-pos"
    : "border-neg/30 bg-neg/[0.08] text-neg";
  return (
    <div className="flex flex-col items-end">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tabular-nums ${cls}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        <Icon size={11} />
        {delta.pct !== null
          ? `${isUp ? "+" : ""}${delta.pct.toFixed(0)}%`
          : "nou"}
      </span>
      <span
        className="mt-1 text-[10px] text-gray font-mono"
        style={{ letterSpacing: "-0.02em" }}
      >
        {isUp ? "+" : "-"}
        {lei(Math.abs(delta.value))} vs {delta.previousLabel}
      </span>
    </div>
  );
}

function BigSparkline({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  // Interactive hero spark: hover any month → readout above the line shows
  // the month + the exact cash value at that point. Cursor crosshair stays
  // anchored to the closest data point so the readout always feels precise.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const w = 720;
  const h = 72;
  const padY = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const xs = values.map((_, i) => i * stepX);
  const ys = values.map((v) => h - ((v - min) / range) * (h - padY * 2) - padY);
  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`;

  const active = hoverIdx !== null ? hoverIdx : values.length - 1;
  const activeLabel = labels[active] ?? "";
  const activeValue = values[active];

  function onMove(evt: React.MouseEvent<SVGSVGElement>) {
    const rect = evt.currentTarget.getBoundingClientRect();
    const rel = (evt.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(rel * (values.length - 1))));
    setHoverIdx(i);
  }

  return (
    <div className="relative">
      {/* Floating readout */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Ultimele 6 luni{hoverIdx !== null ? ` · ${activeLabel}` : ""}
        </span>
        <span
          className="font-mono text-[12px] text-gray-light tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          {lei(activeValue)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-14 sm:h-16 cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label={`Cash la finalul ultimelor ${values.length} luni`}
      >
        <defs>
          <linearGradient id="hero-cash-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#hero-cash-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Crosshair on hover */}
        {hoverIdx !== null && (
          <>
            <line
              x1={xs[hoverIdx]}
              x2={xs[hoverIdx]}
              y1={0}
              y2={h}
              stroke="var(--color-primary)"
              strokeOpacity={0.4}
              strokeDasharray="2 3"
              strokeWidth={1}
            />
            <circle
              cx={xs[hoverIdx]}
              cy={ys[hoverIdx]}
              r={5}
              fill="var(--color-primary)"
              stroke="var(--color-dark-2)"
              strokeWidth={2}
            />
          </>
        )}
        {/* Default endpoint dot (when not hovering) */}
        {hoverIdx === null && (
          <circle
            cx={xs[xs.length - 1]}
            cy={ys[ys.length - 1]}
            r={4}
            fill="var(--color-primary)"
            stroke="var(--color-dark-2)"
            strokeWidth={2}
          />
        )}
      </svg>
    </div>
  );
}

/* ---------------------------- Secondary metric ---------------------------- */

function SecondaryMetric({
  href,
  icon,
  label,
  value,
  valueTone,
  helper,
  spark,
  yoyDelta,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  valueTone?: "positive" | "negative";
  helper: string;
  spark: number[];
  yoyDelta?: { delta: number; deltaPct: number | null } | null;
}) {
  const valueClass =
    valueTone === "positive"
      ? "text-pos"
      : valueTone === "negative"
        ? "text-neg"
        : "text-white";
  return (
    <a
      href={href}
      className="group relative block px-5 sm:px-6 py-5 hover:bg-dark-3/20 transition-colors"
    >
      <p
        className="font-mono text-[10px] uppercase tracking-wider text-gray inline-flex items-center gap-1.5"
        style={{ letterSpacing: "0.04em" }}
      >
        <span className="text-gray">{icon}</span>
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p
          className={`font-mono text-[22px] sm:text-[24px] font-semibold tabular-nums leading-none ${valueClass}`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {value}
        </p>
        {spark.length >= 2 && <MiniSpark values={spark} tone={valueTone} />}
      </div>
      <p
        className="mt-2 text-[11px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        {helper}
      </p>
      {yoyDelta && yoyDelta.deltaPct !== null && (
        <YoyMiniDelta
          deltaPct={yoyDelta.deltaPct}
          delta={yoyDelta.delta}
          goodWhenUp
        />
      )}
      <ArrowRight
        size={13}
        className="absolute top-5 right-5 text-gray opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
    </a>
  );
}

function MiniSpark({
  values,
  tone,
}: {
  values: number[];
  tone?: "positive" | "negative";
}) {
  const w = 64;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const d = values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke =
    tone === "positive"
      ? "var(--color-pos)"
      : tone === "negative"
        ? "var(--color-neg)"
        : "var(--color-primary)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="shrink-0 opacity-80"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YoyMiniDelta({
  deltaPct,
  delta,
  goodWhenUp,
}: {
  deltaPct: number;
  delta: number;
  goodWhenUp: boolean;
}) {
  if (Math.abs(deltaPct) < 0.5) return null;
  const isUp = deltaPct > 0;
  const Icon = isUp ? ArrowUp : ArrowDown;
  const cls = (isUp && goodWhenUp) || (!isUp && !goodWhenUp) ? "text-pos" : "text-neg";
  return (
    <span
      className={`mt-1.5 inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums ${cls}`}
      style={{ letterSpacing: "-0.02em" }}
      title={`Diferenta fata de anul trecut: ${isUp ? "+" : "-"}${lei(Math.abs(delta))}`}
    >
      <Icon size={9} />
      {Math.abs(deltaPct).toFixed(0)}% vs anul trecut
    </span>
  );
}

/* ---------------------------------- Helpers ------------------------------- */

function computeCashDelta(
  trends: MonthlyTrendPoint[]
): { value: number; pct: number | null; previousLabel: string } | null {
  if (trends.length < 2) return null;
  const last = trends[trends.length - 1];
  const prev = trends[trends.length - 2];
  const value = last.cashEnd - prev.cashEnd;
  let pct: number | null = null;
  if (prev.cashEnd !== 0) {
    pct = (value / Math.abs(prev.cashEnd)) * 100;
  }
  return { value, pct, previousLabel: prev.monthLabel };
}
