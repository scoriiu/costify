"use client";

import { useEffect, useRef, useState, useTransition, useMemo, Fragment } from "react";
import { X, AlertCircle, Check, Layers, Save } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import { useEscapeKey } from "@/lib/use-escape-key";
import {
  loadPartnerPanelAction,
  upsertPartnerOverrideAction,
  deletePartnerOverrideAction,
  bulkApplyPartnerOverridesAction,
  revalidateMapariCashflowAction,
  type PartnerPanelData,
} from "@/modules/partner-mappings/actions";
import type {
  CostCategoryNode,
  AccountListItem,
} from "@/modules/categories";
import {
  filterPartners,
  computeBulkTargets,
  computeParetoCutoff,
  sumRulaj,
  maxRulaj,
  rulajBarPercent,
  normalizeForSearch,
  type PartnerEntry,
  type PartnerFilter,
} from "@/modules/partner-mappings";

interface Props {
  /** The cont we're inspecting. Null = panel closed. */
  account: AccountListItem | null;
  clientId: string;
  period: { year: number; month: number } | null;
  tree: CostCategoryNode[];
  /** Display name of the cont's currently mapped category — used in the
   *  "Default contului" option as context. Null = no cont-mapping. */
  contCategoryName: string | null;
  onClose: () => void;
  /** Called after every save so the parent page can refresh coverage stats
   *  and the per-cont badge. */
  onMutate: () => void;
}

/**
 * Slide-in panel from the right showing every partner active on a cont
 * with a category dropdown per partner.
 *
 * The dropdown's first option is "Default contului ([category name])" which,
 * when selected for a partner that currently has an override, deletes that
 * override (the partner reverts to the cont's default). Selecting any other
 * category writes/updates a PartnerCategoryOverride.
 *
 * Sprint 2 ships the core read/write flow — pick a partner, pick a category,
 * see immediate feedback. Sprint 3 adds bulk apply + filters. Sprint 4 adds
 * suggested-state visual treatment and the cross-period memory.
 */
export function PartnerPanel({
  account,
  clientId,
  period,
  tree,
  contCategoryName,
  onClose,
  onMutate,
}: Props) {
  const [data, setData] = useState<PartnerPanelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether any in-panel mutation happened. Defers the parent
  // `onMutate` (router.refresh) until the panel closes — refreshing the
  // tree mid-edit would unmount and remount the panel and visibly flash.
  const hadMutationRef = useRef(false);

  const handleClose = () => {
    if (hadMutationRef.current) {
      // Per-row saves passed skipRevalidate:true to keep the slide-panel
      // calm during edits. The server's path cache is still stale until
      // we explicitly revalidate it on close.
      revalidateMapariCashflowAction({ clientId });
      onMutate();
      hadMutationRef.current = false;
    }
    onClose();
  };

  // Re-fetch the panel data whenever we open on a different cont (NOT
  // after a mutation — mutations are applied optimistically via
  // onLocalPatch and never trigger a refetch).
  useEffect(() => {
    if (!account || !period) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadPartnerPanelAction({
      clientId,
      contBase: account.contBase,
      year: period.year,
      month: period.month,
    }).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else if (res.data) setData(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [account, clientId, period]);

  // Flatten the category tree into Select options filtered by the cont's
  // kind. We only show LEAF categories — putting an override on a parent
  // category is the same UX problem as putting a cont-mapping on a parent
  // (and we already resolved that with leaf-only in the main workspace).
  const categoryOptions = useMemo(() => {
    if (!account) return [];
    const out: { value: string; label: string }[] = [];
    walkLeaves(tree, account.kind, "", out);
    return out;
  }, [tree, account]);

  useEscapeKey(handleClose, account !== null);

  if (!account) return null;

  return (
    <>
      {/* Backdrop — click to close. Subtle, doesn't black out the page. */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={handleClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-dark-2 border-l border-dark-3 shadow-2xl flex flex-col"
        role="dialog"
        aria-label={`Parteneri pe contul ${account.cont}`}
      >
        <PanelHeader account={account} onClose={handleClose} />

        <div className="flex-1 overflow-y-auto">
          {loading && <PanelSkeleton />}
          {error && <PanelError error={error} />}
          {data && !loading && !error && (
            <PanelBody
              data={data}
              account={account}
              clientId={clientId}
              categoryOptions={categoryOptions}
              contCategoryName={contCategoryName}
              onLocalPatch={(updater) => {
                // Optimistic local patch — no refetch, no skeleton.
                // The row component knows what changed; we apply it
                // in place. The parent page refresh is deferred to
                // close so badges and aggregates stay calm during edit.
                setData((prev) => (prev ? updater(prev) : prev));
                hadMutationRef.current = true;
              }}
              onBulkSaved={async () => {
                // Bulk apply changes many partners at once; cheaper and
                // more reliable to refetch than to mirror the server's
                // logic in the client. We do this WITHOUT toggling
                // `loading` so the panel doesn't flash to a skeleton.
                if (period && account) {
                  const res = await loadPartnerPanelAction({
                    clientId,
                    contBase: account.contBase,
                    year: period.year,
                    month: period.month,
                  });
                  if (res.data) setData(res.data);
                }
                hadMutationRef.current = true;
              }}
            />
          )}
        </div>

        <div className="border-t border-dark-3 px-4 py-3 flex justify-end">
          <Button variant="ghost" onClick={handleClose}>
            Inchide
          </Button>
        </div>
      </aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              SUB-COMPONENTS                                */
/* -------------------------------------------------------------------------- */

function PanelHeader({
  account,
  onClose,
}: {
  account: AccountListItem;
  onClose: () => void;
}) {
  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;
  return (
    <div className="px-4 py-3 border-b border-dark-3 flex items-start gap-3">
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 -ml-1.5 text-gray hover:text-white"
        aria-label="Inchide"
      >
        <X size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-[12px] text-gray tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            {account.cont}
          </span>
          <span
            className="text-[15px] font-semibold text-white truncate"
            style={{ letterSpacing: "-0.04em" }}
          >
            {account.denumire}
          </span>
        </div>
        <div
          className="mt-1 font-mono text-[11px] text-gray tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          {formatRon(Math.abs(rulaj))} lei rulaj cumulat
        </div>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 bg-dark-2 rounded animate-pulse" />
      ))}
    </div>
  );
}

function PanelError({ error }: { error: string }) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-2 rounded-lg border border-neg-border bg-neg-bg px-3 py-2">
        <AlertCircle size={14} className="text-neg shrink-0 mt-0.5" />
        <p className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          {error}
        </p>
      </div>
    </div>
  );
}

function PanelBody({
  data,
  account,
  clientId,
  categoryOptions,
  contCategoryName,
  onLocalPatch,
  onBulkSaved,
}: {
  data: PartnerPanelData;
  account: AccountListItem;
  clientId: string;
  categoryOptions: { value: string; label: string }[];
  contCategoryName: string | null;
  /** Optimistic patch applied directly to the panel data without a
   *  refetch. The PartnerRow knows what changed; passes a pure updater. */
  onLocalPatch: (
    updater: (prev: PartnerPanelData) => PartnerPanelData
  ) => void;
  /** Called after a BULK apply (many partners). Bulk needs a full refetch
   *  because the server reconciles existing-vs-new in ways too complex to
   *  mirror in the client; we just trust the server and reload. */
  onBulkSaved: () => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<PartnerFilter>("all");
  const [query, setQuery] = useState("");
  // Materialitate threshold (Claudia's tool): hide partners under X lei
  // rulaj. State holds the raw string so the contabil can clear it without
  // the input snapping back to "0". Empty string → no threshold.
  const [minRulajInput, setMinRulajInput] = useState("");
  const minRulaj = parseRulajInput(minRulajInput);

  const overridden = data.partners.filter((p) => p.override !== null);
  const overriddenRulaj = sumRulaj(overridden);
  const defaultRulaj = data.partnerRulaj - overriddenRulaj;
  const unmapped = data.partners.filter((p) => p.override === null);

  // Filter chain — same helper drives both the rendered list AND the bulk
  // target set, so what the contabil sees on screen is exactly what bulk
  // would write. Memoized so the bulk bar's count doesn't flicker on
  // unrelated re-renders.
  const visible = useMemo(
    () => filterPartners(data.partners, filter, query, minRulaj),
    [data.partners, filter, query, minRulaj]
  );
  const bulkTargets = useMemo(
    () => computeBulkTargets(data.partners, filter, query, { minRulaj }),
    [data.partners, filter, query, minRulaj]
  );
  // Partners in scope (matching the filter chain) that ALREADY have a
  // manual override — the potential overwrite set. The preview modal
  // shows this so the contabil knows how many exceptions exist and
  // explicitly chooses whether to preserve or overwrite them.
  const overriddenInScope = useMemo(
    () => visible.filter((p) => p.override !== null),
    [visible]
  );
  // Bar widths scale to the LARGEST visible partner, not absolute max.
  // That way applying "Peste 5.000 lei" doesn't collapse every remaining
  // bar to ~100% — comparisons stay meaningful within whatever subset
  // the contabil chose.
  const visibleMaxRulaj = useMemo(() => maxRulaj(visible), [visible]);
  // Pareto cutoff at 80% — splits visible partners into "head" (the ones
  // that move the books) and "tail" (long-tail noise). We render a
  // separator BETWEEN row headCount-1 and headCount so the contabil sees
  // exactly where the tail begins.
  const pareto = useMemo(() => computeParetoCutoff(visible, 80), [visible]);
  // Single gate for ALL Pareto UI (indicator + separator). Small lists
  // (<= 3 partners) don't carry enough signal to warrant a "long tail"
  // narrative — the contabil can read them at a glance.
  const showParetoUI =
    visible.length > 3 &&
    pareto.headCount > 0 &&
    pareto.tailCount > 0 &&
    pareto.totalRulaj > 0;
  const queryNorm = normalizeForSearch(query);
  const hasFilter = queryNorm.length > 0 || minRulaj > 0 || filter !== "all";
  const contCategoryId = account.currentMapping?.categoryId ?? null;

  return (
    <div className="p-4 space-y-4">
      <DistributionBlock
        accountKind={account.kind}
        contCategoryName={contCategoryName}
        partnerRulaj={data.partnerRulaj}
        overriddenRulaj={overriddenRulaj}
        defaultRulaj={defaultRulaj}
        unresolvedRulaj={data.unresolvedRulaj}
        overriddenCount={overridden.length}
        totalCount={data.partners.length}
      />

      {/* Bulk apply is the PRIMARY way to use this panel — most visits are
          about "redirect this whole cont (or a search-narrowed slice) to
          another category". We render it inline, always visible, with the
          cont's default category pre-selected so the contabil sees at a
          glance "this is where partners go by default" and only needs to
          change the dropdown to redirect. Per-row Select below stays as
          the escape hatch for the rare one-partner-only case. */}
      {bulkTargets.length > 0 && (
        <BulkActionBar
          account={account}
          clientId={clientId}
          targets={bulkTargets}
          overriddenInScope={overriddenInScope}
          isSubset={hasFilter}
          categoryOptions={categoryOptions}
          contCategoryId={contCategoryId}
          contCategoryName={contCategoryName}
          onSaved={onBulkSaved}
        />
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cauta partener..."
          />
        </div>
        <ToggleGroup<PartnerFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Toti", count: data.partners.length },
            // "Fara exceptie" is more honest than "Nemapati" — these
            // partners DO have a category (the cont's default); they just
            // don't have an individual override yet. Only treat the count
            // as a danger signal when the contabil already started
            // overriding (i.e., some have overrides, some don't) — in the
            // common all-default case it's just an info count, not work to do.
            {
              value: "unmapped",
              label: "Fara exceptie",
              count: unmapped.length,
              countTone:
                overridden.length > 0 && unmapped.length > 0
                  ? "danger"
                  : "neutral",
            },
            { value: "top10", label: "Top 10" },
          ]}
        />
      </div>

      <ThresholdInput
        value={minRulajInput}
        onChange={setMinRulajInput}
        visibleCount={visible.length}
        totalCount={data.partners.length}
        active={minRulaj > 0}
      />

      {showParetoUI && <ParetoIndicator pareto={pareto} />}

      {data.partners.length === 0 && data.unresolvedRulaj === 0 ? (
        <p
          className="text-[12px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nu sunt parteneri pe acest cont in perioada selectata.
        </p>
      ) : (
        <ul className="space-y-1">
          {visible.length === 0 ? (
            <li
              className="text-[12px] text-gray italic px-2 py-3"
              style={{ letterSpacing: "-0.02em" }}
            >
              {minRulaj > 0
                ? `Niciun partener nu trece pragul de ${formatRon(minRulaj)} lei.`
                : "Niciun partener nu se potriveste filtrului."}
            </li>
          ) : (
            visible.map((partner, index) => (
              <Fragment key={partner.nameNormalized}>
                {/* Long-tail separator: appears once, AFTER the row at
                    index pareto.headCount-1 (i.e. before the first tail
                    row). Same showParetoUI gate as the indicator. */}
                {showParetoUI && index === pareto.headCount && (
                  <LongTailSeparator pareto={pareto} />
                )}
                <PartnerRow
                  partner={partner}
                  account={account}
                  clientId={clientId}
                  categoryOptions={categoryOptions}
                  onLocalPatch={onLocalPatch}
                  maxRulaj={visibleMaxRulaj}
                />
              </Fragment>
            ))
          )}
          {data.unresolvedRulaj > 0 &&
            filter === "all" &&
            !queryNorm &&
            minRulaj === 0 && <UnresolvedRow rulaj={data.unresolvedRulaj} />}
        </ul>
      )}
    </div>
  );
}

/**
 * Bulk apply bar — the PRIMARY interaction in this panel.
 *
 * Most visits to the slide-panel are about "redirect this whole cont (or a
 * filtered slice) to another category". The bar is always visible at the
 * top of the body so the contabil can act in two clicks: change the
 * dropdown, click Aplica.
 *
 * Pre-selection: when the cont has a default category mapped, we pre-fill
 * the dropdown with that category. This is purely a LEARNING affordance —
 * the contabil sees "ah, this cont sends partners to <Combustibil> by
 * default" and only needs to change the dropdown to redirect. Picking a
 * different category and clicking Aplica writes overrides; leaving the
 * default selected and clicking Aplica is detected by the preview modal
 * (Item #6) so the user is never surprised.
 *
 * The `targets` prop comes from the parent's filter chain (toggle + search
 * + threshold), so what the contabil sees in the list below is exactly
 * what gets written. The header label switches phrasing when any filter
 * is active so the contabil knows they're acting on a SUBSET.
 */
function BulkActionBar({
  account,
  clientId,
  targets,
  overriddenInScope,
  isSubset,
  categoryOptions,
  contCategoryId,
  contCategoryName,
  onSaved,
}: {
  account: AccountListItem;
  clientId: string;
  /** Partners that bulk will actually write IN SKIP MODE — already filtered
   *  by the parent's toggle + search + threshold AND with existing overrides
   *  excluded. */
  targets: PartnerEntry[];
  /** Partners matching the same filter chain that already have a manual
   *  override. Surfaced in the preview modal so the contabil sees how many
   *  exceptions exist and explicitly opts in to overwrite them. */
  overriddenInScope: PartnerEntry[];
  /** True if any filter is active (toggle != 'all', search non-empty, or
   *  threshold > 0). Drives the "rezultatul curent" phrasing so the
   *  contabil knows they're acting on a SUBSET, not on every partner. */
  isSubset: boolean;
  categoryOptions: { value: string; label: string }[];
  /** The categoryId currently mapped on the cont (default for unmapped
   *  partners). When set, we pre-select it so the contabil sees the
   *  "starting point" and only needs to change the dropdown to redirect. */
  contCategoryId: string | null;
  /** Display name for the same category — used in the hint line. */
  contCategoryName: string | null;
  onSaved: () => Promise<void> | void;
}) {
  // Initialize the dropdown to the cont's default when available — this is
  // the calibration the contabil expects to see when opening the panel.
  const [categoryId, setCategoryId] = useState<string>(contCategoryId ?? "");
  // Re-sync if the panel is repointed at a different cont without unmount
  // (defensive — opening a new cont currently remounts the panel).
  useEffect(() => {
    setCategoryId(contCategoryId ?? "");
  }, [contCategoryId, account.contBase]);

  const [showPreview, setShowPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targetCount = targets.length;
  const targetRulaj = sumRulaj(targets);
  const targetLabel =
    categoryOptions.find((o) => o.value === categoryId)?.label ?? "";

  // The action is a no-op when the chosen category is the cont's default
  // AND every target is currently unmapped (writing an exception that
  // mirrors the cont default would just add garbage rows). Detect it and
  // disable the button with a friendly hint.
  const isNoOp =
    categoryId === contCategoryId &&
    targets.every((p) => p.override === null);

  const headerSentence = isSubset
    ? `Atribuie cei ${targetCount} parteneri din rezultatul curent (${formatRon(targetRulaj)} lei) la categoria:`
    : `Atribuie toti cei ${targetCount} ${targetCount === 1 ? "partener" : "parteneri"} (${formatRon(targetRulaj)} lei) la categoria:`;

  /**
   * `overwriteMode=false` (default): only fresh targets are written; partners
   * that already have a manual override are kept untouched.
   * `overwriteMode=true`: the FULL scope is written — targets + overridden —
   * existing overrides are replaced with the new categoryId.
   */
  function runBulk(overwriteMode: boolean) {
    setError(null);
    const partners = overwriteMode
      ? [...targets, ...overriddenInScope].map((p) => ({
          nameOriginal: p.nameOriginal,
        }))
      : targets.map((p) => ({ nameOriginal: p.nameOriginal }));
    startTransition(async () => {
      const res = await bulkApplyPartnerOverridesAction({
        clientId,
        contBase: account.contBase,
        categoryId,
        partners,
        skipExistingOverrides: !overwriteMode,
        // Per-row saves go through the optimistic path and skip Next.js
        // revalidation; defer to panel close so the page doesn't flash.
        skipRevalidate: true,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setShowPreview(false);
      await onSaved();
    });
  }

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-primary shrink-0" />
          <span
            className="text-[13px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {headerSentence}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Select
              value={categoryId}
              options={categoryOptions}
              onChange={setCategoryId}
              placeholder="Alege categoria..."
            />
          </div>
          <Button
            variant="primary"
            onClick={() => setShowPreview(true)}
            disabled={!categoryId || pending || isNoOp}
            className="h-10 px-4 text-[13px]"
          >
            Aplica
          </Button>
        </div>
        {isNoOp && contCategoryName && (
          <p
            className="text-[11px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Categoria selectata este deja default-ul contului
            ({contCategoryName}) — nu este nimic de redirectionat. Alege alta
            categorie pentru a face exceptii.
          </p>
        )}
        {error && (
          <p
            className="text-[11px] text-neg"
            style={{ letterSpacing: "-0.02em" }}
          >
            {error}
          </p>
        )}
      </div>

      {showPreview && (
        <BulkPreviewModal
          freshCount={targetCount}
          freshRulaj={targetRulaj}
          overwriteCount={overriddenInScope.length}
          overwriteRulaj={sumRulaj(overriddenInScope)}
          categoryLabel={targetLabel}
          isSubset={isSubset}
          selectedCategoryId={categoryId}
          contCategoryId={contCategoryId}
          onConfirm={runBulk}
          onCancel={() => setShowPreview(false)}
          pending={pending}
        />
      )}
    </>
  );
}

/**
 * Bulk preview modal — the contract surface between contabil and database.
 *
 * Shows EXACTLY what will happen before any write:
 *   - How many partners will get a fresh override (count + lei).
 *   - How many partners already have a manual exception (count + lei).
 *   - Whether those existing exceptions will be preserved or overwritten —
 *     contabil chooses explicitly via a toggle. Default is preserve.
 *   - Whether the action is scoped by an active filter or covers everything.
 *
 * The button label reflects the choice ("Aplica" in skip mode, "Aplica si
 * suprascrie M exceptii" in overwrite mode) so there is no ambiguity at
 * the click.
 */
function BulkPreviewModal({
  freshCount,
  freshRulaj,
  overwriteCount,
  overwriteRulaj,
  categoryLabel,
  isSubset,
  selectedCategoryId,
  contCategoryId,
  onConfirm,
  onCancel,
  pending,
}: {
  /** Partners with NO existing override — will get a fresh exception. */
  freshCount: number;
  freshRulaj: number;
  /** Partners already overridden — preserved or overwritten depending on
   *  the contabil's choice. */
  overwriteCount: number;
  overwriteRulaj: number;
  categoryLabel: string;
  isSubset: boolean;
  /** When the contabil picked the cont's default category, overwrite mode
   *  would just produce garbage rows that mirror the cont default. Disable
   *  the toggle in that case. */
  selectedCategoryId: string;
  contCategoryId: string | null;
  onConfirm: (overwriteMode: boolean) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [overwriteMode, setOverwriteMode] = useState(false);
  useEscapeKey(onCancel);
  const overwriteDisabled = selectedCategoryId === contCategoryId;
  // If the toggle is disabled, force the mode off so confirm never lies
  // about what it will do.
  const effectiveOverwrite = overwriteMode && !overwriteDisabled;

  const totalCount = effectiveOverwrite
    ? freshCount + overwriteCount
    : freshCount;
  const totalRulaj = effectiveOverwrite
    ? freshRulaj + overwriteRulaj
    : freshRulaj;

  const buttonLabel = pending
    ? "Se aplica..."
    : effectiveOverwrite && overwriteCount > 0
      ? `Aplica si suprascrie ${overwriteCount} exceptii`
      : "Aplica";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={pending ? undefined : onCancel}
        aria-hidden
      />
      <div className="relative bg-dark-2 border border-dark-3 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl">
        <h3
          className="text-[16px] font-semibold text-white mb-3"
          style={{ letterSpacing: "-0.04em" }}
        >
          Confirma maparea in bulk
        </h3>

        {/* HEADLINE: totals (count + lei + category) */}
        <p
          className="text-[13px] text-gray-light mb-3"
          style={{ letterSpacing: "-0.02em" }}
        >
          Se vor mapa <strong className="text-white">{totalCount}</strong>{" "}
          {totalCount === 1 ? "partener" : "parteneri"} (
          <span className="font-mono tabular-nums">
            {formatRon(totalRulaj)} lei
          </span>
          ) la categoria{" "}
          <strong className="text-white">{categoryLabel}</strong>
          {isSubset ? " (rezultatul filtrului curent)" : ""}.
        </p>

        {/* BREAKDOWN: fresh vs existing exceptions */}
        <ul
          className="text-[12px] text-gray-light mb-4 space-y-1.5 border-l-2 border-dark-3 pl-3"
          style={{ letterSpacing: "-0.02em" }}
          data-testid="bulk-preview-breakdown"
        >
          {freshCount > 0 && (
            <li>
              <span className="font-mono tabular-nums text-white">
                {freshCount}
              </span>{" "}
              {freshCount === 1
                ? "partener primeste o exceptie noua"
                : "parteneri primesc o exceptie noua"}{" "}
              (
              <span className="font-mono tabular-nums">
                {formatRon(freshRulaj)} lei
              </span>
              )
            </li>
          )}
          <li>
            <span className="font-mono tabular-nums text-white">
              {overwriteCount}
            </span>{" "}
            {overwriteCount === 1
              ? "exceptie manuala existenta in scope"
              : "exceptii manuale existente in scope"}
            {overwriteCount > 0 && (
              <>
                {" "}
                (
                <span className="font-mono tabular-nums">
                  {formatRon(overwriteRulaj)} lei
                </span>
                ) —{" "}
                <span
                  className={
                    effectiveOverwrite ? "text-tone-warn" : "text-gray"
                  }
                >
                  {effectiveOverwrite ? "vor fi SUPRASCRISE" : "nimic suprascris"}
                </span>
              </>
            )}
            {overwriteCount === 0 && (
              <span className="text-gray"> (nimic suprascris)</span>
            )}
          </li>
        </ul>

        {/* OPTIONAL TOGGLE: only when there's something to overwrite */}
        {overwriteCount > 0 && (
          <label
            className={`flex items-start gap-2 text-[12px] mb-4 ${
              overwriteDisabled
                ? "text-gray cursor-not-allowed"
                : "text-gray-light cursor-pointer"
            }`}
            style={{ letterSpacing: "-0.02em" }}
          >
            <input
              type="checkbox"
              checked={overwriteMode && !overwriteDisabled}
              disabled={overwriteDisabled || pending}
              onChange={(e) => setOverwriteMode(e.target.checked)}
              className="mt-0.5 shrink-0"
              data-testid="bulk-preview-overwrite-toggle"
            />
            <span>
              Suprascrie cele {overwriteCount}{" "}
              {overwriteCount === 1
                ? "exceptie manuala existenta"
                : "exceptii manuale existente"}{" "}
              cu categoria selectata.
              {overwriteDisabled && (
                <span className="block text-[11px] text-gray mt-0.5">
                  Suprascrierea cu default-ul contului ar crea exceptii
                  redundante — alege alta categorie pentru a activa.
                </span>
              )}
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Anuleaza
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(effectiveOverwrite)}
            disabled={pending || totalCount === 0}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Materialitate threshold input — Claudia's tool for cutting the long tail.
 * Renders a small numeric input ("Peste ___ lei") plus three preset chips
 * (1000 / 5000 / 10000) for one-click application. When active, the row
 * shows how many partners survived the cutoff so the contabil sees the
 * impact immediately.
 *
 * The state lives in the parent (PanelBody) as a raw string so clearing
 * the input doesn't snap back to "0".
 */
function ThresholdInput({
  value,
  onChange,
  visibleCount,
  totalCount,
  active,
}: {
  value: string;
  onChange: (next: string) => void;
  visibleCount: number;
  totalCount: number;
  active: boolean;
}) {
  // Whitelist digits + dot/comma (Romanian decimal separator), block
  // everything else. Empty string is the cleared state.
  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/[^0-9.,]/g, "");
    onChange(next);
  }
  const PRESETS = [1000, 5000, 10000];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label
        className="font-mono text-[10px] uppercase tracking-wider text-gray shrink-0"
        style={{ letterSpacing: "-0.02em" }}
      >
        Peste
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={onInput}
        placeholder="0"
        className="w-24 h-9 rounded-[10px] border border-dark-3 bg-dark-2 px-3 font-mono text-sm text-white tabular-nums placeholder:text-gray focus:outline-none focus:border-primary"
        aria-label="Filtreaza parteneri peste pragul de rulaj (lei)"
      />
      <span
        className="font-mono text-[10px] uppercase tracking-wider text-gray shrink-0"
        style={{ letterSpacing: "-0.02em" }}
      >
        lei
      </span>
      <div className="flex items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(String(p))}
            className="font-mono text-[11px] tabular-nums px-2 py-1 rounded-md border border-dark-3 text-gray-light hover:bg-dark-3/40 hover:text-white transition-colors"
            style={{ letterSpacing: "-0.02em" }}
          >
            {formatRon(p)}
          </button>
        ))}
        {active && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="font-mono text-[11px] uppercase tracking-wider px-2 py-1 text-gray hover:text-white"
            style={{ letterSpacing: "-0.02em" }}
            aria-label="Sterge pragul de rulaj"
          >
            Sterge
          </button>
        )}
      </div>
      {active && (
        <span
          className="font-mono text-[11px] text-gray-light tabular-nums ml-auto"
          style={{ letterSpacing: "-0.02em" }}
        >
          {visibleCount} din {totalCount}
        </span>
      )}
    </div>
  );
}

/**
 * Pareto indicator — one-line summary that tells the contabil where the
 * weight of this cont's rulaj actually sits ("Top 3 parteneri = 86% din
 * rulaj"). Visibility is gated by the parent's `showParetoUI` so the same
 * rule applies here and to the long-tail separator.
 */
function ParetoIndicator({
  pareto,
}: {
  pareto: ReturnType<typeof computeParetoCutoff>;
}) {
  return (
    <div
      className="font-mono text-[11px] text-gray tabular-nums"
      style={{ letterSpacing: "-0.02em" }}
      data-testid="pareto-indicator"
    >
      Top {pareto.headCount}{" "}
      {pareto.headCount === 1 ? "partener" : "parteneri"} ={" "}
      <span className="text-gray-light font-medium">{pareto.headPercent}%</span>{" "}
      din rulaj. Restul de {pareto.tailCount} reprezinta{" "}
      {pareto.tailPercent}% (coada lunga).
    </div>
  );
}

/**
 * Long-tail separator — rendered ONCE inside the partner list, between the
 * last "head" row and the first "tail" row. Visually breaks the list so the
 * contabil sees where attention should drop off.
 *
 * Reading-friendly copy: "↓ coada lunga — N parteneri pentru X% din rulaj".
 */
function LongTailSeparator({
  pareto,
}: {
  pareto: ReturnType<typeof computeParetoCutoff>;
}) {
  return (
    <li
      className="flex items-center gap-2 px-2 py-1 mt-2 mb-1 border-t border-dashed border-dark-3/80"
      data-testid="long-tail-separator"
      aria-hidden="true"
    >
      <span
        className="font-mono text-[10px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        ↓ coada lunga
      </span>
      <span
        className="font-mono text-[10px] text-gray tabular-nums ml-auto"
        style={{ letterSpacing: "-0.02em" }}
      >
        {pareto.tailCount} parteneri · {pareto.tailPercent}% din rulaj
      </span>
    </li>
  );
}

/**
 * Unified "Unde merg banii pe acest cont" block. Replaces the dual
 * truth-line + numeric coverage box that used to live separately at the
 * top of the slide-panel. Combines:
 *
 *   - The category name (which only the truth-line carried before).
 *   - The exact lei + percent breakdown (which only the coverage box had).
 *   - A 3-segment horizontal bar that shows materiality at a glance.
 *
 * Five distinct states map onto five distinct phrasings — never claim
 * "toti partenerii merg in X" when even one partener has an override.
 */
function DistributionBlock({
  accountKind,
  contCategoryName,
  partnerRulaj,
  overriddenRulaj,
  defaultRulaj,
  unresolvedRulaj,
  overriddenCount,
  totalCount,
}: {
  accountKind: "expense" | "revenue";
  contCategoryName: string | null;
  partnerRulaj: number;
  overriddenRulaj: number;
  defaultRulaj: number;
  unresolvedRulaj: number;
  overriddenCount: number;
  totalCount: number;
}) {
  const followCount = totalCount - overriddenCount;
  const total = partnerRulaj + unresolvedRulaj;

  // Unmapped cont — surface the fallback prominently. No bar yet because
  // numbers haven't loaded (totalCount=0) or there's no partition between
  // "follow" and "override" — everything falls to "Alte cheltuieli".
  if (!contCategoryName) {
    return (
      <div className="rounded-lg border border-neg-border bg-neg-bg/30 p-3">
        <p
          className="text-[12px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Contul nu e mapat. Partenerii fara exceptie apar pe /firma in{" "}
          <span className="text-neg font-medium">
            {accountKind === "expense" ? "Alte cheltuieli" : "Alte venituri"}
          </span>{" "}
          — mapeaza contul din workspace ca sa schimbi asta.
        </p>
      </div>
    );
  }

  // Cont mapped, data still loading. Quiet state, just confirm the mapping.
  if (totalCount === 0) {
    return (
      <div
        className="rounded-lg border border-dark-3 bg-dark-2 p-3 text-[12px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Contul e mapat la{" "}
        <span className="text-white font-medium">{contCategoryName}</span>.
      </div>
    );
  }

  // Happy path — zero overrides. No bar needed; the contabil isn't being
  // asked to fix anything. Reinforce that the cont-mapping is doing its job.
  if (overriddenCount === 0) {
    return (
      <div
        className="rounded-lg border border-dark-3 bg-dark-2 p-3 text-[12px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Toti partenerii merg in{" "}
        <span className="text-white font-medium">{contCategoryName}</span>{" "}
        prin maparea contului.
        {unresolvedRulaj > 0 && (
          <>
            {" "}
            <span className="text-gray">
              ({formatRon(unresolvedRulaj)} lei fara partener identificat —
              TVA, dobanzi, transferuri.)
            </span>
          </>
        )}
      </div>
    );
  }

  // At least one override exists — show the full breakdown.
  const overriddenPct =
    total > 0 ? Math.round((overriddenRulaj / total) * 100) : 0;
  const defaultPct =
    total > 0 ? Math.round((defaultRulaj / total) * 100) : 0;
  const unresolvedPct =
    total > 0 ? Math.round((unresolvedRulaj / total) * 100) : 0;

  const allOverridden = followCount === 0;
  const headline = allOverridden ? (
    <>
      Toti partenerii au exceptie individuala. Categoria contului (
      <span className="text-gray-light">{contCategoryName}</span>) nu se aplica
      pe aceasta perioada.
    </>
  ) : (
    <>
      {overriddenPct}% din rulaj e redistribuit prin exceptii individuale —
      restul urmeaza contul catre{" "}
      <span className="text-white font-medium">{contCategoryName}</span>.
    </>
  );

  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2 p-3 space-y-3">
      <p
        className="text-[12px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        {headline}
      </p>

      <DistributionBar
        overriddenPct={overriddenPct}
        defaultPct={defaultPct}
        unresolvedPct={unresolvedPct}
      />

      <ul className="space-y-1.5">
        {overriddenCount > 0 && (
          <BreakdownRow
            tone="primary"
            countLabel={
              overriddenCount === 1
                ? "1 partener cu exceptie individuala"
                : `${overriddenCount} parteneri cu exceptie individuala`
            }
            amount={overriddenRulaj}
            percent={overriddenPct}
          />
        )}
        {followCount > 0 && (
          <BreakdownRow
            tone="follow"
            countLabel={
              followCount === 1
                ? `1 partener urmeaza contul catre ${contCategoryName}`
                : `${followCount} parteneri urmeaza contul catre ${contCategoryName}`
            }
            amount={defaultRulaj}
            percent={defaultPct}
          />
        )}
        {unresolvedRulaj > 0 && (
          <BreakdownRow
            tone="unresolved"
            countLabel="Fara partener identificat (TVA, dobanzi, transferuri)"
            amount={unresolvedRulaj}
            percent={unresolvedPct}
          />
        )}
      </ul>
    </div>
  );
}

/**
 * 3-segment stacked bar. The "follow" slice uses the calm gray-light tint
 * (it's the default behaviour, not an action), the "override" slice uses
 * primary (it's the contabil's manual decision), and "unresolved" uses a
 * subdued gray hatch to signal "we don't know who this is".
 */
function DistributionBar({
  overriddenPct,
  defaultPct,
  unresolvedPct,
}: {
  overriddenPct: number;
  defaultPct: number;
  unresolvedPct: number;
}) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-dark-3">
      {defaultPct > 0 && (
        <div
          className="h-full bg-gray/40"
          style={{ width: `${defaultPct}%` }}
          aria-hidden
        />
      )}
      {overriddenPct > 0 && (
        <div
          className="h-full bg-primary"
          style={{ width: `${overriddenPct}%` }}
          aria-hidden
        />
      )}
      {unresolvedPct > 0 && (
        <div
          className="h-full bg-dark-3 border-l border-gray/30"
          style={{ width: `${unresolvedPct}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}

/** One row in the breakdown list — colored dot + descriptive sentence +
 *  monospace amount aligned right. */
function BreakdownRow({
  tone,
  countLabel,
  amount,
  percent,
}: {
  tone: "primary" | "follow" | "unresolved";
  countLabel: string;
  amount: number;
  percent: number;
}) {
  const dotClass =
    tone === "primary"
      ? "bg-primary"
      : tone === "follow"
        ? "bg-gray/40"
        : "bg-dark-3 border border-gray/30";
  return (
    <li className="flex items-baseline gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-sm shrink-0 ${dotClass}`}
        aria-hidden
      />
      <span
        className="flex-1 text-[11px] text-gray-light truncate"
        style={{ letterSpacing: "-0.02em" }}
        title={countLabel}
      >
        {countLabel}
      </span>
      <span
        className="font-mono text-[11px] text-gray tabular-nums shrink-0"
        style={{ letterSpacing: "-0.02em" }}
      >
        {formatRon(amount)} lei · {percent}%
      </span>
    </li>
  );
}

const DEFAULT_OPTION_VALUE = "__default__";

function PartnerRow({
  partner,
  account,
  clientId,
  categoryOptions,
  onLocalPatch,
  maxRulaj,
}: {
  partner: PartnerEntry;
  account: AccountListItem;
  clientId: string;
  categoryOptions: { value: string; label: string }[];
  /** Pure local patch — receives the prev panel data, returns next. The
   *  parent never refetches; we mirror the server's effect on this one
   *  row (set / clear / update categoryId on the partner's override). */
  onLocalPatch: (
    updater: (prev: PartnerPanelData) => PartnerPanelData
  ) => void;
  /** Largest rulaj among CURRENTLY VISIBLE partners (not absolute max).
   *  Drives the horizontal bar fill so widths encode rank-within-subset
   *  as the contabil narrows the filter. */
  maxRulaj: number;
}) {
  const [pending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sprint 4: when there's a suggestion (no override yet but inferred from
  // another cont), pre-fill the Select with the suggested category so the
  // contabil's click on "Confirma" (or just picking anything) writes a
  // real override. The visual treatment makes it obvious this row is
  // unconfirmed.
  const isSuggested =
    partner.override === null && partner.suggestedCategoryId !== null;

  // The "persisted" value — what's actually in the DB right now (or the
  // current suggestion if no override exists yet). Compared against
  // `stagedValue` to decide whether a Save button must appear.
  const persistedValue =
    partner.override?.categoryId ??
    partner.suggestedCategoryId ??
    DEFAULT_OPTION_VALUE;

  // Picking from the dropdown only STAGES the change locally. Nothing
  // hits the server until the contabil clicks Save. This makes the
  // action explicit and reversible (Renunta restores the persisted
  // value), avoiding accidental clicks creating real DB writes.
  const [stagedValue, setStagedValue] = useState<string>(persistedValue);

  // If the underlying data refetches (someone else saved another row,
  // the panel reloaded, etc.) and we're NOT in the middle of editing,
  // resync the staged value so the row reflects fresh persisted state.
  useEffect(() => {
    setStagedValue(persistedValue);
    // Reset only on identity change of the persisted target, not on
    // each render — preserves user's in-flight edit when other rows
    // mutate.
  }, [persistedValue]);

  const isDirty = stagedValue !== persistedValue;

  // The "default" option keeps its label SHORT — just "Urmeaza contul".
  // The cont's actual category is shown once in the panel header and
  // doesn't need to be repeated 6 times in a list of 6 partners on
  // default. Less noise, same information.
  //
  // Also: filter out the cont's mapped category from the leaf list so
  // we don't show two entries that route the partner to the same place
  // ("Urmeaza contul" + the literal category name). Both have the same
  // outcome but one keeps a stale override row in the DB; collapsing
  // to one entry = one decision, cleaner state.
  const contDefaultCategoryId = account.currentMapping?.categoryId ?? null;
  const options = useMemo(() => {
    const leaves = contDefaultCategoryId
      ? categoryOptions.filter((o) => o.value !== contDefaultCategoryId)
      : categoryOptions;
    return [
      { value: DEFAULT_OPTION_VALUE, label: "Urmeaza contul" },
      ...leaves,
    ];
  }, [categoryOptions, contDefaultCategoryId]);

  function commit() {
    if (!isDirty) return;
    setError(null);
    const valueToSave = stagedValue;
    startTransition(async () => {
      if (valueToSave === DEFAULT_OPTION_VALUE) {
        // Revert to default = delete the existing override (if any).
        if (!partner.override) {
          // Nothing to delete server-side; this can only happen if the
          // staged value matched a stale-but-untouched suggestion. Just
          // clear the suggestion locally and we're done.
          patchPartner(partner.nameNormalized, (p) => ({
            ...p,
            suggestedCategoryId: null,
          }));
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 3000);
          return;
        }
        const res = await deletePartnerOverrideAction({
          clientId,
          id: partner.override.id,
          skipRevalidate: true,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        // Optimistic: clear the override on this partner. The cont's
        // default applies again. No refetch, no skeleton, no flash.
        patchPartner(partner.nameNormalized, (p) => ({
          ...p,
          override: null,
          suggestedCategoryId: null,
        }));
      } else {
        const res = await upsertPartnerOverrideAction({
          clientId,
          contBase: account.contBase,
          partnerNameOriginal: partner.nameOriginal,
          categoryId: valueToSave,
          skipRevalidate: true,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        // Optimistic: set / update the override on this partner. We
        // synthesize a minimal override object (real id comes from the
        // action's return — we don't need it locally for display since
        // delete uses the partner identity).
        patchPartner(partner.nameNormalized, (p) => ({
          ...p,
          suggestedCategoryId: null,
          override: {
            id: res.data?.id ?? p.override?.id ?? "optimistic",
            clientId,
            contBase: account.contBase,
            partnerNameNormalized: p.nameNormalized,
            partnerNameOriginal: p.nameOriginal,
            categoryId: valueToSave,
            source: "manual",
            confirmedAt: new Date(),
            createdAt: p.override?.createdAt ?? new Date(),
            updatedAt: new Date(),
          },
        }));
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    });
  }

  // Tiny helper: replace one partner inside the panel data without
  // touching aggregate fields. We don't recompute partnerRulaj /
  // unresolvedRulaj because rulaj per partner doesn't change when we
  // flip a category — only the routing does.
  function patchPartner(
    nameNormalized: string,
    update: (p: PartnerEntry) => PartnerEntry
  ) {
    onLocalPatch((prev) => ({
      ...prev,
      partners: prev.partners.map((p) =>
        p.nameNormalized === nameNormalized ? update(p) : p
      ),
    }));
  }

  function revert() {
    setError(null);
    setStagedValue(persistedValue);
  }

  const barPct = rulajBarPercent(partner.rulaj, maxRulaj);
  // A partener has an "active exception" when the contabil has explicitly
  // routed them somewhere other than the cont default. We mirror the visual
  // language of the workspace AccountRow (left border + subtle bg tint) so
  // the contabil reads "manual decision" in the same way across the app.
  // Suggestions stay separate — they're a yellow proposal, not a confirmed
  // decision yet. isDirty wins over isExcepted visually so the user sees
  // their unsaved edit even while the underlying row is overridden.
  const isExcepted = partner.override !== null && !isSuggested;

  return (
    <li
      className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-2/40 ${
        isSuggested
          ? "bg-tone-warn/[0.05] border-l-2 border-tone-warn"
          : isExcepted
            ? "border-l-2 border-primary/40 bg-primary/[0.03]"
            : ""
      } ${isDirty ? "bg-primary/[0.04]" : ""}`}
      data-exception={isExcepted ? "true" : undefined}
    >
      {isSuggested && (
        <Tooltip content="Sugerat din memoria contului. Confirma sau alege alta categorie.">
          <span
            className="w-1.5 h-1.5 rounded-full bg-tone-warn shrink-0"
            aria-label="Sugerat"
          />
        </Tooltip>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Name claims the FULL row width — the Exceptie badge moved down
            next to the rulaj bar so it never compresses long partner names
            (e.g. "TECHNOLOGIES SOLUTIONS SRL"). */}
        <span
          className="text-[12px] text-gray-light truncate"
          style={{ letterSpacing: "-0.02em" }}
          title={partner.nameOriginal}
        >
          {partner.nameOriginal}
          {partner.rulaj === 0 && (
            <span className="ml-2 text-[10px] text-gray italic">(fara activitate)</span>
          )}
        </span>
        {/* Bottom row: rulaj bar (grows) + optional Exceptie badge on the
            right. The bar still anchors visually to the partner's
            rank-within-visible-subset; the badge sits to its right where
            it doesn't compete with the name. */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-[3px] bg-dark-3 rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary/40 rounded-full transition-[width] duration-200"
              style={{ width: `${barPct}%` }}
              data-testid="rulaj-bar-fill"
            />
          </div>
          {isExcepted && (
            <Tooltip content="Acest partener are exceptie individuala — merge la o alta categorie decat default-ul contului.">
              <span
                className="shrink-0 inline-flex items-center font-mono text-[9px] uppercase tracking-wider px-1.5 py-[1px] rounded bg-primary/15 text-primary border border-primary/30 cursor-help"
                style={{ letterSpacing: "0.02em" }}
                data-testid="partner-exception-badge"
              >
                Exceptie
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      <span
        className="font-mono text-[11px] text-gray tabular-nums shrink-0 w-[72px] text-right"
        style={{ letterSpacing: "-0.02em" }}
      >
        {formatRon(partner.rulaj)}
      </span>
      <div className="w-[200px] shrink-0">
        <Select
          value={stagedValue}
          options={options}
          onChange={setStagedValue}
          className={pending ? "opacity-60" : ""}
        />
      </div>
      <div className="w-[100px] shrink-0 flex items-center justify-end gap-1">
        {isDirty ? (
          <>
            <Tooltip content="Salveaza schimbarea">
              <button
                type="button"
                onClick={commit}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#E9E8E3] hover:bg-primary-dark disabled:opacity-50"
                style={{ letterSpacing: "-0.02em" }}
              >
                <Save size={11} />
                Salveaza
              </button>
            </Tooltip>
            <Tooltip content="Anuleaza schimbarea">
              <button
                type="button"
                onClick={revert}
                disabled={pending}
                className="p-1 text-gray hover:text-gray-light disabled:opacity-50"
                aria-label="Anuleaza schimbarea"
              >
                <X size={12} />
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            {savedFlash && (
              <Tooltip content="Salvat">
                <Check size={14} className="text-pos" />
              </Tooltip>
            )}
            {error && (
              <Tooltip content={error}>
                <span className="cursor-help">
                  <AlertCircle size={14} className="text-neg" />
                </span>
              </Tooltip>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function UnresolvedRow({ rulaj }: { rulaj: number }) {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 mt-2 border-t border-dark-3 pt-3">
      <span
        className="flex-1 text-[12px] text-gray italic"
        style={{ letterSpacing: "-0.02em" }}
      >
        Fara partener identificat (TVA, dobanzi, ajustari)
      </span>
      <span
        className="font-mono text-[11px] text-gray tabular-nums shrink-0"
        style={{ letterSpacing: "-0.02em" }}
      >
        {formatRon(rulaj)}
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function walkLeaves(
  nodes: CostCategoryNode[],
  kind: "expense" | "revenue",
  prefix: string,
  out: { value: string; label: string }[]
) {
  for (const node of nodes) {
    if (node.kind !== kind) continue;
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    if (node.children.length === 0) {
      out.push({ value: node.id, label });
    } else {
      walkLeaves(node.children, kind, label, out);
    }
  }
}

const RON = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Parse the raw threshold input — accepts both "1000.5" and "1000,5" so the
 * contabil can type in Romanian. Empty string or junk returns 0 (no
 * threshold active).
 */
function parseRulajInput(raw: string): number {
  const cleaned = raw.replace(",", ".").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
