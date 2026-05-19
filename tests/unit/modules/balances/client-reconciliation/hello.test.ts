/**
 * Hello Numbers SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/hello.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Hello Numbers SRL — Dec 2025",
  "hello-registru-jurnal.xlsx",
  "hello-balanta-2025-12.xlsx",
  2025,
  12,
  {
    knownDifferences: [
      // 5311 (Casa in lei): Saga reports a fin_d 9,000.00 RON higher than
      // the cumulative journal yields (10,722.91 vs Costify's 1,722.91).
      // The diff appears as a flat 9k RON offset on both sold_in and
      // fin — likely an internal cash regularization not recorded in the
      // journal. Same pattern as Upperhouse 5311. Needs accountant review.
      "5311",
    ],
  }
);
