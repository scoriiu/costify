/**
 * Widder SRL — reconciliation suite.
 *
 *   pnpm test:unit tests/unit/modules/balances/client-reconciliation/widder.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Widder SRL — Dec 2025",
  "widder-registru-jurnal.xlsx",
  "widder-balanta-2025-12.xlsx",
  2025,
  12
);
