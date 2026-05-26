"use client";

/**
 * SectionQuickNavDynamic — wraps SectionQuickNav and injects mode-sensitive
 * entries (currently just "Indicatori" for L2) based on the live ViewMode
 * context. Keeps SectionQuickNav itself dumb and reusable.
 */

import { SectionQuickNav } from "./section-quick-nav";
import { useViewMode } from "./view-mode-context";

interface NavItem {
  id: string;
  label: string;
}

interface Props {
  /** Items always shown, in render order. */
  baseItems: NavItem[];
  /** Items shown only in L2 (Detaliat) mode. Inserted before `tailItems`. */
  detailedOnlyItems?: NavItem[];
  /** Items appended after detailedOnly. */
  tailItems?: NavItem[];
}

export function SectionQuickNavDynamic({
  baseItems,
  detailedOnlyItems = [],
  tailItems = [],
}: Props) {
  const { mode } = useViewMode();
  const items =
    mode === "detailed"
      ? [...baseItems, ...detailedOnlyItems, ...tailItems]
      : [...baseItems, ...tailItems];
  return <SectionQuickNav items={items} />;
}
