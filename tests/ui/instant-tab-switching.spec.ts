/**
 * Instant tab switching contract.
 *
 * After the dataVersion + cache refactor, switching between Balanta / CPP /
 * Mapari / Plan / Setari must:
 *
 *   1. Not trigger any /clients/<slug> server-component re-render. We assert
 *      this by counting document navigations — there must be exactly ONE
 *      across all in-tab clicks.
 *
 *   2. Reuse the same `/api/balance` payload between Balanta and CPP — when
 *      the user goes Balanta → CPP → Balanta on the same period, /api/balance
 *      is hit at most once. (CppTab and BalantaTab share ClientDetail's cache.)
 *
 *   3. Reuse the same `/api/mapari-cashflow` payload across re-entries to
 *      the Mapari tab.
 *
 *   4. Keep the URL in sync with the active tab via history.replaceState so
 *      a refresh / share link still lands on the right tab.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const CLIENT_URL = `${BASE}/clients/${CLIENT_SLUG}`;

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
      userAgent: "playwright-instant-tabs",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-instant-tabs" },
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

async function clickTab(page: Page, label: string) {
  // The TabBar renders <button> elements with the tab label as text content.
  // We use `getByRole` with name to remain resilient to wrapper changes.
  await page.getByRole("button", { name: label, exact: true }).click();
}

test.describe("ClientDetail — instant tab switching", () => {
  test("tab clicks do not refetch the page itself", async ({ context }) => {
    const page = await authedPage(context);

    // Count requests TO the page URL (document navigations). If tab clicks
    // were doing `router.push`, Next would refetch the RSC payload for
    // /clients/<slug> on every click. With our refactor, this must happen
    // exactly once — the initial navigation.
    const pageRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      // Document or RSC request to the slug route, ignoring API and assets.
      if (
        url.includes(`/clients/${CLIENT_SLUG}`) &&
        !url.includes("/api/") &&
        !url.includes("/_next/")
      ) {
        pageRequests.push(url);
      }
    });

    await page.goto(`${CLIENT_URL}?tab=jurnal`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const baseline = pageRequests.length; // initial load only

    for (const label of [
      "Balanta de Verificare",
      "Cont Profit si Pierdere",
      "Mapari Cashflow",
      "Plan de Conturi",
      "Setari",
      "Registru Jurnal",
    ]) {
      await clickTab(page, label);
      await page.waitForTimeout(80);
    }

    // No additional page fetches: every tab click is pure client-side state.
    expect(pageRequests.length).toBe(baseline);
  });

  test("URL stays in sync with active tab (history.replaceState)", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(`${CLIENT_URL}?tab=jurnal`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await clickTab(page, "Setari");
    await page.waitForTimeout(100);
    expect(new URL(page.url()).searchParams.get("tab")).toBe("setari");

    await clickTab(page, "Plan de Conturi");
    await page.waitForTimeout(100);
    expect(new URL(page.url()).searchParams.get("tab")).toBe("plan");
  });

  test("/api/balance is hit at most once for Balanta + CPP on the same period", async ({
    context,
  }) => {
    const page = await authedPage(context);

    const balanceCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/balance?")) balanceCalls.push(req.url());
    });

    await page.goto(`${CLIENT_URL}?tab=jurnal`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await clickTab(page, "Balanta de Verificare");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Cont Profit si Pierdere");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Balanta de Verificare");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Cont Profit si Pierdere");
    await page.waitForLoadState("networkidle");

    // Exactly one call expected — first Balanta entry populates the shared
    // (year, month) cache; everyone else reads from it.
    expect(balanceCalls.length).toBe(1);
  });

  test("/api/client-accounts is hit at most once for repeated Plan visits", async ({
    context,
  }) => {
    const page = await authedPage(context);

    const planCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/client-accounts")) planCalls.push(req.url());
    });

    await page.goto(`${CLIENT_URL}?tab=jurnal`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await clickTab(page, "Plan de Conturi");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Registru Jurnal");
    await page.waitForTimeout(50);
    await clickTab(page, "Plan de Conturi");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Setari");
    await page.waitForTimeout(50);
    await clickTab(page, "Plan de Conturi");
    await page.waitForLoadState("networkidle");

    expect(planCalls.length).toBe(1);
  });

  test("/api/mapari-cashflow is hit at most once for repeated Mapari visits", async ({
    context,
  }) => {
    const page = await authedPage(context);

    const mapariCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/mapari-cashflow")) mapariCalls.push(req.url());
    });

    await page.goto(`${CLIENT_URL}?tab=jurnal`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await clickTab(page, "Mapari Cashflow");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Registru Jurnal");
    await page.waitForTimeout(50);
    await clickTab(page, "Mapari Cashflow");
    await page.waitForLoadState("networkidle");
    await clickTab(page, "Setari");
    await page.waitForTimeout(50);
    await clickTab(page, "Mapari Cashflow");
    await page.waitForLoadState("networkidle");

    expect(mapariCalls.length).toBe(1);
  });
});
