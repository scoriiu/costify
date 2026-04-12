"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { BalanceRowView } from "@/modules/balances";

interface Props {
  rows: BalanceRowView[];
}

function formatNum(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function UnmappedBanner({ rows }: Props) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-warn/20 bg-warn/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-warn/10 cursor-pointer"
      >
        <AlertTriangle size={14} className="shrink-0 text-warn" />
        <span className="font-mono text-xs text-warn">
          {rows.length} {rows.length === 1 ? "cont nemapat" : "conturi nemapate"}
        </span>
        <span className="text-[11px] text-gray">
          — nu sunt in catalogul OMFP 1802
        </span>
        <ChevronDown
          size={14}
          className={`ml-auto text-warn/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-warn/10">
          <table className="w-full border-separate border-spacing-0 font-mono text-xs">
            <thead>
              <tr className="bg-warn/[0.04]">
                <th className="px-4 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-warn/60">Cont</th>
                <th className="px-4 py-2 text-left font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-warn/60">Denumire</th>
                <th className="px-4 py-2 text-right font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-warn/60">Sold final D</th>
                <th className="px-4 py-2 text-right font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-warn/60">Sold final C</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cont} className="border-t border-warn/[0.06] transition-colors hover:bg-warn/[0.04]">
                  <td className="px-4 py-2 font-semibold text-warn">{r.cont}</td>
                  <td className="px-4 py-2 text-gray-light">{r.denumire}</td>
                  <td className="px-4 py-2 text-right text-gray-light tabular-nums">{r.finD !== 0 ? formatNum(r.finD) : "—"}</td>
                  <td className="px-4 py-2 text-right text-gray-light tabular-nums">{r.finC !== 0 ? formatNum(r.finC) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-warn/10 px-4 py-3">
            <p className="text-[11px] leading-[1.6] text-gray">
              Aceste conturi nu sunt coduri standard in planul OMFP 1802.
              Denumirea afisata este cea din import sau din contul parinte.
              Verificati daca sunt conturi analitice specifice sau conturi lipsa din catalog.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
