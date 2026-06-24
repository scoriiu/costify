"use client";

/**
 * The period the Mapari tab is currently viewing, shared so any nested mapping
 * or allocation editor can offer period-scoped edits (ADR-0004 D10) without
 * prop-drilling. Lives in its own module so both `category-workspace` and
 * `edit-allocation-dialog` can import it with no circular dependency.
 */

import { createContext, useContext } from "react";

export type ViewedPeriod = { year: number; month: number } | null;

const PeriodContext = createContext<ViewedPeriod>(null);

export const PeriodProvider = PeriodContext.Provider;

export function useViewedPeriod(): ViewedPeriod {
  return useContext(PeriodContext);
}
