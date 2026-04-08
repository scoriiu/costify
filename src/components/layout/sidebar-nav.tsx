"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

const INTERNAL_WHITELIST = [
  "solomon.coriiu@nisindo.com",
];

const NAV_ITEMS = [
  { label: "General", items: [
    { href: "/clients", label: "Clients" },
    { href: "/reports", label: "Reports" },
    { href: "/costi", label: "Costi" },
  ]},
  { label: "Settings", items: [
    { href: "/settings", label: "Settings" },
  ]},
];

const INTERNAL_ITEMS = [
  { href: "/design", label: "Design System" },
  { href: "/marketing", label: "Marketing" },
  { href: "/debug", label: "Mascot" },
];

interface SidebarNavProps {
  userEmail: string;
}

export function SidebarNav({ userEmail }: SidebarNavProps) {
  const pathname = usePathname();
  const isInternal = INTERNAL_WHITELIST.includes(userEmail);

  return (
    <nav className="flex-1 overflow-y-auto py-2">
      {NAV_ITEMS.map((section) => (
        <div key={section.label}>
          <div className="px-5 pt-5 pb-1.5 font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>
            {section.label}
          </div>
          {section.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block border-l-2 px-5 py-2 text-[14px] font-semibold transition-all",
                  active
                    ? "border-primary bg-primary/[0.06] text-white"
                    : "border-transparent text-gray-light hover:bg-dark-3/50 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      {isInternal && (
        <div>
          <div className="px-5 pt-5 pb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>
            <Lock size={10} className="opacity-60" />
            Internal
          </div>
          {INTERNAL_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block border-l-2 px-5 py-2 text-[14px] font-semibold transition-all",
                  active
                    ? "border-primary bg-primary/[0.06] text-white"
                    : "border-transparent text-gray-light hover:bg-dark-3/50 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
