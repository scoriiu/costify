/**
 * Production parity test for the streaming Saga XLSX parser.
 *
 * The fixture is the real 19 MB UpperHouse SRL journal export — the same
 * file that OOM-segfaulted the pod with the legacy in-memory parser. This
 * test asserts that:
 *
 *   1. The streaming parser actually reads the file (proves the Saga
 *      `x:`-prefix namespace handling works — exceljs's reader produces
 *      0 rows on this exact file).
 *   2. Row counts and content match what we expect for this fixture.
 *   3. Peak heap stays under a sensible ceiling (no regression to the
 *      1.4 GB blow-up).
 *
 * The fixture lives in `temp/e2e_test_data_fixtures/` and is gitignored by
 * default. When the file is absent (CI, clean clones) the test is skipped
 * with a clear message rather than failing — keeping the test suite green
 * for contributors who don't have the proprietary client data locally.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseJournalXLSXStreaming,
  parseJournalXLSX,
} from "@/modules/ingestion/journal-parser";
import { streamSagaSheet } from "@/modules/ingestion/saga-stream";

const FIXTURE = resolve(
  __dirname,
  "../../../../temp/e2e_test_data_fixtures/8. Upperhouse/Registru Jurnal - UpperHouse SRL.xlsx"
);

const HAS_FIXTURE = existsSync(FIXTURE);
const skipIfNoFixture = HAS_FIXTURE ? describe : describe.skip;

skipIfNoFixture("streaming Saga parser — UpperHouse fixture", () => {
  it("streams all rows of the 19 MB UpperHouse export without OOM", async () => {
    let rowCount = 0;
    let peakHeap = 0;
    const sampler = setInterval(() => {
      const h = process.memoryUsage().heapUsed;
      if (h > peakHeap) peakHeap = h;
    }, 25);

    await streamSagaSheet(FIXTURE, () => {
      rowCount++;
    });
    clearInterval(sampler);

    // UpperHouse has just under 200k rows (header + ~194k data rows).
    // We don't pin to the exact count because Saga re-exports can shift it
    // a row or two — but it must be in the right ballpark, not 0.
    expect(rowCount).toBeGreaterThan(190_000);
    expect(rowCount).toBeLessThan(200_000);

    // The whole point of this refactor: peak heap must stay well below the
    // 1 GB ceiling that crashed the pod. Even with a 100 MB safety margin
    // this is a ~10x improvement over the legacy parser.
    const peakMb = peakHeap / 1024 / 1024;
    expect(peakMb).toBeLessThan(200);
  }, 60_000);

  it("produces JournalEntry output equivalent to the legacy buffer parser", async () => {
    const buffer = readFileSync(FIXTURE);

    const [streaming, legacy] = await Promise.all([
      parseJournalXLSXStreaming(buffer),
      Promise.resolve(parseJournalXLSX(buffer)),
    ]);

    expect(streaming.entries.length).toBe(legacy.entries.length);
    expect(streaming.years).toEqual(legacy.years);
    expect(streaming.errors).toEqual(legacy.errors);

    // Spot-check the first, middle, and last entry have identical critical
    // fields. Decimal `suma` comparisons via toBe (numeric equality).
    const indices = [0, Math.floor(streaming.entries.length / 2), streaming.entries.length - 1];
    for (const i of indices) {
      const s = streaming.entries[i];
      const l = legacy.entries[i];
      expect(s.data.getTime()).toBe(l.data.getTime());
      expect(s.contD).toBe(l.contD);
      expect(s.contC).toBe(l.contC);
      expect(s.suma).toBe(l.suma);
      expect(s.explicatie).toBe(l.explicatie);
      expect(s.ndp).toBe(l.ndp);
    }
  }, 120_000);

  it("parses successfully when given a filesystem path (avoids buffering the upload)", async () => {
    const result = await parseJournalXLSXStreaming(FIXTURE);
    expect(result.entries.length).toBeGreaterThan(190_000);
    expect(result.errors).toEqual([]);
  }, 60_000);
});

describe("streaming Saga parser — smoke", () => {
  it("module loads without errors", () => {
    expect(typeof parseJournalXLSXStreaming).toBe("function");
    expect(typeof streamSagaSheet).toBe("function");
  });
});
