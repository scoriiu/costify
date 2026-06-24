"use client";

/**
 * Period-scope control for a mapping edit (ADR-0004 D10).
 *
 * Lets the accountant choose whether a reclassification applies to all periods
 * (the default, identical to pre-period behaviour), from the viewed month
 * onward, or only for the viewed month. Renders nothing fancy: three compact
 * pills, calm by default. When `period` is null (no data) it stays on "toate".
 */

import { periodKey, type MappingPeriodScope } from "@/lib/period";

const MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

type ScopeKind = MappingPeriodScope["kind"];

export function scopeFromKind(
  kind: ScopeKind,
  period: { year: number; month: number } | null
): MappingPeriodScope {
  if (kind === "all" || !period) return { kind: "all" };
  const key = periodKey(period.year, period.month);
  if (kind === "from") return { kind: "from", from: key };
  return { kind: "only", from: key, to: key };
}

export function PeriodScopeControl({
  value,
  onChange,
  period,
}: {
  value: ScopeKind;
  onChange: (kind: ScopeKind) => void;
  period: { year: number; month: number } | null;
}) {
  if (!period) return null;
  const ml = monthLabel(period.year, period.month);
  const options: { kind: ScopeKind; label: string }[] = [
    { kind: "all", label: "Toate perioadele" },
    { kind: "from", label: `Din ${ml} inainte` },
    { kind: "only", label: `Doar ${ml}` },
  ];

  return (
    <div className="space-y-1">
      <div
        className="font-mono text-[10px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Aplica pentru
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = value === opt.kind;
          return (
            <button
              key={opt.kind}
              type="button"
              onClick={() => onChange(opt.kind)}
              aria-pressed={active}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                active
                  ? "bg-primary text-[#E9E8E3]"
                  : "bg-dark-3 text-gray hover:text-white"
              }`}
              style={{ letterSpacing: "-0.02em" }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
