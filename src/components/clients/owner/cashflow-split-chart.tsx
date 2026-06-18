/**
 * CashflowSplitChart — §8 Operating / Investing / Financing decomposition.
 *
 * Top: 3 large columns with the net contribution of each cash-flow type, plus
 * the start/end cash and net change.
 *
 * Bottom: tabs let the user expand each column into its detail rows (top
 * inflows + top outflows for Operating, asset moves for Investing, loans /
 * dividends for Financing).
 */

"use client";

import { useState } from "react";
import type { CashflowBreakdown } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";
import { ChartInfo } from "./chart-info";

type Tab = "operating" | "investing" | "financing";

const TAB_META: Array<{ id: Tab; label: string; description: string }> = [
  {
    id: "operating",
    label: "Operational",
    description: "Cash din activitatea de zi cu zi: clienti, furnizori, salarii, taxe.",
  },
  {
    id: "investing",
    label: "Investitii",
    description: "Cumparari/vanzari de echipamente, cladiri, imobilizari financiare.",
  },
  {
    id: "financing",
    label: "Finantare",
    description: "Imprumuturi luate/rambursate, dividende platite, aporturi de capital.",
  },
];

interface CashflowSplitChartProps {
  data: CashflowBreakdown;
}

export function CashflowSplitChart({ data }: CashflowSplitChartProps) {
  const [tab, setTab] = useState<Tab>("operating");

  const detail =
    tab === "operating"
      ? data.operatingDetail
      : tab === "investing"
        ? data.investingDetail
        : data.financingDetail;

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3
            className="inline-flex items-center gap-2 text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Cum a circulat cash-ul
            <ChartInfo text="Imparte miscarea banilor lunii in 3 cosuri. Operational: activitatea de zi cu zi (incasari de la clienti, plati catre furnizori, salarii). Investitii: echipamente si dotari cumparate sau vandute. Finantare: credite luate sau rambursate si dividende. Asa vezi DE CE s-au schimbat banii, nu doar cu cat." />
          </h3>
          <p
            className="mt-1 text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Defalcat pe Operational / Investitii / Finantare. Modelul standard cerut de banci si investitori.
          </p>
        </div>
        <div
          className="font-mono text-[11px] uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Variatie luna
        </div>
      </div>

      {/* Top summary row */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-5">
        <SummaryTile label="Cash inceput" value={data.cashStart} tone="neutral" />
        <ColumnTile label="Operational" value={data.operating} active={tab === "operating"} onClick={() => setTab("operating")} />
        <ColumnTile label="Investitii" value={data.investing} active={tab === "investing"} onClick={() => setTab("investing")} />
        <ColumnTile label="Finantare" value={data.financing} active={tab === "financing"} onClick={() => setTab("financing")} />
        <SummaryTile label="Cash final" value={data.cashEnd} tone="neutral" />
      </div>

      {/* Tab description */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p
          className="text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          {TAB_META.find((t) => t.id === tab)!.description}
        </p>
        <div
          className="font-mono text-[10px] uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Top miscari
        </div>
      </div>

      {/* Detail rows */}
      <DetailList items={detail} />

      {/* Net change footer */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-dark-3 pt-4">
        <span
          className="font-mono text-[11px] uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Variatie totala cash luna
        </span>
        <span
          className={`font-mono text-[18px] font-semibold tabular-nums ${data.netChange >= 0 ? "text-green" : "text-danger"}`}
          style={{ letterSpacing: "-0.04em" }}
        >
          {data.netChange >= 0 ? "+" : ""}{lei(data.netChange)}
        </span>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number; tone: "neutral" }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-dark-3 bg-dark-3/30 p-3.5">
      <span
        className="font-mono text-[10px] uppercase text-gray"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
      <span
        className="font-mono text-[18px] font-semibold leading-none text-white tabular-nums"
        style={{ letterSpacing: "-0.04em" }}
      >
        {lei(value)}
      </span>
    </div>
  );
}

function ColumnTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  const positive = value >= 0;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-all ${
        active
          ? "border-primary/50 bg-primary/[0.08]"
          : "border-dark-3 bg-dark-3/30 hover:border-primary/30 hover:bg-primary/[0.04]"
      }`}
    >
      <span
        className="font-mono text-[10px] uppercase text-gray"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[18px] font-semibold leading-none tabular-nums ${
          positive ? "text-green" : "text-danger"
        }`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {positive ? "+" : ""}{lei(value)}
      </span>
    </button>
  );
}

function DetailList({ items }: { items: CashflowBreakdown["operatingDetail"] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-dark-3 bg-dark-3/20 p-4 text-center">
        <p
          className="text-[12px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nicio miscare semnificativa pe aceasta linie de cost luna asta.
        </p>
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => {
        const widthPct = (item.value / max) * 100;
        const isIn = item.kind === "in";
        return (
          <li
            key={idx}
            className="grid grid-cols-[1fr_140px] items-center gap-3 rounded-lg border border-dark-3/60 bg-dark-3/20 px-3 py-2"
          >
            <div className="min-w-0 flex items-center gap-2.5">
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase shrink-0 ${
                  isIn ? "bg-green/15 text-green" : "bg-danger/15 text-danger"
                }`}
                style={{ letterSpacing: "0.04em" }}
              >
                {isIn ? "Intrare" : "Iesire"}
              </span>
              <span
                className="text-[13px] text-white truncate"
                style={{ letterSpacing: "-0.02em" }}
              >
                {item.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-dark-3 rounded-full overflow-hidden">
                <div
                  className={`h-full ${isIn ? "bg-green" : "bg-danger"} transition-all duration-500`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span
                className={`font-mono text-[12px] font-semibold tabular-nums shrink-0 w-[68px] text-right ${
                  isIn ? "text-green" : "text-danger"
                }`}
                style={{ letterSpacing: "-0.04em" }}
              >
                {isIn ? "+" : "−"}{lei(item.value)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
