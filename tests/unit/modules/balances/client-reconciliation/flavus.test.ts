/**
 * Flavus SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/flavus.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Flavus SRL — Dec 2025",
  "flavus-registru-jurnal.xlsx",
  "flavus-balanta-2025-12.xlsx",
  2025,
  12
);
