"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  /** Placeholder when no value matches an option (or value is empty). */
  placeholder?: string;
}

/**
 * Shared combobox primitive used across the app. Single source of truth — any
 * UX improvement here lands everywhere (Mapari Cashflow, Setari, Plan Conturi,
 * Period Selector, etc.).
 *
 * Behaviour:
 *   - Click button to open the popover.
 *   - The popover is RENDERED INTO A PORTAL (document.body) and positioned
 *     with fixed coordinates from the trigger's getBoundingClientRect. This
 *     is critical: the popover otherwise gets clipped by any ancestor with
 *     overflow: hidden/auto/scroll — which kills it inside dialogs, slide-
 *     panels, virtualised tables, etc.
 *   - On open, the currently selected option scrolls into view and receives
 *     focus, so a long list (e.g. 50 categories) doesn't force the user to
 *     scroll manually to find their selection.
 *   - Arrow Up / Arrow Down navigate between options.
 *   - Enter activates the highlighted option.
 *   - Escape closes the popover.
 *   - Click outside closes the popover.
 *   - Tab moves focus naturally (does not trap focus inside the popover).
 *   - Scrolling the page (or any ancestor) closes the popover — better than
 *     letting it drift away from the trigger.
 */
export function Select({
  value,
  options,
  onChange,
  className = "",
  placeholder,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "below" | "above";
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Compute popover position from the trigger. Picks above-trigger when
  // there's not enough room below (e.g., a Select at the bottom of a tall
  // dialog).
  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const POPOVER_MAX_H = 288; // matches max-h-72
    const GAP = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement: "below" | "above" =
      spaceBelow >= POPOVER_MAX_H || spaceBelow >= spaceAbove
        ? "below"
        : "above";
    setPopoverPos({
      top:
        placement === "below"
          ? rect.bottom + GAP
          : rect.top - GAP - Math.min(POPOVER_MAX_H, spaceAbove - GAP),
      left: rect.left,
      width: rect.width,
      placement,
    });
  }, []);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel =
    options[selectedIndex]?.label ?? (placeholder ?? value);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    setPopoverPos(null);
  }, []);

  // Click outside -> close. The popover is portaled to body, so we have to
  // accept clicks on the popover itself by checking BOTH the trigger
  // container AND the list element.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inList = listRef.current?.contains(target);
      if (!inTrigger && !inList) close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  // Reposition on open AND close on any scroll/resize. A drifting popover
  // is worse than a closed one — the contabil would lose context anyway.
  useEffect(() => {
    if (!open) return;
    computePosition();
    function handleScroll() {
      close();
    }
    function handleResize() {
      computePosition();
    }
    // capture:true so we catch scroll events from any ancestor.
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, close, computePosition]);

  // When opening, seed activeIndex with the selected one (or first item) and
  // scroll+focus the matching option button so the user sees their current
  // selection without scrolling manually.
  useEffect(() => {
    if (!open) return;
    const target = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(target);
    // wait one frame so the popover is in the DOM
    const raf = requestAnimationFrame(() => {
      const el = optionRefs.current[target];
      if (el) {
        el.scrollIntoView({ block: "nearest" });
        el.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, selectedIndex]);

  // Keyboard handling at the document level — works regardless of which
  // element inside the popover is focused.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev < options.length - 1 ? prev + 1 : 0;
          optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
          optionRefs.current[next]?.focus({ preventScroll: true });
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev > 0 ? prev - 1 : options.length - 1;
          optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
          optionRefs.current[next]?.focus({ preventScroll: true });
          return next;
        });
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
        optionRefs.current[0]?.scrollIntoView({ block: "nearest" });
        optionRefs.current[0]?.focus({ preventScroll: true });
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        const last = options.length - 1;
        setActiveIndex(last);
        optionRefs.current[last]?.scrollIntoView({ block: "nearest" });
        optionRefs.current[last]?.focus({ preventScroll: true });
        return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, options.length, close]);

  function commit(optValue: string) {
    onChange(optValue);
    close();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={selectedLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[10px] border border-dark-3 bg-dark-2 px-4 font-mono text-sm text-white transition-colors hover:border-primary/40 focus:border-primary focus:outline-none"
      >
        <span className="truncate text-left flex-1 min-w-0">
          {selectedLabel}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        popoverPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            // Fixed positioning is ESSENTIAL — `absolute` would still be
            // clipped by any `overflow: hidden` body even after portal.
            // `min-width: 12rem` keeps very narrow triggers from rendering
            // a too-cramped dropdown.
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              minWidth: "12rem",
            }}
            className="z-[100] max-h-72 max-w-md overflow-y-auto rounded-xl border border-dark-3 bg-dark-2 py-1 shadow-xl shadow-black/30"
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(opt.value)}
                  onMouseEnter={() => setActiveIndex(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      commit(opt.value);
                    }
                  }}
                  className={`flex w-full items-center px-4 py-2 text-left font-mono text-sm transition-colors focus:outline-none ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : isActive
                        ? "bg-dark-3/60 text-white"
                        : "text-gray-light hover:bg-dark-3/60 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
