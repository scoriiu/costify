/**
 * Per business-line (vertical / axis B) split of CPP line values.
 *
 * The CPP table shows one amount per line ("the total"). When a client runs
 * multiple business lines, the accountant wants to see how each line splits
 * across them, based on the same mapari allocations the rest of the app uses,
 * resolved AS OF the selected month.
 *
 * Hard guarantee — no leak: every line's per-vertical amounts sum back to that
 * line's printed value, to the cent. We achieve this by splitting the line's
 * OWN value with `applySplit` (last slice absorbs rounding) and, for totals,
 * by reconciling the aggregate against the authoritative total value.
 *
 * Resolution mirrors the Mapari cascade (partner overrides excluded — they are
 * month-specific and the CPP value is YTD): each contributing balance leaf is
 * resolved through `resolveAllocationForCont` with its axis-A category path, so
 * cont, category and firm-default rules all apply exactly as in mapari.
 */

import {
  resolveAllocationForCont,
  applySplit,
  type VerticalResolverState,
} from "@/modules/verticals/resolver";
import { resolveCategoryForCont, type ResolverState } from "@/modules/categories";
import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";
import type { CppVerticalColumn } from "./types";

export interface CppVerticalContext {
  resolver: VerticalResolverState;
  /** Business lines in display order (default vertical included). */
  verticals: CppVerticalColumn[];
  /** Axis-A category resolver, for the cont -> category path. */
  categoryResolver: ResolverState | null;
}

interface LeafContribution {
  td: number;
  tc: number;
  splits: { verticalId: string; percent: number }[];
}

export interface VerticalSplitter {
  order: string[];
  /** Split one catalog code's value across verticals, weighting by the natural
   *  side of each contributing leaf. Result sums to `value` exactly. */
  split(code: string, side: "td" | "tc", value: number): Record<string, number>;
  /** Split a value across verticals, weighting by the chosen side over every
   *  leaf of every listed code. Sums to `value` exactly. */
  splitCodes(codes: Iterable<string>, side: "td" | "tc", value: number): Record<string, number>;
  /** Like splitCodes but weights by |credit - debit| per leaf — for F20 dual
   *  rows (711/712) whose value is a net movement. Sums to `value` exactly. */
  splitCodesNet(codes: Iterable<string>, value: number): Record<string, number>;
  /** Force a raw per-vertical map to sum exactly to `target`. */
  reconcile(raw: Record<string, number>, target: number): Record<string, number>;
  add(a: Record<string, number>, b: Record<string, number>): Record<string, number>;
  sub(a: Record<string, number>, b: Record<string, number>): Record<string, number>;
  zero(): Record<string, number>;
}

export function resolveCatalogCode(
  contBase: string,
  catalog: Map<string, CatalogAccount>
): string | null {
  if (catalog.has(contBase)) return contBase;
  for (let len = contBase.length - 1; len >= 2; len--) {
    const prefix = contBase.slice(0, len);
    if (catalog.has(prefix)) return prefix;
  }
  return null;
}

export function buildVerticalSplitter(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  ctx: CppVerticalContext
): VerticalSplitter {
  const order = ctx.verticals.map((v) => v.id);
  const leafMap = buildLeafContributions(rows, catalog, ctx);

  function reconcile(raw: Record<string, number>, target: number): Record<string, number> {
    const out: Record<string, number> = {};
    let sum = 0;
    for (const v of order) {
      const x = round2(raw[v] ?? 0);
      out[v] = x;
      sum += x;
    }
    const gap = round2(target - sum);
    if (gap !== 0 && order.length > 0) {
      let best = order[0];
      for (const v of order) if (Math.abs(out[v]) > Math.abs(out[best])) best = v;
      out[best] = round2(out[best] + gap);
    }
    return out;
  }

  function weightedSplit(
    codes: Iterable<string>,
    weightOf: (lf: LeafContribution) => number,
    value: number
  ): Record<string, number> {
    const weightByVid = new Map<string, number>();
    let totalWeight = 0;
    for (const code of codes) {
      for (const lf of leafMap.get(code) ?? []) {
        const w = weightOf(lf);
        if (w === 0) continue;
        totalWeight += w;
        for (const s of lf.splits) {
          weightByVid.set(
            s.verticalId,
            (weightByVid.get(s.verticalId) ?? 0) + (w * s.percent) / 100
          );
        }
      }
    }
    const raw: Record<string, number> = {};
    if (totalWeight > 0) {
      const splits = [...weightByVid.entries()].map(([verticalId, w]) => ({
        verticalId,
        percent: (w / totalWeight) * 100,
      }));
      for (const slice of applySplit(value, splits)) raw[slice.verticalId] = slice.amount;
    }
    return reconcile(raw, value);
  }

  function split(code: string, side: "td" | "tc", value: number): Record<string, number> {
    return weightedSplit([code], (lf) => Math.abs(side === "td" ? lf.td : lf.tc), value);
  }

  function splitCodes(
    codes: Iterable<string>,
    side: "td" | "tc",
    value: number
  ): Record<string, number> {
    return weightedSplit(codes, (lf) => Math.abs(side === "td" ? lf.td : lf.tc), value);
  }

  function splitCodesNet(codes: Iterable<string>, value: number): Record<string, number> {
    return weightedSplit(codes, (lf) => Math.abs(lf.tc - lf.td), value);
  }

  function add(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of order) out[v] = round2((a[v] ?? 0) + (b[v] ?? 0));
    return out;
  }

  function sub(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of order) out[v] = round2((a[v] ?? 0) - (b[v] ?? 0));
    return out;
  }

  function zero(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of order) out[v] = 0;
    return out;
  }

  return { order, split, splitCodes, splitCodesNet, reconcile, add, sub, zero };
}

function buildLeafContributions(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  ctx: CppVerticalContext
): Map<string, LeafContribution[]> {
  const out = new Map<string, LeafContribution[]>();
  for (const row of rows) {
    if (!row.isLeaf) continue;
    if (row.contBase === "121" || row.contBase === "1211" || row.contBase === "1212") continue;
    const code = resolveCatalogCode(row.contBase, catalog);
    if (!code) continue;
    const categoryPath = ctx.categoryResolver
      ? (resolveCategoryForCont(row.cont, ctx.categoryResolver)?.path
          .map((n) => n.id)
          .reverse() ?? [])
      : [];
    const allocation = resolveAllocationForCont(row.cont, ctx.resolver, categoryPath);
    const list = out.get(code) ?? [];
    list.push({ td: row.rulajTD, tc: row.rulajTC, splits: allocation.splits });
    out.set(code, list);
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
