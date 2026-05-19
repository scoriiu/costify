/**
 * Titan Strong Construct SRL — reconciliation suite.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation/titan.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Titan Strong Construct SRL — Dec 2025",
  "titan-registru-jurnal.xlsx",
  "titan-balanta-2025-12.xls",
  2025,
  12
);
