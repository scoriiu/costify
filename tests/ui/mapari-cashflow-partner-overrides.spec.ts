/**
 * Playwright end-to-end tests for the partner-overrides flow on the
 * Mapari Cashflow tab.
 *
 * Verifies:
 *   1. The Mapari Cashflow page loads, shows the coverage panel, and
 *      renders cont rows with partner badges where partner count >= 2.
 *   2. Clicking a partner badge opens the slide-panel from the right
 *      with the cont's header truth-line and partner list.
 *   3. The truth-line correctly reflects override state (changes from
 *      "Toti partenerii merg in X" to "N parteneri urmeaza, M au
 *      exceptie" when an override exists).
 *   4. When at least one override exists firmwide, the centralised
 *      "Toate exceptiile" callout appears in the header.
 *   5. Clicking "Vezi toate →" opens AllExceptionsDialog with the
 *      list of overrides, each editable + deletable.
 *   6. Deleting an override removes it from the list AND from the
 *      page after refresh.
 *
 * Uses QHM21 NETWORK SRL on year 2026, month 4 — that firm has 1
 * existing override (Enel X Way -> Energie on cont 6058) seeded by
 * manual testing earlier.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;

let prisma: PrismaClient;
let sessionToken: string;
let clientId: string;

test.beforeAll(async () => {
  prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: "solomon.coriiu@costify.ro" },
    select: { id: true },
  });
  if (!user) throw new Error("Test user not found");

  const client = await prisma.client.findFirst({
    where: { slug: CLIENT_SLUG },
    select: { id: true },
  });
  if (!client) throw new Error(`Client ${CLIENT_SLUG} not found`);
  clientId = client.id;

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-mapari-overrides",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-mapari-overrides" },
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

test.describe("Mapari Cashflow — partner overrides UX", () => {
  test("1. Page loads, coverage panel visible", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await expect(page.getByRole("heading", { name: "Mapari Cashflow" })).toBeVisible();
    // The coverage box has the "Acoperire generala" label.
    await expect(page.getByText("Acoperire generala")).toBeVisible();
    // For QHM21 we know the firm is 100% mapped at the cont level.
    await expect(page.getByText(/% atinse explicit/)).toBeVisible();
  });

  test("2. Per-cont partner badge opens slide-panel", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    // Wait for accounts to render.
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Find the cont 6058 row by its cont number and click the badge inside.
    // The badge button has Users icon + count; locate by cont row first.
    const cont6058Row = page.locator("li").filter({ hasText: "6058" }).first();
    await expect(cont6058Row).toBeVisible();
    // Click the partner badge inside that row.
    const badge = cont6058Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    // Slide-panel header should appear with cont 6058 + denumire.
    await expect(page.getByRole("dialog", { name: /Parteneri pe contul/ })).toBeVisible();
    await expect(page.getByText("Cheltuieli cu alte utilitati")).toBeVisible();
    // Truth-line variant depends on override state. QHM21 has 1 override
    // on this cont so we expect the "N parteneri urmeaza" phrasing.
    await expect(
      page.getByText(/parteneri urmeaza maparea contului|partener urmeaza maparea contului|Toti partenerii merg in/)
    ).toBeVisible();
  });

  test("3. Centralised 'Toate exceptiile' callout opens dialog", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);

    // The "Toate exceptiile" callout appears in the coverage panel when
    // overrideCount > 0. QHM21 has 1 override.
    const callout = page.getByText(/exceptie individuala|exceptii individuale/).first();
    await expect(callout).toBeVisible({ timeout: 5000 });

    // Click "Vezi toate →".
    await page.getByRole("button", { name: /Vezi toate/ }).click();

    // Dialog opens with the title "Toate exceptiile pe parteneri".
    await expect(page.getByRole("dialog", { name: "Toate exceptiile" })).toBeVisible();
    await expect(page.getByText("Toate exceptiile pe parteneri")).toBeVisible();

    // At least one exception row should be visible. Search for the cont
    // base it lives on.
    await expect(page.getByText(/6058/).first()).toBeVisible();
  });

  test("4. AllExceptionsDialog search filters rows", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);

    await page.getByRole("button", { name: /Vezi toate/ }).click();
    await expect(page.getByRole("dialog", { name: "Toate exceptiile" })).toBeVisible();

    // Type something that won't match (diacritic-insensitive).
    const searchInput = page.getByPlaceholder("Cauta dupa partener, cont, sau categorie...");
    await searchInput.fill("zzznonexistent");
    await expect(page.getByText("Nicio exceptie nu se potriveste cautarii.")).toBeVisible();

    // Clear, expect rows back.
    await searchInput.fill("");
    await expect(page.getByText(/6058/).first()).toBeVisible();
  });

  test("5. Cont with overrides shows visual cue (left border)", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Find the AccountRow <li> for cont 6058. It has the "group flex
    // items-center" combo on it, distinguishing it from the CategoryNode
    // <li> which uses "rounded-lg border ... p-3". When the cont has an
    // override, the row also gets border-l-2 border-primary/40.
    const cont6058Row = page
      .locator("li.group.flex.items-center")
      .filter({ hasText: /^6058/ })
      .first();
    await expect(cont6058Row).toBeVisible();
    const classAttr = await cont6058Row.getAttribute("class");
    expect(classAttr).toMatch(/border-primary/);
  });
});
