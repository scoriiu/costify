import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isInternalUser } from "@/lib/internal-access";
import { getKpiCoverage, type KpiCoverageRow, type CoverageStatus } from "@/modules/reporting/industry/coverage";

export const metadata = { title: "KPI Coverage" };

const STATUS_META: Record<CoverageStatus, { label: string; className: string }> = {
  computed: { label: "Calculat", className: "bg-green/5 border-green/20 text-green" },
  placeholder: { label: "Date operationale", className: "bg-warn/5 border-warn/20 text-warn" },
  omitted: { label: "Neimplementat", className: "bg-dark-3/40 border-dark-3 text-gray" },
};

export default async function KpiCoveragePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isInternalUser(user.email)) redirect("/clients");

  const report = getKpiCoverage();
  const pct = Math.round((report.totals.computed / report.totals.total) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <Link
        href="/internal"
        className="inline-flex items-center gap-1.5 text-[13px] text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Internal
      </Link>
      <h1 className="mt-3 text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        KPI Coverage
      </h1>
      <p className="mt-2 max-w-3xl text-[14px] text-gray" style={{ letterSpacing: "-0.02em" }}>
        Reconcilierea specificatiilor din docs/kpi (KPI_Formule_CFO.xlsx,
        Checklist_Controlling_Industrii.xlsx) cu registrul implementat. Statusul
        e derivat live din registru, nu e scris de mana.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total spec" value={report.totals.total} />
        <SummaryCard label="Calculate" value={report.totals.computed} tone="text-green" suffix={` (${pct}%)`} />
        <SummaryCard label="Asteapta date op." value={report.totals.placeholder} tone="text-warn" />
        <SummaryCard label="Neimplementate" value={report.totals.omitted} />
      </div>

      {report.sections.map((section) => (
        <CoverageTable
          key={`${section.source}-${section.title}`}
          title={section.title}
          source={section.source}
          rows={section.rows}
        />
      ))}

      {report.extraRows.length > 0 && (
        <CoverageTable
          title="In plus fata de specificatii"
          source="Registru Costify"
          rows={report.extraRows}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "text-white",
  suffix = "",
}: {
  label: string;
  value: number;
  tone?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-4">
      <p className="font-mono text-[11px] uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>
        {label}
      </p>
      <p className={`mt-1 font-mono text-[22px] font-semibold ${tone}`}>
        {value}
        {suffix && <span className="text-[13px] font-normal text-gray">{suffix}</span>}
      </p>
    </div>
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
              <tr key={row.specName} className="border-b border-dark-3/50 last:border-b-0 hover:bg-dark-2/40">
                <td className="py-2 px-3 text-[13px] text-gray-light border-r border-white/[0.04]">
                  {row.specName}
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
