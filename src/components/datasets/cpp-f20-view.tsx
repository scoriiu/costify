"use client";

import type { CppF20Data, CppF20Line, CppVerticalColumn } from "@/modules/reporting";
import { Tooltip } from "@/components/ui/tooltip";
import { buildLineColorMap } from "@/lib/line-colors";

interface Props {
  cpp: CppF20Data;
}

// Each business-line (axis B) column carries the same color as its pillar in
// the "Linii de business" view; a divider brackets the group.
const lobDivider = (i: number) => (i === 0 ? "border-l border-dark-3" : "");

const SECTION_LABELS: Record<CppF20Line["section"], string> = {
  A: "CIFRA DE AFACERI NETA",
  B: "VENITURI DIN EXPLOATARE",
  C: "CHELTUIELI DIN EXPLOATARE",
  D: "REZULTAT DIN EXPLOATARE",
  E: "VENITURI FINANCIARE",
  F: "CHELTUIELI FINANCIARE",
  G: "REZULTAT FINANCIAR / TOTALE / IMPOZIT / REZULTAT NET",
};

export function CppF20View({ cpp }: Props) {
  const grouped = groupBySection(cpp.lines);
  const verticals = cpp.verticals ?? [];
  const hasBreakdown = verticals.length > 0;
  const colors = buildLineColorMap(verticals);
  const baseCols = 4; // Rand, Denumire, Conturi, Valoare
  const totalCols = baseCols + verticals.length;

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
              <th className="sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray w-[68px]">
                Rand
              </th>
              <th className="sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray">
                Denumire
              </th>
              <th className="sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-left font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray w-[160px]">
                Conturi
              </th>
              {verticals.map((v, i) => {
                const c = colors.get(v.id)!;
                return (
                  <th
                    key={v.id}
                    className={`sticky top-0 z-10 bg-dark-2 border-r border-white/[0.04] px-3 py-2.5 text-right font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray w-[110px] ${lobDivider(i)}`}
                  >
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
                      {v.name}
                    </span>
                  </th>
                );
              })}
              <th className={`sticky top-0 z-10 bg-dark-2 px-3 py-2.5 text-right font-mono text-[0.6rem] font-medium uppercase tracking-widest ${hasBreakdown ? "text-white border-l border-dark-3" : "text-gray"} w-[150px]`}>
                {hasBreakdown ? "Total (RON)" : "Valoare (RON)"}
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ section, lines }) => (
              <SectionBlock
                key={section}
                section={section}
                lines={lines}
                verticals={verticals}
                totalCols={totalCols}
              />
            ))}
          </tbody>
        </table>
      </div>

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
  verticals,
  totalCols,
}: {
  section: CppF20Line["section"];
  lines: CppF20Line[];
  verticals: CppVerticalColumn[];
  totalCols: number;
}) {
  return (
    <>
      <tr className="border-b border-dark-3 bg-dark-2/60">
        <td colSpan={totalCols} className="px-3 py-2">
          <span className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-white">
            {section}. {SECTION_LABELS[section]}
          </span>
        </td>
      </tr>
      {lines.map((line) => (
        <F20Row key={line.rowNumber} line={line} verticals={verticals} />
      ))}
    </>
  );
}

function verticalCells(
  line: CppF20Line,
  verticals: CppVerticalColumn[],
  tone: "muted" | "strong" | "result",
  py: string
) {
  return verticals.map((v, i) => {
    const value = line.byVertical?.[v.id];
    const empty = value === undefined || value === 0;
    const cls =
      tone === "result" && value !== undefined && !empty
        ? value >= 0 ? "text-green" : "text-danger"
        : tone === "strong" ? "text-white/90" : "text-gray-light";
    const weight = tone === "muted" ? "" : "font-semibold";
    return (
      <td key={v.id} className={`border-r border-white/[0.04] ${lobDivider(i)} px-3 ${py} text-right`}>
        <span className={`font-mono text-xs ${weight} ${cls}`}>
          {empty ? "" : formatValue(value)}
        </span>
      </td>
    );
  });
}

function F20Row({ line, verticals }: { line: CppF20Line; verticals: CppVerticalColumn[] }) {
  if (line.kind === "total") {
    const isRezultat = line.label.toUpperCase().includes("REZULTAT");
    const valueClass = isRezultat
      ? line.value >= 0 ? "text-green" : "text-danger"
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
        {verticalCells(line, verticals, isRezultat ? "result" : "strong", "py-2")}
        <td className={`px-3 py-2 text-right ${verticals.length > 0 ? "border-l border-dark-3" : ""}`}>
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
        {verticalCells(line, verticals, "strong", "py-1.5")}
        <td className={`px-3 py-1.5 text-right ${verticals.length > 0 ? "border-l border-dark-3" : ""}`}>
          <span className="font-mono text-xs font-semibold text-white/90">
            {formatValue(line.value)}
          </span>
        </td>
      </tr>
    );
  }

  // detail or info — info rows ("- din care: ...") narrate a subset of the
  // parent's sum and are styled lighter to visually anchor them as sub-info.
  const accountsLabel = (line.accounts ?? []).join(", ");
  const isInfo = line.kind === "info";
  return (
    <tr className="border-b border-dark-3/50 hover:bg-dark-2/40">
      <td className="border-r border-white/[0.04] px-3 py-1.5 font-mono text-[0.7rem] text-gray">
        {line.rowNumber}
      </td>
      <td
        className="border-r border-white/[0.04] px-3 py-1.5"
        style={{ paddingLeft: `${12 + line.indent * 16}px` }}
      >
        <span className={`text-xs ${isInfo ? "text-gray" : "text-gray-light"}`}>
          {line.label}
        </span>
      </td>
      <td className="border-r border-white/[0.04] px-3 py-1.5">
        <span className="font-mono text-[0.65rem] text-gray/80">{accountsLabel || "—"}</span>
      </td>
      {verticalCells(line, verticals, "muted", "py-1.5")}
      <td className={`px-3 py-1.5 text-right ${verticals.length > 0 ? "border-l border-dark-3" : ""}`}>
        <span className={`font-mono text-xs ${isInfo ? "text-gray" : "text-white"}`}>
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
