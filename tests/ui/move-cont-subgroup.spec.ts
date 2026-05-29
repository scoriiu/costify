/**
 * Moving a cont between a subgroup and its top-level parent (and back), in the
 * Lista (Categorii) view — the flow an accountant uses to refine where a cont
 * lands in their patron chart of accounts.
 *
 * QHM21 NETWORK SRL has a real nested structure:
 *   "Salarii si contributii" (top-level)
 *     └─ "Salarii brut", "Asigurari sociale...", "Tichete...", "Ajutoare..."  (subgroups)
 *
 * cont 641 is a real journal row, mapped to the subgroup "Salarii brut".
 * We move it UP to the parent "Salarii si contributii", verify at DB + UI,
 * then move it back DOWN into the subgroup so the suite is idempotent — this
 * exercises subgroup↔parent in both directions.
 *
 * Also verifies the move picker lists subgroups with their parent path
 * ("Parent › Child"), proving subgroups are valid move targets.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3041";
const CLIENT_SLUG = "qhm21-network-srl";
const MAPARI_URL = `${BASE}/clients/${CLIENT_SLUG}?tab=mapari-cashflow`;
const MOVE_CONT = "641";
const PARENT_NAME = "Salarii si contributii";
// Self-created so the spec never depends on drifting seed data.
const SUBGROUP_NAME = "Move Test Subgroup";

function serverDatabaseUrl(): string {
  const raw = readFileSync(".env.local", "utf8");
  const line = raw.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

let prisma: PrismaClient;
let sessionToken: string;
let clientId: string;
let parentCategoryId: string;
let subgroupCategoryId: string;
let originalCategoryId: string | null;

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

  const parent = await prisma.costCategory.findFirst({
    where: { clientId, name: PARENT_NAME, parentId: null },
    select: { id: true },
  });
  if (!parent) throw new Error(`Parent category "${PARENT_NAME}" not found`);
  parentCategoryId = parent.id;

  const existingSub = await prisma.costCategory.findFirst({
    where: { clientId, name: SUBGROUP_NAME, parentId: parent.id },
    select: { id: true },
  });
  subgroupCategoryId =
    existingSub?.id ??
    (
      await prisma.costCategory.create({
        data: {
          clientId,
          parentId: parent.id,
          name: SUBGROUP_NAME,
          kind: "expense",
          position: 51,
        },
        select: { id: true },
      })
    ).id;

  // Snapshot the cont's current mapping so we can restore it exactly.
  const mapping = await prisma.accountCategoryMapping.findFirst({
    where: { clientId, cont: MOVE_CONT },
    select: { categoryId: true },
  });
  originalCategoryId = mapping?.categoryId ?? null;

  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-move-subgroup",
    },
  });
});

test.afterAll(async () => {
  // Restore the cont's original mapping, then remove our subgroup.
  if (originalCategoryId) {
    await prisma.accountCategoryMapping.updateMany({
      where: { clientId, cont: MOVE_CONT },
      data: { categoryId: originalCategoryId },
    });
  }
  await prisma.accountCategoryMapping.deleteMany({
    where: { clientId, categoryId: subgroupCategoryId },
  });
  await prisma.costCategory
    .delete({ where: { id: subgroupCategoryId } })
    .catch(() => {});
  await prisma.session.deleteMany({
    where: { userAgent: "playwright-move-subgroup" },
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

/** Open the Lista view and search for the cont so its subtree force-expands. */
async function openListaAndFind(page: Page, cont: string) {
  await page.goto(MAPARI_URL);
  await page.waitForSelector("text=Cheltuieli", { timeout: 8000 });
  // Default view is Lista (the workspace). Search narrows + force-expands.
  const search = page.getByPlaceholder(/Cauta dupa cont, denumire sau grup/);
  await expect(search).toBeVisible({ timeout: 6000 });
  await search.fill(cont);
}

async function dbCategoryOf(cont: string): Promise<string | null> {
  const m = await prisma.accountCategoryMapping.findFirst({
    where: { clientId, cont },
    select: { categoryId: true },
  });
  return m?.categoryId ?? null;
}

/** The cont row whose leading cont-code span is EXACTLY `cont` (so "64" does
 *  not also match "641"/"645"). */
function contRowExact(page: Page, cont: string) {
  return page
    .locator("li.group.flex.items-center")
    .filter({
      has: page.locator("span.font-mono", { hasText: new RegExp(`^${cont}$`) }),
    })
    .first();
}

/** Open the inline move editor for the cont and return its <li> scope. */
async function openMoveEditor(page: Page, cont: string) {
  const row = contRowExact(page, cont);
  await expect(row).toBeVisible({ timeout: 6000 });
  await row.hover();
  // Trailing hover actions: move (ArrowRightLeft) first, then unmap (X).
  await row.locator("div.opacity-0 button").first().click();
  // The editor replaces the row with a "<cont> muta la:" inline form.
  const editor = page.locator("li").filter({ hasText: "muta la:" }).first();
  await expect(editor).toBeVisible({ timeout: 4000 });
  return editor;
}

/** Open the move-target Select (the one showing "Alege grupul...") and pick
 *  the option whose label matches `optionName`. Scoped to avoid the page's
 *  year selector, which is also an aria-haspopup=listbox button. */
async function pickMoveTarget(
  page: Page,
  editor: ReturnType<Page["locator"]>,
  optionName: string | RegExp
) {
  const trigger = editor.locator("button[aria-haspopup='listbox']").first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const listbox = page.locator("[role='listbox']");
  await expect(listbox).toBeVisible({ timeout: 4000 });
  // Plain strings match exactly (so "Salarii si contributii" doesn't also
  // match the "Salarii si contributii › ..." subgroup options); regexes are
  // used as-is for the "Parent › Child" path matches.
  const option =
    typeof optionName === "string"
      ? listbox.getByRole("option", { name: optionName, exact: true })
      : listbox.getByRole("option", { name: optionName });
  await expect(option).toBeVisible({ timeout: 4000 });
  await option.click();
}

test.describe("Move a cont into a subgroup", () => {
  test("0. Setup: cont 641 starts in the 'Salarii brut' subgroup", async () => {
    await prisma.accountCategoryMapping.updateMany({
      where: { clientId, cont: MOVE_CONT },
      data: { categoryId: subgroupCategoryId },
    });
    expect(await dbCategoryOf(MOVE_CONT)).toBe(subgroupCategoryId);
  });

  test("1. The move picker lists sibling subgroups with their parent path", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openListaAndFind(page, MOVE_CONT);

    const editor = await openMoveEditor(page, MOVE_CONT);

    // Open the move Select (scoped to the editor, not the page year selector).
    await editor.locator("button[aria-haspopup='listbox']").click();
    const listbox = page.locator("[role='listbox']");
    await expect(listbox).toBeVisible({ timeout: 4000 });

    // A sibling subgroup (e.g. "Asigurari sociale...") shows as "Parent › Child".
    await expect(
      listbox.getByRole("option", {
        name: new RegExp(`${PARENT_NAME}.*Asigurari sociale`),
      })
    ).toBeVisible();
    // The top-level parent itself is listed (as a plain root option).
    await expect(
      listbox.getByRole("option", { name: PARENT_NAME, exact: true })
    ).toBeVisible();

    // Close the picker without committing.
    await page.keyboard.press("Escape");
  });

  test("2. Moving cont 641 UP to the top-level parent persists", async ({
    context,
  }) => {
    const page = await authedPage(context);
    await openListaAndFind(page, MOVE_CONT);

    const editor = await openMoveEditor(page, MOVE_CONT);
    await pickMoveTarget(page, editor, PARENT_NAME);
    await editor.getByRole("button", { name: "Muta", exact: true }).click();

    await expect
      .poll(() => dbCategoryOf(MOVE_CONT), { timeout: 6000 })
      .toBe(parentCategoryId);
  });

  test("3. After moving up, the 'Salarii brut' subgroup no longer holds 641", async ({
    context,
  }) => {
    // Ensure the parent state (idempotent if run alone).
    await prisma.accountCategoryMapping.updateMany({
      where: { clientId, cont: MOVE_CONT },
      data: { categoryId: parentCategoryId },
    });

    const page = await authedPage(context);
    await openListaAndFind(page, MOVE_CONT);

    await expect(page.getByText(PARENT_NAME).first()).toBeVisible({
      timeout: 6000,
    });
    const contRow = contRowExact(page, MOVE_CONT);
    await expect(contRow).toBeVisible();

    // Structural check: the INNERMOST subgroup container (the <li> that has
    // the "Salarii brut" label but does NOT itself contain the parent label)
    // must no longer hold the 641 row. Using .last() targets the deepest
    // matching <li>, i.e. the subgroup node itself rather than an ancestor
    // group whose text happens to include the subgroup name.
    const subgroupNodeLi = page
      .locator("li")
      .filter({ hasText: SUBGROUP_NAME })
      .filter({ hasNot: page.getByText(/Iesirile firmei|Intrarile firmei/) })
      .last();
    await expect(subgroupNodeLi).toBeVisible();
    await expect(
      subgroupNodeLi.locator("span.font-mono", { hasText: /^641$/ })
    ).toHaveCount(0);
  });

  test("4. Moving cont 641 back DOWN into the subgroup restores it", async ({
    context,
  }) => {
    // Start from the parent state.
    await prisma.accountCategoryMapping.updateMany({
      where: { clientId, cont: MOVE_CONT },
      data: { categoryId: parentCategoryId },
    });

    const page = await authedPage(context);
    await openListaAndFind(page, MOVE_CONT);

    const editor = await openMoveEditor(page, MOVE_CONT);
    // The subgroup shows as "Parent › Salarii brut".
    await pickMoveTarget(
      page,
      editor,
      new RegExp(`${PARENT_NAME}.*${SUBGROUP_NAME}`)
    );
    await editor.getByRole("button", { name: "Muta", exact: true }).click();

    await expect
      .poll(() => dbCategoryOf(MOVE_CONT), { timeout: 6000 })
      .toBe(subgroupCategoryId);
  });
});
