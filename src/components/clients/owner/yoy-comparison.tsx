"use client";

/**
 * Year-over-year comparison — paired horizontal bars per metric.
 *
 * Each metric (vanzari, cheltuieli, profit, cash) shows two bars:
 *   - Top bar (filled): anul curent
 *   - Bottom bar (muted): anul trecut
 * Both scaled to the same max so the visual delta is honest.
 *
 * Tone of the delta badge follows the rule per metric:
 *   - revenue / profit / cash: up = good (green), down = bad (red)
 *   - expenses: up = bad (red), down = good (green)
 *
 * Hidden entirely when no prior-year data exists.
 */

import { ArrowUp, ArrowDown, Minus, CalendarRange } from "lucide-react";
import type { YearOverYearComparison } from "@/modules/reporting/owner";
import { lei, pctSigned } from "@/lib/owner-format";
import { ChartInfo } from "./chart-info";

interface Props {
  yoy: YearOverYearComparison;
}

type YoyKey = "revenue" | "expenses" | "profit" | "cashEnd";

interface MetricSlot {
  key: YoyKey;
  label: string;
  goodWhen: "increase" | "decrease";
}

const METRICS: MetricSlot[] = [
  { key: "revenue", label: "Vanzari", goodWhen: "increase" },
  { key: "expenses", label: "Cheltuieli", goodWhen: "decrease" },
  { key: "profit", label: "Profit", goodWhen: "increase" },
  { key: "cashEnd", label: "Bani la final", goodWhen: "increase" },
];

export function YoyComparison({ yoy }: Props) {
  if (!yoy.hasPreviousYear) return null;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3
          className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          <CalendarRange size={15} className="text-primary" />
          Cum stai fata de aceeasi luna anul trecut
          <ChartInfo text="Compara luna asta cu exact aceeasi luna de anul trecut. Se compara aceeasi luna ca sa nu te insele sezonul: decembrie se compara tot cu decembrie, nu cu noiembrie. Verde inseamna mai bine decat anul trecut, rosu mai slab." />
        </h3>
        <p
          className="mt-0.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Bara plina = anul acesta. Bara mata = anul trecut. Asa vezi imediat
          daca firma evolueaza in bine.
        </p>
      </div>
      <div className="divide-y divide-dark-3">
        {METRICS.map((slot) => (
          <YoyRow key={slot.key} slot={slot} data={yoy[slot.key]} />
        ))}
      </div>
    </div>
  );
}

function YoyRow({
  slot,
  data,
}: {
  slot: MetricSlot;
  data: { current: number; previous: number; delta: number; deltaPct: number | null };
}) {
  const max = Math.max(Math.abs(data.current), Math.abs(data.previous), 1);
  const currPct = (Math.abs(data.current) / max) * 100;
  const prevPct = (Math.abs(data.previous) / max) * 100;

  let tone: "positive" | "negative" | "neutral" = "neutral";
  if (data.delta !== 0) {
    const direction = data.delta > 0 ? "increase" : "decrease";
    tone = direction === slot.goodWhen ? "positive" : "negative";
  }

  const Icon = data.delta > 0 ? ArrowUp : data.delta < 0 ? ArrowDown : Minus;
  const toneText =
    tone === "positive" ? "text-pos" : tone === "negative" ? "text-neg" : "text-gray";
  const barColor =
    tone === "positive"
      ? "bg-pos"
      : tone === "negative"
        ? "bg-neg"
        : "bg-primary";

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <span
          className="text-[13px] text-white font-medium"
          style={{ letterSpacing: "-0.02em" }}
        >
          {slot.label}
        </span>
        <span
          className={`inline-flex items-center gap-1 font-mono text-[12px] font-semibold tabular-nums ${toneText}`}
        >
          <Icon size={11} />
          {pctSigned(data.deltaPct)}
          <span className="text-gray font-normal">
            ({data.delta >= 0 ? "+" : "−"}
            {lei(Math.abs(data.delta))})
          </span>
        </span>
      </div>

      <div className="space-y-2">
        <PairedBar
          label="Acum"
          value={data.current}
          widthPct={currPct}
          colorClass={barColor}
          isPrimary
        />
        <PairedBar
          label="Anul trecut"
          value={data.previous}
          widthPct={prevPct}
          colorClass="bg-dark-3"
        />
      </div>
    </div>
  );
}

function PairedBar({
  label,
  value,
  widthPct,
  colorClass,
  isPrimary,
}: {
  label: string;
  value: number;
  widthPct: number;
  colorClass: string;
  isPrimary?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-[10px] uppercase tracking-wider text-gray w-20 shrink-0"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
      <div className="flex-1 h-3 rounded-full bg-dark-3/50 overflow-hidden relative">
        <div
          className={`h-full ${colorClass} rounded-full transition-[width] duration-700 ease-out`}
          style={{
            width: `${widthPct}%`,
            opacity: isPrimary ? 1 : 0.55,
          }}
        />
      </div>
      <span
        className={`font-mono text-[12px] tabular-nums shrink-0 w-24 text-right ${
          isPrimary ? "text-white" : "text-gray-light"
        }`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {lei(value)}
      </span>
    </div>
  );
}
