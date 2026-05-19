/**
 * Swat Smart Resourcing SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/swat.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Swat Smart Resourcing SRL — Dec 2025",
  "swat-registru-jurnal.xlsx",
  "swat-balanta-2025-12.xlsx",
  2025,
  12
);
