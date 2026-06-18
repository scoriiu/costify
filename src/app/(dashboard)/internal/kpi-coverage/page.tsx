import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isInternalUser } from "@/lib/internal-access";
import { getKpiCoverage, countUnlocked } from "@/modules/reporting/industry/coverage";
import { CoverageExplorer } from "./coverage-explorer";

export const metadata = { title: "KPI Coverage" };

export default async function KpiCoveragePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isInternalUser(user.email)) redirect("/clients");

  const report = getKpiCoverage();
  const pct = Math.round((report.totals.computed / report.totals.total) * 100);
  const employeeUnlocks = countUnlocked(new Set(["numberOfEmployees"]));

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
        e derivat live din registru, nu e scris de mana. Apasa pe un KPI
        implementat ca sa vezi formula completa si sursele din balanta.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total spec" value={report.totals.total} />
        <SummaryCard label="Calculate" value={report.totals.computed} tone="text-green" suffix={` (${pct}%)`} />
        <SummaryCard label="Asteapta date op." value={report.totals.placeholder} tone="text-warn" />
        <SummaryCard label="Neimplementate" value={report.totals.omitted} />
      </div>

      <div className="mt-4 rounded-xl border border-blue/20 bg-blue/5 p-4">
        <p className="text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          Daca am colecta lunar doar{" "}
          <span className="font-semibold text-white">numarul de angajati</span>, ar
          deveni calculabili{" "}
          <span className="font-mono font-semibold text-blue">{employeeUnlocks}</span>{" "}
          indicatori (venituri per angajat si profit per angajat). Vezi toate sursele
          auxiliare mai jos.
        </p>
      </div>

      <CoverageExplorer report={report} />
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
