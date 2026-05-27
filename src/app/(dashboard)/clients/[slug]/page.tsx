import { getSessionUser } from "@/modules/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAvailablePeriods } from "@/modules/balances";
import { computeKpis } from "@/modules/reporting";
import { getCatalogMap } from "@/modules/accounts";
import { listAccessesForClient } from "@/modules/roles";
import {
  listPublishedPeriods,
  getPublishedView,
  getLatestPublishedView,
} from "@/modules/publishing";
import { listAccountantAuditTrail } from "@/modules/audit";
import {
  getBalanceRowsCached,
  loadOwnerSnapshotCached,
} from "@/modules/cache/loaders";
import { ClientDetail } from "@/components/clients/client-detail";
import { AccessSection } from "@/components/clients/access-section";
import {
  PublishingSection,
  type PublishingSectionRow,
} from "@/components/clients/publishing-section";
import { PublishStatusBar } from "@/components/clients/publish-status-bar";
import { AuditSection } from "@/components/clients/audit-section";
import {
  OwnerLayout,
  OwnerView,
  buildOwnerContextForPreview,
} from "@/components/clients/owner";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tab?: string;
    year?: string;
    month?: string;
    view?: string;
    mode?: string;
    "cashflow-year"?: string;
  }>;
}

export default async function ClientDetailPage(props: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  // Parallel: client lookup + periods. Periods is independent of the client
  // row but needs clientId — we kick the lookup first and run periods after.
  // (Periods could be parallelized with a subquery; not worth the SQL churn
  // since the cache layer makes subsequent loads near-free anyway.)
  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug, active: true },
    include: {
      importEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { journalLines: { where: { deletedAt: null } } } },
    },
  });

  if (!client) notFound();

  const periods = await getAvailablePeriods(client.id);
  const lastPeriod = periods[periods.length - 1];
  const year = searchParams.year ? parseInt(searchParams.year) : lastPeriod?.year;
  const month = searchParams.month ? parseInt(searchParams.month) : lastPeriod?.month;

  // Owner preview branch — accountant sees a LIVE recompute (not the stored
  // published snapshot) so they can preview new dashboard features before
  // publishing. The owner (/firma) still sees the stored published view.
  if (searchParams.view === "owner") {
    // Detailed is the default: the contabil-facing preview should show every
    // L2 surface so the accountant can validate the full owner experience.
    // The owner-facing /firma route keeps the per-user persisted preference.
    const mode = searchParams.mode === "simple" ? "simple" : "detailed";
    const context = buildOwnerContextForPreview({
      clientId: client.id,
      clientName: client.name,
      slug: client.slug,
      activePage: "home",
    });

    // Back link for the preview strip — returns the accountant to the work
    // view, preserving the tab/period they came from when possible.
    const backParams = new URLSearchParams();
    if (searchParams.tab) backParams.set("tab", searchParams.tab);
    if (year) backParams.set("year", String(year));
    if (month) backParams.set("month", String(month));
    const backQs = backParams.toString();
    const previewBack = {
      href: `/clients/${client.slug}${backQs ? `?${backQs}` : ""}`,
      label: client.name,
    };

    const publishedList = await listPublishedPeriods(client.id);
    const availablePeriods = publishedList.map((p) => ({ year: p.year, month: p.month }));

    const previewYear = year ?? null;
    const previewMonth = month ?? null;

    if (!previewYear || !previewMonth) {
      return (
        <OwnerLayout context={context} previewBack={previewBack}>
          <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-12">
            <h1 className="text-[24px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
              Nicio luna disponibila
            </h1>
            <p className="mt-3 max-w-xl text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              Importa un jurnal pentru a putea previzualiza ce vede patronul.
            </p>
          </div>
        </OwnerLayout>
      );
    }

    const snapshot = await loadOwnerSnapshotCached({
      clientId: client.id,
      clientName: client.name,
      clientCui: client.cui,
      clientSlug: client.slug,
      year: previewYear,
      month: previewMonth,
    });

    // Compute marjaOperationala for the hero (used by HeroSummary tooltip).
    const [previewBalanceRows, previewCatalog] = await Promise.all([
      getBalanceRowsCached(client.id, previewYear, previewMonth),
      getCatalogMap(),
    ]);
    const previewKpis = previewBalanceRows.ok
      ? computeKpis(previewBalanceRows.data, previewCatalog)
      : null;
    const previewMarja = previewKpis?.marjaOperationala ?? null;

    return (
      <OwnerLayout context={context} previewBack={previewBack}>
        <OwnerView
          snapshot={snapshot}
          context={context}
          marjaOperationala={previewMarja}
          availablePeriods={availablePeriods}
          mode={mode}
        />
      </OwnerLayout>
    );
  }

  // Default: accountant view with tabs
  const [accesses, publishedPeriods, currentStatus, auditRows] = await Promise.all([
    listAccessesForClient(client.id),
    listPublishedPeriods(client.id),
    year && month ? getPublishedView(client.id, year, month) : Promise.resolve(null),
    listAccountantAuditTrail(client.id, { limit: 50 }),
  ]);
  const tab = searchParams.tab ?? "jurnal";

  // Merge journal-having periods with published rows so the Setari panel shows
  // both "ready to publish" and "already published" months in a single timeline.
  const publishedMap = new Map(
    publishedPeriods.map((p) => [`${p.year}-${p.month}`, p])
  );
  const journalKeys = new Set(periods.map((p) => `${p.year}-${p.month}`));
  const allKeys = new Set<string>([...publishedMap.keys(), ...journalKeys]);
  const publishingRows: PublishingSectionRow[] = Array.from(allKeys)
    .map((k) => {
      const [yStr, mStr] = k.split("-");
      const py = parseInt(yStr, 10);
      const pm = parseInt(mStr, 10);
      const pub = publishedMap.get(k);
      return {
        year: py,
        month: pm,
        isPublished: pub !== undefined,
        publishedAt: pub ? pub.publishedAt.toISOString() : null,
        publisherName: pub?.publisherName ?? null,
        noteForOwner: pub?.noteForOwner ?? null,
        stale: pub?.stale ?? false,
        hasJournalData: journalKeys.has(k),
      };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // Mapari is fetched client-side by ClientDetail on tab activation — keeps
  // page render fast for users who never visit that tab, and lets tab switches
  // be purely client-state (no server round-trip).
  const cashflowYearRaw = searchParams["cashflow-year"];
  const cashflowYearParsed = cashflowYearRaw ? parseInt(cashflowYearRaw, 10) : NaN;
  const cashflowYear = Number.isFinite(cashflowYearParsed) ? cashflowYearParsed : undefined;

  const publishBar =
    year && month ? (
      <PublishStatusBar
        clientId={client.id}
        clientSlug={client.slug}
        year={year}
        month={month}
        status={{
          isPublished: currentStatus !== null,
          publishedAt: currentStatus?.publishedAt.toISOString() ?? null,
          publisherName: currentStatus?.publisherName ?? null,
          noteForOwner: currentStatus?.noteForOwner ?? null,
          stale: currentStatus?.stale ?? false,
        }}
      />
    ) : null;

  return (
    <ClientDetail
      client={{
        id: client.id,
        slug: client.slug,
        name: client.name,
        cui: client.cui,
        caen: client.caen,
        createdAt: client.createdAt.toISOString(),
      }}
      dataVersion={client.dataVersion}
      entryCount={client._count.journalLines}
      importEvents={client.importEvents.map((e) => ({
        id: e.id,
        fileName: e.fileName,
        entriesAdded: e.entriesAdded,
        dateStart: e.dateStart?.toISOString() ?? null,
        dateEnd: e.dateEnd?.toISOString() ?? null,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }))}
      periods={periods}
      activeTab={tab}
      selectedYear={year}
      selectedMonth={month}
      cashflowYear={cashflowYear}
      accessSection={
        <AccessSection
          clientId={client.id}
          clientSlug={client.slug}
          accesses={accesses.map((a) => ({
            id: a.id,
            userId: a.userId,
            userEmail: a.userEmail,
            userName: a.userName,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      }
      publishSection={
        <PublishingSection
          clientId={client.id}
          clientSlug={client.slug}
          rows={publishingRows}
        />
      }
      publishBar={publishBar}
      auditSection={<AuditSection rows={auditRows} />}
    />
  );
}
