"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface JournalRow {
  id: string;
  data: string;
  ndp: string;
  contD: string;
  contC: string;
  suma: number;
  explicatie: string;
  felD: string;
}

interface Props {
  clientId: string;
}

interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  align: "left" | "right";
  flex?: boolean;
}

const PAGE_SIZE = 200;
const ROW_HEIGHT = 32;

const COLUMNS: ColumnDef[] = [
  { key: "data", label: "Data", defaultWidth: 110, minWidth: 110, align: "left" },
  { key: "ndp", label: "NDP", defaultWidth: 90, minWidth: 60, align: "left" },
  { key: "felD", label: "Tip", defaultWidth: 80, minWidth: 80, align: "left" },
  { key: "contD", label: "Cont Debit", defaultWidth: 130, minWidth: 80, align: "left" },
  { key: "contC", label: "Cont Credit", defaultWidth: 130, minWidth: 80, align: "left" },
  { key: "suma", label: "Suma", defaultWidth: 130, minWidth: 90, align: "right" },
  { key: "explicatie", label: "Explicatie", defaultWidth: 400, minWidth: 150, align: "left", flex: true },
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function JournalGrid({ clientId }: Props) {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [colWidths, setColWidths] = useState(() =>
    COLUMNS.map((c) => c.defaultWidth)
  );
  const parentRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(async (offset: number) => {
    const res = await fetch(
      `/api/journal?clientId=${clientId}&offset=${offset}&limit=${PAGE_SIZE}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setTotal(data.total);

    setRows((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const newRows = data.items.filter((r: JournalRow) => !ids.has(r.id));
      return [...prev, ...newRows];
    });

    loadedRef.current = offset + data.items.length;
  }, [clientId]);

  useEffect(() => {
    setRows([]);
    loadedRef.current = 0;
    setLoading(true);
    fetchPage(0).finally(() => setLoading(false));
  }, [clientId, fetchPage]);

  const filtered = filter
    ? rows.filter((r) => {
        const q = filter.toLowerCase();
        return (
          r.contD.toLowerCase().includes(q) ||
          r.contC.toLowerCase().includes(q) ||
          r.explicatie.toLowerCase().includes(q) ||
          r.ndp.toLowerCase().includes(q) ||
          r.data.includes(q) ||
          formatDate(r.data).includes(q)
        );
      })
    : rows;

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    const needsMore = lastItem.index >= rows.length - 50;
    if (needsMore && loadedRef.current < total && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      fetchPage(loadedRef.current).finally(() => {
        loadingMoreRef.current = false;
      });
    }
  }, [virtualizer.getVirtualItems(), rows.length, total, fetchPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray">
        Se incarca jurnalul...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-3 py-16">
        <p className="text-sm text-gray">Nu exista intrari. Uploadeaza un registru jurnal.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          placeholder="Filtreaza (cont, explicatie, data...)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-dark-3 bg-dark-2 px-3 py-1.5 font-mono text-xs text-white placeholder:text-gray focus:border-primary focus:outline-none w-72"
        />
        <span className="ml-auto font-mono text-[0.6rem] text-gray">
          {filter ? `${filtered.length} / ` : ""}{total.toLocaleString("ro-RO")} intrari
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-dark-3">
        <HeaderRow colWidths={colWidths} onResize={setColWidths} />

        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: `min(${total * ROW_HEIGHT}px, 70vh)` }}
        >
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = filtered[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={row.id}
                  className="absolute left-0 right-0 flex items-stretch border-b border-dark-3/50 hover:bg-dark-2/40"
                  style={{
                    height: ROW_HEIGHT,
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <Cell width={colWidths[0]}>{formatDate(row.data)}</Cell>
                  <Cell width={colWidths[1]}>{row.ndp}</Cell>
                  <Cell width={colWidths[2]}>{row.felD}</Cell>
                  <Cell width={colWidths[3]}>{row.contD}</Cell>
                  <Cell width={colWidths[4]}>{row.contC}</Cell>
                  <Cell width={colWidths[5]} align="right">
                    <span className="text-white">
                      {row.suma.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </Cell>
                  <Cell flex>{row.explicatie}</Cell>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderRow({
  colWidths,
  onResize,
}: {
  colWidths: number[];
  onResize: (widths: number[]) => void;
}) {
  const startX = useRef(0);
  const startWidth = useRef(0);
  const resizingIdx = useRef(-1);

  function handleMouseDown(e: React.MouseEvent, idx: number) {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = colWidths[idx];
    resizingIdx.current = idx;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX.current;
      const newWidth = Math.max(COLUMNS[resizingIdx.current].minWidth, startWidth.current + delta);
      onResize(colWidths.map((w, i) => (i === resizingIdx.current ? newWidth : w)));
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div className="flex bg-dark-2 border-b border-dark-3">
      {COLUMNS.map((col, idx) => (
        <div
          key={col.key}
          className={`relative shrink-0 border-r border-white/[0.04] px-3 py-2.5 font-mono text-[0.6rem] font-medium uppercase tracking-widest text-gray select-none last:border-r-0 ${
            col.align === "right" ? "text-right" : "text-left"
          }`}
          style={{ width: col.flex ? undefined : colWidths[idx], flex: col.flex ? "1" : "none" }}
        >
          {col.label}
          {!col.flex && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors"
              onMouseDown={(e) => handleMouseDown(e, idx)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Cell({
  children,
  width,
  flex,
  align = "left",
}: {
  children: React.ReactNode;
  width?: number;
  flex?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex shrink-0 items-center overflow-hidden text-ellipsis whitespace-nowrap border-r border-white/[0.04] px-3 font-mono text-xs text-gray-light last:border-r-0 ${
        align === "right" ? "justify-end text-right" : "text-left"
      }`}
      style={{ width: width || undefined, flex: flex ? "1" : "none" }}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </div>
  );
}
