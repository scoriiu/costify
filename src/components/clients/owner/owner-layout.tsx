"use client";

/**
 * OwnerLayout — the shell for every owner-mode page (/firma/* or
 * /clients/[slug]?view=owner).
 *
 * Provides:
 *   - Top bar with Costify logo, firma name, Costi link, user dropdown
 *   - Sticky side nav with 11 typographic links
 *   - Slot for page content
 *   - Optional PreviewBanner above topbar when isPreview is true
 *
 * Receives OwnerContext (plain data only — no functions, so it can cross
 * server→client boundary). The pageHref builder is derived from context
 * via buildPageHref().
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { buildPageHref } from "./owner-context";

export interface OwnerContext {
  clientId: string;
  clientName: string;
  slug: string;
  /** True when an accountant is previewing this view. Shows the preview banner. */
  isPreview: boolean;
  /**
   * Base href for building internal links.
   * For owners:    "/firma"
   * For preview:   "/clients/[slug]?view=owner"
   */
  baseHref: string;
  /** Currently active page key. Used to highlight side nav item. */
  activePage: OwnerPageKey;
}

export type OwnerPageKey =
  | "home"
  | "bani"
  | "clienti"
  | "furnizori"
  | "cheltuieli"
  | "venituri"
  | "profit"
  | "eu"
  | "stat"
  | "evolutie"
  | "sanatate";

const NAV_ITEMS: Array<{ key: OwnerPageKey; label: string; pageSlug: string }> = [
  { key: "home", label: "Acasa", pageSlug: "" },
  { key: "bani", label: "Bani", pageSlug: "bani" },
  { key: "clienti", label: "Clienti", pageSlug: "clienti" },
  { key: "furnizori", label: "Furnizori", pageSlug: "furnizori" },
  { key: "cheltuieli", label: "Cheltuieli", pageSlug: "cheltuieli" },
  { key: "venituri", label: "Venituri", pageSlug: "venituri" },
  { key: "profit", label: "Profit", pageSlug: "profit" },
  { key: "eu", label: "Eu si firma", pageSlug: "eu" },
  { key: "stat", label: "Stat", pageSlug: "stat" },
  { key: "evolutie", label: "Evolutie", pageSlug: "evolutie" },
  { key: "sanatate", label: "Sanatate", pageSlug: "sanatate" },
];

interface OwnerLayoutProps {
  context: OwnerContext;
  children: ReactNode;
}

export function OwnerLayout({ context, children }: OwnerLayoutProps) {
  return (
    <div className="min-h-screen bg-dark">
      {context.isPreview && <PreviewStrip clientName={context.clientName} />}
      <Topbar firmaName={context.clientName} isPreview={context.isPreview} />
      <div className="mx-auto flex max-w-7xl px-4 sm:px-8">
        <SideNav context={context} />
        <main className="flex-1 min-w-0 py-8 sm:py-12 lg:pl-10">{children}</main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview strip — visible when an accountant is previewing the owner view.
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────────────

function Topbar({ firmaName, isPreview }: { firmaName: string; isPreview: boolean }) {
  const topClass = isPreview ? "top-9" : "top-0";
  return (
    <header className={`sticky ${topClass} z-40 border-b border-dark-3 bg-dark/80 backdrop-blur-xl`}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
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
              {firmaName}
            </span>
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Side nav — purely typographic, no icons, no emoji
// ─────────────────────────────────────────────────────────────────────────────

function SideNav({ context }: { context: OwnerContext }) {
  return (
    <aside className="hidden lg:block w-56 shrink-0 pt-10">
      <nav className="sticky top-24 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.key === context.activePage;
          const href = buildPageHref(context, item.pageSlug);
          return (
            <Link
              key={item.key}
              href={href}
              className={
                active
                  ? "relative block rounded-md bg-primary/[0.08] px-4 py-2 text-[14px] font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[2px] before:-translate-y-1/2 before:rounded-r before:bg-primary"
                  : "block rounded-md px-4 py-2 text-[14px] font-semibold text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors"
              }
              style={{ letterSpacing: "-0.04em" }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
