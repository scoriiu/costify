import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-8">
      <aside className="scrollbar-thin sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto py-8 pr-4 lg:block">
        <DocsSidebar />
      </aside>

      <main className="min-w-0 flex-1 py-8">
        {children}
      </main>
    </div>
  );
}
