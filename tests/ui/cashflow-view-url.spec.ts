/**
 * The Mapari-cashflow view toggle (Lista / Harta / Linii) must reflect the
 * current selection in the URL (?cashflow-view=harta|linii) so the contabil
 * can deep-link and refresh without losing context. "list" is the default and
 * keeps the URL clean (no param). Switching is instant (history.replaceState,
 * no navigation), so we assert the URL changes without a full page load.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;

function serverDatabaseUrl(): string {
  const raw = readFileSync(".env.local", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

let prisma: PrismaClient;
let sessionToken: string;

test.beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: serverDatabaseUrl() } },
  });
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
      userAgent: "playwright-cashflow-view",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-cashflow-view" },
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

function viewToggle(page: Page) {
  return {
    lista: page.getByRole("button", { name: "Lista", exact: true }).first(),
    harta: page.getByRole("button", { name: "Harta", exact: true }).first(),
    linii: page.getByRole("button", { name: "Linii", exact: true }).first(),
  };
}

test.describe("Mapari-cashflow view toggle ↔ URL", () => {
  test("selecting Harta / Linii / Lista updates ?cashflow-view in place", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    const t = viewToggle(page);
    await expect(t.harta).toBeVisible({ timeout: 8000 });

    // Default = list → URL has no cashflow-view param.
    expect(new URL(page.url()).searchParams.get("cashflow-view")).toBeNull();

    await t.harta.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("cashflow-view"))
      .toBe("harta");

    await t.linii.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("cashflow-view"))
      .toBe("linii");

    // Back to Lista clears the param (clean default URL).
    await t.lista.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("cashflow-view"))
      .toBeNull();
  });

  test("switching the view does NOT trigger a full navigation", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    const t = viewToggle(page);
    await expect(t.harta).toBeVisible({ timeout: 8000 });

    // Tag the window; a full reload/navigation would wipe this marker.
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });
    await t.harta.click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("cashflow-view"))
      .toBe("harta");
    const survived = await page.evaluate(
      () => (window as unknown as { __noReload?: boolean }).__noReload === true
    );
    expect(survived).toBe(true);
  });

  test("deep-linking ?cashflow-view=linii opens directly on the Linii view", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(`${MAPARI_URL}&cashflow-view=linii`);
    // The Linii view renders the lines surface; its toggle button reads active.
    const t = viewToggle(page);
    await expect(t.linii).toBeVisible({ timeout: 8000 });
    await expect(t.linii).toHaveAttribute("data-state", "active");
    // URL keeps the param after the mount-time adoption.
    expect(new URL(page.url()).searchParams.get("cashflow-view")).toBe("linii");
  });

  test("deep-linking ?cashflow-view=harta opens directly on the Harta view", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(`${MAPARI_URL}&cashflow-view=harta`);
    const t = viewToggle(page);
    await expect(t.harta).toBeVisible({ timeout: 8000 });
    await expect(t.harta).toHaveAttribute("data-state", "active");
    expect(new URL(page.url()).searchParams.get("cashflow-view")).toBe("harta");
  });
});
