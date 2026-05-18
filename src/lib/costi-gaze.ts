"use client";

import { useEffect, useState } from "react";

type GazeState = { x: number; y: number };

let listenerCount = 0;
let rafId: number | null = null;
let latestClientX = 0;
let latestClientY = 0;
const subscribers = new Set<(s: GazeState) => void>();

function broadcast() {
  const nx = (latestClientX / window.innerWidth) * 2 - 1;
  const ny = (latestClientY / window.innerHeight) * 2 - 1;
  const x = Math.max(-1, Math.min(1, nx));
  const y = Math.max(-1, Math.min(1, ny));
  subscribers.forEach((cb) => cb({ x, y }));
  rafId = null;
}

function onPointerMove(e: PointerEvent) {
  latestClientX = e.clientX;
  latestClientY = e.clientY;
  if (rafId === null) {
    rafId = requestAnimationFrame(broadcast);
  }
}

function ensureListener() {
  if (listenerCount === 0) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }
  listenerCount++;
}

function releaseListener() {
  listenerCount = Math.max(0, listenerCount - 1);
  if (listenerCount === 0) {
    window.removeEventListener("pointermove", onPointerMove);
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function useCostiGaze(enabled: boolean): GazeState {
  const [gaze, setGaze] = useState<GazeState>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const hoverCapable = window.matchMedia("(hover: hover)").matches;
    if (!hoverCapable) return;
    ensureListener();
    subscribers.add(setGaze);
    return () => {
      subscribers.delete(setGaze);
      releaseListener();
    };
  }, [enabled]);

  return gaze;
}
