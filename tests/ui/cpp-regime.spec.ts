/**
 * Playwright tests for CPP Regim fiscal switching.
 *
 * Verifies that:
 *   1. Each regime option is selectable
 *   2. The regime info badge updates with the correct formula + cont
 *   3. Rezultat net changes when the client has data for multiple
 *      tax accounts (4Walls Studio has both 691 and 698)
 *   4. The selected regime persists across page reloads
 *
 * Uses 4Walls Studio SRL (has 691 profit_standard + 698 micro data)
 * on year 2025, month 12.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "4walls-studio-srl";
const CPP_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=cpp&year=2025&month=12`;

const REGIMES = [
  {
    value: "profit_standard",
    label: "Impozit pe profit (16%)",
    formula: "16% × Profit impozabil",
    cont: "691",
  },
  {
    value: "profit_micro_1",
    label: "Microintreprindere 1%",
    formula: "1% × Venituri totale",
    cont: "698",
  },
  {
    value: "profit_micro_3",
    label: "Microintreprindere 3%",
    formula: "3% × Venituri totale",
    cont: "698",
  },
  {
    value: "imca",
    label: "Impozit minim (IMCA)",
    formula: "1% × Cifra de afaceri (minim)",
    cont: "697",
  },
  {
    value: "profit_specific",
    label: "Impozit specific (HoReCa)",
    formula: "Suma fixa per unitate",
    cont: "695",
  },
  {
    value: "deferred",
    label: "Impozit amanat",
    formula: "Diferente temporare × 16%",
    cont: "698",
  },
];

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
      userAgent: "playwright-cpp-regime",
    },
  });
});

test.afterAll(async () => {
  // Reset regime to profit_standard so other tests/users aren't surprised.
  await prisma.client.update({
    where: { id: clientId },
    data: { taxRegime: "profit_standard" },
  });
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-cpp-regime" },
  });
  await prisma.$disconnect();
});

async function authedPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await context.addCookies([
    {
      name: "sid",
      value: sessionToken,
      domain: "localhost",
      path: "/",
    },
  ]);
  return page;
}

async function selectRegime(page: Page, label: string) {
  // The Select component renders: a trigger <button> inside a <div>,
  // and when open, a dropdown <div> with option <button>s.
  // We need to click the trigger first, then click the option in the
  // dropdown (the second button matching the label, since the first
  // is the trigger itself if it currently shows the same label).

  // Click the trigger (the one inside the regime selector area)
  const trigger = page.locator("[data-testid='regime-info']")
    .locator("xpath=preceding-sibling::div[1]//button")
    .first();

  // Fallback: find the select trigger by its distinctive styling
  const selectTrigger = page.locator("button.flex.h-10").filter({
    hasText: /Impozit|Micro|IMCA|HoReCa|amanat/i,
  }).first();

  await selectTrigger.click();
  await page.waitForTimeout(300);

  // The dropdown options are full-width buttons inside an absolute div.
  // They're distinguishable from the trigger by having w-full class.
  const dropdownOption = page.locator("button.w-full").filter({ hasText: label });
  await dropdownOption.click();

  // Wait for server action + re-fetch
  await page.waitForTimeout(2000);
}

async function getRegimeInfoFormula(page: Page): Promise<string> {
  const info = page.locator("[data-testid='regime-info']");
  return (await info.getAttribute("data-formula")) ?? "";
}

async function getRegimeInfoCont(page: Page): Promise<string> {
  const info = page.locator("[data-testid='regime-info']");
  return (await info.getAttribute("data-cont")) ?? "";
}

async function getRezultatNet(page: Page): Promise<string> {
  // Look for "REZULTAT NET" in both simplified and F20 views.
  // In simplified: it's a row with isTotal=true, denumire "REZULTAT NET".
  // We find the row and get the value cell.
  const netRow = page.locator("text=REZULTAT NET").first();
  const row = netRow.locator("xpath=ancestor::tr").first();
  const cells = row.locator("td");
  const lastCell = cells.last();
  return (await lastCell.textContent())?.trim() ?? "";
}

test.describe("CPP Regim fiscal — regime info badge", () => {
  test("shows correct formula and cont for each regime", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authedPage(context);

    await page.goto(CPP_URL);
    await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

    for (const regime of REGIMES) {
      await selectRegime(page, regime.label);

      const formula = await getRegimeInfoFormula(page);
      const cont = await getRegimeInfoCont(page);
      expect(formula, `Formula after selecting "${regime.label}"`).toBe(regime.formula);
      expect(cont, `Cont after selecting "${regime.label}"`).toBe(regime.cont);
    }

    // Reset to profit_standard
    await selectRegime(page, "Impozit pe profit (16%)");
    await context.close();
  });
});

test.describe("CPP Regim fiscal — rezultat net changes", () => {
  test("switching from profit_standard to micro_1 changes rezultat net on a client with both 691 and 698", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await authedPage(context);

    await page.goto(CPP_URL);
    await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

    // Ensure we start on profit_standard
    await selectRegime(page, "Impozit pe profit (16%)");
    const netStandard = await getRezultatNet(page);

    // Switch to micro 1%
    await selectRegime(page, "Microintreprindere 1%");
    const netMicro = await getRezultatNet(page);

    // 4Walls Studio 2025 has 691 data but no 698 data,
    // so micro should show higher net (no tax deducted).
    expect(netStandard).not.toBe("");
    expect(netMicro).not.toBe("");
    expect(netStandard).not.toEqual(netMicro);

    // Reset
    await selectRegime(page, "Impozit pe profit (16%)");
    await context.close();
  });

  test("profit_standard shows impozit line with cont 691", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authedPage(context);

    await page.goto(CPP_URL);
    await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

    await selectRegime(page, "Impozit pe profit (16%)");

    // Look for 691 or "Impozit pe profit" in the CPP table
    const impozitRow = page.locator("text=691").or(page.locator("text=Impozit pe profit"));
    await expect(impozitRow.first()).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test("profit_micro_1 on a client without 698 data shows no impozit line", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await authedPage(context);

    await page.goto(CPP_URL);
    await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

    await selectRegime(page, "Microintreprindere 1%");

    // In 2025, 4Walls has no 698 entries. The impozit line should be
    // absent (value 0, hidden from simplified view) or show "—".
    // "Impozit pe venit microintreprindere" should NOT appear.
    const microImpozit = page.locator("text=Impozit pe venit microintreprindere");
    await expect(microImpozit).not.toBeVisible({ timeout: 3000 });

    // Reset
    await selectRegime(page, "Impozit pe profit (16%)");
    await context.close();
  });
});

test.describe("CPP Regim fiscal — persistence", () => {
  test("selected regime persists across page reload", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await authedPage(context);

    await page.goto(CPP_URL);
    await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

    // Switch to IMCA
    await selectRegime(page, "Impozit minim (IMCA)");

    const formulaBefore = await getRegimeInfoFormula(page);
    expect(formulaBefore).toContain("Cifra de afaceri");

    // Reload the page
    await page.reload();
    await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

    const formulaAfter = await getRegimeInfoFormula(page);
    expect(formulaAfter).toContain("Cifra de afaceri");

    // Reset
    await selectRegime(page, "Impozit pe profit (16%)");
    await context.close();
  });
});
