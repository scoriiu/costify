/**
 * End-to-end test for journal import via the upload UI.
 *
 * Reproduces the user flow that previously OOM-segfaulted the production
 * pod: open the import page for a client, drop the 19 MB UpperHouse SRL
 * Saga export, wait for the success state. Asserts:
 *
 *   1. The upload completes — no "Eroare de retea" thrown by the browser
 *      due to the server dying mid-request.
 *   2. The success UI reports a non-zero number of new entries (proving the
 *      streaming parser actually decoded the file, not just succeeded with
 *      0 rows like exceljs did on Saga's prefixed XML).
 *   3. The whole flow completes within a sane time bound (well under the
 *      120 s server maxDuration).
 *
 * The fixture lives outside the repo under `temp/e2e_test_data_fixtures/`.
 * When absent (CI without proprietary client data, fresh clones), the test
 * is skipped with a clear message rather than failing.
 *
 * We import into a throwaway client that is created in `beforeAll` and
 * deleted in `afterAll`, so the test is independent of any production data
 * and re-runnable.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const FIXTURE = resolve(
  __dirname,
  "../../temp/e2e_test_data_fixtures/8. Upperhouse/Registru Jurnal - UpperHouse SRL.xlsx"
);

const HAS_FIXTURE = existsSync(FIXTURE);

let prisma: PrismaClient;
let sessionToken: string;
let testClientId: string;
let testClientSlug: string;

test.beforeAll(async () => {
  if (!HAS_FIXTURE) {
    test.skip(true, `Fixture missing at ${FIXTURE} — proprietary client data`);
  }

  prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: "solomon.coriiu@costify.ro" },
    select: { id: true },
  });
  if (!user) throw new Error("Test user not found");

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-journal-import",
    },
  });

  // Throwaway client unique to this test run so we never collide with
  // existing data and can hard-delete on teardown.
  testClientSlug = `e2e-import-${Date.now()}`;
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: `E2E Import Test ${Date.now()}`,
      slug: testClientSlug,
      cui: `E2E${Date.now().toString().slice(-7)}`,
    },
    select: { id: true },
  });
  testClientId = client.id;
});

test.afterAll(async () => {
  if (!HAS_FIXTURE) return;
  // Cascading deletes: order matters because of FK constraints. Journal
  // lines first, then dependent rows, then the client itself.
  if (testClientId) {
    await prisma.journalLine.deleteMany({ where: { clientId: testClientId } });
    await prisma.journalPartner.deleteMany({ where: { clientId: testClientId } });
    await prisma.clientAccount.deleteMany({ where: { clientId: testClientId } });
    await prisma.importEvent.deleteMany({ where: { clientId: testClientId } });
    await prisma.client.delete({ where: { id: testClientId } }).catch(() => undefined);
  }
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-journal-import" },
  });
  await prisma.$disconnect();
});

async function authedPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await context.addCookies([
    { name: "sid", value: sessionToken, domain: "localhost", path: "/" },
  ]);
  return page;
}

test.describe("Journal import — UpperHouse 19 MB fixture", () => {
  test("streams 200k-row Saga export without OOM, completes inside maxDuration", async ({
    context,
  }) => {
    test.setTimeout(150_000); // generous: full pipeline includes parse + dedup + N+1 partner upserts

    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${testClientSlug}/import`, {
      waitUntil: "domcontentloaded",
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: "attached" });
    await fileInput.setInputFiles(FIXTURE);

    // The import wizard is a two-step UI: drop/pick the file first, then
    // click the "Import" button to start the upload.
    const importBtn = page.getByRole("button", { name: /^Import$/ });
    await expect(importBtn).toBeEnabled();

    const importResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/import") && r.request().method() === "POST",
      { timeout: 130_000 }
    );
    await importBtn.click();

    const importResponse = await importResponsePromise;
    expect(importResponse.status()).toBe(200);

    const payload = (await importResponse.json()) as {
      entriesAdded: number;
      totalParsed: number;
      errorsCount: number;
    };

    // 1. The streaming parser actually decoded rows — would be 0 if Saga's
    //    prefixed XML wasn't handled (which is what exceljs gave us).
    expect(payload.totalParsed).toBeGreaterThan(150_000);
    // 2. They were all new entries (this is a throwaway client) so every
    //    parsed row should have been written.
    expect(payload.entriesAdded).toBe(payload.totalParsed);
    expect(payload.errorsCount).toBe(0);

    // 3. After success, the UI redirects/transitions away from the import
    //    page (back to the client detail or the journal tab). The exact
    //    landing screen is the success path — we just assert we left the
    //    upload form.
    await page.waitForURL((url) => !url.toString().endsWith("/import"), {
      timeout: 30_000,
    });
  });
});
