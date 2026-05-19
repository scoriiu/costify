/**
 * Upperhouse SRL — reconciliation suite.
 *
 * SKIPPED pending accountant review. The fixture has 192k journal entries
 * back to 2015, but Saga's balance for Dec 2025 lists sold_in_d/c values
 * that don't reconcile with the cumulative journal totals for the same
 * accounts. ~100 accounts (mostly 401.xxx suppliers and 4xx tax accounts)
 * show differences ranging from a few RON to 25k+ RON.
 *
 * Hypothesis: Saga retains internal year-end closing operations that are
 * not included in the standard journal export. Costify is mathematically
 * correct on the journal it receives — the diff is between Saga's internal
 * state and what Saga is willing to export. Needs Claudia to investigate
 * which operations are missing from the journal.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/upperhouse.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Upperhouse SRL — Dec 2025",
  "upperhouse-registru-jurnal.xlsx",
  "upperhouse-balanta-2025-12.xlsx",
  2025,
  12,
  {
    skip: "Saga journal export missing closing operations; sold_in_d/c does not reconcile with journal cumulative for ~100 accounts. Needs accountant review.",
  }
);
