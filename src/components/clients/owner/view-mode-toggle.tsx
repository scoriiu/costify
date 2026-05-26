"use client";

/**
 * ViewModeToggle — L1/L2 (Simplu/Detaliat) global mode switch.
 *
 * Instant client-side toggle via ViewModeContext. No server roundtrip — the
 * URL is updated in place via history.replaceState so deep links keep
 * working without triggering a Next router navigation.
 */

import { useViewMode, type ViewMode } from "./view-mode-context";

export type { ViewMode };

export function ViewModeToggle() {
  const { mode, setMode } = useViewMode();
  return (
    <div
      className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-dark-3 bg-dark-2 p-1"
      role="group"
      aria-label="Mod de afisare"
    >
      <Pill active={mode === "simple"} onClick={() => setMode("simple")}>
        Simplu
      </Pill>
      <Pill active={mode === "detailed"} onClick={() => setMode("detailed")}>
        Detaliat
      </Pill>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center justify-center rounded-md px-3 font-mono text-[11px] font-semibold transition-colors ${
        active ? "bg-primary text-[#E9E8E3]" : "text-gray-light hover:text-white"
      }`}
      style={{ letterSpacing: "-0.02em" }}
    >
      {children}
    </button>
  );
}
