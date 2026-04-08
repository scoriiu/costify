"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Lock, LogOut, Settings, ChevronDown, Menu, X } from "lucide-react";
import { logoutAction } from "@/modules/auth/actions";
import { ThemeToggle } from "@/components/theme/theme-selector";

const INTERNAL_WHITELIST = [
  "solomon.coriiu@costify.ro",
  "claudia.solomon@costify.ro",
  "sorin.crisan@costify.ro",
];

const NAV_ITEMS = [
  { href: "/clients", label: "Clients" },
  { href: "/reports", label: "Reports" },
  { href: "/costi", label: "Costi" },
];

interface TopNavProps {
  userName: string;
  userEmail: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserMenu({ userName, userEmail }: { userName: string; userEmail: string }) {
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
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-dark-4 text-[11px] font-bold text-gray-light">
          {getInitials(userName)}
        </div>
        <ChevronDown size={14} className={cn("text-gray transition-transform hidden sm:block", open && "rotate-180")} />
      </button>

      <div
        className={cn(
          "absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-dark-3 bg-dark-2 shadow-xl shadow-black/30 transition-[opacity,scale] duration-150 origin-top-right",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        role="menu"
      >
        <div className="border-b border-dark-3 px-4 py-3">
          <p className="text-[14px] font-semibold text-white truncate" style={{ letterSpacing: "-0.04em" }}>{userName}</p>
          <p className="text-[12px] text-gray truncate">{userEmail}</p>
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
          <ThemeToggle />
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

function MobileMenu({ isInternal, pathname, onClose }: { isInternal: boolean; pathname: string; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <nav className="absolute top-14 left-0 right-0 border-b border-dark-3 bg-dark-2 px-4 py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "block rounded-lg px-4 py-3 text-[15px] font-semibold transition-colors",
                active ? "bg-primary/[0.08] text-white" : "text-gray-light hover:bg-dark-3/50 hover:text-white"
              )}
              style={{ letterSpacing: "-0.04em" }}
            >
              {item.label}
            </Link>
          );
        })}
        {isInternal && (
          <Link
            href="/internal"
            onClick={onClose}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 text-[15px] font-semibold transition-colors",
              pathname.startsWith("/internal") || pathname.startsWith("/design") || pathname.startsWith("/marketing") || pathname.startsWith("/debug")
                ? "bg-primary/[0.08] text-white"
                : "text-gray-light hover:bg-dark-3/50 hover:text-white"
            )}
            style={{ letterSpacing: "-0.04em" }}
          >
            <Lock size={14} className="opacity-60" />
            Internal
          </Link>
        )}
      </nav>
    </div>
  );
}

export function TopNav({ userName, userEmail }: TopNavProps) {
  const pathname = usePathname();
  const isInternal = INTERNAL_WHITELIST.includes(userEmail);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-dark-3 bg-dark/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/clients">
              <Logo size="lg" />
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors",
                      active
                        ? "bg-primary/[0.08] text-white"
                        : "text-gray-light hover:bg-dark-3/50 hover:text-white"
                    )}
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isInternal && (
                <Link
                  href="/internal"
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold transition-colors",
                    pathname.startsWith("/internal") || pathname.startsWith("/design") || pathname.startsWith("/marketing") || pathname.startsWith("/debug")
                      ? "bg-primary/[0.08] text-white"
                      : "text-gray-light hover:bg-dark-3/50 hover:text-white"
                  )}
                  style={{ letterSpacing: "-0.04em" }}
                >
                  <Lock size={12} className="opacity-60" />
                  Internal
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <UserMenu userName={userName} userEmail={userEmail} />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex md:hidden items-center justify-center rounded-lg p-2 text-gray-light hover:bg-dark-3/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <MobileMenu isInternal={isInternal} pathname={pathname} onClose={() => setMobileOpen(false)} />
      )}
    </>
  );
}
