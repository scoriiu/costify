/**
 * Browser coverage for the Mapari period toolbar: it must stay visible while
 * scrolling (position: sticky) and the prev/next buttons must step month by
 * month, crossing into adjacent months that have data.
 *
 * Runs against QHM21 NETWORK SRL, 2026 (Jan..Apr have data). Starts on
 * February so both directions are exercised.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const FEB_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow&cashflow-year=2026&cashflow-month=2`;

function serverDatabaseUrl(): string {
  const raw = readFileSync(".env.local", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

let prisma: PrismaClient;
let sessionToken: string;

test.beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: serverDatabaseUrl() } } });
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
      userAgent: "playwright-period-nav",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({ where: { userAgent: "playwright-period-nav" } });
  await prisma.$disconnect();
});

async function authedPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await context.addCookies([
    { name: "sid", value: sessionToken, domain: "localhost", path: "/" },
  ]);
  await page.goto(FEB_URL);
  await page.waitForSelector("text=Cheltuieli", { timeout: 10000 });
  return page;
}

test.describe("Mapari period toolbar", () => {
  test("1. The period bar is sticky", async ({ context }) => {
    const page = await authedPage(context);
    const bar = page.getByTestId("mapari-period-bar");
    await expect(bar).toBeVisible();
    const position = await bar.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe("sticky");
  });

  test("2. Next steps Feb -> Mar, Prev steps back", async ({ context }) => {
    const page = await authedPage(context);
    const bar = page.getByTestId("mapari-period-bar");

    await bar.getByRole("button", { name: /Luna urmatoare/ }).click();
    await expect(bar.getByText("Martie", { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page).toHaveURL(/cashflow-month=3/);

    await bar.getByRole("button", { name: /Luna anterioara/ }).click();
    await expect(bar.getByText("Februarie", { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page).toHaveURL(/cashflow-month=2/);
  });

  test("3. Next is disabled at the latest available month", async ({ context }) => {
    const page = await authedPage(context);
    const bar = page.getByTestId("mapari-period-bar");
    // April 2026 is the latest month with data, so Next has nowhere to go.
    await page.goto(`${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow&cashflow-year=2026&cashflow-month=4`);
    await page.waitForSelector("text=Cheltuieli", { timeout: 10000 });
    await expect(bar.getByText("Aprilie", { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(
      bar.getByRole("button", { name: /Nu exista luna urmatoare/ })
    ).toBeDisabled();
  });

  test("4. Prev crosses the year boundary (Jan 2026 -> Dec 2025)", async ({ context }) => {
    const page = await authedPage(context);
    const bar = page.getByTestId("mapari-period-bar");
    // Feb -> Jan -> Dec 2025: month-by-month stepping spans years.
    await bar.getByRole("button", { name: /Luna anterioara/ }).click();
    await expect(bar.getByText("Ianuarie", { exact: true })).toBeVisible({ timeout: 6000 });
    await bar.getByRole("button", { name: /Luna anterioara/ }).click();
    await expect(bar.getByText("Decembrie", { exact: true })).toBeVisible({ timeout: 6000 });
    await expect(page).toHaveURL(/cashflow-year=2025/);
    await expect(page).toHaveURL(/cashflow-month=12/);
  });
});
