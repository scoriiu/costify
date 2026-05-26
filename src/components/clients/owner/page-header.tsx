/**
 * PageHeader — the heading block at the top of every owner sub-page.
 *
 * Renders:
 *   - eyebrow (optional, monospace uppercase, e.g. "PERIOADA")
 *   - title (large semibold, tight tracking)
 *   - subtitle (gray, smaller)
 *   - actions slot on the right (trust badge, period picker, etc.)
 *
 * Mobile-first layout: title stacks above actions on small screens.
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="font-mono text-[10px] uppercase tracking-wider text-primary mb-1.5"
            style={{ letterSpacing: "0.08em" }}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className="text-[28px] sm:text-[36px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-2 text-[14px] text-gray-light max-w-2xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
