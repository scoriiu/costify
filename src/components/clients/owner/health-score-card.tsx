/**
 * HealthScoreCard — §10 composite score 0-100 + 4 subscore tiles.
 *
 * Left: big circular gauge with the composite score and a tier label.
 * Right: 4 sub-scores (Lichiditate / Profitabilitate / Eficienta / Solvabilitate)
 * with mini progress bars and a one-line explanation each.
 *
 * The card is self-contained — clicking a subscore could later open its detail
 * sheet, but for now hovering shows a tooltip with the formula context.
 */

import type { HealthScore, HealthSubscore } from "@/modules/reporting/owner";
import { ChartInfo } from "./chart-info";

const TIER_RING: Record<HealthScore["tier"], { ring: string; text: string; bg: string }> = {
  excellent: { ring: "stroke-green", text: "text-green", bg: "bg-green/10" },
  good: { ring: "stroke-primary", text: "text-primary", bg: "bg-primary/10" },
  watch: { ring: "stroke-warn", text: "text-warn", bg: "bg-warn/10" },
  alert: { ring: "stroke-danger", text: "text-danger", bg: "bg-danger/10" },
};

const STATE_BAR: Record<HealthSubscore["state"], string> = {
  good: "bg-green",
  neutral: "bg-primary/60",
  warn: "bg-warn",
  danger: "bg-danger",
};

const STATE_TEXT: Record<HealthSubscore["state"], string> = {
  good: "text-green",
  neutral: "text-white",
  warn: "text-warn",
  danger: "text-danger",
};

interface HealthScoreCardProps {
  data: HealthScore;
}

export function HealthScoreCard({ data }: HealthScoreCardProps) {
  const tierStyles = TIER_RING[data.tier];

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-6 sm:p-7">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
        {/* Left: gauge */}
        <div className="flex flex-col items-center gap-3 lg:items-start">
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gray"
            style={{ letterSpacing: "0.08em" }}
          >
            Scor sanatate firma
            <ChartInfo text="Nota generala a firmei, de la 0 la 100, ca o medie la scoala. E calculata din 4 zone: banii disponibili, profitul, datoriile si incasarile de la clienti. Peste 70 inseamna ca firma sta bine. Sub 40 inseamna ca o zona are nevoie de atentie. Fiecare zona are scorul ei, afisat alaturi." />
          </span>
          <Gauge score={data.score} ringClass={tierStyles.ring} textClass={tierStyles.text} />
          <div className="flex flex-col items-center gap-1 lg:items-start">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase ${tierStyles.bg} ${tierStyles.text}`}
              style={{ letterSpacing: "0.04em" }}
            >
              {data.tierLabel}
            </span>
            <p
              className="text-center text-[12px] text-gray-light lg:text-left max-w-[240px]"
              style={{ letterSpacing: "-0.02em" }}
            >
              {data.message}
            </p>
          </div>
        </div>

        {/* Right: subscores */}
        <div className="space-y-3">
          {data.subscores.map((s) => (
            <SubscoreRow key={s.id} subscore={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Gauge({
  score,
  ringClass,
  textClass,
}: {
  score: number;
  ringClass: string;
  textClass: string;
}) {
  const radius = 78;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle
          cx={100}
          cy={100}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-dark-3"
        />
        <circle
          cx={100}
          cy={100}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${ringClass} transition-all duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-mono text-[48px] font-semibold leading-none ${textClass}`}
          style={{ letterSpacing: "-0.06em" }}
        >
          {score}
        </span>
        <span
          className="font-mono text-[10px] uppercase text-gray mt-1"
          style={{ letterSpacing: "0.08em" }}
        >
          din 100
        </span>
      </div>
    </div>
  );
}

function SubscoreRow({ subscore }: { subscore: HealthSubscore }) {
  return (
    <div className="rounded-xl border border-dark-3/60 bg-dark-3/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="font-mono text-[11px] font-semibold uppercase text-gray-light"
          style={{ letterSpacing: "-0.04em" }}
        >
          {subscore.label}
        </span>
        <span
          className={`font-mono text-[16px] font-semibold tabular-nums ${STATE_TEXT[subscore.state]}`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {subscore.score}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-dark-3">
        <div
          className={`h-full rounded-full ${STATE_BAR[subscore.state]} transition-all duration-700`}
          style={{ width: `${Math.max(2, subscore.score)}%` }}
        />
      </div>
      <p
        className="mt-2 text-[12px] text-gray-light leading-relaxed"
        style={{ letterSpacing: "-0.02em" }}
      >
        {subscore.message}
      </p>
    </div>
  );
}
