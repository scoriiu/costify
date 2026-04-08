"use client";

import { useState } from "react";
import type { BalanceRowView } from "@/modules/balances";

interface Props {
  rows: BalanceRowView[];
}

type ViewMode = "full" | "leaf";

export function BalanceTable({ rows }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("leaf");
  const [search, setSearch] = useState("");

  const filtered = filterRows(rows, viewMode, search);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
        <input
          type="text"
          placeholder="Cauta cont..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-1.5 font-mono text-xs text-white placeholder:text-gray focus:border-primary focus:outline-none"
        />
        <span className="ml-auto font-mono text-[0.6rem] text-gray">
          {filtered.length} conturi
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-dark-3">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-dark-2 border-b border-dark-3">
              <Th align="left" first>Cont</Th>
              <Th align="left">Denumire</Th>
              <Th>Sold in D</Th>
              <Th>Sold in C</Th>
              <Th>Rulaj D</Th>
              <Th>Rulaj C</Th>
              <Th>Total D</Th>
              <Th>Total C</Th>
              <Th>Sold fin D</Th>
              <Th last>Sold fin C</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <BalanceRow key={row.cont} row={row} />
            ))}
          </tbody>
          <tfoot>
            <TotalRow rows={filtered} />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function BalanceRow({ row }: { row: BalanceRowView }) {
  const isParent = row.hasChild;

  return (
    <tr className={`border-b border-dark-3/50 hover:bg-dark-2/40 ${isParent ? "text-white font-semibold" : "text-gray-light"}`}>
      <Td align="left" first>
        <span className="font-mono text-xs">{row.cont}</span>
      </Td>
      <Td align="left">
        <span className="text-xs truncate max-w-[250px] inline-block">{row.denumire}</span>
      </Td>
      <Td><Num value={row.soldInD} /></Td>
      <Td><Num value={row.soldInC} /></Td>
      <Td><Num value={row.rulajD} /></Td>
      <Td><Num value={row.rulajC} /></Td>
      <Td><Num value={row.totalDeb} /></Td>
      <Td><Num value={row.totalCred} /></Td>
      <Td><Num value={row.finD} highlight /></Td>
      <Td last><Num value={row.finC} highlight /></Td>
    </tr>
  );
}

function TotalRow({ rows }: { rows: BalanceRowView[] }) {
  const leafRows = rows.filter((r) => r.isLeaf);
  const totals = leafRows.reduce(
    (acc, r) => ({
      soldInD: acc.soldInD + r.soldInD,
      soldInC: acc.soldInC + r.soldInC,
      rulajD: acc.rulajD + r.rulajD,
      rulajC: acc.rulajC + r.rulajC,
      totalDeb: acc.totalDeb + r.totalDeb,
      totalCred: acc.totalCred + r.totalCred,
      finD: acc.finD + r.finD,
      finC: acc.finC + r.finC,
    }),
    { soldInD: 0, soldInC: 0, rulajD: 0, rulajC: 0, totalDeb: 0, totalCred: 0, finD: 0, finC: 0 }
  );

  return (
    <tr className="border-t-2 border-dark-3 bg-dark-2 font-bold text-white">
      <Td align="left" first><span className="font-mono text-xs">TOTAL</span></Td>
      <Td align="left" />
      <Td><Num value={totals.soldInD} /></Td>
      <Td><Num value={totals.soldInC} /></Td>
      <Td><Num value={totals.rulajD} /></Td>
      <Td><Num value={totals.rulajC} /></Td>
      <Td><Num value={totals.totalDeb} /></Td>
      <Td><Num value={totals.totalCred} /></Td>
      <Td><Num value={totals.finD} highlight /></Td>
      <Td last><Num value={totals.finC} highlight /></Td>
    </tr>
  );
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-dark-2 p-0.5">
      {(["leaf", "full"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1 font-mono text-[0.65rem] font-medium transition-colors ${
            mode === m ? "bg-primary text-[#E9E8E3]" : "text-gray hover:text-white"
          }`}
        >
          {m === "leaf" ? "Analitice" : "Toate"}
        </button>
      ))}
    </div>
  );
}

function Th({
  children,
  align = "right",
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  first?: boolean;
  last?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray ${
        align === "right" ? "text-right" : "text-left"
      } ${!last ? "border-r border-white/[0.04]" : ""} ${first ? "min-w-[80px]" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "right",
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  first?: boolean;
  last?: boolean;
}) {
  return (
    <td
      className={`px-3 py-1.5 ${align === "right" ? "text-right" : "text-left"} ${
        !last ? "border-r border-white/[0.04]" : ""
      } ${first ? "min-w-[80px]" : ""}`}
    >
      {children}
    </td>
  );
}

function Num({ value, highlight }: { value: number; highlight?: boolean }) {
  if (Math.abs(value) < 0.01) {
    return <span className="font-mono text-xs text-dark-4">-</span>;
  }

  const formatted = value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className={`font-mono text-xs ${highlight ? "text-white" : ""}`}>
      {formatted}
    </span>
  );
}

function filterRows(rows: BalanceRowView[], mode: ViewMode, search: string): BalanceRowView[] {
  let filtered = mode === "leaf" ? rows.filter((r) => r.isLeaf) : rows;

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) => r.cont.toLowerCase().includes(q) || r.denumire.toLowerCase().includes(q)
    );
  }

  return filtered;
}
