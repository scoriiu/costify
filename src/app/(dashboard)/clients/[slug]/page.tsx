import { getSessionUser } from "@/modules/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAvailablePeriods } from "@/modules/balances";
import { getTransitions } from "@/modules/clients/tax-regime";
import { computeKpis } from "@/modules/reporting";
import { getBalanceRows } from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { loadOwnerSnapshot } from "@/modules/reporting/owner";
import { listAccessesForClient } from "@/modules/roles";
import {
  listPublishedPeriods,
  getPublishedView,
  getLatestPublishedView,
} from "@/modules/publishing";
import { listAccountantAuditTrail } from "@/modules/audit";
import { loadMapariCashflow } from "@/modules/categories";
import { listVerticals } from "@/modules/verticals";
import { ClientDetail } from "@/components/clients/client-detail";
import { MapariCashflowTab } from "@/components/clients/mapari-cashflow/mapari-cashflow-tab";
import { VerticalsSection } from "@/components/clients/verticals-section";
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
  EmptyPagePlaceholder,
  buildOwnerContextForPreview,
  OWNER_PAGES,
  type OwnerPageKey,
} from "@/components/clients/owner";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tab?: string;
    year?: string;
    month?: string;
    view?: string;
    page?: string;
  }>;
}

const VALID_OWNER_PAGES: OwnerPageKey[] = [
  "home", "bani", "clienti", "furnizori", "cheltuieli", "venituri",
  "profit", "eu", "stat", "evolutie", "sanatate", "istoric",
];

function resolveOwnerPage(page: string | undefined): OwnerPageKey {
  if (!page) return "home";
  return (VALID_OWNER_PAGES as string[]).includes(page) ? (page as OwnerPageKey) : "home";
}

export default async function ClientDetailPage(props: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await props.params;
  const searchParams = await props.searchParams;

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

  // Owner preview branch
  if (searchParams.view === "owner") {
    const activePage = resolveOwnerPage(searchParams.page);
    const context = buildOwnerContextForPreview({
      clientId: client.id,
      clientName: client.name,
      slug: client.slug,
      activePage,
    });

    // Sub-pages other than home: render placeholder (until real pages are built)
    if (activePage !== "home") {
      const meta = OWNER_PAGES[activePage];
      return (
        <OwnerLayout context={context}>
          <EmptyPagePlaceholder title={meta.title} subtitle={meta.subtitle} preview={meta.preview} />
        </OwnerLayout>
      );
    }

    const published = await getLatestPublishedView(client.id);

    if (!published) {
      return (
        <OwnerLayout context={context}>
          <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-12">
            <h1 className="text-[24px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
              Nicio luna publicata inca
            </h1>
            <p className="mt-3 max-w-xl text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              Cand publici prima luna catre firma, patronul va vedea aici cum sta. Pana atunci, vede acelasi ecran ca tine.
            </p>
          </div>
        </OwnerLayout>
      );
    }

    return (
      <OwnerLayout context={context}>
        <OwnerView snapshot={published.snapshot} context={context} marjaOperationala={null} />
      </OwnerLayout>
    );
  }

  // Default: accountant view with tabs
  const [transitions, accesses, publishedPeriods, currentStatus, auditRows] = await Promise.all([
    getTransitions(client.id),
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

  // Lazy-load the "Mapari Cashflow" tab content only when the user is on
  // that tab. This avoids running the loader (which fetches balance rows
  // for the latest period) on every page visit.
  const mapariCashflowSection =
    tab === "mapari-cashflow"
      ? await loadMapariCashflow(client.id).then((data) => (
          <MapariCashflowTab data={data} />
        ))
      : null;

  // Verticals section is shown inside Setari. Pre-fetched only when the user
  // is on that tab to avoid an extra query on every visit.
  const verticalsSection =
    tab === "setari"
      ? await listVerticals(prisma, client.id).then((verticals) => (
          <VerticalsSection
            clientId={client.id}
            clientSlug={client.slug}
            enabled={client.verticalsEnabled}
            verticals={verticals}
          />
        ))
      : null;

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
      transitions={transitions.map((t) => ({
        id: t.id,
        startDate: t.startDate.toISOString(),
        taxRegime: t.taxRegime,
        reason: t.reason,
      }))}
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
      mapariCashflowSection={mapariCashflowSection}
      verticalsSection={verticalsSection}
    />
  );
}
