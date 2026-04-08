"use client";

import { useEffect, useState } from "react";
import { CppView } from "@/components/datasets/cpp-view";
import type { CppData } from "@/modules/reporting";

interface Props {
  clientId: string;
  year: number;
  month: number;
}

export function CppTab({ clientId, year, month }: Props) {
  const [cpp, setCpp] = useState<CppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/balance?clientId=${clientId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => setCpp(data.cpp))
      .finally(() => setLoading(false));
  }, [clientId, year, month]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray">Se calculeaza CPP...</div>;
  }

  if (!cpp || cpp.lines.length === 0) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray">Nu exista date P&L pentru aceasta perioada.</div>;
  }

  return <CppView cpp={cpp} />;
}
