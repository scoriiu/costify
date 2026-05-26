/**
 * OwnerView (home / acasa) — the firma's overview page.
 *
 * Information architecture follows docs/dashboard-spec-unificat:
 *
 *   1. PageHeader               — title + period + trust badge
 *   2. VerdictBanner            — §6 1-paragraph narrative
 *   3. KpiStrip                 — §6 6 power-KPIs
 *   4. HeroSummary              — cash + 3 supporting metrics
 *   5. HealthScoreCard          — §10 composite + 4 subscores
 *   6. CashflowSplitChart       — §8 Operating / Investing / Financing
 *   7. CashflowWaterfall        — month flow Inceput → Final
 *   8. EvolutionChart           — last 12 months, interactive
 *   9. YoyComparison            — vs same month a year ago
 *  10. PnlWaterfall             — §9 Venituri → Profit net stepped
 *  11. Two-up: CategoryBreakdown — expenses + revenue interactive donuts
 *  12. Two-up: TopActivityList   — incasari clienti + plati furnizori
 *  13. TopExpensesList          — biggest single payments
 *  14. VerticalBreakdownCard    — per-business-line decomposition
 *  15. Two-up: ObligationsCalendar + CashPositionCard
 *  16. OutstandingTables        — clienti + furnizori with restante
 *  17. OwnerWithdrawalsCard     — money between owner and firm
 *  18. RatiosCatalog            — §10 L2 ratios accordion
 *  19. InsightsList             — semantic flags
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
import { HealthScoreCard } from "./health-score-card";
import { CashflowWaterfall } from "./cashflow-waterfall";
import { CashflowSplitChart } from "./cashflow-split-chart";
import { CashPositionCard } from "./cash-position-card";
import { OwnerWithdrawalsCard } from "./owner-withdrawals-card";
import { EvolutionChart } from "./evolution-chart";
import { OutstandingTable } from "./outstanding-table";
import { InsightsList } from "./insights-list";
import { CategoryBreakdownCard } from "./category-breakdown-card";
import { TopExpensesList } from "./top-expenses-list";
import { YoyComparison } from "./yoy-comparison";
import { VerticalBreakdownCard } from "./vertical-breakdown-card";
import { SectionQuickNav } from "./section-quick-nav";
import { VerdictBanner } from "./verdict-banner";
import { KpiStrip } from "./kpi-strip";
import { PnlWaterfall } from "./pnl-waterfall";
import { TopActivityList } from "./top-activity-list";
import { ObligationsCalendar } from "./obligations-calendar";
import { RatiosCatalog } from "./ratios-catalog";
import { PeriodSelector, type PeriodOption } from "./period-selector";
import { ViewModeToggle, type ViewMode } from "./view-mode-toggle";

interface OwnerViewProps {
  snapshot: OwnerSnapshot;
  context: OwnerContext;
  marjaOperationala?: number | null;
  /** Published periods available for the period selector. When empty, the
   *  selector is hidden. */
  availablePeriods?: PeriodOption[];
  /** Currently displayed mode. Defaults to "simple". */
  mode?: ViewMode;
}

export function OwnerView({
  snapshot,
  context,
  marjaOperationala,
  availablePeriods = [],
  mode = "simple",
}: OwnerViewProps) {
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
    runway: _runway,
    salaryAffordability: _salaryAffordability,
    yoy,
    verticalBreakdown,
    dataQuality,
    verdict,
    kpiStrip,
    cashflowBreakdown,
    obligations,
    healthScore,
    ratios,
    topCustomersByActivity,
    topSuppliersByActivity,
  } = snapshot;

  const period = monthLabel(meta.year, meta.month);

  return (
    <>
      <PageHeader
        eyebrow={period}
        title={`Cum sta ${meta.name}`}
        subtitle="O privire rapida peste bani, clienti, datorii si profit. Datele se actualizeaza dupa fiecare upload de jurnal."
        actions={
          <>
            <ViewModeToggle mode={mode} />
            {availablePeriods.length > 0 && (
              <PeriodSelector
                currentYear={meta.year}
                currentMonth={meta.month}
                options={availablePeriods}
              />
            )}
            {dataQuality && (
              <TrustBadge
                coveragePercent={dataQuality.coveragePercent}
                partnerOverrideCount={dataQuality.partnerOverrideCount}
                hasAnyReview={dataQuality.hasAnyReview}
              />
            )}
          </>
        }
      />

      <SectionQuickNav
        items={buildNavItems({
          hasYoy: yoy.hasPreviousYear,
          hasVerticals: verticalBreakdown.length > 0,
          hasInsights: insights.length > 0,
          hasObligations: obligations.length > 0,
          hasRatios: mode === "detailed",
        })}
      />

      {/* §6 — Verdict narativ */}
      <Section id="verdict" className="mb-6">
        <VerdictBanner verdict={verdict} />
      </Section>

      {/* §6 — KPI strip */}
      {kpiStrip.length > 0 && (
        <Section id="kpis" className="mb-8">
          <KpiStrip items={kpiStrip} />
        </Section>
      )}

      {/* Hero — cash + 3 metrics */}
      <Section id="hero" className="mb-8">
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

      {/* §10 — Health score composite */}
      <SectionWithLink
        id="sanatate"
        href={buildPageHref(context, "sanatate")}
        label="Vezi toti indicatorii"
        className="mb-8"
      >
        <HealthScoreCard data={healthScore} />
      </SectionWithLink>

      {/* §8 — Operating/Investing/Financing split */}
      <Section id="cashflow-split" className="mb-8">
        <CashflowSplitChart data={cashflowBreakdown} />
      </Section>

      {/* §8 — Cashflow waterfall (Inceput → Final) */}
      <Section id="cashflow" className="mb-8">
        <CashflowWaterfall trends={trends} />
      </Section>

      {/* §7 — Evolution chart */}
      <SectionWithLink
        id="evolutie"
        href={buildPageHref(context, "evolutie")}
        label="Vezi evolutie completa"
        className="mb-8"
      >
        <EvolutionChart data={trends} />
      </SectionWithLink>

      {/* §7 — YoY */}
      {yoy.hasPreviousYear && (
        <Section id="yoy" className="mb-8">
          <YoyComparison yoy={yoy} />
        </Section>
      )}

      {/* §9 — P&L waterfall */}
      <Section id="profit" className="mb-8">
        <PnlWaterfall summary={summary} expenseBreakdown={expenseBreakdown} />
      </Section>

      {/* §9 — Categories: where money came from + went */}
      <Section id="breakdowns" className="mb-8">
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

      {/* §9 — Top customers + suppliers by ACTIVITY this month */}
      <Section id="top-activity" className="mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TopActivityList
            title="Cine ti-a dat bani luna asta"
            subtitle="Clientii care ti-au platit cele mai mari sume."
            partners={topCustomersByActivity}
            flow="in"
            emptyMessage="Nicio incasare semnificativa de la clienti luna asta."
          />
          <TopActivityList
            title="Cui i-ai dat tu bani luna asta"
            subtitle="Furnizorii catre care s-au facut cele mai mari plati."
            partners={topSuppliersByActivity}
            flow="out"
            emptyMessage="Nicio plata semnificativa catre furnizori luna asta."
          />
        </div>
      </Section>

      {/* Top single expenses */}
      <Section id="top-cheltuieli" className="mb-8">
        <TopExpensesList
          items={topMonthlyExpenses}
          subtitle="Cele mai mari plati individuale ale lunii, ordonate descrescator."
        />
      </Section>

      {/* Verticals */}
      {verticalBreakdown.length > 0 && (
        <Section id="verticals" className="mb-8">
          <VerticalBreakdownCard items={verticalBreakdown} periodLabel={period} />
        </Section>
      )}

      {/* §11 — Obligations calendar + cash position */}
      <Section id="obligations" className="mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ObligationsCalendar items={obligations} />
          <CashPositionCard data={cashPosition} />
        </div>
      </Section>

      {/* §11 — Outstanding partners */}
      <Section id="parteneri" className="mb-8">
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

      {/* Owner withdrawals */}
      <SectionWithLink
        id="eu"
        href={buildPageHref(context, "eu")}
        label="Vezi istoricul complet"
        className="mb-8"
      >
        <OwnerWithdrawalsCard data={ownerWithdrawals} />
      </SectionWithLink>

      {/* §10 — Detailed ratios catalog (L2 only) */}
      {mode === "detailed" && (
        <Section id="ratios" className="mb-8">
          <RatiosCatalog ratios={ratios} />
        </Section>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <SectionWithLink
          id="insights"
          href={buildPageHref(context, "sanatate")}
          label="Vezi toate semnalele"
          className="mb-8"
        >
          <InsightsList insights={insights} />
        </SectionWithLink>
      )}

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
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className ?? ""}`}>
      {children}
    </section>
  );
}

function SectionWithLink({
  id,
  href,
  label,
  children,
  className,
}: {
  id?: string;
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className ?? ""}`}>
      <div className="space-y-2">
        {children}
        <SectionLink href={href} label={label} />
      </div>
    </section>
  );
}

function buildNavItems({
  hasYoy,
  hasVerticals,
  hasInsights,
  hasObligations,
  hasRatios,
}: {
  hasYoy: boolean;
  hasVerticals: boolean;
  hasInsights: boolean;
  hasObligations: boolean;
  hasRatios: boolean;
}): Array<{ id: string; label: string }> {
  const items: Array<{ id: string; label: string }> = [
    { id: "verdict", label: "Pe scurt" },
    { id: "hero", label: "Privire" },
    { id: "sanatate", label: "Scor sanatate" },
    { id: "cashflow-split", label: "Cash O/I/F" },
    { id: "evolutie", label: "Evolutie" },
  ];
  if (hasYoy) items.push({ id: "yoy", label: "An vs an" });
  items.push(
    { id: "profit", label: "P&L" },
    { id: "breakdowns", label: "Categorii" },
    { id: "top-activity", label: "Top clienti" },
    { id: "top-cheltuieli", label: "Top plati" }
  );
  if (hasVerticals) items.push({ id: "verticals", label: "Linii" });
  if (hasObligations) items.push({ id: "obligations", label: "De platit" });
  items.push(
    { id: "parteneri", label: "Parteneri" },
    { id: "eu", label: "Eu si firma" }
  );
  if (hasRatios) items.push({ id: "ratios", label: "Indicatori" });
  if (hasInsights) items.push({ id: "insights", label: "Semnale" });
  return items;
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
