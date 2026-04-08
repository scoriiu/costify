"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DatasetPeriod } from "@/modules/balances";
import { PeriodSelector } from "@/components/datasets/period-selector";
import { JournalGrid } from "@/components/journal/journal-grid";
import { BalantaTab } from "@/components/clients/balanta-tab";
import { CppTab } from "@/components/clients/cpp-tab";

type Tab = "jurnal" | "balanta" | "cpp";

interface ImportEventInfo {
  id: string;
  fileName: string;
  entriesAdded: number;
  dateStart: string | null;
  dateEnd: string | null;
  status: string;
  createdAt: string;
}

interface Props {
  client: { id: string; slug: string; name: string; cui: string | null; caen: string | null };
  entryCount: number;
  importEvents: ImportEventInfo[];
  periods: DatasetPeriod[];
  activeTab: string;
  selectedYear?: number;
  selectedMonth?: number;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "jurnal", label: "Registru Jurnal" },
  { key: "balanta", label: "Balanta de Verificare" },
  { key: "cpp", label: "Cont Profit si Pierdere" },
];

export function ClientDetail({
  client,
  entryCount,
  importEvents,
  periods,
  activeTab,
  selectedYear,
  selectedMonth,
}: Props) {
  const router = useRouter();
  const tab = (TABS.find((t) => t.key === activeTab) ? activeTab : "jurnal") as Tab;

  function navigate(params: { tab?: string; year?: number; month?: number }) {
    const p = new URLSearchParams();
    p.set("tab", params.tab ?? tab);
    if (params.year) p.set("year", String(params.year));
    if (params.month) p.set("month", String(params.month));
    router.push(`/clients/${client.slug}?${p.toString()}`);
  }

  const needsPeriod = tab === "balanta" || tab === "cpp";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Clienti
      </Link>

      <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] sm:text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
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
              onChange={(y, m) => navigate({ year: y, month: m })}
            />
          )}
          <Link href={`/clients/${client.slug}/import`}>
            <Button variant="primary">
              <Upload size={14} /> <span className="hidden sm:inline">Upload</span> Jurnal
            </Button>
          </Link>
        </div>
      </div>

      <TabBar active={tab} onTabChange={(t) => navigate({ tab: t, year: selectedYear, month: selectedMonth })} />

      <div className="mt-4">
        {tab === "jurnal" && (
          <JournalGrid clientId={client.id} />
        )}
        {tab === "balanta" && selectedYear && selectedMonth && (
          <BalantaTab clientId={client.id} year={selectedYear} month={selectedMonth} />
        )}
        {tab === "cpp" && selectedYear && selectedMonth && (
          <CppTab clientId={client.id} year={selectedYear} month={selectedMonth} />
        )}
        {(tab === "balanta" || tab === "cpp") && (!selectedYear || !selectedMonth) && (
          <EmptyState message="Nu exista date. Uploadeaza un registru jurnal." />
        )}
      </div>
    </div>
  );
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
