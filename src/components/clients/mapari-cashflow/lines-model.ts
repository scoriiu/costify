/**
 * Pure money model for the "Linii de business" view. Extracted from the view
 * component so the routing math is unit-testable.
 *
 * Resolution honors the FULL cascade, partner pins included:
 *
 *   partener > cont > categorie > firma > default
 *
 * Each cont's rulaj splits in two streams:
 *   1. the partner-pinned portion (PartnerVerticalAllocation) goes straight
 *      to the pinned lines;
 *   2. the remainder follows the cont's resolved cascade split, with anything
 *      unassigned falling to the synthetic "Toata firma" residue.
 *
 * Partner amounts arrive at contBase grain (partner rulaj is aggregated per
 * contBase). When several analytic leaves share a contBase, the pinned money
 * is distributed across them proportionally to each leaf's rulaj so nothing
 * is double-counted. Reconciliation invariant: the sum of all line totals
 * equals the firm totals, always.
 */
import type { AccountListItem, CostCategoryNode } from "@/modules/categories";
import type { VerticalView } from "@/modules/verticals";

// Synthetic "Toata firma" line — the residue of everything not assigned to a
// real line of business. It's not a DB Vertical; it's computed so the patron's
// unallocated money is visible at the top instead of vanishing into a gap.
export const FIRMA_ID = "__firma__";
export const FIRMA_VERTICAL: VerticalView = {
  id: FIRMA_ID,
  clientId: "",
  name: "Toata firma",
  position: -1,
  isDefault: true,
  allocationCount: 0,
};

export type ContSlice = { account: AccountListItem; amount: number };
export type SubgroupSlice = {
  categoryId: string;
  name: string;
  expenses: number;
  revenues: number;
  conts: ContSlice[];
};
export type CatSlice = {
  categoryId: string | null;
  name: string;
  expenses: number;
  revenues: number;
  /** Conts mapped directly to this (root) category. */
  conts: ContSlice[];
  /** Nested subgroups (descendant categories) with their own conts/totals. */
  subgroups: SubgroupSlice[];
};
export type LineModel = {
  vertical: VerticalView;
  colorIndex: number;
  expenses: number;
  revenues: number;
  contCount: number;
  categories: CatSlice[];
};

/**
 * Per-cont contribution per line: the partner-pinned stream first, the
 * cascade split on the remainder second. Returned as verticalId -> amount
 * where anything not landing on a real line is keyed FIRMA_ID.
 */
function contributionsForAccount(
  a: AccountListItem,
  rulaj: number,
  baseTotal: number,
  realVerticalIds: Set<string>
): Map<string, number> {
  const contrib = new Map<string, number>();
  const add = (verticalId: string, amount: number) => {
    if (amount === 0) return;
    const key = realVerticalIds.has(verticalId) ? verticalId : FIRMA_ID;
    contrib.set(key, (contrib.get(key) ?? 0) + amount);
  };

  // Stream 1 — partner-pinned money, scaled from contBase grain to this leaf
  // proportionally to the leaf's share of the base rulaj, and clamped so the
  // pinned stream never exceeds the leaf's own rulaj (partner rulaj and
  // balance rulaj come from the same journal but round independently).
  const fraction = baseTotal !== 0 ? rulaj / baseTotal : 0;
  const rawPinned = (a.partnerLobPinnedRulaj ?? 0) * fraction;
  const clamp =
    rawPinned > Math.abs(rulaj) && rawPinned > 0 ? Math.abs(rulaj) / rawPinned : 1;
  let pinned = 0;
  for (const [vid, amt] of Object.entries(a.partnerLobByVertical ?? {})) {
    const val = amt * fraction * clamp;
    if (!val) continue;
    add(vid, val);
    pinned += val;
  }

  // Stream 2 — the remainder follows the cont's resolved cascade split. Only
  // splits that target a REAL line count as assigned; anything else (no rule,
  // or a default-vertical split) falls to the FIRMA residue.
  const remainder = rulaj - pinned;
  const realSplits = a.effectiveAllocation.splits.filter((s) =>
    realVerticalIds.has(s.verticalId)
  );
  const assignedPct = realSplits.reduce((s, x) => s + x.percent, 0);
  const splits =
    assignedPct >= 100
      ? realSplits
      : [...realSplits, { verticalId: FIRMA_ID, percent: 100 - assignedPct }];
  for (const s of splits) {
    if (s.percent <= 0) continue;
    add(s.verticalId, (remainder * s.percent) / 100);
  }

  return contrib;
}

export function buildModel(
  accounts: AccountListItem[],
  verticals: VerticalView[],
  tree: CostCategoryNode[]
): { lines: LineModel[]; firmExpenses: number; firmRevenues: number } {
  // Resolve any category to its TOP-LEVEL group AND the subgroup directly under
  // that group on the path to it. The Linii composition preserves the
  // hierarchy: group -> subgroup -> conturi. A cont mapped straight to the
  // group has no subgroup; a cont mapped deeper rolls up to the first-level
  // subgroup under the group.
  type Resolved = {
    root: { id: string; name: string };
    subgroup: { id: string; name: string } | null;
  };
  const resolvedById = new Map<string, Resolved>();
  const walk = (
    nodes: CostCategoryNode[],
    root: { id: string; name: string } | null,
    subgroup: { id: string; name: string } | null
  ) => {
    for (const n of nodes) {
      const r = root ?? { id: n.id, name: n.name };
      // Subgroup is the first node BELOW the root on this path. At depth 0 it's
      // null (the node IS the root); at depth >= 1 it's fixed to the first
      // descendant under the root.
      const sg = root === null ? null : subgroup ?? { id: n.id, name: n.name };
      resolvedById.set(n.id, { root: r, subgroup: sg });
      walk(n.children, r, sg);
    }
  };
  walk(tree, null, null);

  const realVerticals = verticals.filter((v) => !v.isDefault);
  const realVerticalIds = new Set(realVerticals.map((v) => v.id));

  // per line -> per category bucket. We always carry a synthetic FIRMA bucket
  // that catches everything NOT assigned to a real line (the residue that the
  // patron sees as "Toata firma"), so no money silently disappears.
  const lineCats = new Map<string, Map<string, CatSlice>>();
  const lineTotals = new Map<
    string,
    { expenses: number; revenues: number; conts: Set<string> }
  >();
  const ensureBucket = (id: string) => {
    if (!lineCats.has(id)) lineCats.set(id, new Map());
    if (!lineTotals.has(id))
      lineTotals.set(id, { expenses: 0, revenues: 0, conts: new Set() });
  };
  for (const v of realVerticals) ensureBucket(v.id);
  ensureBucket(FIRMA_ID);

  // ContBase totals per kind: the scaling denominator for contBase-grain
  // partner amounts distributed across sibling analytic leaves.
  const baseTotals = new Map<string, number>();
  for (const a of accounts) {
    const rulaj = a.kind === "expense" ? a.rulajD : a.rulajC;
    if (!rulaj) continue;
    baseTotals.set(a.contBase, (baseTotals.get(a.contBase) ?? 0) + rulaj);
  }

  let firmExpenses = 0;
  let firmRevenues = 0;

  for (const a of accounts) {
    const rulaj = a.kind === "expense" ? a.rulajD : a.rulajC;
    if (!rulaj) continue;
    if (a.kind === "expense") firmExpenses += rulaj;
    else firmRevenues += rulaj;

    const contrib = contributionsForAccount(
      a,
      rulaj,
      baseTotals.get(a.contBase) ?? 0,
      realVerticalIds
    );

    const resolved = a.currentMapping
      ? resolvedById.get(a.currentMapping.categoryId) ?? null
      : null;
    const root = resolved?.root ?? null;
    const subgroup = resolved?.subgroup ?? null;
    const catKey = root?.id ?? "__none__";
    const catName = root?.name ?? "Fara linie de cost";

    for (const [verticalId, part] of contrib) {
      if (part === 0) continue;
      const cats = lineCats.get(verticalId);
      const totals = lineTotals.get(verticalId);
      if (!cats || !totals) continue;

      let slice = cats.get(catKey);
      if (!slice) {
        slice = {
          categoryId: root?.id ?? null,
          name: catName,
          expenses: 0,
          revenues: 0,
          conts: [],
          subgroups: [],
        };
        cats.set(catKey, slice);
      }
      // Root totals always include the cont (the subgroup is part of the group).
      if (a.kind === "expense") {
        slice.expenses += part;
        totals.expenses += part;
      } else {
        slice.revenues += part;
        totals.revenues += part;
      }
      totals.conts.add(a.cont);

      // Route the cont to the group itself or to its subgroup bucket.
      if (subgroup) {
        let sg = slice.subgroups.find((x) => x.categoryId === subgroup.id);
        if (!sg) {
          sg = {
            categoryId: subgroup.id,
            name: subgroup.name,
            expenses: 0,
            revenues: 0,
            conts: [],
          };
          slice.subgroups.push(sg);
        }
        if (a.kind === "expense") sg.expenses += part;
        else sg.revenues += part;
        sg.conts.push({ account: a, amount: part });
      } else {
        slice.conts.push({ account: a, amount: part });
      }
    }
  }

  const buildLine = (vertical: VerticalView, colorIndex: number): LineModel => {
    const totals = lineTotals.get(vertical.id)!;
    const byActivity = (
      a: { expenses: number; revenues: number },
      b: { expenses: number; revenues: number }
    ) => b.expenses + b.revenues - (a.expenses + a.revenues);
    const cats = Array.from(lineCats.get(vertical.id)!.values())
      .map((c) => ({
        ...c,
        conts: [...c.conts].sort((x, y) => y.amount - x.amount),
        subgroups: c.subgroups
          .map((sg) => ({
            ...sg,
            conts: [...sg.conts].sort((x, y) => y.amount - x.amount),
          }))
          .sort(byActivity),
      }))
      .sort(byActivity);
    return {
      vertical,
      colorIndex,
      expenses: totals.expenses,
      revenues: totals.revenues,
      contCount: totals.conts.size,
      categories: cats,
    };
  };

  // "Toata firma" first (the residue), then the real lines in definition order.
  const firmaLine = buildLine(FIRMA_VERTICAL, -1);
  const realLines = realVerticals.map((v, i) => buildLine(v, i));
  const lines: LineModel[] = [
    ...(firmaLine.expenses > 0 || firmaLine.revenues > 0 ? [firmaLine] : []),
    ...realLines,
  ];

  return { lines, firmExpenses, firmRevenues };
}
