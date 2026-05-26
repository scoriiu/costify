"use client";

/**
 * OwnerLayout — the shell for every owner-mode page (/firma/* or
 * /clients/[slug]?view=owner).
 *
 * Per Claudia spec §4.1 the firma dashboard is ONE page with 9 scrollable
 * sections + anchor TOC. The only true sub-route is /istoric (audit trail),
 * which is a different concern from "see how the firm is doing".
 *
 * Owner mode (isPreview=false):
 *   Minimal topbar — firm name, nav (Acasa/Istoric), user menu. No app logo,
 *   no "Firma ta" label, no dead Costi link. The CostiChat widget floats
 *   globally so a dedicated link is redundant.
 *
 * Preview mode (isPreview=true):
 *   No topbar at all — the accountant's main TopNav already provides chrome.
 *   A single preview strip shows "← Înapoi la {client}" so the accountant can
 *   return to the work view in one click.
 */

import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/actions";
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

export interface OwnerUser {
  name: string;
  email: string;
}

/** Where the preview strip's "Înapoi" link should go. Built by the caller
 *  so we preserve year / month / tab params from the accountant view. */
export interface PreviewBackTarget {
  href: string;
  label: string;
}

const NAV_ITEMS: Array<{ key: OwnerPageKey; label: string; pageSlug: string }> = [
  { key: "home", label: "Acasa", pageSlug: "" },
  { key: "istoric", label: "Istoric", pageSlug: "istoric" },
];

interface OwnerLayoutProps {
  context: OwnerContext;
  /** Optional in preview mode (main TopNav already has user menu). Required
   *  in owner mode so the user can log out. */
  user?: OwnerUser;
  /** Optional preview back target. When provided in preview mode, the strip
   *  shows a link instead of the (unreliable) window.close() button. */
  previewBack?: PreviewBackTarget;
  children: ReactNode;
}

export function OwnerLayout({ context, user, previewBack, children }: OwnerLayoutProps) {
  return (
    <div className="min-h-screen bg-dark">
      {context.isPreview ? (
        <PreviewStrip clientName={context.clientName} previewBack={previewBack} />
      ) : (
        <OwnerTopbar context={context} user={user} />
      )}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-8 sm:py-12">{children}</main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview strip — visible only when an accountant is previewing the owner view.
// Replaces the entire OwnerLayout topbar so the accountant sees minimal chrome.
// ─────────────────────────────────────────────────────────────────────────────

function PreviewStrip({
  clientName,
  previewBack,
}: {
  clientName: string;
  previewBack: PreviewBackTarget | undefined;
}) {
  const back = previewBack ?? { href: "/clients", label: "Lista clienti" };
  return (
    <div className="sticky top-0 z-40 border-b border-primary/30 bg-primary/[0.08] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
        <Link
          href={back.href}
          className="group inline-flex items-center gap-2 text-[13px] font-semibold text-gray-light hover:text-white transition-colors"
          style={{ letterSpacing: "-0.04em" }}
        >
          <span className="text-primary transition-transform group-hover:-translate-x-0.5">←</span>
          Inapoi la {back.label}
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="font-mono text-[10px] uppercase tracking-wider text-primary shrink-0"
            style={{ letterSpacing: "0.05em" }}
          >
            Previzualizezi
          </span>
          <span className="hidden sm:inline-block h-3.5 w-px bg-primary/30" />
          <span
            className="hidden sm:inline text-[13px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
          >
            {clientName}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner topbar — minimal: firm name + nav + user menu. No app branding.
// ─────────────────────────────────────────────────────────────────────────────

function OwnerTopbar({ context, user }: { context: OwnerContext; user: OwnerUser | undefined }) {
  return (
    <header className="sticky top-0 z-40 border-b border-dark-3 bg-dark/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <span
            className="text-[15px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
          >
            {context.clientName}
          </span>
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
        </div>
        {user && <UserMenu user={user} />}
      </div>
    </header>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserMenu({ user }: { user: OwnerUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-dark-3/50 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Meniu cont"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.07] font-mono text-[11px] font-semibold tracking-wider text-white/90">
          {getInitials(user.name)}
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "text-gray transition-transform hidden sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-dark-3 bg-dark-2 shadow-xl shadow-black/30 transition-[opacity,scale] duration-150 origin-top-right",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        role="menu"
      >
        <div className="border-b border-dark-3 px-4 py-3">
          <p
            className="text-[14px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
          >
            {user.name}
          </p>
          <p className="text-[12px] text-gray truncate">{user.email}</p>
        </div>
        <div className="py-1">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors"
          >
            <Settings size={14} />
            Setari
          </Link>
        </div>
        <div className="border-t border-dark-3 py-1">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              Deconectare
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
