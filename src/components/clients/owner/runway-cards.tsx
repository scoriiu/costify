/**
 * Two side-by-side cards: Runway + Salary Affordability.
 *
 *  - Runway: "Cati bani iti ajung daca nu mai intra nimic" (cash / burn rate)
 *  - Salary affordability: "Cate luni de salarii poti acoperi din cash"
 *
 * Tone color follows the `status` field, never raw thresholds in the JSX.
 */

import { TrendingDown, Users } from "lucide-react";
import type { RunwayProjection, SalaryAffordability } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface Props {
  runway: RunwayProjection;
  salary: SalaryAffordability;
}

export function RunwayAndSalaryCards({ runway, salary }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <RunwayCard runway={runway} />
      <SalaryAffordabilityCard salary={salary} />
    </div>
  );
}

function formatMonths(months: number): string {
  if (!Number.isFinite(months) || months > 999) return "peste 999 luni";
  if (months >= 1) {
    const whole = Math.floor(months);
    if (whole === months) return `${whole} ${whole === 1 ? "luna" : "luni"}`;
    return `${months.toFixed(1)} luni`;
  }
  const weeks = Math.round(months * 4.3);
  return `~${weeks} saptamani`;
}

function toneClasses(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case "comfortable":
      return { bg: "bg-emerald-500/10 border-emerald-400/20", text: "text-emerald-300", label: "Confortabil" };
    case "tight":
      return { bg: "bg-amber-300/10 border-amber-300/20", text: "text-amber-300", label: "Atentie" };
    case "critical":
      return { bg: "bg-rose-500/10 border-rose-400/20", text: "text-rose-300", label: "Critic" };
    default:
      return { bg: "bg-dark-2 border-dark-3", text: "text-gray", label: "Insuficient istoric" };
  }
}

function RunwayCard({ runway }: { runway: RunwayProjection }) {
  const tone = toneClasses(runway.status);

  return (
    <div className={`rounded-xl border p-5 ${tone.bg}`}>
      <div className="flex items-center gap-2.5">
        <TrendingDown size={14} className={tone.text} />
        <h3
          className="text-[14px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Cati bani iti ajung
        </h3>
      </div>
      <div className="mt-4">
        <p
          className="font-mono text-[28px] font-medium text-white tabular-nums"
          style={{ letterSpacing: "-0.04em" }}
        >
          {runway.status === "unknown" ? "—" : formatMonths(runway.monthsRemaining)}
        </p>
        <p
          className={`mt-1 text-[11px] font-mono uppercase tracking-wider ${tone.text}`}
        >
          {tone.label}
        </p>
      </div>
      <dl className="mt-4 space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-gray">Bani disponibili</dt>
          <dd className="font-mono text-gray-light tabular-nums">{lei(runway.cashAvailable)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray">Cheltuieli medii / luna</dt>
          <dd className="font-mono text-gray-light tabular-nums">{lei(runway.monthlyBurnRate)}</dd>
        </div>
      </dl>
      <p
        className="mt-3 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Media ultimelor {runway.windowMonths} luni de cheltuieli, fara venituri noi.
      </p>
    </div>
  );
}

function SalaryAffordabilityCard({ salary }: { salary: SalaryAffordability }) {
  const tone = toneClasses(salary.status);

  if (salary.status === "no_payroll") {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex items-center gap-2.5">
          <Users size={14} className="text-gray" />
          <h3
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Salarii
          </h3>
        </div>
        <p
          className="mt-4 text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Firma nu are salarii inregistrate luna aceasta.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-5 ${tone.bg}`}>
      <div className="flex items-center gap-2.5">
        <Users size={14} className={tone.text} />
        <h3
          className="text-[14px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Cate salarii poti plati
        </h3>
      </div>
      <div className="mt-4">
        <p
          className="font-mono text-[28px] font-medium text-white tabular-nums"
          style={{ letterSpacing: "-0.04em" }}
        >
          {formatMonths(salary.monthsCovered)}
        </p>
        <p
          className={`mt-1 text-[11px] font-mono uppercase tracking-wider ${tone.text}`}
        >
          {tone.label}
        </p>
      </div>
      <dl className="mt-4 space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-gray">Bani disponibili</dt>
          <dd className="font-mono text-gray-light tabular-nums">{lei(salary.cashAvailable)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray">Salarii luna asta</dt>
          <dd className="font-mono text-gray-light tabular-nums">{lei(salary.monthlyPayroll)}</dd>
        </div>
      </dl>
    </div>
  );
}
