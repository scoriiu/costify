"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { X, AlertCircle, Check, Layers } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import {
  loadPartnerPanelAction,
  upsertPartnerOverrideAction,
  deletePartnerOverrideAction,
  bulkApplyPartnerOverridesAction,
  type PartnerPanelData,
} from "@/modules/partner-mappings/actions";
import type {
  CostCategoryNode,
  AccountListItem,
} from "@/modules/categories";
import type { PartnerEntry } from "@/modules/partner-mappings";

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

  // Re-fetch the panel data whenever we open on a different cont or after a
  // mutation. Bail out on close so we don't leak fetches.
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

  if (!account) return null;

  return (
    <>
      {/* Backdrop — click to close. Subtle, doesn't black out the page. */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-xl bg-dark-2 border-l border-dark-3 shadow-2xl flex flex-col"
        role="dialog"
        aria-label={`Parteneri pe contul ${account.cont}`}
      >
        <PanelHeader
          account={account}
          contCategoryName={contCategoryName}
          // Pass override stats so the header can speak the truth: when the
          // contabil has put exceptions on this cont, "toți partenerii merg
          // în X prin maparea contului" becomes a lie. The header phrasing
          // shifts based on whether 0 / some / all partners have overrides.
          overriddenCount={
            data?.partners.filter((p) => p.override !== null).length ?? 0
          }
          totalCount={data?.partners.length ?? 0}
          onClose={onClose}
        />

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
              onSaved={async () => {
                // After every save, re-fetch panel data AND tell the parent
                // page to refresh so per-cont coverage badges update.
                if (period && account) {
                  const res = await loadPartnerPanelAction({
                    clientId,
                    contBase: account.contBase,
                    year: period.year,
                    month: period.month,
                  });
                  if (res.data) setData(res.data);
                }
                onMutate();
              }}
            />
          )}
        </div>

        <div className="border-t border-dark-3 px-4 py-3 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
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
  contCategoryName,
  overriddenCount,
  totalCount,
  onClose,
}: {
  account: AccountListItem;
  contCategoryName: string | null;
  overriddenCount: number;
  totalCount: number;
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
        {/* Headline truth-line about where partners go. Speaks differently
            based on the actual state — "toți merg în X" is only true when
            zero overrides exist; once a single override appears we have to
            qualify the statement, otherwise we lie to the contabil. */}
        <HeaderTruthLine
          accountKind={account.kind}
          contCategoryName={contCategoryName}
          overriddenCount={overriddenCount}
          totalCount={totalCount}
        />
      </div>
    </div>
  );
}

/**
 * The one-liner that tells the contabil where partners on this cont go.
 * Five distinct states, each with its own honest phrasing — never claim
 * "toți merg în X" when even one partener has an override.
 */
function HeaderTruthLine({
  accountKind,
  contCategoryName,
  overriddenCount,
  totalCount,
}: {
  accountKind: "expense" | "revenue";
  contCategoryName: string | null;
  overriddenCount: number;
  totalCount: number;
}) {
  // Unmapped cont — overrides don't matter, fallback is "Alte cheltuieli".
  if (!contCategoryName) {
    return (
      <div
        className="mt-1.5 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Contul nu e mapat. Partenerii fara exceptie apar pe /firma in{" "}
        <span className="text-neg font-medium">
          {accountKind === "expense" ? "Alte cheltuieli" : "Alte venituri"}
        </span>{" "}
        — mapeaza contul din workspace ca sa schimbi asta.
      </div>
    );
  }

  // Cont mapped, no data yet — pre-loading state. Stay quiet.
  if (totalCount === 0) {
    return (
      <div
        className="mt-1.5 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Contul e mapat la{" "}
        <span className="text-gray-light font-medium">{contCategoryName}</span>.
      </div>
    );
  }

  // All partners have overrides — the cont category is unused this period.
  if (overriddenCount === totalCount) {
    return (
      <div
        className="mt-1.5 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        Toti partenerii au exceptie individuala. Categoria contului (
        <span className="text-gray-light font-medium">{contCategoryName}</span>
        ) nu se aplica niciunui partener pe aceasta perioada.
      </div>
    );
  }

  // Some overrides — qualify the cont-mapping statement.
  if (overriddenCount > 0) {
    const followCount = totalCount - overriddenCount;
    return (
      <div
        className="mt-1.5 text-[11px] text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        {followCount === 1
          ? "1 partener urmeaza"
          : `${followCount} parteneri urmeaza`}{" "}
        maparea contului catre{" "}
        <span className="text-gray-light font-medium">{contCategoryName}</span>.{" "}
        {overriddenCount === 1
          ? "1 partener are exceptie individuala (vezi mai jos)."
          : `${overriddenCount} parteneri au exceptie individuala (vezi mai jos).`}
      </div>
    );
  }

  // Zero overrides — the happy "toți merg în X" case.
  return (
    <div
      className="mt-1.5 text-[11px] text-gray"
      style={{ letterSpacing: "-0.02em" }}
    >
      Toti partenerii merg in{" "}
      <span className="text-gray-light font-medium">{contCategoryName}</span>{" "}
      prin maparea contului.
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

type PartnerFilter = "all" | "unmapped" | "top10";

function PanelBody({
  data,
  account,
  clientId,
  categoryOptions,
  contCategoryName,
  onSaved,
}: {
  data: PartnerPanelData;
  account: AccountListItem;
  clientId: string;
  categoryOptions: { value: string; label: string }[];
  contCategoryName: string | null;
  onSaved: () => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<PartnerFilter>("all");
  const [query, setQuery] = useState("");

  const overridden = data.partners.filter((p) => p.override !== null);
  const overriddenRulaj = overridden.reduce((sum, p) => sum + p.rulaj, 0);
  const defaultRulaj = data.partnerRulaj - overriddenRulaj;
  const unmapped = data.partners.filter((p) => p.override === null);

  // Filter chain: filter toggle FIRST, then search. Search is diacritic-
  // insensitive (NFD normalize + strip marks) so "tiriac" matches "Țiriac".
  const queryNorm = normalizeForSearch(query);
  const visible = useMemo(() => {
    let xs = data.partners;
    if (filter === "unmapped") xs = xs.filter((p) => p.override === null);
    else if (filter === "top10") xs = xs.slice(0, 10);
    if (queryNorm) {
      xs = xs.filter((p) =>
        normalizeForSearch(p.nameOriginal).includes(queryNorm)
      );
    }
    return xs;
  }, [data.partners, filter, queryNorm]);

  const [showBulk, setShowBulk] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <CoverageDetail
        partnerRulaj={data.partnerRulaj}
        overriddenRulaj={overriddenRulaj}
        defaultRulaj={defaultRulaj}
        unresolvedRulaj={data.unresolvedRulaj}
        overriddenCount={overridden.length}
        totalCount={data.partners.length}
      />

      {/* Bulk apply is the rare case — most of the time the contabil is
          here to redirect ONE partner, not all. We hide the bar behind
          a small opt-in link so the default view stays calm. */}
      {unmapped.length > 0 && !showBulk && (
        <button
          type="button"
          onClick={() => setShowBulk(true)}
          className="text-[12px] text-primary hover:text-primary-light underline-offset-2 hover:underline"
          style={{ letterSpacing: "-0.02em" }}
        >
          Redirectioneaza in bulk toti partenerii catre o alta categorie →
        </button>
      )}
      {unmapped.length > 0 && showBulk && (
        <BulkActionBar
          account={account}
          clientId={clientId}
          unmapped={unmapped}
          categoryOptions={categoryOptions}
          onSaved={onSaved}
          onCancel={() => setShowBulk(false)}
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
              Niciun partener nu se potriveste filtrului.
            </li>
          ) : (
            visible.map((partner) => (
              <PartnerRow
                key={partner.nameNormalized}
                partner={partner}
                account={account}
                clientId={clientId}
                categoryOptions={categoryOptions}
                onSaved={onSaved}
              />
            ))
          )}
          {data.unresolvedRulaj > 0 && filter === "all" && !queryNorm && (
            <UnresolvedRow rulaj={data.unresolvedRulaj} />
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Bulk apply bar: pick a category, click Aplica, preview modal opens with
 * an exact summary ("Se vor mapa N parteneri (Y lei). M excepții manuale
 * pastrate."), confirm runs the bulk action.
 *
 * Hidden behind an opt-in link in the parent — bulk redirect is the rare
 * case (most visits to this panel are about ONE partner). The contabil
 * opens this only when they genuinely want to redirect the whole cont.
 */
function BulkActionBar({
  account,
  clientId,
  unmapped,
  categoryOptions,
  onSaved,
  onCancel,
}: {
  account: AccountListItem;
  clientId: string;
  unmapped: PartnerEntry[];
  categoryOptions: { value: string; label: string }[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targetCount = unmapped.length;
  const targetRulaj = unmapped.reduce((sum, p) => sum + p.rulaj, 0);
  const targetLabel =
    categoryOptions.find((o) => o.value === categoryId)?.label ?? "";

  function runBulk() {
    setError(null);
    startTransition(async () => {
      const res = await bulkApplyPartnerOverridesAction({
        clientId,
        contBase: account.contBase,
        categoryId,
        // Only send unmapped partners (skipExistingOverrides default would
        // skip them anyway, but explicit slim payload is kinder).
        partners: unmapped.map((p) => ({ nameOriginal: p.nameOriginal })),
        skipExistingOverrides: true,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setShowPreview(false);
      setCategoryId("");
      await onSaved();
    });
  }

  return (
    <>
      <div className="rounded-lg border border-dark-3 bg-dark-3/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={14} className="text-gray shrink-0" />
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-gray truncate"
              style={{ letterSpacing: "-0.02em" }}
            >
              Redirectioneaza {targetCount} ({formatRon(targetRulaj)} lei)
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] text-gray hover:text-gray-light shrink-0"
            style={{ letterSpacing: "-0.02em" }}
          >
            Renunta
          </button>
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
            disabled={!categoryId || pending}
            className="h-10 px-4 text-[13px]"
          >
            Aplica
          </Button>
        </div>
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
          targetCount={targetCount}
          targetRulaj={targetRulaj}
          categoryLabel={targetLabel}
          onConfirm={runBulk}
          onCancel={() => setShowPreview(false)}
          pending={pending}
        />
      )}
    </>
  );
}

function BulkPreviewModal({
  targetCount,
  targetRulaj,
  categoryLabel,
  onConfirm,
  onCancel,
  pending,
}: {
  targetCount: number;
  targetRulaj: number;
  categoryLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
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
        <p
          className="text-[13px] text-gray-light mb-3"
          style={{ letterSpacing: "-0.02em" }}
        >
          Se vor mapa <strong className="text-white">{targetCount}</strong>{" "}
          parteneri ({formatRon(targetRulaj)} lei) la categoria{" "}
          <strong className="text-white">{categoryLabel}</strong>.
        </p>
        <p
          className="text-[12px] text-gray mb-5"
          style={{ letterSpacing: "-0.02em" }}
        >
          Partenerii care au deja o categorie manuala vor fi pastrati ca
          exceptii — nu sunt suprascrisi.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Anuleaza
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={pending}>
            {pending ? "Se aplica..." : "Aplica"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CoverageDetail({
  partnerRulaj,
  overriddenRulaj,
  defaultRulaj,
  unresolvedRulaj,
  overriddenCount,
  totalCount,
}: {
  partnerRulaj: number;
  overriddenRulaj: number;
  defaultRulaj: number;
  unresolvedRulaj: number;
  overriddenCount: number;
  totalCount: number;
}) {
  // When the contabil hasn't created a single exception, treat this as the
  // happy path — not as "0% coverage you must fix". The cont-mapping is
  // doing its job. Only when overrides exist do we surface the percentage.
  const hasOverrides = overriddenCount > 0;
  const total = partnerRulaj + unresolvedRulaj;
  const overriddenPct =
    total > 0 ? Math.round((overriddenRulaj / total) * 100) : 0;

  if (!hasOverrides) {
    return (
      <div
        className="rounded-lg border border-dark-3 bg-dark-2 p-3 text-[12px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Niciun partener nu are exceptie. Suprascrie individual mai jos doar
        daca un partener apartine altui grup decat contul.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2 p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-wider text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Exceptii fata de contul
        </span>
        <span
          className="font-mono text-[11px] text-gray-light tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          {overriddenPct}% din rulaj redistribuit
        </span>
      </div>
      <ul
        className="font-mono text-[11px] text-gray tabular-nums space-y-0.5"
        style={{ letterSpacing: "-0.02em" }}
      >
        <li>
          {formatRon(overriddenRulaj)} lei pe {overriddenCount}{" "}
          {overriddenCount === 1 ? "partener cu exceptie" : "parteneri cu exceptie"}
        </li>
        <li>
          {formatRon(defaultRulaj)} lei pe {totalCount - overriddenCount}{" "}
          {totalCount - overriddenCount === 1
            ? "partener urmeaza contul"
            : "parteneri urmeaza contul"}
        </li>
        {unresolvedRulaj > 0 && (
          <li>{formatRon(unresolvedRulaj)} lei fara partener identificat</li>
        )}
      </ul>
    </div>
  );
}

const DEFAULT_OPTION_VALUE = "__default__";

function PartnerRow({
  partner,
  account,
  clientId,
  categoryOptions,
  onSaved,
}: {
  partner: PartnerEntry;
  account: AccountListItem;
  clientId: string;
  categoryOptions: { value: string; label: string }[];
  onSaved: () => Promise<void> | void;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sprint 4: when there's a suggestion (no override yet but inferred from
  // another cont), pre-fill the Select with the suggested category so the
  // contabil's click on "Confirma" (or just picking anything) writes a
  // real override. The visual treatment makes it obvious this row is
  // unconfirmed.
  const isSuggested =
    partner.override === null && partner.suggestedCategoryId !== null;

  const currentValue =
    partner.override?.categoryId ??
    partner.suggestedCategoryId ??
    DEFAULT_OPTION_VALUE;

  // The "default" option keeps its label SHORT — just "Urmeaza contul".
  // The cont's actual category is shown once in the panel header and
  // doesn't need to be repeated 6 times in a list of 6 partners on
  // default. Less noise, same information.
  const options = useMemo(
    () => [
      { value: DEFAULT_OPTION_VALUE, label: "Urmeaza contul" },
      ...categoryOptions,
    ],
    [categoryOptions]
  );

  function pick(newValue: string) {
    if (newValue === currentValue) return;
    setError(null);
    startTransition(async () => {
      if (newValue === DEFAULT_OPTION_VALUE) {
        // Revert to default: delete the override if one exists.
        if (!partner.override) return;
        const res = await deletePartnerOverrideAction({
          clientId,
          id: partner.override.id,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      } else {
        const res = await upsertPartnerOverrideAction({
          clientId,
          contBase: account.contBase,
          partnerNameOriginal: partner.nameOriginal,
          categoryId: newValue,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      setSaved(true);
      await onSaved();
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <li
      className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-2/40 ${
        isSuggested ? "bg-tone-warn/[0.05] border-l-2 border-tone-warn" : ""
      }`}
    >
      {isSuggested && (
        <Tooltip content="Sugerat din memoria contului. Confirma sau alege alta categorie.">
          <span
            className="w-1.5 h-1.5 rounded-full bg-tone-warn shrink-0"
            aria-label="Sugerat"
          />
        </Tooltip>
      )}
      <span
        className="flex-1 min-w-0 text-[12px] text-gray-light truncate"
        style={{ letterSpacing: "-0.02em" }}
        title={partner.nameOriginal}
      >
        {partner.nameOriginal}
        {partner.rulaj === 0 && (
          <span className="ml-2 text-[10px] text-gray italic">(fara activitate)</span>
        )}
      </span>
      <span
        className="font-mono text-[11px] text-gray tabular-nums shrink-0 w-[80px] text-right"
        style={{ letterSpacing: "-0.02em" }}
      >
        {formatRon(partner.rulaj)}
      </span>
      <div className="w-[200px] shrink-0">
        <Select
          value={currentValue}
          options={options}
          onChange={pick}
          className={pending ? "opacity-60" : ""}
        />
      </div>
      <span className="w-4 shrink-0 flex items-center justify-center">
        {saved && <Check size={12} className="text-pos" />}
        {error && (
          <span title={error} className="cursor-help">
            <AlertCircle size={12} className="text-neg" />
          </span>
        )}
      </span>
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

/**
 * Diacritic-insensitive lowercase normalizer for the search box. NFD splits
 * "Țiriac" → ['T', combining cedilla], then we strip the combining marks
 * so the result matches "tiriac". Distinct from the partner-key normalizer
 * (which preserves diacritics on purpose — two genuinely different partners
 * stay distinct). Here we want forgiving search, so we lose them.
 */
function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const RON = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
}
