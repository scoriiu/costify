"use client";

/**
 * ChartInfo — the ⓘ next to every chart title on the owner dashboard.
 *
 * One consistent affordance: hover/focus shows a plain-Romanian explanation
 * of WHAT the chart shows and HOW to read it, written for someone who has
 * never opened an accounting app. Uses the shared Tooltip primitive (never
 * native title="").
 */

import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export function ChartInfo({ text }: { text: string }) {
  return (
    <Tooltip content={text} side="top">
      <span
        className="inline-flex shrink-0 cursor-help text-gray transition-colors hover:text-gray-light"
        tabIndex={0}
        role="img"
        aria-label={text}
        data-testid="chart-info"
      >
        <Info size={13} />
      </span>
    </Tooltip>
  );
}
