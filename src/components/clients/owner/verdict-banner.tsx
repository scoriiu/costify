/**
 * VerdictBanner — §6 "Pe scurt".
 *
 * The single most important UI element in the owner dashboard: a one-paragraph
 * verdict the entrepreneur can read in 5 seconds and walk away with a clear
 * sense of how the firm is doing.
 *
 * Deterministic. Built from snapshot.verdict on the server side; no client
 * personalization. Tone color carries the signal: green/warm/red.
 */

import type { Verdict } from "@/modules/reporting/owner";

const TONE_STYLES: Record<
  Verdict["tone"],
  { ring: string; chip: string; chipText: string; icon: string; iconWrap: string }
> = {
  positive: {
    ring: "border-green/30 bg-green/[0.06]",
    chip: "bg-green/15 text-green",
    chipText: "text-green",
    icon: "Bun",
    iconWrap: "bg-green/15 text-green",
  },
  neutral: {
    ring: "border-blue/30 bg-blue/[0.05]",
    chip: "bg-blue/15 text-blue",
    chipText: "text-blue",
    icon: "OK",
    iconWrap: "bg-blue/15 text-blue",
  },
  warning: {
    ring: "border-warn/30 bg-warn/[0.06]",
    chip: "bg-warn/15 text-warn",
    chipText: "text-warn",
    icon: "Atentie",
    iconWrap: "bg-warn/15 text-warn",
  },
  negative: {
    ring: "border-danger/30 bg-danger/[0.06]",
    chip: "bg-danger/15 text-danger",
    chipText: "text-danger",
    icon: "Alerta",
    iconWrap: "bg-danger/15 text-danger",
  },
};

interface VerdictBannerProps {
  verdict: Verdict;
}

export function VerdictBanner({ verdict }: VerdictBannerProps) {
  const styles = TONE_STYLES[verdict.tone];

  return (
    <div className={`rounded-2xl border ${styles.ring} p-6 sm:p-7`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div
          className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 font-mono text-[10px] font-semibold uppercase ${styles.iconWrap}`}
          style={{ letterSpacing: "0.08em" }}
        >
          {styles.icon}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <h2
            className="text-[20px] sm:text-[22px] font-semibold text-white leading-tight"
            style={{ letterSpacing: "-0.04em" }}
          >
            {verdict.headline}
          </h2>
          <p
            className="text-[14px] text-gray-light leading-relaxed"
            style={{ letterSpacing: "-0.02em" }}
          >
            {verdict.body}
          </p>
          {verdict.highlights.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {verdict.highlights.map((h, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-medium ${styles.chip}`}
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
