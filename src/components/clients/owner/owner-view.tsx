/**
 * OwnerView (Acasa) — the firma's overview page.
 *
 * Per Claudia spec §4.1: ONE scrollable page, 9 sections, anchor TOC on the
 * right (SectionQuickNav). No sub-routes. Every "see more" is a drill-down
 * (expand inline / open dialog) — not a navigation away from this page.
 *
 *  §6  Pe scurt        — VerdictBanner + KpiStrip + HeroSummary
 *  §10 Sanatate        — HealthScoreCard (composite + 4 subscores)
 *  §8  Cash-flow       — CashflowSplitChart (O/I/F) + CashflowWaterfall
 *  §7  Evolutie        — EvolutionChart (12 luni) + YoyComparison
 *  §9  Venituri/chelt. — PnlWaterfall + CategoryBreakdown + TopActivity + TopExpenses
 *      Verticals       — VerticalBreakdownCard (per linie de business)
 *  §11 Obligatii       — ObligationsCalendar + CashPositionCard
 *  §11 Parteneri       — OutstandingTable clienti + furnizori
 *      Eu si firma     — OwnerWithdrawalsCard
 *  §12 Patrimoniu      — PatrimoniuView (Activ vs Pasiv)
 *  §10 L2              — RatiosCatalog (mode=detailed only)
 *  §13 Insights        — InsightsList (semantic flags)
 */

import type { OwnerSnapshot } from "@/modules/reporting/owner";
import type { OwnerContext } from "./owner-layout";
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
import { PatrimoniuView } from "./patrimoniu-view";
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
    patrimoniu,
    topCustomersByActivity,
    topSuppliersByActivity,
  } = snapshot;

  const period = monthLabel(meta.year, meta.month);

  const { base: baseNav, tail: tailNav } = buildNavItems({
    hasYoy: yoy.hasPreviousYear,
    hasVerticals: verticalBreakdown.length > 0,
    hasInsights: insights.length > 0,
    hasObligations: obligations.length > 0,
    hasPatrimoniu: patrimoniu.totalActiv !== 0 || patrimoniu.totalPasiv !== 0,
  });

  // Sticky period bar sits under different chrome depending on context.
  // Preview strip (?view=owner) is 44 px tall → top-11. Owner topbar
  // (/firma) is 56 px tall → top-14. We can't read the parent at runtime
  // so we infer from context.isPreview.
  const stickyTopClass = context.isPreview ? "top-11" : "top-14";

  return (
    <ViewModeProvider initialMode={mode}>
      <StickyPeriodBar
        year={meta.year}
        month={meta.month}
        availablePeriods={availablePeriods}
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
        detailedOnlyItems={[{ id: "ratios", label: "Indicatori" }]}
        tailItems={tailNav}
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

      {/* §6 — Hero (cash + 3 metrics) */}
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

      {/* §10 — Health score composite */}
      <Section id="sanatate" className="mb-8">
        <HealthScoreCard data={healthScore} />
      </Section>

      {/* §8 — Operating/Investing/Financing split */}
      <Section id="cashflow-split" className="mb-8">
        <CashflowSplitChart data={cashflowBreakdown} />
      </Section>

      {/* §8 — Cashflow waterfall (Inceput → Final) */}
      <Section id="cashflow" className="mb-8">
        <CashflowWaterfall trends={trends} />
      </Section>

      {/* §7 — Evolution chart */}
      <Section id="evolutie" className="mb-8">
        <EvolutionChart data={trends} />
      </Section>

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

      {/* §9 — Cashflow Map (treemap). Replaces the side-by-side donut breakdown:
            one visualization that answers "where did money go / come from"
            in one glance, with click-to-expand for sub-categories.
            Owner version: no conts, no OMFP codes, no codes period. */}
      <Section id="breakdowns" className="mb-8">
        <CashflowMap
          expenseBreakdown={expenseBreakdown}
          revenueBreakdown={revenueBreakdown}
          periodLabel={period}
        />
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
          <OutstandingTable variant="clienti" partners={outstanding.clienti} />
          <OutstandingTable variant="furnizori" partners={outstanding.furnizori} />
        </div>
      </Section>

      {/* Owner withdrawals */}
      <Section id="eu" className="mb-8">
        <OwnerWithdrawalsCard data={ownerWithdrawals} />
      </Section>

      {/* §12 — Patrimoniu (Activ vs Pasiv) */}
      {(patrimoniu.totalActiv !== 0 || patrimoniu.totalPasiv !== 0) && (
        <Section id="patrimoniu" className="mb-8">
          <PatrimoniuView data={patrimoniu} />
        </Section>
      )}

      {/* §10 — Detailed ratios catalog (L2 only) */}
      <DetailedOnly>
        <Section id="ratios" className="mb-8">
          <RatiosCatalog ratios={ratios} />
        </Section>
      </DetailedOnly>

      {/* §13 — Insights */}
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

/**
 * Build the static parts of the right-side TOC. The mode-dependent
 * "Indicatori" entry is injected by SectionQuickNavDynamic between `base`
 * and `tail` when L2 is active — that keeps mode toggling instant
 * (no server roundtrip, no parent re-render).
 */
function buildNavItems({
  hasYoy,
  hasVerticals,
  hasInsights,
  hasObligations,
  hasPatrimoniu,
}: {
  hasYoy: boolean;
  hasVerticals: boolean;
  hasInsights: boolean;
  hasObligations: boolean;
  hasPatrimoniu: boolean;
}): {
  base: Array<{ id: string; label: string }>;
  tail: Array<{ id: string; label: string }>;
} {
  const base: Array<{ id: string; label: string }> = [
    { id: "verdict", label: "Pe scurt" },
    { id: "hero", label: "Privire" },
    { id: "sanatate", label: "Scor sanatate" },
    { id: "cashflow-split", label: "Cash O/I/F" },
    { id: "evolutie", label: "Evolutie" },
  ];
  if (hasYoy) base.push({ id: "yoy", label: "An vs an" });
  base.push(
    { id: "profit", label: "P&L" },
    { id: "breakdowns", label: "Categorii" },
    { id: "top-activity", label: "Top clienti" },
    { id: "top-cheltuieli", label: "Top plati" }
  );
  if (hasVerticals) base.push({ id: "verticals", label: "Linii" });
  if (hasObligations) base.push({ id: "obligations", label: "De platit" });
  base.push(
    { id: "parteneri", label: "Parteneri" },
    { id: "eu", label: "Eu si firma" }
  );
  if (hasPatrimoniu) base.push({ id: "patrimoniu", label: "Patrimoniu" });

  const tail: Array<{ id: string; label: string }> = [];
  if (hasInsights) tail.push({ id: "insights", label: "Semnale" });

  return { base, tail };
}
