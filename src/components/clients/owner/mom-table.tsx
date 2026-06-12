/**
 * MomTable — month-over-month numbers from the snapshot's trends array.
 *
 * The numeric companion of MonthTimeline: venituri / cheltuieli / profit /
 * marja / bani la final per month, with the delta vs the previous month.
 * Rendered in detailed mode only — the timeline cards cover the simple mode.
 */

import type { MonthlyTrendPoint } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";
import { ChartInfo } from "./chart-info";

interface MomTableProps {
  trends: MonthlyTrendPoint[];
}

const HEADER_CELL =
  "py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray text-right border-r border-white/[0.04]";

function deltaPct(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function DeltaCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray">·</span>;
  const tone = value >= 0 ? "text-green" : "text-danger";
  return (
    <span className={tone}>
      {value >= 0 ? "+" : ""}
      {value.toLocaleString("ro-RO", { maximumFractionDigits: 0 })}%
    </span>
  );
}

export function MomTable({ trends }: MomTableProps) {
  if (trends.length < 2) return null;

  const rows = trends.map((t, i) => {
    const prev = i > 0 ? trends[i - 1] : undefined;
    return {
      ...t,
      marja: t.revenue > 0 ? (t.profit / t.revenue) * 100 : null,
      deltaVenituri: deltaPct(t.revenue, prev?.revenue),
      deltaProfit: deltaPct(t.profit, prev?.profit),
    };
  });

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <header>
        <h3
          className="inline-flex items-center gap-2 text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Luna de luna, in cifre
          <ChartInfo text="Aceleasi luni, ca tabel cu cifre exacte. Coloana 'Fata de luna trecuta' arata cu cat la suta a crescut sau a scazut castigul fata de luna precedenta: verde inseamna crestere, rosu scadere. Marja arata cat la suta din venituri a ramas castig." />
        </h3>
        <p className="mt-0.5 text-[11px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Aceleasi luni, ca tabel. Procentele arata schimbarea fata de luna
          dinainte.
        </p>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left" data-testid="mom-table">
          <thead>
            <tr className="border-b border-dark-3">
              <th className="py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray border-r border-white/[0.04]">
                Luna
              </th>
              <th className={HEADER_CELL}>Venituri</th>
              <th className={HEADER_CELL}>Cheltuieli</th>
              <th className={HEADER_CELL}>Castig / pierdere</th>
              <th className={HEADER_CELL}>Marja</th>
              <th className={HEADER_CELL}>Fata de luna trecuta</th>
              <th className="py-2.5 px-3 font-mono text-[0.6rem] uppercase tracking-wider text-gray text-right">
                Bani la final
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.year}-${r.month}`}
                className="border-b border-dark-3/50 last:border-b-0 hover:bg-dark-2/40"
              >
                <td className="py-2 px-3 font-mono text-[12px] text-gray-light border-r border-white/[0.04]">
                  {r.monthLabel}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[12px] text-gray-light tabular-nums border-r border-white/[0.04]">
                  {lei(r.revenue)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[12px] text-gray-light tabular-nums border-r border-white/[0.04]">
                  {lei(r.expenses)}
                </td>
                <td
                  className={`py-2 px-3 text-right font-mono text-[12px] font-semibold tabular-nums border-r border-white/[0.04] ${
                    r.profit >= 0 ? "text-green" : "text-danger"
                  }`}
                >
                  {lei(r.profit)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[12px] text-gray-light tabular-nums border-r border-white/[0.04]">
                  {r.marja === null
                    ? "·"
                    : `${r.marja.toLocaleString("ro-RO", { maximumFractionDigits: 1 })}%`}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[12px] tabular-nums border-r border-white/[0.04]">
                  <DeltaCell value={r.deltaProfit} />
                </td>
                <td className="py-2 px-3 text-right font-mono text-[12px] text-gray-light tabular-nums">
                  {lei(r.cashEnd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
