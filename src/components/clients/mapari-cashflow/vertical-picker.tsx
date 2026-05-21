"use client";

/**
 * VerticalPicker — single-cont vertical assignment widget.
 *
 * Three states:
 *   - inherits (no allocation row) → label "Toata firma" greyed out, dropdown
 *     offers verticals + "Impartit..." that opens the split popover,
 *   - assigned single (one split at 100%) → label = vertical name in normal
 *     weight, dropdown lets you switch to another vertical or open Impartit,
 *   - assigned split (2+ splits) → label "Impartit (NN% Out / NN% Cow)",
 *     click opens the popover pre-filled.
 *
 * The popover validates locally (sum=100 indicator). Save button disabled until
 * valid; on save calls setAllocationAction and refreshes the page.
 */

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AllocationScope,
  AllocationSplit,
  VerticalView,
} from "@/modules/verticals";
import {
  setAllocationAction,
  clearAllocationAction,
} from "@/modules/verticals/actions";

interface Props {
  clientId: string;
  /** Cont this picker controls. The scope is decided by the parent based on
   *  whether the accountant is editing the base or the analytic. */
  cont: string;
  contBase: string;
  scope: AllocationScope;
  verticals: VerticalView[];
  currentSplits: AllocationSplit[] | null;
  defaultVertical: VerticalView | null;
}

export function VerticalPicker({
  clientId,
  cont,
  contBase,
  scope,
  verticals,
  currentSplits,
  defaultVertical,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label = currentSplits
    ? labelFor(currentSplits, verticals)
    : defaultVertical?.name ?? "Toata firma";

  const isInherited = currentSplits === null;
  const isSplit = currentSplits !== null && currentSplits.length > 1;

  // For split allocations, build the segment data once for the bar. The
  // bar itself communicates the split visually — text only summarises count.
  const splitSegments = isSplit
    ? buildSplitSegments(currentSplits, verticals)
    : null;

  // Splits are only possible when the firm has at least 2 real (non-default)
  // verticals. With 1 or 0 there is nothing meaningful to split.
  const canSplit = verticals.filter((v) => !v.isDefault).length >= 2;

  function assignSingle(verticalId: string) {
    setOpen(false);
    startTransition(async () => {
      await setAllocationAction({
        clientId,
        scope,
        cont: scope === "analytic" ? cont : contBase,
        splits: [{ verticalId, percent: 100 }],
      });
      router.refresh();
    });
  }

  function unassign() {
    setOpen(false);
    startTransition(async () => {
      await clearAllocationAction({
        clientId,
        cont: scope === "analytic" ? cont : contBase,
      });
      router.refresh();
    });
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          title={label}
          className={`flex flex-col w-full text-left rounded-[10px] border bg-dark-2 px-3 font-mono text-sm transition-colors ${
            isSplit
              ? "border-amber-500/40 hover:border-amber-400/60 gap-1.5 py-2 min-h-[40px]"
              : "border-dark-3 hover:border-primary/40 h-10 justify-center"
          } ${isInherited ? "text-gray italic" : "text-gray-light"}`}
          style={{ letterSpacing: "-0.02em" }}
        >
          {isSplit && splitSegments ? (
            <>
              <div className="flex items-center gap-1.5 leading-none">
                <SplitBar segments={splitSegments} />
                <ChevronDown size={12} className="text-gray shrink-0" />
              </div>
              <SplitLegend segments={splitSegments} />
            </>
          ) : (
            <div className="flex items-center gap-1.5 h-full">
              <span className="flex-1 truncate">{label}</span>
              <ChevronDown size={12} className="text-gray shrink-0" />
            </div>
          )}
        </button>
        {open && (
          <div
            className="absolute z-30 right-0 mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-dark-3 bg-dark-2 py-1 shadow-lg"
          >
            {!isInherited && (
              <button
                type="button"
                onClick={unassign}
                className="block w-full text-left px-3 py-2 text-[12px] text-gray hover:bg-dark-3 italic"
                style={{ letterSpacing: "-0.02em" }}
              >
                Inapoi la implicit ({defaultVertical?.name ?? "Toata firma"})
              </button>
            )}
            {verticals
              .filter((v) => !v.isDefault)
              .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => assignSingle(v.id)}
                  className="block w-full text-left px-3 py-2 text-[13px] text-gray-light hover:bg-dark-3"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {v.name}
                </button>
              ))}
            {defaultVertical && (
              <button
                type="button"
                onClick={() => assignSingle(defaultVertical.id)}
                className="block w-full text-left px-3 py-2 text-[13px] text-gray-light hover:bg-dark-3"
                style={{ letterSpacing: "-0.02em" }}
              >
                {defaultVertical.name}
              </button>
            )}
            {canSplit && (
              <div className="border-t border-dark-3 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSplitOpen(true);
                  }}
                  className="block w-full text-left px-3 py-2 text-[13px] text-primary hover:bg-dark-3"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Impartit intre mai multe verticale...
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {splitOpen && (
        <SplitPopover
          clientId={clientId}
          cont={cont}
          contBase={contBase}
          scope={scope}
          verticals={verticals}
          initialSplits={currentSplits ?? []}
          onClose={() => setSplitOpen(false)}
          onSaved={() => {
            setSplitOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function labelFor(splits: AllocationSplit[], verticals: VerticalView[]): string {
  if (splits.length === 1) {
    const v = verticals.find((x) => x.id === splits[0].verticalId);
    return v?.name ?? "(verticala stearsa)";
  }
  return splits
    .map((s) => {
      const v = verticals.find((x) => x.id === s.verticalId);
      return `${s.percent}% ${v?.name ?? "?"}`;
    })
    .join(" · ");
}

/* -------------------------------------------------------------------------- */
/*                              SPLIT POPOVER                                 */
/* -------------------------------------------------------------------------- */

function SplitPopover({
  clientId,
  cont,
  contBase,
  scope,
  verticals,
  initialSplits,
  onClose,
  onSaved,
}: {
  clientId: string;
  cont: string;
  contBase: string;
  scope: AllocationScope;
  verticals: VerticalView[];
  initialSplits: AllocationSplit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // The split popover ONLY deals with real business verticals. "Toata firma"
  // (the implicit default vertical) is the fallback for un-allocated rulaj;
  // splitting against it makes no sense. If the contabil wants the cont to
  // fall back to the default, they use "Inapoi la implicit" in the main
  // picker, not the split popover.
  const splittableVerticals = verticals.filter((v) => !v.isDefault);

  // Pre-fill the popover with current splits, or with the first 2 non-default
  // verticals at 50/50 when starting from a clean inherit state.
  const initial = initialSplits.length >= 1
    ? initialSplits
    : pickInitialDefaults(splittableVerticals);

  const [rows, setRows] = useState<AllocationSplit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = rows.reduce((s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0), 0);
  const valid = total === 100 && rows.every((r) => r.verticalId && r.percent > 0);

  function updatePercent(idx: number, percent: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, percent: Math.max(0, Math.min(100, Math.round(percent))) } : r))
    );
  }

  function updateVertical(idx: number, verticalId: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, verticalId } : r)));
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.verticalId));
    const available = splittableVerticals.find((v) => !used.has(v.id));
    if (!available) return;
    setRows((prev) => [...prev, { verticalId: available.id, percent: 0 }]);
  }

  function balance() {
    if (rows.length === 0) return;
    const even = Math.floor(100 / rows.length);
    const remainder = 100 - even * rows.length;
    setRows((prev) =>
      prev.map((r, i) => ({ ...r, percent: even + (i === 0 ? remainder : 0) }))
    );
  }

  function submit() {
    setError(null);
    if (!valid) {
      setError(`Procentele trebuie sa sumeze 100 (acum ${total})`);
      return;
    }
    startTransition(async () => {
      const r = await setAllocationAction({
        clientId,
        scope,
        cont: scope === "analytic" ? cont : contBase,
        splits: rows,
      });
      if (r.error) setError(r.error);
      else onSaved();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-dark-3 bg-dark-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Imparte intre verticale
        </h3>
        <p
          className="mt-1 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Cont {scope === "analytic" ? cont : contBase}. Procentele trebuie sa sumeze 100%.
        </p>
        <p
          className="mt-2 text-[11px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Splitul distribuie rulajul exclusiv intre liniile de business reale.
          Daca vrei sa-l lasi in general (Toata firma), inchide modalul si alege
          &quot;Inapoi la implicit&quot;.
        </p>

        <ul className="mt-4 space-y-2">
          {rows.map((row, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <select
                value={row.verticalId}
                onChange={(e) => updateVertical(idx, e.target.value)}
                className="flex-1 rounded-md border border-dark-3 bg-dark-3/50 px-2 h-8 text-[13px] text-gray-light"
                style={{ letterSpacing: "-0.02em" }}
              >
                <option value="">— alege verticala —</option>
                {splittableVerticals.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={row.percent}
                onChange={(e) => updatePercent(idx, parseInt(e.target.value || "0", 10))}
                className="w-16 rounded-md border border-dark-3 bg-dark-3/50 px-2 h-8 text-right font-mono text-[13px] text-gray-light tabular-nums"
              />
              <span className="text-[11px] text-gray font-mono shrink-0">%</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-1 text-gray hover:text-rose-300"
                  title="Sterge"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-3">
            {rows.length < 5 && rows.length < splittableVerticals.length && (
              <button
                type="button"
                onClick={addRow}
                className="text-[11px] text-primary hover:text-primary-light underline underline-offset-2"
                style={{ letterSpacing: "-0.02em" }}
              >
                + Adauga verticala
              </button>
            )}
            <button
              type="button"
              onClick={balance}
              className="text-[11px] text-primary hover:text-primary-light underline underline-offset-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              Imparte egal
            </button>
          </div>
          <span
            className={`font-mono text-[12px] tabular-nums ${
              total === 100 ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            Total: {total}%
          </span>
        </div>

        {error && (
          <p className="mt-2 text-[11px] text-rose-300">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Renunta
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={pending || !valid}
          >
            {pending ? "Se salveaza..." : "Salveaza"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          SPLIT VISUALISATION                               */
/* -------------------------------------------------------------------------- */

interface SplitSegment {
  verticalId: string;
  name: string;
  percent: number;
  color: string;
}

/** Stable color palette for vertical segments. Order is intentional — first
 *  segment gets teal (primary brand), second amber, third sky, etc. — so a
 *  60/40 split always reads "primary line + secondary line" visually. */
const SEGMENT_COLORS = [
  "bg-primary/70",
  "bg-amber-400/70",
  "bg-sky-400/70",
  "bg-emerald-400/70",
  "bg-rose-400/70",
] as const;

function buildSplitSegments(
  splits: AllocationSplit[],
  verticals: VerticalView[]
): SplitSegment[] {
  return splits.map((s, i) => {
    const v = verticals.find((x) => x.id === s.verticalId);
    return {
      verticalId: s.verticalId,
      name: v?.name ?? "?",
      percent: s.percent,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    };
  });
}

function SplitBar({ segments }: { segments: SplitSegment[] }) {
  return (
    <div className="flex flex-1 min-w-0 h-1.5 overflow-hidden rounded-full bg-dark-3">
      {segments.map((seg) => (
        <div
          key={seg.verticalId}
          className={`h-full ${seg.color} transition-opacity hover:opacity-80`}
          style={{ width: `${seg.percent}%` }}
          title={`${seg.percent}% ${seg.name}`}
        />
      ))}
    </div>
  );
}

function SplitLegend({ segments }: { segments: SplitSegment[] }) {
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-tight">
      {segments.map((seg) => (
        <li
          key={seg.verticalId}
          className="flex items-center gap-1 min-w-0"
          title={`${seg.percent}% ${seg.name}`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-sm shrink-0 ${seg.color}`}
            aria-hidden
          />
          <span className="text-gray-light tabular-nums shrink-0">
            {seg.percent}%
          </span>
          <span className="text-gray truncate" style={{ letterSpacing: "-0.02em" }}>
            {seg.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function pickInitialDefaults(verticals: VerticalView[]): AllocationSplit[] {
  const nonDefault = verticals.filter((v) => !v.isDefault);
  if (nonDefault.length >= 2) {
    return [
      { verticalId: nonDefault[0].id, percent: 50 },
      { verticalId: nonDefault[1].id, percent: 50 },
    ];
  }
  if (nonDefault.length === 1) {
    return [{ verticalId: nonDefault[0].id, percent: 100 }];
  }
  if (verticals.length > 0) {
    return [{ verticalId: verticals[0].id, percent: 100 }];
  }
  return [];
}
