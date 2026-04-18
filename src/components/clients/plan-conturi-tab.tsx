"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, HelpCircle, Pencil, RotateCcw, X } from "lucide-react";
import type { PlanRow } from "@/modules/accounts";
import {
  toggleClientAccountReviewAction,
  updateClientAccountNameAction,
} from "@/modules/clients/actions";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";

interface Props {
  clientId: string;
  year?: number;
  month?: number;
}

type KindFilter = "all" | "standard" | "analytic" | "review";
type ClassFilter = "all" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

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

export function PlanConturiTab({ clientId, year, month }: Props) {
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [search, setSearch] = useState("");

  function fetchRows() {
    setLoading(true);
    const params = new URLSearchParams({ clientId });
    if (year && month) {
      params.set("year", String(year));
      params.set("month", String(month));
    }
    fetch(`/api/client-accounts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(data.rows ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year, month]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter === "review" && !row.needsReview) return false;
      if (kindFilter === "standard" && row.kind !== "standard") return false;
      if (kindFilter === "analytic" && row.kind !== "analytic") return false;
      if (classFilter !== "all" && String(row.classDigit) !== classFilter) return false;
      if (q) {
        const hay = `${row.cont} ${row.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, kindFilter, classFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Se incarca planul de conturi...
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Nu exista conturi. Uploadeaza un registru jurnal sau editeaza manual.
      </div>
    );
  }

  const reviewCount = rows.filter((r) => r.needsReview).length;

  return (
    <div className="space-y-4">
      <FilterBar
        kindFilter={kindFilter}
        onKindFilter={setKindFilter}
        classFilter={classFilter}
        onClassFilter={setClassFilter}
        search={search}
        onSearch={setSearch}
        total={rows.length}
        filtered={filtered.length}
        reviewCount={reviewCount}
      />

      <div className="overflow-hidden rounded-xl border border-dark-3">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-dark-2 border-b border-dark-3">
                <Th align="left" first>Cont</Th>
                <Th align="left">Denumire</Th>
                <Th align="center">
                  <Tooltip content={TYPE_LEGEND}>
                    <span className="inline-flex items-center gap-1">
                      Tip
                      <HelpCircle size={10} className="text-gray/60" />
                    </span>
                  </Tooltip>
                </Th>
                <Th align="right">Sold Final D</Th>
                <Th align="right">Sold Final C</Th>
                <Th align="right">Intrari</Th>
                <Th align="left">Ultima utilizare</Th>
                <Th align="right" last>Actiuni</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <AccountRow
                  key={row.cont}
                  clientId={clientId}
                  row={row}
                  onChanged={fetchRows}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-sm text-gray"
                  >
                    Niciun cont nu corespunde filtrelor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

function FilterBar({
  kindFilter,
  onKindFilter,
  classFilter,
  onClassFilter,
  search,
  onSearch,
  total,
  filtered,
  reviewCount,
}: {
  kindFilter: KindFilter;
  onKindFilter: (k: KindFilter) => void;
  classFilter: ClassFilter;
  onClassFilter: (c: ClassFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  total: number;
  filtered: number;
  reviewCount: number;
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
      <span className="ml-auto font-mono text-xs text-gray">
        {filtered} / {total} conturi
      </span>
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

  return (
    <tr className="border-b border-dark-3/50 hover:bg-dark-2/40">
      <Td align="left" first>
        <div className="flex items-center gap-1.5">
          {row.needsReview && (
            <AlertTriangle
              size={11}
              className="shrink-0 text-danger"
              aria-label="Necesita revizie"
            />
          )}
          <span className="font-mono text-xs text-gray">{row.cont}</span>
        </div>
      </Td>
      <Td align="left">
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
                row.needsReview ? "text-warn" : "text-gray-light"
              }`}
            >
              {row.name}
            </span>
            <NameSourceBadge source={row.nameSource} />
          </div>
        )}
      </Td>
      <Td align="center">
        <span className="font-mono text-[0.6rem] uppercase tracking-widest text-gray">
          {row.type ?? "—"}
        </span>
      </Td>
      <Td align="right">
        <NumCell value={row.currentSold?.finD} />
      </Td>
      <Td align="right">
        <NumCell value={row.currentSold?.finC} />
      </Td>
      <Td align="right">
        <span className="font-mono text-xs text-gray-light">
          {row.usage.entriesCount > 0 ? row.usage.entriesCount.toLocaleString("ro-RO") : "—"}
        </span>
      </Td>
      <Td align="left">
        <span className="font-mono text-xs text-gray-light">
          {row.usage.lastSeen ? formatDate(row.usage.lastSeen) : "—"}
        </span>
      </Td>
      <Td align="right" last>
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
      </Td>
    </tr>
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
    <div className="flex items-center gap-1.5">
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
        className={`h-8 flex-1 min-w-0 rounded-[10px] border bg-dark-2 px-3 text-xs text-white transition-colors focus:outline-none ${
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
      <RotateCcw size={12} />
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

function Th({
  children,
  align = "right",
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  first?: boolean;
  last?: boolean;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`px-3 py-2.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray ${alignClass} ${
        !last ? "border-r border-white/[0.04]" : ""
      } ${first ? "min-w-[120px]" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "right",
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  first?: boolean;
  last?: boolean;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td
      className={`px-3 py-1.5 ${alignClass} ${
        !last ? "border-r border-white/[0.04]" : ""
      } ${first ? "min-w-[120px]" : ""}`}
    >
      {children}
    </td>
  );
}

function formatDate(raw: Date | string): string {
  const d = typeof raw === "string" ? new Date(raw) : raw;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}
