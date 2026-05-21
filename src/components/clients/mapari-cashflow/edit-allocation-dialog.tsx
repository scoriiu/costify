"use client";

/**
 * Edit allocation dialog opened by clicking a cont row in the verticals
 * accordion. Surfaces:
 *
 *   - Current allocation visualised as a color-coded bar + legend with
 *     percents and per-vertical rulaj amounts.
 *   - "Schimbă alocarea" → opens an inline edit form with one row per
 *     vertical (mirrors SplitPopover but as part of the same modal so the
 *     contabil never sees stacked modals).
 *   - "Înapoi la implicit" → clears any explicit allocation, the cont falls
 *     back to the firm's default vertical (Toata firma).
 *
 * Splits are strictly between real verticals (isDefault === false). To send
 * a cont back to Toata firma the user uses "Înapoi la implicit", not a split
 * row with the default vertical.
 */

import { useState, useTransition } from "react";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { VerticalView, AllocationSplit } from "@/modules/verticals/types";
import type { AccountListItem } from "@/modules/categories";
import {
  setAllocationAction,
  clearAllocationAction,
} from "@/modules/verticals/actions";

const VERTICAL_COLORS = [
  "bg-primary",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
] as const;
const DEFAULT_COLOR = "bg-gray/40";

interface Props {
  open: boolean;
  account: AccountListItem;
  verticals: VerticalView[];
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditAllocationDialog({
  open,
  account,
  verticals,
  clientId,
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");

  if (!open) return null;

  function handleClose() {
    setMode("view");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-dark-3 bg-dark-2"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader account={account} onClose={handleClose} />
        {mode === "view" ? (
          <ViewMode
            account={account}
            verticals={verticals}
            clientId={clientId}
            onEdit={() => setMode("edit")}
            onSaved={() => {
              onSaved();
              handleClose();
            }}
          />
        ) : (
          <EditMode
            account={account}
            verticals={verticals}
            clientId={clientId}
            onCancel={() => setMode("view")}
            onSaved={() => {
              onSaved();
              handleClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function DialogHeader({
  account,
  onClose,
}: {
  account: AccountListItem;
  onClose: () => void;
}) {
  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;
  return (
    <div className="flex items-start justify-between gap-3 p-5 border-b border-dark-3">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[13px] text-white tabular-nums">
            {account.cont}
          </span>
          <span
            className="text-[14px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
            title={account.denumire}
          >
            {account.denumire}
          </span>
        </div>
        <p
          className="mt-1 font-mono text-[11px] text-gray tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          rulaj total {formatRon(rulaj)} lei
          {" · "}
          {account.kind === "expense" ? "cheltuiala" : "venit"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 text-gray hover:text-white rounded"
        aria-label="Inchide"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function ViewMode({
  account,
  verticals,
  clientId,
  onEdit,
  onSaved,
}: {
  account: AccountListItem;
  verticals: VerticalView[];
  clientId: string;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;

  const segments = buildSegments(account, verticals);

  function backToDefault() {
    if (
      !confirm(
        `Sterg alocarea pentru ${account.cont}? Contul va merge la "Toata firma".`
      )
    )
      return;
    startTransition(async () => {
      await clearAllocationAction({ clientId, cont: account.cont });
      onSaved();
    });
  }

  const hasExplicitAllocation =
    account.currentAllocation !== null &&
    account.currentAllocation.splits.length > 0;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h4
          className="font-mono text-[10px] uppercase tracking-wider text-gray mb-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          Alocare curenta
        </h4>

        <AllocationBar segments={segments} />

        <ul className="mt-3 space-y-2">
          {segments.map((seg) => (
            <li
              key={seg.verticalId}
              className="flex items-baseline gap-3 px-3 py-2 rounded-md bg-dark-3/30"
            >
              <span
                className={`inline-block h-3 w-3 rounded-sm shrink-0 ${seg.color}`}
                aria-hidden
              />
              <span
                className="flex-1 text-[13px] text-gray-light truncate"
                style={{ letterSpacing: "-0.02em" }}
                title={seg.name}
              >
                {seg.name}
              </span>
              <span className="font-mono text-[12px] text-white tabular-nums shrink-0">
                {seg.percent}%
              </span>
              <span className="font-mono text-[11px] text-gray-light tabular-nums shrink-0 min-w-[100px] text-right">
                {formatRon((rulaj * seg.percent) / 100)}{" "}
                <span className="text-gray">lei</span>
              </span>
            </li>
          ))}
        </ul>

        {!hasExplicitAllocation && (
          <p
            className="mt-3 text-[11px] text-gray italic"
            style={{ letterSpacing: "-0.02em" }}
          >
            Acest cont nu are alocare explicita — mosteneste verticala
            implicita a firmei (Toata firma).
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-dark-3">
        {hasExplicitAllocation ? (
          <button
            type="button"
            onClick={backToDefault}
            disabled={pending}
            className="text-[12px] text-gray hover:text-rose-300 underline underline-offset-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Inapoi la implicit
          </button>
        ) : (
          <span />
        )}
        <Button onClick={onEdit} disabled={pending}>
          Schimba alocarea
          <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

function EditMode({
  account,
  verticals,
  clientId,
  onCancel,
  onSaved,
}: {
  account: AccountListItem;
  verticals: VerticalView[];
  clientId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const splittable = verticals.filter((v) => !v.isDefault);

  // Pre-fill with current splits, or with the first real vertical at 100% to
  // give the contabil a sane starting point.
  const initial: AllocationSplit[] =
    account.currentAllocation && account.currentAllocation.splits.length > 0
      ? account.currentAllocation.splits
      : splittable.length > 0
      ? [{ verticalId: splittable[0].id, percent: 100 }]
      : [];

  const [rows, setRows] = useState<AllocationSplit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = rows.reduce(
    (s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0),
    0
  );
  const valid =
    total === 100 && rows.every((r) => r.verticalId && r.percent > 0);

  function updatePercent(idx: number, percent: number) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, percent: Math.max(0, Math.min(100, Math.round(percent))) }
          : r
      )
    );
  }

  function updateVertical(idx: number, verticalId: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, verticalId } : r))
    );
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.verticalId));
    const available = splittable.find((v) => !used.has(v.id));
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
        scope: account.cont !== account.contBase ? "analytic" : "contBase",
        cont: account.cont,
        splits: rows,
      });
      if (r.error) setError(r.error);
      else onSaved();
    });
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <h4
          className="font-mono text-[10px] uppercase tracking-wider text-gray mb-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Imparte intre verticale
        </h4>
        <p
          className="text-[11px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Procentele trebuie sa sumeze 100%. Splitul distribuie rulajul
          exclusiv intre liniile de business reale.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={row.verticalId}
                onChange={(v) => updateVertical(idx, v)}
                placeholder="— alege verticala —"
                options={buildVerticalOptions(splittable, row.verticalId, verticals)}
              />
            </div>
            <input
              type="number"
              min={0}
              max={100}
              value={row.percent}
              onChange={(e) =>
                updatePercent(idx, parseInt(e.target.value || "0", 10))
              }
              className="w-20 rounded-[10px] border border-dark-3 bg-dark-2 px-3 h-10 text-right font-mono text-[13px] text-gray-light tabular-nums"
            />
            <span className="font-mono text-[12px] text-gray shrink-0">%</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="p-1.5 text-gray hover:text-rose-300"
                aria-label="Sterge"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-[11px]">
        <div className="flex gap-3">
          {rows.length < 5 && rows.length < splittable.length && (
            <button
              type="button"
              onClick={addRow}
              className="text-primary hover:text-primary-light underline underline-offset-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              + Adauga verticala
            </button>
          )}
          {rows.length >= 2 && (
            <button
              type="button"
              onClick={balance}
              className="text-primary hover:text-primary-light underline underline-offset-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              Imparte egal
            </button>
          )}
        </div>
        <span
          className={`font-mono tabular-nums ${
            total === 100 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
          }`}
        >
          Total: {total}%
        </span>
      </div>

      {error && (
        <p className="text-[12px] text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-dark-3">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Renunta
        </Button>
        <Button onClick={submit} disabled={pending || !valid}>
          Salveaza
        </Button>
      </div>
    </div>
  );
}

interface Segment {
  verticalId: string;
  name: string;
  percent: number;
  color: string;
}

/** Build the dropdown options for a split row's vertical picker.
 *  - Real splittable verticals always appear.
 *  - If the current value points at a vertical not in the splittable set (e.g.
 *    a legacy allocation that targets the default vertical, or a stale id),
 *    we include it with the resolved name so the user sees a label, not the
 *    raw cuid. Otherwise the Select primitive would fall back to rendering
 *    the value itself, which is unreadable. */
function buildVerticalOptions(
  splittable: VerticalView[],
  currentValue: string,
  allVerticals: VerticalView[]
) {
  const options = splittable.map((v) => ({ value: v.id, label: v.name }));
  if (currentValue && !splittable.some((v) => v.id === currentValue)) {
    const known = allVerticals.find((v) => v.id === currentValue);
    options.unshift({
      value: currentValue,
      label: known ? `${known.name} (nu mai e o linie de business)` : "(verticala invalida)",
    });
  }
  return options;
}

function buildSegments(
  account: AccountListItem,
  verticals: VerticalView[]
): Segment[] {
  const realVerticals = verticals.filter((v) => !v.isDefault);
  const defaultVertical = verticals.find((v) => v.isDefault);

  // When the cont has explicit allocation, map each split to its vertical.
  if (
    account.currentAllocation &&
    account.currentAllocation.splits.length > 0
  ) {
    return account.currentAllocation.splits.map((s, i) => {
      const v =
        realVerticals.find((x) => x.id === s.verticalId) ??
        verticals.find((x) => x.id === s.verticalId);
      return {
        verticalId: s.verticalId,
        name: v?.name ?? "?",
        percent: s.percent,
        color: v?.isDefault
          ? DEFAULT_COLOR
          : VERTICAL_COLORS[
              realVerticals.findIndex((x) => x.id === s.verticalId) %
                VERTICAL_COLORS.length
            ] ?? DEFAULT_COLOR,
      };
    });
  }

  // No explicit allocation → 100% goes to the firm default (Toata firma).
  if (defaultVertical) {
    return [
      {
        verticalId: defaultVertical.id,
        name: defaultVertical.name,
        percent: 100,
        color: DEFAULT_COLOR,
      },
    ];
  }
  return [];
}

function AllocationBar({ segments }: { segments: Segment[] }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-dark-3">
      {segments.map((seg) => (
        <div
          key={seg.verticalId}
          className={`h-full ${seg.color}`}
          style={{ width: `${seg.percent}%` }}
          title={`${seg.percent}% ${seg.name}`}
        />
      ))}
    </div>
  );
}

const RON = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
