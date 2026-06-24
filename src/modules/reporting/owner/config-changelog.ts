/**
 * Git-log style changelog derived from the period config overview. Pure and
 * dependency-free (type-only import) so it can be bundled into the client banner
 * without dragging server code along.
 */
import type { PeriodConfigItem, ConfigGroup } from "./config-overview";

/** One transition: a line went FROM one rule TO another, on a given month. The
 *  before/after pair is what powers the git-style changelog view. */
export interface ConfigChange {
  year: number;
  month: number;
  group: ConfigGroup;
  title: string;
  fromLabel: string;
  toLabel: string;
  /** True when the new rule's segment covers the currently selected period. */
  current: boolean;
}

/**
 * Flatten the overview into a chronological changelog: every boundary between
 * two consecutive segments of a line becomes one before -> after entry. Newest
 * first, ties broken by line title. A constant per-cont deviation is NOT a
 * transition, so it never shows here - the log carries only genuine changes.
 */
export function computeConfigChangelog(items: PeriodConfigItem[]): ConfigChange[] {
  const changes: ConfigChange[] = [];
  for (const item of items) {
    for (let i = 1; i < item.segments.length; i++) {
      const prev = item.segments[i - 1];
      const seg = item.segments[i];
      changes.push({
        year: seg.fromYear,
        month: seg.fromMonth,
        group: item.group,
        title: item.title,
        fromLabel: prev.valueLabel,
        toLabel: seg.valueLabel,
        current: seg.current,
      });
    }
  }
  changes.sort((a, b) => {
    const kb = b.year * 100 + b.month;
    const ka = a.year * 100 + a.month;
    if (kb !== ka) return kb - ka;
    return a.title.localeCompare(b.title, "ro");
  });
  return changes;
}
