"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
 *   - On open, the currently selected option scrolls into view and receives
 *     focus, so a long list (e.g. 50 categories) doesn't force the user to
 *     scroll manually to find their selection.
 *   - Arrow Up / Arrow Down navigate between options.
 *   - Enter activates the highlighted option.
 *   - Escape closes the popover.
 *   - Click outside closes the popover.
 *   - Tab moves focus naturally (does not trap focus inside the popover).
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
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel =
    options[selectedIndex]?.label ?? (placeholder ?? value);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Click outside -> close.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

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

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 max-w-md min-w-full overflow-y-auto rounded-xl border border-dark-3 bg-dark-2 py-1 shadow-xl shadow-black/30"
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
        </div>
      )}
    </div>
  );
}
