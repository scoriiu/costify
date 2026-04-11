"use client";

import { useEffect, useRef, useState } from "react";

export interface DocAnswerAuthor {
  id: string;
  name: string;
  email: string;
}

export interface DocAnswerData {
  content: string;
  updatedAt: string;
  author: DocAnswerAuthor | null;
}

interface Props {
  docSlug: string;
  sectionId: string;
  sectionText: string;
  initial?: DocAnswerData;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const DEBOUNCE_MS = 1500;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 10) return "acum cateva secunde";
  if (sec < 60) return `acum ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `acum ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `acum ${hr}h`;
  const days = Math.round(hr / 24);
  if (days < 30) return `acum ${days}z`;
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AnswerBlock({ docSlug, sectionId, sectionText, initial }: Props) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [lastSaved, setLastSaved] = useState<DocAnswerData | null>(initial ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent = useRef<string>(initial?.content ?? "");

  async function save(next: string) {
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/docs/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docSlug, sectionId, sectionText, content: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Eroare necunoscuta" }));
        setState({ kind: "error", message: body.error ?? "Eroare la salvare" });
        return;
      }
      const body = await res.json();
      lastSavedContent.current = next;
      if (body.deleted) {
        setLastSaved(null);
      } else {
        setLastSaved({
          content: next,
          updatedAt: body.updatedAt,
          author: body.author,
        });
      }
      setState({ kind: "saved", at: Date.now() });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Eroare retea",
      });
    }
  }

  function scheduleAutoSave(next: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (next === lastSavedContent.current) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "dirty" });
    timerRef.current = setTimeout(() => save(next), DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleBlur() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (content !== lastSavedContent.current) {
      void save(content);
    }
  }

  return (
    <div className="relative my-6 overflow-hidden rounded-xl border border-dark-3 bg-dark-2/40">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#34D3A0]/50 to-transparent" />
      <div className="flex items-center justify-between border-b border-dark-3/60 px-4 py-2.5">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-light"
        >
          Raspuns
        </span>
        <StatusIndicator state={state} />
      </div>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          scheduleAutoSave(e.target.value);
        }}
        onBlur={handleBlur}
        rows={Math.max(3, Math.min(16, content.split("\n").length + 1))}
        placeholder="Scrie raspunsul aici. Salvarea se face automat cand te opresti din scris."
        maxLength={10000}
        className="block w-full resize-none bg-transparent px-4 py-3 text-[14.5px] leading-[1.7] text-gray-light outline-none placeholder:text-gray/50"
        style={{ letterSpacing: "-0.01em" }}
      />
      {lastSaved?.author && (
        <div className="border-t border-dark-3/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray">
          Ultima modificare: {lastSaved.author.name} · {relativeTime(lastSaved.updatedAt)}
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ state }: { state: SaveState }) {
  const base =
    "font-mono text-[10px] uppercase tracking-[0.12em] flex items-center gap-1.5";
  switch (state.kind) {
    case "idle":
      return <span className={`${base} text-gray/50`}>—</span>;
    case "dirty":
      return (
        <span className={`${base} text-warn`}>
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          Nesalvat
        </span>
      );
    case "saving":
      return (
        <span className={`${base} text-gray-light`}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-light" />
          Se salveaza
        </span>
      );
    case "saved":
      return (
        <span className={`${base} text-primary-light`}>
          <span className="h-1.5 w-1.5 rounded-full bg-primary-light" />
          Salvat
        </span>
      );
    case "error":
      return (
        <span className={`${base} text-danger`} title={state.message}>
          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
          Eroare
        </span>
      );
  }
}
