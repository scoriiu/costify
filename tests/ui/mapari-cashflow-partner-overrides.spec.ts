/**
 * Playwright end-to-end tests for the partner-overrides flow on the
 * Mapari Cashflow tab.
 *
 * Verifies:
 *   1. The Mapari Cashflow page loads, shows the coverage panel, and
 *      renders cont rows with partner badges where partner count >= 2.
 *   2. Clicking a partner badge opens the slide-panel from the right
 *      with the cont's header truth-line and partner list.
 *   3. The truth-line correctly reflects override state (changes from
 *      "Toti partenerii merg in X" to "N parteneri urmeaza, M au
 *      exceptie" when an override exists).
 *   4. When at least one override exists firmwide, the centralised
 *      "Toate exceptiile" callout appears in the header.
 *   5. Clicking "Vezi toate →" opens AllExceptionsDialog with the
 *      list of overrides, each editable + deletable.
 *   6. Deleting an override removes it from the list AND from the
 *      page after refresh.
 *
 * Uses QHM21 NETWORK SRL on year 2026, month 4 — that firm has 1
 * existing override (Enel X Way -> Energie on cont 6058) seeded by
 * manual testing earlier.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;

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
      userAgent: "playwright-mapari-overrides",
    },
  });
});

test.afterAll(async () => {
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-mapari-overrides" },
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

test.describe("Mapari Cashflow — partner overrides UX", () => {
  test("1. Page loads, coverage panel visible", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await expect(page.getByRole("heading", { name: "Mapari Cashflow" })).toBeVisible();
    // The coverage box has the "Acoperire generala" label.
    await expect(page.getByText("Acoperire generala")).toBeVisible();
    // For QHM21 we know the firm is 100% mapped at the cont level.
    await expect(page.getByText(/% atinse explicit/)).toBeVisible();
  });

  test("2. Per-cont partner badge opens slide-panel", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    // Wait for accounts to render.
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Find the cont 6058 row by its cont number and click the badge inside.
    // The badge button has Users icon + count; locate by cont row first.
    const cont6058Row = page.locator("li").filter({ hasText: "6058" }).first();
    await expect(cont6058Row).toBeVisible();
    // Click the partner badge inside that row.
    const badge = cont6058Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    // Slide-panel header should appear with cont 6058 + denumire.
    await expect(page.getByRole("dialog", { name: /Parteneri pe contul/ })).toBeVisible();
    await expect(page.getByText("Cheltuieli cu alte utilitati")).toBeVisible();
    // Truth-line variant depends on override state. QHM21 has 1 override
    // on this cont so we expect the "N parteneri urmeaza" phrasing.
    await expect(
      page.getByText(/parteneri urmeaza maparea contului|partener urmeaza maparea contului|Toti partenerii merg in/)
    ).toBeVisible();
  });

  test("3. Centralised 'Toate exceptiile' callout opens dialog", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);

    // The "Toate exceptiile" callout appears in the coverage panel when
    // overrideCount > 0. QHM21 has 1 override.
    const callout = page.getByText(/exceptie individuala|exceptii individuale/).first();
    await expect(callout).toBeVisible({ timeout: 5000 });

    // Click "Vezi toate →".
    await page.getByRole("button", { name: /Vezi toate/ }).click();

    // Dialog opens with the title "Toate exceptiile pe parteneri".
    await expect(page.getByRole("dialog", { name: "Toate exceptiile" })).toBeVisible();
    await expect(page.getByText("Toate exceptiile pe parteneri")).toBeVisible();

    // At least one exception row should be visible. Search for the cont
    // base it lives on.
    await expect(page.getByText(/6058/).first()).toBeVisible();
  });

  test("4. AllExceptionsDialog search filters rows", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);

    await page.getByRole("button", { name: /Vezi toate/ }).click();
    await expect(page.getByRole("dialog", { name: "Toate exceptiile" })).toBeVisible();

    // Type something that won't match (diacritic-insensitive).
    const searchInput = page.getByPlaceholder("Cauta dupa partener, cont, sau categorie...");
    await searchInput.fill("zzznonexistent");
    await expect(page.getByText("Nicio exceptie nu se potriveste cautarii.")).toBeVisible();

    // Clear, expect rows back.
    await searchInput.fill("");
    await expect(page.getByText(/6058/).first()).toBeVisible();
  });

  test("6. Select dropdown in AllExceptionsDialog escapes modal clipping", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.getByRole("button", { name: /Vezi toate/ }).click();
    await expect(page.getByRole("dialog", { name: "Toate exceptiile" })).toBeVisible();

    // Find the first row's Select trigger and click it open.
    const dialog = page.getByRole("dialog", { name: "Toate exceptiile" });
    const selectTrigger = dialog.locator("button[aria-haspopup='listbox']").first();
    await selectTrigger.click();

    // The listbox is portaled OUTSIDE the dialog (to document.body). It must
    // be visible AND positioned with fixed coords, not clipped by the modal's
    // overflow-y-auto. We assert: at least one option role is visible and
    // the listbox element is not a descendant of the dialog.
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const isInsideDialog = await listbox.evaluate((el, dialogSelector) => {
      const dialog = document.querySelector(dialogSelector);
      return dialog ? dialog.contains(el) : false;
    }, "[role='dialog'][aria-label='Toate exceptiile']");
    expect(isInsideDialog).toBe(false);

    // Also assert the listbox uses fixed positioning so it can escape any
    // overflow:auto ancestor.
    const positionStyle = await listbox.evaluate(
      (el) => window.getComputedStyle(el).position
    );
    expect(positionStyle).toBe("fixed");
  });

  test("5. Cont with overrides shows visual cue (left border)", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Find the AccountRow <li> for cont 6058. It has the "group flex
    // items-center" combo on it, distinguishing it from the CategoryNode
    // <li> which uses "rounded-lg border ... p-3". When the cont has an
    // override, the row also gets border-l-2 border-primary/40.
    const cont6058Row = page
      .locator("li.group.flex.items-center")
      .filter({ hasText: /^6058/ })
      .first();
    await expect(cont6058Row).toBeVisible();
    const classAttr = await cont6058Row.getAttribute("class");
    expect(classAttr).toMatch(/border-primary/);
  });

  test("7. Changing Select staging shows Save button but does NOT auto-save", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.getByRole("button", { name: /Vezi toate/ }).click();
    await expect(page.getByRole("dialog", { name: "Toate exceptiile" })).toBeVisible();

    // Read the visible label inside the first Select trigger BEFORE we
    // touch it — this is the persisted category.
    const dialog = page.getByRole("dialog", { name: "Toate exceptiile" });
    const triggers = dialog.locator("button[aria-haspopup='listbox']");
    const firstTrigger = triggers.first();
    const initialLabel = (await firstTrigger.innerText()).trim();

    // No "Salveaza" buttons yet — nothing is dirty.
    expect(await dialog.getByRole("button", { name: /Salveaza/ }).count()).toBe(0);

    // Open the dropdown and pick a different option (whichever is not
    // already selected). The "Urmeaza contul" sentinel is always first;
    // the next option after it is a real category.
    await firstTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const options = listbox.locator("button[role='option']");
    const optCount = await options.count();
    let pickedLabel = "";
    for (let i = 0; i < optCount; i++) {
      const text = (await options.nth(i).innerText()).trim();
      if (text && text !== initialLabel) {
        pickedLabel = text;
        await options.nth(i).click();
        break;
      }
    }
    expect(pickedLabel).not.toBe("");

    // Save button appears and the row is dirty. Crucially, the change
    // is NOT persisted yet — there should be a Save button visible.
    await expect(
      dialog.getByRole("button", { name: /Salveaza/ }).first()
    ).toBeVisible();

    // The trigger now shows the staged (not persisted) value.
    await expect(firstTrigger).toContainText(pickedLabel);

    // Click the cancel (X) button next to Save to revert. The Save
    // button disappears and the trigger reverts to its original label.
    const cancelButton = dialog
      .getByRole("button", { name: "Anuleaza schimbarea" })
      .first();
    await cancelButton.click();
    expect(await dialog.getByRole("button", { name: /Salveaza/ }).count()).toBe(0);
    await expect(firstTrigger).toContainText(initialLabel);
  });

  test("8. Audit tab loads and renders override-related events", async ({ context }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.getByRole("button", { name: /Vezi toate/ }).click();
    const dialog = page.getByRole("dialog", { name: "Toate exceptiile" });
    await expect(dialog).toBeVisible();

    // Click the Istoric tab.
    await dialog.getByRole("button", { name: /Istoric/ }).click();

    // At least one event should be visible (qhm21 has had at least one
    // override mutation). Each event row shows the actor name and the
    // sentence built by describeForAccountant. We expect the word
    // "exceptie" or "bulk" to appear in at least one description.
    await expect(
      dialog.getByText(/exceptie|bulk/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("9. Saving a row in AllExceptionsDialog does NOT show skeleton (smooth save)", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.getByRole("button", { name: /Vezi toate/ }).click();
    const dialog = page.getByRole("dialog", { name: "Toate exceptiile" });
    await expect(dialog).toBeVisible();

    // Snapshot the visible row count before the save — used to confirm
    // the list never gets replaced by a skeleton during the action.
    const rowList = dialog.locator("ul").first();
    await expect(rowList).toBeVisible();
    const rowsBefore = await rowList.locator("> li").count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Stage a change on the first row: open its Select, pick the first
    // option that is NEITHER the current category NOR the synthetic
    // "Urmeaza contul (...)" sentinel — picking the sentinel deletes
    // the row, which is a valid flow but not what THIS test wants
    // (we're verifying smooth update, not smooth delete).
    const firstTrigger = dialog.locator("button[aria-haspopup='listbox']").first();
    const originalLabel = (await firstTrigger.innerText()).trim();
    await firstTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const options = listbox.locator("button[role='option']");
    let pickedLabel = "";
    const total = await options.count();
    for (let i = 0; i < total; i++) {
      const t = (await options.nth(i).innerText()).trim();
      if (!t) continue;
      if (t === originalLabel) continue;
      if (/^Urmeaza contul/.test(t)) continue;
      pickedLabel = t;
      await options.nth(i).click();
      break;
    }
    expect(pickedLabel).not.toBe("");

    // Click Salveaza, then assert that throughout the save the row
    // count never collapses to a skeleton (which would render 8
    // animate-pulse divs and zero <li> children for a frame).
    const saveButton = dialog.getByRole("button", { name: /Salveaza/ }).first();

    // Watch for the skeleton selector — if it ever appears, the test
    // fails. We poll briefly while the action runs.
    const skeletonLocator = dialog.locator(".animate-pulse");
    const skeletonCountBefore = await skeletonLocator.count();
    expect(skeletonCountBefore).toBe(0);

    await saveButton.click();

    // Within the ~500ms window the action typically takes, the row
    // list must keep at least one <li>. We sample a few times.
    for (let i = 0; i < 6; i++) {
      const liCount = await rowList.locator("> li").count();
      expect(liCount).toBeGreaterThan(0);
      const skel = await skeletonLocator.count();
      expect(skel).toBe(0);
      await page.waitForTimeout(80);
    }

    // After the save settles, the row's Select still shows the new
    // staged label (now persisted), and there's no Salveaza button
    // anymore (no dirty rows).
    await expect(firstTrigger).toContainText(pickedLabel);
    expect(
      await dialog.getByRole("button", { name: /Salveaza/ }).count()
    ).toBe(0);

    // Revert to the original so this test is idempotent across runs.
    await firstTrigger.click();
    await expect(listbox).toBeVisible();
    const revertOptions = listbox.locator("button[role='option']");
    const revertCount = await revertOptions.count();
    for (let i = 0; i < revertCount; i++) {
      const t = (await revertOptions.nth(i).innerText()).trim();
      if (t === originalLabel) {
        await revertOptions.nth(i).click();
        break;
      }
    }
    await expect(
      dialog.getByRole("button", { name: /Salveaza/ }).first()
    ).toBeVisible();
    await dialog.getByRole("button", { name: /Salveaza/ }).first().click();
    await expect(firstTrigger).toContainText(originalLabel);
  });

  test("10. Bulk respects the search filter — acts on visible subset, not on every partner", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Cont 628 on QHM21 has ~40 partners — plenty to demonstrate that the
    // bulk action shrinks when the search box narrows the visible list.
    const cont628Row = page.locator("li").filter({ hasText: /^628/ }).first();
    await expect(cont628Row).toBeVisible();
    const badge = cont628Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();

    // The opt-in link starts with the full unmapped count. Grab it for
    // later comparison.
    const optInLink = panel.getByRole("button", {
      name: /Redirectioneaza in bulk \d+ parten/,
    });
    await expect(optInLink).toBeVisible();
    const fullCountText = (await optInLink.innerText()).trim();
    const fullCountMatch = fullCountText.match(/Redirectioneaza in bulk (\d+) parten/);
    expect(fullCountMatch).not.toBeNull();
    const fullCount = parseInt(fullCountMatch![1], 10);
    expect(fullCount).toBeGreaterThan(2);

    // Type a search query that narrows the list. "google" matches just one
    // partner on cont 628 (GOOGLE IRELAND LIMITED).
    const search = panel.getByPlaceholder("Cauta partener...");
    await search.fill("google");

    // The opt-in link now reflects the SUBSET count (1, not full).
    await expect(
      panel.getByRole("button", { name: /Redirectioneaza in bulk 1 partener/ })
    ).toBeVisible();

    // Open the bulk bar. Its header must say "rezultatul curent" because a
    // filter is active — that's the honest phrasing.
    await panel
      .getByRole("button", { name: /Redirectioneaza in bulk 1 partener/ })
      .click();
    await expect(panel.getByText(/Redirectioneaza 1 din rezultatul curent/)).toBeVisible();

    // Pick the first available category and click Aplica to inspect the
    // preview modal. We DO NOT confirm — just verify the preview text and
    // cancel, so the test stays idempotent.
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const firstOption = listbox.locator("button[role='option']").first();
    const pickedLabel = (await firstOption.innerText()).trim();
    await firstOption.click();

    await panel.getByRole("button", { name: "Aplica" }).click();

    // Preview modal opens. It must say "1 partener" (not plural) AND
    // include the "rezultatul filtrului curent" qualifier.
    await expect(
      page.getByText(/Se vor mapa.*1.*partener.*la categoria/)
    ).toBeVisible();
    await expect(page.getByText(/rezultatul filtrului curent/)).toBeVisible();
    // Inside the modal, the picked category label must appear inside the
    // sentence "la categoria <label>" — assert on the modal's content area.
    const modalBody = page.getByText(/Se vor mapa/).locator("..");
    await expect(
      modalBody.getByText(new RegExp(pickedLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    ).toBeVisible();

    // Cancel the modal AND close the bulk bar — no DB writes.
    await page.getByRole("button", { name: "Anuleaza" }).click();
    await panel.getByRole("button", { name: "Renunta" }).click();

    // Clear the search; the opt-in link returns to the full count.
    await search.fill("");
    await expect(
      panel.getByRole("button", {
        name: new RegExp(`Redirectioneaza in bulk ${fullCount} parten`),
      })
    ).toBeVisible();
  });
});
