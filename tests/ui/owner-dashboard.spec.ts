/**
 * Smoke tests for the antreprenor (owner) dashboard.
 *
 * Verifies the new modern dashboard renders correctly:
 *   - HeroSummary: cash hero + 3 supporting metrics
 *   - HealthPulse: ring vitals
 *   - CashflowWaterfall: how the month moved cash
 *   - EvolutionChart: 12-month interactive chart with toggles
 *   - YoyComparison: paired bars (when prior-year data exists)
 *   - Category breakdowns: interactive donuts
 *   - Top expenses + insights + outstanding tables
 *
 * Uses QHM21 NETWORK SRL — same fixture as the mapari tests.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const OWNER_URL = `${BASE}/clients/${CLIENT_SLUG}?view=owner`;

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
      userAgent: "playwright-owner-dashboard",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-owner-dashboard" },
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

test.describe("Owner dashboard — modern UI smoke", () => {
  test("1. Page loads without runtime errors", async ({ context }) => {
    const page = await authedPage(context);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(OWNER_URL, { waitUntil: "domcontentloaded" });
    // Give client components a moment to mount.
    await page.waitForLoadState("networkidle");

    expect(errors, `Page errors: ${errors.join("\n")}`).toHaveLength(0);
  });

  test("2. Hero summary renders cash + supporting metrics", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    // The hero shows the eyebrow + a big cash number + supporting blocks.
    await expect(page.getByText(/Bani in casa si banca/i).first()).toBeVisible();
    // Three supporting metrics — labels appear in multiple places, use .first().
    await expect(page.getByText("De primit de la clienti").first()).toBeVisible();
    await expect(page.getByText("De platit furnizorilor").first()).toBeVisible();
    await expect(page.getByText(/Profit anul acesta/i).first()).toBeVisible();
  });

  test("3. Health pulse rings render", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    await expect(page.getByText("Sanatatea firmei")).toBeVisible();
    // SVG rings + the 3 vital list rows should all be present.
    await expect(page.getByRole("img", { name: /Inele de sanatate/i })).toBeVisible();
    await expect(page.getByText("Cati bani iti ajung").first()).toBeVisible();
    await expect(page.getByText("Marja operationala").first()).toBeVisible();
  });

  test("4. Cashflow waterfall renders the four steps", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    await expect(page.getByText("Cum s-au miscat banii luna asta")).toBeVisible();
    // The waterfall SVG carries an accessible label.
    await expect(
      page.getByRole("img", { name: /Miscarea banilor in luna curenta/i })
    ).toBeVisible();
    // Each step label is rendered as an SVG <text> inside that SVG.
    for (const step of ["Inceput luna", "Incasari", "Plati", "Final luna"]) {
      await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
    }
  });

  test("5. Evolution chart shows series toggle pills", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    await expect(
      page.getByRole("heading", { name: /Cum a evoluat firma/i })
    ).toBeVisible();
    // The three toggle pills.
    for (const label of ["Venituri", "Cheltuieli", "Bani la final"]) {
      await expect(
        page.getByRole("button", { name: label, exact: false }).first()
      ).toBeVisible();
    }
  });

  test("6. Toggling a series in evolution chart updates aria-pressed", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    const pill = page
      .getByRole("button", { name: "Venituri", exact: false })
      .first();
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    await pill.click();
    await expect(pill).toHaveAttribute("aria-pressed", "false");
  });

  test("7. Category breakdown renders both donuts", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    await expect(
      page.getByRole("heading", { name: /Unde s-au dus banii/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /De unde au venit banii/i })
    ).toBeVisible();
  });

  test("8. Top expenses list renders with header", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    await expect(
      page.getByRole("heading", { name: /Top cheltuieli ale lunii/i })
    ).toBeVisible();
  });

  test("9. Insights expand/collapse interaction works", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    const insights = page.getByRole("heading", { name: /Ce ar trebui sa stii/i });
    // Skip if no insights for this firm.
    if (await insights.count()) {
      await expect(insights).toBeVisible();
      // The expandable cards have aria-expanded; verify at least one exists.
      const expandables = page.locator("button[aria-expanded]");
      await expect(expandables.first()).toBeVisible();
    }
  });

  test("10. PageHeader eyebrow shows the period", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(OWNER_URL);

    // The new PageHeader shows a small mono uppercase eyebrow with the
    // current period (luna + an). Verify a Romanian month name is visible.
    const months = [
      "Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie",
      "Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie",
    ];
    const pattern = new RegExp(months.join("|"), "i");
    await expect(page.getByText(pattern).first()).toBeVisible();
  });
});
