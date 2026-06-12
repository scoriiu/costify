"use client";

/**
 * CoverageExplorer — interactive body of /internal/kpi-coverage.
 *
 * Client-side because the matrix is small (~115 rows) and the two
 * affordances are pure UI state: a search box filtering across every
 * section, and click-to-expand rows revealing the full formula trace
 * (OMFP formula, owner formula, inputs with their balance sources,
 * threshold, interpretation) for any KPI that exists in the registry.
 */

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import type {
  KpiCoverageReport,
  KpiCoverageRow,
  CoverageStatus,
} from "@/modules/reporting/industry/coverage";

const STATUS_META: Record<CoverageStatus, { label: string; className: string }> = {
  computed: { label: "Calculat", className: "bg-green/5 border-green/20 text-green" },
  placeholder: { label: "Date operationale", className: "bg-warn/5 border-warn/20 text-warn" },
  omitted: { label: "Neimplementat", className: "bg-dark-3/40 border-dark-3 text-gray" },
};

function rowMatches(row: KpiCoverageRow, q: string): boolean {
  const haystack = [
    row.specName,
    row.registryId,
    row.appLabel,
    row.note,
    row.detail?.labelAntreprenor,
    row.detail?.formulaContabil,
    row.detail?.formulaAntreprenor,
    row.detail?.group,
    ...(row.detail?.inputs.flatMap((i) => [i.label, i.source]) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CoverageExplorer({ report }: { report: KpiCoverageReport }) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const all = [
      ...report.sections,
      ...(report.extraRows.length > 0
        ? [{ source: "Registru Costify", title: "In plus fata de specificatii", rows: report.extraRows }]
        : []),
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all
      .map((s) => ({ ...s, rows: s.rows.filter((r) => rowMatches(r, q)) }))
      .filter((s) => s.rows.length > 0);
  }, [report, query]);

  const matchCount = useMemo(
    () => sections.reduce((acc, s) => acc + s.rows.length, 0),
    [sections]
  );

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cauta KPI, formula, cont..."
          />
        </div>
        {query.trim() && (
          <p className="font-mono text-[11px] uppercase text-gray" data-testid="coverage-match-count">
            {matchCount} {matchCount === 1 ? "rezultat" : "rezultate"}
          </p>
        )}
      </div>

      {sections.length === 0 && (
        <p className="mt-8 text-[13px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Niciun KPI nu se potriveste cautarii.
        </p>
      )}

      {sections.map((section) => (
        <CoverageTable
          key={`${section.source}-${section.title}`}
          title={section.title}
          source={section.source}
          rows={section.rows}
        />
      ))}
    </>
  );
}

function CoverageTable({
  title,
  source,
  rows,
}: {
  title: string;
  source: string;
  rows: KpiCoverageRow[];
}) {
  const computed = rows.filter((r) => r.status === "computed").length;
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          {title}
        </h2>
        <p className="font-mono text-[11px] uppercase text-gray">
          {source} · {computed}/{rows.length} calculate
        </p>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-dark-3 bg-dark-2">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-dark-3">
              <th className="py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray border-r border-white/[0.04]">
                KPI din spec
              </th>
              <th className="py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray border-r border-white/[0.04]">
                Status
              </th>
              <th className="py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray border-r border-white/[0.04]">
                In aplicatie
              </th>
              <th className="py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray">
                Nota
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CoverageRow key={row.specName} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoverageRow({ row }: { row: KpiCoverageRow }) {
  const [open, setOpen] = useState(false);
  const expandable = row.detail !== null;

  return (
    <>
      <tr
        className={`border-b border-dark-3/50 last:border-b-0 hover:bg-dark-2/40 ${
          expandable ? "cursor-pointer" : ""
        }`}
        onClick={expandable ? () => setOpen((v) => !v) : undefined}
        role={expandable ? "button" : undefined}
        data-testid={row.registryId ? `coverage-row-${row.registryId}` : undefined}
      >
        <td className="py-2 px-3 text-[13px] text-gray-light border-r border-white/[0.04]">
          <span className="flex items-center gap-1.5">
            {expandable && (
              <ChevronDown
                size={12}
                className={`shrink-0 text-gray transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
              />
            )}
            {row.specName}
          </span>
        </td>
        <td className="py-2 px-3 border-r border-white/[0.04]">
          <span
            className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS_META[row.status].className}`}
          >
            {STATUS_META[row.status].label}
          </span>
        </td>
        <td className="py-2 px-3 font-mono text-[12px] text-gray-light border-r border-white/[0.04]">
          {row.registryId ?? ""}
        </td>
        <td className="py-2 px-3 text-[12px] leading-relaxed text-gray">{row.note ?? ""}</td>
      </tr>
      {open && row.detail && (
        <tr className="border-b border-dark-3/50 last:border-b-0 bg-dark/30">
          <td colSpan={4} className="py-3 px-3">
            <DetailPanel row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetailPanel({ row }: { row: KpiCoverageRow }) {
  const d = row.detail!;
  return (
    <div
      className="ml-5 space-y-3 border-l-2 border-primary/40 pl-4 text-[12px]"
      data-testid={`coverage-detail-${row.registryId}`}
    >
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <Field label="Grup">
          <span className="font-mono text-[11px] uppercase text-gray-light">{d.group}</span>
        </Field>
        {d.thresholdLabel && (
          <Field label="Tinta">
            <span className="font-mono text-[11px] text-gray-light">{d.thresholdLabel}</span>
          </Field>
        )}
        <Field label="Pentru antreprenor">
          <span className="text-gray-light">{d.labelAntreprenor}</span>
        </Field>
      </div>

      <Field label="Formula (contabil)">
        <p className="rounded-md border border-dark-3/80 bg-dark/40 px-3 py-2 font-mono text-[11.5px] text-white">
          {d.formulaContabil}
        </p>
      </Field>

      <Field label="Formula (antreprenor)">
        <span className="text-gray-light">{d.formulaAntreprenor}</span>
      </Field>

      {d.inputs.length > 0 && (
        <Field label="Valori folosite (sursa din balanta)">
          <table className="mt-1 w-full max-w-3xl border-collapse">
            <tbody>
              {d.inputs.map((inp) => (
                <tr key={inp.label} className="border-b border-dark-3/40 align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-gray-light">{inp.label}</td>
                  <td className="py-1.5 text-gray">{inp.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Field>
      )}

      {d.unavailableReason && (
        <Field label="De ce e indisponibil">
          <span className="text-warn">{d.unavailableReason}</span>
        </Field>
      )}

      <Field label="Interpretare">
        <span className="max-w-3xl leading-relaxed text-gray-light">{d.interpretationContabil}</span>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-gray">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
