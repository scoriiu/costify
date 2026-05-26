/**
 * Cash Position — "pot sa-mi platesc obligatiile?"
 *
 * Modern layout: a big net-headline banner that switches color/copy based
 * on whether the firm can cover its obligations, plus a balanced
 * dual-column breakdown with proportional bars. Each line aligns visually
 * across the two sides so the eye reads the comparison directly.
 *
 * The visual rule:
 *   net > 0 → green banner, ↑ icon, "Iti raman X lei"
 *   net = 0 → neutral banner, "Esti la limita"
 *   net < 0 → red banner, ↓ icon, "Lipsesc X lei"
 */

import { Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CashPosition } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface CashPositionCardProps {
  data: CashPosition;
}

export function CashPositionCard({ data }: CashPositionCardProps) {
  const max = Math.max(data.totalDisponibil, data.totalObligatii, 1);
  const isPositive = data.net > 0;
  const isZero = data.net === 0;
  const isNegative = data.net < 0;

  let bannerClass = "bg-pos/[0.08] border-pos/30";
  let bannerText = "text-pos";
  let bannerStory = `Iti raman ${lei(data.net)} dupa ce platesti tot.`;
  let BannerIcon = TrendingUp;
  if (isZero) {
    bannerClass = "bg-dark-3/40 border-dark-3";
    bannerText = "text-gray-light";
    bannerStory = "Esti exact la limita. Disponibilul acopera obligatiile.";
    BannerIcon = Minus;
  } else if (isNegative) {
    bannerClass = "bg-neg/[0.08] border-neg/30";
    bannerText = "text-neg";
    bannerStory = `Lipsesc ${lei(Math.abs(data.net))} pentru a acoperi obligatiile.`;
    BannerIcon = TrendingDown;
  }

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3
          className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          <Scale size={15} className="text-primary" />
          Pot sa-mi platesc obligatiile?
        </h3>
        <p
          className="mt-0.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Cat ai disponibil acum, fata de cat ai de platit.
        </p>
      </div>

      {/* Net banner */}
      <div className={`px-5 py-4 border-b ${bannerClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full ${bannerText} bg-dark-2/60 shrink-0`}
            >
              <BannerIcon size={16} />
            </span>
            <p
              className={`text-[13px] ${bannerText}`}
              style={{ letterSpacing: "-0.02em" }}
            >
              {bannerStory}
            </p>
          </div>
          <span
            className={`font-mono text-[24px] font-semibold tabular-nums shrink-0 ${bannerText}`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {isPositive ? "+" : ""}
            {lei(data.net)}
          </span>
        </div>
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-dark-3">
        <Side
          eyebrow="Bani disponibili"
          total={data.totalDisponibil}
          totalTone="text-pos"
          items={data.disponibil}
          max={max}
          tone="pos"
        />
        <Side
          eyebrow="De platit"
          total={data.totalObligatii}
          totalTone="text-neg"
          items={data.obligatii}
          max={max}
          tone="neg"
        />
      </div>
    </div>
  );
}

function Side({
  eyebrow,
  total,
  totalTone,
  items,
  max,
  tone,
}: {
  eyebrow: string;
  total: number;
  totalTone: string;
  items: Array<{ id: string; label: string; value: number }>;
  max: number;
  tone: "pos" | "neg";
}) {
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between mb-4">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          {eyebrow}
        </span>
        <span
          className={`font-mono text-[16px] font-semibold tabular-nums ${totalTone}`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {lei(total)}
        </span>
      </div>
      {items.length === 0 ? (
        <p
          className="text-[12px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          —
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <Row key={item.id} label={item.label} value={item.value} max={max} tone={tone} />
          ))}
        </ul>
      )}
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
  tone: "pos" | "neg";
}) {
  const widthPct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor = tone === "pos" ? "bg-pos" : "bg-neg";
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span
          className="text-[13px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={label}
        >
          {label}
        </span>
        <span
          className="font-mono text-[13px] font-semibold text-white tabular-nums shrink-0"
          style={{ letterSpacing: "-0.02em" }}
        >
          {lei(value)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-dark-3 overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${widthPct}%`, opacity: 0.8 }}
        />
      </div>
    </li>
  );
}
