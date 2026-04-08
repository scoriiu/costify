import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "./sidebar-nav";
import { SidebarUser } from "./sidebar-user";
import { ThemeToggle } from "@/components/theme/theme-selector";

interface SidebarProps {
  userName: string;
}

export function Sidebar({ userName }: SidebarProps) {
  return (
    <aside className="fixed top-0 left-0 bottom-0 z-50 flex w-60 flex-col border-r border-dark-3 bg-dark-2">
      <div className="border-b border-dark-3 px-5 py-4">
        <Logo size="sm" />
      </div>
      <SidebarNav />
      <div className="flex items-center justify-between border-t border-dark-3 px-5 py-3">
        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-gray">Theme</span>
        <ThemeToggle />
      </div>
      <SidebarUser name={userName} />
    </aside>
  );
}
