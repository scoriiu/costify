/**
 * Medezen SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/medezen.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Medezen SRL — Dec 2025",
  "medezen-registru-jurnal.xls",
  "medezen-balanta-2025-12.xls",
  2025,
  12
);
