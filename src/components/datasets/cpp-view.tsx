"use client";

import type { CppData, CppLine, CppVerticalColumn } from "@/modules/reporting";
import { buildLineColorMap } from "@/lib/line-colors";

interface Props {
  cpp: CppData;
}

// Each business-line (axis B) column carries the SAME color as its pillar in the
// "Linii de business" view, so the user reads it at a glance ("the teal column
// is Outsourcing"). A divider brackets the group off from Cont/Denumire/Total.
const lobDivider = (i: number) => (i === 0 ? "border-l border-dark-3" : "");

export function CppView({ cpp }: Props) {
  const verticals = cpp.verticals ?? [];
  const hasBreakdown = verticals.length > 0;
  const colors = buildLineColorMap(verticals);

  return (
    <div className="rounded-xl border border-dark-3 overflow-hidden">
      {hasBreakdown && (
        <div className="border-b border-dark-3 bg-dark-2/60 px-3 py-2">
          <span className="font-mono text-[0.6rem] uppercase tracking-widest text-gray">
            Defalcare pe linii de business, conform mapari pentru luna selectata
          </span>
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-dark-3">
              <th className="sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray min-w-[80px]">
                Cont
              </th>
              <th className="sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
                Denumire
              </th>
              {verticals.map((v, i) => {
                const c = colors.get(v.id)!;
                return (
                  <th
                    key={v.id}
                    className={`sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-right font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray min-w-[110px] ${lobDivider(i)}`}
                  >
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
                      {v.name}
                    </span>
                  </th>
                );
              })}
              <th className={`sticky top-0 z-10 bg-dark-2 px-3 py-2.5 text-right font-mono text-[0.6rem] font-medium uppercase tracking-widest text-white min-w-[130px] ${hasBreakdown ? "border-l border-dark-3" : ""}`}>
                Total (RON)
              </th>
            </tr>
          </thead>
          <tbody>
            {cpp.lines.map((line, i) => (
              <CppRow key={i} line={line} verticals={verticals} />
            ))}
          </tbody>
        </table>
      </div>

      <SummaryFooter cpp={cpp} />
    </div>
  );
}

function CppRow({ line, verticals }: { line: CppLine; verticals: CppVerticalColumn[] }) {
  if (line.isHeader) {
    return (
      <tr className="border-b border-dark-3 bg-dark-2/60">
        <td className="border-r border-white/[0.04] px-3 py-2.5" colSpan={2}>
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-white">
            {line.denumire}
          </span>
        </td>
        {verticals.map((v, i) => (
          <td key={v.id} className={`border-r border-white/[0.04] ${lobDivider(i)}`} />
        ))}
        <td className={verticals.length > 0 ? "border-l border-dark-3" : ""} />
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
          <span className="font-mono text-xs font-bold text-white">{line.denumire}</span>
        </td>
        {verticals.map((v, i) => {
          const value = line.byVertical?.[v.id];
          const cls = isResultat && value !== undefined
            ? value >= 0 ? "text-green" : "text-danger"
            : "text-gray-light";
          return (
            <td key={v.id} className={`border-r border-white/[0.04] ${lobDivider(i)} px-3 py-2 text-right`}>
              <span className={`font-mono text-xs font-semibold ${cls}`}>
                {value === undefined ? "" : formatValue(value)}
              </span>
            </td>
          );
        })}
        <td className={`px-3 py-2 text-right ${verticals.length > 0 ? "border-l border-dark-3" : ""}`}>
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
      <td
        className="border-r border-white/[0.04] px-3 py-1.5"
        style={{ paddingLeft: `${12 + line.indent * 16}px` }}
      >
        <span className="text-xs text-gray-light">{line.denumire}</span>
      </td>
      {verticals.map((v, i) => {
        const value = line.byVertical?.[v.id];
        return (
          <td key={v.id} className={`border-r border-white/[0.04] ${lobDivider(i)} px-3 py-1.5 text-right`}>
            <span className="font-mono text-xs text-gray-light">
              {value === undefined || value === 0 ? "" : formatValue(value)}
            </span>
          </td>
        );
      })}
      <td className={`px-3 py-1.5 text-right ${verticals.length > 0 ? "border-l border-dark-3" : ""}`}>
        <span className="font-mono text-xs text-white">{formatValue(line.value)}</span>
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
