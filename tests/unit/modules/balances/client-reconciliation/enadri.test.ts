/**
 * Enadri Cosmetics Profesional SRL — reconciliation suite.
 *
 *   pnpm test:unit tests/unit/modules/balances/client-reconciliation/enadri.test.ts
 */
import { runVerificationSuite } from "@tests/fixtures/reference/verification-suite";

runVerificationSuite(
  "Enadri Cosmetics Profesional SRL — Dec 2025",
  "enadri-registru-jurnal.xls",
  "enadri-balanta-2025-12.xls",
  2025,
  12
);
