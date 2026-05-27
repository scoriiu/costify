"use client";

/**
 * SectionQuickNav — collapsible quick-jump panel on the right edge.
 *
 * Previously this was an always-on floating panel that sat at top-right of
 * every owner page. Useful in principle, but it constantly competed with
 * the data for attention and overlapped right-aligned KPI numbers on
 * narrower xl viewports. The user feedback was "it gets in my way".
 *
 * New shape: a small compact chip pinned to the right edge that shows
 * only the current section title. Click (or focus) to expand the full
 * list; click outside or pick a section to collapse it again.
 *
 * IntersectionObserver still tracks which section is at the reading
 * line so the chip always tells you where you are even when collapsed.
 *
 * Hidden on tablet/mobile — the chip needs viewport real estate that
 * mobile doesn't have, and the user can scroll on touch.
 */

import { useEffect, useRef, useState } from "react";
import { ListOrdered } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
}

interface Props {
  items: NavItem[];
}

export function SectionQuickNav({ items }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observed = new Map<string, HTMLElement>();
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observed.set(item.id, el);
    }
    if (observed.size === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => ({
            id: (e.target as HTMLElement).id,
            top: e.boundingClientRect.top,
          }))
          .sort((a, b) => Math.abs(a.top - 96) - Math.abs(b.top - 96));
        if (visible[0]) setActiveId(visible[0].id);
      },
      { rootMargin: "-80px 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
    setOpen(false);
  }

  const activeLabel = items.find((i) => i.id === activeId)?.label ?? items[0]?.label ?? "";

  return (
    <div
      ref={wrapperRef}
      aria-label="Sectiunile paginii"
      className="hidden xl:block fixed right-4 top-24 z-20"
    >
      {/* Collapsed chip: small, mostly transparent, doesn't crowd the page. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Sari la sectiune"
        className={`group flex items-center gap-2 rounded-full border border-dark-3/60 bg-dark-2/40 backdrop-blur-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-gray transition-all hover:border-primary/40 hover:bg-dark-2/80 hover:text-white shadow-lg shadow-black/20 ${
          open ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ letterSpacing: "0.04em" }}
      >
        <ListOrdered
          size={12}
          className="text-primary opacity-70 group-hover:opacity-100"
        />
        <span className="max-w-[140px] truncate">{activeLabel}</span>
      </button>

      {/* Expanded panel: full list, only when the user opens it. */}
      <ul
        role="menu"
        className={`absolute right-0 top-0 origin-top-right space-y-1 rounded-xl border border-dark-3 bg-dark-2/95 backdrop-blur-md p-1.5 shadow-xl shadow-black/40 transition-[opacity,transform,visibility] duration-150 ${
          open
            ? "opacity-100 scale-100 visible"
            : "opacity-0 scale-95 invisible pointer-events-none"
        }`}
        style={{ minWidth: 200 }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleClick(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                  isActive ? "text-white" : "text-gray hover:text-gray-light"
                }`}
                style={{ letterSpacing: "0.04em" }}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full transition-all ${
                    isActive
                      ? "bg-primary scale-100"
                      : "bg-dark-3 scale-75 group-hover:bg-gray"
                  }`}
                  aria-hidden
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
