"use client";

/**
 * Edit allocation dialog opened from one of TWO entry points:
 *
 *   - A CONT row in the verticals accordion (the original entry — sets the
 *     cont's horizontal across lines of business).
 *   - A CATEGORY row in the Mapari Cashflow workspace (sets the category's
 *     horizontal — consulted when a partner override redirects rulaj here).
 *
 * Both flows share the EXACT same UI (split editor, validation, "balanced"
 * helper, "back to default", same Salveaza/Renunta buttons). They differ
 * only in:
 *   - Header text ("Cont 6022 · Combustibil" vs "Categorie · Servicii curierat")
 *   - Save/clear action wired into the entity by the caller.
 *
 * Surfaces:
 *
 *   - Current allocation visualised as a color-coded bar + legend with
 *     percents and per-vertical rulaj amounts.
 *   - "Schimba alocarea" → opens an inline edit form with one row per
 *     vertical (mirrors SplitPopover but as part of the same modal so the
 *     contabil never sees stacked modals).
 *   - "Inapoi la implicit" → clears any explicit allocation, the entity
 *     falls back to the firm's default vertical (Toata firma).
 *
 * Splits are strictly between real verticals (isDefault === false). To send
 * an entity back to Toata firma the user uses "Inapoi la implicit", not a
 * split row with the default vertical.
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
  setCategoryAllocationAction,
  clearCategoryAllocationAction,
} from "@/modules/verticals/actions";

const VERTICAL_COLORS = [
  "bg-primary",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
] as const;
const DEFAULT_COLOR = "bg-gray/40";

/* -------------------------------------------------------------------------- */
/*                     ENTITY ABSTRACTION (cont OR category)                  */
/* -------------------------------------------------------------------------- */

export interface AllocationDialogEntity {
  /** Visual mode + caller behaviour. */
  kind: "account" | "category";
  /** Short code shown left of the name. For accounts: cont code. null
   *  for categories (no code, only a name). */
  code: string | null;
  /** Display name. */
  name: string;
  /** Rulaj-style figure for context. For accounts: cont's gross. For
   *  categories: total inflow received from partner overrides this period. */
  rulaj: number;
  /** Drives the secondary header label ("cheltuiala" / "venit"). */
  financialKind: "expense" | "revenue";
  /** Current allocation. null = no explicit allocation, inherits firm default. */
  currentAllocation: { splits: AllocationSplit[] } | null;
  /** Bound save callback. Caller wires to the right server action. */
  save: (splits: AllocationSplit[]) => Promise<{ error?: string }>;
  /** Bound clear callback. Caller wires to the right server action. */
  clear: () => Promise<{ error?: string }>;
}

/* -------------------------------------------------------------------------- */
/*               BACKWARD-COMPAT WRAPPERS (account & category)                */
/* -------------------------------------------------------------------------- */

/**
 * Original entry point. Kept for the verticals accordion — every existing
 * caller can keep its call site verbatim.
 */
export function EditAllocationDialog({
  open,
  account,
  verticals,
  clientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: AccountListItem;
  verticals: VerticalView[];
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const entity: AllocationDialogEntity = {
    kind: "account",
    code: account.cont,
    name: account.denumire,
    rulaj: account.kind === "expense" ? account.rulajD : account.rulajC,
    financialKind: account.kind,
    currentAllocation: account.currentAllocation,
    save: (splits) =>
      setAllocationAction({
        clientId,
        scope: account.cont !== account.contBase ? "analytic" : "contBase",
        cont: account.cont,
        splits,
      }),
    clear: () => clearAllocationAction({ clientId, cont: account.cont }),
  };
  return (
    <AllocationDialogCore
      open={open}
      entity={entity}
      verticals={verticals}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

/**
 * New entry point: edits the vertical split for a CostCategory. Same UI as
 * the cont dialog — the contabil learns one concept, uses it in two places.
 */
export function EditCategoryAllocationDialog({
  open,
  categoryId,
  categoryName,
  kind,
  inflow,
  currentSplits,
  verticals,
  clientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  categoryId: string;
  categoryName: string;
  kind: "expense" | "revenue";
  /** Total inflow received from partner overrides in the period — shown as
   *  context in the header so the contabil sees how much money this split
   *  will affect. */
  inflow: number;
  /** Current allocation splits, [] when category has no explicit allocation. */
  currentSplits: AllocationSplit[];
  verticals: VerticalView[];
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const entity: AllocationDialogEntity = {
    kind: "category",
    code: null,
    name: categoryName,
    rulaj: inflow,
    financialKind: kind,
    currentAllocation: currentSplits.length > 0 ? { splits: currentSplits } : null,
    save: (splits) =>
      setCategoryAllocationAction({ clientId, categoryId, splits }),
    clear: () => clearCategoryAllocationAction({ clientId, categoryId }),
  };
  return (
    <AllocationDialogCore
      open={open}
      entity={entity}
      verticals={verticals}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                              CORE DIALOG                                   */
/* -------------------------------------------------------------------------- */

interface CoreProps {
  open: boolean;
  entity: AllocationDialogEntity;
  verticals: VerticalView[];
  onClose: () => void;
  onSaved: () => void;
}

function AllocationDialogCore({
  open,
  entity,
  verticals,
  onClose,
  onSaved,
}: CoreProps) {
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
        <DialogHeader entity={entity} onClose={handleClose} />
        {mode === "view" ? (
          <ViewMode
            entity={entity}
            verticals={verticals}
            onEdit={() => setMode("edit")}
            onSaved={() => {
              onSaved();
              handleClose();
            }}
          />
        ) : (
          <EditMode
            entity={entity}
            verticals={verticals}
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
  entity,
  onClose,
}: {
  entity: AllocationDialogEntity;
  onClose: () => void;
}) {
  const contextLabel =
    entity.kind === "account"
      ? `rulaj total ${formatRon(entity.rulaj)} lei · ${
          entity.financialKind === "expense" ? "cheltuiala" : "venit"
        }`
      : entity.rulaj > 0
        ? `primeste ${formatRon(entity.rulaj)} lei din exceptii de partener · ${
            entity.financialKind === "expense" ? "cheltuiala" : "venit"
          }`
        : `categorie · ${
            entity.financialKind === "expense" ? "cheltuiala" : "venit"
          }`;

  return (
    <div className="flex items-start justify-between gap-3 p-5 border-b border-dark-3">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          {entity.code && (
            <span className="font-mono text-[13px] text-white tabular-nums">
              {entity.code}
            </span>
          )}
          <span
            className="text-[14px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
            title={entity.name}
          >
            {entity.name}
          </span>
        </div>
        <p
          className="mt-1 font-mono text-[11px] text-gray tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          {contextLabel}
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
  entity,
  verticals,
  onEdit,
  onSaved,
}: {
  entity: AllocationDialogEntity;
  verticals: VerticalView[];
  onEdit: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const segments = buildSegments(entity, verticals);

  function backToDefault() {
    const targetLabel =
      entity.kind === "account" ? entity.code ?? entity.name : entity.name;
    if (
      !confirm(
        `Sterg alocarea pentru "${targetLabel}"? Va merge la "Toata firma".`
      )
    )
      return;
    startTransition(async () => {
      await entity.clear();
      onSaved();
    });
  }

  const hasExplicitAllocation =
    entity.currentAllocation !== null &&
    entity.currentAllocation.splits.length > 0;

  const emptyStateMessage =
    entity.kind === "account"
      ? "Acest cont nu are alocare explicita — mosteneste verticala implicita a firmei (Toata firma)."
      : "Aceasta categorie nu are alocare explicita. Banii redirectati aici prin exceptii de partener merg la verticala implicita (Toata firma). Seteaza o orizontala daca vrei sa controlezi unde merg.";

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
                {formatRon((entity.rulaj * seg.percent) / 100)}{" "}
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
            {emptyStateMessage}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-dark-3">
        {hasExplicitAllocation ? (
          <button
            type="button"
            onClick={backToDefault}
            disabled={pending}
            className="text-[12px] text-gray hover:text-neg underline underline-offset-2"
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
  entity,
  verticals,
  onCancel,
  onSaved,
}: {
  entity: AllocationDialogEntity;
  verticals: VerticalView[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const splittable = verticals.filter((v) => !v.isDefault);

  // Pre-fill with current splits, or with the first real vertical at 100% to
  // give the contabil a sane starting point.
  const initial: AllocationSplit[] =
    entity.currentAllocation && entity.currentAllocation.splits.length > 0
      ? entity.currentAllocation.splits
      : splittable.length > 0
      ? [{ verticalId: splittable[0].id, percent: 100 }]
      : [];

  const [rows, setRows] = useState<AllocationSplit[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // When true, Salveaza will clear the allocation (send back to default
  // vertical) instead of writing rows. Lets the contabil stage the change
  // and commit it with the same Salveaza button as everything else.
  const [stagedClear, setStagedClear] = useState(false);

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
    if (stagedClear) {
      startTransition(async () => {
        await entity.clear();
        onSaved();
      });
      return;
    }
    if (!valid) {
      setError(`Procentele trebuie sa sumeze 100 (acum ${total})`);
      return;
    }
    startTransition(async () => {
      const r = await entity.save(rows);
      if (r.error) setError(r.error);
      else onSaved();
    });
  }

  function stageDefault() {
    setError(null);
    setStagedClear(true);
  }

  function unstageDefault() {
    setStagedClear(false);
  }

  const defaultVertical = verticals.find((v) => v.isDefault);
  const isAlreadyOnDefault =
    !entity.currentAllocation || entity.currentAllocation.splits.length === 0;

  const canSave = stagedClear || valid;

  return (
    <div className="p-5 space-y-4">
      {stagedClear ? (
        <StagedClearNotice
          defaultName={defaultVertical?.name ?? "Toata firma"}
          onUndo={unstageDefault}
        />
      ) : (
        <SplitEditor
          rows={rows}
          splittable={splittable}
          verticals={verticals}
          total={total}
          updateVertical={updateVertical}
          updatePercent={updatePercent}
          removeRow={removeRow}
          addRow={addRow}
          balance={balance}
          defaultVertical={defaultVertical}
          isAlreadyOnDefault={isAlreadyOnDefault}
          onStageDefault={stageDefault}
        />
      )}

      {error && (
        <p className="text-[12px] text-neg" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-dark-3">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Renunta
        </Button>
        <Button onClick={submit} disabled={pending || !canSave}>
          Salveaza
        </Button>
      </div>
    </div>
  );
}

function StagedClearNotice({
  defaultName,
  onUndo,
}: {
  defaultName: string;
  onUndo: () => void;
}) {
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-3/30 p-4 space-y-2">
      <h4
        className="font-mono text-[10px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Trimitere catre {defaultName}
      </h4>
      <p
        className="text-[13px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Cand apesi <strong className="text-white">Salveaza</strong>, alocarea
        explicita va fi stearsa si totul va merge integral catre{" "}
        <strong className="text-white">{defaultName}</strong>.
      </p>
      <button
        type="button"
        onClick={onUndo}
        className="text-[11px] text-primary hover:text-primary-light underline underline-offset-2"
        style={{ letterSpacing: "-0.02em" }}
      >
        Anuleaza, vreau sa pastrez alocarea
      </button>
    </div>
  );
}

function SplitEditor({
  rows,
  splittable,
  verticals,
  total,
  updateVertical,
  updatePercent,
  removeRow,
  addRow,
  balance,
  defaultVertical,
  isAlreadyOnDefault,
  onStageDefault,
}: {
  rows: AllocationSplit[];
  splittable: VerticalView[];
  verticals: VerticalView[];
  total: number;
  updateVertical: (idx: number, v: string) => void;
  updatePercent: (idx: number, p: number) => void;
  removeRow: (idx: number) => void;
  addRow: () => void;
  balance: () => void;
  defaultVertical: VerticalView | undefined;
  isAlreadyOnDefault: boolean;
  onStageDefault: () => void;
}) {
  return (
    <>
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
                className="p-1.5 text-gray hover:text-neg"
                aria-label="Sterge"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-[11px]">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
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
          {defaultVertical && !isAlreadyOnDefault && (
            <button
              type="button"
              onClick={onStageDefault}
              className="text-gray hover:text-gray-light underline underline-offset-2"
              style={{ letterSpacing: "-0.02em" }}
              title={`Trimite la ${defaultVertical.name}.`}
            >
              Trimite la {defaultVertical.name}
            </button>
          )}
        </div>
        <span
          className={`font-mono tabular-nums ${
            total === 100 ? "text-pos" : "text-tone-warn"
          }`}
        >
          Total: {total}%
        </span>
      </div>
    </>
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
  entity: AllocationDialogEntity,
  verticals: VerticalView[]
): Segment[] {
  const realVerticals = verticals.filter((v) => !v.isDefault);
  const defaultVertical = verticals.find((v) => v.isDefault);

  if (
    entity.currentAllocation &&
    entity.currentAllocation.splits.length > 0
  ) {
    return entity.currentAllocation.splits.map((s) => {
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
