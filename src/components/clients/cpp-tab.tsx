"use client";

/**
 * CPP tab — Cont de Profit si Pierdere.
 *
 * Shows the active regime for the selected period as a read-only label.
 * The regime is detected server-side from the client's registru jurnal —
 * specifically from which tax account (691/698/697/695) the accountant
 * booked the impozit on in that period. No manual configuration needed.
 */

import { useEffect, useState } from "react";
import { CppView } from "@/components/datasets/cpp-view";
import { CppF20View } from "@/components/datasets/cpp-f20-view";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import type { CppData, CppF20Data } from "@/modules/reporting";
import type { BalanceRowView } from "@/modules/balances";
import type { TaxRegime } from "@/modules/accounts";
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

const REGIME_INFO: Record<TaxRegime, { label: string; formula: string; cont: string; description: string }> = {
  profit_standard: {
    label: "Impozit pe profit (16%)",
    formula: "16% × Profit impozabil",
    cont: "691",
    description: "Impozit pe profit standard (Art. 17 CF). Se aplica la rezultatul fiscal dupa ajustarile de deductibilitate.",
  },
  profit_micro_1: {
    label: "Microintreprindere 1%",
    formula: "1% × Venituri totale",
    cont: "698",
    description: "Impozit pe veniturile microintreprinderii cu minim 1 salariat (Art. 47-57 CF). Baza = venituri conform art. 53, nu profit.",
  },
  profit_micro_3: {
    label: "Microintreprindere 3%",
    formula: "3% × Venituri totale",
    cont: "698",
    description: "Impozit pe veniturile microintreprinderii — cota de 3% pentru cazuri specifice (Art. 51 CF).",
  },
  imca: {
    label: "Impozit minim (IMCA)",
    formula: "1% × Cifra de afaceri (minim)",
    cont: "697",
    description: "Impozit minim pe cifra de afaceri. Se datoreaza diferenta pozitiva intre IMCA si impozitul pe profit standard.",
  },
  profit_specific: {
    label: "Impozit specific (HoReCa)",
    formula: "Suma fixa per unitate",
    cont: "695",
    description: "Impozit specific pentru HoReCa (abrogat din 2024, pastrat pentru date istorice).",
  },
  deferred: {
    label: "Impozit amanat",
    formula: "Diferente temporare × 16%",
    cont: "698",
    description: "Impozit pe profit amanat — reflecta diferentele temporare intre baza contabila si baza fiscala (IFRS / OMFP 2844).",
  },
};

export function CppTab({ clientId, year, month, onUnmappedFound }: Props) {
  const [cpp, setCpp] = useState<CppData | null>(null);
  const [cppF20, setCppF20] = useState<CppF20Data | null>(null);
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("profit_standard");
  const [viewMode, setViewMode] = useState<ViewMode>("simplified");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/balance?clientId=${clientId}&year=${year}&month=${month}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCpp(data.cpp);
        setCppF20(data.cppF20);
        if (data.taxRegime) setTaxRegime(data.taxRegime as TaxRegime);
        const unmapped = ((data.rows as BalanceRowView[]) ?? []).filter((r) => r.unmapped);
        onUnmappedFound?.(unmapped);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year, month]);

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

  const info = REGIME_INFO[taxRegime];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={viewMode}
          options={VIEW_OPTIONS}
          onChange={(v) => setViewMode(v)}
        />
        <div className="ml-auto flex items-center gap-3">
          <RegimeLabel info={info} />
        </div>
      </div>

      {viewMode === "f20" && year < 2024 && (
        <LegacyF20Notice year={year} />
      )}

      {!hasData ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray">
          Nu exista date P&L pentru aceasta perioada.
        </div>
      ) : viewMode === "simplified" && cpp ? (
        <CppView cpp={cpp} />
      ) : viewMode === "f20" && cppF20 ? (
        <CppF20View cpp={cppF20} />
      ) : null}

      <MissingTaxNotice cpp={viewMode === "f20" ? cppF20 : cpp} regime={taxRegime} />
    </div>
  );
}

function LegacyF20Notice({ year }: { year: number }) {
  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-gray-light">
      <span className="font-mono font-semibold text-blue">Nota:</span>{" "}
      Costify afiseaza F20 in structura noua (OMF 2036/2025) si pentru
      exercitiul {year}. Formularul oficial depus la ANAF pentru anul{" "}
      {year} a folosit structura anterioara (OMFP 1802/2014 cu modificarile{" "}
      85/2022, 2048/2022 si 5394/2023). Totalele sunt identice; doar
      gruparea pe randuri difera. Pentru auditori, consultati formularul
      original arhivat in dosarul firmei.
    </div>
  );
}

function RegimeLabel({
  info,
}: {
  info: (typeof REGIME_INFO)[TaxRegime];
}) {
  const tooltipContent = `${info.formula}  ·  Cont ${info.cont}\n${info.description}\n\nDetectat automat din registru jurnal.`;
  return (
    <div className="flex items-center gap-2" data-testid="cpp-regime-label">
      <span
        className="font-mono text-[11px] font-medium uppercase tracking-widest text-gray"
        style={{ letterSpacing: "-0.04em" }}
      >
        Regim fiscal
      </span>
      <Tooltip content={tooltipContent}>
        <span
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-dark-3 bg-dark-2 px-3 py-2 font-mono text-[13px] text-white"
          data-testid="regime-display"
          data-regime={info.label}
          data-cont={info.cont}
          style={{ letterSpacing: "-0.02em" }}
        >
          {info.label}
          <span className="text-gray">· Cont {info.cont}</span>
        </span>
      </Tooltip>
    </div>
  );
}

function MissingTaxNotice({
  cpp,
  regime,
}: {
  cpp: CppData | CppF20Data | null;
  regime: TaxRegime;
}) {
  if (!cpp) return null;
  if (cpp.rezultatBrut <= 0) return null;
  if (cpp.rezultatBrut !== cpp.rezultatNet) return null;

  const cont = REGIME_INFO[regime]?.cont ?? "691";

  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border border-warn/20 bg-warn/5 px-4 py-3"
      data-testid="missing-tax-notice"
    >
      <Info size={14} className="mt-0.5 shrink-0 text-warn" />
      <span className="font-mono text-[11px] leading-relaxed text-gray-light">
        Impozitul nu a fost inregistrat in contabilitate pentru aceasta perioada
        (contul {cont} nu are rulaj). Rezultat net = Rezultat brut.
      </span>
    </div>
  );
}
