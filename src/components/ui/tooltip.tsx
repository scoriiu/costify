"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  /** Preferred side. Defaults to "top". */
  side?: "top" | "bottom";
  /** Delay before showing on hover, in ms. Defaults to 100. */
  delay?: number;
  /** Extra classes on the trigger wrapper. */
  className?: string;
  /** When the trigger wraps block-level content (e.g. a row, a card), pass
   *  `block` here so the wrapper expands to fit its child. Default is
   *  `inline-flex`, which works for icons and short text. */
  display?: "inline-flex" | "block";
}

/**
 * Accessible tooltip. Portals the content to document.body so it's never
 * clipped by parent `overflow-hidden` / `overflow-auto` containers.
 *
 * Design:
 *   - rounded-lg border border-dark-3 bg-dark-2
 *   - font-mono text-[11px] text-gray-light
 *   - max-width 280px
 *   - shows on hover + focus, hides on blur/escape
 */
export function Tooltip({
  children,
  content,
  side = "top",
  delay = 100,
  className = "",
  display = "inline-flex",
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  function computeCoords() {
    const el = triggerRef.current;
    if (!el) return;
    // The tooltip is `position: fixed`, so coordinates are viewport-relative.
    // getBoundingClientRect() is ALSO viewport-relative — adding window.scrollY
    // would double-count the scroll offset and push the tooltip to the bottom
    // of the page on any scrolled view.
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    // Keep a comfortable gap so the bubble never sits stuck to the trigger.
    const GAP = 8;
    if (side === "top") {
      setCoords({ top: rect.top - GAP, left: centerX });
    } else {
      setCoords({ top: rect.bottom + GAP, left: centerX });
    }
  }

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      computeCoords();
      setOpen(true);
    }, delay);
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
    function onScroll() {
      computeCoords();
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className={`${display} ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>

      {mounted && open && coords && createPortal(
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none fixed z-[9999] w-max max-w-[280px] -translate-x-1/2 rounded-md border border-dark-3 bg-dark-2 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-gray-light shadow-lg shadow-black/40 ${
            side === "top" ? "-translate-y-full" : ""
          }`}
          style={{
            top: coords.top,
            left: coords.left,
            letterSpacing: "-0.02em",
          }}
        >
          {content}
        </span>,
        document.body
      )}
    </>
  );
}
