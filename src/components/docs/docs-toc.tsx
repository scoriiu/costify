"use client";

import { useEffect, useState } from "react";
import type { DocHeading } from "@/lib/docs-navigation";
import { cn } from "@/lib/utils";

interface Props {
  headings: DocHeading[];
}

export function DocsToc({ headings }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-gray">
        Pe aceasta pagina
      </div>
      <ul className="space-y-1 border-l border-dark-3">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  "-ml-px block border-l py-1 text-[12px] transition-colors",
                  heading.level === 2 ? "pl-4" : "pl-7",
                  active
                    ? "border-primary-light text-primary-light font-semibold"
                    : "border-transparent text-gray hover:border-gray hover:text-gray-light"
                )}
                style={{ letterSpacing: "-0.02em" }}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
