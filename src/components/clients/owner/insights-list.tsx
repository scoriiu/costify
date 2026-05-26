"use client";

/**
 * InsightsList — semantic-colored cards explaining "ce ar trebui sa stii".
 *
 * Each insight is an interactive card: the title + icon are always visible;
 * clicking it expands to show the message + action sentence. Default state
 * has the first 2 expanded so the user sees the most important context
 * without having to click; the rest collapse into a compact list.
 */

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import type { Insight } from "@/modules/reporting/owner";

interface InsightsListProps {
  insights: Insight[];
}

const TYPE_CONFIG = {
  positive: {
    icon: CheckCircle2,
    iconColor: "text-pos",
    borderColor: "border-pos/30",
    bgColor: "bg-pos/[0.06]",
    accentBg: "bg-pos/[0.1]",
  },
  negative: {
    icon: AlertCircle,
    iconColor: "text-neg",
    borderColor: "border-neg/30",
    bgColor: "bg-neg/[0.06]",
    accentBg: "bg-neg/[0.1]",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-tone-warn",
    borderColor: "border-tone-warn/30",
    bgColor: "bg-tone-warn/[0.06]",
    accentBg: "bg-tone-warn/[0.1]",
  },
  info: {
    icon: Info,
    iconColor: "text-blue",
    borderColor: "border-blue/30",
    bgColor: "bg-blue/[0.06]",
    accentBg: "bg-blue/[0.1]",
  },
} as const;

const DEFAULT_EXPANDED_COUNT = 2;

export function InsightsList({ insights }: InsightsListProps) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3
          className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          <Lightbulb size={15} className="text-primary" />
          Ce ar trebui sa stii
        </h3>
        <p
          className="mt-0.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Semnale importante observate in datele firmei. Click pe un card ca
          sa vezi detalii.
        </p>
      </div>

      <ul className="p-3 space-y-2">
        {insights.map((insight, i) => (
          <InsightItem
            key={i}
            insight={insight}
            defaultOpen={i < DEFAULT_EXPANDED_COUNT}
          />
        ))}
      </ul>
    </div>
  );
}

function InsightItem({
  insight,
  defaultOpen,
}: {
  insight: Insight;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const config = TYPE_CONFIG[insight.type];
  const Icon = config.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`w-full text-left rounded-lg border ${config.borderColor} ${config.bgColor} px-3.5 py-3 transition-colors hover:${config.accentBg} cursor-pointer`}
      >
        <div className="flex items-start gap-3">
          <Icon size={15} className={`${config.iconColor} mt-0.5 shrink-0`} />
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-semibold text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              {insight.title}
            </p>
            {open && (
              <>
                <p
                  className="mt-1.5 text-[12px] text-gray-light leading-relaxed"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {insight.message}
                </p>
                {insight.action && (
                  <p
                    className={`mt-2 text-[11px] font-medium ${config.iconColor}`}
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    → {insight.action}
                  </p>
                )}
              </>
            )}
          </div>
          <ChevronDown
            size={14}
            className={`text-gray shrink-0 mt-0.5 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>
      </button>
    </li>
  );
}
