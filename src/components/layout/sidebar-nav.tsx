"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Settings, FileBarChart, MessageCircle } from "lucide-react";

const NAV_ITEMS = [
  { label: "General", items: [
    { href: "/clients", icon: Users, label: "Clients" },
    { href: "/reports", icon: FileBarChart, label: "Reports" },
    { href: "/costi", icon: MessageCircle, label: "Costi" },
  ]},
  { label: "Settings", items: [
    { href: "/settings", icon: Settings, label: "Settings" },
  ]},
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-2">
      {NAV_ITEMS.map((section) => (
        <div key={section.label}>
          <div className="px-5 pt-5 pb-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-gray">
            {section.label}
          </div>
          {section.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 border-l-2 px-5 py-2 text-[0.8rem] transition-all",
                  active
                    ? "border-primary bg-primary/[0.06] text-white"
                    : "border-transparent text-gray hover:bg-white/[0.02] hover:text-gray-light"
                )}
              >
                <item.icon size={16} className={cn("opacity-40", active && "opacity-80")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
