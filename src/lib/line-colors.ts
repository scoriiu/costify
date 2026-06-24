/**
 * Per business-line (vertical / axis B) color identity.
 *
 * A line keeps the SAME color everywhere it appears — the "Linii de business"
 * pillars, the CPP breakdown columns, the trends chart — so the user builds one
 * mental color map ("the sky-blue column is Coworking") across the whole app.
 *
 * "Toata firma" (the residue / default line) is intentionally neutral gray: it
 * is the leftover bucket, not a real line of business, and must never compete
 * for attention with the real lines.
 *
 * Color assignment is stable by POSITION among the real (non-default) lines, in
 * definition order: 1st real line = teal, 2nd = amber, 3rd = sky, and so on.
 */

export interface LineColor {
  /** Solid swatch — the identity dot / spine. Reads on any theme, so it is the
   *  primary identity marker (the light text shades below are dark-theme tuned
   *  and wash out on the cream light theme, so use `dot` for marking columns). */
  dot: string;
  /** Text in the line's color (header label, accents). Dark-theme tuned. */
  text: string;
  /** Soft fill for chips / badges. */
  soft: string;
  /** Border in the line's color. */
  border: string;
  /** Raw stroke value for SVG charts. */
  stroke: string;
}

export const LINE_COLORS: readonly LineColor[] = [
  { dot: "bg-primary", text: "text-primary", soft: "bg-primary/10", border: "border-primary/30", stroke: "var(--color-primary)" },
  { dot: "bg-amber-400", text: "text-amber-300", soft: "bg-amber-400/10", border: "border-amber-400/30", stroke: "#fbbf24" },
  { dot: "bg-sky-400", text: "text-sky-300", soft: "bg-sky-400/10", border: "border-sky-400/30", stroke: "#38bdf8" },
  { dot: "bg-emerald-400", text: "text-emerald-300", soft: "bg-emerald-400/10", border: "border-emerald-400/30", stroke: "#34d399" },
  { dot: "bg-rose-400", text: "text-rose-300", soft: "bg-rose-400/10", border: "border-rose-400/30", stroke: "#fb7185" },
] as const;

export const NEUTRAL_LINE_COLOR: LineColor = {
  dot: "bg-gray/40",
  text: "text-gray",
  soft: "bg-dark-3/40",
  border: "border-dark-3",
  stroke: "var(--color-gray)",
};

/** Color for a line by its index among real lines (-1 = default/"Toata firma"). */
export function lineColorForIndex(index: number): LineColor {
  return index < 0 ? NEUTRAL_LINE_COLOR : LINE_COLORS[index % LINE_COLORS.length];
}

/**
 * Map each vertical id to its stable color. The default vertical gets neutral
 * gray; real lines are colored in their array order. Pass the verticals in the
 * same order the rest of the app lists them (default-first is fine — it is
 * skipped when numbering the real lines).
 */
export function buildLineColorMap<T extends { id: string; isDefault: boolean }>(
  verticals: T[]
): Map<string, LineColor> {
  const map = new Map<string, LineColor>();
  let realIndex = 0;
  for (const v of verticals) {
    map.set(v.id, v.isDefault ? NEUTRAL_LINE_COLOR : lineColorForIndex(realIndex++));
  }
  return map;
}
