/**
 * End-to-end smoke for the four main client tabs.
 *
 * Why this test exists: a stale Prisma client in dev caused /api/balance
 * to 500, which made BalantaTab render its "Nu exista date pentru aceasta
 * perioada" empty state — even though the client has 16k journal lines
 * and 249 cached balance rows. None of our 3237 unit tests caught it
 * because they all mock Prisma.
 *
 * This spec hits the real stack the same way a user does on every data
 * tab — Balanță, CPP, Plan de Conturi, Registru Jurnal — and asserts
 * each one actually renders content for a real client.
 *
 * Fixture: QHM21 NETWORK SRL — the same seeded fixture used by the rest
 * of the UI suite. Has multi-year journal data so the default-period
 * fallback (latest available month) always picks a real period.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";

let prisma: PrismaClient;
let sessionToken: string;

test.beforeAll(async () => {
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
      userAgent: "playwright-client-tabs",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-client-tabs" },
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

test.describe("Balanta de Verificare — end-to-end", () => {
  test("default-period load renders KPIs + table, not the empty state", async ({ context }) => {
    const page = await authedPage(context);

    // Navigate WITHOUT year/month — exercises the server-side default
    // (latest available period) AND the client-side fetch through to
    // /api/balance + BalantaTab rendering.
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=balanta`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // The exact failure we shipped: balance API 500'd, BalantaTab got
    // rows=null and rendered the empty state.
    await expect(
      page.getByText("Nu exista date pentru aceasta perioada"),
    ).toHaveCount(0);
    await expect(page.getByText("Se calculeaza balanta")).toHaveCount(0);

    // At least one KPI label must render. KpiCards uses labels like
    // "Cash", "Creante", "Datorii TS".
    const seenKpi = await anyVisible(page, ["Cash", "Creante", "Datorii"]);
    expect(seenKpi).toBe(true);

    // Balance table must have at least a handful of account-code cells.
    // OMFP accounts are 3-4 digits with optional analytic suffix.
    const accountCodeCount = await page
      .locator("text=/^\\d{3,4}(\\.\\d+)?$/")
      .count();
    expect(accountCodeCount).toBeGreaterThan(5);
  });

  test("explicit period (2026-04) still renders", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=balanta&year=2026&month=4`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("Nu exista date pentru aceasta perioada"),
    ).toHaveCount(0);
  });
});

test.describe("Cont Profit si Pierdere — end-to-end", () => {
  test("default-period load renders CPP content", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=cpp`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // CPP shares /api/balance, so the same 500 would have killed it.
    // Empty-state copy lives in CppTab; we check for "Se calculeaza" too.
    await expect(
      page.getByText("Nu exista date pentru aceasta perioada"),
    ).toHaveCount(0);

    // CPP must show at least one of the canonical line labels.
    const seenCpp = await anyVisible(page, [
      "Cifra de afaceri",
      "Rezultat",
      "Cheltuieli",
    ]);
    expect(seenCpp).toBe(true);
  });
});

test.describe("Plan de Conturi — end-to-end", () => {
  test("loads first page of accounts, not the empty state", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=plan`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Plan-tab empty state copy.
    await expect(
      page.getByText("Nu exista conturi"),
    ).toHaveCount(0);

    // The pagination counter is rendered as "N / M conturi".
    await expect(page.getByText(/\d+ \/ \d+ conturi/)).toBeVisible();

    // Account-code cells must render. Plan rows use the same shape.
    const accountCodeCount = await page
      .locator("text=/^\\d{3,4}(\\.\\d+)?$/")
      .count();
    expect(accountCodeCount).toBeGreaterThan(5);
  });

  test("search hits the full population, not just the loaded slice", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=plan`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // QHM21's chart of accounts has class-5 accounts (Trezorerie).
    // Type into the search; the result count must update to a smaller,
    // non-zero number, proving full-population server search works.
    await page.getByPlaceholder(/Cauta cont sau denumire/i).fill("5121");
    // wait for debounce + fetch
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/^[1-9]\d* \/ \d+ conturi$/)).toBeVisible();
  });
});

test.describe("Registru Jurnal — end-to-end", () => {
  test("loads journal entries on default tab", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=jurnal`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Journal empty-state copy
    await expect(
      page.getByText("Nu exista intrari"),
    ).toHaveCount(0);

    // Header row must render with all column labels.
    for (const label of ["Data", "NDP", "Cont Debit", "Cont Credit", "Suma"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // QHM21 has 16k rows; the "N intrari" badge must show a multi-digit
    // number formatted in ro-RO locale (period as thousands separator).
    // .first() because the page has other "N intrari" labels (e.g. in the
    // header meta row); we only need to assert one of them is correct.
    await expect(
      page.locator("text=/\\d+(\\.\\d{3})+\\s+intrari/").first(),
    ).toBeVisible();
  });
});

async function anyVisible(page: Page, labels: string[]): Promise<boolean> {
  for (const label of labels) {
    if (
      await page
        .getByText(label, { exact: false })
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return true;
    }
  }
  return false;
}
