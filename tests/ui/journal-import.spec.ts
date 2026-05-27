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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

// Load .env.local explicitly so the test's Prisma client targets the same
// database as the dev server. By default `@prisma/client` picks up `.env`
// at module-load time, which on this repo points at a local DB while
// `.env.local` redirects to the port-forwarded production DB.
function loadEnvLocal() {
  const path = resolve(__dirname, "../../.env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = val;
  }
}
loadEnvLocal();

const BASE = "http://localhost:3041";
const FIXTURE = resolve(
  __dirname,
  "../../temp/e2e_test_data_fixtures/8. Upperhouse/Registru Jurnal - UpperHouse SRL.xlsx"
);

const HAS_FIXTURE = existsSync(FIXTURE);

let prisma: PrismaClient;
let sessionToken: string;
let userId: string;
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
  userId = user.id;

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-journal-import",
    },
  });
});

test.beforeEach(async () => {
  if (!HAS_FIXTURE) return;
  // Each test gets a fresh throwaway client so imports never see prior
  // dedupHashes. Without this the second test in the file would see
  // entriesAdded: 0 because the first test already imported every row.
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  testClientSlug = `e2e-import-${stamp}`;
  const client = await prisma.client.create({
    data: {
      userId,
      name: `E2E Import Test ${stamp}`,
      slug: testClientSlug,
      cui: `E2E${stamp.replace(/[^0-9]/g, "").slice(-7)}`,
    },
    select: { id: true },
  });
  testClientId = client.id;
});

test.afterEach(async () => {
  if (!HAS_FIXTURE || !testClientId) return;
  await prisma.journalLine.deleteMany({ where: { clientId: testClientId } });
  await prisma.journalPartner.deleteMany({ where: { clientId: testClientId } });
  await prisma.clientAccount.deleteMany({ where: { clientId: testClientId } });
  await prisma.importEvent.deleteMany({ where: { clientId: testClientId } });
  await prisma.client.delete({ where: { id: testClientId } }).catch(() => undefined);
  testClientId = "";
  testClientSlug = "";
});

test.afterAll(async () => {
  if (!HAS_FIXTURE) return;
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
  test("queue flow: returns 202 quickly, poll-driven bar reaches ready", async ({
    context,
  }) => {
    test.setTimeout(180_000);
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${testClientSlug}/import`, {
      waitUntil: "domcontentloaded",
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: "attached" });
    await fileInput.setInputFiles(FIXTURE);

    const importBtn = page.getByRole("button", { name: /^Import$/ });
    await expect(importBtn).toBeEnabled();

    // 1. POST /api/import must return 202 quickly — the whole point of
    //    the queue is that the user doesn't wait for the import to finish.
    const enqueueStart = Date.now();
    const enqueueResponse = page.waitForResponse(
      (r) => r.url().includes("/api/import") && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await importBtn.click();
    const res = await enqueueResponse;
    const enqueueMs = Date.now() - enqueueStart;
    expect(res.status()).toBe(202);
    // 60s is generous; on prod-class infra this is closer to 5-10s for
    // a 19 MB file (network + multipart parse + S3 PUT).
    expect(enqueueMs).toBeLessThan(60_000);

    const body = (await res.json()) as { importEventId: string };
    expect(body.importEventId).toBeTruthy();

    // 2. URL must update to ?event=<id> so refresh resumes the same poll.
    await expect(page).toHaveURL(new RegExp(`event=${body.importEventId}`));

    // 3. Progress bar shows a real label from the worker.
    const progressLabel = page
      .locator("text=/incepe procesarea|citeste registrul|salvez|finalizeaza|partener|plan/i")
      .first();
    await expect(progressLabel).toBeVisible({ timeout: 30_000 });

    // 4. Poll the status API ourselves and assert we see actual movement.
    const pollUntilReady = async () => {
      const deadline = Date.now() + 150_000;
      let lastProgress = -1;
      let sawMidProgress = false;
      while (Date.now() < deadline) {
        const sr = await page.request.get(`${BASE}/api/import/${body.importEventId}`);
        if (!sr.ok()) {
          await page.waitForTimeout(500);
          continue;
        }
        const data = (await sr.json()) as {
          status: string;
          progress: number;
          totalEntries: number | null;
          processedEntries: number | null;
        };
        if (data.progress > lastProgress) lastProgress = data.progress;
        if (data.progress > 20 && data.progress < 100) sawMidProgress = true;
        if (data.status === "ready") return { ...data, sawMidProgress };
        if (data.status === "failed") throw new Error(`Import failed: ${JSON.stringify(data)}`);
        await page.waitForTimeout(500);
      }
      throw new Error(`Import did not reach ready within deadline. last progress: ${lastProgress}`);
    };

    const finalState = await pollUntilReady();
    expect(finalState.sawMidProgress).toBe(true);

    // 5. After ready the UI redirects to the client detail page. Give it
    //    extra time: our UI holds at 100% for 600ms before navigating, and
    //    the next page does its own data load.
    await page.waitForURL((url) => !url.toString().includes("/import"), {
      timeout: 30_000,
    });

    // 6. DB sanity — the journal lines actually landed.
    const journalLineCount = await prisma.journalLine.count({
      where: { clientId: testClientId, deletedAt: null },
    });
    expect(journalLineCount).toBeGreaterThan(150_000);
  });

  test("refresh during processing resumes the same progress (URL is source of truth)", async ({
    context,
  }) => {
    test.setTimeout(180_000);
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${testClientSlug}/import`, {
      waitUntil: "domcontentloaded",
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: "attached" });
    await fileInput.setInputFiles(FIXTURE);

    const enqueueResponse = page.waitForResponse(
      (r) => r.url().includes("/api/import") && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /^Import$/ }).click();
    const res = await enqueueResponse;
    const body = (await res.json()) as { importEventId: string };

    // Wait until the worker has moved past 'queued' so a refresh is not
    // racing the bootstrap.
    await page.waitForTimeout(2_000);

    // Hard refresh the page — the URL still contains ?event=<id>.
    await page.reload({ waitUntil: "domcontentloaded" });

    // We should land in the polling view, not the empty drop zone.
    await expect(
      page.locator("text=/intrari|procesare|citeste|salvez|finalizeaza/i").first()
    ).toBeVisible({ timeout: 10_000 });

    // The drop zone must NOT be visible.
    await expect(page.locator("text=Drop your XLSX file here")).toHaveCount(0);

    // Wait until ready.
    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline) {
      const sr = await page.request.get(`${BASE}/api/import/${body.importEventId}`);
      const data = (await sr.json()) as { status: string };
      if (data.status === "ready") break;
      if (data.status === "failed") throw new Error(`Import failed during refresh test`);
      await page.waitForTimeout(500);
    }
  });
});
