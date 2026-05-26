/**
 * OwnerWithdrawalsCard — money flowing between the firm and its owner.
 *
 * Dividends paid / unpaid / interim, advances, shareholder loans.
 * Layout: a small total header, then one row per item with a horizontal
 * progress bar visualizing the share, plus a one-line description.
 *
 * Color: primary teal — these aren't "good" or "bad", they're personal
 * positions worth tracking.
 */

import { CircleDollarSign } from "lucide-react";
import type { OwnerWithdrawals } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface OwnerWithdrawalsCardProps {
  data: OwnerWithdrawals;
}

export function OwnerWithdrawalsCard({ data }: OwnerWithdrawalsCardProps) {
  if (data.items.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex items-center gap-2 mb-1">
          <CircleDollarSign size={15} className="text-primary" />
          <h3
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Bani intre tine si firma
          </h3>
        </div>
        <p
          className="text-[13px] text-gray italic mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nu exista nicio miscare de bani intre tine si firma momentan.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.items.map((i) => i.value));

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3 flex items-baseline justify-between gap-3">
        <div>
          <h3
            className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            <CircleDollarSign size={15} className="text-primary" />
            Bani intre tine si firma
          </h3>
          <p
            className="mt-0.5 text-[12px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Dividende, avansuri, imprumuturi catre / de la asociati.
          </p>
        </div>
        <span
          className="font-mono text-[20px] font-semibold text-white tabular-nums shrink-0"
          style={{ letterSpacing: "-0.04em" }}
        >
          {lei(data.total)}
        </span>
      </div>

      <ul className="divide-y divide-dark-3">
        {data.items.map((item) => (
          <Item
            key={item.id}
            label={item.label}
            description={item.description}
            value={item.value}
            max={max}
          />
        ))}
      </ul>
    </div>
  );
}

function Item({
  label,
  description,
  value,
  max,
}: {
  label: string;
  description: string;
  value: number;
  max: number;
}) {
  const widthPct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <li className="px-5 py-3.5 hover:bg-dark-3/20 transition-colors">
      <div className="flex items-baseline justify-between gap-4 mb-1.5">
        <span
          className="text-[13px] font-semibold text-white"
          style={{ letterSpacing: "-0.02em" }}
        >
          {label}
        </span>
        <span
          className="font-mono text-[14px] font-semibold text-white tabular-nums shrink-0"
          style={{ letterSpacing: "-0.02em" }}
        >
          {lei(value)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-dark-3 overflow-hidden mb-2">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${widthPct}%`, opacity: 0.85 }}
        />
      </div>
      <p
        className="text-[12px] text-gray-light leading-relaxed"
        style={{ letterSpacing: "-0.02em" }}
      >
        {description}
      </p>
    </li>
  );
}
