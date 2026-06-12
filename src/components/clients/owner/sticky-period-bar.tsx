"use client";

/**
 * StickyPeriodBar — a thin sticky strip under the page chrome that keeps
 * the active period (and the view-mode toggle) visible while the user
 * scrolls through the long owner dashboard.
 *
 * The owner view is one long scrollable page (~10 sections). Without
 * this bar, by the time the user is reading section §11 "Obligatii" they
 * have lost track of which month they're looking at. The big period
 * label in the page header is great for the first screen, useless after
 * the first scroll.
 *
 * Layout:
 *   [ Perioada · APRILIE 2026 ]           [ Simplu | Detaliat ]
 *
 * Hidden when there is only one period available (selector would be
 * useless). On mobile, the bar collapses to just the period label;
 * the toggle stays in the header.
 *
 * Sticky positioning math:
 *   - Preview strip top: 0, height ~44 px → bar sits at top-11 (44 px).
 *   - Owner topbar height: 56 px → bar sits at top-14 (56 px).
 *   The wrapping page knows which chrome it has and passes `topOffset`.
 */

import { Download } from "lucide-react";
import { PeriodSelector, type PeriodOption } from "./period-selector";
import { ViewModeToggle } from "./view-mode-toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { monthLabel } from "@/lib/owner-format";

interface Props {
  year: number;
  month: number;
  availablePeriods: PeriodOption[];
  /** When set, shows the "Descarca Excel" action: downloads the FROZEN
   *  published snapshot of the viewed month via /api/owner/export. Only
   *  passed when the viewed month is actually published. */
  exportClientId?: string;
  /** Tailwind class for the sticky top offset. Defaults to top-11 (preview
   *  strip is 44 px). For /firma's owner topbar (56 px) pass top-14. */
  topClassName?: string;
}

export function StickyPeriodBar({
  year,
  month,
  availablePeriods,
  exportClientId,
  topClassName = "top-11",
}: Props) {
  const label = monthLabel(year, month);

  return (
    <div
      className={`sticky ${topClassName} z-30 -mx-4 sm:-mx-8 mb-6 border-b border-dark-3/60 bg-dark/85 backdrop-blur-xl`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-8">
        {/* Period block — large enough that you can read it at a glance
            while scrolling, but compact enough not to dominate. */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-wider text-primary"
            style={{ letterSpacing: "0.08em" }}
          >
            Perioada
          </span>
          <span className="hidden sm:inline-block h-3 w-px bg-primary/30" />
          <span
            className="text-[14px] sm:text-[15px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {exportClientId && (
            <Tooltip content="Descarca luna afisata ca fisier Excel" side="bottom">
              <a
                href={`/api/owner/export?clientId=${exportClientId}&year=${year}&month=${month}`}
                download
                data-testid="owner-export"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-dark-3 bg-dark-2 px-3 font-mono text-[11px] text-gray-light transition-colors hover:border-primary/30 hover:text-white"
              >
                <Download size={12} />
                <span className="hidden sm:inline">Excel</span>
              </a>
            </Tooltip>
          )}
          {availablePeriods.length > 1 && (
            <PeriodSelector
              currentYear={year}
              currentMonth={month}
              options={availablePeriods}
            />
          )}
          <ViewModeToggle />
        </div>
      </div>
    </div>
  );
}
