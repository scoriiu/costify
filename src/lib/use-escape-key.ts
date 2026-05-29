"use client";

import { useEffect } from "react";

/**
 * Calls `onEscape` whenever the user presses Escape, while `enabled` is true.
 * Used by modals and dialogs so the whole app closes overlays consistently.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape, enabled]);
}
