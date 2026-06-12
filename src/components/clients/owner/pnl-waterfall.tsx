/**
 * PnlWaterfall — §9 stepped P&L visualization.
 *
 * Modern waterfall chart that walks from Venituri → Costuri operationale →
 * Profit operational → Cheltuieli financiare → Impozit → Profit net.
 *
 * Each step is a flat horizontal bar with a vertical connector to the next.
 * Heights are normalized to the maximum positive value (Venituri usually) so
 * the visual scale is honest.
 *
 * No external dependencies — hand-rolled SVG so we don't pull recharts for a
 * simple geometry that needs custom hover behavior.
 */

"use client";

import { useMemo } from "react";
import type { FinancialSummary, CategoryBreakdownItem } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";
import { ChartInfo } from "./chart-info";
import { Tooltip } from "@/components/ui/tooltip";

interface PnlWaterfallProps {
  summary: FinancialSummary;
  expenseBreakdown: CategoryBreakdownItem[];
}

interface Step {
  id: string;
  label: string;
  /** Signed value: positive = inflow / running profit, negative = outflow. */
  value: number;
  /** Running total after this step. */
  runningTotal: number;
  /** "in" | "out" | "total". */
  kind: "in" | "out" | "total";
  /** Helper one-liner. */
  hint: string;
}

function computeSteps(summary: FinancialSummary, expenseBreakdown: CategoryBreakdownItem[]): Step[] {
  // Use breakdown to split expenses into "operational" vs "financial+tax+exceptional".
  // codes 66 = dobanzi/financiare, 67 = exceptional, 69 = impozit profit
  const findCode = (prefix: string) => {
    const found = expenseBreakdown.find((b) => b.code === prefix || b.code.startsWith(`fallback:${prefix}`));
    return found ? Math.abs(found.value) : 0;
  };

  const venituri = summary.cifraAfaceriLuna;
  const financiare = findCode("66");
  const exceptionale = findCode("67");
  const impozit = findCode("69");
  const operationale = Math.max(0, summary.cheltuieliLuna - financiare - exceptionale - impozit);

  const steps: Step[] = [];
  let running = 0;

  steps.push({
    id: "venituri",
    label: "Venituri",
    value: venituri,
    runningTotal: (running += venituri),
    kind: "in",
    hint: "Tot ce a vandut firma luna asta: produse, servicii, alte venituri operationale.",
  });

  if (operationale > 0) {
    steps.push({
      id: "operationale",
      label: "Cheltuieli operationale",
      value: -operationale,
      runningTotal: (running -= operationale),
      kind: "out",
      hint: "Salarii, marfa, servicii, energie: costurile zilnice ale activitatii.",
    });
  }

  steps.push({
    id: "profitOp",
    label: "Profit operational",
    value: running,
    runningTotal: running,
    kind: "total",
    hint: "Cat ramane din venituri dupa costurile operationale.",
  });

  if (financiare > 0) {
    steps.push({
      id: "financiare",
      label: "Cheltuieli financiare",
      value: -financiare,
      runningTotal: (running -= financiare),
      kind: "out",
      hint: "Dobanzi la credite, diferente de curs, comisioane bancare semnificative.",
    });
  }

  if (exceptionale > 0) {
    steps.push({
      id: "exceptionale",
      label: "Cheltuieli exceptionale",
      value: -exceptionale,
      runningTotal: (running -= exceptionale),
      kind: "out",
      hint: "Lucruri rare: amenzi, pierderi neasteptate.",
    });
  }

  if (impozit > 0) {
    steps.push({
      id: "impozit",
      label: "Impozit pe profit",
      value: -impozit,
      runningTotal: (running -= impozit),
      kind: "out",
      hint: "Impozitul calculat (micro 1-3%, profit 16% sau alt regim).",
    });
  }

  steps.push({
    id: "profitNet",
    label: "Profit net",
    value: running,
    runningTotal: running,
    kind: "total",
    hint: "Cat ramane efectiv firmei din venituri, dupa toate cheltuielile si impozitele.",
  });

  return steps;
}

export function PnlWaterfall({ summary, expenseBreakdown }: PnlWaterfallProps) {
  const steps = useMemo(() => computeSteps(summary, expenseBreakdown), [summary, expenseBreakdown]);

  const maxAbs = Math.max(...steps.map((s) => Math.abs(s.value)), 1);

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <div className="mb-5">
        <h3
          className="inline-flex items-center gap-2 text-[16px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          De la venituri la profit
          <ChartInfo text="Porneste de la tot ce a incasat firma luna asta (prima bara) si scade, pas cu pas, fiecare tip de cheltuiala. Bara de la final e ce ramane: castig (verde) sau pierdere (rosu). Treci peste o bara ca sa vezi suma ei exacta." />
        </h3>
        <p
          className="mt-1 text-[12px] text-gray-light max-w-xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          Drumul banilor luna asta: porneste de la venituri si vezi cum se reduc, pas cu pas, pana la profitul net.
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <WaterfallRow key={step.id} step={step} maxAbs={maxAbs} />
        ))}
      </div>

      <div className="mt-5 border-t border-dark-3 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Footer label="Marja operationala" value={
          summary.cifraAfaceriLuna > 0
            ? `${(((summary.cifraAfaceriLuna - (summary.cheltuieliLuna)) / summary.cifraAfaceriLuna) * 100).toFixed(1)}%`
            : "—"
        } />
        <Footer label="Marja neta" value={
          summary.cifraAfaceriLuna > 0
            ? `${(((steps[steps.length - 1].runningTotal) / summary.cifraAfaceriLuna) * 100).toFixed(1)}%`
            : "—"
        } />
        <Footer label="Profit net" value={lei(steps[steps.length - 1].runningTotal)} tone={
          steps[steps.length - 1].runningTotal >= 0 ? "good" : "bad"
        } />
      </div>
    </div>
  );
}

function WaterfallRow({
  step,
  maxAbs,
}: {
  step: Step;
  maxAbs: number;
}) {
  const widthPct = (Math.abs(step.value) / maxAbs) * 100;
  const isPositive = step.value >= 0;

  const barColor =
    step.kind === "total"
      ? step.runningTotal >= 0
        ? "bg-primary"
        : "bg-danger"
      : isPositive
        ? "bg-green"
        : "bg-danger";

  const textColor =
    step.kind === "total"
      ? step.runningTotal >= 0
        ? "text-primary"
        : "text-danger"
      : isPositive
        ? "text-green"
        : "text-danger";

  // The hint used to be rendered inline below the label on hover. That made
  // every other row shift downward when the cursor entered — felt like a
  // layout bug. Now the hint lives in a Tooltip that portals out of the
  // flow, so hovering only changes the row's background tint, never its
  // height.
  return (
    <Tooltip content={step.hint} side="top" display="block">
      <div className="grid grid-cols-[180px_1fr_180px] items-center gap-3 rounded-lg px-3 py-2 transition-colors bg-dark-3/20 hover:bg-dark-3/60">
        <div className="min-w-0">
          <div
            className={`text-[13px] font-medium ${step.kind === "total" ? "text-white" : "text-gray-light"}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {step.label}
          </div>
        </div>

        <div className="h-7 flex items-center">
          <div className="h-full w-full bg-dark-3/40 rounded-md overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-500 ${step.kind === "total" ? "" : "opacity-90"}`}
              style={{ width: `${Math.max(2, widthPct)}%` }}
            />
          </div>
        </div>

        <div className="text-right">
          <div
            className={`font-mono text-[15px] font-semibold tabular-nums ${textColor}`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {step.kind === "out" && step.value < 0 ? "−" : isPositive ? "" : "−"}{lei(Math.abs(step.value))}
          </div>
          {step.kind !== "total" && (
            <div
              className="font-mono text-[10px] text-gray mt-0.5 tabular-nums"
              style={{ letterSpacing: "0.04em" }}
            >
              Rest: {lei(step.runningTotal)}
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

function Footer({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const colorClass = tone === "good" ? "text-green" : tone === "bad" ? "text-danger" : "text-white";
  return (
    <div>
      <div
        className="font-mono text-[10px] uppercase text-gray"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </div>
      <div
        className={`font-mono text-[16px] font-semibold tabular-nums mt-0.5 ${colorClass}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {value}
      </div>
    </div>
  );
}
