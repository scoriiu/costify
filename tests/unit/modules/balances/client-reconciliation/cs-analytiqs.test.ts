/**
 * CS Analytiqs SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/cs-analytiqs.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "CS Analytiqs SRL — Dec 2025",
  "cs-analytiqs-registru-jurnal.xlsx",
  "cs-analytiqs-balanta-2025-12.xlsx",
  2025,
  12,
  {
    knownDifferences: [
      // 5125.00003 and 5125.00175 (Sume in curs de decontare — card
      // payments in transit): Saga records sold_in_d as a negative value
      // (-14 RON and -5479.51 RON), which conceptually represents a
      // positive sold on the credit side. Same Saga anomaly pattern as
      // 4423 elsewhere (negative on the "wrong" side). Costify normalizes
      // to the dominant side via max(D-C, 0). Equivalent math, different
      // presentation.
      "5125.00003",
      "5125.00175",
    ],
  }
);
