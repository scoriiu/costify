/**
 * C3 — Owner Withdrawals Card
 *
 * Tracks money flowing between the company and the owner:
 * dividends (paid, unpaid, interim), advances, shareholder loans, etc.
 * Answers: "cat am scos eu din firma?"
 */

import type { OwnerWithdrawals } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface OwnerWithdrawalsCardProps {
  data: OwnerWithdrawals;
}

export function OwnerWithdrawalsCard({ data }: OwnerWithdrawalsCardProps) {
  if (data.items.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-6">
        <h3 className="text-[16px] font-semibold text-white mb-1" style={{ letterSpacing: "-0.04em" }}>
          Bani intre tine si firma
        </h3>
        <p className="text-[13px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Nu exista nicio miscare de bani intre tine si firma momentan.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.items.map((i) => i.value));

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            Bani intre tine si firma
          </h3>
          <p className="mt-0.5 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
            Dividende, avansuri, imprumuturi catre/de la asociati
          </p>
        </div>
        <span className="font-mono text-[18px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          {lei(data.total)}
        </span>
      </div>

      <div className="divide-y divide-dark-3">
        {data.items.map((item) => (
          <Item
            key={item.id}
            label={item.label}
            description={item.description}
            value={item.value}
            max={max}
          />
        ))}
      </div>
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
  const pct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-baseline justify-between gap-4 mb-1.5">
        <span className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
          {label}
        </span>
        <span className="font-mono text-[14px] font-semibold text-white shrink-0" style={{ letterSpacing: "-0.02em" }}>
          {lei(value)}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-dark-3 overflow-hidden mb-1.5">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[12px] text-gray leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
        {description}
      </p>
    </div>
  );
}
