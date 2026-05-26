/**
 * TopActivityList — §9 top customers / suppliers by cash activity this month.
 *
 * Two-side panel where one card shows incasari (from clients), one shows plati
 * (to suppliers). Per partner: amount and share-of-total bar.
 *
 * The "by activity" framing (rulajC of 411 / rulajD of 401) is what the patron
 * cares about: "cine mi-a dat bani luna asta", "cui i-am dat eu bani".
 */

import type { TopActivityPartner } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface TopActivityListProps {
  title: string;
  subtitle: string;
  partners: TopActivityPartner[];
  /** "in" for clients (cash incoming), "out" for suppliers (cash outgoing). */
  flow: "in" | "out";
  emptyMessage: string;
}

export function TopActivityList({
  title,
  subtitle,
  partners,
  flow,
  emptyMessage,
}: TopActivityListProps) {
  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <div className="mb-4">
        <h3
          className="text-[16px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {title}
        </h3>
        <p
          className="mt-1 text-[12px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          {subtitle}
        </p>
      </div>

      {partners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-dark-3 bg-dark-3/20 p-6 text-center">
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {emptyMessage}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {partners.map((p, idx) => (
            <Row key={p.cont} partner={p} flow={flow} rank={idx + 1} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  partner,
  flow,
  rank,
}: {
  partner: TopActivityPartner;
  flow: "in" | "out";
  rank: number;
}) {
  const barColor = flow === "in" ? "bg-green" : "bg-danger";
  const textColor = flow === "in" ? "text-green" : "text-danger";

  return (
    <li className="grid grid-cols-[24px_1fr_140px] items-center gap-3 rounded-lg border border-dark-3/60 bg-dark-3/30 px-3 py-2.5">
      <span
        className="font-mono text-[10px] uppercase text-gray text-center"
        style={{ letterSpacing: "0.04em" }}
      >
        {rank}
      </span>
      <div className="min-w-0">
        <div
          className="text-[13px] text-white truncate"
          style={{ letterSpacing: "-0.02em" }}
        >
          {partner.partnerName}
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-dark-3 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-500`}
            style={{ width: `${Math.max(2, partner.percent)}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <div
          className={`font-mono text-[14px] font-semibold tabular-nums ${textColor}`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {flow === "in" ? "+" : "−"}{lei(partner.amount)}
        </div>
        <div
          className="font-mono text-[10px] text-gray mt-0.5"
          style={{ letterSpacing: "0.04em" }}
        >
          {partner.percent.toFixed(0)}% din total
        </div>
      </div>
    </li>
  );
}
