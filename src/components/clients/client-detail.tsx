"use client";

/**
 * ClientDetail — the single-page accountant workspace for one firm.
 *
 * Design goals (the "blazing fast" bar):
 *
 *  1. **Instant tab switching.** Tab clicks never hit the server. Active tab
 *     lives in `useState`; URL is kept in sync via `history.replaceState`
 *     for sharability without triggering Next router navigation.
 *
 *  2. **One fetch per tab data, cached in component state.** Balanta and CPP
 *     share a single `/api/balance` payload per (year, month). Mapari
 *     Cashflow owns its own fetch in MapariCashflowTab — it's edit-heavy and
 *     wipe-on-mutation here caused a "Se incarca maparile..." flicker on
 *     every save.
 *
 *  3. **Correctness via dataVersion.** The server-rendered page passes
 *     `Client.dataVersion` down as a prop. When an external mutation (journal
 *     upload, vertical edit, …) bumps that version, ClientDetail wipes its
 *     balance cache so the next tab activation refetches. Mapari is a
 *     dataVersion-keyed fetch inside its tab. No tags to forget.
 *
 *  4. **Period change still navigates.** Year/month selectors trigger
 *     `router.push` so server-side props (publish bar, current period status,
 *     audit rows) update for the new period. The cache layer makes that hop
 *     ~5-15 ms on a hit. Only tab switches are pure client state.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DatasetPeriod, BalanceRowView } from "@/modules/balances";
import type { KpiSnapshot, CppData, CppF20Data } from "@/modules/reporting";
import type { TaxRegime } from "@/modules/accounts";
import type { MapariCashflowData } from "@/modules/categories";
import { PeriodSelector } from "@/components/datasets/period-selector";
import { JournalGrid } from "@/components/journal/journal-grid";
import { BalantaTab } from "@/components/clients/balanta-tab";
import { CppTab } from "@/components/clients/cpp-tab";
import { PlanConturiTab } from "@/components/clients/plan-conturi-tab";
import { SetariTab } from "@/components/clients/setari-tab";
import { MapariCashflowTab } from "@/components/clients/mapari-cashflow/mapari-cashflow-tab";
import { DeleteJournalModal } from "@/components/journal/delete-journal-modal";
import { UnmappedBanner } from "@/components/clients/unmapped-banner";

type Tab = "jurnal" | "balanta" | "cpp" | "plan" | "mapari-cashflow" | "setari";

interface ImportEventInfo {
  id: string;
  fileName: string;
  entriesAdded: number;
  dateStart: string | null;
  dateEnd: string | null;
  status: string;
  createdAt: string;
}

interface BalancePayload {
  rows: BalanceRowView[];
  kpis: KpiSnapshot | null;
  cpp: CppData | null;
  cppF20: CppF20Data | null;
  taxRegime: TaxRegime | null;
}

interface Props {
  client: {
    id: string;
    slug: string;
    name: string;
    cui: string | null;
    caen: string | null;
    createdAt: string;
  };
  /** Monotonic version. Any change invalidates client-side caches. */
  dataVersion: number;
  entryCount: number;
  importEvents: ImportEventInfo[];
  periods: DatasetPeriod[];
  activeTab: string;
  selectedYear?: number;
  selectedMonth?: number;
  /** Server-rendered "Acces clientului" section shown inside the Setari tab. */
  accessSection?: React.ReactNode;
  /** Server-rendered "Publicare" section shown inside the Setari tab. */
  publishSection?: React.ReactNode;
  /** Publish status bar for the currently selected (year, month) — only set
   *  when on balanta/cpp tabs. Server-fetched. */
  publishBar?: React.ReactNode;
  /** Server-rendered "Istoric actiuni" section shown inside the Setari tab. */
  auditSection?: React.ReactNode;
  /** Optional cashflow year search param (?cashflow-year=YYYY). Driven by
   *  the year selector inside MapariCashflowTab. */
  cashflowYear?: number;
  /** Server-loaded Mapari Cashflow data — populated only when the page
   *  was loaded with `?tab=mapari-cashflow`, so other entry points
   *  (Jurnal, Balanta, …) don't pay the 16k-line aggregation cost on
   *  first paint. When the user reaches Mapari via an in-page tab
   *  switch this is null and MapariCashflowTab fetches client-side. */
  mapariData: MapariCashflowData | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "jurnal", label: "Registru Jurnal" },
  { key: "balanta", label: "Balanta de Verificare" },
  { key: "cpp", label: "Cont Profit si Pierdere" },
  { key: "plan", label: "Plan de Conturi" },
  { key: "mapari-cashflow", label: "Mapari Cashflow" },
  { key: "setari", label: "Setari" },
];

type LoadState<T> = { kind: "loading" } | { kind: "ready"; data: T } | { kind: "error" };

function balanceKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function ClientDetail({
  client,
  dataVersion,
  entryCount,
  importEvents,
  periods,
  activeTab,
  selectedYear,
  selectedMonth,
  accessSection,
  publishSection,
  publishBar,
  auditSection,
  cashflowYear,
  mapariData,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unmappedRows, setUnmappedRows] = useState<BalanceRowView[]>([]);
  const initialTab = (TABS.find((t) => t.key === activeTab) ? activeTab : "jurnal") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);

  // Per-(year, month) cache for the /api/balance payload. Keys are stable
  // strings; values track loading vs. ready vs. error so the UI can render
  // the correct state without a separate boolean.
  // Mapari Cashflow owns its own fetch (see MapariCashflowTab). The parent
  // only caches Balanta because that path is read-mostly with infrequent
  // mutations, where the cache wipe-on-dataVersion pattern works cleanly.
  // Mapari is edit-heavy and the wipe-then-refetch pattern caused the
  // "Se incarca maparile..." flicker on every save.
  const [balanceCache, setBalanceCache] = useState<Map<string, LoadState<BalancePayload>>>(
    () => new Map()
  );
  const balanceCacheRef = useRef(balanceCache);
  balanceCacheRef.current = balanceCache;
  const balanceInFlight = useRef<Set<string>>(new Set());

  // External mutations (journal upload, override save, …) bump dataVersion.
  // When that changes, drop every cached payload AND clear in-flight markers
  // so the next visit refetches. Render-phase compare keeps it synchronous.
  // The Plan tab owns its own dataVersion-keyed fetch, so we don't need to
  // touch any plan cache here.
  const lastVersion = useRef(dataVersion);
  if (lastVersion.current !== dataVersion) {
    lastVersion.current = dataVersion;
    balanceInFlight.current = new Set();
    if (balanceCache.size > 0) setBalanceCache(new Map());
  }

  // Keep local `tab` in sync if the URL changes externally (e.g. server
  // re-render after a period change). Cheap — string compare.
  useEffect(() => {
    if (initialTab !== tab) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // Lazy-fetch /api/balance when the active tab needs it and we don't have
  // data for the (year, month) yet. No abort: the fetch always runs to
  // completion and writes into the cache. Switching tab during fetch reuses
  // the in-flight response when it arrives — no wasted network calls.
  useEffect(() => {
    if (tab !== "balanta" && tab !== "cpp") return;
    if (!selectedYear || !selectedMonth) return;
    const key = balanceKey(selectedYear, selectedMonth);
    if (balanceCacheRef.current.has(key)) return;
    if (balanceInFlight.current.has(key)) return;

    balanceInFlight.current.add(key);
    setBalanceCache((prev) =>
      prev.has(key) ? prev : new Map(prev).set(key, { kind: "loading" })
    );

    fetch(
      `/api/balance?clientId=${client.id}&year=${selectedYear}&month=${selectedMonth}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        const payload: BalancePayload = {
          rows: (data.rows ?? []) as BalanceRowView[],
          kpis: data.kpis ?? null,
          cpp: data.cpp ?? null,
          cppF20: data.cppF20 ?? null,
          taxRegime: data.taxRegime ?? null,
        };
        setBalanceCache((prev) => new Map(prev).set(key, { kind: "ready", data: payload }));
        setUnmappedRows(payload.rows.filter((r) => r.unmapped));
      })
      .catch(() => {
        setBalanceCache((prev) => new Map(prev).set(key, { kind: "error" }));
      })
      .finally(() => {
        balanceInFlight.current.delete(key);
      });
  }, [tab, selectedYear, selectedMonth, client.id]);

  const needsPeriod = tab === "balanta" || tab === "cpp";

  function changeTab(next: Tab) {
    setTab(next);
    // Keep the URL in sync without triggering a navigation. Refresh-safe and
    // shareable; `router.push` would re-run the server component (~50-500ms).
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    if (!needsPeriodForTab(next)) {
      url.searchParams.delete("year");
      url.searchParams.delete("month");
    }
    window.history.replaceState({}, "", url.toString());
  }

  function changePeriod(year: number, month: number) {
    // Period changes affect server-rendered surfaces (publish bar, audit
    // section, current status) so we navigate. Cache layer keeps it cheap.
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("year", String(year));
    params.set("month", String(month));
    router.push(`/clients/${client.slug}?${params.toString()}`);
  }

  const balanceState =
    selectedYear && selectedMonth
      ? balanceCache.get(balanceKey(selectedYear, selectedMonth)) ?? null
      : null;
  const balanceData =
    balanceState?.kind === "ready" ? balanceState.data : null;
  const balanceLoading = balanceState?.kind === "loading";

  /**
   * Called by PlanConturiTab after a successful inline mutation (rename a
   * cont, toggle review). The server action also bumps Client.dataVersion;
   * the next server render of this page will see the new value and pass it
   * down, which both the page-level caches (balanta, mapari) and the Plan
   * tab itself use to invalidate.
   *
   * We force a refresh here to pick up that new dataVersion immediately,
   * without waiting for the next user interaction.
   */
  function invalidatePlanForCurrentPeriod() {
    router.refresh();
  }

  return (
    <div className="page-data px-4 py-6 sm:px-8 sm:py-8">
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Clienti
      </Link>

      <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-[22px] sm:text-[28px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {client.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs text-gray">
            {client.cui && <span>CUI {client.cui}</span>}
            {client.caen && <span>CAEN {client.caen}</span>}
            <span>{entryCount.toLocaleString("ro-RO")} intrari</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {needsPeriod && selectedYear && selectedMonth && (
            <PeriodSelector
              periods={periods}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onChange={(y, m) => changePeriod(y, m)}
            />
          )}
          <a
            href={`/clients/${client.slug}?view=owner`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Vezi ce vede ${client.name} cand intra in Costify`}
          >
            <Button variant="ghost">
              <Eye size={14} /> <span className="hidden sm:inline">Vezi ca firma</span>
            </Button>
          </a>
          <Link href={`/clients/${client.slug}/import`}>
            <Button variant="primary">
              <Upload size={14} /> <span className="hidden sm:inline">Upload</span> Jurnal
            </Button>
          </Link>
        </div>
      </div>

      <TabBar active={tab} onTabChange={changeTab} />

      {(tab === "balanta" || tab === "cpp") && selectedYear && selectedMonth && publishBar && (
        <div className="mt-4">{publishBar}</div>
      )}

      {unmappedRows.length > 0 && (tab === "balanta" || tab === "cpp") && (
        <div className="mt-4">
          <UnmappedBanner rows={unmappedRows} />
        </div>
      )}

      <div className="mt-4">
        {tab === "jurnal" && <JournalGrid clientId={client.id} />}

        {tab === "balanta" && selectedYear && selectedMonth && (
          <BalantaTab
            rows={balanceData?.rows ?? null}
            kpis={balanceData?.kpis ?? null}
            loading={balanceLoading || balanceState === null}
          />
        )}

        {tab === "cpp" && selectedYear && selectedMonth && (
          <CppTab
            year={selectedYear}
            cpp={balanceData?.cpp ?? null}
            cppF20={balanceData?.cppF20 ?? null}
            taxRegime={balanceData?.taxRegime ?? "profit_standard"}
            loading={balanceLoading || balanceState === null}
          />
        )}

        {tab === "plan" && (
          <PlanConturiTab
            clientId={client.id}
            clientSlug={client.slug}
            year={selectedYear}
            month={selectedMonth}
            dataVersion={dataVersion}
            onMutated={invalidatePlanForCurrentPeriod}
          />
        )}

        {/* Mapari mounts when the tab is active. If the page server-loaded
            the payload (direct link with ?tab=mapari-cashflow), it paints
            instantly via initialData. Otherwise the tab fetches on mount
            (~450ms, one spinner) and caches the result so subsequent
            re-entries are 0ms. */}
        {tab === "mapari-cashflow" && (
          <MapariCashflowTab
            clientId={client.id}
            initialData={mapariData}
            initialYear={cashflowYear}
            dataVersion={dataVersion}
          />
        )}
        

        {tab === "setari" && (
          <SetariTab
            client={client}
            entryCount={entryCount}
            onOpenDeleteModal={() => setDeleteOpen(true)}
            accessSection={accessSection}
            publishSection={publishSection}
            auditSection={auditSection}
          />
        )}

        {(tab === "balanta" || tab === "cpp") && (!selectedYear || !selectedMonth) && (
          <EmptyState message="Nu exista date. Uploadeaza un registru jurnal." />
        )}
      </div>

      <DeleteJournalModal
        clientId={client.id}
        clientName={client.name}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onComplete={() => router.refresh()}
      />
    </div>
  );
}

function needsPeriodForTab(t: Tab): boolean {
  return t === "balanta" || t === "cpp";
}

function TabBar({ active, onTabChange }: { active: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-dark-2 p-1 w-full sm:w-fit overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onTabChange(t.key)}
          className={`shrink-0 rounded-md px-3 py-2 text-xs sm:text-sm sm:px-4 font-medium transition-colors ${
            active === t.key
              ? "bg-primary text-[#E9E8E3]"
              : "text-gray hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-3 py-16">
      <p className="text-sm text-gray">{message}</p>
    </div>
  );
}
