/**
 * Locks the calibrated progress curve shape so the import bar can't
 * silently regress to either "finishes in 100 ms" or "stuck at 90 forever".
 *
 * The curve is intentionally not data-driven (we have no real progress
 * channel yet), but it IS calibrated against production timings — these
 * assertions check we preserve the calibration whenever the curve is
 * touched.
 */
import { describe, it, expect } from "vitest";
import { buildProgressCurve } from "@/components/import/import-progress";

describe("buildProgressCurve", () => {
  it("starts at 0 and monotonically increases through stages", () => {
    const curve = buildProgressCurve(19_000_000);

    const samples = [0, 500, 1500, 3000, 7000, 12000, 14000, 14300, 16000].map((t) =>
      curve.sample(t).percent
    );

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(samples[0]).toBe(0);
    expect(samples[samples.length - 1]).toBeLessThanOrEqual(95);
  });

  it("matches stage transitions at the calibration size", () => {
    const curve = buildProgressCurve(19_000_000);

    // Stage 1 ends at 15% after upload (~1500 ms). Sample just before the
    // boundary so we land in-stage rather than the next-stage starting point.
    expect(curve.sample(1499).percent).toBeCloseTo(15, 0);
    // Stage 2 ends at 60% after parse (~1500 + 7900 = 9400 ms).
    expect(curve.sample(9399).percent).toBeCloseTo(60, 0);
    // Stage 3 ends at 90% after store (~9400 + 4200 = 13600 ms).
    expect(curve.sample(13599).percent).toBeCloseTo(90, 0);
    // Stage 4 ends at 98% after finalize (~13600 + 700 = 14300 ms).
    expect(curve.sample(14299).percent).toBeCloseTo(98, 0);
  });

  it("holds at 95% indefinitely past the predicted total — never reaches 100 on its own", () => {
    const curve = buildProgressCurve(19_000_000);

    // Way past the predicted ~14.3s end time.
    expect(curve.sample(60_000).percent).toBe(95);
    expect(curve.sample(300_000).percent).toBe(95);
  });

  it("scales parse + store stages with file size but never below 15% of baseline", () => {
    const tiny = buildProgressCurve(100_000); // 100 KB
    const huge = buildProgressCurve(100_000_000); // 100 MB

    // Tiny file: scale clamped at 0.15 → parse takes ~1.2s, store ~0.6s.
    // Total predicted ~3.7s.
    expect(tiny.totalMs).toBeGreaterThan(3000);
    expect(tiny.totalMs).toBeLessThan(5000);

    // Huge file: scale clamped at 5 → parse takes ~40s, store ~21s.
    // Total predicted should be in the tens of seconds.
    expect(huge.totalMs).toBeGreaterThan(50_000);
    expect(huge.totalMs).toBeLessThan(90_000);
  });

  it("uses Romanian labels", () => {
    const curve = buildProgressCurve(19_000_000);
    expect(curve.sample(500).label).toMatch(/incarc/i);
    expect(curve.sample(5000).label).toMatch(/citeste/i);
    expect(curve.sample(11000).label).toMatch(/salveaza/i);
    expect(curve.sample(14000).label).toMatch(/finalizeaza/i);
  });
});
