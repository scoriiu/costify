/**
 * Korner Civil Concept SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/korner.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Korner Civil Concept SRL — Dec 2025",
  "korner-registru-jurnal.xlsx",
  "korner-balanta-2025-12.xlsx",
  2025,
  12
);
