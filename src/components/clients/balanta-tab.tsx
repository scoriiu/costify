"use client";

import { useEffect, useState } from "react";
import { BalanceTable } from "@/components/datasets/balance-table";
import { KpiCards } from "@/components/datasets/kpi-cards";
import type { BalanceRowView } from "@/modules/balances";
import type { KpiSnapshot } from "@/modules/reporting";

interface Props {
  clientId: string;
  year: number;
  month: number;
  onUnmappedFound?: (rows: BalanceRowView[]) => void;
}

export function BalantaTab({ clientId, year, month, onUnmappedFound }: Props) {
  const [rows, setRows] = useState<BalanceRowView[] | null>(null);
  const [kpis, setKpis] = useState<KpiSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/balance?clientId=${clientId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows);
        setKpis(data.kpis);
        const unmapped = (data.rows as BalanceRowView[]).filter((r) => r.unmapped);
        onUnmappedFound?.(unmapped);
      })
      .finally(() => setLoading(false));
  }, [clientId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray">Se calculeaza balanta...</div>;
  }

  if (!rows || rows.length === 0) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray">Nu exista date pentru aceasta perioada.</div>;
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
