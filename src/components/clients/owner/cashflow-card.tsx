"use client";

/**
 * One cashflow section, two lenses. Replaces the two stacked sections
 * (CashflowSplitChart + CashflowWaterfall) with a single anchor and a
 * client-side toggle: "Pe activitati" (O/I/F split) vs "De la inceput la
 * final" (waterfall). Pure client state, no navigation.
 */

import { useState } from "react";
import type { CashflowBreakdown, MonthlyTrendPoint } from "@/modules/reporting/owner";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { CashflowSplitChart } from "./cashflow-split-chart";
import { CashflowWaterfall } from "./cashflow-waterfall";

type Lens = "split" | "waterfall";

interface CashflowCardProps {
  breakdown: CashflowBreakdown;
  trends: MonthlyTrendPoint[];
}

export function CashflowCard({ breakdown, trends }: CashflowCardProps) {
  const [lens, setLens] = useState<Lens>("split");

  return (
    <div className="space-y-3">
      <ToggleGroup<Lens>
        value={lens}
        onChange={setLens}
        ariaLabel="Schimba vizualizarea cash-flow"
        options={[
          { value: "split", label: "Pe activitati" },
          { value: "waterfall", label: "De la inceput la final" },
        ]}
      />
      {lens === "split" ? (
        <CashflowSplitChart data={breakdown} />
      ) : (
        <CashflowWaterfall trends={trends} />
      )}
    </div>
  );
}
