"use client";

import { useEffect, useState, useTransition } from "react";
import { CppView } from "@/components/datasets/cpp-view";
import { updateTaxRegimeAction } from "@/modules/clients/actions";
import type { CppData } from "@/modules/reporting";
import type { BalanceRowView } from "@/modules/balances";

interface Props {
  clientId: string;
  year: number;
  month: number;
  onUnmappedFound?: (rows: BalanceRowView[]) => void;
}

const REGIME_OPTIONS = [
  { value: "profit_standard", label: "Impozit pe profit (16%)" },
  { value: "profit_micro_1", label: "Microintreprindere 1%" },
  { value: "profit_micro_3", label: "Microintreprindere 3%" },
  { value: "imca", label: "Impozit minim (IMCA)" },
  { value: "profit_specific", label: "Impozit specific (HoReCa)" },
  { value: "deferred", label: "Impozit amanat" },
];

export function CppTab({ clientId, year, month, onUnmappedFound }: Props) {
  const [cpp, setCpp] = useState<CppData | null>(null);
  const [taxRegime, setTaxRegime] = useState<string>("profit_standard");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  function fetchData() {
    setLoading(true);
    fetch(`/api/balance?clientId=${clientId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setCpp(data.cpp);
        if (data.taxRegime) setTaxRegime(data.taxRegime);
        const unmapped = ((data.rows as BalanceRowView[]) ?? []).filter(
          (r) => r.unmapped
        );
        onUnmappedFound?.(unmapped);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year, month]);

  function onRegimeChange(next: string) {
    const previous = taxRegime;
    setTaxRegime(next);
    startTransition(async () => {
      const result = await updateTaxRegimeAction(clientId, next);
      if (!result.ok) {
        setTaxRegime(previous);
        return;
      }
      fetchData();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Se calculeaza CPP...
      </div>
    );
  }

  if (!cpp || cpp.lines.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Nu exista date P&L pentru aceasta perioada.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <label
          htmlFor="tax-regime"
          className="font-mono text-[11px] font-medium uppercase tracking-widest text-gray"
          style={{ letterSpacing: "-0.04em" }}
        >
          Regim fiscal
        </label>
        <select
          id="tax-regime"
          value={taxRegime}
          onChange={(e) => onRegimeChange(e.target.value)}
          disabled={isPending}
          className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-1.5 font-mono text-xs text-white focus:border-primary focus:outline-none disabled:opacity-50"
        >
          {REGIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <CppView cpp={cpp} />
    </div>
  );
}
