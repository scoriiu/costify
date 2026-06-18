"use client";

/**
 * Employee count section for the Setari tab.
 *
 * The accountant sets the average headcount per month (from payroll / Revisal).
 * This is the auxiliary input that unlocks the headcount KPIs (Venituri per
 * angajat, Profit per angajat).
 *
 * UX: a row of month cells. Click a month to edit its value in place (type,
 * Enter to confirm, Esc to cancel). Only the months filled in are stored
 * EXPLICITLY; every later month inherits the last explicit value
 * (carry-forward), shown faded. Future months are locked. Because headcount is
 * usually stable, one value in January powers the whole year. One Save persists
 * the whole year at once.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Eraser, CalendarRange, Info } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { setEmployeeCountsAction } from "@/modules/clients/actions";
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

/** Per-month draft cell. `explicit` is the typed value for this exact month
 *  (null = not set here). The resolved/inherited value is computed separately. */
type Draft = Array<number | null>;

export function EmployeeCountSection({ clientId, initialCounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [counts, setCounts] = useState<EmployeeCountPoint[]>(initialCounts);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => buildYearOptions(counts), [counts]);
  const [year, setYear] = useState<number>(years[0]);

  const now = new Date();
  const lastMonth =
    year > now.getFullYear() ? 0 : year === now.getFullYear() ? now.getMonth() + 1 : 12;

  // Explicit values stored for the selected year, as a 12-slot draft.
  const stored = useMemo(() => toDraft(counts, year), [counts, year]);
  const [draft, setDraft] = useState<Draft>(stored);

  // Reset the draft whenever the selected year (and thus its stored data) changes.
  useEffect(() => {
    setDraft(stored);
    setError(null);
  }, [stored]);

  // Which month is being edited in place (1..12), or null.
  const [editing, setEditing] = useState<number | null>(null);

  // Range mode: pick a start month and an end month (two clicks), then set one
  // value for the whole interval at once.
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeHover, setRangeHover] = useState<number | null>(null);
  const [rangePrompt, setRangePrompt] = useState<{ start: number; end: number } | null>(null);

  // Carry-forward across the whole timeline (all years), so January of this
  // year can inherit from a prior year, and untouched months inherit forward.
  const resolved = useMemo(
    () => resolveYear(counts, draft, year),
    [counts, draft, year]
  );

  const dirty = useMemo(() => !sameDraft(draft, stored), [draft, stored]);
  const chartData = useMemo(() => buildChartData(resolved, draft, year), [resolved, draft, year]);

  function setMonth(month: number, value: number | null) {
    setDraft((prev) => {
      const next = [...prev];
      next[month - 1] = value;
      return next;
    });
  }

  function exitRangeMode() {
    setRangeMode(false);
    setRangeStart(null);
    setRangeHover(null);
    setRangePrompt(null);
  }

  function onRangeClick(month: number) {
    if (month > lastMonth) return;
    if (rangeStart === null) {
      setRangeStart(month);
      return;
    }
    const start = Math.min(rangeStart, month);
    const end = Math.max(rangeStart, month);
    setRangePrompt({ start, end });
  }

  function applyRange(value: number | null) {
    if (!rangePrompt) return;
    const { start, end } = rangePrompt;
    setDraft((prev) => {
      const next = [...prev];
      for (let m = start; m <= end && m <= lastMonth; m++) next[m - 1] = value;
      return next;
    });
    exitRangeMode();
  }

  // The tentative interval to highlight: from the fixed start to the hovered
  // month (before the second click) or the chosen end (in the prompt).
  const rangePreview: [number, number] | null = rangePrompt
    ? [rangePrompt.start, rangePrompt.end]
    : rangeStart !== null
      ? [Math.min(rangeStart, rangeHover ?? rangeStart), Math.max(rangeStart, rangeHover ?? rangeStart)]
      : null;

  function inPreview(month: number): boolean {
    return rangePreview !== null && month >= rangePreview[0] && month <= rangePreview[1];
  }

  function save() {
    setError(null);
    const entries: Array<{ month: number; count: number }> = [];
    for (let m = 1; m <= 12; m++) {
      const v = draft[m - 1];
      if (v !== null) entries.push({ month: m, count: v });
    }
    startTransition(async () => {
      const res = await setEmployeeCountsAction({ clientId, year, entries });
      if (!res.ok) {
        setError(res.error ?? "Nu am putut salva.");
        return;
      }
      setCounts((prev) => {
        const others = prev.filter((c) => c.year !== year);
        return [...others, ...entries.map((e) => ({ year, month: e.month, count: e.count }))];
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
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h2 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            Numar mediu de angajati
          </h2>
          <Tooltip
            content={
              <>
                Numarul mediu de salariati din luna respectiva, asa cum apare in statul de
                plata si in raportarile statistice. Cei care lucreaza part-time sau intra ori
                pleaca la mijlocul lunii conteaza proportional, de aceea poate fi un numar cu
                zecimale (ex. 4,5). Daca echipa este stabila, este chiar numarul de angajati.
              </>
            }
          >
            <Info size={14} className="text-gray hover:text-white" />
          </Tooltip>
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
        Apasa pe o luna si scrie numarul mediu de salariati din statul de plata. Lunile pe care
        nu le completezi mostenesc ultima valoare (afisata mai estompat). Deblocheaza
        indicatorii Venituri per angajat si Profit per angajat.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-gray">
          {rangeMode
            ? rangeStart === null
              ? "Alege luna de inceput"
              : "Alege luna de sfarsit"
            : ""}
        </p>
        <button
          type="button"
          onClick={() => (rangeMode ? exitRangeMode() : (setEditing(null), setRangeMode(true)))}
          data-testid="employee-range-toggle"
          className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-3 font-mono text-[12px] transition-colors ${
            rangeMode
              ? "border-primary bg-primary/15 text-white"
              : "border-dark-3 bg-dark text-gray hover:border-primary/50 hover:text-white"
          }`}
        >
          <CalendarRange size={13} />
          {rangeMode ? "Renunta la interval" : "Selecteaza interval"}
        </button>
      </div>

      <div
        className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6"
        onPointerLeave={() => setRangeHover(null)}
      >
        {MONTHS_SHORT.map((label, idx) => {
          const month = idx + 1;
          const explicit = draft[month - 1];
          const value = resolved[month - 1];
          const future = month > lastMonth;
          return (
            <MonthCell
              key={`${year}-${month}`}
              label={label}
              explicit={explicit}
              value={value}
              future={future}
              editing={editing === month}
              rangeMode={rangeMode}
              inRange={inPreview(month)}
              rangeAnchor={rangeStart === month}
              onStartEdit={() => !future && setEditing(month)}
              onRangeClick={() => onRangeClick(month)}
              onRangeHover={() => setRangeHover(month)}
              onCommit={(v) => {
                setMonth(month, v);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
              onClear={() => setMonth(month, null)}
            />
          );
        })}
      </div>

      {rangePrompt && (
        <RangePrompt
          start={rangePrompt.start}
          end={rangePrompt.end}
          onApply={applyRange}
          onCancel={exitRangeMode}
        />
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || isPending} data-testid="employee-save">
          {isPending ? "Se salveaza..." : "Salveaza"}
        </Button>
        {dirty && !isPending && (
          <button
            type="button"
            onClick={() => setDraft(stored)}
            className="font-mono text-[12px] text-gray hover:text-white"
          >
            Anuleaza modificarile
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-danger" data-testid="employee-count-error">
          {error}
        </p>
      )}

      {chartData.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-gray">
            Evolutia numarului de angajati ({year})
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
                  <Cell
                    key={d.month}
                    fill="var(--color-primary)"
                    fillOpacity={d.explicit ? 1 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function MonthCell({
  label,
  explicit,
  value,
  future,
  editing,
  rangeMode,
  inRange,
  rangeAnchor,
  onStartEdit,
  onRangeClick,
  onRangeHover,
  onCommit,
  onCancel,
  onClear,
}: {
  label: string;
  explicit: number | null;
  value: number | null;
  future: boolean;
  editing: boolean;
  rangeMode: boolean;
  inRange: boolean;
  rangeAnchor: boolean;
  onStartEdit: () => void;
  onRangeClick: () => void;
  onRangeHover: () => void;
  onCommit: (value: number | null) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const isExplicit = explicit !== null;
  const hasValue = value !== null;

  const base =
    "group relative flex h-16 flex-col items-center justify-center rounded-[10px] border transition-colors";
  const state = future
    ? "cursor-not-allowed border-dark-3 bg-dark/40 opacity-50"
    : editing
      ? "border-primary bg-primary/10"
      : rangeMode
        ? rangeAnchor
          ? "cursor-pointer border-primary bg-primary/25"
          : inRange
            ? "cursor-pointer border-primary/60 bg-primary/15"
            : "cursor-pointer border-dark-3 bg-dark hover:border-primary/50"
        : isExplicit
          ? "cursor-pointer border-primary/60 bg-primary/15 hover:border-primary"
          : hasValue
            ? "cursor-pointer border-dark-3 bg-dark hover:border-primary/50"
            : "cursor-pointer border-dashed border-dark-3 bg-dark hover:border-primary/50";

  if (editing) {
    return (
      <div
        data-testid={`month-cell-${label}`}
        data-explicit={isExplicit ? "1" : "0"}
        className={`${base} ${state}`}
      >
        <span className="font-mono text-[10px] uppercase tracking-[-0.04em] text-gray">{label}</span>
        <CellInput
          initial={explicit}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      aria-disabled={future}
      tabIndex={future ? -1 : 0}
      data-testid={`month-cell-${label}`}
      data-explicit={isExplicit ? "1" : "0"}
      data-in-range={rangeMode && inRange ? "1" : "0"}
      className={`${base} ${state}`}
      onClick={rangeMode ? onRangeClick : onStartEdit}
      onPointerEnter={rangeMode ? onRangeHover : undefined}
      onKeyDown={(e) => {
        if (future) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (rangeMode) onRangeClick();
          else onStartEdit();
        }
      }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[-0.04em] text-gray">{label}</span>
      <span
        className={`mt-0.5 font-mono text-[15px] ${
          isExplicit ? "text-white" : hasValue ? "text-gray-light/60" : "text-gray"
        }`}
      >
        {hasValue ? formatCount(value as number) : "-"}
      </span>
      {isExplicit && !future && !rangeMode && (
        <button
          type="button"
          aria-label={`Sterge ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute right-1 top-1 rounded p-0.5 text-gray opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
        >
          <Eraser size={11} />
        </button>
      )}
    </div>
  );
}

function CellInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: number | null;
  onCommit: (value: number | null) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial === null ? "" : formatCount(initial));

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commit() {
    const t = text.trim();
    if (t === "") {
      onCommit(null);
      return;
    }
    const parsed = parseCount(t);
    if (parsed === null) {
      onCancel();
      return;
    }
    onCommit(parsed);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") onCancel();
      }}
      placeholder="-"
      className="mt-0.5 h-7 w-14 rounded-md border border-dark-3 bg-dark text-center font-mono text-[15px] text-white placeholder:text-gray focus:border-primary focus:outline-none"
    />
  );
}

function RangePrompt({
  start,
  end,
  onApply,
  onCancel,
}: {
  start: number;
  end: number;
  onApply: (value: number | null) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function apply() {
    const t = text.trim();
    onApply(t === "" ? null : parseCount(t));
  }

  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-primary/40 bg-primary/10 px-4 py-3"
      data-testid="employee-range-prompt"
    >
      <span className="font-mono text-[12px] text-gray-light">
        {MONTHS_LONG[start - 1]} - {MONTHS_LONG[end - 1]}
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
          else if (e.key === "Escape") onCancel();
        }}
        placeholder="numar angajati"
        data-testid="employee-range-input"
        className="h-9 w-36 rounded-[10px] border border-dark-3 bg-dark px-3 font-mono text-sm text-white placeholder:text-gray focus:border-primary focus:outline-none"
      />
      <Button onClick={apply} data-testid="employee-range-apply" className="h-9 px-4">
        Aplica
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="font-mono text-[12px] text-gray hover:text-white"
      >
        Renunta
      </button>
    </div>
  );
}

interface ChartPoint {
  label: string;
  count: number;
  year: number;
  month: number;
  explicit: boolean;
}

function HeadcountTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 font-mono text-[11px] text-gray-light">
      <div className="text-white">{MONTHS_LONG[p.month - 1]} {p.year}</div>
      <div className="mt-0.5">
        {formatCount(p.count)} angajati{p.explicit ? "" : " (mostenit)"}
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

function parseCount(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
}

function toDraft(counts: EmployeeCountPoint[], year: number): Draft {
  const d: Draft = Array(12).fill(null);
  for (const c of counts) if (c.year === year) d[c.month - 1] = c.count;
  return d;
}

function sameDraft(a: Draft, b: Draft): boolean {
  for (let i = 0; i < 12; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Resolves all 12 months of `year` with carry-forward. Explicit draft values
 * win; gaps inherit the most recent explicit value, looking back into prior
 * years (from `counts`) when the year starts empty.
 */
function resolveYear(
  counts: EmployeeCountPoint[],
  draft: Draft,
  year: number
): Array<number | null> {
  // Seed: last explicit value strictly before January of `year`.
  let carry: number | null = null;
  const prior = counts
    .filter((c) => c.year < year)
    .sort((a, b) => a.year - b.year || a.month - b.month);
  if (prior.length > 0) carry = prior[prior.length - 1].count;

  const out: Array<number | null> = Array(12).fill(null);
  for (let m = 0; m < 12; m++) {
    if (draft[m] !== null) carry = draft[m];
    out[m] = carry;
  }
  return out;
}

function buildYearOptions(counts: EmployeeCountPoint[]): number[] {
  const current = new Date().getFullYear();
  const set = new Set<number>([current, current - 1]);
  for (const c of counts) set.add(c.year);
  return [...set].sort((a, b) => b - a);
}

function buildChartData(resolved: Array<number | null>, draft: Draft, year: number): ChartPoint[] {
  const out: ChartPoint[] = [];
  for (let m = 0; m < 12; m++) {
    const v = resolved[m];
    if (v === null) continue;
    out.push({
      label: MONTHS_SHORT[m],
      count: v,
      year,
      month: m + 1,
      explicit: draft[m] !== null,
    });
  }
  return out;
}
