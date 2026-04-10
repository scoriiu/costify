"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_NAVIGATION } from "@/lib/docs-navigation";
import { cn } from "@/lib/utils";

interface Props {
  onNavigate?: () => void;
}

export function DocsSidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <nav className="space-y-8">
      {DOC_NAVIGATION.map((category) => (
        <div key={category.id}>
          <div
            className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-gray"
          >
            {category.label}
          </div>
          <ul className="space-y-0.5">
            {category.pages.map((page) => {
              const href = `/docs/${page.slug}`;
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-primary/10 font-semibold text-primary-light"
                        : "text-gray-light hover:bg-dark-2 hover:text-white"
                    )}
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    <span className="truncate">{page.title}</span>
                    {page.tbd && (
                      <span className="shrink-0 rounded bg-warn/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn">
                        TBD
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
