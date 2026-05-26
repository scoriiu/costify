"use client";

/**
 * PeriodSelector — header control that switches between published periods.
 *
 * Renders the current period as a compact pill with a chevron. Clicking opens
 * a popover with the full list of published periods grouped by year. Selecting
 * a period updates the URL search params (`year=YYYY&month=M`) so the server
 * re-renders against that snapshot.
 *
 * Designed for both:
 *   - /firma?firm=...&year=2026&month=4
 *   - /clients/[slug]?view=owner&year=2026&month=4
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";

const MONTH_NAMES = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const MONTH_NAMES_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

export interface PeriodOption {
  year: number;
  month: number;
  /** When true, this period was selected by default (latest). */
  isLatest?: boolean;
}

interface PeriodSelectorProps {
  currentYear: number;
  currentMonth: number;
  options: PeriodOption[];
}

export function PeriodSelector({
  currentYear,
  currentMonth,
  options,
}: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function selectPeriod(year: number, month: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("month", String(month));
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  // Group by year, desc
  const grouped = new Map<number, PeriodOption[]>();
  for (const p of options) {
    const list = grouped.get(p.year) ?? [];
    list.push(p);
    grouped.set(p.year, list);
  }
  const years = Array.from(grouped.keys()).sort((a, b) => b - a);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-dark-3 bg-dark-2 px-3.5 py-2 font-mono text-[12px] font-semibold text-white transition-colors hover:border-primary/40 hover:bg-dark-3/40"
        style={{ letterSpacing: "-0.02em" }}
      >
        <span
          className="font-mono text-[10px] uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Perioada
        </span>
        <span className="text-white">
          {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </span>
        <ChevronDown
          size={12}
          className={`text-gray transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-dark-3 bg-dark-2 shadow-2xl">
          <div className="border-b border-dark-3 px-4 py-2.5">
            <span
              className="font-mono text-[10px] uppercase text-gray"
              style={{ letterSpacing: "0.08em" }}
            >
              Perioade publicate
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {years.length === 0 && (
              <p
                className="px-3 py-4 text-center text-[12px] text-gray-light"
                style={{ letterSpacing: "-0.02em" }}
              >
                Nicio luna publicata.
              </p>
            )}
            {years.map((year) => (
              <div key={year} className="mb-2 last:mb-0">
                <div
                  className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase text-gray"
                  style={{ letterSpacing: "0.08em" }}
                >
                  {year}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(grouped.get(year) ?? []).map((p) => {
                    const isCurrent = p.year === currentYear && p.month === currentMonth;
                    return (
                      <button
                        key={`${p.year}-${p.month}`}
                        onClick={() => selectPeriod(p.year, p.month)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-md px-2 py-2 font-mono text-[11px] transition-colors ${
                          isCurrent
                            ? "bg-primary/15 text-primary"
                            : "text-gray-light hover:bg-dark-3/60 hover:text-white"
                        }`}
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        <span className="font-semibold">{MONTH_NAMES_SHORT[p.month - 1]}</span>
                        {isCurrent && <Check size={10} className="absolute right-1 top-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
