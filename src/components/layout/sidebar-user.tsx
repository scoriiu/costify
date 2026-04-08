"use client";

import { logoutAction } from "@/modules/auth/actions";
import { LogOut } from "lucide-react";

interface SidebarUserProps {
  name: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SidebarUser({ name }: SidebarUserProps) {
  return (
    <div className="flex items-center gap-3 border-t border-dark-3 px-5 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dark-4 text-xs font-bold text-gray-light">
        {getInitials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{name}</div>
        <div className="font-mono text-[11px] text-gray" style={{ letterSpacing: "-0.04em" }}>Account Owner</div>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-gray hover:text-gray-light transition-colors cursor-pointer"
          title="Logout"
        >
          <LogOut size={14} />
        </button>
      </form>
    </div>
  );
}
