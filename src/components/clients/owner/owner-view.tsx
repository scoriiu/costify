/**
 * OwnerView (home / acasa) — the firma's overview page.
 *
 * Renders inside OwnerLayout. Information architecture:
 *
 *   1. PageHeader — title + period + trust badge
 *   2. HeroSummary — cash + 3 supporting metrics (clicks into detail pages)
 *   3. HealthPulse — 3-ring vitals (runway, salary, margin)
 *   4. CashflowWaterfall — how the month moved cash
 *   5. EvolutionChart — last 12 months, interactive
 *   6. YoyComparison — vs same month a year ago
 *   7. Two-up: CategoryBreakdown expenses + revenue (interactive donuts)
 *   8. TopExpensesList — biggest single payments
 *   9. VerticalBreakdownCard — per-business-line decomposition
 *  10. CashPositionCard — disponibil vs obligatii
 *  11. OutstandingTables — clienti + furnizori
 *  12. OwnerWithdrawalsCard — money between owner and firm
 *  13. InsightsList — semantic flags
 *
 * Each block links to its detail page so the antreprenor can drill in.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OwnerSnapshot } from "@/modules/reporting/owner";
import type { OwnerContext } from "./owner-layout";
import { buildPageHref } from "./owner-context";
import { monthLabel } from "@/lib/owner-format";
import { PageHeader } from "./page-header";
import { TrustBadge } from "./trust-badge";
import { HeroSummary } from "./hero-summary";
import { HealthPulse } from "./health-pulse";
import { CashflowWaterfall } from "./cashflow-waterfall";
import { CashPositionCard } from "./cash-position-card";
import { OwnerWithdrawalsCard } from "./owner-withdrawals-card";
import { EvolutionChart } from "./evolution-chart";
import { OutstandingTable } from "./outstanding-table";
import { InsightsList } from "./insights-list";
import { CategoryBreakdownCard } from "./category-breakdown-card";
import { TopExpensesList } from "./top-expenses-list";
import { YoyComparison } from "./yoy-comparison";
import { VerticalBreakdownCard } from "./vertical-breakdown-card";

interface OwnerViewProps {
  snapshot: OwnerSnapshot;
  context: OwnerContext;
  marjaOperationala?: number | null;
}

export function OwnerView({ snapshot, context, marjaOperationala }: OwnerViewProps) {
  const {
    meta,
    summary,
    cashPosition,
    ownerWithdrawals,
    trends,
    insights,
    outstanding,
    expenseBreakdown,
    revenueBreakdown,
    topMonthlyExpenses,
    runway,
    salaryAffordability,
    yoy,
    verticalBreakdown,
    dataQuality,
  } = snapshot;

  const period = monthLabel(meta.year, meta.month);

  return (
    <>
      <PageHeader
        eyebrow={period}
        title={`Cum sta ${meta.name}`}
        subtitle="O privire rapida peste bani, clienti, datorii si profit. Datele se actualizeaza dupa fiecare upload de jurnal."
        actions={
          dataQuality ? (
            <TrustBadge
              coveragePercent={dataQuality.coveragePercent}
              partnerOverrideCount={dataQuality.partnerOverrideCount}
              hasAnyReview={dataQuality.hasAnyReview}
            />
          ) : undefined
        }
      />

      {/* 1. Hero — cash + 3 metrics */}
      <Section className="mb-8">
        <HeroSummary
          summary={summary}
          trends={trends}
          outstandingClientiCount={outstanding.clienti.length}
          outstandingFurnizoriCount={outstanding.furnizori.length}
          yoy={yoy}
          marjaOperationala={marjaOperationala ?? null}
          hrefs={{
            bani: buildPageHref(context, "bani"),
            clienti: buildPageHref(context, "clienti"),
            furnizori: buildPageHref(context, "furnizori"),
            profit: buildPageHref(context, "profit"),
          }}
        />
      </Section>

      {/* 2. Vital signs — runway, salary, margin */}
      <Section className="mb-8">
        <HealthPulse
          runway={runway}
          salary={salaryAffordability}
          margin={marjaOperationala ?? null}
        />
      </Section>

      {/* 3. Cashflow waterfall — how this month moved cash */}
      <Section className="mb-8">
        <CashflowWaterfall trends={trends} />
      </Section>

      {/* 4. Evolution chart — 12 months */}
      <SectionWithLink
        href={buildPageHref(context, "evolutie")}
        label="Vezi evolutie completa"
        className="mb-8"
      >
        <EvolutionChart data={trends} />
      </SectionWithLink>

      {/* 5. YoY (hidden when no prev-year data) */}
      {yoy.hasPreviousYear && (
        <Section className="mb-8">
          <YoyComparison yoy={yoy} />
        </Section>
      )}

      {/* 6. Where did the money go + come from — two interactive donuts */}
      <Section className="mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CategoryBreakdownCard
            title="Unde s-au dus banii"
            subtitle={`Cheltuielile lunii ${period}, pe categorii.`}
            items={expenseBreakdown}
            tone="expenses"
            emptyMessage="Nicio cheltuiala inregistrata luna aceasta."
          />
          <CategoryBreakdownCard
            title="De unde au venit banii"
            subtitle={`Veniturile lunii ${period}, pe categorii.`}
            items={revenueBreakdown}
            tone="revenue"
            emptyMessage="Niciun venit inregistrat luna aceasta."
          />
        </div>
      </Section>

      {/* 7. Top expenses */}
      <Section className="mb-8">
        <TopExpensesList
          items={topMonthlyExpenses}
          subtitle="Cele mai mari plati ale lunii, ordonate descrescator."
        />
      </Section>

      {/* 8. Verticals (hidden when feature off) */}
      {verticalBreakdown.length > 0 && (
        <Section className="mb-8">
          <VerticalBreakdownCard items={verticalBreakdown} periodLabel={period} />
        </Section>
      )}

      {/* 9. Cash position */}
      <SectionWithLink
        href={buildPageHref(context, "bani")}
        label="Vezi detalii bani"
        className="mb-8"
      >
        <CashPositionCard data={cashPosition} />
      </SectionWithLink>

      {/* 10. Outstanding partners */}
      <Section className="mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <OutstandingTable variant="clienti" partners={outstanding.clienti} />
            <SectionLink href={buildPageHref(context, "clienti")} label="Vezi toti clientii" />
          </div>
          <div className="space-y-2">
            <OutstandingTable variant="furnizori" partners={outstanding.furnizori} />
            <SectionLink href={buildPageHref(context, "furnizori")} label="Vezi toti furnizorii" />
          </div>
        </div>
      </Section>

      {/* 11. Owner withdrawals */}
      <SectionWithLink
        href={buildPageHref(context, "eu")}
        label="Vezi istoricul complet"
        className="mb-8"
      >
        <OwnerWithdrawalsCard data={ownerWithdrawals} />
      </SectionWithLink>

      {/* 12. Insights */}
      <SectionWithLink
        href={buildPageHref(context, "sanatate")}
        label="Vezi toate semnalele"
        className="mb-8"
      >
        <InsightsList insights={insights} />
      </SectionWithLink>

      {/* Footer micro-print */}
      <footer className="border-t border-dark-3 pt-6">
        <p
          className="text-[12px] text-gray max-w-2xl leading-relaxed"
          style={{ letterSpacing: "-0.02em" }}
        >
          Pentru detalii contabile (balanta, plan de conturi, F20), vorbeste cu
          contabilul tau. Acolo gasesti numere oficiale, exact cele depuse la
          ANAF.
        </p>
      </footer>
    </>
  );
}

/* -------------------------- Layout primitives ---------------------------- */

function Section({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={className}>{children}</section>;
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
