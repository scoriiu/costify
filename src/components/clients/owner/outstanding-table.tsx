"use client";

/**
 * C6 — Outstanding Table
 *
 * Lists partners (clienti or furnizori) with their outstanding balance.
 * Sorted descending. Top 10 shown by default, "Vezi toate" expands.
 * Each row has a horizontal bar showing share of total.
 */

import { useState } from "react";
import type { OutstandingPartner } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

const INITIAL_VISIBLE = 8;

interface OutstandingTableProps {
  variant: "clienti" | "furnizori";
  partners: OutstandingPartner[];
}

export function OutstandingTable({ variant, partners }: OutstandingTableProps) {
  const [expanded, setExpanded] = useState(false);

  if (partners.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-6">
        <h3 className="text-[14px] font-semibold text-white mb-1" style={{ letterSpacing: "-0.04em" }}>
          {variant === "clienti" ? "Cine iti datoreaza bani" : "Cui ii datorezi bani"}
        </h3>
        <p className="text-[13px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          {variant === "clienti"
            ? "Nu ai facturi neincasate. Toata lumea a platit la zi."
            : "Nu ai facturi neplatite. Esti la zi cu furnizorii."}
        </p>
      </div>
    );
  }

  const total = partners.reduce((s, p) => s + p.sold, 0);
  const visible = expanded ? partners : partners.slice(0, INITIAL_VISIBLE);
  const hasMore = partners.length > INITIAL_VISIBLE;

  const title = variant === "clienti" ? "Cine iti datoreaza bani" : "Cui ii datorezi bani";
  const subtitle =
    variant === "clienti"
      ? `${partners.length} clienti cu facturi neincasate`
      : `${partners.length} furnizori cu facturi neplatite`;
  const barColor = variant === "clienti" ? "bg-blue" : "bg-orange";

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            {title}
          </h3>
          <p className="mt-0.5 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
            {subtitle}
          </p>
        </div>
        <span className="font-mono text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          {lei(total)}
        </span>
      </div>

      <div className="divide-y divide-dark-3">
        {visible.map((partner) => (
          <Row key={partner.cont} partner={partner} total={total} barColor={barColor} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="block w-full border-t border-dark-3 px-5 py-3 text-center text-[12px] font-medium text-gray-light hover:bg-dark-3/40 hover:text-white transition-colors"
        >
          {expanded
            ? `Ascunde ${partners.length - INITIAL_VISIBLE} parteneri`
            : `Vezi toti ${partners.length} parteneri`}
        </button>
      )}
    </div>
  );
}

function Row({
  partner,
  total,
  barColor,
}: {
  partner: OutstandingPartner;
  total: number;
  barColor: string;
}) {
  const pct = total > 0 ? (partner.sold / total) * 100 : 0;
  return (
    <div className="px-5 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.02em" }}>
          {partner.partnerName}
        </span>
        <span className="font-mono text-[13px] font-semibold text-white shrink-0" style={{ letterSpacing: "-0.02em" }}>
          {lei(partner.sold)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-dark-3 overflow-hidden">
          <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="font-mono text-[10px] text-gray shrink-0" style={{ letterSpacing: "-0.02em" }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
