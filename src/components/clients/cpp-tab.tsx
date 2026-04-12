"use client";

import { useEffect, useState } from "react";
import { CppView } from "@/components/datasets/cpp-view";
import type { CppData } from "@/modules/reporting";
import type { BalanceRowView } from "@/modules/balances";

interface Props {
  clientId: string;
  year: number;
  month: number;
  onUnmappedFound?: (rows: BalanceRowView[]) => void;
}

export function CppTab({ clientId, year, month, onUnmappedFound }: Props) {
  const [cpp, setCpp] = useState<CppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/balance?clientId=${clientId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setCpp(data.cpp);
        const unmapped = (data.rows as BalanceRowView[]).filter((r) => r.unmapped);
        onUnmappedFound?.(unmapped);
      })
      .finally(() => setLoading(false));
  }, [clientId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray">Se calculeaza CPP...</div>;
  }

  if (!cpp || cpp.lines.length === 0) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray">Nu exista date P&L pentru aceasta perioada.</div>;
  }

  return <CppView cpp={cpp} />;
}
