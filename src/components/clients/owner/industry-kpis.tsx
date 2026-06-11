/**
 * IndustryKpis — owner-facing industry-aware KPI catalog.
 *
 * Same visual language as RatiosCatalog, driven by the IndustryKpiSection
 * payload. Antreprenor vocabulary only: every group opens with a plain
 * Romanian explainer of what it measures, and every KPI expands to show
 * what it means, how it was calculated (in words) and the actual numbers
 * used, so the numbers are never a black box.
 */

"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import type {
  IndustryKpi,
  IndustryKpiGroup,
  IndustryKpiSection,
  KpiState,
} from "@/modules/reporting/industry";

const STATE_DOT: Record<KpiState, string> = {
  good: "bg-green",
  neutral: "bg-primary/60",
  warn: "bg-warn",
  danger: "bg-danger",
  unknown: "bg-dark-3",
};

const STATE_VALUE: Record<KpiState, string> = {
  good: "text-green",
  neutral: "text-white",
  warn: "text-warn",
  danger: "text-danger",
  unknown: "text-gray",
};

function formatValue(kpi: IndustryKpi): string {
  if (kpi.value === null || !Number.isFinite(kpi.value)) return "—";
  const v = kpi.value;
  const fmt0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  switch (kpi.format) {
    case "percent":
      return `${fmt1.format(v)}%`;
    case "days":
      return `${fmt0.format(v)} zile`;
    case "lei":
      return `${fmt0.format(Math.round(v))} lei`;
    default:
      return Math.abs(v) >= 100 ? fmt0.format(v) : fmt2.format(v);
  }
}

export function IndustryKpis({ section }: { section: IndustryKpiSection }) {
  return (
    <div
      className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="owner-industry-kpis"
    >
      <div className="mb-5">
        <h3
          className="text-[16px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Indicatorii afacerii tale
        </h3>
        <p
          className="mt-1 max-w-3xl text-[12px] text-gray-light leading-relaxed"
          style={{ letterSpacing: "-0.02em" }}
        >
          Calculati automat din datele firmei, cu praguri potrivite pentru domeniul tau:{" "}
          <span className="font-semibold text-white">{section.industryLabel}</span>.
          Apasa pe orice indicator ca sa vezi ce inseamna si cum a fost calculat.
        </p>
      </div>

      <div className="space-y-5">
        {section.groups.map((group) =>
          group.kpis.length > 0 ? <KpiGroup key={group.id} group={group} /> : null
        )}
      </div>
    </div>
  );
}

function KpiGroup({ group }: { group: IndustryKpiGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <div data-testid={`owner-kpi-group-${group.id}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 pb-2 text-left transition-colors hover:text-white"
      >
        <div className="min-w-0">
          <span
            className="font-mono text-[11px] font-semibold uppercase text-gray-light"
            style={{ letterSpacing: "0.04em" }}
          >
            {group.label}
          </span>
          <p
            className="mt-0.5 max-w-3xl text-[12px] text-gray leading-relaxed"
            style={{ letterSpacing: "-0.02em" }}
          >
            {group.descriptionAntreprenor}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-dark-3/60 border-t border-dark-3/60">
          {group.kpis.map((kpi) => (
            <KpiRow key={kpi.id} kpi={kpi} />
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiRow({ kpi }: { kpi: IndustryKpi }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="-mx-2 flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-dark-3/30"
        data-testid={`owner-kpi-row-${kpi.id}`}
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATE_DOT[kpi.state]}`} aria-hidden />
          <div className="min-w-0">
            <div
              className="truncate text-[14px] font-medium text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              {kpi.labelAntreprenor}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-[16px] font-semibold tabular-nums ${STATE_VALUE[kpi.state]}`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {kpi.value === null ? "in curand" : formatValue(kpi)}
          </div>
          {kpi.thresholds && kpi.value !== null && (
            <div className="font-mono text-[10px] text-gray" style={{ letterSpacing: "0.04em" }}>
              tinta {kpi.thresholds.label}
            </div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="mb-3 ml-5 -mt-1 space-y-2 rounded-md border-l-2 border-primary/40 bg-dark-3/30 px-3 py-2.5">
          <p
            className="text-[12px] leading-relaxed text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {kpi.interpretationAntreprenor}
          </p>
          {kpi.value !== null ? (
            <>
              <p className="text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
                <span className="font-mono text-[10px] uppercase tracking-wide">Cum se calculeaza:</span>{" "}
                {kpi.formulaAntreprenor}.
              </p>
              {kpi.calculation && (
                <p className="font-mono text-[11px] text-gray" data-testid={`owner-kpi-calc-${kpi.id}`}>
                  {kpi.calculation}
                </p>
              )}
            </>
          ) : (
            <p className="flex items-start gap-1.5 text-[12px] text-gray">
              <Info size={12} className="mt-0.5 shrink-0" />
              {kpi.unavailableReason ?? "Indisponibil pentru aceasta perioada."}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
