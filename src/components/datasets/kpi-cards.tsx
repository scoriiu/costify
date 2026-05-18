"use client";

import type { KpiSnapshot } from "@/modules/reporting";
import { Tooltip } from "@/components/ui/tooltip";
import { KPI_EXPLANATIONS, type KpiKey } from "@/lib/kpi-explanations";

type KpiColor = "neutral" | "danger" | "green";

const COLOR_CLASSES: Record<KpiColor, string> = {
  neutral: "text-white",
  danger: "text-danger",
  green: "text-green",
};

interface Props {
  kpis: KpiSnapshot;
}

function signalColor(value: number | null): KpiColor {
  if (value === null) return "neutral";
  return value >= 0 ? "green" : "danger";
}

export function KpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card kpiKey="cashBank" value={kpis.cashBank} suffix="RON" />
      <Card kpiKey="clientiCreante" value={kpis.clientiCreante} suffix="RON" />
      <Card kpiKey="furnizoriDatorii" value={kpis.furnizoriDatorii} suffix="RON" />
      <Card
        kpiKey="tvaDePlata"
        value={kpis.tvaDePlata}
        suffix="RON"
        color={kpis.tvaDePlata > 0 ? "danger" : "neutral"}
      />
      <Card kpiKey="totalVenituri" value={kpis.totalVenituri} suffix="RON" />
      <Card kpiKey="totalCheltuieli" value={kpis.totalCheltuieli} suffix="RON" />
      <Card kpiKey="rezultat" value={kpis.rezultat} suffix="RON" color={signalColor(kpis.rezultat)} />
      <Card
        kpiKey="marjaOperationala"
        value={kpis.marjaOperationala}
        suffix="%"
        color={signalColor(kpis.marjaOperationala)}
      />
    </div>
  );
}

function Card({
  kpiKey,
  value,
  suffix,
  color = "neutral",
}: {
  kpiKey: KpiKey;
  value: number | null;
  suffix: string;
  color?: KpiColor;
}) {
  const { short, body } = KPI_EXPLANATIONS[kpiKey];
  const formatted = value !== null ? formatNumber(value) : "-";

  return (
    <Tooltip content={body} side="top" className="w-full">
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-4 w-full cursor-help">
        <div className="font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
          {short}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={`font-mono text-xl font-bold ${COLOR_CLASSES[color]}`}>
            {formatted}
          </span>
          <span className="font-mono text-xs text-gray">{suffix}</span>
        </div>
      </div>
    </Tooltip>
  );
}

function formatNumber(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return sign + (abs / 1_000_000).toFixed(1) + "M";
  }
  if (abs >= 1_000) {
    return sign + (abs / 1_000).toFixed(1) + "K";
  }
  return sign + abs.toFixed(2);
}
