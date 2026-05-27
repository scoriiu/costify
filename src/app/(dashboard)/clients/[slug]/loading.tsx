/**
 * Skeleton shown by Next.js between a click on a client card and the
 * server-rendered page being ready.
 *
 * Why this file exists: the real page.tsx does ~6 sequential DB
 * lookups (session, client, periods, balance, access list, audit
 * trail, owner snapshot). On a cold pod or congested DB that adds up
 * to 1-3 s where the user has clicked but nothing has changed
 * visually. Showing the layout immediately makes the click feel
 * acknowledged and gives the brain a stable destination to scan,
 * even before the data lands.
 *
 * Layout choices mirror ClientDetail's real layout so the swap from
 * skeleton -> real content has no jump:
 *   - "back to /clients" link in the same spot
 *   - title + meta row at top
 *   - tab bar with 6 tabs
 *   - empty content area
 *
 * No spinner. The shape of the page IS the loading signal.
 */
export default function Loading() {
  return (
    <div className="page-data px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 inline-flex h-4 w-16 items-center rounded bg-dark-3/60" />

      <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-dark-3/70" />
          <div className="h-3 w-40 rounded bg-dark-3/40" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-44 rounded-[10px] bg-dark-3/60" />
          <div className="h-9 w-32 rounded-[10px] bg-dark-3/60" />
          <div className="h-9 w-36 rounded-[10px] bg-primary/30" />
        </div>
      </div>

      <SkeletonTabBar />

      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
        <div className="mt-4 h-80 rounded-xl border border-dark-3 bg-dark-2/40" />
      </div>
    </div>
  );
}

function SkeletonTabBar() {
  return (
    <div className="flex gap-1 border-b border-dark-3">
      {[
        "Registru Jurnal",
        "Balanta de Verificare",
        "Cont Profit si Pierdere",
        "Plan de Conturi",
        "Mapari Cashflow",
        "Setari",
      ].map((label) => (
        <div
          key={label}
          className="px-4 py-2.5 font-mono text-xs text-gray/40"
          style={{ letterSpacing: "-0.02em" }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2/60 p-5">
      <div className="h-3 w-24 rounded bg-dark-3/60" />
      <div className="mt-3 h-7 w-32 rounded bg-dark-3/70" />
      <div className="mt-2 h-3 w-20 rounded bg-dark-3/40" />
    </div>
  );
}
