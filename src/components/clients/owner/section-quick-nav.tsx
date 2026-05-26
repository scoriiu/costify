"use client";

/**
 * SectionQuickNav — small floating quick-jump panel that lives on the
 * right side of the dashboard on large screens. Click a label and the
 * page scrolls to that section. The currently visible section
 * highlights automatically via IntersectionObserver.
 *
 * Hidden on tablet & mobile to avoid crowding the content.
 */

import { useEffect, useState } from "react";

interface NavItem {
  id: string;
  label: string;
}

interface Props {
  items: NavItem[];
}

export function SectionQuickNav({ items }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

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
        // Pick the entry whose top is closest to (but at or below) 96px from
        // viewport top — that matches the topbar offset and gives a stable
        // "what section am I reading" signal.
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

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <nav
      aria-label="Sectiunile paginii"
      className="hidden xl:block fixed right-4 top-1/2 -translate-y-1/2 z-20"
    >
      <ul className="space-y-1 rounded-xl border border-dark-3 bg-dark-2/80 backdrop-blur-md p-1.5 shadow-lg">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleClick(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[11px] font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                  isActive
                    ? "text-white"
                    : "text-gray hover:text-gray-light"
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
    </nav>
  );
}
