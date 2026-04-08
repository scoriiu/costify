"use client";

import type { CppData, CppLine } from "@/modules/reporting";

interface Props {
  cpp: CppData;
}

export function CppView({ cpp }: Props) {
  return (
    <div className="rounded-xl border border-dark-3 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-dark-2 border-b border-dark-3">
            <th className="border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray min-w-[80px]">
              Cont
            </th>
            <th className="border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
              Denumire
            </th>
            <th className="px-3 py-2.5 text-right font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray min-w-[130px]">
              Valoare (RON)
            </th>
          </tr>
        </thead>
        <tbody>
          {cpp.lines.map((line, i) => (
            <CppRow key={i} line={line} />
          ))}
        </tbody>
      </table>

      <SummaryFooter cpp={cpp} />
    </div>
  );
}

function CppRow({ line }: { line: CppLine }) {
  if (line.isHeader) {
    return (
      <tr className="border-b border-dark-3 bg-dark-2/60">
        <td className="border-r border-white/[0.04] px-3 py-2.5" colSpan={2}>
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-white">
            {line.denumire}
          </span>
        </td>
        <td />
      </tr>
    );
  }

  if (line.isTotal) {
    const isResultat = line.denumire.toUpperCase().includes("REZULTAT");
    const colorClass = isResultat
      ? line.value >= 0 ? "text-green" : "text-danger"
      : "text-white";

    return (
      <tr className="border-b border-dark-3 bg-dark-2/30">
        <td className="border-r border-white/[0.04] px-3 py-2" />
        <td className="border-r border-white/[0.04] px-3 py-2">
          <span className="font-mono text-xs font-bold text-white">
            {line.denumire}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <span className={`font-mono text-xs font-bold ${colorClass}`}>
            {formatValue(line.value)}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-dark-3/50 hover:bg-dark-2/40">
      <td className="border-r border-white/[0.04] px-3 py-1.5">
        <span className="font-mono text-xs text-gray">{line.cont}</span>
      </td>
      <td className="border-r border-white/[0.04] px-3 py-1.5" style={{ paddingLeft: `${12 + line.indent * 16}px` }}>
        <span className="text-xs text-gray-light">{line.denumire}</span>
      </td>
      <td className="px-3 py-1.5 text-right">
        <span className="font-mono text-xs text-gray-light">
          {formatValue(line.value)}
        </span>
      </td>
    </tr>
  );
}

function SummaryFooter({ cpp }: { cpp: CppData }) {
  const items = [
    { label: "Rezultat exploatare", value: cpp.rezultatExploatare },
    { label: "Rezultat financiar", value: cpp.rezultatFinanciar },
    { label: "Rezultat brut", value: cpp.rezultatBrut },
    { label: "Rezultat net", value: cpp.rezultatNet },
  ];

  return (
    <div className="grid grid-cols-4 gap-px border-t border-dark-3 bg-dark-3">
      {items.map((item) => (
        <div key={item.label} className="bg-dark-2 px-4 py-3 text-center">
          <div className="font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
            {item.label}
          </div>
          <div className={`mt-1 font-mono text-sm font-bold ${item.value >= 0 ? "text-green" : "text-danger"}`}>
            {formatValue(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(n: number): string {
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
