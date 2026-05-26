"use client";

/**
 * Evolution Chart — the firm's last 12 months as a story.
 *
 * Interactive composed chart: stacked area for revenue/expenses + line for
 * cash at month end. Top toolbar lets the antreprenor toggle series on/off
 * (vrei sa vezi doar veniturile? doar cash? click si filtrezi). A brush
 * underneath lets them zoom into a window. Tooltip shows the month with
 * delta vs the previous month for the active metrics.
 *
 * Visual logic:
 *   - Revenue: smooth teal area (positive, growing-good)
 *   - Expenses: salmon/red area, stacked under revenue
 *   - Cash line: amber/orange thick line on top with dots — the "north star"
 *   - Gridlines: ultra-subtle, only horizontal
 *   - Axis labels: mono, muted
 */

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { TrendingUp, ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { MonthlyTrendPoint } from "@/modules/reporting/owner";
import { lei, leiShort } from "@/lib/owner-format";

interface EvolutionChartProps {
  data: MonthlyTrendPoint[];
  /** When the user clicks a month in the chart, drill into that period.
   *  Optional — when undefined, clicking is a no-op (chart is read-only). */
  onSelectMonth?: (point: MonthlyTrendPoint) => void;
}

type SeriesKey = "revenue" | "expenses" | "cashEnd";

const SERIES_META: Record<
  SeriesKey,
  { label: string; color: string; tone: string }
> = {
  revenue: { label: "Venituri", color: "var(--color-pos)", tone: "text-pos" },
  expenses: { label: "Cheltuieli", color: "var(--color-neg)", tone: "text-neg" },
  cashEnd: { label: "Bani la final", color: "var(--color-primary)", tone: "text-primary" },
};

export function EvolutionChart({ data, onSelectMonth }: EvolutionChartProps) {
  const [active, setActive] = useState<Set<SeriesKey>>(
    new Set<SeriesKey>(["revenue", "expenses", "cashEnd"])
  );

  // Find the month with the highest cash — annotate it as a reference point.
  const peakCash = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((max, p) => (p.cashEnd > max.cashEnd ? p : max), data[0]);
  }, [data]);

  // Index per month for delta computation in the tooltip.
  const indexByMonth = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((d, i) => m.set(d.monthLabel, i));
    return m;
  }, [data]);

  function toggle(key: SeriesKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't allow turning all 3 off — chart would be empty.
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-8">
        <ChartHeader />
        <p
          className="mt-4 text-[13px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nu sunt inca date pentru ultimele luni.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3 flex flex-wrap items-baseline justify-between gap-3">
        <ChartHeader />
        <div className="flex items-center gap-1.5">
          {(Object.keys(SERIES_META) as SeriesKey[]).map((key) => {
            const meta = SERIES_META[key];
            const isActive = active.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-dark-3 text-white"
                    : "text-gray hover:text-gray-light hover:bg-dark-3/40"
                }`}
                style={{ letterSpacing: "-0.02em" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: isActive ? meta.color : "var(--color-dark-3)",
                  }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 28, bottom: 8, left: 4 }}
            onClick={(state) => {
              if (!onSelectMonth) return;
              const idx =
                typeof state?.activeIndex === "number" ? state.activeIndex : null;
              if (idx !== null && idx >= 0 && idx < data.length) {
                onSelectMonth(data[idx]);
              }
            }}
            style={onSelectMonth ? { cursor: "pointer" } : undefined}
          >
            <defs>
              <linearGradient id="evo-revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-pos)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-pos)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="evo-expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-neg)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-neg)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="var(--color-dark-3)"
              strokeDasharray="2 4"
              vertical={false}
              opacity={0.6}
            />
            <XAxis
              dataKey="monthLabel"
              tick={{
                fill: "var(--color-gray)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-dark-3)" }}
              dy={4}
            />
            <YAxis
              tick={{
                fill: "var(--color-gray)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickFormatter={(v) => leiShort(v)}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              content={(props) => (
                <RichTooltip
                  active={props.active}
                  payload={(props.payload as readonly TooltipPayload[] | undefined) ?? undefined}
                  label={
                    typeof props.label === "string" ? props.label : undefined
                  }
                  data={data}
                  indexByMonth={indexByMonth}
                  visible={active}
                />
              )}
              cursor={{
                stroke: "var(--color-gray)",
                strokeDasharray: "3 3",
                strokeOpacity: 0.4,
              }}
            />

            {active.has("expenses") && (
              <Area
                type="monotone"
                dataKey="expenses"
                name="Cheltuieli"
                stroke="var(--color-neg)"
                strokeWidth={1.5}
                fill="url(#evo-expenses)"
                isAnimationActive
                animationDuration={600}
              />
            )}
            {active.has("revenue") && (
              <Area
                type="monotone"
                dataKey="revenue"
                name="Venituri"
                stroke="var(--color-pos)"
                strokeWidth={1.5}
                fill="url(#evo-revenue)"
                isAnimationActive
                animationDuration={600}
              />
            )}
            {active.has("cashEnd") && (
              <Line
                type="monotone"
                dataKey="cashEnd"
                name="Bani la final"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{
                  fill: "var(--color-primary)",
                  r: 3,
                  strokeWidth: 0,
                }}
                activeDot={{
                  r: 6,
                  fill: "var(--color-primary)",
                  stroke: "var(--color-dark-2)",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={800}
              />
            )}

            {active.has("cashEnd") && peakCash && (
              <ReferenceDot
                x={peakCash.monthLabel}
                y={peakCash.cashEnd}
                r={6}
                fill="transparent"
                stroke="var(--color-primary)"
                strokeOpacity={0.4}
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            )}

            <ReferenceLine
              y={0}
              stroke="var(--color-dark-3)"
              strokeWidth={1}
            />

            <Brush
              dataKey="monthLabel"
              height={28}
              stroke="var(--color-dark-3)"
              fill="var(--color-dark-3)"
              fillOpacity={0.3}
              travellerWidth={8}
              tickFormatter={() => ""}
              y={290}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {peakCash && active.has("cashEnd") && (
        <div className="border-t border-dark-3 px-5 py-3 flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full border-2 border-primary bg-transparent"
            aria-hidden
          />
          <p
            className="text-[11px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="text-gray-light font-mono">{peakCash.monthLabel}</span>{" "}
            a fost varful — {lei(peakCash.cashEnd)} in cont.
          </p>
        </div>
      )}
    </div>
  );
}

function ChartHeader() {
  return (
    <div>
      <h3
        className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
        style={{ letterSpacing: "-0.04em" }}
      >
        <TrendingUp size={15} className="text-primary" />
        Cum a evoluat firma in ultimul an
      </h3>
      <p
        className="mt-0.5 text-[12px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Venituri, cheltuieli si bani la sfarsit de luna. Click pe pastilele de
        sus pentru a ascunde / arata seriile.
      </p>
    </div>
  );
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function RichTooltip({
  active,
  payload,
  label,
  data,
  indexByMonth,
  visible,
}: {
  active?: boolean;
  payload?: readonly TooltipPayload[];
  label?: string;
  data: MonthlyTrendPoint[];
  indexByMonth: Map<string, number>;
  visible: Set<SeriesKey>;
}) {
  if (!active || !payload || !label || payload.length === 0) return null;

  const idx = indexByMonth.get(label) ?? -1;
  const current = idx >= 0 ? data[idx] : null;
  const previous = idx > 0 ? data[idx - 1] : null;

  if (!current) return null;

  // Build the rows in a deterministic order (revenue, expenses, cashEnd)
  // regardless of how recharts ordered the payload.
  const rows: Array<{
    key: SeriesKey;
    name: string;
    value: number;
    color: string;
    delta: number | null;
    deltaPct: number | null;
  }> = [];
  (Object.keys(SERIES_META) as SeriesKey[]).forEach((key) => {
    if (!visible.has(key)) return;
    const meta = SERIES_META[key];
    const value = current[key];
    const prevValue = previous ? previous[key] : null;
    let delta: number | null = null;
    let deltaPct: number | null = null;
    if (prevValue !== null && prevValue !== 0) {
      delta = value - prevValue;
      deltaPct = (delta / Math.abs(prevValue)) * 100;
    } else if (prevValue === 0 && value !== 0) {
      delta = value;
      deltaPct = null;
    }
    rows.push({
      key,
      name: meta.label,
      value,
      color: meta.color,
      delta,
      deltaPct,
    });
  });

  return (
    <div
      className="rounded-lg border border-dark-3 bg-dark-2/95 backdrop-blur-md px-3.5 py-3 shadow-2xl min-w-[220px]"
    >
      <p
        className="font-mono text-[10px] font-medium uppercase tracking-wider text-gray mb-2"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => {
          // For expenses, "down" is good (less cost); for revenue + cash, "up" is good.
          const goodWhenUp = row.key !== "expenses";
          let trendIcon = Minus;
          let trendClass = "text-gray";
          if (row.delta !== null && row.delta !== 0) {
            const isUp = row.delta > 0;
            trendIcon = isUp ? ArrowUp : ArrowDown;
            trendClass =
              isUp === goodWhenUp ? "text-pos" : "text-neg";
          }
          const TrendIconComp = trendIcon;
          return (
            <div
              key={row.key}
              className="flex items-baseline justify-between gap-3 text-[12px]"
            >
              <span className="flex items-center gap-2 text-gray-light shrink-0">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
              </span>
              <span className="flex items-center gap-2 font-mono tabular-nums">
                <span className="text-white">{lei(row.value)}</span>
                {row.delta !== null && row.delta !== 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[10px] ${trendClass}`}
                  >
                    <TrendIconComp size={10} />
                    {row.deltaPct !== null
                      ? `${Math.abs(row.deltaPct).toFixed(0)}%`
                      : "nou"}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {previous && (
        <p
          className="mt-2.5 pt-2.5 border-t border-dark-3 text-[10px] text-gray font-mono"
          style={{ letterSpacing: "-0.02em" }}
        >
          fata de {previous.monthLabel}
        </p>
      )}
    </div>
  );
}
