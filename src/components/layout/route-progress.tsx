"use client";

/**
 * Top-of-page progress bar that fires on every navigation.
 *
 * Why this exists: Next.js App Router renders pages on the server,
 * which means a click on a <Link> looks visually dead until the
 * server-rendered HTML arrives. For a snappy dashboard that adds up to
 * 1-3 s where the user has clicked but nothing has changed. A thin
 * indeterminate progress bar at the very top of the viewport tells the
 * user "your click was heard, the app is working" within ~16 ms of the
 * click landing.
 *
 * Trigger model: we don't try to hook into Next's internal nav events
 * (they're unstable across versions). Instead we observe the things
 * that change on a navigation:
 *
 *   - global click on anchors/links and `[role="link"]` elements
 *   - pathname or search params actually changing
 *
 * When a click fires, we show the bar with an animation that ramps
 * quickly to 70% then crawls. When the page transition completes (the
 * pathname or search params settle) we snap to 100% and fade out.
 *
 * If the user clicks again mid-transition, we restart from the current
 * width — no jarring resets.
 *
 * Performance: a single fixed-position div + a state ref. No
 * timers when idle.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const RAMP_TO = 70;
const RAMP_DURATION_MS = 600;
const CRAWL_INCREMENT = 1.5;
const CRAWL_INTERVAL_MS = 200;
const FINISH_DURATION_MS = 240;

export function RouteProgress() {
  const [progress, setProgress] = useState<number | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startedAtRef = useRef<number | null>(null);
  const rampHandleRef = useRef<number | null>(null);
  const crawlHandleRef = useRef<number | null>(null);
  const finishHandleRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (rampHandleRef.current !== null) {
      cancelAnimationFrame(rampHandleRef.current);
      rampHandleRef.current = null;
    }
    if (crawlHandleRef.current !== null) {
      clearInterval(crawlHandleRef.current);
      crawlHandleRef.current = null;
    }
    if (finishHandleRef.current !== null) {
      clearTimeout(finishHandleRef.current);
      finishHandleRef.current = null;
    }
  };

  const startProgress = () => {
    if (startedAtRef.current !== null) return; // already going
    startedAtRef.current = performance.now();
    clearTimers();
    setProgress(8); // initial kick so the bar is visible immediately

    const tick = (now: number) => {
      const t = Math.min(1, (now - (startedAtRef.current ?? now)) / RAMP_DURATION_MS);
      // ease-out so the early progress feels fast
      const eased = 1 - Math.pow(1 - t, 2);
      const value = 8 + eased * (RAMP_TO - 8);
      setProgress(value);
      if (t < 1) {
        rampHandleRef.current = requestAnimationFrame(tick);
      } else {
        // crawl phase: tiny ticks toward 95 but never reaching it
        crawlHandleRef.current = window.setInterval(() => {
          setProgress((p) => {
            if (p === null) return null;
            const next = p + CRAWL_INCREMENT * (1 - p / 100);
            return Math.min(95, next);
          });
        }, CRAWL_INTERVAL_MS);
      }
    };
    rampHandleRef.current = requestAnimationFrame(tick);
  };

  const finishProgress = () => {
    if (startedAtRef.current === null) return;
    clearTimers();
    setProgress(100);
    finishHandleRef.current = window.setTimeout(() => {
      setProgress(null);
      startedAtRef.current = null;
    }, FINISH_DURATION_MS);
  };

  // Listen for clicks that LOOK like internal navigations and start
  // the bar before the route actually resolves. We bail when the
  // click is a modifier-click (new tab), middle/right click, or
  // targets an external href / mailto / tel link.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

      const path = event.composedPath();
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === "A") {
          const anchor = node as HTMLAnchorElement;
          const href = anchor.getAttribute("href");
          if (!href) return;
          if (anchor.target === "_blank") return;
          if (
            href.startsWith("http") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:") ||
            href.startsWith("#")
          ) {
            // External or hash links don't trigger a route change we care about.
            return;
          }
          startProgress();
          return;
        }
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // When the route resolves (pathname or search params actually
  // change) we finish whatever progress is in flight. This also covers
  // router.push() programmatic navigations — the click-detector starts
  // them and the effect closes them out.
  useEffect(() => {
    finishProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Unmount cleanup so timers don't leak in dev hot-reloads.
  useEffect(() => () => clearTimers(), []);

  if (progress === null) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px]"
    >
      <div
        className="h-full bg-primary shadow-[0_0_12px_rgba(13,107,94,0.6)] transition-[width,opacity] ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          transitionDuration: progress >= 100 ? `${FINISH_DURATION_MS}ms` : "120ms",
        }}
      />
    </div>
  );
}
