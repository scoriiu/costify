"use client";

/**
 * InsightsList — "Ce ar trebui sa stii" feed.
 *
 * Glanceable signal cards: each insight is fully visible (no accordion),
 * arranged in a responsive 1/2 column grid. Cards are color-coded by tone
 * (positive/warning/negative/info), with a soft corner gradient + icon to
 * make each one feel like its own little story instead of a row in a list.
 *
 * Each card has a primary action — "Intreaba Costi" — that opens the
 * floating Costi assistant pre-filled with a contextual question built
 * from the insight's title + message. Costi is woven directly into the
 * dashboard so the owner never has to leave the page to understand a
 * signal in depth.
 */
 
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Insight } from "@/modules/reporting/owner";
import { CostiMascot } from "@/components/costi/costi-mascot";

interface InsightsListProps {
  insights: Insight[];
}

type Tone = Insight["type"];

interface ToneConfig {
  icon: LucideIcon;
  /** Solid text color for the icon + accent. */
  textClass: string;
  /** Background tint for the corner halo. */
  haloClass: string;
  /** Border color of the card. */
  borderClass: string;
  /** Background gradient overlay (full card). */
  gradientFrom: string;
  /** Romanian short label used in the chip strip. */
  chipLabel: string;
}

const TONE: Record<Tone, ToneConfig> = {
  positive: {
    icon: CheckCircle2,
    textClass: "text-pos",
    haloClass: "bg-pos/15",
    borderClass: "border-pos/40",
    gradientFrom: "from-pos/[0.07]",
    chipLabel: "Bine",
  },
  negative: {
    icon: AlertCircle,
    textClass: "text-neg",
    haloClass: "bg-neg/15",
    borderClass: "border-neg/40",
    gradientFrom: "from-neg/[0.07]",
    chipLabel: "Atentie",
  },
  warning: {
    icon: AlertTriangle,
    textClass: "text-tone-warn",
    haloClass: "bg-tone-warn/15",
    borderClass: "border-tone-warn/40",
    gradientFrom: "from-tone-warn/[0.07]",
    chipLabel: "Avertizare",
  },
  info: {
    icon: Info,
    textClass: "text-blue",
    haloClass: "bg-blue/15",
    borderClass: "border-blue/40",
    gradientFrom: "from-blue/[0.07]",
    chipLabel: "Info",
  },
};

const TONE_ORDER: Tone[] = ["positive", "warning", "negative", "info"];

export function InsightsList({ insights }: InsightsListProps) {
  if (insights.length === 0) return null;

  // Stable insight ordering: keep the producer's order but expose counts
  // per tone in the header chip strip so the owner sees the shape of
  // the month at a glance ("3 bune, 1 atentie") before reading any card.
  const counts: Record<Tone, number> = {
    positive: 0,
    warning: 0,
    negative: 0,
    info: 0,
  };
  for (const i of insights) counts[i.type] += 1;

  return (
    <section className="rounded-2xl border border-dark-3 bg-dark-2 overflow-hidden">
      <Header counts={counts} total={insights.length} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 sm:p-5">
        {insights.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>
    </section>
  );
}

function Header({
  counts,
  total,
}: {
  counts: Record<Tone, number>;
  total: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 border-b border-dark-3 bg-gradient-to-br from-primary/[0.04] to-transparent">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-md" aria-hidden />
          <div className="relative h-11 w-11 rounded-full bg-dark-3 ring-1 ring-primary/30 overflow-hidden flex items-center justify-center">
            <CostiMascot state="teaching" mode="head" size={44} surface="dark" />
          </div>
        </div>
        <div className="min-w-0">
          <h3
            className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Ce ar trebui sa stii
            <span
              className="font-mono text-[10px] font-medium uppercase tracking-wider text-gray bg-dark-3 rounded-md px-1.5 py-0.5"
              style={{ letterSpacing: "0.05em" }}
            >
              {total} semnale
            </span>
          </h3>
          <p
            className="mt-0.5 text-[12px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Costi observa lunar ce e important. Apasa{" "}
            <span className="text-primary font-semibold">Intreaba Costi</span>{" "}
            pe orice card ca sa-i ceri detalii.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {TONE_ORDER.map((tone) => {
          const n = counts[tone];
          if (n === 0) return null;
          const cfg = TONE[tone];
          return (
            <span
              key={tone}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${cfg.haloClass} ${cfg.textClass}`}
              style={{ letterSpacing: "0.04em" }}
            >
              <span className="font-semibold text-[11px]">{n}</span>
              <span>{cfg.chipLabel}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function buildCostiPrompt(insight: Insight): string {
  const action = insight.action ? ` Recomandarea de pe card: ${insight.action}` : "";
  return `Despre semnalul "${insight.title}": ${insight.message}${action}\n\nSpune-mi mai mult — ce inseamna asta pentru firma mea si ce ar trebui sa fac concret?`;
}

function askCosti(insight: Insight) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("costify:ask-costi", {
      detail: { question: buildCostiPrompt(insight) },
    })
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = TONE[insight.type];
  const Icon = cfg.icon;
  return (
    <article
      className={`group relative overflow-hidden rounded-xl border ${cfg.borderClass} bg-dark/40 transition-all hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cfg.gradientFrom} to-transparent opacity-80`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full ${cfg.haloClass} blur-xl opacity-70`}
        aria-hidden
      />
      <div className="relative p-4 sm:p-5 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg ${cfg.haloClass}`}
          >
            <Icon size={18} className={cfg.textClass} />
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className="text-[14px] font-semibold text-white leading-tight"
              style={{ letterSpacing: "-0.03em" }}
            >
              {insight.title}
            </h4>
            <p
              className="mt-1.5 text-[12.5px] text-gray-light leading-relaxed"
              style={{ letterSpacing: "-0.02em" }}
            >
              {insight.message}
            </p>
            {insight.action && (
              <p
                className={`mt-2 text-[11.5px] font-medium ${cfg.textClass} inline-flex items-start gap-1.5`}
                style={{ letterSpacing: "-0.02em" }}
              >
                <span aria-hidden>→</span>
                <span>{insight.action}</span>
              </p>
            )}
          </div>
        </div>
        <div className="mt-auto flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => askCosti(insight)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/[0.08] px-2.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-primary-light transition-colors hover:bg-primary/[0.16] hover:text-white"
            style={{ letterSpacing: "0.05em" }}
            aria-label={`Intreaba Costi despre: ${insight.title}`}
          >
            <Sparkles size={12} />
            Intreaba Costi
          </button>
        </div>
      </div>
    </article>
  );
}
