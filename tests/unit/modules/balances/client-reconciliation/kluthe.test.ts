/**
 * Kluthe Chemicals Romania SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/kluthe.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Kluthe Chemicals Romania SRL — Dec 2025",
  "kluthe-registru-jurnal.xls",
  "kluthe-balanta-2025-12.xls",
  2025,
  12,
  {
    knownDifferences: [
      // 4111.00014 (client analytic): Saga records sold_in_d = -561.09 RON,
      // a negative value on the debit side that conceptually represents
      // a positive sold on the credit side (client paid in advance).
      // Standard Saga anomaly — Costify normalizes to max(C-D, 0).
      "4111.00014",
    ],
  }
);
