"use client";

/**
 * Client-side mode state for L1 (Simplu) vs L2 (Detaliat).
 *
 * Why a client context instead of URL param navigation?
 *   - The data difference between L1 and L2 is purely presentational (show or
 *     hide the RatiosCatalog section + a few TOC items). Both modes consume
 *     the same OwnerSnapshot — recomputing snapshot on toggle is wasteful.
 *   - Server-driven toggles (router.push) make the page feel laggy because
 *     they trigger a full SSR roundtrip including snapshot recompute.
 *
 * Strategy:
 *   - `initialMode` is read once from the URL (?mode=detailed) so deep links
 *     still work and SSR matches.
 *   - First-time mount also reads localStorage; user's preference wins after
 *     first visit (spec §3.4).
 *   - Toggle: instant React state update + persist to localStorage + replace
 *     URL via history API (no navigation, no re-render).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ViewMode = "simple" | "detailed";

interface Ctx {
  mode: ViewMode;
  setMode: (next: ViewMode) => void;
}

const ViewModeContext = createContext<Ctx>({
  mode: "detailed",
  setMode: () => {},
});

const STORAGE_KEY = "costify-owner-view-mode";

export function ViewModeProvider({
  initialMode,
  children,
}: {
  initialMode: ViewMode;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<ViewMode>(initialMode);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "simple" || stored === "detailed") {
        if (stored !== initialMode) {
          setModeState(stored);
          syncUrl(stored);
        }
      }
    } catch {
      /* localStorage unavailable */
    }
  }, [initialMode]);

  function setMode(next: ViewMode) {
    if (next === mode) return;
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* quota */
    }
    syncUrl(next);
  }

  return (
    <ViewModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

function syncUrl(next: ViewMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (next === "simple") {
    url.searchParams.delete("mode");
  } else {
    url.searchParams.set("mode", next);
  }
  window.history.replaceState(window.history.state, "", url.toString());
}

export function useViewMode(): Ctx {
  return useContext(ViewModeContext);
}

/**
 * Render children only when mode === "detailed". Used to gate sections that
 * are part of the L2 experience (e.g. RatiosCatalog).
 */
export function DetailedOnly({ children }: { children: ReactNode }) {
  const { mode } = useViewMode();
  if (mode !== "detailed") return null;
  return <>{children}</>;
}
