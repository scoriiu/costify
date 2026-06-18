"use client";

/**
 * Employee count section for the Setari tab.
 *
 * The accountant enters the average headcount for each month (from payroll /
 * Revisal). This is the auxiliary input that unlocks the headcount KPIs
 * (Venituri per angajat, Profit per angajat). One value per (year, month);
 * saving an empty field clears that month.
 *
 * Layout: a year selector, a 12-month input grid, and a bar chart below
 * showing how headcount evolves across every month that has a value.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import { Select } from "@/components/ui/select";
import { setEmployeeCountAction } from "@/modules/clients/actions";
import type { EmployeeCountPoint } from "@/modules/clients/employee-counts";

const MONTHS_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];
const MONTHS_LONG = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

interface Props {
  clientId: string;
  initialCounts: EmployeeCountPoint[];
}

export function EmployeeCountSection({ clientId, initialCounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [counts, setCounts] = useState<EmployeeCountPoint[]>(initialCounts);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => buildYearOptions(counts), [counts]);
  const [year, setYear] = useState<number>(years[0]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of counts) m.set(`${c.year}-${c.month}`, c.count);
    return m;
  }, [counts]);

  const chartData = useMemo(() => buildChartData(counts), [counts]);

  function persist(month: number, value: number | null) {
    setError(null);
    startTransition(async () => {
      const res = await setEmployeeCountAction({ clientId, year, month, count: value });
      if (!res.ok) {
        setError(res.error ?? "Nu am putut salva.");
        return;
      }
      setCounts((prev) => {
        const rest = prev.filter((c) => !(c.year === year && c.month === month));
        return value === null ? rest : [...rest, { year, month, count: value }];
      });
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="setari-angajati"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Users size={16} className="text-primary" />
          <h2 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            Angajati pe luna
          </h2>
        </div>
        <div className="w-32">
          <Select
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
      </div>

      <p className="mt-2 max-w-2xl text-[13px] text-gray" style={{ letterSpacing: "-0.02em" }}>
        Numarul mediu de angajati pe luna, din statul de plata. Deblocheaza indicatorii
        Venituri per angajat si Profit per angajat. Lasa gol ca sa stergi o luna.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {MONTHS_LONG.map((label, idx) => {
          const month = idx + 1;
          const stored = byMonth.get(`${year}-${month}`);
          return (
            <MonthInput
              key={month}
              label={label}
              initial={stored ?? null}
              disabled={isPending}
              onCommit={(v) => persist(month, v)}
            />
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-danger" data-testid="employee-count-error">
          {error}
        </p>
      )}

      {chartData.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-gray">
            Evolutia numarului de angajati
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-dark-3)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-gray)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-dark-3)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--color-gray)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={36}
              />
              <RTooltip
                cursor={{ fill: "var(--color-dark-3)", opacity: 0.3 }}
                content={<HeadcountTooltip />}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {chartData.map((d) => (
                  <Cell key={d.label} fill="var(--color-primary)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function MonthInput({
  label,
  initial,
  disabled,
  onCommit,
}: {
  label: string;
  initial: number | null;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [value, setValue] = useState<string>(initial === null ? "" : String(initial));

  function commit() {
    const trimmed = value.trim();
    if (trimmed === "") {
      if (initial !== null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setValue(initial === null ? "" : String(initial));
      return;
    }
    if (parsed !== initial) onCommit(parsed);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[-0.04em] text-gray">
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="-"
        className="h-10 rounded-[10px] border border-dark-3 bg-dark px-3 font-mono text-sm text-white placeholder:text-gray focus:border-primary focus:outline-none disabled:opacity-50"
      />
    </label>
  );
}

interface ChartPoint {
  label: string;
  count: number;
  year: number;
  month: number;
}

function HeadcountTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 font-mono text-[11px] text-gray-light">
      <div className="text-white">{MONTHS_LONG[p.month - 1]} {p.year}</div>
      <div className="mt-0.5">{p.count} angajati</div>
    </div>
  );
}

function buildYearOptions(counts: EmployeeCountPoint[]): number[] {
  const current = new Date().getFullYear();
  const set = new Set<number>([current, current - 1]);
  for (const c of counts) set.add(c.year);
  return [...set].sort((a, b) => b - a);
}

function buildChartData(counts: EmployeeCountPoint[]): ChartPoint[] {
  return [...counts]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((c) => ({
      label: `${MONTHS_SHORT[c.month - 1]} ${String(c.year).slice(2)}`,
      count: c.count,
      year: c.year,
      month: c.month,
    }));
}
