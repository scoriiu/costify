/**
 * OwnerView (Acasa) — the firma's overview page.
 *
 * ONE scrollable page (Claudia spec §4.1), organized in SIX chapters, each
 * answering one question the patron actually asks. Every "see more" is a
 * drill-down in place (inline expand / in-card month switch), never a
 * navigation away from this page.
 *
 *  1. CUM STA FIRMA        — VerdictBanner + KpiStrip + HeroSummary + HealthScore
 *  2. INDICATORII AFACERII — IndustryKpis (per-industry signal) + RatiosCatalog (L2)
 *  3. LUNA ASTA            — PnlWaterfall + CashflowMap (month-switchable) +
 *                            TopActivity + TopExpenses + Verticals + CashflowCard
 *  4. LUNA DE LUNA         — MonthTimeline (publish dates + notes) + MomTable (L2) +
 *                            EvolutionChart + YoY
 *  5. DE INCASAT, DE PLATIT— Obligations + CashPosition + Outstanding + Runway/Salarii
 *  6. EU SI FIRMA          — OwnerWithdrawals + Patrimoniu + Insights
 */

import type { OwnerSnapshot } from "@/modules/reporting/owner";
import type { OwnerContext } from "./owner-layout";
import { monthLabel } from "@/lib/owner-format";
import { PageHeader } from "./page-header";
import { TrustBadge } from "./trust-badge";
import { HeroSummary } from "./hero-summary";
import { HealthScoreCard } from "./health-score-card";
import { CashflowCard } from "./cashflow-card";
import { CashPositionCard } from "./cash-position-card";
import { OwnerWithdrawalsCard } from "./owner-withdrawals-card";
import { EvolutionChart } from "./evolution-chart";
import { OutstandingTable } from "./outstanding-table";
import { InsightsList } from "./insights-list";
import { CashflowMap } from "./cashflow-map";
import { TopExpensesList } from "./top-expenses-list";
import { YoyComparison } from "./yoy-comparison";
import { VerticalBreakdownCard } from "./vertical-breakdown-card";
import { SectionQuickNavDynamic } from "./section-quick-nav-dynamic";
import { VerdictBanner } from "./verdict-banner";
import { KpiStrip } from "./kpi-strip";
import { PnlWaterfall } from "./pnl-waterfall";
import { TopActivityList } from "./top-activity-list";
import { ObligationsCalendar } from "./obligations-calendar";
import { RatiosCatalog } from "./ratios-catalog";
import { IndustryKpis } from "./industry-kpis";
import { PatrimoniuView } from "./patrimoniu-view";
import { RunwayAndSalaryCards } from "./runway-cards";
import { MonthTimeline, type PublishedMonthMeta } from "./month-timeline";
import { MomTable } from "./mom-table";
import { type PeriodOption } from "./period-selector";
import { StickyPeriodBar } from "./sticky-period-bar";
import {
  ViewModeProvider,
  DetailedOnly,
  type ViewMode,
} from "./view-mode-context";

interface OwnerViewProps {
  snapshot: OwnerSnapshot;
  context: OwnerContext;
  marjaOperationala?: number | null;
  /** Published periods available for the period selector. When empty, the
   *  selector is hidden. */
  availablePeriods?: PeriodOption[];
  /** Publish metadata (date + note per month) for the MonthTimeline and the
   *  in-card month switching. Superset of availablePeriods. */
  publishedMeta?: PublishedMonthMeta[];
  /** Initial mode read from the URL (?mode=simple). After mount, user
   *  preference from localStorage wins. Defaults to "detailed" — the full
   *  L2 surface is the more useful starting point for both the contabil
   *  preview and a first-time owner. */
  mode?: ViewMode;
}

export function OwnerView({
  snapshot,
  context,
  marjaOperationala,
  availablePeriods = [],
  publishedMeta = [],
  mode = "detailed",
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
    runway,
    salaryAffordability,
    yoy,
    verticalBreakdown,
    dataQuality,
    verdict,
    kpiStrip,
    cashflowBreakdown,
    obligations,
    healthScore,
    ratios,
    patrimoniu,
    topCustomersByActivity,
    topSuppliersByActivity,
  } = snapshot;

  const period = monthLabel(meta.year, meta.month);

  const { base: baseNav, tail: tailNav } = buildNavItems({
    hasIndustryKpis: snapshot.industryKpis !== undefined,
    hasVerticals: verticalBreakdown.length > 0,
    hasTimeline: publishedMeta.length > 0,
    hasYoy: yoy.hasPreviousYear,
    hasObligations: obligations.length > 0,
    hasPatrimoniu: patrimoniu.totalActiv !== 0 || patrimoniu.totalPasiv !== 0,
    hasInsights: insights.length > 0,
  });

  // Sticky period bar sits under different chrome depending on context.
  // Preview strip (?view=owner) is 44 px tall → top-11. Owner topbar
  // (/firma) is 56 px tall → top-14. We can't read the parent at runtime
  // so we infer from context.isPreview.
  const stickyTopClass = context.isPreview ? "top-11" : "top-14";

  // The Excel export reads the frozen published snapshot, so the action only
  // makes sense when the viewed month is published (always true on /firma;
  // the preview clamps to published months too, but guard anyway).
  const viewedMonthIsPublished = publishedMeta.some(
    (p) => p.year === meta.year && p.month === meta.month
  );

  return (
    <ViewModeProvider initialMode={mode}>
      <StickyPeriodBar
        year={meta.year}
        month={meta.month}
        availablePeriods={availablePeriods}
        exportClientId={viewedMonthIsPublished ? meta.clientId : undefined}
        topClassName={stickyTopClass}
      />

      <PageHeader
        eyebrow={period}
        title={`Cum sta ${meta.name}`}
        subtitle="O privire rapida peste bani, clienti, datorii si profit. Datele se actualizeaza dupa fiecare upload de jurnal."
        actions={
          dataQuality && (
            <TrustBadge
              coveragePercent={dataQuality.coveragePercent}
              partnerOverrideCount={dataQuality.partnerOverrideCount}
              hasAnyReview={dataQuality.hasAnyReview}
            />
          )
        }
      />

      <SectionQuickNavDynamic
        baseItems={baseNav}
        detailedOnlyItems={[{ id: "ratios", label: "Toti indicatorii" }]}
        insertAfterId="industry-kpis"
        tailItems={tailNav}
      />

      {/* ============ 1. CUM STA FIRMA ============ */}
      <Section id="verdict" className="mb-6">
        <VerdictBanner verdict={verdict} />
      </Section>

      {kpiStrip.length > 0 && (
        <Section id="kpis" className="mb-8">
          <KpiStrip items={kpiStrip} />
        </Section>
      )}

      <Section id="hero" className="mb-8">
        <HeroSummary
          summary={summary}
          trends={trends}
          outstandingClientiCount={outstanding.clienti.length}
          outstandingFurnizoriCount={outstanding.furnizori.length}
          yoy={yoy}
          marjaOperationala={marjaOperationala ?? null}
        />
      </Section>

      <Section id="sanatate" className="mb-10">
        <HealthScoreCard data={healthScore} />
      </Section>

      {/* ============ 2. INDICATORII AFACERII ============ */}
      {snapshot.industryKpis && (
        <>
          <ChapterHeading
            label="Indicatorii afacerii tale"
            description="Cifrele care conteaza pentru tipul tau de activitate, cu praguri si explicatii."
          />
          <Section id="industry-kpis" className="mb-8">
            <IndustryKpis section={snapshot.industryKpis} />
          </Section>
        </>
      )}

      <DetailedOnly>
        <Section id="ratios" className="mb-10">
          <RatiosCatalog ratios={ratios} />
        </Section>
      </DetailedOnly>

      {/* ============ 3. LUNA ASTA IN DETALIU ============ */}
      <ChapterHeading
        label={`Luna asta in detaliu (${period})`}
        description="De unde au venit banii, pe ce s-au dus si cine a contat cel mai mult."
      />

      <Section id="profit" className="mb-8">
        <PnlWaterfall summary={summary} expenseBreakdown={expenseBreakdown} />
      </Section>

      <Section id="breakdowns" className="mb-8">
        <CashflowMap
          expenseBreakdown={expenseBreakdown}
          revenueBreakdown={revenueBreakdown}
          periodLabel={period}
          clientId={meta.clientId}
          currentYear={meta.year}
          currentMonth={meta.month}
          publishedPeriods={publishedMeta}
        />
      </Section>

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

      <Section id="top-cheltuieli" className="mb-8">
        <TopExpensesList
          items={topMonthlyExpenses}
          subtitle="Cele mai mari plati individuale ale lunii, ordonate descrescator."
        />
      </Section>

      {verticalBreakdown.length > 0 && (
        <Section id="verticals" className="mb-8">
          <VerticalBreakdownCard items={verticalBreakdown} periodLabel={period} />
        </Section>
      )}

      <Section id="cashflow" className="mb-10">
        <CashflowCard breakdown={cashflowBreakdown} trends={trends} />
      </Section>

      {/* ============ 4. LUNA DE LUNA ============ */}
      <ChapterHeading
        label="Luna de luna"
        description="Cum a evoluat firma de la o luna la alta, pe lunile publicate de contabil."
      />

      {publishedMeta.length > 0 && (
        <Section id="luni" className="mb-8">
          <MonthTimeline
            trends={trends}
            published={publishedMeta}
            currentYear={meta.year}
            currentMonth={meta.month}
          />
        </Section>
      )}

      <DetailedOnly>
        <Section id="lunar" className="mb-8">
          <MomTable trends={trends} />
        </Section>
      </DetailedOnly>

      <Section id="evolutie" className="mb-8">
        <EvolutionChart data={trends} />
      </Section>

      {yoy.hasPreviousYear && (
        <Section id="yoy" className="mb-10">
          <YoyComparison yoy={yoy} />
        </Section>
      )}

      {/* ============ 5. DE INCASAT, DE PLATIT ============ */}
      <ChapterHeading
        label="De incasat, de platit"
        description="Ce urmeaza sa iasa din firma, cine iti datoreaza bani si cat de departe ajungi cu rezerva actuala."
      />

      <Section id="obligations" className="mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ObligationsCalendar items={obligations} />
          <CashPositionCard data={cashPosition} />
        </div>
      </Section>

      <Section id="parteneri" className="mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <OutstandingTable variant="clienti" partners={outstanding.clienti} />
          <OutstandingTable variant="furnizori" partners={outstanding.furnizori} />
        </div>
      </Section>

      <Section id="rezerve" className="mb-10">
        <RunwayAndSalaryCards runway={runway} salary={salaryAffordability} />
      </Section>

      {/* ============ 6. EU SI FIRMA ============ */}
      <ChapterHeading
        label="Eu si firma"
        description="Relatia ta cu firma si ce detine ea, una sub alta."
      />

      <Section id="eu" className="mb-8">
        <OwnerWithdrawalsCard data={ownerWithdrawals} />
      </Section>

      {(patrimoniu.totalActiv !== 0 || patrimoniu.totalPasiv !== 0) && (
        <Section id="patrimoniu" className="mb-8">
          <PatrimoniuView data={patrimoniu} />
        </Section>
      )}

      {insights.length > 0 && (
        <Section id="insights" className="mb-8">
          <InsightsList insights={insights} />
        </Section>
      )}

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
    </ViewModeProvider>
  );
}

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

function ChapterHeading({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="mb-4 border-b border-dark-3 pb-3">
      <h2
        className="font-mono text-[11px] font-medium uppercase text-primary"
        style={{ letterSpacing: "0.08em" }}
      >
        {label}
      </h2>
      <p className="mt-1 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
        {description}
      </p>
    </div>
  );
}

function buildNavItems({
  hasIndustryKpis,
  hasVerticals,
  hasTimeline,
  hasYoy,
  hasObligations,
  hasPatrimoniu,
  hasInsights,
}: {
  hasIndustryKpis: boolean;
  hasVerticals: boolean;
  hasTimeline: boolean;
  hasYoy: boolean;
  hasObligations: boolean;
  hasPatrimoniu: boolean;
  hasInsights: boolean;
}): {
  base: Array<{ id: string; label: string }>;
  tail: Array<{ id: string; label: string }>;
} {
  const base: Array<{ id: string; label: string }> = [
    { id: "verdict", label: "Pe scurt" },
    { id: "hero", label: "Privire" },
    { id: "sanatate", label: "Scor sanatate" },
  ];
  if (hasIndustryKpis) base.push({ id: "industry-kpis", label: "Indicatori" });
  base.push(
    { id: "profit", label: "P&L" },
    { id: "breakdowns", label: "Harta banilor" },
    { id: "top-activity", label: "Top clienti" },
    { id: "top-cheltuieli", label: "Top plati" }
  );
  if (hasVerticals) base.push({ id: "verticals", label: "Linii" });
  base.push({ id: "cashflow", label: "Cash-flow" });
  if (hasTimeline) base.push({ id: "luni", label: "Luna de luna" });
  base.push({ id: "evolutie", label: "Evolutie" });
  if (hasYoy) base.push({ id: "yoy", label: "An vs an" });
  if (hasObligations) base.push({ id: "obligations", label: "De platit" });
  base.push(
    { id: "parteneri", label: "Parteneri" },
    { id: "rezerve", label: "Rezerve" },
    { id: "eu", label: "Eu si firma" }
  );
  if (hasPatrimoniu) base.push({ id: "patrimoniu", label: "Patrimoniu" });

  const tail: Array<{ id: string; label: string }> = [];
  if (hasInsights) tail.push({ id: "insights", label: "Semnale" });

  return { base, tail };
}
