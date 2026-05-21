/**
 * Registry of mockups available inside the docs markdown.
 *
 * Usage in markdown:
 *
 *   :::mockup owner-home-full
 *   :::
 *
 * The renderer looks up the name in MOCKUPS and renders the matching
 * React component. Unknown names render a small "missing mockup" badge
 * so we notice immediately during review.
 */

import {
  MockPublishedBanner,
  MockKpiCards,
  MockYoyStrip,
  MockRunwaySalary,
  MockExpenseBreakdown,
  MockRevenueBreakdown,
  MockTopExpenses,
  MockVerticalBreakdown,
  MockOwnerHomeFull,
} from "./owner-home";
import {
  MockMapariFlow,
  MockAccountRow,
  MockSplitPopover,
  MockActivateModal,
  MockVerticalsList,
} from "./mapari";
import {
  MockAxesDiagram,
  MockTwoLanguagesTable,
  MockResolutionFlow,
  MockSplitMath,
} from "./diagrams";

export const MOCKUPS: Record<string, () => React.ReactElement> = {
  // Owner home
  "published-banner": MockPublishedBanner,
  "kpi-cards": MockKpiCards,
  "yoy-strip": MockYoyStrip,
  "runway-salary": MockRunwaySalary,
  "expense-breakdown": MockExpenseBreakdown,
  "revenue-breakdown": MockRevenueBreakdown,
  "top-expenses": MockTopExpenses,
  "vertical-breakdown": MockVerticalBreakdown,
  "owner-home-full": MockOwnerHomeFull,

  // Mapari Cashflow
  "mapari-flow": MockMapariFlow,
  "account-row": MockAccountRow,
  "split-popover": MockSplitPopover,
  "activate-modal": MockActivateModal,
  "verticals-list": MockVerticalsList,

  // Conceptual diagrams
  "axes-diagram": MockAxesDiagram,
  "two-languages": MockTwoLanguagesTable,
  "resolution-flow": MockResolutionFlow,
  "split-math": MockSplitMath,
};

export function renderMockup(name: string): React.ReactElement {
  const Comp = MOCKUPS[name];
  if (!Comp) {
    return (
      <div className="my-5 rounded-lg border border-danger/40 bg-danger/5 p-3 text-[12px] text-danger">
        Mockup necunoscut: <code className="font-mono">{name}</code>. Disponibile:{" "}
        <code className="font-mono">{Object.keys(MOCKUPS).join(", ")}</code>
      </div>
    );
  }
  return (
    <div className="my-6">
      <Comp />
    </div>
  );
}
