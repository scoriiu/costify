"use client";

/**
 * CashflowWaterfall — answers "cum am ajuns de la X la Y in bani luna asta?"
 *
 * Visual: a waterfall of 4 bars connected by step-down/step-up lines.
 *   1. Bani la inceput   (neutral, full opacity)
 *   2. + Venituri        (green, floating up from cumulative)
 *   3. - Cheltuieli      (red, floating down from cumulative)
 *   4. Bani la final     (neutral, full opacity)
 *
 * Each "delta" bar (venituri, cheltuieli) hovers between the running totals,
 * so the antreprenor sees physically WHERE the money went. Hover any bar for
 * the exact number and a one-line story sentence.
 *
 * Hand-rolled SVG — recharts doesn't have a clean waterfall primitive and we
 * want pixel-perfect control over the floating bars.
 */

import { useMemo, useState } from "react";
import { Waves } from "lucide-react";
import type { MonthlyTrendPoint } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface CashflowWaterfallProps {
  /** Last 12 months of trend data. We use the last point's revenue/expenses
   *  and the previous point's cashEnd to compute the start cash. */
  trends: MonthlyTrendPoint[];
}

interface Step {
  key: "start" | "revenue" | "expenses" | "end";
  label: string;
  /** Absolute value the bar renders. For start/end this is the cumulative
   *  cash; for revenue/expenses it is the magnitude of the delta. */
  value: number;
  /** For the floating bars (revenue/expenses), the y range they occupy in
   *  the running-total domain. */
  range: [number, number];
  tone: "neutral" | "pos" | "neg";
  story: string;
}

export function CashflowWaterfall({ trends }: CashflowWaterfallProps) {
  const steps = useMemo<Step[] | null>(() => computeSteps(trends), [trends]);
  const [hovered, setHovered] = useState<Step["key"] | null>(null);

  if (!steps) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-6">
        <Header />
        <p
          className="mt-4 text-[13px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nu sunt inca date suficiente pentru a urmari miscarea de bani in luna
          curenta. Verifica dupa primul upload de jurnal.
        </p>
      </div>
    );
  }

  const periodLabel = trends[trends.length - 1].monthLabel;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3 flex flex-wrap items-baseline justify-between gap-3">
        <Header />
        <span
          className="font-mono text-[11px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          {periodLabel}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        <WaterfallSvg steps={steps} hovered={hovered} setHovered={setHovered} />

        {/* One-line story for the hovered step, defaults to summary. */}
        <p
          className="mt-4 text-[13px] text-gray-light min-h-[20px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {hovered
            ? steps.find((s) => s.key === hovered)?.story
            : summaryStory(steps)}
        </p>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h3
        className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
        style={{ letterSpacing: "-0.04em" }}
      >
        <Waves size={15} className="text-primary" />
        Cum s-au miscat banii luna asta
      </h3>
      <p
        className="mt-0.5 text-[12px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        De la cati bani aveai la inceputul lunii, pana la cati ai acum.
      </p>
    </div>
  );
}

function WaterfallSvg({
  steps,
  hovered,
  setHovered,
}: {
  steps: Step[];
  hovered: Step["key"] | null;
  setHovered: (key: Step["key"] | null) => void;
}) {
  const W = 720;
  const H = 260;
  const padding = { top: 28, right: 16, bottom: 56, left: 16 };
  const innerW = W - padding.left - padding.right;
  const innerH = H - padding.top - padding.bottom;
  const barWidth = innerW / steps.length - 24;

  // Domain — covers from 0 (or the min of any range) to the max cumulative.
  const allValues = steps.flatMap((s) => [s.range[0], s.range[1]]);
  const dataMin = Math.min(0, ...allValues);
  const dataMax = Math.max(...allValues, 1);
  const range = dataMax - dataMin || 1;

  function yFor(v: number): number {
    return padding.top + innerH - ((v - dataMin) / range) * innerH;
  }

  function xFor(i: number): number {
    const slot = innerW / steps.length;
    return padding.left + slot * i + (slot - barWidth) / 2;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Miscarea banilor in luna curenta"
    >
      {/* Subtle horizontal gridline at 0 */}
      <line
        x1={padding.left}
        x2={W - padding.right}
        y1={yFor(0)}
        y2={yFor(0)}
        stroke="var(--color-dark-3)"
        strokeWidth={1}
      />

      {/* Connector segments between bars — dashed, muted */}
      {steps.slice(0, -1).map((step, i) => {
        const next = steps[i + 1];
        // Connector goes from top of current step's range to top of next step's range.
        const x1 = xFor(i) + barWidth;
        // For "delta" bars, the connector continues from the previous total's running line.
        const y1 = yFor(step.range[1]);
        const x2 = xFor(i + 1);
        const y2 = yFor(next.range[1]);
        return (
          <line
            key={`conn-${i}`}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
            stroke="var(--color-gray)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        );
      })}

      {/* Bars */}
      {steps.map((step, i) => {
        const yTop = yFor(Math.max(step.range[0], step.range[1]));
        const yBot = yFor(Math.min(step.range[0], step.range[1]));
        const x = xFor(i);
        const fill =
          step.tone === "pos"
            ? "var(--color-pos)"
            : step.tone === "neg"
              ? "var(--color-neg)"
              : "var(--color-primary)";
        const isHovered = hovered === step.key;
        const opacity = hovered === null ? 1 : isHovered ? 1 : 0.45;
        return (
          <g
            key={step.key}
            onMouseEnter={() => setHovered(step.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={x}
              y={yTop}
              width={barWidth}
              height={Math.max(2, yBot - yTop)}
              rx={4}
              ry={4}
              fill={fill}
              opacity={opacity}
            />
            {/* Top value label */}
            <text
              x={x + barWidth / 2}
              y={yTop - 8}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={12}
              fontWeight={600}
              fill="var(--color-white)"
              opacity={opacity}
            >
              {step.key === "revenue" ? "+ " : step.key === "expenses" ? "− " : ""}
              {lei(step.value)}
            </text>
            {/* Bottom label (step name) */}
            <text
              x={x + barWidth / 2}
              y={H - padding.bottom + 18}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={10.5}
              fill="var(--color-gray)"
              opacity={opacity}
              style={{ letterSpacing: "0.02em", textTransform: "uppercase" }}
            >
              {step.label}
            </text>
          </g>
        );
      })}

      {/* Bottom hint */}
      <text
        x={W / 2}
        y={H - padding.bottom + 38}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        fill="var(--color-gray)"
        opacity={0.7}
      >
        ───── treci cu mouse-ul peste fiecare bar pentru detalii ─────
      </text>
    </svg>
  );
}

function computeSteps(trends: MonthlyTrendPoint[]): Step[] | null {
  if (trends.length === 0) return null;
  const last = trends[trends.length - 1];
  const prev = trends.length > 1 ? trends[trends.length - 2] : null;

  // Start = previous month's end (or end - revenue + expenses for the very
  // first available month).
  const start = prev ? prev.cashEnd : last.cashEnd - last.revenue + last.expenses;
  const afterRevenue = start + last.revenue;
  const end = afterRevenue - last.expenses;

  return [
    {
      key: "start",
      label: "Inceput luna",
      value: start,
      range: [0, start],
      tone: "neutral",
      story: `La inceputul lunii aveai ${lei(start)} in conturi si casierie.`,
    },
    {
      key: "revenue",
      label: "Incasari",
      value: last.revenue,
      range: [start, afterRevenue],
      tone: "pos",
      story: `Ai incasat ${lei(last.revenue)} luna asta — bani care au intrat in firma din vanzari, clienti, alte surse.`,
    },
    {
      key: "expenses",
      label: "Plati",
      value: last.expenses,
      range: [afterRevenue, end],
      tone: "neg",
      story: `Ai platit ${lei(last.expenses)} luna asta — salarii, furnizori, chirie si alte cheltuieli.`,
    },
    {
      key: "end",
      label: "Final luna",
      value: end,
      range: [0, end],
      tone: "neutral",
      story: `La sfarsitul lunii ai ${lei(end)} — diferenta de ${end >= start ? "+" : ""}${lei(end - start)} fata de cum ai inceput.`,
    },
  ];
}

function summaryStory(steps: Step[]): string {
  const start = steps[0].value;
  const end = steps[3].value;
  const delta = end - start;
  if (Math.abs(delta) < 1) {
    return "Ai inceput si ai terminat luna cu suma asemanatoare in conturi.";
  }
  if (delta > 0) {
    return `Luna asta ai crescut cu ${lei(delta)} in conturi — venituri peste cheltuieli.`;
  }
  return `Luna asta ai consumat ${lei(Math.abs(delta))} din rezerva — cheltuieli peste venituri.`;
}

