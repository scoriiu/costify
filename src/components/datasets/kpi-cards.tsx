"use client";

import type { KpiSnapshot } from "@/modules/reporting";

interface Props {
  kpis: KpiSnapshot;
}

export function KpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Cash & Banca" value={kpis.cashBank} suffix="RON" color="primary" />
      <Card label="Creante clienti" value={kpis.clientiCreante} suffix="RON" color="blue" />
      <Card label="Datorii furnizori" value={kpis.furnizoriDatorii} suffix="RON" color="warn" />
      <Card label="TVA de plata" value={kpis.tvaDePlata} suffix="RON" color={kpis.tvaDePlata > 0 ? "danger" : "green"} />
      <Card label="Venituri totale" value={kpis.totalVenituri} suffix="RON" color="green" />
      <Card label="Cheltuieli totale" value={kpis.totalCheltuieli} suffix="RON" color="danger" />
      <Card label="Rezultat" value={kpis.rezultat} suffix="RON" color={kpis.rezultat >= 0 ? "green" : "danger"} />
      <Card
        label="Marja operationala"
        value={kpis.marjaOperationala}
        suffix="%"
        color={kpis.marjaOperationala !== null && kpis.marjaOperationala >= 0 ? "green" : "danger"}
      />
    </div>
  );
}

function Card({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number | null;
  suffix: string;
  color: string;
}) {
  const colorClass = `text-${color}`;
  const formatted = value !== null ? formatNumber(value) : "-";

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-4">
      <div className="font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-mono text-xl font-bold ${colorClass}`}>
          {formatted}
        </span>
        <span className="font-mono text-xs text-gray">{suffix}</span>
      </div>
    </div>
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
