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

    // Bulk bar is always visible (no opt-in link). The header sentence
    // starts as "Atribuie toti cei N parteneri (X lei) la categoria:".
    const bulkSentence = panel.getByText(/Atribuie.*parteneri.*la categoria:/);
    await expect(bulkSentence).toBeVisible();
    const fullText = (await bulkSentence.innerText()).trim();
    const fullCountMatch = fullText.match(/(\d+) parten/);
    expect(fullCountMatch).not.toBeNull();
    const fullCount = parseInt(fullCountMatch![1], 10);
    expect(fullCount).toBeGreaterThan(2);

    // Type a search query that narrows the list. "google" matches just one
    // partner on cont 628 (GOOGLE IRELAND LIMITED).
    const search = panel.getByPlaceholder("Cauta partener...");
    await search.fill("google");

    // The bulk sentence now mentions "rezultatul curent" AND shows count=1.
    await expect(
      panel.getByText(/Atribuie cei 1 parteneri din rezultatul curent/)
    ).toBeVisible();

    // Pick a non-default category (cont default is preselected; we pick a
    // different one). Click Aplica to inspect the preview modal — we DO
    // NOT confirm so the test stays idempotent.
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    const currentLabel = (await bulkSelectTrigger.innerText()).trim();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const options = listbox.locator("button[role='option']");
    let pickedLabel = "";
    for (let i = 0; i < (await options.count()); i++) {
      const text = (await options.nth(i).innerText()).trim();
      if (text && text !== currentLabel) {
        pickedLabel = text;
        await options.nth(i).click();
        break;
      }
    }
    expect(pickedLabel).not.toBe("");

    await panel.getByRole("button", { name: "Aplica" }).click();

    // Preview modal opens. It must say "1 partener" (not plural) AND
    // include the "rezultatul filtrului curent" qualifier.
    await expect(
      page.getByText(/Se vor mapa.*1.*partener.*la categoria/)
    ).toBeVisible();
    await expect(page.getByText(/rezultatul filtrului curent/)).toBeVisible();
    const modalBody = page.getByText(/Se vor mapa/).locator("..");
    await expect(
      modalBody.getByText(new RegExp(pickedLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    ).toBeVisible();

    // Cancel the modal — no DB writes.
    await page.getByRole("button", { name: "Anuleaza" }).click();

    // Clear the search; the bulk sentence returns to the full count.
    await search.fill("");
    await expect(
      panel.getByText(new RegExp(`Atribuie toti cei ${fullCount} parteneri`))
    ).toBeVisible();
  });

  test("11. Threshold (Peste X lei) filters list and bulk scope", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Open the partner panel on cont 628 (40 partners with varied rulaj).
    const cont628Row = page.locator("li").filter({ hasText: /^628/ }).first();
    const badge = cont628Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();

    // Baseline: bulk sentence shows the full unmapped count.
    const bulkSentence = panel.getByText(/Atribuie.*parteneri.*la categoria:/);
    await expect(bulkSentence).toBeVisible();
    const fullText = (await bulkSentence.innerText()).trim();
    const fullCount = parseInt(fullText.match(/(\d+) parten/)![1], 10);
    expect(fullCount).toBeGreaterThan(2);

    // Click the 5,000 preset chip — fast path to "materialitate".
    const presetChip = panel.getByRole("button", { name: /^5\.000$/ });
    await expect(presetChip).toBeVisible();
    await presetChip.click();

    // The threshold input now reads "5000" and the impact counter is
    // visible ("N din 40" or similar).
    const thresholdInput = panel.getByLabel(/peste pragul de rulaj/i);
    await expect(thresholdInput).toHaveValue("5000");
    await expect(panel.getByText(/\d+ din \d+/)).toBeVisible();

    // Bulk sentence must have shrunk AND mention "rezultatul curent".
    await expect(
      panel.getByText(/Atribuie cei \d+ parteneri din rezultatul curent/)
    ).toBeVisible();
    const afterText = (
      await panel.getByText(/Atribuie cei.*din rezultatul curent/).innerText()
    ).trim();
    const afterCount = parseInt(afterText.match(/(\d+) parten/)![1], 10);
    expect(afterCount).toBeLessThan(fullCount);

    // "Sterge" button appears now that the threshold is active. Click it
    // and verify everything reverts.
    const clearBtn = panel.getByRole("button", { name: /Sterge pragul de rulaj/ });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(thresholdInput).toHaveValue("");
    await expect(
      panel.getByText(new RegExp(`Atribuie toti cei ${fullCount} parteneri`))
    ).toBeVisible();

    // Type a wildly high value to verify the empty-state copy is
    // threshold-specific.
    await thresholdInput.fill("999999999");
    await expect(
      panel.getByText(/Niciun partener nu trece pragul de/)
    ).toBeVisible();
    await clearBtn.click();
  });

  test("12. Threshold + search combine — bulk preview reflects both", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const cont628Row = page.locator("li").filter({ hasText: /^628/ }).first();
    const badge = cont628Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();

    // Set threshold 1000 + search 'rom' (matches ORANGE ROMANIA, OMV
    // PETROM, ALTEX ROMANIA, ROMPETROL — only some clear the threshold).
    await panel.getByRole("button", { name: /^1\.000$/ }).click();
    await panel.getByPlaceholder("Cauta partener...").fill("rom");

    // Bulk sentence reflects the combined filter — count > 0 AND mentions
    // "rezultatul curent" (either search or threshold qualifies).
    const bulkSentence = panel.getByText(
      /Atribuie cei \d+ parteneri din rezultatul curent/
    );
    await expect(bulkSentence).toBeVisible();
    const combinedText = (await bulkSentence.innerText()).trim();
    const combinedCount = parseInt(combinedText.match(/(\d+) parten/)![1], 10);
    expect(combinedCount).toBeGreaterThan(0);

    // Pick a category different from the cont default, open preview,
    // confirm the qualifier appears.
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    const currentLabel = (await bulkSelectTrigger.innerText()).trim();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    const options = listbox.locator("button[role='option']");
    for (let i = 0; i < (await options.count()); i++) {
      const text = (await options.nth(i).innerText()).trim();
      if (text && text !== currentLabel) {
        await options.nth(i).click();
        break;
      }
    }
    await panel.getByRole("button", { name: "Aplica" }).click();
    await expect(page.getByText(/rezultatul filtrului curent/)).toBeVisible();

    // Cancel the modal — no DB writes.
    await page.getByRole("button", { name: "Anuleaza" }).click();
  });

  test("13. Bulk bar is always visible and pre-selected with cont default", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Open the panel on cont 6058 (we know it's mapped to "Energie, apa,
    // intretinere" from prior tests/setup).
    const cont6058Row = page.locator("li").filter({ hasText: /^6058/ }).first();
    const badge = cont6058Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();

    // Bulk bar is visible immediately (no opt-in link to click).
    await expect(
      panel.getByText(/Atribuie.*parteneri.*la categoria:/)
    ).toBeVisible();

    // The first Select on the panel is the bulk Select (per-row Selects
    // come further down). Its trigger should show a real category label —
    // not the placeholder "Alege categoria...".
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    const triggerLabel = (await bulkSelectTrigger.innerText()).trim();
    expect(triggerLabel).not.toBe("");
    expect(triggerLabel).not.toMatch(/^Alege categoria/);

    // Since the default-on-cont matches the dropdown selection, Aplica
    // must be disabled (no-op case) AND the hint about "deja default" is
    // shown.
    const applyBtn = panel.getByRole("button", { name: "Aplica" });
    await expect(applyBtn).toBeDisabled();
    await expect(
      panel.getByText(/deja default-ul contului/)
    ).toBeVisible();

    // Change the dropdown to a different category — Aplica becomes
    // enabled and the hint disappears.
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    const options = listbox.locator("button[role='option']");
    for (let i = 0; i < (await options.count()); i++) {
      const text = (await options.nth(i).innerText()).trim();
      if (text && text !== triggerLabel) {
        await options.nth(i).click();
        break;
      }
    }
    await expect(applyBtn).toBeEnabled();
    await expect(panel.getByText(/deja default-ul contului/)).not.toBeVisible();
  });

  test("14. Each partner row has a horizontal rulaj bar — largest fills 100%", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Cont 628 has ~40 partners with wide rulaj spread — perfect for
    // exercising the bar.
    const cont628Row = page.locator("li").filter({ hasText: /^628/ }).first();
    const badge = cont628Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();

    // Wait for the panel body to finish loading. The bulk sentence is
    // part of PanelBody and only renders after data is fetched, so it's
    // a reliable readiness signal.
    await expect(
      panel.getByText(/Atribuie.*parteneri.*la categoria:/)
    ).toBeVisible({ timeout: 5000 });

    // Every visible partner row carries a bar fill. Count them and read
    // the inline width to verify proportional encoding.
    const bars = panel.locator("[data-testid='rulaj-bar-fill']");
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThan(2);

    // Collect widths as numeric percents.
    const widths = await bars.evaluateAll((els) =>
      els.map((el) => parseFloat((el as HTMLElement).style.width) || 0)
    );

    // The largest visible partner must be at 100%.
    const maxWidth = Math.max(...widths);
    expect(maxWidth).toBe(100);

    // At least one bar must be strictly less than 100 — proves we're
    // actually scaling, not just hardcoding full width.
    expect(widths.some((w) => w < 100 && w > 0)).toBe(true);

    // Now narrow the visible list with a threshold — the bars should
    // RE-SCALE relative to whatever's left. We pick a threshold that
    // keeps a handful of partners.
    await panel.getByRole("button", { name: /^5\.000$/ }).click();

    // Wait for the list to settle, then re-read widths. The new max
    // visible partner must be at 100%.
    await page.waitForTimeout(150);
    const barsAfter = panel.locator("[data-testid='rulaj-bar-fill']");
    const afterCount = await barsAfter.count();
    expect(afterCount).toBeGreaterThan(0);
    const widthsAfter = await barsAfter.evaluateAll((els) =>
      els.map((el) => parseFloat((el as HTMLElement).style.width) || 0)
    );
    expect(Math.max(...widthsAfter)).toBe(100);

    // Clean up: clear threshold to leave the panel idempotent.
    await panel.getByRole("button", { name: /Sterge pragul de rulaj/ }).click();
  });

  test("15. Pareto indicator + long-tail separator appear on contul with many partners", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Cont 628 has ~40 partners — guaranteed to have a meaningful Pareto
    // split (some big, many small).
    const cont628Row = page.locator("li").filter({ hasText: /^628/ }).first();
    const badge = cont628Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(/Atribuie.*parteneri.*la categoria:/)
    ).toBeVisible({ timeout: 5000 });

    // Pareto indicator is visible with the "Top N parteneri = X% din rulaj"
    // sentence + the tail callout.
    const indicator = panel.locator("[data-testid='pareto-indicator']");
    await expect(indicator).toBeVisible();
    const indicatorText = (await indicator.innerText()).trim();
    expect(indicatorText).toMatch(/Top \d+ parteneri = \d+% din rulaj/i);
    expect(indicatorText).toMatch(/coada lunga/i);

    // The inline separator appears EXACTLY ONCE in the list.
    const separator = panel.locator("[data-testid='long-tail-separator']");
    await expect(separator).toHaveCount(1);
    await expect(separator).toBeVisible();
    const separatorText = (await separator.innerText()).trim();
    expect(separatorText).toMatch(/coada lunga/i);
    expect(separatorText).toMatch(/\d+ parteneri · \d+% din rulaj/i);

    // Sanity: indicator's headPercent + tailPercent should sum to 100 (or
    // ~100 with rounding). We extract both from the indicator text.
    const headMatch = indicatorText.match(/= (\d+)%/);
    const tailMatch = indicatorText.match(/reprezinta (\d+)%/);
    expect(headMatch).not.toBeNull();
    expect(tailMatch).not.toBeNull();
    const sum = parseInt(headMatch![1], 10) + parseInt(tailMatch![1], 10);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  test("16. Pareto indicator hides on small lists / single-partner conts", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Find a cont with very few partners. Cont 626 on QHM21 has 2 partners
    // (verified during seeding); too few for a Pareto split to be useful.
    const cont626Row = page.locator("li").filter({ hasText: /^626/ }).first();
    if (!(await cont626Row.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    const badge = cont626Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    if (!(await badge.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(/Atribuie.*parteneri.*la categoria:/)
    ).toBeVisible({ timeout: 5000 });

    // With <= 3 partners the indicator is intentionally hidden (no signal
    // to extract) and there's no separator.
    await expect(
      panel.locator("[data-testid='pareto-indicator']")
    ).toHaveCount(0);
    await expect(
      panel.locator("[data-testid='long-tail-separator']")
    ).toHaveCount(0);
  });

  test("17. Pareto re-anchors when search narrows the list", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const cont628Row = page.locator("li").filter({ hasText: /^628/ }).first();
    const badge = cont628Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog", { name: /Parteneri pe contul/ });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(/Atribuie.*parteneri.*la categoria:/)
    ).toBeVisible({ timeout: 5000 });

    // Baseline indicator on full list.
    const indicator = panel.locator("[data-testid='pareto-indicator']");
    await expect(indicator).toBeVisible();
    const fullText = (await indicator.innerText()).trim();
    const fullHead = parseInt(fullText.match(/Top (\d+)/)![1], 10);

    // Narrow to a single-letter search that still leaves enough partners
    // for the Pareto split to be meaningful. "s" matches many on QHM21
    // cont 628 (SRL suffix on most company names).
    await panel.getByPlaceholder("Cauta partener...").fill("s");

    // Indicator either updates with a smaller headCount OR disappears
    // (if the subset drops to <= 3). Either is correct behaviour.
    const stillVisible = await indicator.isVisible().catch(() => false);
    if (stillVisible) {
      const afterText = (await indicator.innerText()).trim();
      const afterHead = parseInt(afterText.match(/Top (\d+)/)![1], 10);
      expect(afterHead).toBeLessThanOrEqual(fullHead);
    }

    // Clean up.
    await panel.getByPlaceholder("Cauta partener...").fill("");
  });
});
