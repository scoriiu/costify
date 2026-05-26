/**
 * KpiStrip — §6 power-KPI strip under the verdict banner.
 *
 * 4-6 compact tiles in a responsive grid. Each tile carries the value, a 1-line
 * hint, and a state color (good/neutral/warn/danger).
 *
 * Tile compositional pattern mirrors the KpiCard but is denser — these are
 * supporting metrics, not headline metrics, and they have to share horizontal
 * space with up to 5 siblings.
 */

import type { KpiStripItem } from "@/modules/reporting/owner";
import { Tooltip } from "@/components/ui/tooltip";

const STATE_BAR: Record<KpiStripItem["state"], string> = {
  good: "bg-green",
  neutral: "bg-primary/60",
  warn: "bg-warn",
  danger: "bg-danger",
};

const STATE_VALUE: Record<KpiStripItem["state"], string> = {
  good: "text-white",
  neutral: "text-white",
  warn: "text-warn",
  danger: "text-danger",
};

interface KpiStripProps {
  items: KpiStripItem[];
}

export function KpiStrip({ items }: KpiStripProps) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Tile key={item.id} item={item} />
      ))}
    </div>
  );
}

function Tile({ item }: { item: KpiStripItem }) {
  return (
    <Tooltip content={item.hint} side="top">
      <div className="group relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-dark-3 bg-dark-2 p-4 transition-colors hover:border-dark-3/70 hover:bg-dark-2/80">
        <span
          className={`absolute left-0 top-0 h-full w-[3px] ${STATE_BAR[item.state]} opacity-80`}
          aria-hidden
        />
        <span
          className="font-mono text-[10px] font-medium uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          {item.label}
        </span>
        <span
          className={`font-mono text-[18px] sm:text-[20px] font-semibold leading-none ${STATE_VALUE[item.state]} tabular-nums`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {item.value}
        </span>
        {item.delta && (
          <span
            className="font-mono text-[11px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {item.delta}
          </span>
        )}
      </div>
    </Tooltip>
  );
}
