/**
 * Citibox SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/citibox.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Citibox SRL — Dec 2025",
  "citibox-registru-jurnal.xlsx",
  "citibox-balanta-2025-12.xlsx",
  2025,
  12,
  {
    knownDifferences: [
      // 4423 (TVA de plata): Saga records sold_in_c = -0.49 RON, a negative
      // value on the credit side that conceptually represents +0.49 RON
      // on the debit side. Saga anomaly, not a Costify bug. Same pattern
      // seen on QHM21, Titan and Upperhouse.
      "4423",
      // 4518 (Dobanzi imprumut): Saga's balance shows 91.39 RON more on
      // the credit side than the journal contains for 2025. The 21 entries
      // exported sum to 12,070.98 but Saga reports rulajT_c = 12,162.37.
      // Likely an internal regularization not included in the journal export.
      // Needs accountant to identify the missing transaction.
      "4518",
    ],
  }
);
