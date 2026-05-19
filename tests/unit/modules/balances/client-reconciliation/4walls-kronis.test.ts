/**
 * 4Walls Kronis SRL — reconciliation suite.
 *
 *   pnpm test:unit tests/unit/modules/balances/client-reconciliation/4walls-kronis.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "4Walls Kronis SRL — Dec 2025",
  "4walls-kronis-registru-jurnal.xlsx",
  "4walls-kronis-balanta-2025-12.xlsx",
  2025,
  12
);
