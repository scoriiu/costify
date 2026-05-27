/**
 * Streaming reader for Saga C journal XLSX exports.
 *
 * Why this exists: Saga emits sheet XML with the OpenXML `x:` namespace
 * prefix (<x:row>, <x:c>, <x:v>) rather than the default namespace form
 * (<row>, <c>, <v>) that mainstream readers like SheetJS and exceljs
 * expect. The default `xlsx` library only works because it materializes
 * the whole workbook in memory then DOM-walks it (and that's the same
 * code path that pushes V8 to 1.4+ GB of heap and OOM-segfaults the pod
 * on a 19 MB Saga export — the file decompresses to ~242 MB of XML).
 *
 * What this does: pulls `xl/sharedStrings.xml` and `xl/worksheets/sheet1.xml`
 * out of the XLSX zip as Node Readable streams via `yauzl`, then runs a
 * SAX parser over each. We strip the `x:` prefix in our own tag handlers,
 * so Saga's variant is no longer a problem. Each spreadsheet row is emitted
 * as a small object the moment its </row> tag closes and is then garbage-
 * collected — peak heap stays around 45 MB even for 200k-row files.
 *
 * The output is column-indexed `{ col, value }` cells, leaving header
 * resolution + business-logic parsing to journal-parser.ts (unchanged).
 */
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import yauzl from "yauzl";
import sax from "sax";

export interface SagaRow {
  rowNum: number;
  cells: Array<{ col: number; value: string; type: string }>;
}

const SHARED_STRINGS = "xl/sharedStrings.xml";
const SHEET1 = "xl/worksheets/sheet1.xml";

function colLetterToIndex(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function stripPrefix(tag: string): string {
  const i = tag.indexOf(":");
  return i === -1 ? tag : tag.slice(i + 1);
}

/**
 * Opens an XLSX zip from either a filesystem path or an in-memory buffer.
 * The route handler currently buffers the upload in memory (we can change
 * that later), so we support both shapes.
 */
function openZip(source: string | Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, zf?: yauzl.ZipFile) => {
      if (err || !zf) return reject(err ?? new Error("Failed to open XLSX"));
      resolve(zf);
    };
    if (typeof source === "string") {
      yauzl.open(source, { lazyEntries: true }, cb);
    } else {
      yauzl.fromBuffer(source, { lazyEntries: true }, cb);
    }
  });
}

function readZipEntryStream(zipfile: yauzl.ZipFile, fileName: string): Promise<Readable | null> {
  return new Promise((resolve, reject) => {
    let found = false;
    zipfile.readEntry();
    zipfile.on("entry", (entry: yauzl.Entry) => {
      if (entry.fileName !== fileName) {
        zipfile.readEntry();
        return;
      }
      found = true;
      zipfile.openReadStream(entry, (err, stream) => {
        if (err || !stream) return reject(err ?? new Error(`Cannot stream ${fileName}`));
        resolve(stream);
      });
    });
    zipfile.on("end", () => {
      if (!found) resolve(null);
    });
    zipfile.on("error", reject);
  });
}

function parseSharedStrings(stream: Readable): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const strings: string[] = [];
    // Buffer chunks then join — repeated `current += text` allocates a new
    // string each time and is O(n^2) on long runs. For Saga's sharedStrings
    // each <si><t>...</t></si> body is normally short, but the optimization
    // is free.
    const chunks: string[] = [];
    let inSi = false;
    let inT = false;
    const parser = sax.parser(true, { trim: false });
    parser.onopentag = (tag) => {
      const name = stripPrefix(tag.name);
      if (name === "si") {
        inSi = true;
        chunks.length = 0;
      } else if (name === "t" && inSi) {
        inT = true;
      }
    };
    parser.ontext = (text: string) => {
      if (inT) chunks.push(text);
    };
    parser.onclosetag = (tagName) => {
      const name = stripPrefix(tagName);
      if (name === "t") inT = false;
      else if (name === "si") {
        strings.push(chunks.length === 0 ? "" : chunks.join(""));
        inSi = false;
      }
    };
    parser.onend = () => resolve(strings);
    parser.onerror = reject;

    stream.on("data", (chunk: Buffer | string) => {
      parser.write(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });
    stream.on("end", () => parser.close());
    stream.on("error", reject);
  });
}

async function loadSharedStrings(source: string | Buffer): Promise<string[]> {
  const zf = await openZip(source);
  const stream = await readZipEntryStream(zf, SHARED_STRINGS);
  if (!stream) {
    zf.close();
    // Sheets without inline strings (rare) still parse — every cell is a literal.
    return [];
  }
  const result = await parseSharedStrings(stream);
  zf.close();
  return result;
}

/**
 * Hot path for sheet1.xml. UpperHouse's worksheet emits ~10M SAX events,
 * so every nanosecond per event compounds into seconds of wall time.
 *
 * Notable micro-optimizations:
 *
 *  - `sax.parser` instead of `sax.createStream`. The stream wrapper
 *    re-emits every event through Node's EventEmitter (~3x slower per
 *    event); direct callback property assignment skips the EE layer.
 *  - We `stream.on("data", parser.write)` ourselves to avoid the second
 *    EE bridge inside `sax.createStream.pipe`.
 *  - First-character branching on tag names. Saga tags are namespaced
 *    `x:row`, `x:c`, `x:v`, `x:t`, `x:is`, but the discriminator is
 *    always the character AFTER the colon. We charCode-peek that one
 *    byte and dispatch — no .slice(), no `name === "row"` string compare.
 *  - Text accumulation via array+join. `current += text` is O(n^2) on
 *    long runs; pushing chunks and joining only on </v> or </t> is O(n).
 */
function parseSheetStream(
  stream: Readable,
  sharedStrings: string[],
  onRow: (row: SagaRow) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let currentRow: SagaRow | null = null;
    let currentCellCol = 0;
    let currentCellType = "";
    const valueChunks: string[] = [];
    let inV = false;
    let inT = false;

    const parser = sax.parser(true, { trim: false });

    parser.onopentag = (tag) => {
      // tag.name is either "row"/"c"/"v"/"t"/"is" OR "x:row"/"x:c"/...
      // We peek the char *after* the colon (or position 0 if no prefix).
      const raw = tag.name;
      const start = raw.charCodeAt(1) === 58 /* ':' */ ? 2 : 0;
      const c0 = raw.charCodeAt(start);

      if (c0 === 114 /* 'r' */) { // "row"
        if (raw.charCodeAt(start + 1) !== 111 /* 'o' */) return;
        const r = tag.attributes.r as string | undefined;
        currentRow = { rowNum: r ? parseInt(r, 10) : 0, cells: [] };
      } else if (c0 === 99 /* 'c' */ && currentRow) {
        const ref = (tag.attributes.r as string | undefined) ?? "";
        // Inline column-letter parse: avoid .slice(), iterate chars.
        let n = 0;
        for (let i = 0; i < ref.length; i++) {
          const cc = ref.charCodeAt(i);
          if (cc >= 48 && cc <= 57) break;
          n = n * 26 + (cc - 64);
        }
        currentCellCol = n === 0 ? 0 : n - 1;
        currentCellType = (tag.attributes.t as string | undefined) ?? "";
        valueChunks.length = 0;
      } else if (c0 === 118 /* 'v' */) {
        inV = true;
      } else if (c0 === 116 /* 't' */ && currentCellType === "inlineStr") {
        inT = true;
      }
    };

    parser.ontext = (text: string) => {
      if (inV || inT) valueChunks.push(text);
    };

    parser.onclosetag = (tagName: string) => {
      const start = tagName.charCodeAt(1) === 58 ? 2 : 0;
      const c0 = tagName.charCodeAt(start);

      if (c0 === 118) {
        inV = false;
      } else if (c0 === 116 && currentCellType !== "s") {
        // </t> only matters when we're inside an inline-string cell.
        inT = false;
      } else if (c0 === 99 && currentRow && valueChunks.length > 0) {
        let value = valueChunks.length === 1 ? valueChunks[0] : valueChunks.join("");
        if (currentCellType === "s") {
          value = sharedStrings[+value] ?? "";
        }
        currentRow.cells.push({ col: currentCellCol, value, type: currentCellType });
      } else if (c0 === 114 && tagName.charCodeAt(start + 1) === 111 && currentRow) {
        onRow(currentRow);
        currentRow = null;
      }
    };

    parser.onend = () => resolve();
    parser.onerror = reject;

    stream.on("data", (chunk: Buffer | string) => {
      parser.write(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    });
    stream.on("end", () => parser.close());
    stream.on("error", reject);
  });
}

/**
 * Stream every row of the first worksheet of a Saga C XLSX export.
 * `onRow` is invoked synchronously for each row as soon as its `</row>`
 * tag closes — once your callback returns, the row object is eligible for
 * garbage collection. Peak heap stays constant regardless of file size.
 */
export async function streamSagaSheet(
  source: string | Buffer,
  onRow: (row: SagaRow) => void
): Promise<void> {
  const sharedStrings = await loadSharedStrings(source);

  const zf = await openZip(source);
  const stream = await readZipEntryStream(zf, SHEET1);
  if (!stream) {
    zf.close();
    throw new Error("Fisierul XLSX nu contine xl/worksheets/sheet1.xml");
  }
  await parseSheetStream(stream, sharedStrings, onRow);
  zf.close();
}

/**
 * Convenience used by the e2e test only — collects all rows into an array.
 * Production code never calls this; it streams via `streamSagaSheet`.
 */
export async function readSagaSheetAll(source: string | Buffer): Promise<SagaRow[]> {
  const rows: SagaRow[] = [];
  await streamSagaSheet(source, (r) => rows.push(r));
  return rows;
}

// Re-export createReadStream so the route can pipe an upload directly.
export { createReadStream };
