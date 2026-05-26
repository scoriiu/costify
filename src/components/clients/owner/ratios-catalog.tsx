/**
 * RatiosCatalog — §10 L2 ratio catalog.
 *
 * Grouped by domain (Lichiditate / Profitabilitate / Solvabilitate / Eficienta).
 * Each ratio shows: label, current value, target band, state color, and a
 * one-paragraph interpretation in plain Romanian.
 *
 * Interactive: click a group header to collapse it, click a ratio row to expand
 * its detailed interpretation. All client-side state.
 */

"use client";

import { useMemo, useState } from "react";
import type { FinancialRatio } from "@/modules/reporting/owner";
import { ChevronDown } from "lucide-react";

const GROUP_META: Array<{ id: FinancialRatio["group"]; label: string; description: string }> = [
  {
    id: "lichiditate",
    label: "Lichiditate",
    description: "Cat de usor poate firma sa-si plateasca obligatiile imediate.",
  },
  {
    id: "profitabilitate",
    label: "Profitabilitate",
    description: "Cat de bine transforma vanzarile in profit.",
  },
  {
    id: "solvabilitate",
    label: "Solvabilitate",
    description: "Cat de mult e firma finantata din capital propriu vs imprumuturi.",
  },
  {
    id: "eficienta",
    label: "Eficienta operationala",
    description: "Cat de rapid incaseaza, plateste si genereaza cifra de afaceri.",
  },
];

const STATE_DOT: Record<FinancialRatio["state"], string> = {
  good: "bg-green",
  neutral: "bg-primary/60",
  warn: "bg-warn",
  danger: "bg-danger",
  unknown: "bg-dark-3",
};

const STATE_VALUE: Record<FinancialRatio["state"], string> = {
  good: "text-green",
  neutral: "text-white",
  warn: "text-warn",
  danger: "text-danger",
  unknown: "text-gray",
};

function formatRatio(value: number | null, format: FinancialRatio["format"]): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const fmt0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  switch (format) {
    case "percent":
      return `${fmt1.format(value)}%`;
    case "days":
      return `${fmt0.format(value)} zile`;
    case "lei":
      return Math.abs(value) >= 1000
        ? `${fmt0.format(Math.round(value))} lei`
        : `${fmt2.format(value)} lei`;
    case "ratio":
    default:
      return Math.abs(value) >= 100 ? fmt0.format(value) : fmt2.format(value);
  }
}

interface RatiosCatalogProps {
  ratios: FinancialRatio[];
}

export function RatiosCatalog({ ratios }: RatiosCatalogProps) {
  const grouped = useMemo(() => {
    const map = new Map<FinancialRatio["group"], FinancialRatio[]>();
    for (const r of ratios) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return map;
  }, [ratios]);

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <div className="mb-5">
        <h3
          className="text-[16px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Indicatori financiari detaliati
        </h3>
        <p
          className="mt-1 text-[12px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Cei mai folositi indicatori, calculati automat din datele firmei.
          Apasa pe oricare pentru detalii.
        </p>
      </div>

      <div className="space-y-5">
        {GROUP_META.map((group) => {
          const items = grouped.get(group.id) ?? [];
          if (items.length === 0) return null;
          return <RatioGroup key={group.id} group={group} items={items} />;
        })}
      </div>
    </div>
  );
}

function RatioGroup({
  group,
  items,
}: {
  group: { id: FinancialRatio["group"]; label: string; description: string };
  items: FinancialRatio[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 pb-2 text-left transition-colors hover:text-white"
      >
        <div className="min-w-0">
          <span
            className="font-mono text-[11px] font-semibold uppercase text-gray-light"
            style={{ letterSpacing: "0.04em" }}
          >
            {group.label}
          </span>
          <p
            className="text-[12px] text-gray mt-0.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            {group.description}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-dark-3/60 border-t border-dark-3/60">
          {items.map((ratio) => (
            <RatioRow key={ratio.id} ratio={ratio} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RatioRow({ ratio }: { ratio: FinancialRatio }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-baseline justify-between gap-3 py-3 text-left transition-colors hover:bg-dark-3/30 -mx-2 px-2 rounded-md"
      >
        <div className="min-w-0 flex items-baseline gap-3">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${STATE_DOT[ratio.state]}`}
            aria-hidden
          />
          <div className="min-w-0">
            <div
              className="text-[14px] font-medium text-white truncate"
              style={{ letterSpacing: "-0.02em" }}
            >
              {ratio.label}
            </div>
            <div
              className="font-mono text-[10px] uppercase text-gray mt-0.5"
              style={{ letterSpacing: "0.04em" }}
            >
              {ratio.formula}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-mono text-[16px] font-semibold tabular-nums ${STATE_VALUE[ratio.state]}`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {formatRatio(ratio.value, ratio.format)}
          </div>
          {ratio.target && (
            <div
              className="font-mono text-[10px] text-gray"
              style={{ letterSpacing: "0.04em" }}
            >
              tinta {ratio.target}
            </div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="ml-5 mb-3 -mt-1 rounded-md border-l-2 border-primary/40 bg-dark-3/30 px-3 py-2">
          <p
            className="text-[12px] text-gray-light leading-relaxed"
            style={{ letterSpacing: "-0.02em" }}
          >
            {ratio.interpretation}
          </p>
        </div>
      )}
    </li>
  );
}
