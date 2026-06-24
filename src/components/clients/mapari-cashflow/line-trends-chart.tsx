"use client";

/**
 * Line-trends chart for the Mapari tab (ADR-0004 PR-1).
 *
 * Shows how each linie de cost (or linie de business) evolved month by month
 * across the window. The contabil switches the axis (Cheltuieli / Venituri /
 * Business) and can hide individual lines from the legend. Stacked areas, so
 * the silhouette is the firm's total for the axis and each band is one line.
 *
 * Data comes from /api/line-trends, computed per-month with that month's
 * mapping (today a single global mapping, so the latest bar reconciles with
 * the detailed card below). This is a NEW windowed dataset, deliberately not
 * part of the per-period Mapari payload, so its own fetch is not a duplicate.
 * It refetches when the period or `reloadKey` (post-mutation) changes.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { BarChart3, X, ArrowRight, Clock, ChevronDown, ChevronRight, GitBranch, GitCompare } from "lucide-react";
import type {
  LineTrendsData,
  MonthConfigChange,
  PeriodConfigItem,
  ConfigSegment,
} from "@/modules/reporting/owner";
import {
  computeConfigChangelog,
  type ConfigChange,
} from "@/modules/reporting/owner/config-changelog";
import { lei, leiShort } from "@/lib/owner-format";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/ui/search-input";
import { ChartInfo } from "@/components/clients/owner/chart-info";
import { useEscapeKey } from "@/lib/use-escape-key";

type Axis = "expense" | "revenue" | "business";

const PALETTE = [
  "#0D6B5E",
  "#6366F1",
  "#F59E0B",
  "#3FB950",
  "#EF4444",
  "#38BDF8",
  "#A78BFA",
  "#F472B6",
] as const;
const OTHER_COLOR = "#94A3B8";
const OTHER_ID = "__other__";
const MAX_LINES = 8;
const CHART_HEIGHT = 320;

interface ChartLine {
  id: string;
  label: string;
  color: string;
  total: number;
}

interface Props {
  clientId: string;
  year: number;
  month: number;
  verticalsEnabled: boolean;
  /** Bumped by the parent after a mapping mutation so the trend refetches. */
  reloadKey: number;
  /** Jump the whole page to another period (used by the config-overview banner). */
  onJumpToPeriod?: (year: number, month: number) => void;
}

export function LineTrendsChart({
  clientId,
  year,
  month,
  verticalsEnabled,
  reloadKey,
  onJumpToPeriod,
}: Props) {
  const [axis, setAxis] = useState<Axis>("expense");
  const [data, setData] = useState<LineTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Empty = show every line. Non-empty = focus mode: show only these lines.
  const [focus, setFocus] = useState<Set<string>>(new Set());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({
      clientId,
      year: String(year),
      month: String(month),
    });
    fetch(`/api/line-trends?${params.toString()}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((payload: LineTrendsData) => {
        if (ctrl.signal.aborted) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [clientId, year, month, reloadKey]);

  const series = useMemo(() => {
    if (!data) return [];
    if (axis === "expense") return data.costExpense;
    if (axis === "revenue") return data.costRevenue;
    return data.business;
  }, [data, axis]);

  const { rows, lines } = useMemo(() => buildChart(data, series), [data, series]);
  const allShown = focus.size === 0;
  const visibleLines = allShown ? lines : lines.filter((l) => focus.has(l.id));

  // Config-change drilldown is meaningful only for cost lines (axa A), which
  // carry period-scoped mappings. Business lines (axa B) are excluded.
  const canDrill = axis !== "business";

  const selected = useMemo(() => {
    if (!data || !selectedLineId) return null;
    const line = series.find((s) => s.id === selectedLineId);
    if (!line) return null;
    const color = lines.find((l) => l.id === selectedLineId)?.color ?? PALETTE[0];
    const splitItem = data.configOverview.find((it) => it.id === `cat:${line.id}`);
    return {
      id: line.id,
      label: line.label,
      values: line.values,
      color,
      changes: data.configChanges[line.id],
      splitChanges: splitItem ? computeConfigChangelog([splitItem]) : [],
    };
  }, [data, selectedLineId, series, lines]);

  function selectLine(id: string) {
    if (!canDrill || id === OTHER_ID) return;
    setSelectedLineId(id);
  }

  // Which visible lines had at least one configuration change in the window —
  // they get a clock affordance in the legend so the drilldown is discoverable.
  const changedLineIds = useMemo(() => {
    const set = new Set<string>();
    if (!data || !canDrill) return set;
    for (const line of series) {
      const changes = data.configChanges[line.id];
      if (changes?.some((c) => c.added.length > 0 || c.removed.length > 0)) {
        set.add(line.id);
      }
    }
    for (const item of data.configOverview) {
      if (
        item.group === "category-split" &&
        item.id.startsWith("cat:") &&
        item.segments.length >= 2
      ) {
        set.add(item.id.slice(4));
      }
    }
    return set;
  }, [data, series, canDrill]);

  // Month indices where each category band's configuration changed, so the chart
  // can drop a marker on the band at that month. Two sources:
  //   1. Membership (axa A): a cont entered or left the category.
  //   2. Split (axa B): the category's own vertical split changed - the cost
  //      total is unchanged, but the configuration of that line did change.
  const changeIndexByLine = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!data || !canDrill) return map;
    const add = (lineId: string, idx: number) => {
      let s = map.get(lineId);
      if (!s) {
        s = new Set<number>();
        map.set(lineId, s);
      }
      s.add(idx);
    };
    for (const line of series) {
      const changes = data.configChanges[line.id];
      changes?.forEach((c, i) => {
        if (c.added.length > 0 || c.removed.length > 0) add(line.id, i);
      });
    }
    const indexOfMonth = new Map<number, number>();
    data.months.forEach((m, i) => indexOfMonth.set(m.year * 100 + m.month, i));
    for (const item of data.configOverview) {
      if (item.group !== "category-split" || !item.id.startsWith("cat:")) continue;
      const catId = item.id.slice(4);
      for (let i = 1; i < item.segments.length; i++) {
        const seg = item.segments[i];
        const idx = indexOfMonth.get(seg.fromYear * 100 + seg.fromMonth);
        if (idx !== undefined) add(catId, idx);
      }
    }
    return map;
  }, [data, series, canDrill]);

  // Click semantics: from "all shown" the first click ISOLATES that line.
  // After that, clicks add/remove lines from the focus set so the contabil can
  // compare a handful. Emptying or selecting everything snaps back to "all".
  function clickLine(id: string) {
    setFocus((prev) => {
      if (prev.size === 0) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0 || next.size === lines.length) return new Set();
      return next;
    });
  }

  function showAll() {
    setFocus(new Set());
  }

  const axisOptions = useMemo(() => {
    const base: Array<{ value: Axis; label: string }> = [
      { value: "expense", label: "Cheltuieli" },
      { value: "revenue", label: "Venituri" },
    ];
    if (verticalsEnabled) base.push({ value: "business", label: "Business" });
    return base;
  }, [verticalsEnabled]);

  return (
    <div className="space-y-4">
      {data && data.configOverview.length > 0 && (
        <ConfigOverviewBanner
          items={data.configOverview}
          onJump={onJumpToPeriod}
        />
      )}
      <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3
            className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            <BarChart3 size={15} className="text-primary" />
            Evolutia liniilor pe luni
            <ChartInfo text="Fiecare banda este o linie (de cost, de venit sau de business) si cum a evoluat luna de luna. Fiecare luna e calculata cu maparea ei. Apasa pe un nume din legenda ca sa izolezi acea linie, pe mai multe ca sa le compari, sau pe Toate ca sa le vezi pe toate. Apasa pe o banda (cheltuieli/venituri) ca sa vezi cum s-a schimbat configuratia liniei in timp." />
          </h3>
          <p
            className="mt-0.5 text-[12px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Cum s-au miscat liniile in ultimele luni. Ultima luna corespunde
            tabelului de mai jos.
          </p>
        </div>
        <ToggleGroup
          ariaLabel="Alege axa"
          options={axisOptions}
          value={axis}
          onChange={(v) => {
            setAxis(v);
            setFocus(new Set());
          }}
        />
      </div>

      <ChartBody
        loading={loading}
        error={error}
        rows={rows}
        visibleLines={visibleLines}
        changeIndexByLine={changeIndexByLine}
        onSelectLine={canDrill ? selectLine : undefined}
      />

      {lines.length > 0 && (
        <Legend
          lines={lines}
          focus={focus}
          onClickLine={clickLine}
          onShowAll={showAll}
          changedLineIds={changedLineIds}
          onOpenEvolution={canDrill ? selectLine : undefined}
        />
      )}

      {selected && data && (
        <LineEvolutionDrawer
          label={selected.label}
          color={selected.color}
          months={data.months}
          values={selected.values}
          changes={selected.changes}
          splitChanges={selected.splitChanges}
          onClose={() => setSelectedLineId(null)}
        />
      )}
      </div>
    </div>
  );
}

/** Holds the chart's exact footprint (CHART_HEIGHT + py-4) so loading, empty
 *  and error states never collapse the card and shift the page below. */
function ChartPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 py-4">
      <div
        className="flex items-center justify-center text-center text-[13px] text-gray italic"
        style={{ height: CHART_HEIGHT }}
      >
        {children}
      </div>
    </div>
  );
}

function ChartBody({
  loading,
  error,
  rows,
  visibleLines,
  changeIndexByLine,
  onSelectLine,
}: {
  loading: boolean;
  error: boolean;
  rows: ChartRow[];
  visibleLines: ChartLine[];
  changeIndexByLine?: Map<string, Set<number>>;
  onSelectLine?: (id: string) => void;
}) {
  if (error) {
    return <ChartPlaceholder>Nu am putut incarca evolutia liniilor.</ChartPlaceholder>;
  }
  if (loading && rows.length === 0) {
    return <ChartPlaceholder>Se incarca evolutia...</ChartPlaceholder>;
  }
  if (rows.length === 0 || visibleLines.length === 0) {
    return <ChartPlaceholder>Nu sunt date pentru aceasta axa.</ChartPlaceholder>;
  }

  return (
    <div className="px-2 py-4">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={rows} margin={{ top: 12, right: 28, bottom: 8, left: 4 }}>
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
              <TrendTooltip
                active={props.active}
                payload={
                  (props.payload as readonly TooltipPayload[] | undefined) ??
                  undefined
                }
                label={typeof props.label === "string" ? props.label : undefined}
                lines={visibleLines}
              />
            )}
            cursor={{
              stroke: "var(--color-gray)",
              strokeDasharray: "3 3",
              strokeOpacity: 0.4,
            }}
          />
          <ReferenceLine y={0} stroke="var(--color-dark-3)" strokeWidth={1} />
          {visibleLines.map((line) => {
            const clickable = onSelectLine && line.id !== OTHER_ID;
            const changeMonths = changeIndexByLine?.get(line.id);
            return (
              <Area
                key={line.id}
                type="monotone"
                dataKey={line.id}
                name={line.label}
                stackId="1"
                stroke={line.color}
                strokeWidth={1.25}
                fill={line.color}
                fillOpacity={0.75}
                isAnimationActive
                animationDuration={500}
                style={clickable ? { cursor: "pointer" } : undefined}
                onClick={clickable ? () => onSelectLine!(line.id) : undefined}
                dot={
                  changeMonths
                    ? (props) => (
                        <LineChangeDot
                          key={`${line.id}-${props.index}`}
                          cx={props.cx}
                          cy={props.cy}
                          index={props.index}
                          color={line.color}
                          changeMonths={changeMonths}
                        />
                      )
                    : false
                }
                activeDot={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Legend({
  lines,
  focus,
  onClickLine,
  onShowAll,
  changedLineIds,
  onOpenEvolution,
}: {
  lines: ChartLine[];
  focus: Set<string>;
  onClickLine: (id: string) => void;
  onShowAll: () => void;
  changedLineIds: Set<string>;
  onOpenEvolution?: (id: string) => void;
}) {
  const allShown = focus.size === 0;
  return (
    <div className="border-t border-dark-3 px-5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onShowAll}
          aria-pressed={allShown}
          className={`inline-flex items-center rounded-md px-2.5 py-1.5 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
            allShown
              ? "bg-primary text-[#E9E8E3]"
              : "text-gray hover:text-gray-light hover:bg-dark-3/40"
          }`}
          style={{ letterSpacing: "-0.02em" }}
        >
          Toate
        </button>
        {lines.map((line) => {
          // In focus mode only the picked lines are bright; in "all" mode every
          // line is bright. The dimmed look tells the eye what's off the chart.
          const isActive = allShown || focus.has(line.id);
          const changed = changedLineIds.has(line.id);
          return (
            <span key={line.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => onClickLine(line.id)}
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
                    backgroundColor: isActive
                      ? line.color
                      : "var(--color-dark-3)",
                  }}
                />
                {line.label}
              </button>
              {changed && onOpenEvolution && (
                <button
                  type="button"
                  onClick={() => onOpenEvolution(line.id)}
                  data-testid={`line-evolution-open-${line.id}`}
                  aria-label={`Vezi evolutia configuratiei pentru ${line.label}`}
                  title="Configuratia acestei linii s-a schimbat in timp. Apasa pentru detalii."
                  className="ml-0.5 inline-flex items-center rounded-md p-1 text-primary-light/70 hover:text-primary-light hover:bg-dark-3/40 cursor-pointer"
                >
                  <Clock size={12} />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <p
        className="mt-2 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Apasa o linie ca sa o izolezi, mai multe ca sa le compari, sau Toate ca
        sa le vezi pe toate.
      </p>
    </div>
  );
}

interface ChartRow {
  monthLabel: string;
  [lineId: string]: string | number;
}

function buildChart(
  data: LineTrendsData | null,
  series: { id: string; label: string; values: number[]; total: number }[]
): { rows: ChartRow[]; lines: ChartLine[] } {
  if (!data || series.length === 0) return { rows: [], lines: [] };

  const ranked = [...series].sort(
    (a, b) => Math.abs(b.total) - Math.abs(a.total)
  );
  const top = ranked.slice(0, MAX_LINES);
  const rest = ranked.slice(MAX_LINES);

  const lines: ChartLine[] = top.map((s, i) => ({
    id: s.id,
    label: s.label,
    color: PALETTE[i % PALETTE.length],
    total: s.total,
  }));
  if (rest.length > 0) {
    const otherTotal = rest.reduce((acc, s) => acc + s.total, 0);
    lines.push({
      id: OTHER_ID,
      label: `Altele (${rest.length})`,
      color: OTHER_COLOR,
      total: otherTotal,
    });
  }

  const rows: ChartRow[] = data.months.map((m, i) => {
    const row: ChartRow = { monthLabel: m.monthLabel };
    for (const s of top) row[s.id] = s.values[i] ?? 0;
    if (rest.length > 0) {
      row[OTHER_ID] = rest.reduce((acc, s) => acc + (s.values[i] ?? 0), 0);
    }
    return row;
  });

  return { rows, lines };
}

/* -------------------------------------------------------------------------- */
/*                         LINE EVOLUTION DRAWER                              */
/* -------------------------------------------------------------------------- */

interface EvolutionRow {
  monthLabel: string;
  value: number;
  changed: boolean;
}

function LineEvolutionDrawer({
  label,
  color,
  months,
  values,
  changes,
  splitChanges,
  onClose,
}: {
  label: string;
  color: string;
  months: LineTrendsData["months"];
  values: number[];
  changes: MonthConfigChange[] | undefined;
  splitChanges: ConfigChange[];
  onClose: () => void;
}) {
  useEscapeKey(onClose, true);

  const splitMonthKeys = new Set(splitChanges.map((c) => c.year * 100 + c.month));

  const rows: EvolutionRow[] = months.map((m, i) => ({
    monthLabel: m.monthLabel,
    value: values[i] ?? 0,
    changed: hasChange(changes?.[i]) || splitMonthKeys.has(m.year * 100 + m.month),
  }));

  const changeList = months
    .map((m, i) => ({ month: m, change: changes?.[i] }))
    .filter((e) => hasChange(e.change));

  const nothingChanged = changeList.length === 0 && splitChanges.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Evolutia configuratiei · ${label}`}
        className="w-full max-w-2xl rounded-xl border border-dark-3 bg-dark-2 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-dark-3">
          <div>
            <h3
              className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              <span
                className="inline-block h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: color }}
              />
              {label}
            </h3>
            <p
              className="mt-0.5 text-[12px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Valoarea pe luni si ce s-a schimbat in configuratia liniei: conturi
              care intra sau ies, si cum s-a schimbat impartirea pe business.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Inchide"
            className="shrink-0 rounded-md p-1 text-gray hover:text-white hover:bg-dark-3 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-2 py-4">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={rows} margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
              <CartesianGrid
                stroke="var(--color-dark-3)"
                strokeDasharray="2 4"
                vertical={false}
                opacity={0.6}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: "var(--color-gray)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-dark-3)" }}
                dy={4}
              />
              <YAxis
                tick={{ fill: "var(--color-gray)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickFormatter={(v) => leiShort(v)}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                content={(props) => (
                  <EvolutionTooltip
                    active={props.active}
                    payload={props.payload as readonly { value: number }[] | undefined}
                    label={typeof props.label === "string" ? props.label : undefined}
                    color={color}
                  />
                )}
                cursor={{ stroke: "var(--color-gray)", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
              />
              <ReferenceLine y={0} stroke="var(--color-dark-3)" strokeWidth={1} />
              <Area
                type="monotone"
                dataKey="value"
                name={label}
                stroke={color}
                strokeWidth={1.5}
                fill={color}
                fillOpacity={0.18}
                isAnimationActive={false}
                dot={(props) => <ChangeDot {...props} color={color} rows={rows} />}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {nothingChanged && (
            <p
              className="rounded-lg border border-dark-3 bg-dark-3/30 px-4 py-3 text-[13px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Configuratia acestei linii nu s-a schimbat in perioada afisata.
              Variatia valorii reflecta doar miscarea banilor, nu o remapare.
            </p>
          )}
          {splitChanges.length > 0 && (
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-wider text-gray mb-2"
                style={{ letterSpacing: "0.04em" }}
              >
                Cum s-a schimbat impartirea pe business
              </p>
              <ul className="space-y-1.5">
                {splitChanges.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-dark-3 bg-dark-3/20 px-3.5 py-2.5"
                  >
                    <p
                      className="font-mono text-[10px] uppercase tracking-wider text-primary-light mb-1.5"
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {SHORT_MONTHS[c.month - 1]} {c.year}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[12px] text-gray line-through decoration-gray/50"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        {c.fromLabel}
                      </span>
                      <ArrowRight size={13} className="text-gray shrink-0" />
                      <span
                        className="text-[12px] font-semibold text-white"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        {c.toLabel}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {changeList.length > 0 && (
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-wider text-gray mb-2"
                style={{ letterSpacing: "0.04em" }}
              >
                Conturi care intra sau ies din linie
              </p>
              <ul className="space-y-2">
                {changeList.map(({ month, change }) => (
                <li
                  key={`${month.year}-${month.month}`}
                  className="rounded-lg border border-dark-3 bg-dark-3/20 px-3.5 py-2.5"
                >
                  <p
                    className="font-mono text-[10px] uppercase tracking-wider text-primary-light mb-1.5 inline-flex items-center gap-1.5"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    <Clock size={11} />
                    {month.monthLabel} {month.year}
                  </p>
                  <div className="space-y-1">
                    {change!.added.map((a) => (
                      <ChangeRow
                        key={`a-${a.cont}`}
                        tone="in"
                        cont={a.cont}
                        other={a.otherLabel}
                      />
                    ))}
                    {change!.removed.map((r) => (
                      <ChangeRow
                        key={`r-${r.cont}`}
                        tone="out"
                        cont={r.cont}
                        other={r.otherLabel}
                      />
                    ))}
                  </div>
                </li>
              ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeRow({
  tone,
  cont,
  other,
}: {
  tone: "in" | "out";
  cont: string;
  other: string;
}) {
  return (
    <div
      className="flex items-center gap-2 text-[12px]"
      style={{ letterSpacing: "-0.02em" }}
    >
      <span
        className={`font-mono text-[11px] font-semibold shrink-0 ${
          tone === "in" ? "text-accent" : "text-gray"
        }`}
      >
        {tone === "in" ? "+" : "−"} cont {cont}
      </span>
      <span className="inline-flex items-center gap-1 text-gray">
        {tone === "in" ? "de la" : "catre"}
        <ArrowRight size={11} className="opacity-60" />
        <span className="text-gray-light truncate max-w-[260px]">{other}</span>
      </span>
    </div>
  );
}

/** Marker on a main-chart band at the month a line's configuration changed (a
 *  cont entered or left). Renders nothing on unchanged months to keep the stacked
 *  area clean. */
function LineChangeDot({
  cx,
  cy,
  index,
  color,
  changeMonths,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  color: string;
  changeMonths: Set<number>;
}) {
  if (cx === undefined || cy === undefined || index === undefined) return null;
  if (!changeMonths.has(index)) return null;
  return (
    <g style={{ pointerEvents: "none" }} data-testid="line-change-dot">
      <circle cx={cx} cy={cy} r={4.5} fill={color} />
      <circle cx={cx} cy={cy} r={4.5} fill="none" stroke="var(--color-dark-2)" strokeWidth={1.5} />
    </g>
  );
}

function ChangeDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  color: string;
  rows: EvolutionRow[];
}) {
  const { cx, cy, index, color, rows } = props;
  if (cx === undefined || cy === undefined || index === undefined) return null;
  const changed = rows[index]?.changed ?? false;
  if (!changed) {
    return <circle cx={cx} cy={cy} r={2} fill={color} opacity={0.5} />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} />
      <circle cx={cx} cy={cy} r={5} fill="none" stroke="var(--color-dark-2)" strokeWidth={1.5} />
    </g>
  );
}

function EvolutionTooltip({
  active,
  payload,
  label,
  color,
}: {
  active?: boolean;
  payload?: readonly { value: number }[];
  label?: string;
  color: string;
}) {
  if (!active || !payload || !label || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2/95 backdrop-blur-md px-3 py-2 shadow-2xl">
      <p
        className="font-mono text-[10px] font-medium uppercase tracking-wider text-gray mb-1"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </p>
      <p className="flex items-center gap-2 text-[12px]">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
        <span className="font-mono tabular-nums text-white">{lei(payload[0].value)}</span>
      </p>
    </div>
  );
}

function hasChange(c: MonthConfigChange | undefined): boolean {
  return !!c && (c.added.length > 0 || c.removed.length > 0);
}

interface TooltipPayload {
  name: string;
  value: number;
  dataKey: string;
  color: string;
}

function TrendTooltip({
  active,
  payload,
  label,
  lines,
}: {
  active?: boolean;
  payload?: readonly TooltipPayload[];
  label?: string;
  lines: ChartLine[];
}) {
  if (!active || !payload || !label || payload.length === 0) return null;

  const byId = new Map(lines.map((l) => [l.id, l]));
  const rows = payload
    .map((p) => ({
      id: p.dataKey,
      label: byId.get(p.dataKey)?.label ?? p.name,
      color: byId.get(p.dataKey)?.color ?? p.color,
      value: p.value,
    }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const total = rows.reduce((acc, r) => acc + r.value, 0);

  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2/95 backdrop-blur-md px-3.5 py-3 shadow-2xl min-w-[220px]">
      <p
        className="font-mono text-[10px] font-medium uppercase tracking-wider text-gray mb-2"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-baseline justify-between gap-3 text-[12px]"
          >
            <span className="flex items-center gap-2 text-gray-light shrink-0">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate max-w-[160px]">{row.label}</span>
            </span>
            <span className="font-mono tabular-nums text-white">
              {lei(row.value)}
            </span>
          </div>
        ))}
      </div>
      <p
        className="mt-2.5 pt-2.5 border-t border-dark-3 flex items-baseline justify-between text-[11px] font-mono text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        <span>Total</span>
        <span className="text-gray-light tabular-nums">{lei(total)}</span>
      </p>
    </div>
  );
}

const SHORT_MONTHS = [
  "ian.", "feb.", "mar.", "apr.", "mai", "iun.",
  "iul.", "aug.", "sep.", "oct.", "noi.", "dec.",
] as const;

/** Above this many changing lines the banner gets a search box; below it a
 *  search field is just noise. */
const CONFIG_SEARCH_THRESHOLD = 6;

function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function segmentWindow(seg: {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}): string {
  const from = `${SHORT_MONTHS[seg.fromMonth - 1]} ${seg.fromYear}`;
  if (seg.fromYear === seg.toYear && seg.fromMonth === seg.toMonth) return from;
  if (seg.fromYear === seg.toYear) {
    return `${SHORT_MONTHS[seg.fromMonth - 1]}-${SHORT_MONTHS[seg.toMonth - 1]} ${seg.fromYear}`;
  }
  return `${from} - ${SHORT_MONTHS[seg.toMonth - 1]} ${seg.toYear}`;
}

const GROUP_LABEL: Record<PeriodConfigItem["group"], string> = {
  mapping: "Linie de cost",
  "cont-split": "Impartire cont",
  "category-split": "Impartire linie",
  "firm-split": "Impartire firma",
};

/**
 * Helicopter view of period-scoped configuration. Lists every target whose
 * rule changes across the window as a row of segment chips, so the user sees
 * "ian.-mar. 100% X, apr.-iun. 50/50" at a glance instead of scrubbing months.
 * Clicking a chip jumps the page to that segment.
 */
function ConfigOverviewBanner({
  items,
  onJump,
}: {
  items: PeriodConfigItem[];
  onJump?: (year: number, month: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [query, setQuery] = useState("");
  const changelog = useMemo(() => computeConfigChangelog(items), [items]);
  const showSearch = items.length > CONFIG_SEARCH_THRESHOLD;
  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return items;
    return items.filter((it) => normalizeSearch(it.title).includes(q));
  }, [items, query]);
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          data-testid="config-overview-toggle"
          className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <Clock size={14} className="text-primary-light shrink-0" />
          <span
            className="text-[13px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Configurari care se schimba in timp
          </span>
          <span className="ml-1 inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary-light">
            {items.length}
          </span>
        </button>
        {changelog.length > 0 && (
          <button
            type="button"
            onClick={() => setShowChangelog(true)}
            data-testid="config-changelog-open"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-[10px] border border-dark-3 bg-dark-2 px-3 py-1.5 text-[12px] font-semibold text-gray-light hover:text-white hover:border-gray cursor-pointer"
            style={{ letterSpacing: "-0.02em" }}
          >
            <GitCompare size={13} />
            Vezi schimbarile
          </button>
        )}
      </div>
      {showChangelog && (
        <ConfigChangelogModal
          changes={changelog}
          onJump={onJump}
          onClose={() => setShowChangelog(false)}
        />
      )}
      {expanded && showSearch && (
        <div className="px-4 pb-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cauta o linie..."
          />
        </div>
      )}
      {expanded && (
        <ul className="px-4 pb-3 space-y-2.5 max-h-[45vh] overflow-y-auto">
          {filtered.length === 0 && (
            <li
              className="rounded-lg border border-dark-3 bg-dark-2/60 px-3.5 py-3 text-[12px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Nicio linie nu se potriveste cu cautarea.
            </li>
          )}
          {filtered.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-dark-3 bg-dark-2/60 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray shrink-0">
                  {GROUP_LABEL[item.group]}
                </span>
                <span
                  className="text-[13px] font-semibold text-white truncate"
                  style={{ letterSpacing: "-0.04em" }}
                >
                  {item.title}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.segments.map((seg, idx) => {
                  const bkKey = `${item.id}:${idx}`;
                  const hasOverrides = (seg.overrides?.length ?? 0) > 0;
                  const prev = idx > 0 ? item.segments[idx - 1] : null;
                  return (
                    <div
                      key={idx}
                      className={`inline-flex items-stretch rounded-md border overflow-hidden transition-colors ${
                        seg.current
                          ? "border-primary/50 bg-primary/10"
                          : "border-dark-3 bg-dark-3/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onJump?.(seg.fromYear, seg.fromMonth)}
                        title={`Sari la ${segmentWindow(seg)}`}
                        className="flex flex-col items-start px-2.5 py-1 text-left cursor-pointer hover:bg-white/[0.03]"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-wider text-gray">
                          {segmentWindow(seg)}
                          {seg.current ? " · acum" : ""}
                        </span>
                        {prev && (
                          <span
                            className="text-[11px] text-gray line-through decoration-gray/50"
                            style={{ letterSpacing: "-0.02em" }}
                          >
                            {prev.valueLabel}
                          </span>
                        )}
                        <span
                          className={`text-[12px] ${prev ? "font-semibold text-white" : "text-gray-light"}`}
                          style={{ letterSpacing: "-0.02em" }}
                        >
                          {seg.valueLabel}
                        </span>
                      </button>
                      {hasOverrides && (
                        <button
                          type="button"
                          data-testid="override-marker"
                          onClick={() =>
                            setOpenBreakdown((v) => (v === bkKey ? null : bkKey))
                          }
                          aria-expanded={openBreakdown === bkKey}
                          title="Impartire neuniforma. Unele conturi din aceasta linie au impartirea lor proprie."
                          className={`flex items-center gap-1 border-l border-dark-3 px-1.5 cursor-pointer transition-colors ${
                            openBreakdown === bkKey
                              ? "bg-primary/10 text-primary-light"
                              : "text-gray hover:bg-white/[0.04] hover:text-gray-light"
                          }`}
                        >
                          <GitBranch size={11} />
                          <span className="font-mono text-[10px]">
                            {seg.overrides!.length}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {item.segments.map((seg, idx) =>
                openBreakdown === `${item.id}:${idx}` && seg.overrides ? (
                  <OverrideBreakdown key={`bk-${idx}`} seg={seg} onJump={onJump} />
                ) : null
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Drilldown under a non-uniform line segment: the headline split is only a
 * fallback. This lists the conts that carry their OWN split in this window, each
 * with its month-by-month sub-timeline, so the user sees exactly which part of
 * the line is allocated differently and when.
 */
function OverrideBreakdown({
  seg,
  onJump,
}: {
  seg: ConfigSegment;
  onJump?: (year: number, month: number) => void;
}) {
  return (
    <div
      data-testid="override-breakdown"
      className="mt-2 rounded-lg border border-dark-3 bg-dark-2/60 px-3 py-2.5"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <GitBranch size={12} className="text-gray" />
        <span
          className="text-[11px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Impartire neuniforma in {segmentWindow(seg)}
        </span>
      </div>
      <p
        className="text-[11px] text-gray mb-2.5"
        style={{ letterSpacing: "-0.02em" }}
      >
        Aceste conturi se impart altfel decat restul liniei.
      </p>
      <ul className="space-y-2.5">
        {seg.overrides!.map((ov) => {
          const coversFull =
            ov.segments.length === 1 &&
            ov.segments[0].fromYear === seg.fromYear &&
            ov.segments[0].fromMonth === seg.fromMonth &&
            ov.segments[0].toYear === seg.toYear &&
            ov.segments[0].toMonth === seg.toMonth;
          return (
            <li
              key={ov.key}
              className="rounded-lg border border-dark-3 bg-dark-3/30 px-3 py-2"
            >
              <span
                className="font-mono text-[11px] text-gray-light"
                style={{ letterSpacing: "-0.02em" }}
              >
                {ov.label}
              </span>
              <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-baseline">
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray">
                  acest cont
                </span>
                {coversFull ? (
                  <span
                    className="text-[12px] font-semibold text-white"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {ov.segments[0].valueLabel}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ov.segments.map((sub, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onJump?.(sub.fromYear, sub.fromMonth)}
                        title={`Sari la ${segmentWindow(sub)}`}
                        className="inline-flex flex-col items-start rounded-md border border-dark-3 bg-dark-2/60 px-2 py-0.5 text-left cursor-pointer hover:border-gray"
                      >
                        <span className="font-mono text-[9px] uppercase tracking-wider text-gray">
                          {segmentWindow(sub)}
                        </span>
                        <span
                          className="text-[11px] font-semibold text-white"
                          style={{ letterSpacing: "-0.02em" }}
                        >
                          {sub.valueLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray">
                  restul liniei
                </span>
                <span
                  className="text-[12px] text-gray"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {seg.valueLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function changeMonthLabel(c: { year: number; month: number }): string {
  return `${SHORT_MONTHS[c.month - 1]} ${c.year}`;
}

/**
 * Git-log style changelog. Every configuration change in the window, newest
 * first, grouped by the month it took effect, each as a calm before -> after
 * line. Answers "what changed this month, versus what it was before".
 */
function ConfigChangelogModal({
  changes,
  onJump,
  onClose,
}: {
  changes: ConfigChange[];
  onJump?: (year: number, month: number) => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose, true);

  const groups: { key: number; label: string; items: ConfigChange[] }[] = [];
  for (const c of changes) {
    const key = c.year * 100 + c.month;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(c);
    else groups.push({ key, label: changeMonthLabel(c), items: [c] });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schimbari de configurare"
        data-testid="config-changelog-modal"
        className="w-full max-w-2xl rounded-xl border border-dark-3 bg-dark-2 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-dark-3 sticky top-0 bg-dark-2 z-10">
          <div>
            <h3
              className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              <GitCompare size={15} className="text-primary-light" />
              Schimbari de configurare
            </h3>
            <p
              className="mt-0.5 text-[12px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Fiecare schimbare, de la cea mai recenta, cu ce era inainte si in ce
              s-a transformat. Apasa o schimbare ca sa sari la luna ei.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Inchide"
            className="shrink-0 rounded-md p-1 text-gray hover:text-white hover:bg-dark-3 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-primary-light">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-dark-3" />
              </div>
              <ul className="space-y-1.5">
                {g.items.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        onJump?.(c.year, c.month);
                        onClose();
                      }}
                      className="w-full rounded-lg border border-dark-3 bg-dark-3/30 px-3.5 py-2.5 text-left hover:border-gray cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-gray shrink-0">
                          {GROUP_LABEL[c.group]}
                        </span>
                        <span
                          className="text-[12px] font-semibold text-white truncate"
                          style={{ letterSpacing: "-0.04em" }}
                        >
                          {c.title}
                        </span>
                        {c.current && (
                          <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary-light">
                            acum
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[12px] text-gray line-through decoration-gray/50"
                          style={{ letterSpacing: "-0.02em" }}
                        >
                          {c.fromLabel}
                        </span>
                        <ArrowRight size={13} className="text-gray shrink-0" />
                        <span
                          className="text-[12px] font-semibold text-white"
                          style={{ letterSpacing: "-0.02em" }}
                        >
                          {c.toLabel}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
