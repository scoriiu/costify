/**
 * TrustBadge — small inline indicator on the /firma header showing the
 * antreprenor that the numbers they're looking at come from data the
 * contabil has actively reviewed and mapped, not raw unreviewed bank
 * statements.
 *
 * Sprint 7 of the Mapari Cashflow rewrite. By design this is:
 *   - Small (mono 11px) — never competes for attention with KPIs.
 *   - Quiet color (gray, with a subtle dot in primary).
 *   - Hidden when there's nothing meaningful to claim (hasAnyReview=false)
 *     — a 0% coverage badge would actively damage trust.
 *   - Honest — surfaces the actual coverage percent, not a marketing
 *     number.
 *
 * The badge says nothing about Costify's mechanics (no mention of
 * categories, partner overrides, mapping logic). It speaks the
 * antreprenor's language: 'datele sunt revizuite manual'.
 */

import { ShieldCheck } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

interface Props {
  coveragePercent: number;
  partnerOverrideCount: number;
  hasAnyReview: boolean;
}

export function TrustBadge({
  coveragePercent,
  partnerOverrideCount,
  hasAnyReview,
}: Props) {
  if (!hasAnyReview) return null;

  const tooltipContent =
    partnerOverrideCount > 0
      ? `Contabilul a revizuit manual maparea cheltuielilor si veniturilor pe linii de cost intelese de antreprenor. ${coveragePercent}% din rulajul perioadei e mapat explicit, plus ${partnerOverrideCount} reguli pe parteneri specifici.`
      : `Contabilul a revizuit manual maparea cheltuielilor si veniturilor pe linii de cost intelese de antreprenor. ${coveragePercent}% din rulajul perioadei e mapat explicit.`;

  return (
    <Tooltip content={tooltipContent}>
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-dark-3 bg-dark-2 px-2.5 py-1 font-mono text-[11px] text-gray-light cursor-help"
        style={{ letterSpacing: "-0.02em" }}
      >
        <ShieldCheck size={11} className="text-primary" />
        <span>Date revizuite manual</span>
        <span className="text-gray">·</span>
        <span className="tabular-nums">acoperire {coveragePercent}%</span>
      </span>
    </Tooltip>
  );
}
