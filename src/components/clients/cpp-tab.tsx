"use client";

import { useEffect, useState, useTransition } from "react";
import { CppView } from "@/components/datasets/cpp-view";
import { CppF20View } from "@/components/datasets/cpp-f20-view";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import { updateTaxRegimeAction } from "@/modules/clients/actions";
import type { CppData, CppF20Data } from "@/modules/reporting";
import type { BalanceRowView } from "@/modules/balances";
import { Info } from "lucide-react";

interface Props {
  clientId: string;
  year: number;
  month: number;
  onUnmappedFound?: (rows: BalanceRowView[]) => void;
}

type ViewMode = "simplified" | "f20";

const VIEW_OPTIONS = [
  { value: "simplified" as const, label: "Simplificat" },
  { value: "f20" as const, label: "F20 detaliat" },
];

const REGIME_OPTIONS = [
  { value: "profit_standard", label: "Impozit pe profit (16%)" },
  { value: "profit_micro_1", label: "Microintreprindere 1%" },
  { value: "profit_micro_3", label: "Microintreprindere 3%" },
  { value: "imca", label: "Impozit minim (IMCA)" },
  { value: "profit_specific", label: "Impozit specific (HoReCa)" },
  { value: "deferred", label: "Impozit amanat" },
];

const REGIME_INFO: Record<string, { formula: string; cont: string; description: string }> = {
  profit_standard: {
    formula: "16% × Profit impozabil",
    cont: "691",
    description: "Impozit pe profit standard (Art. 17 CF). Se aplica la rezultatul fiscal dupa ajustarile de deductibilitate.",
  },
  profit_micro_1: {
    formula: "1% × Venituri totale",
    cont: "698",
    description: "Impozit pe veniturile microintreprinderii cu minim 1 salariat (Art. 47-57 CF). Baza = venituri conform art. 53, nu profit.",
  },
  profit_micro_3: {
    formula: "3% × Venituri totale",
    cont: "698",
    description: "Impozit pe veniturile microintreprinderii — cota de 3% pentru cazuri specifice (Art. 51 CF).",
  },
  imca: {
    formula: "1% × Cifra de afaceri (minim)",
    cont: "697",
    description: "Impozit minim pe cifra de afaceri. Se datoreaza diferenta pozitiva intre IMCA si impozitul pe profit standard.",
  },
  profit_specific: {
    formula: "Suma fixa per unitate",
    cont: "695",
    description: "Impozit specific pentru HoReCa (abrogat din 2024, pastrat pentru date istorice). Suma fixa pe camera / m² suprafata.",
  },
  deferred: {
    formula: "Diferente temporare × 16%",
    cont: "698",
    description: "Impozit pe profit amanat — reflecta diferentele temporare intre baza contabila si baza fiscala (IFRS / OMFP 2844).",
  },
};

export function CppTab({ clientId, year, month, onUnmappedFound }: Props) {
  const [cpp, setCpp] = useState<CppData | null>(null);
  const [cppF20, setCppF20] = useState<CppF20Data | null>(null);
  const [taxRegime, setTaxRegime] = useState<string>("profit_standard");
  const [viewMode, setViewMode] = useState<ViewMode>("simplified");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  function fetchData() {
    setLoading(true);
    fetch(`/api/balance?clientId=${clientId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setCpp(data.cpp);
        setCppF20(data.cppF20);
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

  const hasData =
    viewMode === "simplified"
      ? cpp && cpp.lines.length > 0
      : cppF20 && cppF20.lines.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={viewMode}
          options={VIEW_OPTIONS}
          onChange={(v) => setViewMode(v)}
        />
        <div className="ml-auto flex items-center gap-3">
          <span
            className="font-mono text-[11px] font-medium uppercase tracking-widest text-gray"
            style={{ letterSpacing: "-0.04em" }}
          >
            Regim fiscal
          </span>
          <Select
            value={taxRegime}
            options={REGIME_OPTIONS}
            onChange={onRegimeChange}
          />
          <RegimeInfo regime={taxRegime} />
          {isPending && (
            <span className="font-mono text-[11px] text-gray/60">Se actualizeaza...</span>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray">
          Nu exista date P&L pentru aceasta perioada.
        </div>
      ) : viewMode === "simplified" && cpp ? (
        <CppView cpp={cpp} />
      ) : viewMode === "f20" && cppF20 ? (
        <CppF20View cpp={cppF20} />
      ) : null}
    </div>
  );
}

function RegimeInfo({ regime }: { regime: string }) {
  const info = REGIME_INFO[regime];
  if (!info) return null;

  const tooltipContent = `${info.formula}  ·  Cont ${info.cont}\n${info.description}`;

  return (
    <Tooltip content={tooltipContent}>
      <span
        role="button"
        className="text-gray hover:text-white transition-colors"
        data-testid="regime-info"
        data-formula={info.formula}
        data-cont={info.cont}
      >
        <Info size={15} />
      </span>
    </Tooltip>
  );
}
