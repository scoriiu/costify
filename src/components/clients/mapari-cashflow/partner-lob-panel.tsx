"use client";

/**
 * Slide-in panel: assign a LINE OF BUSINESS to the partners on a cont.
 *
 * Same materiality workflow the contabil relies on — partners sorted by rulaj,
 * search + "peste X lei" threshold + Top 10, a Pareto cue, and a BULK action
 * that applies one split to many partners at once. The per-partener and bulk
 * editors are the exact same split editor used everywhere else.
 *
 * A partener with no own split lands on the cont's own line-of-business split
 * by default (which itself cascades categorie → firma). Partners are never
 * reassigned to another cont or category — the only per-partener lever is LOB.
 */

import { useEffect, useMemo, useState } from "react";
import { X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import type { AccountListItem } from "@/modules/categories";
import type {
  VerticalView,
  AllocationSplit,
  PartnerAllocationView,
} from "@/modules/verticals";
import { loadPartnerPanelAction } from "@/modules/partner-mappings/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import {
  normalizeForSearch,
  rulajBarPercent,
  type PartnerEntry,
} from "@/modules/partner-mappings";
import {
  EditPartnerAllocationDialog,
  EditPartnerBulkAllocationDialog,
} from "./edit-allocation-dialog";

const DOT_COLORS = [
  "bg-primary",
  "bg-amber-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-rose-400",
] as const;

type PartnerFilterTab = "all" | "unpinned" | "pinned";
const THRESHOLDS = [0, 1000, 5000, 10000] as const;

interface Props {
  account: AccountListItem | null;
  clientId: string;
  period: { year: number; month: number } | null;
  verticals: VerticalView[];
  onClose: () => void;
  onMutate: () => void;
}

export function PartnerLobPanel({
  account,
  clientId,
  period,
  verticals,
  onClose,
  onMutate,
}: Props) {
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [unresolvedRulaj, setUnresolvedRulaj] = useState(0);
  const [allocs, setAllocs] = useState<Map<string, PartnerAllocationView>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PartnerFilterTab>("all");
  const [threshold, setThreshold] = useState<number>(0);
  const [editing, setEditing] = useState<PartnerEntry | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const colors = useMemo(() => {
    const m = new Map<string, string>();
    let i = 0;
    for (const v of verticals) {
      if (v.isDefault) continue;
      m.set(v.id, DOT_COLORS[i % DOT_COLORS.length]);
      i += 1;
    }
    return m;
  }, [verticals]);

  const contBase = account?.contBase ?? null;

  const refetch = useMemo(
    () => async () => {
      if (!contBase || !period) return;
      const panel = await loadPartnerPanelAction({
        clientId,
        contBase,
        year: period.year,
        month: period.month,
      });
      if (panel.error) {
        setError(panel.error);
        return;
      }
      // Keep ALL partners, including rulaj-0 ones (e.g. a partener whose
      // movements net to zero in the period). We show them disabled rather
      // than hiding them, so the contabil sees "these partners touched the
      // cont but there's nothing to split on them" instead of an empty list.
      setPartners(panel.data?.partners ?? []);
      setUnresolvedRulaj(panel.data?.unresolvedRulaj ?? 0);
      const m = new Map<string, PartnerAllocationView>();
      for (const a of panel.data?.allocations ?? [])
        m.set(a.partnerNameNormalized, a);
      setAllocs(m);
    },
    [clientId, contBase, period]
  );

  useEffect(() => {
    if (!contBase || !period) return;
    let cancelled = false;
    // Reset per-panel UI state AND clear the previous cont's data when the
    // cont changes. Without clearing the data, the panel briefly shows the
    // previous cont's partners until the async refetch resolves; without
    // resetting `editing`/`bulkOpen`, a stale modal re-opens on top.
    setEditing(null);
    setBulkOpen(false);
    setQuery("");
    setFilter("all");
    setThreshold(0);
    setPartners([]);
    setAllocs(new Map());
    setUnresolvedRulaj(0);
    setLoading(true);
    setError(null);
    refetch().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [contBase, period, refetch]);

  async function afterMutation() {
    await refetch();
    onMutate();
  }

  const filtered = useMemo(() => {
    let xs = partners;
    if (filter === "pinned") xs = xs.filter((p) => allocs.has(p.nameNormalized));
    else if (filter === "unpinned")
      xs = xs.filter((p) => !allocs.has(p.nameNormalized));
    if (threshold > 0) xs = xs.filter((p) => p.rulaj >= threshold);
    const q = normalizeForSearch(query);
    if (q) xs = xs.filter((p) => normalizeForSearch(p.nameOriginal).includes(q));
    return xs;
  }, [partners, allocs, filter, threshold, query]);

  const maxRulaj = useMemo(
    () => Math.max(0, ...filtered.map((p) => p.rulaj)),
    [filtered]
  );
  // Bulk only ever targets partners with actual rulaj to split — a 0-lei
  // partener has nothing to allocate, so it never counts toward "Aplica la N".
  const bulkTargets = useMemo(
    () =>
      filtered
        .filter((p) => p.rulaj !== 0)
        .map((p) => ({
          partnerNameNormalized: p.nameNormalized,
          partnerNameOriginal: p.nameOriginal,
        })),
    [filtered]
  );

  useEscapeKey(onClose, account !== null);

  if (!account) return null;

  const contKind = account.kind;
  const inherited = account.effectiveAllocation.splits;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Parteneri pe contul ${account.cont}`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-dark-2 border-l border-dark-3 flex flex-col"
      >
        {/* Header */}
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
              className="mt-1 font-mono text-[11px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Imparte partenerii pe linii de business
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

        {/* The cont's own LOB split — the default every partener lands on
            until it gets its own. Shown as reference, not an action. */}
        <div className="px-5 py-3 border-b border-dark-3 bg-dark-3/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray">
              Impartirea contului
            </span>
            <InlineChips splits={inherited} verticals={verticals} colors={colors} />
          </div>
          {allocs.size > 0 && (
            <p
              className="mt-1.5 text-[11px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              {allocs.size === 1
                ? "1 partener are exceptie. Se imparte diferit de cont."
                : `${allocs.size} parteneri au exceptie. Se impart diferit de cont.`}
            </p>
          )}
        </div>

        {/* Filters — only meaningful when there are partners to split. With
            no splittable partener the search/threshold/bulk controls would
            all be dead, so we hide the whole bar and let EmptyPartners do
            the explaining. */}
        {partners.length > 0 && (
          <div className="px-5 py-3 border-b border-dark-3 space-y-2.5">
            <div className="flex items-center gap-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Cauta partener..."
                className="flex-1"
              />
              <ToggleGroup<PartnerFilterTab>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Toti" },
                  { value: "unpinned", label: "Ca tot contul" },
                  { value: "pinned", label: "Cu regula proprie" },
                ]}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-gray shrink-0">
                Peste
              </span>
              <ToggleGroup<string>
                value={String(threshold)}
                onChange={(v) => setThreshold(Number(v))}
                options={THRESHOLDS.map((t) => ({
                  value: String(t),
                  label: t === 0 ? "Tot" : `${t / 1000}k`,
                }))}
              />
              <div className="flex-1" />
              <Button
                variant="ghost"
                onClick={() => setBulkOpen(true)}
                disabled={bulkTargets.length === 0 || verticals.length === 0}
              >
                <Layers size={14} className="mr-1" />
                Aplica la {bulkTargets.length}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {error && (
            <p className="p-3 text-[12px] text-neg">{error}</p>
          )}
          {loading && partners.length === 0 ? (
            <p className="p-3 text-[12px] text-gray">Se incarca partenerii...</p>
          ) : filtered.length === 0 ? (
            <EmptyPartners
              hasAnyPartners={partners.length > 0}
              unresolvedRulaj={unresolvedRulaj}
            />
          ) : (
            <ul className="space-y-1">
              {filtered.map((p) => {
                const alloc = allocs.get(p.nameNormalized);
                const own = alloc && alloc.splits.length > 0 ? alloc.splits : null;
                // A partener whose movements net to zero in the period has
                // nothing to split — show it (so the contabil knows it
                // touched the cont) but disabled, with a short reason.
                const inactive = p.rulaj === 0;
                return (
                  <li key={p.nameNormalized}>
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      disabled={inactive}
                      title={inactive ? "Miscari care se anuleaza in perioada (rulaj 0). Nimic de impartit." : undefined}
                      className={`w-full group rounded-md px-2.5 py-2 text-left transition-colors ${
                        inactive
                          ? "opacity-45 cursor-not-allowed"
                          : "hover:bg-dark-3/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex-1 min-w-0 truncate text-[12px] text-gray-light"
                          style={{ letterSpacing: "-0.02em" }}
                          title={p.nameOriginal}
                        >
                          {p.nameOriginal}
                        </span>
                        <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
                          {formatRon(p.rulaj)} lei
                        </span>
                      </div>
                      {/* rulaj bar */}
                      <div className="mt-1 h-1 rounded-full bg-dark-3 overflow-hidden">
                        <div
                          className="h-full bg-primary/40"
                          style={{ width: `${rulajBarPercent(p.rulaj, maxRulaj)}%` }}
                        />
                      </div>
                      {/* LOB state — own rule (highlighted) or, by default,
                          the cont's split shown muted. Always real LOB. */}
                      <div className="mt-1.5">
                        {own ? (
                          <span className="inline-flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5">
                            <InlineChips
                              splits={own}
                              verticals={verticals}
                              colors={colors}
                              size="xs"
                            />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 opacity-55 group-hover:opacity-80 transition-opacity">
                            <InlineChips
                              splits={inherited}
                              verticals={verticals}
                              colors={colors}
                              size="xs"
                            />
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Single-partner editor */}
      {editing && (
        <EditPartnerAllocationDialog
          open
          contBase={account.contBase}
          partnerNameNormalized={editing.nameNormalized}
          partnerNameOriginal={editing.nameOriginal}
          rulaj={editing.rulaj}
          financialKind={contKind}
          currentSplits={allocs.get(editing.nameNormalized)?.splits ?? []}
          inheritedSplits={inherited}
          verticals={verticals}
          clientId={clientId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void afterMutation();
          }}
        />
      )}

      {/* Bulk editor */}
      {bulkOpen && (
        <EditPartnerBulkAllocationDialog
          open
          contBase={account.contBase}
          partners={bulkTargets}
          inheritedSplits={inherited}
          verticals={verticals}
          clientId={clientId}
          onClose={() => setBulkOpen(false)}
          onSaved={() => {
            setBulkOpen(false);
            void afterMutation();
          }}
        />
      )}
    </>
  );
}

function EmptyPartners({
  hasAnyPartners,
  unresolvedRulaj,
}: {
  hasAnyPartners: boolean;
  unresolvedRulaj: number;
}) {
  // Partners exist on the cont but the active filter/search hides them — a
  // transient state the contabil controls. Keep it short.
  if (hasAnyPartners) {
    return (
      <p className="p-3 text-[12px] text-gray">
        Niciun partener pentru filtrul curent.
      </p>
    );
  }

  // No splittable partner exists at all. This is the confusing case: the cont
  // has value, but it flows through accounts that have no partner (stoc,
  // casa/banca, TVA, transferuri) or through partners whose miscari se
  // anuleaza pe perioada (rulaj net 0). Explain it instead of a blank list.
  return (
    <div className="p-4 space-y-2">
      <p
        className="text-[13px] font-semibold text-white"
        style={{ letterSpacing: "-0.04em" }}
      >
        Nimic de impartit pe parteneri aici
      </p>
      {unresolvedRulaj !== 0 ? (
        <p
          className="text-[12px] text-gray leading-relaxed"
          style={{ letterSpacing: "-0.02em" }}
        >
          Rulajul acestui cont ({formatRon(unresolvedRulaj)} lei) trece prin
          conturi fara partener (stoc, casa/banca, TVA sau transferuri). Nu se
          poate imparti pe parteneri. Imparte direct contul pe linii de
          business din lista.
        </p>
      ) : (
        <p
          className="text-[12px] text-gray leading-relaxed"
          style={{ letterSpacing: "-0.02em" }}
        >
          Partenerii de pe acest cont au miscari care se anuleaza in perioada
          selectata (rulaj 0), deci nu e nimic de impartit pe ei. Imparte
          direct contul pe linii de business din lista.
        </p>
      )}
    </div>
  );
}

function InlineChips({
  splits,
  verticals,
  colors,
  size = "sm",
}: {
  splits: AllocationSplit[];
  verticals: VerticalView[];
  colors: Map<string, string>;
  size?: "sm" | "xs";
}) {
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  if (splits.length === 0) {
    return <span className={`font-mono ${text} text-gray`}>Toata firma</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {splits.map((s) => {
        const v = verticals.find((x) => x.id === s.verticalId);
        return (
          <span
            key={s.verticalId}
            className={`inline-flex items-center gap-1.5 font-mono ${text} tabular-nums text-gray-light`}
            style={{ letterSpacing: "-0.02em" }}
          >
            <span
              className={`inline-block h-2 w-2 rounded-sm shrink-0 ${
                colors.get(s.verticalId) ?? "bg-gray/40"
              }`}
              aria-hidden
            />
            <span className="text-white">{s.percent}%</span>
            <span className="truncate max-w-[120px]">{v?.name ?? "?"}</span>
          </span>
        );
      })}
    </span>
  );
}

function formatRon(n: number): string {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);
}
