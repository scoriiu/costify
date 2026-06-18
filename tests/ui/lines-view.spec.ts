/**
 * End-to-end coverage of the redesigned "Linii de business" view.
 *
 * The accountant's real flows, in order of how they'd actually use it:
 *   1. Land on the Mapari Cashflow tab, switch to "Linii".
 *   2. Block A — firm totals render with real money (not zero).
 *   3. Block B — the line cards (Outsourcing / Coworking) each carry their
 *      share of the money. THIS is the regression that bit us: a 50/50
 *      category split must surface as money on BOTH lines, not 0 lei / 0
 *      conturi.
 *   4. Selecting a line opens Block C (composition: categorie → conturi).
 *   5. The "Marfa" category appears under both lines with its conturi.
 *   6. Editing a category's split pre-fills the EXISTING split (not blank).
 *   7. Add / rename / delete a line round-trips.
 *   8. The partner LOB panel opens from a cont.
 *
 * Runs against QHM21 NETWORK SRL, year 2026. That firm has:
 *   - 2 non-default verticals (Outsourcing, Coworking), verticalsEnabled.
 *   - category "Marfa, materii prime si materiale" split 50/50.
 *   - cont 704 pinned 100% Outsourcing.
 *   - NO default vertical (the exact condition that exposed the bug).
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;

// Playwright does not load .env.local; the dev server does. Read the same
// DATABASE_URL the server uses so test sessions land in the server's DB.
function serverDatabaseUrl(): string {
  const raw = readFileSync(".env.local", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

let prisma: PrismaClient;
let sessionToken: string;
let clientId: string;

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

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-lines-view",
    },
  });
});

// The mutation tests (add/rename/delete) leave the fixture dirty if they fail
// mid-flow, which cascades into the next test. Restore the canonical state
// after EACH test so the suite is order-independent and self-healing.
test.afterEach(async () => {
  await prisma.vertical.deleteMany({
    where: { clientId, name: { startsWith: "TestLinie" } },
  });
  await prisma.vertical.updateMany({
    where: { clientId, name: { startsWith: "Coworking" }, NOT: { name: "Coworking" } },
    data: { name: "Coworking" },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-lines-view" },
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
  await page.getByRole("button", { name: "Linii", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Din ce e compusa|Liniile de business/ }).first()
  ).toBeVisible({ timeout: 6000 });
}

/** Parse a Romanian-formatted integer ("1.234.567" -> 1234567). */
function parseLei(s: string): number {
  const digits = s.replace(/[^\d-]/g, "");
  return digits === "" ? 0 : parseInt(digits, 10);
}

/** The Block-B line CARD for a given line name. Distinct from the donut legend
 *  row (which also contains the name) — both are buttons, so we target the card
 *  by its stable data-testid + data-line-name. */
function lineCard(page: Page, name: string) {
  return page.locator(`[data-testid="line-card"][data-line-name="${name}"]`);
}

test.describe("Linii de business — redesigned view", () => {
  test("1. Toggle to Linii shows Block A firm totals with real money", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openLinii(page);

    // Block A — Venituri / Cheltuieli / Rezultat. All three must be > 0
    // (well, Rezultat could be negative but Venituri & Cheltuieli are
    // non-zero for this firm).
    const venituri = page.getByText("Venituri", { exact: true }).first();
    await expect(venituri).toBeVisible();
    const cheltuieli = page.getByText("Cheltuieli", { exact: true }).first();
    await expect(cheltuieli).toBeVisible();

    // The firm has ~2.1M venituri, ~1.74M cheltuieli — grab the stat block.
    const blockA = page.locator("section").first();
    const text = await blockA.innerText();
    // There must be a number with thousands separators somewhere.
    expect(text).toMatch(/\d\.\d{3}/);
  });

  test("2. REGRESSION: 50/50 category split surfaces money on BOTH lines", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openLinii(page);

    // Both line cards exist.
    const outsourcing = lineCard(page, "Outsourcing");
    const coworking = lineCard(page, "Coworking");
    await expect(outsourcing).toBeVisible();
    await expect(coworking).toBeVisible();

    // The donut must NOT show the empty-state copy. If the resolver bug were
    // back, this is exactly what we'd see.
    await expect(
      page.getByText("Nicio miscare alocata inca pe linii.")
    ).toHaveCount(0);

    // Coworking gets ONLY the 50% of Marfa (it has no other allocation),
    // so its card must carry a NON-zero conturi count and non-zero V or C.
    const cwText = await coworking.innerText();
    // "N conturi" — N must be >= 1.
    const cwContMatch = cwText.match(/(\d+)\s+conturi/);
    expect(cwContMatch).not.toBeNull();
    expect(parseInt(cwContMatch![1], 10)).toBeGreaterThanOrEqual(1);

    // And its expense figure (C ...) must be > 0 — the 50% slice of Marfa.
    const cwCMatch = cwText.match(/C\s+([\d.]+)/);
    expect(cwCMatch).not.toBeNull();
    expect(parseLei(cwCMatch![1])).toBeGreaterThan(0);
  });

  test("3. Selecting Coworking opens Block C with the Marfa category + conturi", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openLinii(page);

    await lineCard(page, "Coworking").click();

    // Block C heading appears.
    await expect(
      page.getByRole("heading", { name: /Din ce e compusa linia Coworking/ })
    ).toBeVisible({ timeout: 6000 });

    // The Marfa category row is present (it's the 50% slice).
    await expect(
      page.getByText(/Marfa, materii prime si materiale/).first()
    ).toBeVisible();

    // Categories auto-expand on selection, so cont 603 (one of the 7 conturi
    // under Marfa) is already visible — no manual expand needed.
    const marfaRow = page
      .locator("li")
      .filter({ hasText: /Marfa, materii prime si materiale/ })
      .first();
    await expect(marfaRow.getByText(/^603$/).first()).toBeVisible({
      timeout: 4000,
    });
  });

  test("4. Editing the Marfa split PRE-FILLS the existing 50/50 (not blank)", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openLinii(page);

    await lineCard(page, "Coworking").click();
    await expect(
      page.getByRole("heading", { name: /Din ce e compusa linia Coworking/ })
    ).toBeVisible();

    const marfaRow = page
      .locator("li")
      .filter({ hasText: /Marfa, materii prime si materiale/ })
      .first();
    // The pencil "Editeaza impartirea liniei de cost" button.
    await marfaRow
      .getByRole("button", { name: /Editeaza impartirea liniei de cost/ })
      .click();

    // The dialog opens. It must reflect the EXISTING 50/50 split — both
    // verticals present, each at 50%. If currentSplits were [] (the bug),
    // we'd see a single default row instead.
    const dialog = page.getByRole("dialog", { name: /Editeaza liniile/ });
    await expect(dialog).toBeVisible({ timeout: 4000 });

    // Both line names appear in the editor.
    await expect(dialog.getByText(/Outsourcing/).first()).toBeVisible();
    await expect(dialog.getByText(/Coworking/).first()).toBeVisible();
    // The existing 50/50 must be reflected: two number inputs, each live
    // value "50". If currentSplits were [] (the bug), we'd see ONE row at
    // 100 instead.
    const percentInputs = dialog.locator("input[type='number']");
    await expect(percentInputs).toHaveCount(2, { timeout: 4000 });
    await expect(percentInputs.nth(0)).toHaveValue("50");
    await expect(percentInputs.nth(1)).toHaveValue("50");

    // With exactly two lines the split is zero-sum: editing one must
    // auto-set the other to the complement so the total stays at 100.
    await percentInputs.nth(0).fill("70");
    await percentInputs.nth(0).blur();
    await expect(percentInputs.nth(0)).toHaveValue("70");
    await expect(percentInputs.nth(1)).toHaveValue("30");

    // Escape closes the dialog (idempotent, no save).
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 4000 });
  });

  test("5. Add a line, then delete it — round-trips cleanly", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openLinii(page);

    const uniqueName = `TestLinie_${Date.now().toString().slice(-5)}`;

    // Click "Adauga linie" card.
    await page.getByRole("button", { name: /Adauga linie/ }).click();
    const nameInput = page.getByPlaceholder("Nume linie (ex: Outsourcing)");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(uniqueName);
    await page.getByRole("button", { name: "Adauga", exact: true }).click();

    // The new card appears after the post-mutation refetch (heavy page).
    const newCard = lineCard(page, uniqueName);
    await expect(newCard).toBeVisible({ timeout: 15000 });

    // Delete it — hover to reveal the trash, accept the confirm dialog.
    page.on("dialog", (d) => d.accept());
    await newCard.hover();
    await newCard.getByRole("button", { name: "Sterge" }).click();

    // Card is gone. The delete triggers a full server refresh of the heavy
    // Mapari page, so give the UI room to re-render.
    await expect(lineCard(page, uniqueName)).toHaveCount(0, { timeout: 15000 });

    // DB confirms no lingering vertical.
    const leftover = await prisma.vertical.findFirst({
      where: { clientId, name: uniqueName },
    });
    expect(leftover).toBeNull();
  });

  test("6. Rename a line inline and revert", async ({ context }) => {
    const page = await authedPage(context);
    await openLinii(page);

    // Rename Coworking -> Coworking TEMP then back. The rename swaps the card
    // for an inline form whose Input holds the current name.
    const card = lineCard(page, "Coworking");
    await card.hover();
    await card.getByRole("button", { name: "Redenumeste" }).click();

    // The card is replaced by an inline rename form: a single visible text
    // input pre-filled with the current name.
    const renameInput = page.locator("input").filter({ visible: true }).first();
    await expect(renameInput).toHaveValue("Coworking", { timeout: 4000 });
    await renameInput.fill("Coworking TEMP");
    await page.keyboard.press("Enter");

    await expect(lineCard(page, "Coworking TEMP")).toBeVisible({ timeout: 15000 });

    // Revert.
    const renamed = lineCard(page, "Coworking TEMP");
    await renamed.hover();
    await renamed.getByRole("button", { name: "Redenumeste" }).click();
    const back = page.locator("input").filter({ visible: true }).first();
    await expect(back).toHaveValue("Coworking TEMP", { timeout: 4000 });
    await back.fill("Coworking");
    await page.keyboard.press("Enter");
    // The card is back to "Coworking" and the TEMP name is gone.
    await expect(lineCard(page, "Coworking TEMP")).toHaveCount(0, {
      timeout: 15000,
    });
    await expect(lineCard(page, "Coworking")).toBeVisible({ timeout: 15000 });
  });

  test("7. Partner LOB panel opens from a cont in Block C", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openLinii(page);

    await lineCard(page, "Coworking").click();
    await expect(
      page.getByRole("heading", { name: /Din ce e compusa linia Coworking/ })
    ).toBeVisible();
    const marfaRow = page
      .locator("li")
      .filter({ hasText: /Marfa, materii prime si materiale/ })
      .first();
    // Categories auto-expand on selection — the conturi are already revealed.

    // The cont rows are nested <li>; pick the first one and reveal its
    // hover actions, then click "Parteneri".
    const contRow = marfaRow.locator("li").first();
    await expect(contRow).toBeVisible({ timeout: 4000 });
    await contRow.hover();
    await contRow.getByRole("button", { name: "Parteneri" }).click();

    // The partner LOB panel slides in (role=dialog, labelled by cont).
    await expect(
      page.getByRole("dialog", { name: /Parteneri pe contul/ })
    ).toBeVisible({ timeout: 6000 });
  });

  test("8. Mapari page reloads cleanly on Linii and keeps the line money", async ({
    context,
  }) => {
    // A reload must re-render Block B with money intact (server fetch path,
    // not just client state). This guards the loader/resolver fix end-to-end.
    const page = await authedPage(context);
    await openLinii(page);
    await page.reload();
    await page.waitForSelector("text=Cheltuieli", { timeout: 8000 });
    await page.getByRole("button", { name: "Linii", exact: true }).click();
    const coworking = lineCard(page, "Coworking");
    await expect(coworking).toBeVisible({ timeout: 6000 });
    const cwText = await coworking.innerText();
    const cwContMatch = cwText.match(/(\d+)\s+conturi/);
    expect(cwContMatch).not.toBeNull();
    expect(parseInt(cwContMatch![1], 10)).toBeGreaterThanOrEqual(1);
  });
});
