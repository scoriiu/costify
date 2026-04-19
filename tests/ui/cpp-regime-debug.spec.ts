/**
 * Debug test — captures screenshots and logs actual values at each step.
 * Run with: npx playwright test tests/ui/cpp-regime-debug.spec.ts --project=chromium
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "4walls-studio-srl";
const CPP_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=cpp&year=2025&month=12`;

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

  // Reset to profit_standard before test
  await prisma.client.update({
    where: { id: clientId },
    data: { taxRegime: "profit_standard" },
  });

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "pw-regime-debug",
    },
  });
});

test.afterAll(async () => {
  await prisma.client.update({
    where: { id: clientId },
    data: { taxRegime: "profit_standard" },
  });
  await prisma.session.deleteMany({ where: { userAgent: "pw-regime-debug" } });
  await prisma.$disconnect();
});

async function authedPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await context.addCookies([
    { name: "sid", value: sessionToken, domain: "localhost", path: "/" },
  ]);
  return page;
}

test("debug: capture actual CPP values for profit_standard vs micro_1", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await authedPage(context);

  await page.goto(CPP_URL);
  await page.waitForSelector("[data-testid='regime-info']", { timeout: 10000 });

  // Wait for initial data load
  await page.waitForTimeout(3000);

  // Screenshot initial state
  await page.screenshot({ path: "temp/pw-01-initial.png", fullPage: true });

  // Read the full CPP table content
  const getTableText = async () => {
    return page.evaluate(() => {
      const rows = document.querySelectorAll("table tbody tr");
      const data: string[] = [];
      rows.forEach((r) => {
        const cells = r.querySelectorAll("td");
        const texts = Array.from(cells).map((c) => c.textContent?.trim() ?? "");
        data.push(texts.join(" | "));
      });
      return data;
    });
  };

  // Get footer summary values
  const getFooterValues = async () => {
    return page.evaluate(() => {
      const footer = document.querySelector(".grid.grid-cols-4");
      if (!footer) return "NO FOOTER FOUND";
      return footer.textContent?.replace(/\s+/g, " ").trim() ?? "";
    });
  };

  console.log("\n=== INITIAL STATE (should be profit_standard) ===");
  const initialTable = await getTableText();
  const initialFooter = await getFooterValues();
  console.log("Footer:", initialFooter);
  // Print last 5 table rows (around impozit + net)
  for (const row of initialTable.slice(-5)) {
    console.log("  ", row);
  }

  // Now click profit_standard explicitly
  console.log("\n=== SELECTING profit_standard ===");
  const selectTrigger = page.locator("button.flex.h-10").filter({
    hasText: /Impozit|Micro|IMCA|HoReCa|amanat/i,
  }).first();
  await selectTrigger.click();
  await page.waitForTimeout(300);
  await page.locator("button.w-full").filter({ hasText: "Impozit pe profit (16%)" }).click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "temp/pw-02-profit-standard.png", fullPage: true });

  const standardTable = await getTableText();
  const standardFooter = await getFooterValues();
  console.log("Footer:", standardFooter);
  for (const row of standardTable.slice(-5)) {
    console.log("  ", row);
  }

  // Verify DB was updated
  const clientAfterStd = await prisma.client.findUnique({
    where: { id: clientId },
    select: { taxRegime: true },
  });
  console.log("DB taxRegime after selecting standard:", clientAfterStd?.taxRegime);

  // Now switch to micro_1
  console.log("\n=== SELECTING micro_1 ===");
  await selectTrigger.click();
  await page.waitForTimeout(300);
  await page.locator("button.w-full").filter({ hasText: "Microintreprindere 1%" }).click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "temp/pw-03-micro-1.png", fullPage: true });

  const microTable = await getTableText();
  const microFooter = await getFooterValues();
  console.log("Footer:", microFooter);
  for (const row of microTable.slice(-5)) {
    console.log("  ", row);
  }

  // Verify DB was updated
  const clientAfterMicro = await prisma.client.findUnique({
    where: { id: clientId },
    select: { taxRegime: true },
  });
  console.log("DB taxRegime after selecting micro_1:", clientAfterMicro?.taxRegime);

  // The key assertion
  console.log("\n=== COMPARISON ===");
  console.log("Standard footer:", standardFooter);
  console.log("Micro footer:   ", microFooter);
  console.log("Are they different?", standardFooter !== microFooter);

  expect(standardFooter).not.toEqual(microFooter);

  await context.close();
});
