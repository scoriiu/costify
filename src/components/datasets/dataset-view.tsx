"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BalanceRowView, DatasetPeriod } from "@/modules/balances";
import type { KpiSnapshot, CppData } from "@/modules/reporting";
import { KpiCards } from "./kpi-cards";
import { BalanceTable } from "./balance-table";
import { CppView } from "./cpp-view";
import { PeriodSelector } from "./period-selector";
import { useState } from "react";

interface Props {
  client: { slug: string; name: string };
  dataset: { id: string; name: string; fileName: string; createdAt: string };
  periods: DatasetPeriod[];
  selectedYear: number;
  selectedMonth: number;
  balanceRows: BalanceRowView[];
  kpis: KpiSnapshot;
  cpp: CppData;
}

type Tab = "balance" | "cpp";

export function DatasetView({
  client,
  dataset,
  periods,
  selectedYear,
  selectedMonth,
  balanceRows,
  kpis,
  cpp,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("balance");

  function handlePeriodChange(year: number, month: number) {
    router.push(
      `/clients/${client.slug}/datasets/${dataset.id}?year=${year}&month=${month}`
    );
  }

  return (
    <div>
      <Link
        href={`/clients/${client.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> {client.name}
      </Link>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1
            className="text-[28px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {dataset.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-gray">
            {dataset.fileName}
          </p>
        </div>
        <PeriodSelector
          periods={periods}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChange={handlePeriodChange}
        />
      </div>

      <KpiCards kpis={kpis} />

      <div className="mt-8">
        <TabBar tab={tab} onTabChange={setTab} />

        {tab === "balance" && (
          <BalanceTable rows={balanceRows} />
        )}
        {tab === "cpp" && (
          <CppView cpp={cpp} />
        )}
      </div>
    </div>
  );
}

function TabBar({ tab, onTabChange }: { tab: Tab; onTabChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "balance", label: "Balanta de verificare" },
    { key: "cpp", label: "Cont Profit si Pierdere" },
  ];

  return (
    <div className="mb-4 flex gap-1 rounded-lg bg-dark-2 p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onTabChange(t.key)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === t.key
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
