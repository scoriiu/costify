/**
 * C7 — Insights List
 *
 * Semantic-colored sentences that explain "ce ar trebui sa stii / ce ar trebui sa faci".
 * Generated deterministically from FinancialSummary + CashPosition + Kpis.
 * Limit to ~6 to avoid overwhelming.
 */

import type { Insight } from "@/modules/reporting/owner";
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface InsightsListProps {
  insights: Insight[];
}

const TYPE_CONFIG = {
  positive: {
    icon: CheckCircle2,
    iconColor: "text-green",
    borderColor: "border-green/20",
    bgColor: "bg-green/[0.05]",
  },
  negative: {
    icon: AlertCircle,
    iconColor: "text-danger",
    borderColor: "border-danger/20",
    bgColor: "bg-danger/[0.05]",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-warn",
    borderColor: "border-warn/20",
    bgColor: "bg-warn/[0.05]",
  },
  info: {
    icon: Info,
    iconColor: "text-blue",
    borderColor: "border-blue/20",
    bgColor: "bg-blue/[0.05]",
  },
} as const;

export function InsightsList({ insights }: InsightsListProps) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Ce ar trebui sa stii
        </h3>
        <p className="mt-0.5 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Lucruri importante pe care le-am observat in datele firmei
        </p>
      </div>

      <div className="p-3 space-y-2">
        {insights.map((insight, i) => (
          <InsightItem key={i} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightItem({ insight }: { insight: Insight }) {
  const config = TYPE_CONFIG[insight.type];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3.5`}>
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${config.iconColor} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white mb-0.5" style={{ letterSpacing: "-0.02em" }}>
            {insight.title}
          </p>
          <p className="text-[12px] text-gray-light leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
            {insight.message}
          </p>
          {insight.action && (
            <p className={`mt-1.5 text-[11px] font-medium ${config.iconColor}`} style={{ letterSpacing: "-0.02em" }}>
              → {insight.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
