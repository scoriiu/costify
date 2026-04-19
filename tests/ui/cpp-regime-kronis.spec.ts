/**
 * Debug test for 4walls-kronis-srl — reproducing the user's exact scenario.
 * Tests regime switch on CPP tab for year 2025, month 12.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "4walls-kronis-srl";
const YEAR = 2025;
const MONTH = 12;
const CPP_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=cpp&year=${YEAR}&month=${MONTH}`;

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
    select: { id: true, taxRegime: true },
  });
  if (!client) throw new Error(`Client ${CLIENT_SLUG} not found`);
  clientId = client.id;
  console.log("Client ID:", clientId, "current regime:", client.taxRegime);

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
      userAgent: "pw-kronis-debug",
    },
  });
});

test.afterAll(async () => {
  await prisma.client.update({
    where: { id: clientId },
    data: { taxRegime: "profit_standard" },
  });
  await prisma.session.deleteMany({ where: { userAgent: "pw-kronis-debug" } });
  await prisma.$disconnect();
});

async function authedPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await context.addCookies([
    { name: "sid", value: sessionToken, domain: "localhost", path: "/" },
  ]);
  return page;
}

test("kronis 2025/12: regime switch should change Rezultat net", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await authedPage(context);

  // Listen to all fetch requests/responses for /api/balance
  page.on("response", async (response) => {
    if (response.url().includes("/api/balance")) {
      const data = await response.json().catch(() => null);
      if (data) {
        console.log(`  [API] taxRegime=${data.taxRegime} rezultatBrut=${data.cpp?.rezultatBrut} rezultatNet=${data.cpp?.rezultatNet}`);
        const taxLines = data.cpp?.lines?.filter(
          (l: { cont: string }) => ["691", "694", "695", "697", "698"].includes(l.cont)
        );
        console.log(`  [API] tax lines:`, JSON.stringify(taxLines));
      }
    }
  });

  console.log("\n=== NAVIGATING TO", CPP_URL, "===");
  await page.goto(CPP_URL);
  await page.waitForSelector("[data-testid='regime-info']", { timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "temp/pw-kronis-01-initial.png", fullPage: true });

  const getResultValues = async () => {
    return page.evaluate(() => {
      const allText = document.body.innerText;
      const brutMatch = allText.match(/REZULTAT BRUT\s+([\d.,\-]+)/);
      const netMatch = allText.match(/REZULTAT NET\s+([\d.,\-]+)/);
      const impozitMatch = allText.match(/(691|698|695|697)\s+Impozit[^\n]+([\d.,\-]+)/);
      return {
        brut: brutMatch?.[1] ?? "NOT FOUND",
        net: netMatch?.[1] ?? "NOT FOUND",
        impozitLine: impozitMatch?.[0] ?? "NONE",
      };
    });
  };

  const initial = await getResultValues();
  console.log("\n=== INITIAL (profit_standard) ===");
  console.log("Brut:", initial.brut, "Net:", initial.net, "Impozit:", initial.impozitLine);

  // Read the current select trigger text
  const triggerText = await page.locator("button.flex.h-10").filter({
    hasText: /Impozit|Micro|IMCA|HoReCa|amanat/i,
  }).first().textContent();
  console.log("Select trigger shows:", triggerText?.trim());

  // Switch to micro_1
  console.log("\n=== SWITCHING TO micro_1 ===");
  const selectTrigger = page.locator("button.flex.h-10").filter({
    hasText: /Impozit|Micro|IMCA|HoReCa|amanat/i,
  }).first();
  await selectTrigger.click();
  await page.waitForTimeout(500);

  // Screenshot the open dropdown
  await page.screenshot({ path: "temp/pw-kronis-02-dropdown-open.png", fullPage: true });

  const microOption = page.locator("button.w-full").filter({ hasText: "Microintreprindere 1%" });
  const optionVisible = await microOption.isVisible();
  console.log("Micro option visible:", optionVisible);
  await microOption.click();

  // Wait for "Se actualizeaza" to appear and disappear
  console.log("Waiting for data refresh...");
  await page.waitForTimeout(4000);

  await page.screenshot({ path: "temp/pw-kronis-03-after-micro.png", fullPage: true });

  const afterMicro = await getResultValues();
  console.log("\n=== AFTER micro_1 ===");
  console.log("Brut:", afterMicro.brut, "Net:", afterMicro.net, "Impozit:", afterMicro.impozitLine);

  // Check DB
  const dbCheck = await prisma.client.findUnique({
    where: { id: clientId },
    select: { taxRegime: true },
  });
  console.log("DB taxRegime:", dbCheck?.taxRegime);

  const triggerAfter = await selectTrigger.textContent();
  console.log("Select trigger now shows:", triggerAfter?.trim());

  // The key assertion
  console.log("\n=== VERDICT ===");
  console.log("Net changed?", initial.net !== afterMicro.net);
  console.log("  Before:", initial.net);
  console.log("  After: ", afterMicro.net);

  expect(initial.net, "Rezultat net should differ between profit_standard and micro_1").not.toEqual(afterMicro.net);

  await context.close();
});
