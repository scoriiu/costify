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
  /** Items shown only in L2 (Detaliat) mode. Inserted after the base item
   *  with id `insertAfterId`, or before `tailItems` when not specified. */
  detailedOnlyItems?: NavItem[];
  insertAfterId?: string;
  /** Items appended after detailedOnly. */
  tailItems?: NavItem[];
}

export function SectionQuickNavDynamic({
  baseItems,
  detailedOnlyItems = [],
  insertAfterId,
  tailItems = [],
}: Props) {
  const { mode } = useViewMode();
  let items: NavItem[];
  if (mode !== "detailed" || detailedOnlyItems.length === 0) {
    items = [...baseItems, ...tailItems];
  } else {
    const anchor = insertAfterId
      ? baseItems.findIndex((i) => i.id === insertAfterId)
      : -1;
    items =
      anchor >= 0
        ? [
            ...baseItems.slice(0, anchor + 1),
            ...detailedOnlyItems,
            ...baseItems.slice(anchor + 1),
            ...tailItems,
          ]
        : [...baseItems, ...detailedOnlyItems, ...tailItems];
  }
  return <SectionQuickNav items={items} />;
}
