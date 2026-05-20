/**
 * OwnerView (home / acasa) — the summary page of the firma module.
 *
 * Renders inside OwnerLayout's content slot. Shows:
 *   - PageHeader: "Cum sta firma in {luna}"
 *   - 4 KPI cards (bani, de primit, de platit, profit)
 *   - Cash position
 *   - Evolution chart
 *   - Outstanding clienti + furnizori
 *   - Owner withdrawals
 *   - Insights
 *
 * Each card/section links to its dedicated detail page (via buildPageHref).
 */

import Link from "next/link";
import { Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, ArrowRight } from "lucide-react";
import type { OwnerSnapshot } from "@/modules/reporting/owner";
import type { OwnerContext } from "./owner-layout";
import { buildPageHref } from "./owner-context";
import { lei, monthLabel } from "@/lib/owner-format";
import { PageHeader } from "./page-header";
import { KpiCard } from "./kpi-card";
import { CashPositionCard } from "./cash-position-card";
import { OwnerWithdrawalsCard } from "./owner-withdrawals-card";
import { EvolutionChart } from "./evolution-chart";
import { OutstandingTable } from "./outstanding-table";
import { InsightsList } from "./insights-list";

interface OwnerViewProps {
  snapshot: OwnerSnapshot;
  context: OwnerContext;
  marjaOperationala?: number | null;
}

export function OwnerView({ snapshot, context, marjaOperationala }: OwnerViewProps) {
  const { meta, summary, cashPosition, ownerWithdrawals, trends, insights, outstanding } = snapshot;

  const totalCash = summary.soldRegistruCasa + summary.soldConturiBancare;
  const profit = summary.cifraAfaceriTotal - summary.cheltuieliTotal;

  const sparkCash = trends.slice(-6).map((t) => t.cashEnd);
  const sparkReceivables = trends.slice(-6).map((t) => t.receivables);
  const sparkPayables = trends.slice(-6).map((t) => t.payables);
  const sparkProfit = trends.slice(-6).map((t) => t.profit);

  let cashHelper: string | undefined;
  if (trends.length >= 2) {
    const last = trends[trends.length - 1];
    const prev = trends[trends.length - 2];
    if (prev.cashEnd > 0) {
      cashHelper =
        last.cashEnd > prev.cashEnd
          ? "In crestere fata de luna trecuta"
          : "In scadere fata de luna trecuta";
    }
  }

  return (
    <>
      <PageHeader
        title={`Cum sta firma in ${monthLabel(meta.year, meta.month)}`}
        subtitle="O privire rapida peste bani, clienti, datorii si profit. Datele sunt actualizate de fiecare data cand contabilul incarca un nou jurnal."
      />

      {/* KPI grid — each card links to its detail page */}
      <section className="mb-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCardLink href={buildPageHref(context, "bani")}>
            <KpiCard
              label="Bani in casa si banca"
              value={lei(totalCash)}
              helper={cashHelper}
              tone="neutral"
              sparkline={sparkCash}
              icon={<Wallet size={14} />}
            />
          </KpiCardLink>
          <KpiCardLink href={buildPageHref(context, "clienti")}>
            <KpiCard
              label="De primit de la clienti"
              value={lei(summary.clientiNeincasati)}
              helper={`${outstanding.clienti.length} clienti cu facturi neincasate`}
              tone="neutral"
              sparkline={sparkReceivables}
              icon={<ArrowDownLeft size={14} />}
            />
          </KpiCardLink>
          <KpiCardLink href={buildPageHref(context, "furnizori")}>
            <KpiCard
              label="De platit furnizorilor"
              value={lei(summary.furnizoriNeachitati)}
              helper={`${outstanding.furnizori.length} furnizori cu facturi neplatite`}
              tone="neutral"
              sparkline={sparkPayables}
              icon={<ArrowUpRight size={14} />}
            />
          </KpiCardLink>
          <KpiCardLink href={buildPageHref(context, "profit")}>
            <KpiCard
              label="Profit anul acesta"
              value={lei(profit)}
              helper={
                marjaOperationala !== undefined && marjaOperationala !== null
                  ? `Marja ${marjaOperationala.toFixed(1)}% din vanzari`
                  : undefined
              }
              tone={profit >= 0 ? "positive" : "negative"}
              sparkline={sparkProfit}
              icon={<TrendingUp size={14} />}
            />
          </KpiCardLink>
        </div>
      </section>

      <SectionWithLink href={buildPageHref(context, "bani")} label="Vezi detalii bani" className="mb-10">
        <CashPositionCard data={cashPosition} />
      </SectionWithLink>

      <SectionWithLink href={buildPageHref(context, "evolutie")} label="Vezi evolutie completa" className="mb-10">
        <EvolutionChart data={trends} />
      </SectionWithLink>

      <section className="mb-10">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <OutstandingTable variant="clienti" partners={outstanding.clienti} />
            <SectionLink href={buildPageHref(context, "clienti")} label="Vezi toti clientii" />
          </div>
          <div className="space-y-2">
            <OutstandingTable variant="furnizori" partners={outstanding.furnizori} />
            <SectionLink href={buildPageHref(context, "furnizori")} label="Vezi toti furnizorii" />
          </div>
        </div>
      </section>

      <SectionWithLink href={buildPageHref(context, "eu")} label="Vezi istoricul complet" className="mb-10">
        <OwnerWithdrawalsCard data={ownerWithdrawals} />
      </SectionWithLink>

      <SectionWithLink href={buildPageHref(context, "sanatate")} label="Vezi toate semnalele" className="mb-10">
        <InsightsList insights={insights} />
      </SectionWithLink>

      <section className="border-t border-dark-3 pt-6">
        <p
          className="text-[12px] text-gray max-w-2xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          Pentru detalii contabile (balanta, plan de conturi, F20), vorbeste cu contabilul tau. Acolo
          gasesti numere oficiale, exact cele depuse la ANAF.
        </p>
      </section>
    </>
  );
}

function KpiCardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {children}
    </Link>
  );
}

function SectionWithLink({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="space-y-2">
        {children}
        <SectionLink href={href} label={label} />
      </div>
    </section>
  );
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex justify-end">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-light hover:text-primary transition-colors"
        style={{ letterSpacing: "-0.02em" }}
      >
        {label}
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}
