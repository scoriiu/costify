/**
 * Browser coverage for the CPP per business-line (vertical) breakdown.
 *
 * Runs against QHM21 NETWORK SRL (verticals enabled) at 2025-06. Asserts that
 * the Cont Profit si Pierdere table grows one column per business line, and
 * that every row's per-line amounts add up to the row total (no leak) — read
 * straight from the rendered cells, end to end.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const CPP_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=cpp&cashflow-year=2025&cashflow-month=6`;

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
      userAgent: "playwright-cpp-business-lines",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-cpp-business-lines" },
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

function parseRo(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Read a total row by its label and assert the business-line cells (the last
 *  `valueCols` cells, minus the total) sum to the total cell. The leading
 *  Cont/Rand cell is excluded by slicing from the end. */
async function expectNoLeak(page: Page, label: string, valueCols: number) {
  const row = page.locator("tr", { hasText: label }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  const cells = await row.locator("td").allInnerTexts();
  const tail = cells.slice(-valueCols).map((x) => parseRo(x) ?? 0);
  const total = tail[tail.length - 1];
  const parts = tail.slice(0, -1).reduce((s, v) => s + v, 0);
  expect(Math.abs(parts - total)).toBeLessThan(0.5);
}

test.describe("CPP per business-line breakdown", () => {
  test("renders one column per business line and never leaks", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(CPP_URL);

    await expect(
      page.getByText("Defalcare pe linii de business", { exact: false })
    ).toBeVisible({ timeout: 15000 });

    for (const name of ["Outsourcing", "Recrutare", "Coworking"]) {
      await expect(
        page.getByRole("columnheader", { name, exact: true })
      ).toBeVisible();
    }

    // 4 business-line columns (incl. "Toata firma") + Total.
    const COLS = 5;
    await expectNoLeak(page, "Total venituri din exploatare", COLS);
    await expectNoLeak(page, "Total cheltuieli din exploatare", COLS);
    await expectNoLeak(page, "REZULTAT NET", COLS);

    // Detailed (F20) view carries the breakdown too.
    await page.getByRole("button", { name: /F20/ }).click();
    await expect(
      page.getByRole("columnheader", { name: "Outsourcing", exact: true })
    ).toBeVisible({ timeout: 10000 });
    await expectNoLeak(page, "VENITURI TOTALE", COLS);
    await expectNoLeak(page, "CHELTUIELI TOTALE", COLS);
  });
});
