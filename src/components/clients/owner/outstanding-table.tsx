"use client";

/**
 * Outstanding partners — clienti (de incasat) or furnizori (de platit).
 *
 * Modern visual: each row has a name, share-of-total bar, and rounded
 * amount. Top N shown by default with smooth expand. Header carries the
 * total in a hero number plus a sentence ("X parteneri datoreaza Y lei").
 *
 * Tone:
 *   - clienti  → primary blue (informational, money coming)
 *   - furnizori → orange      (attention, money you owe)
 */

import { useState } from "react";
import { Users, Truck } from "lucide-react";
import type { OutstandingPartner } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

const INITIAL_VISIBLE = 8;

interface OutstandingTableProps {
  variant: "clienti" | "furnizori";
  partners: OutstandingPartner[];
}

export function OutstandingTable({ variant, partners }: OutstandingTableProps) {
  const [expanded, setExpanded] = useState(false);

  const isClienti = variant === "clienti";
  const Icon = isClienti ? Users : Truck;
  const title = isClienti ? "Cine iti datoreaza bani" : "Cui ii datorezi bani";
  const accentClass = isClienti ? "text-blue" : "text-orange";
  const barClass = isClienti ? "bg-blue/70" : "bg-orange/70";

  if (partners.length === 0) {
    return (
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} className={accentClass} />
          <h3
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h3>
        </div>
        <p
          className="text-[13px] text-gray italic mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          {isClienti
            ? "Nu ai facturi neincasate. Toata lumea a platit la zi."
            : "Nu ai facturi neplatite. Esti la zi cu furnizorii."}
        </p>
      </div>
    );
  }

  const total = partners.reduce((s, p) => s + p.sold, 0);
  const visible = expanded ? partners : partners.slice(0, INITIAL_VISIBLE);
  const hasMore = partners.length > INITIAL_VISIBLE;
  const max = partners[0]?.sold ?? 1;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Icon size={14} className={accentClass} />
              <h3
                className="text-[14px] font-semibold text-white"
                style={{ letterSpacing: "-0.04em" }}
              >
                {title}
              </h3>
            </div>
            <p
              className="text-[11px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              {partners.length}{" "}
              {isClienti
                ? partners.length === 1
                  ? "client cu facturi neincasate"
                  : "clienti cu facturi neincasate"
                : partners.length === 1
                  ? "furnizor cu facturi neplatite"
                  : "furnizori cu facturi neplatite"}
            </p>
          </div>
          <span
            className="font-mono text-[20px] font-semibold text-white tabular-nums"
            style={{ letterSpacing: "-0.04em" }}
          >
            {lei(total)}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-dark-3">
        {visible.map((partner) => (
          <Row
            key={partner.cont}
            partner={partner}
            total={total}
            max={max}
            barClass={barClass}
          />
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="block w-full border-t border-dark-3 px-5 py-3 text-center text-[12px] font-medium text-gray-light hover:bg-dark-3/40 hover:text-white transition-colors cursor-pointer"
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
  max,
  barClass,
}: {
  partner: OutstandingPartner;
  total: number;
  max: number;
  barClass: string;
}) {
  const sharePct = total > 0 ? (partner.sold / total) * 100 : 0;
  const barWidth = max > 0 ? (partner.sold / max) * 100 : 0;
  return (
    <li className="px-5 py-3 hover:bg-dark-3/20 transition-colors">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span
          className="text-[13px] text-white truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={partner.partnerName}
        >
          {partner.partnerName}
        </span>
        <span className="flex items-baseline gap-2 shrink-0">
          <span
            className="font-mono text-[10px] text-gray tabular-nums w-10 text-right"
            aria-hidden
          >
            {sharePct.toFixed(0)}%
          </span>
          <span
            className="font-mono text-[13px] font-semibold text-white tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            {lei(partner.sold)}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-dark-3 overflow-hidden">
        <div
          className={`h-full ${barClass} rounded-full transition-all`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </li>
  );
}
