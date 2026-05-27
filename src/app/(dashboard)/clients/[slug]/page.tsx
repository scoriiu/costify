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

/**
 * Stage timing helper for the perf hunt. Logs how long each chunk of the
 * server-render took so we can see exactly where the cold-load milliseconds
 * are going. Will be removed once the perf budget (<100 ms TTFB) is locked
 * in by a regression test.
 */
function stageTimer(slug: string) {
  const t0 = performance.now();
  let last = t0;
  const stages: Array<[string, number]> = [];
  return {
    mark(label: string) {
      const now = performance.now();
      stages.push([label, now - last]);
      last = now;
    },
    end(extra: string = "") {
      const total = performance.now() - t0;
      const detail = stages
        .map(([l, ms]) => `${l}=${ms.toFixed(0)}ms`)
        .join(" ");
      console.log(
        `[page/clients/${slug}] total=${total.toFixed(0)}ms ${detail}${extra ? " " + extra : ""}`,
      );
    },
  };
}

export default async function ClientDetailPage(props: Props) {
  const { slug } = await props.params;
  const t = stageTimer(slug);

  const user = await getSessionUser();
  t.mark("session");
  if (!user) redirect("/login");

  const searchParams = await props.searchParams;
  t.mark("searchParams");

  // Just the Client row. importEvents + entryCount + periods + accountant-
  // parallel fan out below from the same client.id.
  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug, active: true },
  });
  t.mark("client");
  if (!client) notFound();

  // Three independent reads: distinct periods, last 10 import events,
  // active journal-line count. Each one is index-only and cheap; running
  // them in parallel collapses ~50 ms of sequential latency into one
  // round-trip's worth of work.
  const [periods, importEvents, entryCount] = await Promise.all([
    getAvailablePeriods(client.id),
    prisma.importEvent.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.journalLine.count({ where: { clientId: client.id, deletedAt: null } }),
  ]);
  t.mark("periods+import+count");
  const lastPeriod = periods[periods.length - 1];
  const year = searchParams.year ? parseInt(searchParams.year) : lastPeriod?.year;
  const month = searchParams.month ? parseInt(searchParams.month) : lastPeriod?.month;

  // Owner preview branch — accountant sees a LIVE recompute (not the stored
  // published snapshot) so they can preview new dashboard features before
  // publishing. The owner (/firma) still sees the stored published view.
  if (searchParams.view === "owner") {
    const mode = searchParams.mode === "simple" ? "simple" : "detailed";
    const context = buildOwnerContextForPreview({
      clientId: client.id,
      clientName: client.name,
      slug: client.slug,
      activePage: "home",
    });

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
    t.mark("ownerPublishedList");
    const availablePeriods = publishedList.map((p) => ({ year: p.year, month: p.month }));

    const previewYear = year ?? null;
    const previewMonth = month ?? null;

    if (!previewYear || !previewMonth) {
      t.end("(no-period)");
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
    t.mark("ownerSnapshot");

    const [previewBalanceRows, previewCatalog] = await Promise.all([
      getBalanceRowsCached(client.id, previewYear, previewMonth),
      getCatalogMap(),
    ]);
    t.mark("ownerKpiInputs");
    const previewKpis = previewBalanceRows.ok
      ? computeKpis(previewBalanceRows.data, previewCatalog)
      : null;
    const previewMarja = previewKpis?.marjaOperationala ?? null;
    t.end("(owner)");

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
  t.mark("accountantParallel");
  const tab = searchParams.tab ?? "jurnal";

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

  t.end(`(accountant tab=${tab})`);

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
      entryCount={entryCount}
      importEvents={importEvents.map((e) => ({
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
