/**
 * Mutation flows on the "Linii de business" view — the writes an accountant
 * actually makes, verified end-to-end (UI action → DB → recomputed money on
 * the line cards). Each test restores the prior state so the suite is
 * idempotent across runs.
 *
 *   A. Change a category split (Marfa 50/50 → 70/30) and watch the line
 *      cards' money shift, then revert.
 *   B. Pin a single cont to one line (cont-level override beats the category
 *      split), verify it moves money, then clear it.
 *
 * Runs against QHM21 NETWORK SRL, year 2026.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;
const MARFA_CATEGORY_ID = "cmpmx7axp0004nv01ufdnhith";
const OUTSOURCING_ID = "cmpp2hz740005k801z2zl9ifl";
const COWORKING_ID = "cmpp2indg0003l1010kyzhwak";

function serverDatabaseUrl(): string {
  const raw = readFileSync(".env.local", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

let prisma: PrismaClient;
let sessionToken: string;
let clientId: string;
let savedMarfaSplits: unknown;

test.beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: serverDatabaseUrl() } },
  });
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

  // Snapshot the Marfa split so we always restore it.
  const marfa = await prisma.categoryVerticalAllocation.findFirst({
    where: { clientId, categoryId: MARFA_CATEGORY_ID },
    select: { splits: true },
  });
  savedMarfaSplits = marfa?.splits ?? null;

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-lines-mut",
    },
  });
});

test.afterAll(async () => {
  // Restore the Marfa split to its original 50/50.
  if (savedMarfaSplits) {
    await prisma.categoryVerticalAllocation.updateMany({
      where: { clientId, categoryId: MARFA_CATEGORY_ID },
      data: { splits: savedMarfaSplits as object },
    });
  }
  // Remove any cont-level pin created by the tests.
  await prisma.verticalAllocation.deleteMany({
    where: { clientId, cont: "603" },
  });
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-lines-mut" },
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

async function openLinii(page: Page) {
  await page.goto(MAPARI_URL);
  await page.waitForSelector("text=Cheltuieli", { timeout: 8000 });
  await page.getByRole("button", { name: "Linii de business", exact: true }).click();
}

function parseLei(s: string): number {
  const digits = s.replace(/[^\d-]/g, "");
  return digits === "" ? 0 : parseInt(digits, 10);
}

async function coworkingExpenses(page: Page): Promise<number> {
  const coworking = page
    .locator("button")
    .filter({ hasText: "Coworking" })
    .first();
  await expect(coworking).toBeVisible({ timeout: 6000 });
  const text = await coworking.innerText();
  const m = text.match(/C\s+([\d.]+)/);
  return m ? parseLei(m[1]) : 0;
}

test.describe("Linii de business — mutation flows", () => {
  test("A. Changing Marfa 50/50 → 70/30 shifts money; revert restores it", async ({
    context,
  }) => {
    const page = await authedPage(context);

    // Ensure starting state is 50/50.
    await prisma.categoryVerticalAllocation.updateMany({
      where: { clientId, categoryId: MARFA_CATEGORY_ID },
      data: {
        splits: [
          { verticalId: OUTSOURCING_ID, percent: 50 },
          { verticalId: COWORKING_ID, percent: 50 },
        ],
      },
    });

    await openLinii(page);
    await page.locator("button").filter({ hasText: "Coworking" }).first().click();
    const before = await coworkingExpenses(page);
    expect(before).toBeGreaterThan(0);

    // Open the Marfa category split editor.
    const marfaRow = page
      .locator("li")
      .filter({ hasText: /Marfa, materii prime si materiale/ })
      .first();
    await marfaRow
      .getByRole("button", { name: /Editeaza impartirea liniei de cost/ })
      .click();

    const dialog = page.getByRole("dialog", { name: /Editeaza liniile/ });
    await expect(dialog).toBeVisible({ timeout: 4000 });

    // Two percent inputs (Outsourcing, Coworking). Set them to 70 / 30.
    // The split editor recomputes the partner total; we set the first to 70,
    // second to 30.
    const percents = dialog.locator("input[type='number']");
    await expect(percents).toHaveCount(2);
    await percents.nth(0).fill("70");
    await percents.nth(1).fill("30");

    await dialog.getByRole("button", { name: "Salveaza" }).click();
    await expect(dialog).toBeHidden({ timeout: 6000 });

    // DB persisted the new split.
    await expect
      .poll(
        async () => {
          const row = await prisma.categoryVerticalAllocation.findFirst({
            where: { clientId, categoryId: MARFA_CATEGORY_ID },
            select: { splits: true },
          });
          const splits = (row?.splits ?? []) as Array<{
            verticalId: string;
            percent: number;
          }>;
          const cw = splits.find((s) => s.verticalId === COWORKING_ID);
          return cw?.percent ?? -1;
        },
        { timeout: 6000 }
      )
      .toBe(30);

    // The Coworking card now carries LESS expense than before (30% vs 50%).
    // The save triggers an async refetch; poll the card until the money
    // settles to the new (smaller) value.
    await expect
      .poll(() => coworkingExpenses(page), { timeout: 8000 })
      .toBeLessThan(before);
    const after = await coworkingExpenses(page);
    expect(after).toBeGreaterThan(0);
    // 30/50 of the prior value, within rounding tolerance.
    expect(Math.abs(after - before * (30 / 50))).toBeLessThan(before * 0.05);

    // Revert to 50/50 via DB (cleaner than re-driving the UI) and confirm UI.
    await prisma.categoryVerticalAllocation.updateMany({
      where: { clientId, categoryId: MARFA_CATEGORY_ID },
      data: {
        splits: [
          { verticalId: OUTSOURCING_ID, percent: 50 },
          { verticalId: COWORKING_ID, percent: 50 },
        ],
      },
    });
    // bump dataVersion isn't reachable here; force a fresh server fetch.
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 8000 });
    await page.getByRole("button", { name: "Linii de business", exact: true }).click();
    await page.locator("button").filter({ hasText: "Coworking" }).first().click();
    const restored = await coworkingExpenses(page);
    expect(Math.abs(restored - before)).toBeLessThan(before * 0.02);
  });

  test("B. Pinning cont 603 to 100% Outsourcing beats the category split; clear restores", async ({
    context,
  }) => {
    const page = await authedPage(context);

    // Clean slate: ensure 603 has no cont-level pin and Marfa is 50/50.
    await prisma.verticalAllocation.deleteMany({
      where: { clientId, cont: "603" },
    });
    await prisma.categoryVerticalAllocation.updateMany({
      where: { clientId, categoryId: MARFA_CATEGORY_ID },
      data: {
        splits: [
          { verticalId: OUTSOURCING_ID, percent: 50 },
          { verticalId: COWORKING_ID, percent: 50 },
        ],
      },
    });

    await openLinii(page);
    await page.locator("button").filter({ hasText: "Coworking" }).first().click();
    const before = await coworkingExpenses(page);
    expect(before).toBeGreaterThan(0);

    // Expand Marfa, open cont 603's split editor.
    const marfaRow = page
      .locator("li")
      .filter({ hasText: /Marfa, materii prime si materiale/ })
      .first();
    await marfaRow.getByRole("button").first().click();
    const contRow = marfaRow.locator("li").filter({ hasText: /^603/ }).first();
    await contRow.hover();
    await contRow.getByRole("button", { name: /Editeaza linia contului/ }).click();

    const dialog = page.getByRole("dialog", { name: /Editeaza liniile/ });
    await expect(dialog).toBeVisible({ timeout: 4000 });

    // Set the single row to 100% Outsourcing. The cont starts inheriting the
    // category 50/50; pick Outsourcing in the first row and set it to 100,
    // removing the second row if present.
    const removeButtons = dialog.getByRole("button", { name: "Sterge" });
    // Remove extra split rows until one remains.
    while ((await removeButtons.count()) > 0) {
      await removeButtons.first().click();
    }
    const firstSelect = dialog.locator("button[aria-haspopup='listbox']").first();
    await firstSelect.click();
    await page.getByRole("option", { name: "Outsourcing" }).first().click();
    const percent = dialog.locator("input[type='number']").first();
    await percent.fill("100");

    await dialog.getByRole("button", { name: "Salveaza" }).click();
    await expect(dialog).toBeHidden({ timeout: 6000 });

    // DB persisted a 100% Outsourcing pin on 603.
    await expect
      .poll(
        async () => {
          const row = await prisma.verticalAllocation.findFirst({
            where: { clientId, cont: "603" },
            select: { splits: true },
          });
          const splits = (row?.splits ?? []) as Array<{
            verticalId: string;
            percent: number;
          }>;
          if (splits.length !== 1) return "none";
          return splits[0].verticalId === OUTSOURCING_ID &&
            splits[0].percent === 100
            ? "outsourcing-100"
            : "other";
        },
        { timeout: 6000 }
      )
      .toBe("outsourcing-100");

    // Coworking lost 603's 50% slice → its expense drops.
    await expect
      .poll(() => coworkingExpenses(page), { timeout: 8000 })
      .toBeLessThan(before);

    // Clear the pin → 603 falls back to the category 50/50, money restored.
    await prisma.verticalAllocation.deleteMany({
      where: { clientId, cont: "603" },
    });
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 8000 });
    await page.getByRole("button", { name: "Linii de business", exact: true }).click();
    await page.locator("button").filter({ hasText: "Coworking" }).first().click();
    const restored = await coworkingExpenses(page);
    expect(Math.abs(restored - before)).toBeLessThan(before * 0.02);
  });
});
