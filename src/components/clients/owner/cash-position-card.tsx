/**
 * C2 — Cash Position Card
 *
 * Two-column visualization: Disponibil vs Obligatii, with a Net header at top.
 * Each line has a horizontal bar showing its share of the larger total.
 * Answers the question: "pot sa-mi platesc obligatiile?"
 */

import type { CashPosition } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface CashPositionCardProps {
  data: CashPosition;
}

export function CashPositionCard({ data }: CashPositionCardProps) {
  const max = Math.max(data.totalDisponibil, data.totalObligatii, 1);
  const isPositive = data.net >= 0;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-dark-3">
        <h3 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Pot sa-mi platesc obligatiile?
        </h3>
        <p className="mt-0.5 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Cat ai disponibil acum, fata de cat ai de platit
        </p>
      </div>

      {/* Net indicator */}
      <div
        className={`px-5 py-4 ${isPositive ? "bg-green/[0.06] border-b border-green/20" : "bg-danger/[0.06] border-b border-danger/20"}`}
      >
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            {isPositive ? "Iti raman dupa ce platesti tot" : "Lipsesc bani pentru obligatii"}
          </span>
          <span
            className={`font-mono text-[24px] font-semibold leading-none ${isPositive ? "text-green" : "text-danger"}`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {isPositive ? "+" : ""}
            {lei(data.net)}
          </span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-dark-3">
        {/* Disponibil */}
        <div className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <span
              className="font-mono text-[11px] font-medium uppercase text-gray"
              style={{ letterSpacing: "-0.04em" }}
            >
              Bani disponibili
            </span>
            <span className="font-mono text-[14px] font-semibold text-green" style={{ letterSpacing: "-0.02em" }}>
              {lei(data.totalDisponibil)}
            </span>
          </div>
          <div className="space-y-3">
            {data.disponibil.map((item) => (
              <Row key={item.id} label={item.label} value={item.value} max={max} tone="positive" />
            ))}
          </div>
        </div>

        {/* Obligatii */}
        <div className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <span
              className="font-mono text-[11px] font-medium uppercase text-gray"
              style={{ letterSpacing: "-0.04em" }}
            >
              De platit
            </span>
            <span className="font-mono text-[14px] font-semibold text-danger" style={{ letterSpacing: "-0.02em" }}>
              {lei(data.totalObligatii)}
            </span>
          </div>
          <div className="space-y-3">
            {data.obligatii.map((item) => (
              <Row key={item.id} label={item.label} value={item.value} max={max} tone="negative" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "positive" | "negative";
}) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = tone === "positive" ? "bg-green" : "bg-danger";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[13px] text-gray-light truncate" style={{ letterSpacing: "-0.02em" }}>
          {label}
        </span>
        <span className="font-mono text-[13px] font-semibold text-white shrink-0" style={{ letterSpacing: "-0.02em" }}>
          {lei(value)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-dark-3 overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
