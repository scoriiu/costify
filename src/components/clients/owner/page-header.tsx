/**
 * PageHeader — standard heading block used at the top of every owner sub-page.
 *
 * Renders a title (large, semibold, tight tracking) and an optional subtitle
 * (gray, smaller, looser line height). Plus optional right-aligned actions
 * (period selector, etc.).
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
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
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
