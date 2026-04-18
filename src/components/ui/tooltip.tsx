"use client";

import { useEffect, useId, useRef, useState } from "react";

interface TooltipProps {
  /**
   * Element that triggers the tooltip on hover/focus. Must be a single
   * focusable or hoverable node.
   */
  children: React.ReactNode;
  /** Tooltip content. Plain text or JSX. */
  content: React.ReactNode;
  /** Preferred side. Defaults to "top". Falls back automatically if it won't fit. */
  side?: "top" | "bottom";
  /** Delay before showing on hover, in ms. Defaults to 100. */
  delay?: number;
  /** Optional className forwarded to the wrapper span. */
  className?: string;
}

/**
 * Minimal accessible tooltip.
 *
 * Design:
 *   - rounded-lg border border-dark-3 bg-dark-2
 *   - font-mono text-[11px] text-gray-light
 *   - max-width 280px, multiline supported
 *   - shows on hover + focus, hides on blur/escape
 *   - no dependencies, no portal — positioned via CSS within the wrapper
 */
export function Tooltip({
  children,
  content,
  side = "top",
  delay = 100,
  className = "",
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-[280px] -translate-x-1/2 rounded-lg border border-dark-3 bg-dark-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-light shadow-xl shadow-black/40 transition-opacity duration-150 ${
          side === "top" ? "bottom-full mb-2" : "top-full mt-2"
        } ${open ? "opacity-100" : "opacity-0"}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {content}
      </span>
    </span>
  );
}
