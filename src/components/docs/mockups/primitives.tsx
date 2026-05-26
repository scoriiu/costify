/**
 * Visual primitives shared across the documentation mockups. These are NOT
 * the real app components — they are pixel-close simulations so the docs
 * render previews that feel identical to the live UI without dragging in
 * the real data layer.
 *
 * Keep them simple: presentation only, no behaviour, no state.
 */

import type { ReactNode } from "react";

export function MockSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-dark-3 bg-dark-2 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function MockSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4
      className="font-mono text-[10px] font-medium uppercase text-gray mb-3"
      style={{ letterSpacing: "-0.04em" }}
    >
      {children}
    </h4>
  );
}

export function MockBar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "danger" | "muted" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bg =
    tone === "danger" ? "bg-danger/70" : tone === "muted" ? "bg-gray/40" : "bg-primary/70";
  return (
    <div className="h-1.5 w-full rounded-full bg-dark-3 overflow-hidden">
      <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MockBigNumber({ value, tone = "neutral" }: { value: string; tone?: "neutral" | "positive" | "negative" }) {
  const c =
    tone === "positive" ? "text-green" : tone === "negative" ? "text-danger" : "text-white";
  return (
    <span
      className={`font-mono text-[24px] font-semibold leading-none ${c}`}
      style={{ letterSpacing: "-0.04em" }}
    >
      {value}
    </span>
  );
}

export function MockLabelMono({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono text-[10px] font-medium uppercase text-gray"
      style={{ letterSpacing: "-0.04em" }}
    >
      {children}
    </span>
  );
}

export function MockKpiCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}) {
  const tones = {
    neutral: "text-white",
    positive: "text-green",
    negative: "text-danger",
    warning: "text-warn",
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dark-3 bg-dark-2 p-4">
      <MockLabelMono>{label}</MockLabelMono>
      <span
        className={`font-mono text-[20px] font-semibold leading-none ${tones[tone]}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {value}
      </span>
      {helper && (
        <span className="text-[11px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          {helper}
        </span>
      )}
    </div>
  );
}

export function MockBreakdownRow({
  label,
  amount,
  bar,
  pct,
  indent = false,
  bold = false,
}: {
  label: string;
  amount: string;
  bar?: { value: number; max: number };
  pct?: string;
  indent?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-1.5 ${indent ? "pl-5 text-[12px]" : "text-[13px]"}`}
    >
      <div className={`flex-1 min-w-0 ${bold ? "text-white font-medium" : "text-gray-light"}`} style={{ letterSpacing: "-0.02em" }}>
        {indent && <span className="text-gray mr-1">›</span>}
        {label}
      </div>
      <div className="flex-1 max-w-[180px]">
        {bar && <MockBar value={bar.value} max={bar.max} />}
      </div>
      <div
        className={`w-24 text-right font-mono tabular-nums ${bold ? "text-white" : "text-gray-light"}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {amount}
      </div>
      {pct && (
        <div className="w-10 text-right font-mono text-[11px] text-gray">{pct}</div>
      )}
    </div>
  );
}

export function MockBanner({ tone = "info", children }: { tone?: "info" | "success" | "warn"; children: ReactNode }) {
  const cls =
    tone === "success"
      ? "border-green/30 bg-green/5"
      : tone === "warn"
        ? "border-warn/30 bg-warn/5"
        : "border-primary/30 bg-primary/5";
  return (
    <div className={`rounded-lg border ${cls} p-3 text-[12px] text-gray-light`} style={{ letterSpacing: "-0.02em" }}>
      {children}
    </div>
  );
}
