/**
 * C1 — KPI card for the owner view.
 *
 * Differences from the accountant KPI card:
 *  - Label in plain Romanian ("Bani in casa si banca", not "5121+5124+5311+5314")
 *  - Value in "lei" not "RON"
 *  - Optional helper text below (e.g. "in crestere fata de luna trecuta")
 *  - Optional sparkline for trends (last N months)
 *  - Tone changes only the value color, never the background — keep UI calm
 */

import type { ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative" | "warning";

const TONE_VALUE_CLASS: Record<Tone, string> = {
  neutral: "text-white",
  positive: "text-green",
  negative: "text-danger",
  warning: "text-warn",
};

interface KpiCardProps {
  label: string;
  value: string;
  /** Small helper line below the value. Keep under ~50 chars. */
  helper?: string;
  /** Tone affects ONLY the value color. Background stays neutral. */
  tone?: Tone;
  /** Sparkline points (e.g. last 6 months of cashEnd). Drawn as a thin teal line. */
  sparkline?: number[];
  /** Optional icon shown top-right, muted. */
  icon?: ReactNode;
}

export function KpiCard({
  label,
  value,
  helper,
  tone = "neutral",
  sparkline,
  icon,
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex items-start justify-between">
        <span
          className="font-mono text-[11px] font-medium uppercase text-gray"
          style={{ letterSpacing: "-0.04em" }}
        >
          {label}
        </span>
        {icon && <span className="text-gray opacity-60">{icon}</span>}
      </div>

      <div className="flex items-end justify-between gap-3">
        <span
          className={`font-mono text-[28px] font-semibold leading-none ${TONE_VALUE_CLASS[tone]}`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {value}
        </span>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline points={sparkline} tone={tone} />
        )}
      </div>

      {helper && (
        <p className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          {helper}
        </p>
      )}
    </div>
  );
}

function Sparkline({ points, tone }: { points: number[]; tone: Tone }) {
  const w = 80;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);

  const path = points
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke =
    tone === "negative"
      ? "var(--color-danger)"
      : tone === "warning"
        ? "var(--color-warn)"
        : "var(--color-primary)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="shrink-0 opacity-70"
      aria-hidden
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
