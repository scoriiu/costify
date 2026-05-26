"use client";

/**
 * HealthPulse — three "vital signs" of the firm rendered as concentric ring
 * gauges, like the rings on an Apple Watch. At a glance the antreprenor
 * sees:
 *
 *   1. Cati bani iti ajung (runway)         — primary teal
 *   2. Cate salarii poti plati (salary)     — accent indigo
 *   3. Marja operationala (profitability)   — pos green / neg red
 *
 * The rings are scaled to a "healthy" target (6+ months runway, 3+ months
 * salary, 15%+ margin). A fully-filled ring = healthy; a thin slice = under
 * pressure. Color tone follows the value.
 *
 * Each ring is interactive: hover swaps the central readout to that metric;
 * default state shows the most concerning one ("focus naturally on the
 * weakest vital").
 */

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type {
  RunwayProjection,
  SalaryAffordability,
} from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

interface HealthPulseProps {
  runway: RunwayProjection;
  salary: SalaryAffordability;
  /** Operating margin in percent (0..100). Null = not yet computable
   *  (no revenue this month). */
  margin: number | null;
}

interface Vital {
  key: "runway" | "salary" | "margin";
  label: string;
  /** Headline string: "8 luni", "85%", etc. */
  headline: string;
  /** Sub-label: one-sentence story. */
  story: string;
  /** Normalized progress 0..1 against a "healthy" target. */
  progress: number;
  /** Color tone for the ring. */
  tone: "pos" | "warn" | "neg" | "muted";
  /** Numeric "health score" 0..100 used to rank vitals so the most
   *  concerning is shown first by default. */
  healthScore: number;
}

export function HealthPulse({ runway, salary, margin }: HealthPulseProps) {
  const vitals = useMemo<Vital[]>(
    () => buildVitals(runway, salary, margin),
    [runway, salary, margin]
  );

  // Default focus = the vital with the lowest health score (worst).
  // The user can hover any ring to swap focus.
  const defaultFocus = useMemo(() => {
    if (vitals.length === 0) return null;
    return vitals.reduce((worst, v) => (v.healthScore < worst.healthScore ? v : worst), vitals[0]);
  }, [vitals]);

  const [focus, setFocus] = useState<Vital | null>(null);
  const active = focus ?? defaultFocus;

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-3">
        <h3
          className="text-[16px] font-semibold text-white inline-flex items-center gap-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          <Activity size={15} className="text-primary" />
          Sanatatea firmei
        </h3>
        <p
          className="mt-0.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Trei semnale care iti spun cat de stabila e firma. Cu cat inelul e mai
          plin, cu atat semnalul e mai bun.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 px-5 py-6">
        <div className="relative shrink-0">
          <ConcentricRings
            vitals={vitals}
            activeKey={active?.key ?? null}
            onHoverKey={(key) =>
              setFocus(key ? vitals.find((v) => v.key === key) ?? null : null)
            }
          />
          {active && <CenterReadout vital={active} />}
        </div>

        <ul className="flex-1 w-full space-y-3">
          {vitals.map((v) => (
            <VitalRow
              key={v.key}
              vital={v}
              isActive={active?.key === v.key}
              onHover={() => setFocus(v)}
              onLeave={() => setFocus(null)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* --------------------------------- Rings --------------------------------- */

const RING_RADII = { outer: 96, middle: 76, inner: 56 } as const;
const RING_STROKE = 12;

function ConcentricRings({
  vitals,
  activeKey,
  onHoverKey,
}: {
  vitals: Vital[];
  activeKey: Vital["key"] | null;
  onHoverKey: (key: Vital["key"] | null) => void;
}) {
  const radiusByIdx = [RING_RADII.outer, RING_RADII.middle, RING_RADII.inner];
  const size = (RING_RADII.outer + RING_STROKE) * 2 + 8;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Inele de sanatate ale firmei"
    >
      {vitals.map((v, i) => {
        const r = radiusByIdx[i] ?? RING_RADII.inner;
        const circumference = 2 * Math.PI * r;
        const dash = circumference * Math.min(1, Math.max(0, v.progress));
        const gap = circumference - dash;
        const stroke = toneStroke(v.tone);
        const trackOpacity = activeKey && activeKey !== v.key ? 0.35 : 0.8;
        const isActive = activeKey === v.key;
        return (
          <g
            key={v.key}
            onMouseEnter={() => onHoverKey(v.key)}
            onMouseLeave={() => onHoverKey(null)}
            style={{ cursor: "pointer" }}
          >
            {/* Track */}
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="var(--color-dark-3)"
              strokeWidth={RING_STROKE}
              opacity={trackOpacity}
            />
            {/* Progress arc */}
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={stroke}
              strokeWidth={RING_STROKE + (isActive ? 2 : 0)}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={circumference / 4}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: "stroke-width 150ms ease-out" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CenterReadout({ vital }: { vital: Vital }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
      <p
        className="font-mono text-[9px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "0.06em" }}
      >
        {vital.label}
      </p>
      <p
        className={`mt-1 font-mono text-[26px] font-semibold tabular-nums ${toneText(vital.tone)}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {vital.headline}
      </p>
    </div>
  );
}

function VitalRow({
  vital,
  isActive,
  onHover,
  onLeave,
}: {
  vital: Vital;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <li
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
        isActive ? "bg-dark-3/60" : "hover:bg-dark-3/30"
      }`}
    >
      <span
        className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: toneStroke(vital.tone) }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className="text-[13px] text-white font-medium"
            style={{ letterSpacing: "-0.02em" }}
          >
            {vital.label}
          </p>
          <p
            className={`font-mono text-[13px] font-semibold tabular-nums shrink-0 ${toneText(vital.tone)}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            {vital.headline}
          </p>
        </div>
        <p
          className="mt-0.5 text-[11px] text-gray-light leading-snug"
          style={{ letterSpacing: "-0.02em" }}
        >
          {vital.story}
        </p>
      </div>
    </li>
  );
}

/* --------------------------------- Logic --------------------------------- */

function buildVitals(
  runway: RunwayProjection,
  salary: SalaryAffordability,
  margin: number | null
): Vital[] {
  const out: Vital[] = [];

  // Runway: target = 6 months. >= 6 = pos, 3..6 = warn, <3 = neg.
  if (runway.status !== "unknown") {
    const months = runway.monthsRemaining;
    const target = 6;
    const progress = Math.min(1, months / target);
    let tone: Vital["tone"] = "pos";
    if (months < 3) tone = "neg";
    else if (months < 6) tone = "warn";
    out.push({
      key: "runway",
      label: "Cati bani iti ajung",
      headline: formatMonths(months),
      story:
        tone === "pos"
          ? "Ai rezerva confortabila chiar daca nu mai intra venituri."
          : tone === "warn"
            ? "Rezerva tine cateva luni, dar e bine sa veghezi cheltuielile."
            : "Atentie — rezerva e mica fata de cheltuieli.",
      progress,
      tone,
      healthScore: Math.min(100, (months / target) * 100),
    });
  } else {
    out.push({
      key: "runway",
      label: "Cati bani iti ajung",
      headline: "—",
      story: "Inca nu am suficient istoric pentru o estimare.",
      progress: 0,
      tone: "muted",
      healthScore: 100, // unknown shouldn't dominate the "worst" rank
    });
  }

  // Salary: target = 3 months covered. <1 = neg, 1..3 = warn, >=3 = pos.
  if (salary.status !== "no_payroll") {
    const months = salary.monthsCovered;
    const target = 3;
    const progress = Math.min(1, months / target);
    let tone: Vital["tone"] = "pos";
    if (months < 1) tone = "neg";
    else if (months < 3) tone = "warn";
    out.push({
      key: "salary",
      label: "Cate salarii poti plati",
      headline: formatMonths(months),
      story:
        tone === "pos"
          ? `Ai cash sa platesti salariile lunile urmatoare (${lei(salary.monthlyPayroll)} / luna).`
          : tone === "warn"
            ? `Salariile lunii sunt acoperite, dar marja e mica.`
            : `Cash-ul nu acopera salariile lunii viitoare la ritmul actual.`,
      progress,
      tone,
      healthScore: Math.min(100, (months / target) * 100),
    });
  } else {
    out.push({
      key: "salary",
      label: "Salarii",
      headline: "—",
      story: "Firma nu are salarii inregistrate luna aceasta.",
      progress: 0,
      tone: "muted",
      healthScore: 100,
    });
  }

  // Margin: target = 15%. Negative = neg, 0..10 = warn, 10..15 = warn, 15+ = pos.
  if (margin !== null) {
    const target = 15;
    const progress = margin <= 0 ? 0 : Math.min(1, margin / target);
    let tone: Vital["tone"] = "pos";
    if (margin < 0) tone = "neg";
    else if (margin < 10) tone = "warn";
    out.push({
      key: "margin",
      label: "Marja operationala",
      headline: `${margin.toFixed(1)}%`,
      story:
        tone === "pos"
          ? "Din fiecare leu vandut, ramane suficient pentru a creste firma."
          : tone === "warn"
            ? "Marja e moderata — ramane putin dupa cheltuielile lunii."
            : "Cheltuielile au depasit veniturile luna asta.",
      progress,
      tone,
      healthScore: margin <= 0 ? 0 : Math.min(100, (margin / target) * 100),
    });
  } else {
    out.push({
      key: "margin",
      label: "Marja operationala",
      headline: "—",
      story: "Marja se calculeaza din venituri vs cheltuieli; nu am inca cifre suficiente.",
      progress: 0,
      tone: "muted",
      healthScore: 100,
    });
  }

  return out;
}

function formatMonths(months: number): string {
  if (!Number.isFinite(months) || months > 999) return "peste 999 luni";
  if (months >= 1) {
    const whole = Math.floor(months);
    if (whole === months) return `${whole} ${whole === 1 ? "luna" : "luni"}`;
    return `${months.toFixed(1)} luni`;
  }
  const weeks = Math.round(months * 4.3);
  return `${weeks} sapt`;
}

function toneStroke(tone: Vital["tone"]): string {
  switch (tone) {
    case "pos":
      return "var(--color-pos)";
    case "warn":
      return "var(--color-tone-warn)";
    case "neg":
      return "var(--color-neg)";
    default:
      return "var(--color-gray)";
  }
}

function toneText(tone: Vital["tone"]): string {
  switch (tone) {
    case "pos":
      return "text-pos";
    case "warn":
      return "text-tone-warn";
    case "neg":
      return "text-neg";
    default:
      return "text-gray-light";
  }
}
