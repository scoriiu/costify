"use client";

/**
 * OwnerLayout — the shell for every owner-mode page (/firma/* or
 * /clients/[slug]?view=owner).
 *
 * Per Claudia spec §4.1 the firma dashboard is ONE page with 9 scrollable
 * sections + anchor TOC. The only true sub-route is /istoric (audit trail),
 * which is a different concern from "see how the firm is doing".
 *
 * AGENTS.md "Top navigation (no sidebar)" — the nav lives horizontally in
 * the topbar, freeing full content width for data.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { buildPageHref } from "./owner-context";

export interface OwnerContext {
  clientId: string;
  clientName: string;
  slug: string;
  isPreview: boolean;
  /**
   * Base href for building internal links.
   * For owners:    "/firma"
   * For preview:   "/clients/[slug]?view=owner"
   */
  baseHref: string;
  activePage: OwnerPageKey;
}

export type OwnerPageKey = "home" | "istoric";

const NAV_ITEMS: Array<{ key: OwnerPageKey; label: string; pageSlug: string }> = [
  { key: "home", label: "Acasa", pageSlug: "" },
  { key: "istoric", label: "Istoric", pageSlug: "istoric" },
];

interface OwnerLayoutProps {
  context: OwnerContext;
  children: ReactNode;
}

export function OwnerLayout({ context, children }: OwnerLayoutProps) {
  return (
    <div className="min-h-screen bg-dark">
      {context.isPreview && <PreviewStrip clientName={context.clientName} />}
      <Topbar context={context} />
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8 sm:py-12">{children}</main>
    </div>
  );
}

function PreviewStrip({ clientName }: { clientName: string }) {
  function handleClose() {
    window.close();
  }
  return (
    <div className="sticky top-0 z-50 border-b border-primary/30 bg-primary/[0.08] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="font-mono text-[10px] uppercase tracking-wider text-primary shrink-0"
            style={{ letterSpacing: "0.05em" }}
          >
            Previzualizare client
          </span>
          <span className="hidden sm:inline-block h-3.5 w-px bg-primary/30" />
          <span
            className="hidden sm:inline text-[12px] text-gray-light truncate"
            style={{ letterSpacing: "-0.02em" }}
          >
            {clientName}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-[12px] font-medium text-gray-light hover:text-white transition-colors cursor-pointer"
          style={{ letterSpacing: "-0.02em" }}
        >
          Inchide
        </button>
      </div>
    </div>
  );
}

function Topbar({ context }: { context: OwnerContext }) {
  const topClass = context.isPreview ? "top-9" : "top-0";
  return (
    <header className={`sticky ${topClass} z-40 border-b border-dark-3 bg-dark/80 backdrop-blur-xl`}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <Link href="/" className="shrink-0">
            <Logo size="lg" />
          </Link>
          <span className="hidden sm:inline-block h-4 w-px bg-dark-3" />
          <div className="flex flex-col leading-none gap-0.5 min-w-0">
            <span
              className="font-mono text-[9px] uppercase tracking-wider text-gray"
              style={{ letterSpacing: "0.05em" }}
            >
              Firma ta
            </span>
            <span
              className="text-[14px] font-semibold text-white truncate"
              style={{ letterSpacing: "-0.04em" }}
            >
              {context.clientName}
            </span>
          </div>
          {/* Istoric is owner-only (audit trail of accountant actions). Hide
              the nav in preview mode — the accountant has their own audit page. */}
          {!context.isPreview && (
            <>
              <span className="hidden sm:inline-block h-4 w-px bg-dark-3" />
              <nav className="hidden sm:flex items-center gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = item.key === context.activePage;
                  const href = buildPageHref(context, item.pageSlug);
                  return (
                    <Link
                      key={item.key}
                      href={href}
                      className={
                        active
                          ? "rounded-md bg-primary/[0.08] px-3 py-1.5 text-[14px] font-semibold text-white"
                          : "rounded-md px-3 py-1.5 text-[14px] font-semibold text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors"
                      }
                      style={{ letterSpacing: "-0.04em" }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="#"
            className="hidden sm:inline-flex text-[14px] font-semibold text-gray-light hover:text-white transition-colors"
            style={{ letterSpacing: "-0.04em" }}
          >
            Costi
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.07] font-mono text-[11px] font-semibold text-white/90">
            IP
          </div>
        </div>
      </div>
    </header>
  );
}
