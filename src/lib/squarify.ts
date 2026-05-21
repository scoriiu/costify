/**
 * Squarify treemap layout — Bruls/Huijbregts/van Wijk (2000).
 *
 * Lays out a list of values (weights) inside a rectangle so that the resulting
 * cells are as close to square as possible. This is the algorithm used by
 * D3's d3.treemap with the default tile, and is what NYT/WSJ use for budget
 * / market-cap visualisations. Pure TypeScript, no dependencies.
 *
 * Usage:
 *   const layout = squarify(items, { x: 0, y: 0, w: 800, h: 400 });
 *   // layout[i] = { x, y, w, h, data }
 */

export interface SquarifyItem<T> {
  value: number;
  data: T;
}

export interface SquarifyRect<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  data: T;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function squarify<T>(
  items: SquarifyItem<T>[],
  bounds: Rect
): SquarifyRect<T>[] {
  // Filter out zero/negative entries — they have no area to allocate.
  const positive = items.filter((it) => it.value > 0);
  if (positive.length === 0) return [];

  const totalValue = positive.reduce((s, it) => s + it.value, 0);
  const totalArea = bounds.w * bounds.h;
  if (totalArea <= 0 || totalValue <= 0) return [];

  // Sort descending by value so the largest pieces are placed first; the
  // algorithm produces the best aspect ratios when fed sorted input.
  const sorted = [...positive].sort((a, b) => b.value - a.value);

  // Scale values into pixel-areas so they sum exactly to the available area.
  const scale = totalArea / totalValue;
  const scaled = sorted.map((it) => ({ ...it, area: it.value * scale }));

  const result: SquarifyRect<T>[] = [];
  layout(scaled, [], bounds, result);
  return result;
}

interface ScaledItem<T> {
  value: number;
  area: number;
  data: T;
}

function layout<T>(
  remaining: ScaledItem<T>[],
  row: ScaledItem<T>[],
  rect: Rect,
  out: SquarifyRect<T>[]
): void {
  if (remaining.length === 0) {
    if (row.length > 0) emitRow(row, rect, out);
    return;
  }

  // Bail if the rect has no room left — happens only with floating point
  // rounding edge cases. Drop the rest silently rather than spin.
  if (rect.w <= 0 || rect.h <= 0) return;

  const shorter = Math.min(rect.w, rect.h);
  const next = remaining[0];

  // Worst aspect ratio if we add `next` to the current row vs commit the row.
  const withNext = worstAspect([...row, next], shorter);
  const without = row.length === 0 ? Infinity : worstAspect(row, shorter);

  if (row.length === 0 || withNext <= without) {
    // Add next to the current row and continue with the rest.
    layout(remaining.slice(1), [...row, next], rect, out);
  } else {
    // Commit the row to the rect, restart with an empty row in the leftover
    // sub-rect. Crucially we keep `next` in `remaining` so it's still placed.
    const newRect = emitRow(row, rect, out);
    layout(remaining, [], newRect, out);
  }
}

function worstAspect<T>(row: ScaledItem<T>[], shorter: number): number {
  if (row.length === 0) return Infinity;
  const sum = row.reduce((s, it) => s + it.area, 0);
  const min = Math.min(...row.map((it) => it.area));
  const max = Math.max(...row.map((it) => it.area));
  const w2 = shorter * shorter;
  const s2 = sum * sum;
  // Worst aspect ratio of any cell in the row given the shorter side. The
  // ratio is always >= 1 (1 means perfect square).
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

/** Emit the current row into the rectangle along its shorter side; return the
 *  remaining rect available for subsequent rows. */
function emitRow<T>(
  row: ScaledItem<T>[],
  rect: Rect,
  out: SquarifyRect<T>[]
): Rect {
  const sum = row.reduce((s, it) => s + it.area, 0);
  if (rect.w >= rect.h) {
    // Row is laid out along the left side as a column of width = sum / h.
    const colWidth = sum / rect.h;
    let y = rect.y;
    for (const it of row) {
      const cellH = it.area / colWidth;
      out.push({ x: rect.x, y, w: colWidth, h: cellH, data: it.data });
      y += cellH;
    }
    return { x: rect.x + colWidth, y: rect.y, w: rect.w - colWidth, h: rect.h };
  } else {
    // Row is laid out along the top as a row of height = sum / w.
    const rowHeight = sum / rect.w;
    let x = rect.x;
    for (const it of row) {
      const cellW = it.area / rowHeight;
      out.push({ x, y: rect.y, w: cellW, h: rowHeight, data: it.data });
      x += cellW;
    }
    return { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: rect.h - rowHeight };
  }
}
