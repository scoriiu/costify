"use client";

/**
 * Client-side cache of frozen published snapshots, keyed by "year-month".
 *
 * Powers in-card month switching: the card shows the page's own month from
 * props (zero fetch), and any OTHER month is fetched once from
 * /api/owner/published-snapshot then kept for the session. Published
 * snapshots are immutable (re-publishing is rare and a page reload refreshes
 * everything), so there is no invalidation concern here.
 */

import { useCallback, useRef, useState } from "react";
import type { OwnerSnapshot } from "@/modules/reporting/owner";

interface FetchState {
  snapshot: OwnerSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function usePublishedSnapshot(clientId: string) {
  const cache = useRef(new Map<string, OwnerSnapshot>());
  const [state, setState] = useState<FetchState>({
    snapshot: null,
    loading: false,
    error: null,
  });

  const load = useCallback(
    async (year: number, month: number) => {
      const key = `${year}-${month}`;
      const cached = cache.current.get(key);
      if (cached) {
        setState({ snapshot: cached, loading: false, error: null });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(
          `/api/owner/published-snapshot?clientId=${clientId}&year=${year}&month=${month}`
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Nu am putut incarca luna selectata.");
        }
        const data = (await res.json()) as { snapshot: OwnerSnapshot };
        cache.current.set(key, data.snapshot);
        setState({ snapshot: data.snapshot, loading: false, error: null });
      } catch (e) {
        setState({
          snapshot: null,
          loading: false,
          error: e instanceof Error ? e.message : "Nu am putut incarca luna selectata.",
        });
      }
    },
    [clientId]
  );

  const reset = useCallback(() => {
    setState({ snapshot: null, loading: false, error: null });
  }, []);

  return { ...state, load, reset };
}
