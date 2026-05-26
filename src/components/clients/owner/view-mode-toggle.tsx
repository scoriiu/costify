"use client";

/**
 * ViewModeToggle — L1/L2 (Simplu/Detaliat) global mode switch.
 *
 * Updates the URL search param `mode` (default = "simple"). When `detailed`,
 * the OwnerView renders all power-user sections (ratios catalog, expanded
 * detail breakdowns). When `simple`, those are collapsed/hidden.
 *
 * The actual content gating happens server-side in OwnerView via the
 * `mode` prop derived from URL.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type ViewMode = "simple" | "detailed";

interface ViewModeToggleProps {
  mode: ViewMode;
}

export function ViewModeToggle({ mode }: ViewModeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setMode(next: ViewMode) {
    if (next === mode) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "simple") {
      params.delete("mode");
    } else {
      params.set("mode", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

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
      onClick={onClick}
      className={`inline-flex h-7 items-center justify-center rounded-md px-3 font-mono text-[11px] font-semibold transition-colors ${
        active ? "bg-primary text-[#E9E8E3]" : "text-gray-light hover:text-white"
      }`}
      style={{ letterSpacing: "-0.02em" }}
    >
      {children}
    </button>
  );
}
