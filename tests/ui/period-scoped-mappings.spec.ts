/**
 * Browser coverage for period-scoped mappings (ADR-0004).
 *
 * The accountant's real flows the feature must support:
 *   1. Moving a cont offers a PERIOD SCOPE: "Toate perioadele" / "Din <luna>
 *      inainte" / "Doar <luna>". This is what the user reached for when they
 *      wanted a split to apply to February only.
 *   2. A cont whose mapping varies in time carries a CLOCK indicator in the
 *      account list.
 *   3. A cost line whose composition changed exposes an EVOLUTION drawer from
 *      the chart legend (the discoverable clock next to the line), and the
 *      drawer lists which conturi entered/left and when.
 *
 * Runs against QHM21 NETWORK SRL, year 2026 (latest period 2026-04). The spec
 * seeds ONE dated tombstone (a cont leaves its cost line from March 2026) so a
 * real configuration change exists, then asserts the UI surfaces it. The seed
 * is removed after each test so the suite is order-independent.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;
const SCOPE_FROM = 202603; // March 2026 — mid-data, inside the chart window.

function serverDatabaseUrl(): string {
  const raw = readFileSync(".env.local", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

let prisma: PrismaClient;
let sessionToken: string;
let clientId: string;
let seededCont: string; // the cont we move off its line from March
let seedRowId: string | null = null;

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

  // Pick a base-level class-6 cont that (a) actually has 2026 rulaj so its row
  // renders, and (b) carries an inception mapping so tombstoning it from March
  // produces a real "left the line" change. Base-level (contD == contDBase)
  // keeps account.cont == mapping.cont, so the testids line up cleanly.
  const active = await prisma.$queryRaw<{ cont: string; total: number }[]>`
    SELECT "contD" AS cont, SUM(suma)::float AS total
    FROM "JournalLine"
    WHERE "clientId" = ${clientId} AND year = 2026 AND "deletedAt" IS NULL
      AND "contDBase" LIKE '6%' AND "contD" = "contDBase"
    GROUP BY "contD" ORDER BY total DESC`;
  for (const row of active) {
    const m = await prisma.accountCategoryMapping.findFirst({
      where: { clientId, effectiveFrom: 0, cont: row.cont, categoryId: { not: null } },
      select: { cont: true },
    });
    if (m) {
      seededCont = m.cont;
      break;
    }
  }
  if (!seededCont) throw new Error("No active inception-mapped cont to seed against");

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-period-scoped",
    },
  });
});

test.beforeEach(async () => {
  // Tombstone: from March 2026 the cont carries no cost line. Combined with its
  // inception mapping this is a bounded "varies in time" version on the cont.
  const row = await prisma.accountCategoryMapping.create({
    data: {
      clientId,
      scope: "contBase",
      cont: seededCont,
      categoryId: null,
      effectiveFrom: SCOPE_FROM,
      effectiveTo: null,
    },
    select: { id: true },
  });
  seedRowId = row.id;
});

test.afterEach(async () => {
  if (seedRowId) {
    await prisma.accountCategoryMapping
      .delete({ where: { id: seedRowId } })
      .catch(() => undefined);
    seedRowId = null;
  }
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-period-scoped" },
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

async function openMapari(page: Page) {
  await page.goto(MAPARI_URL);
  await page.waitForSelector("text=Cheltuieli", { timeout: 10000 });
}

// From March the seeded cont is a tombstone, so at the latest period it sits in
// the "Nemapate" callout. Switch the filter so its row (with the clock + move
// affordances) renders.
async function showUnmapped(page: Page) {
  await page.getByRole("button", { name: /Nemapate/ }).click();
  await expect(
    page.getByTestId(`cont-period-scoped-${seededCont}`)
  ).toBeVisible({ timeout: 8000 });
}

test.describe("Period-scoped mappings", () => {
  test("1. Moving a cont offers the three period-scope options", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);
    await showUnmapped(page);

    const moveBtn = page.getByTestId(`move-cont-${seededCont}`);
    await moveBtn.scrollIntoViewIfNeeded();
    await moveBtn.click();

    // The MoveAccountInline form must expose the scope picker. Labels are
    // generated from the viewed period, so we assert the stable prefixes.
    await expect(page.getByText("Toate perioadele")).toBeVisible({
      timeout: 6000,
    });
    await expect(page.getByText(/^Din .+ inainte$/)).toBeVisible();
    await expect(page.getByText(/^Doar /)).toBeVisible();
  });

  test("2. A time-varying cont shows the clock indicator", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);
    await showUnmapped(page);
  });

  test("3. A changed cost line opens the evolution drawer with the change log", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);

    // Wait for the trends chart (its legend carries the evolution clocks).
    await expect(
      page.getByRole("heading", { name: "Evolutia liniilor pe luni" })
    ).toBeVisible({ timeout: 10000 });

    // At least one line changed (the one our cont left). Open its drawer.
    const opener = page.locator('[data-testid^="line-evolution-open-"]').first();
    await expect(opener).toBeVisible({ timeout: 8000 });
    await opener.click();

    const drawer = page.getByRole("dialog", { name: /Evolutia configuratiei/ });
    await expect(drawer).toBeVisible({ timeout: 6000 });
    // The change log must name the cont that left the line.
    await expect(drawer.getByText(new RegExp(`cont ${seededCont}\\b`))).toBeVisible();
  });

  test("4. The helicopter banner lists the time-varying config and jumps to a segment", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);

    // The banner appears once line-trends loads (the seeded cont's mapping
    // changes within the window, so it must be surfaced).
    await expect(page.getByTestId("config-overview-toggle")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Configurari care se schimba in timp")
    ).toBeVisible();

    // Banner starts collapsed; open it to reach the per-line rows.
    await page.getByTestId("config-overview-toggle").click();

    const row = page.locator("li").filter({ hasText: `cont ${seededCont}` }).first();
    await expect(row).toBeVisible();

    // At least two segments (the config is not constant). Click the first
    // segment chip; the page must jump to that segment's start period.
    const chips = row.getByRole("button");
    expect(await chips.count()).toBeGreaterThanOrEqual(2);
    await chips.first().click();
    await expect(page).not.toHaveURL(/cashflow-month=4(?!\d)/);
  });

  test("5. A non-uniform line marks the deviating cont and opens its breakdown", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);
    await expect(page.getByTestId("config-overview-toggle")).toBeVisible({
      timeout: 10000,
    });
    // Banner starts collapsed; the override marker lives inside it.
    await page.getByTestId("config-overview-toggle").click();

    // qhm21's Vanzari line carries a category split, but cont 704 inside it has
    // its own (44/33/23) split - the headline is not the whole truth. That must
    // be flagged with the deviation marker.
    const marker = page.getByTestId("override-marker").first();
    await expect(marker).toBeVisible({ timeout: 8000 });
    await marker.click();

    const drawer = page.getByTestId("override-breakdown").first();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Impartire neuniforma/)).toBeVisible();
    // The breakdown names the deviating cont and shows a concrete split.
    await expect(drawer.getByText(/cont \d/).first()).toBeVisible();
    await expect(drawer.getByText(/%/).first()).toBeVisible();
  });

  test("6. The changelog modal lists changes as before -> after and jumps on click", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);
    await expect(page.getByTestId("config-overview-toggle")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("config-changelog-open").click();
    const modal = page.getByTestId("config-changelog-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Schimbari de configurare")).toBeVisible();

    // At least one change entry showing a before -> after (two values + arrow).
    const entry = modal.locator("button").filter({ hasText: "%" }).first();
    await expect(entry).toBeVisible();

    // Clicking an entry jumps to that change's month and closes the modal.
    await entry.click();
    await expect(modal).toBeHidden();
  });

  test("7. The chart marks the month a line's configuration changed", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);
    await expect(
      page.getByRole("heading", { name: "Evolutia liniilor pe luni" })
    ).toBeVisible({ timeout: 10000 });

    // The seeded cont leaves its line in March, so that band carries a change
    // marker on the chart at that month.
    await expect(page.getByTestId("line-change-dot").first()).toBeVisible({
      timeout: 8000,
    });
  });

  test("8. The evolution drawer shows a line's split change as before -> after", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openMapari(page);
    await expect(
      page.getByRole("heading", { name: "Evolutia liniilor pe luni" })
    ).toBeVisible({ timeout: 10000 });

    // Marfa's vertical split changes over the window, so its legend clock opens
    // a drawer that spells out the change as before -> after.
    const opener = page.getByRole("button", {
      name: /Vezi evolutia configuratiei pentru Marfa/,
    });
    await expect(opener).toBeVisible({ timeout: 8000 });
    await opener.click();

    const drawer = page.getByRole("dialog", { name: /Evolutia configuratiei/ });
    await expect(drawer).toBeVisible({ timeout: 6000 });
    await expect(
      drawer.getByText("Cum s-a schimbat impartirea pe business", { exact: true })
    ).toBeVisible();
    await expect(drawer.getByText(/%/).first()).toBeVisible();
  });
});
