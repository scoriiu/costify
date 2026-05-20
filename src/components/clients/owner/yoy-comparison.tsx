/**
 * Year-over-year compact strip: 4 metrics, each with current value and
 * the absolute + percent change from "same month one year ago".
 *
 * Hidden entirely when no prior-year data exists (hasPreviousYear=false).
 */

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { YearOverYearComparison } from "@/modules/reporting/owner";
import { lei, pctSigned } from "@/lib/owner-format";

interface Props {
  yoy: YearOverYearComparison;
}

type YoyKey = "revenue" | "expenses" | "profit" | "cashEnd";

interface MetricSlot {
  key: YoyKey;
  label: string;
  /** A delta in this direction is good (e.g. revenue up = good, expenses up = bad). */
  goodWhen: "increase" | "decrease";
}

const METRICS: MetricSlot[] = [
  { key: "revenue", label: "Vanzari", goodWhen: "increase" },
  { key: "expenses", label: "Cheltuieli", goodWhen: "decrease" },
  { key: "profit", label: "Profit", goodWhen: "increase" },
  { key: "cashEnd", label: "Cash la final", goodWhen: "increase" },
];

export function YoyComparison({ yoy }: Props) {
  if (!yoy.hasPreviousYear) return null;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="mb-4">
        <h3
          className="text-[16px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Comparat cu aceeasi luna anul trecut
        </h3>
        <p
          className="mt-1 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Vezi rapid daca firma a evoluat mai bine sau mai slab fata de aceeasi perioada in trecut.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {METRICS.map((slot) => (
          <YoySlot key={slot.key} slot={slot} data={yoy[slot.key]} />
        ))}
      </div>
    </div>
  );
}

function YoySlot({
  slot,
  data,
}: {
  slot: MetricSlot;
  data: { current: number; previous: number; delta: number; deltaPct: number | null };
}) {
  let tone: "positive" | "negative" | "neutral" = "neutral";
  if (data.delta !== 0) {
    const direction = data.delta > 0 ? "increase" : "decrease";
    tone = direction === slot.goodWhen ? "positive" : "negative";
  }

  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
      ? "text-rose-300"
      : "text-gray";

  const Icon = data.delta > 0 ? ArrowUp : data.delta < 0 ? ArrowDown : Minus;

  return (
    <div>
      <p
        className="font-mono text-[10px] uppercase tracking-wider text-gray"
        aria-hidden
      >
        {slot.label}
      </p>
      <p
        className="mt-1 font-mono text-[18px] text-white tabular-nums"
        style={{ letterSpacing: "-0.04em" }}
      >
        {lei(data.current)}
      </p>
      <p
        className={`mt-1 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums ${toneClass}`}
      >
        <Icon size={10} />
        {pctSigned(data.deltaPct)}
        <span className="text-gray font-mono">
          ({lei(Math.abs(data.delta))})
        </span>
      </p>
    </div>
  );
}
