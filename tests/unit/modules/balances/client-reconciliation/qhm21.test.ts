/**
 * QHM21 Network SRL — reconciliation suite.
 *
 * Verifies every leaf account with non-zero values in the Saga-exported
 * balance matches Costify's computation across three dimensions
 * (sold final, rulaj total, sold initial), for each closing period
 * present in the fixture.
 *
 *   pnpm test:unit tests/unit/modules/balances/client-reconciliation/qhm21.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

const JOURNAL = "qhm-registru-jurnal.xlsx";

runVerificationSuite(
  "QHM21 Network SRL — Dec 2023",
  JOURNAL,
  "qhm-balanta-2023-12.xlsx",
  2023,
  12,
  {
    // Saga records this VAT-related entry with explicit negative balances
    // on the "wrong" side. Costify nets to the dominant side
    // (max(D-C, 0)) — mathematically equivalent, presented differently.
    knownDifferences: ["4423"],
  }
);

runVerificationSuite(
  "QHM21 Network SRL — Dec 2024",
  JOURNAL,
  "qhm-balanta-2024-12.xlsx",
  2024,
  12,
  {
    // Same Saga negative-side anomaly as 2023, on a different VAT account.
    knownDifferences: ["5328"],
  }
);

runVerificationSuite(
  "QHM21 Network SRL — Dec 2025",
  JOURNAL,
  "qhm-balanta-2025-12.xlsx",
  2025,
  12
);
