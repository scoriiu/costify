"use client";

import { BalanceTable } from "@/components/datasets/balance-table";
import { KpiCards } from "@/components/datasets/kpi-cards";
import type { BalanceRowView } from "@/modules/balances";
import type { KpiSnapshot } from "@/modules/reporting";

interface Props {
  /** Computed balance rows for the selected period, or null while loading /
   *  when no journal data exists yet. */
  rows: BalanceRowView[] | null;
  kpis: KpiSnapshot | null;
  loading: boolean;
}

/**
 * Presentational. ClientDetail owns the fetch + cache so tab switching is
 * instant and Balanta / CPP share one round-trip per period.
 */
export function BalantaTab({ rows, kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Se calculeaza balanta...
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Nu exista date pentru aceasta perioada.
      </div>
    );
  }

  return (
    <div>
      {kpis && <KpiCards kpis={kpis} />}
      <div className="mt-6">
        <BalanceTable rows={rows} />
      </div>
    </div>
  );
}
