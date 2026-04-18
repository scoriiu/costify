"use client";

import type { CppF20Data, CppF20Line } from "@/modules/reporting";
import { Tooltip } from "@/components/ui/tooltip";

interface Props {
  cpp: CppF20Data;
}

const SECTION_LABELS: Record<CppF20Line["section"], string> = {
  A: "VENITURI DIN EXPLOATARE",
  B: "CHELTUIELI DIN EXPLOATARE",
  C: "REZULTAT DIN EXPLOATARE",
  D: "VENITURI FINANCIARE",
  E: "CHELTUIELI FINANCIARE",
  F: "REZULTAT FINANCIAR",
  G: "REZULTAT BRUT / NET",
};

export function CppF20View({ cpp }: Props) {
  const grouped = groupBySection(cpp.lines);

  return (
    <div className="rounded-xl border border-dark-3 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-dark-2 border-b border-dark-3">
            <th className="border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray w-[68px]">
              Rand
            </th>
            <th className="border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
              Denumire
            </th>
            <th className="border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray w-[160px]">
              Conturi
            </th>
            <th className="px-3 py-2.5 text-right font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray w-[150px]">
              Valoare (RON)
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ section, lines }) => (
            <SectionBlock key={section} section={section} lines={lines} />
          ))}
        </tbody>
      </table>

      <SummaryFooter cpp={cpp} />
    </div>
  );
}

interface GroupedSection {
  section: CppF20Line["section"];
  lines: CppF20Line[];
}

function groupBySection(lines: CppF20Line[]): GroupedSection[] {
  const out: GroupedSection[] = [];
  for (const line of lines) {
    const last = out[out.length - 1];
    if (last && last.section === line.section) {
      last.lines.push(line);
    } else {
      out.push({ section: line.section, lines: [line] });
    }
  }
  return out;
}

function SectionBlock({
  section,
  lines,
}: {
  section: CppF20Line["section"];
  lines: CppF20Line[];
}) {
  return (
    <>
      <tr className="border-b border-dark-3 bg-dark-2/60">
        <td
          colSpan={4}
          className="px-3 py-2"
        >
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-white">
            {section}. {SECTION_LABELS[section]}
          </span>
        </td>
      </tr>
      {lines.map((line) => (
        <F20Row key={line.rowNumber} line={line} />
      ))}
    </>
  );
}

function F20Row({ line }: { line: CppF20Line }) {
  if (line.kind === "total") {
    const isRezultat = line.label.toUpperCase().includes("REZULTAT");
    const valueClass = isRezultat
      ? line.value >= 0
        ? "text-green"
        : "text-danger"
      : "text-white";
    return (
      <tr className="border-b border-dark-3 bg-dark-2/30">
        <td className="border-r border-white/[0.04] px-3 py-2 font-mono text-[0.7rem] text-gray">
          {line.rowNumber}
        </td>
        <td className="border-r border-white/[0.04] px-3 py-2" colSpan={2}>
          <span className="font-mono text-xs font-bold text-white">{line.label}</span>
          {line.formula && (
            <Tooltip content={`Formula: ${line.formula}`}>
              <span className="ml-2 font-mono text-[0.6rem] text-gray/60">?</span>
            </Tooltip>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <span className={`font-mono text-xs font-bold ${valueClass}`}>
            {formatValue(line.value)}
          </span>
        </td>
      </tr>
    );
  }

  if (line.kind === "subtotal") {
    return (
      <tr className="border-b border-dark-3/50 bg-dark-2/20">
        <td className="border-r border-white/[0.04] px-3 py-1.5 font-mono text-[0.7rem] text-gray">
          {line.rowNumber}
        </td>
        <td
          className="border-r border-white/[0.04] px-3 py-1.5"
          style={{ paddingLeft: `${12 + line.indent * 16}px` }}
          colSpan={2}
        >
          <span className="font-mono text-xs font-semibold text-white/90">{line.label}</span>
          {line.formula && (
            <Tooltip content={`Formula: ${line.formula}`}>
              <span className="ml-2 font-mono text-[0.6rem] text-gray/60">?</span>
            </Tooltip>
          )}
        </td>
        <td className="px-3 py-1.5 text-right">
          <span className="font-mono text-xs font-semibold text-white/90">
            {formatValue(line.value)}
          </span>
        </td>
      </tr>
    );
  }

  // detail
  const accountsLabel = (line.accounts ?? []).join(", ");
  return (
    <tr className="border-b border-dark-3/50 hover:bg-dark-2/40">
      <td className="border-r border-white/[0.04] px-3 py-1.5 font-mono text-[0.7rem] text-gray">
        {line.rowNumber}
      </td>
      <td
        className="border-r border-white/[0.04] px-3 py-1.5"
        style={{ paddingLeft: `${12 + line.indent * 16}px` }}
      >
        <span className="text-xs text-gray-light">{line.label}</span>
      </td>
      <td className="border-r border-white/[0.04] px-3 py-1.5">
        <span className="font-mono text-[0.65rem] text-gray/80">
          {accountsLabel || "—"}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right">
        <span className="font-mono text-xs text-gray-light">
          {formatValue(line.value)}
        </span>
      </td>
    </tr>
  );
}

function SummaryFooter({ cpp }: { cpp: CppF20Data }) {
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
          <div
            className={`mt-1 font-mono text-sm font-bold ${
              item.value >= 0 ? "text-green" : "text-danger"
            }`}
          >
            {formatValue(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
