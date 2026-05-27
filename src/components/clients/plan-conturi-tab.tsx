"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Download,
  HelpCircle,
  Pencil,
  X,
} from "lucide-react";
import type { PlanRow } from "@/modules/accounts/plan";
import { planCsvFilename, planRowsToCsv } from "@/modules/accounts/plan-csv";
import {
  toggleClientAccountReviewAction,
  updateClientAccountNameAction,
} from "@/modules/clients/actions";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";

interface Props {
  clientId: string;
  clientSlug: string;
  /** Currently-selected period — used for the CSV filename and the
   *  "sold curent" column header. */
  year?: number;
  month?: number;
  /** Bumped whenever a journal upload / override / partner-rename changes
   *  the client. Used to invalidate the local list and refetch from the
   *  server (whose cache is also keyed on this version). */
  dataVersion: number;
  /** Called after a successful inline mutation so the parent can bump
   *  dataVersion and any sibling tabs that depend on the same data. */
  onMutated: () => void;
}

type KindFilter = "all" | "standard" | "analytic" | "review";
type ClassFilter = "all" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

const PAGE_SIZE = 200;
const ROW_HEIGHT = 36;
const TABLE_HEIGHT_VH = 70;

const TYPE_LEGEND = (
  <span className="block space-y-1 text-left normal-case">
    <span className="block">
      <span className="font-bold text-white">A</span>{" "}
      <span className="text-gray">Activ — cont de disponibil sau creante (sold debitor)</span>
    </span>
    <span className="block">
      <span className="font-bold text-white">P</span>{" "}
      <span className="text-gray">Pasiv — cont de capital sau datorii (sold creditor)</span>
    </span>
    <span className="block">
      <span className="font-bold text-white">B</span>{" "}
      <span className="text-gray">Bifunctional — poate avea sold pe ambele parti</span>
    </span>
  </span>
);

const CLASS_OPTIONS: { value: ClassFilter; label: string }[] = [
  { value: "all", label: "Toate clasele" },
  { value: "1", label: "Clasa 1 — Capitaluri" },
  { value: "2", label: "Clasa 2 — Imobilizari" },
  { value: "3", label: "Clasa 3 — Stocuri" },
  { value: "4", label: "Clasa 4 — Terti" },
  { value: "5", label: "Clasa 5 — Trezorerie" },
  { value: "6", label: "Clasa 6 — Cheltuieli" },
  { value: "7", label: "Clasa 7 — Venituri" },
  { value: "8", label: "Clasa 8 — Extra-bilant" },
  { value: "9", label: "Clasa 9 — Gestiune" },
];

interface PageResponse {
  items: PlanRow[];
  total: number;
  grandTotal: number;
  reviewCount: number;
  offset: number;
  limit: number;
}

export function PlanConturiTab({
  clientId,
  clientSlug,
  year,
  month,
  dataVersion,
  onMutated,
}: Props) {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const parentRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(id);
  }, [search]);

  const fetchPage = useCallback(
    async (offset: number, requestId: number) => {
      const params = new URLSearchParams({
        clientId,
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (year && month) {
        params.set("year", String(year));
        params.set("month", String(month));
      }
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (kindFilter !== "all") params.set("kind", kindFilter);
      if (classFilter !== "all") params.set("class", classFilter);

      const res = await fetch(`/api/client-accounts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: PageResponse = await res.json();
      if (requestId !== requestIdRef.current) return;

      setTotal(data.total);
      setGrandTotal(data.grandTotal);
      setReviewCount(data.reviewCount);

      if (offset === 0) {
        setRows(data.items);
      } else {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.cont));
          const fresh = data.items.filter((r) => !seen.has(r.cont));
          return [...prev, ...fresh];
        });
      }

      loadedRef.current = offset + data.items.length;
    },
    [clientId, year, month, debouncedSearch, kindFilter, classFilter],
  );

  // Initial + on-filter-change fetch. `dataVersion` in the dep array
  // forces a refetch when an upload or inline edit invalidates the
  // server cache too.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    loadedRef.current = 0;
    setRefetching(true);
    fetchPage(0, requestId).finally(() => {
      if (requestId !== requestIdRef.current) return;
      setRefetching(false);
      setInitialLoading(false);
    });
  }, [fetchPage, dataVersion]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Load-on-scroll: when we're within 50 rows of the bottom of what we
  // have loaded AND the server still has more, fetch the next page.
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const lastItem = items[items.length - 1];
    if (!lastItem) return;
    const needsMore = lastItem.index >= rows.length - 50;
    if (needsMore && loadedRef.current < total && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      const requestId = requestIdRef.current;
      fetchPage(loadedRef.current, requestId).finally(() => {
        loadingMoreRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualizer.getVirtualItems(), rows.length, total, fetchPage]);

  function exportCsvFromVisible() {
    const csv = planRowsToCsv(rows);
    const filename = planCsvFilename(
      clientSlug,
      year && month ? { year, month } : undefined,
    );
    downloadCsv(csv, filename);
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Se incarca planul de conturi...
      </div>
    );
  }

  if (grandTotal === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Nu exista conturi. Uploadeaza un registru jurnal sau editeaza manual.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        kindFilter={kindFilter}
        onKindFilter={setKindFilter}
        classFilter={classFilter}
        onClassFilter={setClassFilter}
        search={search}
        onSearch={setSearch}
        total={total}
        grandTotal={grandTotal}
        reviewCount={reviewCount}
        refetching={refetching}
        onExport={exportCsvFromVisible}
      />

      <div className="overflow-hidden rounded-xl border border-dark-3">
        <HeaderRow />
        {total === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="font-mono text-xs text-gray">
              Niciun cont nu corespunde filtrelor.
            </p>
          </div>
        ) : (
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{
              height: `min(${Math.max(total, 1) * ROW_HEIGHT}px, ${TABLE_HEIGHT_VH}vh)`,
            }}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.cont}
                    className="absolute left-0 right-0 flex items-stretch border-b border-dark-3/50 hover:bg-dark-2/40"
                    style={{
                      height: ROW_HEIGHT,
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <AccountRow
                      clientId={clientId}
                      row={row}
                      onChanged={onMutated}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function FilterBar({
  kindFilter,
  onKindFilter,
  classFilter,
  onClassFilter,
  search,
  onSearch,
  total,
  grandTotal,
  reviewCount,
  refetching,
  onExport,
}: {
  kindFilter: KindFilter;
  onKindFilter: (k: KindFilter) => void;
  classFilter: ClassFilter;
  onClassFilter: (c: ClassFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  total: number;
  grandTotal: number;
  reviewCount: number;
  refetching: boolean;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup<KindFilter>
        value={kindFilter}
        onChange={onKindFilter}
        options={[
          { value: "all", label: "Toate" },
          { value: "standard", label: "Standard" },
          { value: "analytic", label: "Analitice" },
          { value: "review", label: "De revizuit", count: reviewCount, countTone: "danger" },
        ]}
      />
      <Select
        value={classFilter}
        onChange={(v) => onClassFilter(v as ClassFilter)}
        options={CLASS_OPTIONS}
      />
      <SearchInput
        value={search}
        onChange={onSearch}
        placeholder="Cauta cont sau denumire..."
        className="flex-1 min-w-[240px] max-w-md"
      />
      <span className="font-mono text-xs text-gray">
        {refetching ? (
          <span className="text-gray/70">Cauta...</span>
        ) : (
          <>
            {total.toLocaleString("ro-RO")} / {grandTotal.toLocaleString("ro-RO")} conturi
          </>
        )}
      </span>
      <Button
        variant="ghost"
        onClick={onExport}
        title="Exporta randurile incarcate ca CSV"
      >
        <Download size={14} /> Exporta CSV
      </Button>
    </div>
  );
}

// Column layout — keeps the header + body cells aligned. We use fixed
// widths (not flex) so virtualization can position rows absolutely while
// columns stay vertically continuous.
const COLS = {
  cont: 160,
  denumire: 360,
  tip: 60,
  soldD: 130,
  soldC: 130,
  intrari: 90,
  ultimaUtilizare: 130,
  actiuni: 90,
} as const;

function HeaderRow() {
  return (
    <div className="flex bg-dark-2 border-b border-dark-3">
      <ColHeader width={COLS.cont} align="left">Cont</ColHeader>
      <ColHeader flex align="left">Denumire</ColHeader>
      <ColHeader width={COLS.tip} align="center">
        <Tooltip content={TYPE_LEGEND}>
          <span className="inline-flex items-center gap-1">
            Tip
            <HelpCircle size={10} className="text-gray/60" />
          </span>
        </Tooltip>
      </ColHeader>
      <ColHeader width={COLS.soldD} align="right">Sold Final D</ColHeader>
      <ColHeader width={COLS.soldC} align="right">Sold Final C</ColHeader>
      <ColHeader width={COLS.intrari} align="right">Intrari</ColHeader>
      <ColHeader width={COLS.ultimaUtilizare} align="left">Ultima utilizare</ColHeader>
      <ColHeader width={COLS.actiuni} align="right" last>Actiuni</ColHeader>
    </div>
  );
}

function ColHeader({
  children,
  width,
  flex,
  align,
  last,
}: {
  children?: React.ReactNode;
  width?: number;
  flex?: boolean;
  align: "left" | "right" | "center";
  last?: boolean;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <div
      className={`flex shrink-0 items-center px-3 py-2.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray ${alignClass} ${
        !last ? "border-r border-white/[0.04]" : ""
      } ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}
      style={{ width: flex ? undefined : width, flex: flex ? "1" : "none" }}
    >
      {children}
    </div>
  );
}

function AccountRow({
  clientId,
  row,
  onChanged,
}: {
  clientId: string;
  row: PlanRow;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const isAnalytic = row.cont.includes(".");

  return (
    <>
      <BodyCell width={COLS.cont} align="left">
        <div className={`flex items-center gap-1.5 ${isAnalytic ? "pl-6" : ""}`}>
          {row.needsReview && (
            <AlertTriangle
              size={11}
              className="shrink-0 text-danger"
              aria-label="Necesita revizie"
            />
          )}
          <span
            className={`font-mono text-xs ${
              isAnalytic ? "text-gray" : "text-gray-light"
            }`}
          >
            {row.cont}
          </span>
        </div>
      </BodyCell>
      <BodyCell flex align="left">
        {editing ? (
          <InlineNameEditor
            clientId={clientId}
            code={row.cont}
            initial={row.name}
            onDone={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${
                row.needsReview
                  ? "text-warn"
                  : isAnalytic
                    ? "text-gray"
                    : "text-gray-light"
              }`}
            >
              {row.name}
            </span>
            <NameSourceBadge source={row.nameSource} />
          </div>
        )}
      </BodyCell>
      <BodyCell width={COLS.tip} align="center">
        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-gray">
          {row.type ?? "—"}
        </span>
      </BodyCell>
      <BodyCell width={COLS.soldD} align="right">
        <NumCell value={row.currentSold?.finD} />
      </BodyCell>
      <BodyCell width={COLS.soldC} align="right">
        <NumCell value={row.currentSold?.finC} />
      </BodyCell>
      <BodyCell width={COLS.intrari} align="right">
        <span className="font-mono text-xs text-gray-light">
          {row.usage.entriesCount > 0
            ? row.usage.entriesCount.toLocaleString("ro-RO")
            : "—"}
        </span>
      </BodyCell>
      <BodyCell width={COLS.ultimaUtilizare} align="left">
        <span className="font-mono text-xs text-gray-light">
          {row.usage.lastSeen ? formatDate(row.usage.lastSeen) : "—"}
        </span>
      </BodyCell>
      <BodyCell width={COLS.actiuni} align="right" last>
        <div className="flex items-center justify-end gap-1.5">
          {!editing && row.kind === "analytic" && (
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-gray hover:bg-dark-3 hover:text-white transition-colors"
              aria-label="Editeaza denumirea"
              title="Editeaza denumirea"
            >
              <Pencil size={12} />
            </button>
          )}
          {row.needsReview && (
            <ReviewToggle
              clientId={clientId}
              code={row.cont}
              needsReview={row.needsReview}
              onDone={onChanged}
            />
          )}
        </div>
      </BodyCell>
    </>
  );
}

function BodyCell({
  children,
  width,
  flex,
  align,
  last,
}: {
  children?: React.ReactNode;
  width?: number;
  flex?: boolean;
  align: "left" | "right" | "center";
  last?: boolean;
}) {
  const alignClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "text-left";
  return (
    <div
      className={`flex shrink-0 items-center px-3 ${alignClass} ${
        !last ? "border-r border-white/[0.04]" : ""
      }`}
      style={{ width: flex ? undefined : width, flex: flex ? "1" : "none" }}
    >
      {children}
    </div>
  );
}

function InlineNameEditor({
  clientId,
  code,
  initial,
  onDone,
  onCancel,
}: {
  clientId: string;
  code: string;
  initial: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setError("Denumirea nu poate fi goala");
      return;
    }
    if (trimmed === initial) {
      onCancel();
      return;
    }
    startTransition(async () => {
      const result = await updateClientAccountNameAction(clientId, code, trimmed);
      if (!result.ok) {
        setError(result.error ?? "Eroare la salvare");
        return;
      }
      onDone();
    });
  }

  return (
    <div className="flex flex-1 items-center gap-1.5">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") onCancel();
        }}
        disabled={pending}
        className={`h-7 flex-1 min-w-0 rounded-[8px] border bg-dark-2 px-2 text-xs text-white transition-colors focus:outline-none ${
          error
            ? "border-danger/50 bg-danger/5"
            : "border-primary/40 focus:border-primary"
        }`}
      />
      <button
        onClick={save}
        disabled={pending}
        className="rounded p-1 text-accent hover:bg-accent/10 disabled:opacity-50"
        title="Salveaza"
      >
        <Check size={12} />
      </button>
      <button
        onClick={onCancel}
        disabled={pending}
        className="rounded p-1 text-gray hover:bg-dark-3 hover:text-white"
        title="Anuleaza"
      >
        <X size={12} />
      </button>
      {error && (
        <span className="font-mono text-[0.6rem] text-danger">{error}</span>
      )}
    </div>
  );
}

function ReviewToggle({
  clientId,
  code,
  needsReview,
  onDone,
}: {
  clientId: string;
  code: string;
  needsReview: boolean;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      await toggleClientAccountReviewAction(clientId, code, !needsReview);
      onDone();
    });
  }
  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="rounded p-1 text-gray hover:bg-dark-3 hover:text-white transition-colors disabled:opacity-50"
      aria-label="Marcheaza ca revizuit"
      title="Marcheaza ca revizuit"
    >
      <CheckCircle size={12} />
    </button>
  );
}

function NameSourceBadge({
  source,
}: {
  source: PlanRow["nameSource"];
}) {
  if (source === "client_edit") {
    return (
      <span
        className="rounded border border-accent/30 bg-accent/5 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-accent"
        title="Editata manual — nu se suprascrie la reimport"
      >
        Editat
      </span>
    );
  }
  if (source === "fallback") {
    return (
      <span
        className="rounded border border-danger/30 bg-danger/5 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase text-danger"
        title="Nemapata. Revizuieste in OMFP 1802."
      >
        Nemapat
      </span>
    );
  }
  return null;
}

function NumCell({ value }: { value: number | undefined }) {
  if (value === undefined || value === null || Math.abs(value) < 0.01) {
    return <span className="font-mono text-xs text-dark-4">—</span>;
  }
  return (
    <span className="font-mono text-xs text-gray-light">
      {value.toLocaleString("ro-RO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

function formatDate(raw: Date | string): string {
  const d = typeof raw === "string" ? new Date(raw) : raw;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

