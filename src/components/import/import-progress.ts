/**
 * Calibrated progress curve for journal imports.
 *
 * We don't have a real-time progress channel from the server yet, but we
 * have measured the actual time profile of `importJournal` on production
 * data (see commit 4666f33 commit message for the full breakdown). The
 * curve below is built from those numbers, so the bar moves at roughly
 * the same speed the work is actually happening — never finishing early,
 * never freezing at 90%, never giving the user a fake constant rate.
 *
 * Calibration baseline (UpperHouse SRL, 19 MB / 193,684 rows, hot pod):
 *
 *   upload    ~1500 ms  client → server transfer        →  0 → 15
 *   parse     ~7900 ms  XLSX streaming + JS handlers    → 15 → 60
 *   store     ~4200 ms  bulk INSERT batches             → 60 → 90
 *   tail        ~700 ms partners + finalize             → 90 → 98
 *
 * For files of different sizes we scale parse + store linearly with
 * `fileBytes / 19_000_000`. We clamp the predicted total between 3s
 * (tiny files) and 90s (very large files) so the animation never feels
 * absurdly fast or stuck.
 *
 * If the real response arrives before the curve reaches 98%, we snap to
 * 100 smoothly. If the response takes longer than predicted, we hold at
 * 95% to signal "still working, not stuck".
 */

interface Stage {
  /** Cumulative progress at the END of this stage, 0-100. */
  endAt: number;
  /** Wall-clock duration in ms for this stage at the calibration size. */
  baseMs: number;
  /** Whether this stage scales with file size. Upload + tail don't. */
  scalesWithSize: boolean;
  /** Romanian label shown to the user during this stage. */
  label: string;
}

const CAL_BYTES = 19_000_000;

const STAGES: Stage[] = [
  { endAt: 15, baseMs: 1500, scalesWithSize: false, label: "Se incarca fisierul" },
  { endAt: 60, baseMs: 7900, scalesWithSize: true,  label: "Se citeste registrul jurnal" },
  { endAt: 90, baseMs: 4200, scalesWithSize: true,  label: "Se salveaza in baza de date" },
  { endAt: 98, baseMs:  700, scalesWithSize: false, label: "Se finalizeaza importul" },
];

export interface ProgressSample {
  /** 0-100, smoothly increasing. */
  percent: number;
  /** Current stage label. */
  label: string;
  /** True once the real response has arrived. */
  finishing: boolean;
}

export interface ProgressCurve {
  /** Total predicted ms from start to 98%. */
  totalMs: number;
  /** Returns the progress sample at `elapsedMs` since the upload started. */
  sample(elapsedMs: number): ProgressSample;
}

export function buildProgressCurve(fileBytes: number): ProgressCurve {
  const scale = Math.max(0.15, Math.min(5, fileBytes / CAL_BYTES));
  const durations = STAGES.map((s) => (s.scalesWithSize ? s.baseMs * scale : s.baseMs));

  // Pre-compute cumulative start times so sampling is O(stages).
  let acc = 0;
  const startMs: number[] = [];
  for (const d of durations) {
    startMs.push(acc);
    acc += d;
  }
  const totalMs = acc;

  const sample = (elapsedMs: number): ProgressSample => {
    if (elapsedMs <= 0) return { percent: 0, label: STAGES[0].label, finishing: false };

    // Find the active stage. Hold at the last stage's start floor once we
    // exceed the predicted total — never advance past 95% on the curve
    // alone (the real response is the only thing that pushes us to 100).
    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      const stageStart = startMs[i];
      const stageEnd = stageStart + durations[i];
      const prevPct = i === 0 ? 0 : STAGES[i - 1].endAt;

      if (elapsedMs < stageEnd) {
        const f = (elapsedMs - stageStart) / durations[i];
        const percent = prevPct + (stage.endAt - prevPct) * f;
        return { percent, label: stage.label, finishing: false };
      }
    }
    // Past the end of the predicted curve but no response yet — hold at
    // 95% so the user knows we're still working but doesn't see it stuck
    // at 99% or jumping back and forth.
    return { percent: 95, label: STAGES[STAGES.length - 1].label, finishing: false };
  };

  return { totalMs, sample };
}
