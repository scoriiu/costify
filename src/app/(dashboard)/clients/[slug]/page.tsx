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
import { ClientDetail } from "@/components/clients/client-detail";
import { AccessSection } from "@/components/clients/access-section";
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
  "profit", "eu", "stat", "evolutie", "sanatate",
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

    // No data → show inside OwnerLayout with a simple message
    if (!year || !month) {
      return (
        <OwnerLayout context={context}>
          <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-12">
            <h1 className="text-[24px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
              Inca nu ai date despre firma
            </h1>
            <p className="mt-3 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              Cand contabilul incarca primul jurnal, vei vedea aici cum sta firma.
            </p>
          </div>
        </OwnerLayout>
      );
    }

    // Sub-pages other than home: render placeholder (until real pages are built)
    if (activePage !== "home") {
      const meta = OWNER_PAGES[activePage];
      return (
        <OwnerLayout context={context}>
          <EmptyPagePlaceholder title={meta.title} subtitle={meta.subtitle} preview={meta.preview} />
        </OwnerLayout>
      );
    }

    // Home page — full snapshot
    const [snapshot, balanceResult, catalog] = await Promise.all([
      loadOwnerSnapshot({
        clientId: client.id,
        clientName: client.name,
        clientCui: client.cui,
        clientSlug: client.slug,
        year,
        month,
      }),
      getBalanceRows(client.id, year, month),
      getCatalogMap(),
    ]);

    const marja = balanceResult.ok ? computeKpis(balanceResult.data, catalog).marjaOperationala : null;

    return (
      <OwnerLayout context={context}>
        <OwnerView snapshot={snapshot} context={context} marjaOperationala={marja} />
      </OwnerLayout>
    );
  }

  // Default: accountant view with tabs
  const [transitions, accesses] = await Promise.all([
    getTransitions(client.id),
    listAccessesForClient(client.id),
  ]);
  const tab = searchParams.tab ?? "jurnal";

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
    />
  );
}
