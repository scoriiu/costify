"use client";

/**
 * KPI tab (accountant view).
 *
 * Shows the industry-aware KPI catalog with FULL debugging transparency:
 * every KPI row expands to reveal the formula, each resolved input (with
 * the exact balance aggregation that produced it), the substituted
 * calculation, and the interpretation. The contabil must be able to
 * reproduce every number from the Balanta de Verificare by hand.
 *
 * Period selector: Luna + An, cumulative Jan -> selected month (same
 * convention as Balanta / CPP / Mapari).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { Select } from "@/components/ui/select";
import type {
  IndustryKpi,
  IndustryKpiGroup,
  IndustryKpiSection,
  KpiState,
} from "@/modules/reporting/industry";

interface Period {
  year: number;
  month: number;
}

interface Payload {
  section: IndustryKpiSection;
  availablePeriods: Period[];
}

const MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const STATE_STYLES: Record<KpiState, { dot: string; text: string; label: string }> = {
  good: { dot: "bg-green", text: "text-green", label: "OK" },
  neutral: { dot: "bg-gray", text: "text-gray-light", label: "Info" },
  warn: { dot: "bg-warn", text: "text-warn", label: "Atentie" },
  danger: { dot: "bg-danger", text: "text-danger", label: "Alerta" },
  unknown: { dot: "bg-dark-3", text: "text-gray", label: "Indisponibil" },
};

function fmtValue(kpi: IndustryKpi): string {
  if (kpi.value === null) return "n/a";
  const v = kpi.value;
  switch (kpi.format) {
    case "percent":
      return `${v.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`;
    case "days":
      return `${v.toLocaleString("ro-RO", { maximumFractionDigits: 1 })} zile`;
    case "lei":
      return `${v.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} lei`;
    default:
      return v.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
  }
}

export function IndustryKpiTab({
  clientId,
  dataVersion,
}: {
  clientId: string;
  dataVersion: number;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const fetchPeriod = useCallback(
    async (year?: number, month?: number) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ clientId });
        if (year !== undefined && month !== undefined) {
          params.set("year", String(year));
          params.set("month", String(month));
        }
        const res = await fetch(`/api/industry-kpis?${params.toString()}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Nu am putut incarca indicatorii.");
        }
        setPayload((await res.json()) as Payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare la incarcare.");
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [clientId]
  );

  useEffect(() => {
    void fetchPeriod();
    // dataVersion: external mutation (upload, industry change) -> refetch.
  }, [fetchPeriod, dataVersion]);

  if (loading && !payload) {
    return <p className="py-12 text-center font-mono text-sm text-gray">Se incarca indicatorii...</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!payload) return null;

  const { section, availablePeriods } = payload;

  return (
    <div className="space-y-6 max-w-6xl" data-testid="industry-kpi-tab">
      <Header
        section={section}
        availablePeriods={availablePeriods}
        loading={loading}
        onPeriodChange={(y, m) => void fetchPeriod(y, m)}
      />
      {section.groups.map((group) => (
        <KpiGroupCard key={group.id} group={group} />
      ))}
      <p className="pb-4 text-[12px] text-gray">
        Valorile sunt cumulate de la inceputul anului pana la luna selectata.
        Indicatorii anuali (ROE, ROA, DSO, rotatii) folosesc valori anualizate.
        Deschide orice indicator pentru formula completa si valorile folosite in calcul.
      </p>
    </div>
  );
}

function Header({
  section,
  availablePeriods,
  loading,
  onPeriodChange,
}: {
  section: IndustryKpiSection;
  availablePeriods: Period[];
  loading: boolean;
  onPeriodChange: (year: number, month: number) => void;
}) {
  const years = [...new Set(availablePeriods.map((p) => p.year))].sort((a, b) => a - b);
  const monthsForYear = availablePeriods
    .filter((p) => p.year === section.year)
    .map((p) => p.month)
    .sort((a, b) => a - b);

  function onYearChange(value: string) {
    const y = parseInt(value, 10);
    if (!Number.isFinite(y) || y === section.year) return;
    const months = availablePeriods.filter((p) => p.year === y).map((p) => p.month);
    onPeriodChange(y, months.length > 0 ? Math.max(...months) : section.month);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-[20px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Indicatori financiari (KPI)
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          {loading && <span className="font-mono text-[11px] text-gray">Se actualizeaza...</span>}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray">Luna</span>
            <Select
              value={String(section.month)}
              onChange={(v) => {
                const m = parseInt(v, 10);
                if (Number.isFinite(m) && m !== section.month) onPeriodChange(section.year, m);
              }}
              options={monthsForYear.map((m) => ({ value: String(m), label: MONTHS[m - 1] }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray">An</span>
            <Select
              value={String(section.year)}
              onChange={onYearChange}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
        </div>
      </div>
      <p className="max-w-3xl text-[13px] leading-relaxed text-gray-light">
        Profil industrie:{" "}
        <span className="font-semibold text-white">{section.industryLabel}</span>{" "}
        <span className="font-mono text-[10px] uppercase text-gray">
          ({section.industrySource === "manual"
            ? "setat manual"
            : section.industrySource === "auto"
              ? `detectat automat din CAEN ${section.caen ?? ""}`
              : section.industrySource === "journal"
                ? "dedus din registru jurnal"
                : "implicit, fara CAEN"})
        </span>
        . Profilul ajusteaza pragurile si adauga indicatorii specifici industriei.
        Se schimba din Setari, sectiunea Informatii generale.
      </p>
      {section.journalHint && (
        <div
          className={`flex max-w-3xl items-start gap-2 rounded-lg border p-3 text-[12px] leading-relaxed ${
            section.journalHint.kind === "mismatch"
              ? "border-warn/20 bg-warn/5 text-gray-light"
              : "border-blue/20 bg-blue/5 text-gray-light"
          }`}
          data-testid="kpi-journal-hint"
        >
          <Info
            size={13}
            className={`mt-0.5 shrink-0 ${section.journalHint.kind === "mismatch" ? "text-warn" : "text-blue"}`}
          />
          {section.journalHint.message}
        </div>
      )}
    </div>
  );
}

function KpiGroupCard({ group }: { group: IndustryKpiGroup }) {
  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5"
      data-testid={`kpi-group-${group.id}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            {group.label}
          </h3>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-gray">
            {group.descriptionContabil}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-dark-3">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-dark-3 bg-dark-1/40">
              <th className="w-8 py-2.5 px-3" />
              <th className="border-r border-white/[0.04] py-2.5 px-3 text-left font-mono text-[0.6rem] font-medium uppercase tracking-wider text-gray">
                Indicator
              </th>
              <th className="border-r border-white/[0.04] py-2.5 px-3 text-right font-mono text-[0.6rem] font-medium uppercase tracking-wider text-gray">
                Valoare
              </th>
              <th className="border-r border-white/[0.04] py-2.5 px-3 text-right font-mono text-[0.6rem] font-medium uppercase tracking-wider text-gray">
                Tinta
              </th>
              <th className="py-2.5 px-3 text-left font-mono text-[0.6rem] font-medium uppercase tracking-wider text-gray">
                Stare
              </th>
            </tr>
          </thead>
          <tbody>
            {group.kpis.map((kpi) => (
              <KpiRow key={kpi.id} kpi={kpi} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KpiRow({ kpi }: { kpi: IndustryKpi }) {
  const [open, setOpen] = useState(false);
  const style = STATE_STYLES[kpi.state];

  return (
    <>
      <tr
        className="cursor-pointer border-b border-dark-3/50 hover:bg-dark-2/40"
        onClick={() => setOpen((o) => !o)}
        data-testid={`kpi-row-${kpi.id}`}
        role="button"
        aria-expanded={open}
      >
        <td className="py-2.5 px-3 text-gray">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </td>
        <td className="border-r border-white/[0.04] py-2.5 px-3 text-gray-light">
          {kpi.labelContabil}
        </td>
        <td
          className={`border-r border-white/[0.04] py-2.5 px-3 text-right font-mono ${
            kpi.value === null ? "text-gray" : "text-white"
          }`}
        >
          {fmtValue(kpi)}
        </td>
        <td className="border-r border-white/[0.04] py-2.5 px-3 text-right font-mono text-gray">
          {kpi.thresholds?.label ?? "trend"}
        </td>
        <td className="py-2.5 px-3">
          <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${style.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-dark-3/50 bg-dark-1/30">
          <td />
          <td colSpan={4} className="py-3 px-3">
            <KpiDetail kpi={kpi} />
          </td>
        </tr>
      )}
    </>
  );
}

function KpiDetail({ kpi }: { kpi: IndustryKpi }) {
  return (
    <div className="space-y-3 text-[12px]" data-testid={`kpi-detail-${kpi.id}`}>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-gray">Formula</div>
        <div className="mt-0.5 font-mono text-gray-light">{kpi.formulaContabil}</div>
      </div>

      {kpi.unavailableReason ? (
        <div className="flex items-start gap-2 rounded-lg border border-warn/20 bg-warn/5 p-2.5 text-gray-light">
          <Info size={13} className="mt-0.5 shrink-0 text-warn" />
          {kpi.unavailableReason}
        </div>
      ) : (
        <>
          {kpi.inputs.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-gray">
                Valori folosite
              </div>
              <table className="mt-1 w-full max-w-2xl border-collapse">
                <tbody>
                  {kpi.inputs.map((inp) => (
                    <tr key={inp.id} className="border-b border-dark-3/40 align-top">
                      <td className="py-1.5 pr-3 text-gray-light whitespace-nowrap">{inp.label}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-white whitespace-nowrap">
                        {inp.value.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 text-gray">{inp.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {kpi.calculation && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-gray">Calcul</div>
              <div className="mt-0.5 font-mono text-gray-light">{kpi.calculation}</div>
            </div>
          )}
        </>
      )}

      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-gray">Interpretare</div>
        <div className="mt-0.5 max-w-3xl leading-relaxed text-gray-light">
          {kpi.interpretationContabil}
        </div>
      </div>
    </div>
  );
}
