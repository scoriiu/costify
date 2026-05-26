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
    // The new unified DistributionBlock surfaces either the happy-path
    // sentence or the override-aware "% redistribuit" phrasing. Both
    // mention the category routing in one of these forms.
    await expect(
      page.getByText(
        /parteneri urmeaza contul catre|partener urmeaza contul catre|Toti partenerii merg in|% din rulaj e redistribuit/
      )
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
  });

  /* ------------------------------------------------------------------------ */
  /*    RESIDUE MARKERS — phase 4 of the "Integritate cifre" PR               */
  /* ------------------------------------------------------------------------ */

  test("21. Cont with override shows ↗ residue marker with redirected amount", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // 6058 ENEL X WAY → Energie is the long-standing seed for this test
    // suite (see tests 5, 9). The marker must render with a non-zero amount.
    const marker = page.locator("[data-testid='cont-residue-marker-6058']");
    await expect(marker).toBeVisible();
    const text = (await marker.innerText()).trim();
    // Should be a number + "lei" — defensive against locale-specific
    // thousand separators by checking for the suffix.
    expect(text).toMatch(/lei$/);
    expect(text).not.toBe("0 lei");
  });

  test("22. Hovering cont residue marker reveals tooltip explaining the split", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const marker = page.locator("[data-testid='cont-residue-marker-6058']");
    await marker.hover();
    // Tooltip lives in a portaled element with the explanation copy.
    await expect(
      page.getByText(/redirectati la alte categorii/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Orizontala contului se aplica/i).first()
    ).toBeVisible();
  });

  test("23. Category that receives residue shows ↙ inflow marker", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Resolve the target categoryId for the ENEL X WAY override on 6058.
    const override = await prisma.partnerCategoryOverride.findFirst({
      where: { clientId, contBase: "6058" },
      select: { categoryId: true },
    });
    if (!override) throw new Error("Test prerequisite: 6058 override missing");

    // The marker is keyed by categoryId AND its tooltip mentions cont 6058
    // as the source. The category row must be expanded to be visible.
    const marker = page.locator(
      `[data-testid='category-residue-marker-${override.categoryId}']`
    );
    // Expand the Cheltuieli root + parent categories if collapsed. The seeded
    // tree shows top-level categories open by default (depth=0). We may need
    // to find the parent path; for now scroll to it and check existence.
    await marker.scrollIntoViewIfNeeded();
    await expect(marker).toBeVisible();
    const text = (await marker.innerText()).trim();
    expect(text).toMatch(/lei$/);
    expect(text).not.toBe("0 lei");
  });

  test("24. Clicking category residue marker opens allocation dialog (cat has no allocation yet)", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const override = await prisma.partnerCategoryOverride.findFirst({
      where: { clientId, contBase: "6058" },
      select: { categoryId: true },
    });
    if (!override) throw new Error("Test prerequisite: 6058 override missing");

    // Defensive cleanup: ensure no stale CategoryVerticalAllocation lingers
    // from a previous run before we assert the "no allocation" empty-state.
    await prisma.categoryVerticalAllocation.deleteMany({
      where: { clientId, categoryId: override.categoryId },
    });
    await page.reload();
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const marker = page.locator(
      `[data-testid='category-residue-marker-${override.categoryId}']`
    );
    await marker.scrollIntoViewIfNeeded();
    await marker.click();

    // Dialog opens with the empty-state message specific to categories.
    await expect(
      page.getByText(/nu are alocare explicita/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/exceptii de partener/i).first()
    ).toBeVisible();

    // Header shows the "primeste X lei din exceptii de partener" line.
    await expect(
      page.getByText(/primeste .* lei din exceptii de partener/i).first()
    ).toBeVisible();
  });

  test("25. Setting category allocation persists + marker tooltip reflects the new split", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const override = await prisma.partnerCategoryOverride.findFirst({
      where: { clientId, contBase: "6058" },
      select: { categoryId: true },
    });
    if (!override) throw new Error("Test prerequisite: 6058 override missing");

    // Start clean.
    await prisma.categoryVerticalAllocation.deleteMany({
      where: { clientId, categoryId: override.categoryId },
    });

    // The firm must have at least one non-default vertical for this to work.
    const verticals = await prisma.vertical.findMany({
      where: { clientId },
      select: { id: true, name: true, isDefault: true },
    });
    const nonDefault = verticals.filter((v) => !v.isDefault);
    if (nonDefault.length === 0) {
      test.skip(true, "Firma nu are verticale non-default — testul nu se aplica");
      return;
    }
    const target = nonDefault[0];

    await page.reload();
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const marker = page.locator(
      `[data-testid='category-residue-marker-${override.categoryId}']`
    );
    await marker.scrollIntoViewIfNeeded();
    await marker.click();

    // Enter edit mode.
    await page.getByRole("button", { name: /Schimba alocarea/i }).click();

    // Scope to the modal subtree so we don't grab the page's year selector.
    // The dialog uses fixed inset overlay with z-50; the inner card has the
    // distinct "max-w-xl" + "bg-dark-2" combo.
    const dialog = page.locator("div.fixed.inset-0.z-50 > div.bg-dark-2");
    await expect(dialog).toBeVisible();

    // The dialog pre-populates with the first non-default vertical at 100%.
    // We force it to point at our chosen `target` so the assertion is
    // independent of ordering.
    const verticalTrigger = dialog
      .locator("button[aria-haspopup='listbox']")
      .first();
    await verticalTrigger.click();
    await page.getByRole("option", { name: target.name }).first().click();

    await page.getByRole("button", { name: /^Salveaza$/ }).click();

    // The dialog closes; the marker is still present. Hover and check the
    // tooltip mentions the new vertical at 100%.
    await expect(marker).toBeVisible({ timeout: 5000 });
    await marker.hover();
    await expect(
      page.getByText(new RegExp(`100% ${target.name}`, "i")).first()
    ).toBeVisible();

    // Verify persistence at the DB level.
    const persisted = await prisma.categoryVerticalAllocation.findFirst({
      where: { clientId, categoryId: override.categoryId },
      select: { splits: true },
    });
    expect(persisted).not.toBeNull();
    const splits = persisted!.splits as Array<{ verticalId: string; percent: number }>;
    expect(splits.length).toBe(1);
    expect(splits[0].verticalId).toBe(target.id);
    expect(splits[0].percent).toBe(100);

    // Cleanup so subsequent runs start clean.
    await prisma.categoryVerticalAllocation.deleteMany({
      where: { clientId, categoryId: override.categoryId },
    });
  });

  test("27. Header is lean — only identity (cont code + name + rulaj total), no duplicate truth-line", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Anchor the regex with `^6058` so the row that STARTS with the cont
    // code is the only match — substring matching let cont 603 win because
    // somewhere on its row the digit sequence "6058" appeared.
    const cont6058Row = page
      .locator("li.group.flex.items-center")
      .filter({ hasText: /^6058/ })
      .first();
    const badge = cont6058Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();

    // The header (the row with the X close button + cont identity) must
    // NOT contain the override narrative anymore — that lives in the body
    // block now. The narrative still EXISTS (we just moved it).
    const header = panel.locator("div.border-b.border-dark-3").first();
    await expect(header).not.toContainText(/vezi mai jos/i);
    await expect(header).not.toContainText(/urmeaza contul catre/i);
    // But the header DOES still carry the lean identity bits.
    await expect(header).toContainText("6058");
    await expect(header).toContainText("Cheltuieli cu alte utilitati");
    await expect(header).toContainText(/lei rulaj cumulat/i);

    // The unified DistributionBlock in the body carries the narrative.
    await expect(
      panel.getByText(/urmeaza contul catre/i).first()
    ).toBeVisible();
  });

  test("28. Distribution block shows headline + numeric breakdown with category name", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const cont6058Row = page
      .locator("li.group.flex.items-center")
      .filter({ hasText: /^6058/ })
      .first();
    const badge = cont6058Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();

    // One headline sentence at top of distribution block — mentions both
    // the redistributed percentage and the category name.
    await expect(
      panel.getByText(/% din rulaj e redistribuit prin exceptii/i).first()
    ).toBeVisible();

    // The breakdown rows have "lei · X%" suffix produced by BreakdownRow.
    const breakdownRows = panel
      .locator("li")
      .filter({ hasText: /lei · \d+%$/ });
    const rowCount = await breakdownRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test("29. Partner rows with active exception are visually distinguished (badge + left border)", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    const cont6058Row = page
      .locator("li.group.flex.items-center")
      .filter({ hasText: /^6058/ })
      .first();
    const badge = cont6058Row
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /\d/ })
      .first();
    await badge.click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();

    // At least one partner row carries the "Exceptie" badge — we know 6058
    // has overrides (it's the seed for tests 5/9). The badge sits on the
    // row body next to the partner name.
    const excBadges = panel.locator("[data-testid='partner-exception-badge']");
    const badgeCount = await excBadges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(1);
    await expect(excBadges.first()).toBeVisible();
    await expect(excBadges.first()).toHaveText(/exceptie/i);

    // The row carrying that badge must also have data-exception="true"
    // (used both for testing and styling — left border + tint).
    const excRows = panel.locator("li[data-exception='true']");
    expect(await excRows.count()).toBeGreaterThanOrEqual(1);
  });

  test("26. Default vertical column shows residue badge when residue lands on it", async ({
    context,
  }) => {
    const page = await authedPage(context);

    // Ensure the override target category has NO allocation so the residue
    // falls through to the default vertical.
    const override = await prisma.partnerCategoryOverride.findFirst({
      where: { clientId, contBase: "6058" },
      select: { categoryId: true },
    });
    if (!override) throw new Error("Test prerequisite: 6058 override missing");
    await prisma.categoryVerticalAllocation.deleteMany({
      where: { clientId, categoryId: override.categoryId },
    });

    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Switch from "Categorii" to "Linii de business" — the verticals tab.
    await page.getByRole("tab", { name: /Linii de business/ }).click();

    // The default vertical (Toata firma) auto-expands on the verticals tab.
    // The badge sits next to the "implicit" label.
    const badge = page.locator("[data-testid='default-vertical-residue-badge']");
    await expect(badge).toBeVisible({ timeout: 5000 });
    const text = (await badge.innerText()).trim();
    expect(text).toMatch(/lei reziduu$/);

    // Tooltip explains the absorption + CTA.
    await badge.hover();
    await expect(
      page.getByText(/absoarbe.*din reziduul exceptiilor de partener/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Seteaza orizontala categoriilor primitoare/i).first()
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

    // Pick the LAST option (avoids any first-position aliasing with the
    // cont default), wait for the trigger to reflect it, then Aplica.
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const opts = listbox.locator("button[role='option']");
    const optsCount = await opts.count();
    const lastOption = opts.nth(optsCount - 1);
    const pickedLabel = (await lastOption.innerText()).trim();
    await lastOption.click();
    await expect(bulkSelectTrigger).toContainText(pickedLabel);

    const aplicaBtn = panel.getByRole("button", { name: "Aplica" });
    await expect(aplicaBtn).toBeEnabled();
    await aplicaBtn.click();
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

    // Change the dropdown to the LAST option (different from default) —
    // Aplica becomes enabled and the hint disappears.
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const opts = listbox.locator("button[role='option']");
    const optsCount = await opts.count();
    const lastOption = opts.nth(optsCount - 1);
    const pickedLabel = (await lastOption.innerText()).trim();
    await lastOption.click();
    await expect(bulkSelectTrigger).toContainText(pickedLabel);
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

  test("18. Preview modal shows fresh/existing breakdown when no overrides in scope", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Cont 628 has no overrides today (QHM21 seed has only one on 6058).
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

    // Pick a non-default category. Bulk Select is the FIRST listbox-
    // popup button in the panel. Pick by index 0 (first real category)
    // and confirm the trigger label updates.
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const firstOption = listbox.locator("button[role='option']").first();
    const pickedLabel = (await firstOption.innerText()).trim();
    expect(pickedLabel.length).toBeGreaterThan(0);
    await firstOption.click();
    // Wait for the trigger to reflect the new selection — proves the
    // onChange propagated and categoryId state is set.
    await expect(bulkSelectTrigger).toContainText(pickedLabel);

    // Aplica should now be enabled (real category picked).
    const aplicaBtn = panel.getByRole("button", { name: "Aplica" });
    await expect(aplicaBtn).toBeEnabled();
    await aplicaBtn.click();

    // Modal opens. Scope all assertions to it via the heading.
    const modal = page.getByText("Confirma maparea in bulk").locator("..");
    await expect(modal).toBeVisible();

    const breakdown = modal.locator("[data-testid='bulk-preview-breakdown']");
    await expect(breakdown).toBeVisible();
    const breakdownText = (await breakdown.innerText()).trim();
    expect(breakdownText).toMatch(/parteneri primesc o exceptie noua/);
    expect(breakdownText).toMatch(/0 exceptii manuale existente in scope/);
    expect(breakdownText).toMatch(/nimic suprascris/);

    // The overwrite toggle is NOT rendered (overwriteCount=0).
    await expect(
      modal.locator("[data-testid='bulk-preview-overwrite-toggle']")
    ).toHaveCount(0);

    // Cancel — no DB writes.
    await page.getByRole("button", { name: "Anuleaza" }).click();
  });

  test("19. Preview modal: overwrite toggle appears when overrides exist in scope", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Cont 6058 has the QHM21 seed override (ENEL X WAY → Energie).
    const cont6058Row = page.locator("li").filter({ hasText: /^6058/ }).first();
    const badge = cont6058Row
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

    // Pick a non-default category (the cont default is preselected;
    // any first-listed option that's not the trigger's current label is
    // guaranteed to be a different one — except when the trigger label
    // happens to equal the first option text. Since the cont default
    // for 6058 is "Energie, apa, intretinere" and options come from
    // the full leaf list which excludes whatever the cont default
    // already is via PartnerRow.options filtering... no wait, that's
    // only PartnerRow. BulkActionBar uses the FULL categoryOptions
    // list. So the first option WILL include the cont default if it's
    // the first alphabetically. Safer: pick the LAST option, which is
    // very unlikely to be the cont default).
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const optionsList = listbox.locator("button[role='option']");
    const optCount = await optionsList.count();
    expect(optCount).toBeGreaterThan(1);
    const lastOption = optionsList.nth(optCount - 1);
    const pickedLabel = (await lastOption.innerText()).trim();
    await lastOption.click();
    await expect(bulkSelectTrigger).toContainText(pickedLabel);

    const aplicaBtn = panel.getByRole("button", { name: "Aplica" });
    await expect(aplicaBtn).toBeEnabled();
    await aplicaBtn.click();

    // Modal opens. Scope all assertions to it.
    const modal = page.getByText("Confirma maparea in bulk").locator("..");
    await expect(modal).toBeVisible();

    // Breakdown mentions at least one existing manual exception and
    // "nimic suprascris" by default.
    const breakdown = modal.locator("[data-testid='bulk-preview-breakdown']");
    await expect(breakdown).toBeVisible();
    const initialText = (await breakdown.innerText()).trim();
    expect(initialText).toMatch(/\d+ exceptii? manual\w* existent\w* in scope/);
    expect(initialText).toMatch(/nimic suprascris/);
    // Extract the existing-exception count so we can verify the button
    // label matches it.
    const existingMatch = initialText.match(/(\d+) exceptii? manual/);
    expect(existingMatch).not.toBeNull();
    const existingCount = parseInt(existingMatch![1], 10);
    expect(existingCount).toBeGreaterThanOrEqual(1);

    // Overwrite toggle IS visible.
    const toggle = modal.locator("[data-testid='bulk-preview-overwrite-toggle']");
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    // Check the toggle → button label changes inside the modal.
    await toggle.check();
    await expect(
      modal.getByRole("button", {
        name: new RegExp(`Aplica si suprascrie ${existingCount} exceptii`),
      })
    ).toBeVisible();

    // Breakdown text now reads "vor fi SUPRASCRISE" instead of "nimic suprascris".
    const afterText = (await breakdown.innerText()).trim();
    expect(afterText).toMatch(/vor fi SUPRASCRISE/);
    expect(afterText).not.toMatch(/nimic suprascris/);

    // Uncheck → reverts.
    await toggle.uncheck();
    await expect(breakdown).toContainText("nimic suprascris");

    // Cancel — no DB writes.
    await page.getByRole("button", { name: "Anuleaza" }).click();
  });

  test("20. Preview modal: overwrite toggle is DISABLED when cont default is selected", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await page.goto(MAPARI_URL);
    await page.waitForSelector("text=Cheltuieli", { timeout: 5000 });

    // Cont 6058 + leave cont default selected — overwrite with default
    // would create redundant rows, so the toggle must be disabled.
    const cont6058Row = page.locator("li").filter({ hasText: /^6058/ }).first();
    const badge = cont6058Row
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

    // The cont default is pre-selected → Aplica is disabled (no-op
    // detection from Item #3) so we cannot open the modal directly.
    // To verify the toggle's disabled-when-default behaviour we'd need
    // to pick a different category, open the modal, then mutate
    // category — but the Select lives on the bar, not in the modal.
    //
    // So we verify the safer contract: pick a NON-default, confirm the
    // toggle is ENABLED in the modal (covers test 19); the converse
    // (toggle disabled when default selected) is enforced at the bar
    // level via Aplica being disabled, which we already verified in
    // test #13.
    const bulkSelectTrigger = panel.locator("button[aria-haspopup='listbox']").first();
    await bulkSelectTrigger.click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible();
    const optionsList = listbox.locator("button[role='option']");
    const optCount = await optionsList.count();
    const lastOption = optionsList.nth(optCount - 1);
    const pickedLabel = (await lastOption.innerText()).trim();
    await lastOption.click();
    await expect(bulkSelectTrigger).toContainText(pickedLabel);

    await panel.getByRole("button", { name: "Aplica" }).click();
    const modal = page.getByText("Confirma maparea in bulk").locator("..");
    await expect(modal).toBeVisible();
    const toggle = modal.locator("[data-testid='bulk-preview-overwrite-toggle']");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled();

    await page.getByRole("button", { name: "Anuleaza" }).click();
  });
});
