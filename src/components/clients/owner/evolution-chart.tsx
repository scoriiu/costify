"use client";

/**
 * C4 — Evolution Chart
 *
 * Combined bar+line chart showing the last 12 months:
 *   - Green bars: revenue per month
 *   - Red bars: expenses per month
 *   - Teal line: cash at end of month
 *
 * Answers: "cum am evoluat?"
 */

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyTrendPoint } from "@/modules/reporting/owner";
import { lei, leiShort } from "@/lib/owner-format";

interface EvolutionChartProps {
  data: MonthlyTrendPoint[];
}

export function EvolutionChart({ data }: EvolutionChartProps) {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Cum a evoluat firma in ultimul an
        </h3>
        <p className="mt-0.5 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Venituri, cheltuieli si bani la sfarsit de luna
        </p>
      </div>

      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--color-dark-3)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: "var(--color-gray)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-dark-3)" }}
            />
            <YAxis
              tick={{ fill: "var(--color-gray)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v) => leiShort(v)}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-dark-3)", opacity: 0.4 }} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 12, fontFamily: "var(--font-mono)" }}
              formatter={(value) => (
                <span style={{ color: "var(--color-gray-light)", letterSpacing: "-0.02em" }}>{value}</span>
              )}
            />
            <Bar dataKey="revenue" name="Venituri" fill="var(--color-green)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expenses" name="Cheltuieli" fill="var(--color-danger)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Line
              type="monotone"
              dataKey="cashEnd"
              name="Bani la final de luna"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              dot={{ fill: "var(--color-primary)", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 shadow-lg">
      <p className="font-mono text-[11px] font-medium uppercase text-gray mb-1.5" style={{ letterSpacing: "-0.04em" }}>
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-[12px]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              {entry.name}:
            </span>
            <span className="font-mono font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
              {lei(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
