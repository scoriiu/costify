# ADR-0004 — Period-scoped mappings, mapping timeline, and audit rewrite

**Status**: Proposed
**Date**: 2026-06-19
**Revised**: 2026-06-19 (Council review: D3 reworked to a reference-correct two-layer model, new D14 publish-freeze integrity boundary, phasing resequenced so trends/history ship before the per-month editor and before the irreversible migration)
**Authors**: coriiu
**Context owners**: coriiu (internal)
**Builds on**: ADR-0001 (catalog de conturi cu roluri), ADR-0002 (timeline regim fiscal), ADR-0003 (modul antreprenor + Mapari Cashflow)

## Summary

Today every mapping in Costify is **global and timeless**: an account (or partner) belongs to exactly one linie de cost / linie de business, forever, retroactively across the entire journal. There is no `year`/`month` on any of the six mapping tables.

This ADR makes mappings **period-scoped**, using the same mental model ADR-0002 established for the tax regime: **a mapping is a timeline of versions, each effective from a period onward.** From this single change we get four things the accountant has asked for:

1. **Configure a mapping for a period** (one month or a range), without rewriting history.
2. **See that a linie de cost / business was modified**, when, by whom, and from what to what.
3. **Trend graphs** of how each linie de cost / business evolves month over month, with markers where a mapping changed.
4. **Before/after impact** of a mapping change on the numbers, so the accountant edits with confidence.

It also forces two cleanups we have been deferring:

- **Caching**: the only mapping-coupled caches are two `unstable_cache` loaders keyed on a *global* `Client.dataVersion`. A global version is wrong for period-scoped mappings (editing April must not invalidate the meaning of January). We **remove the mapping-coupled caches during implementation, keep the mapping-independent `ComputedPeriod` cache untouched, and reintroduce a period-aware cache only if profiling demands it** (AGENTS.md: "profile first, cache last").
- **Audit**: the current audit mechanism is append-only by convention only (no DB enforcement), writes are non-atomic with the mutation, before/after snapshots are hand-built and sometimes wrong, bulk writes collapse to one row, and tamper-detection is stubbed. We rewrite it into an atomic, hash-chained, one-row-per-entity log with enforced append-only storage.

Two principles set after the Council review and woven through the decisions below:

- **Integrity boundary**: the entrepreneur's published view is frozen. A retroactive mapping edit re-renders the accountant's live surfaces (Mapari, Balanta, CPP) but **never silently changes a period already published to the entrepreneur** — it flags that period stale and waits for a deliberate re-publish (D14).
- **Sequencing**: the broadly-valuable surface (per-month trend graphs + corrected YTD + change history) rides on the compute engine alone and ships **first**, with **zero schema migration**. The per-month *editor* (a power feature most clients never need) is gated behind one real-user validation and is the only thing that requires the irreversible schema change (D15).

## Decisions needed before implementation (the forks)

These are the choices where I want explicit sign-off. Each has a recommendation; details are in the referenced decision.

1. **Temporal model = effective-dated versions** (D1), mirroring ADR-0002, *not* a dense per-month grid. **Recommended. CONFIRMED 2026-06-19** (owner: per-month precision required).
2. **Month granularity** (`effectiveFrom` = `YYYYMM` integer, sentinel `0` = "de la inceput"), not a `DateTime`, because the journal and the period selector are monthly (D1, D3). **CONFIRMED 2026-06-19** (owner: "apply specific mapping by month, to be precise").
3. **Line definitions stay global; only assignments are period-scoped** (D4). Deleting a line that has historical mappings is guarded.
4. **Two-layer model (REVISED after Council review)**: an open-ended `effectiveFrom` timeline ("din luna X inainte") **plus** bounded `[effectiveFrom, effectiveTo]` overrides ("doar pentru X" / "X..Y"). Outside an override window the base timeline resolves **live**, so a bounded change can never desync from a later base edit. No synthesized revert snapshots (D3).
5. **Remove mapping-coupled caches now, keep `ComputedPeriod`, reintroduce later if needed** (D7).
6. **Audit rewrite is its own workstream/PR** that can land in parallel (D8), and **introduces a SQL migration step** for append-only enforcement (we currently use `prisma db push` only).
7. **Mapping history is first-class domain data** (the version rows), separate from the audit log (D9).
8. **YTD-for-selected-month is computed per-month, considering every month's own mapping** (D5). **CONFIRMED 2026-06-19** (owner: "when selecting a month and year, show year to date for that month still, considering all the mappings configured").
9. **Published periods are frozen** (the integrity boundary): retroactive edits flag a published period stale for deliberate re-publish, never silently re-render it (D14).
10. **Sequence trends/history before the per-month editor** (D15): the engine + trend graphs ship with no schema change; the editor (and its migration) is gated on one real-user validation.

## Context

### What is true today (from a full read of the codebase)

- **Six mapping tables, zero temporal columns.** Axis A (linii de cost): `AccountCategoryMapping` `@@unique([clientId, cont])`, `PartnerCategoryOverride` `@@unique([clientId, contBase, partnerNameNormalized])`. Axis B (linii de business): `VerticalAllocation` `@@unique([clientId, cont])`, `CategoryVerticalAllocation` `categoryId @unique`, `FirmVerticalDefault` `clientId @unique`, `PartnerVerticalAllocation` `@@unique([clientId, contBase, partnerNameNormalized])`. The line definitions themselves are `CostCategory` (tree) and `Vertical`.
- **Resolution is pure and live.** `src/modules/categories/resolver.ts` and `src/modules/verticals/resolver.ts` take pre-loaded `Map`s and do prefix-walk lookups per cont. No I/O, no time axis. They run per request over the leaf accounts.
- **Period today only scopes the *sums*, not the mapping.** The Mapari tab has its own selector (`?cashflow-year`/`?cashflow-month`); changing it re-aggregates the journal, but the same global mapping is applied to whatever period is shown.
- **A YTD/single-month inconsistency already exists.** Mapari applies the mapping to **YTD cumulative** rulaj (`rulajTD`/`rulajTC`); the owner snapshot applies it to **single-month** rulaj (`rulajD`/`rulajC`). Period-scoped mappings make this ambiguity unavoidable, so we resolve it (D5).
- **`ComputedPeriod` is mapping-independent.** It caches `{rows, kpis, cpp, cppF20}` keyed `(clientId, year, month)` and gated by `dataVersion`. None of that depends on linii de cost / business. The only mapping-coupled caches are `loadMapariCashflowCached` and `loadOwnerSnapshotCached` (`src/modules/cache/loaders.ts`), both keyed `(clientId, year, month, dataVersion)`.
- **The real owner `/firma` view reads a frozen `PublishedPeriod.snapshotData`** and never touches these caches. Removing the mapping caches has zero latency impact on the entrepreneur.
- **24 mapping write paths**, all server actions, all follow `authorize -> service write -> recordClientMutation (audit) -> bumpClientDataVersion`. **None wrap write + audit + bump in a transaction.** `seedOmfpDefaults` writes mappings on read with no bump and no audit.
- **Audit is weak** (see D8 for the full brief): append-only by convention only, non-atomic, lossy hand-built diffs, bulk collapsed to one row, un-chained checksums, `verifyAuditChecksum` never called in production, no integration test asserting "mutation produced an audit row".
- **Charting**: `recharts ^3.8.1` is installed. The owner `EvolutionChart` (`ComposedChart`, 12-month trend with `ReferenceLine`/`Brush`, themed with CSS vars) is the proven house pattern. `computeMonthlyTrends` (`src/modules/reporting/owner/snapshot.ts`) is the proven "load journal context once, slice N months in pure JS" engine. The Mapari tab has no chart today.
- **Costi has zero mapping tools.** `costify-app.json` describes mappings as global/timeless and says explicitly "Costi nu are inca tools dedicate". A test hard-gates the tool count.

### Why now

ADR-0003 shipped the entrepreneur view on top of mappings. The accountant now has a real reason to refine mappings over time: a reclassification, a new business line starting mid-year, a cont that meant one thing in 2024 and another in 2025. Today they cannot express that without corrupting the past. And when they do change a mapping, neither they nor Costi can see what moved or what it did to the numbers. Period-scoped mappings + a real change history is the missing half of the Mapari module.

## Decisions

### D1 — A mapping is a timeline of effective-dated versions

**Decision**: Every mapping row gains an `effectiveFrom Int` column holding a period key `YYYYMM` (e.g. `202604` for April 2026) and a nullable `effectiveTo Int?`. A row with `effectiveTo = null` is an **open timeline version** ("din luna X inainte"); a row with `effectiveTo` set is a **bounded override** ("doar pentru X..Y"). The base "as-of" resolution over the open layer is:

```
resolveAsOf(openVersions, P):
  pick the open version with the largest effectiveFrom such that effectiveFrom <= P
  if none: account is unmapped for P (falls back to OMFP default, exactly as today)
```

The full two-layer resolution (bounded overrides first, then this base layer) is in D3. The base layer is the exact shape of ADR-0002's `TaxRegimePeriod` resolution (`ORDER BY startDate DESC LIMIT 1`), chosen for the same reasons: it matches how accountants think ("din aprilie l-am trecut pe alta linie"), it is one insert per change (not 12), and it stays self-consistent under retroactive edits.

**Schema change (shown for one table; the same pattern applies to all six):**

```prisma
model AccountCategoryMapping {
  id            String @id @default(cuid())
  clientId      String
  cont          String
  scope         String          // "contBase" | "analytic"
  categoryId    String?         // null = tombstone (see D3): "explicitly unmapped"
  effectiveFrom Int    @default(0)  // YYYYMM; 0 = "de la inceput" (inception)
  effectiveTo   Int?              // null = open timeline version; set = bounded override (D3)
  // ... existing fields ...
  @@unique([clientId, cont, effectiveFrom])   // was @@unique([clientId, cont])
  @@index([clientId, cont, effectiveFrom])
}
```

The six tables that become effective-dated: `AccountCategoryMapping`, `PartnerCategoryOverride`, `VerticalAllocation`, `CategoryVerticalAllocation`, `FirmVerticalDefault`, `PartnerVerticalAllocation`. The service layer enforces that bounded overrides for the same key do not overlap (one override per period at most), so resolution is unambiguous.

**Why an `Int YYYYMM` and not a `DateTime` like ADR-0002**: the journal is keyed by `year`/`month`, the period selector is monthly, and reclassifying a cont mid-month is meaningless (a cost line is a property of a month's movements, not a day's). An integer period key is sortable, indexable, human-readable in the DB, and removes the "last day of month" gymnastics ADR-0002 needed because it used dates. `periodKey(y, m) = y*100 + m` is monotonic across year boundaries (`202612 < 202701`).

### D2 — One pure as-of resolver per axis, unchanged call sites

**Decision**: The resolvers stay pure. We add `...AsOf` builders that take the versioned rows plus a target period `P`, apply the two-layer pick (bounded override first, else `pickAsOf` over the open layer, per D3) per key, and produce the **exact state object the existing hot-path resolvers already consume**. So `resolveCategoryForCont` / `resolveAllocationForCont` (prefix walk, analytic-over-contBase precedence, OMFP fallback) are untouched; only the state-builder is period-aware. Loaders pass `P` in; everything downstream is identical.

**Status**: the open-layer builders (`buildResolverStateAsOf`, `buildVerticalResolverAsOf`) and the pure `pickAsOf` / period-key helpers (`src/lib/period.ts`) are **already implemented and unit-tested** (27 tests, typecheck clean), additively, with the hot path unchanged. The bounded-override layer extends these builders.

**Why**: keeps the resolver a pure, unit-testable function (the project's core pattern), and contains the change to "pick the right version, then resolve as before". No behavioural change for clients that have only inception versions.

### D3 — Two-layer resolution: open timeline + bounded overrides (REVISED after Council review)

**The flaw this replaces**: the original D3 expressed "apply only for April" as an April version plus a *synthesized revert version at May that copied the prior target as a value*. That copy is a snapshot, not a reference: the day someone later edits the base ("din martie e Outsourcing"), the May revert still points at the stale copied target and the numbers desync. Snapshots of intent are the exact anti-pattern this ADR forbids elsewhere (mappings must apply at read, never be materialized).

**Decision**: Resolution is two layers, evaluated bounded-first:

```
resolve(key, P):
  ov = the bounded override for `key` whose [effectiveFrom, effectiveTo] contains P
       (at most one — service enforces non-overlap)
  if ov: return ov.target            // tombstone (null / empty splits) => unmapped for P
  return resolveAsOf(openVersions(key), P)   // the open timeline (D1)
```

The three UI scopes map cleanly onto this with **no synthesized rows**:

- **"Pentru toate perioadele"** -> edit the inception open version (`effectiveFrom = 0`, `effectiveTo = null`). Identical to today's single global mapping.
- **"Din [luna] inainte"** -> insert an open version (`effectiveFrom = luna`, `effectiveTo = null`). Persists onward; `resolveAsOf` picks it for every later period.
- **"Doar pentru [luna]" / "[luna1]..[luna2]"** -> insert a single bounded override (`effectiveFrom`, `effectiveTo` set). It wins **only** inside its window; **outside the window the base timeline resolves live**. There is nothing to "revert", so a later base edit is reflected automatically. Reference-correct by construction.

**Clears (tombstones)** are a version/override whose target is `categoryId = null` (axis A) or empty `splits` (axis B): "explicitly unmapped here", which does **not** fall back to the prior version. An *open* tombstone clears from a month onward; a *bounded* tombstone clears just a window.

**Deleting a row** (open version or override) is reserved for "undo this specific change" — it removes that layer and resolution falls back to whatever else covers the period.

**Why**: a bounded override that simply *stops applying* outside its window is the minimal model that keeps the timeline reference-correct (no value copies to desync) while still expressing one-month and multi-month changes as a single row. The non-overlap rule keeps `resolve` deterministic. The open layer remains pure SCD type-2 for the common "from now on" case.

### D4 — Line definitions stay global; only assignments are period-scoped

**Decision**: `CostCategory` and `Vertical` (the buckets and their names) remain global, non-temporal. Only the **assignment** of a cont/partner/category to a line is period-scoped. Renaming a line is not a period event (it is the same bucket). **Deleting** a line that is referenced by any historical mapping version is guarded: the UI requires reassigning or the line is soft-archived (`archivedAt`) so historical resolution stays valid.

**Why**: the taxonomy of lines is stable; what genuinely varies over time is "which bucket does this account fall into this month". Versioning the bucket names too would explode complexity for no user-visible benefit and would break historical resolution on delete.

### D5 — Compute engine: resolve per month, then aggregate (CONFIRMED)

**Decision**: Introduce one engine that, given a journal context (loaded once) and a target period, **resolves each month's movements with that month's effective mapping and sums**:

- **Single-month view** (owner breakdowns): resolve month `M` with the version effective at `M`, applied to `M`'s movement (`rulajD`/`rulajC`).
- **YTD cumulative view (the default Mapari view, CONFIRMED by owner)**: selecting a month/year shows **year-to-date through that month**. For each month `Jan..M` of the selected year, resolve that month's movement with **that month's own effective mapping**, then sum per line. So if cont 6028 is on "Servicii" in Jan-Mar and "Outsourcing" from April, the YTD-through-May total puts Jan-Mar's movement on Servicii and Apr-May's on Outsourcing. This is the **only** honest YTD when mappings differ across months, and it resolves the existing YTD/single-month inconsistency (the engine becomes the single source for both).
- **Trend series** (D11): the array of per-month line totals is a by-product of the same loop.

This mirrors `computeMonthlyTrends` exactly (slice the in-memory context per month, pure JS, no extra DB trips). The pure breakdown functions (`computeExpenseBreakdownFromCategories`, `computeVerticalBreakdown`) already take a resolver state; we call them per month with the as-of resolver for that month and accumulate.

**Implementation shape** (pure, deterministic):

```
computeLineBreakdownYtd(ctx, year, month, versionsByCont, ...):
  totals = new Map<lineId, amount>()
  for m in 1..month:                        // YTD: Jan -> selected month
    P = year*100 + m
    resolver = buildResolverAsOf(versionsByCont, P)   // pick the version effective at P per cont
    movement = perMonthMovement(ctx, year, m)         // that month's rulajD/rulajC
    for each leaf cont in movement:
      line = resolve(cont, resolver)                  // tombstone -> unmapped (OMFP fallback)
      totals[line] += movement[cont]
  return totals
```

**Why**: period-scoped mappings make "resolve once, multiply by YTD rulaj" mathematically wrong. Resolving per month and summing is correct, is the same work the trend graphs need, and is cheap because the journal is loaded once and per-month resolution is pure JS over the same context.

### D6 — Migration: existing mappings become inception versions

**Decision**: A one-shot, idempotent backfill sets `effectiveFrom = 0` on every existing mapping row (the `@default(0)` handles new-by-push; the backfill is a no-op safety net). `effectiveFrom = 0` means "de la inceput", so `0 <= P` is always true and resolution is **identical to today** for every existing client. Mirrors ADR-0002's `1970-01-01` inception transition, adapted to the integer period key.

**Why**: zero behavioural change on deploy. A client who never uses period-scoping keeps exactly one inception version per mapping and the feature is invisible to them. Simplicity preserved for the 95% case.

**Rollout note (2026-06-19)**: production currently holds only disposable test data, so the PR-3 rollout MAY reset + `db push` + reseed instead of running the backfill against live rows. This is a one-time convenience, not an architectural license: the effective-dating design stays, and the idempotent backfill is still written and **covered by a test**, so the real-data migration path is proven before the first real accountant onboards (after which reset is impossible: 10-year financial retention). Conditions before any reset: confirm nobody is mid-demo on the instance, and that a one-command reseed exists. Note that reset does **not** reduce PR-3's main cost, which is the code change to the 24 write paths, not the data.

### D7 — Caching: drop the mapping-coupled caches now, keep `ComputedPeriod`, reintroduce later only if measured

**Decision**:
- **Remove (bypass)** `loadMapariCashflowCached` and `loadOwnerSnapshotCached` when the period schema lands (PR-3); compute live through the D5 engine. These are the only two caches coupled to mappings, and their global `dataVersion` key is semantically wrong for period-scoped data (editing April would invalidate January's cache even though January's meaning is unchanged).
- **Keep `ComputedPeriod` exactly as-is.** It caches balance/KPI/CPP, which remain mapping-independent even after this ADR. Removing it would regress the balance/CPP tab from ~20ms to ~1.5s and silently break the publishing table's "Rezultat" column (`getPeriodResultFigures` reads `ComputedPeriod.cpp`). It buys us nothing for mappings.
- **Reintroduce a period-aware cache only after the feature is correct and profiled.** The clean target is a `ComputedMappingPeriod` table analogous to `ComputedPeriod` (per `(clientId, year, month)`, JSON payload of the resolved cost/business breakdowns), invalidated by a **per-period watermark** rather than a single global counter: a mapping version with `effectiveFrom = F` invalidates only periods `>= F`. We do **not** build this until profiling demands it (PR-F).

**Why**: AGENTS.md "profile first, cache last". On a typical SRL (<=20k rows) the live compute is ~150-400ms, fine. On a 200k-row client the accountant's edit loop becomes ~1.5-2.5s, which is the only real cost; we measure that on a real large client (QHM21 / Upperhouse) before deciding to add `ComputedMappingPeriod`. Building the period-aware cache before the feature is correct would be optimizing blind.

### D8 — Rewrite the audit mechanism (atomic, chained, one-row-per-entity, enforced append-only)

**Decision**: Treat the current audit as a prototype and rewrite it against this brief. Scope it as its own PR (D15, PR-B) that can land in parallel.

1. **Atomic with the mutation.** `recordAuditEvent` accepts an optional Prisma transaction client. Every mapping action wraps `service write + audit insert + dataVersion bump` in a single `$transaction`. "Mutation committed" now implies "audit committed" and "version bumped" — no desync windows.
2. **Hash-chained, verifiable.** Add `sequence Int` (monotonic per tenant) and `prevChecksum String`. Each row's checksum covers its content **and** the previous row's checksum, so a single edited row breaks the chain. Ship the verification job that walks the chain (today `verifyAuditChecksum` has no production caller).
3. **One row per affected entity.** Bulk partner operations currently collapse up to 2000 writes into a single summary row with `before: null`. The rewrite emits one audit row per entity (with a shared `batchId` in metadata for grouping), so "who changed cont 6028's partner split" is answerable.
4. **Correct, structured before/after.** Stop hand-building lossy snapshots (`setPartnerAllocation` logs `before: null` on overwrites; `deleteVertical` omits its 4-table cascade). Capture the row's real prior state inside the transaction and store a normalized `changedFields: {field, from, to}[]` alongside the full before/after, so the history is queryable ("ce s-a schimbat pe linia X in martie").
5. **Physically append-only.** Add a SQL step (executed via the deploy pipeline, see the append-only risk row and open question 4) that `REVOKE UPDATE, DELETE ON "AuditEvent"` from the app role, or a `BEFORE UPDATE/DELETE` trigger that raises. Append-only stops being a convention.
6. **Honest pipeline taxonomy.** Add a `mapping` stage (today everything is `admin`); cover `seedOmfpDefaults` (currently silent).
7. **Enforced by tests.** Add the missing `tests/integration/audit/**`: every write path emits exactly one audit row per entity, in the same transaction, with a valid chain; tamper a row and assert the verifier catches it.

**Why**: this is financial software with a 10-year retention requirement (AGENTS.md). An audit log that the app role can silently `UPDATE`, that loses the "before" on overwrites, and that no job ever verifies, is not an audit log. The period-scoped feature multiplies mapping edits, so the log must be trustworthy before we encourage more editing.

### D9 — Mapping history is first-class domain data, distinct from the audit log

**Decision**: Keep two cleanly separated histories:
- **Valid-time history = the version rows themselves** (D1). "What was cont 6028 mapped to in April" and "when did the rule change" are answered by querying versions directly. This is domain truth and drives resolution.
- **Transaction-time history = the audit log** (D8). "Who changed our mind, when, and from what to what" (including *editing* a past version) lives in the audit log.

Together they are effectively bitemporal, but each table has one clear job. Costi and the UI read the **version timeline** for "how is this mapped over time"; they read the **audit log** for "who touched it".

**Why**: conflating them (reconstructing valid-time from audit blobs) is exactly what makes the current system hard to query. Versions are cheap, indexed, and already required for resolution, so the history comes for free.

### D10 — UI: period-scoped editing stays two-click; modified-this-period is visible

**Decision** (all copy Romanian, no em dashes, `text-[#E9E8E3]` on primary):
- **Default edit = "din aceasta luna inainte"**, defaulting to the currently-viewed `cashflow-month`. The 95% case (a client with only inception versions, editing "pentru toate perioadele") stays exactly as simple as today: drag a cont onto a line, done.
- **A small scope control** in the assign/split dialog: `Aplica: ( ) Pentru toate perioadele ( ) Din [Aprilie 2026] inainte ( ) Doar pentru [Aprilie 2026]`. The last two write dated/bounded versions (D3).
- **A timeline affordance on accounts whose mapping varies over time** (a discreet clock indicator). Clicking opens a per-account timeline: "Pana in martie 2026: Servicii. Din aprilie 2026: Outsourcing." Built from version rows (D9).
- **"Modificat in aceasta perioada" highlighting**: when viewing period `M`, accounts whose effective mapping differs from `M-1` are flagged, directly answering "ce s-a schimbat luna asta".

**Why**: AGENTS.md "Simplicity is the product" and "two clicks". Period-scoping is progressive disclosure: invisible until used, never in the path of the common case.

### D11 — Trend graphs for linii de cost and linii de business (recharts, house style)

**Decision**: Add a trend chart to the Mapari tab (the tab has none today), reusing the `EvolutionChart` recharts pattern and CSS-var theming. For a selected line (or the top N), plot its monthly total over the last 12 months from the D5 per-month series. Mark months where its mapping changed with a `ReferenceLine` (the same primitive `EvolutionChart` already uses), with a tooltip explaining the change. Provide the same for business lines.

**Why**: "graphs how the numbers change month to month" is a direct ask. The engine (D5) already produces the series; recharts is already in and proven; we mirror an existing component rather than invent one.

### D12 — Before/after impact preview on a mapping change

**Decision**: When the accountant stages a mapping change for a period, show a compact diff before they save: which conturi move between lines, and the resulting delta per affected line for that period (and, optionally, the YTD effect). This reuses the D5 engine run twice (current vs proposed resolver state) over the same in-memory context. After saving, the same diff is retrievable from the version timeline + audit log.

**Why**: the accountant must edit with confidence. A reclassification can move tens of thousands of RON between lines; showing the impact before commit prevents silent mistakes (the same class of problem ADR-0002 solved for the tax regime dropdown).

### D13 — Costi gains period-aware mapping tools and an updated brain

**Decision** (per AGENTS.md "Costi is a first-class citizen"):
- New tools in `src/modules/costi/tools.ts` + handlers in `tool-handlers.ts`:
  - `get_cost_lines(client_name, year, month)` -> resolved linii de cost breakdown for the period.
  - `get_business_lines(client_name, year, month)` -> resolved linii de business breakdown for the period.
  - `get_mapping_timeline(client_name, cont?)` -> the version timeline (valid-time history), shaped like `get_tax_regime_timeline`.
  - `get_mapping_changes(client_name, year, month)` -> what changed in/affecting that period (from version diffs + audit), so Costi answers "ce mapari am modificat in aprilie?".
- Thread `year`/`month` through to `loadMapariCashflow(clientId, {year, month})` and the D5 engine; echo the period back (the `get_cpp` precedent).
- Update `training/contabil/structured/costify-app.json`: rewrite `mapari_cashflow_module.data_model` and `resolver_algorithm` to describe `effectiveFrom`/as-of resolution, replace both "Costi nu are inca tools" notes, and document the timeline + trend surfaces.
- Update `tests/unit/modules/costi/tools.test.ts`: bump the tool-count assertion and add required-param tests; the dispatch-completeness test auto-covers the new handlers.
- Context note: the chat sends only `{messages}` (no ambient period). New tools require `year`/`month` as explicit params exactly like `get_balance`/`get_cpp`; the model fills them from the user or via `get_available_periods`.

**Why**: if the accountant can click it, Costi must be able to answer it. Shipping period-scoped mappings without Costi awareness is the exact failure mode AGENTS.md calls out.

### D14 — Published periods are frozen (the integrity boundary)

**Decision**: The entrepreneur's `/firma` view reads the frozen `PublishedPeriod.snapshotData` and is the source of truth shown to the client. The accountant's live surfaces (Mapari, Balanta, CPP) always reflect the live journal + live mappings. The boundary between them is explicit:

- A retroactive mapping edit (open version, bounded override, or tombstone) whose effect touches a period `>= F` **flags every published period `>= F` as `staleSince = now`** (axis-aware: for a bounded override `[from, to]`, flag published periods from `from` onward — over-flagging is safe, under-flagging is not).
- A stale published period shows the accountant a clear "Republica" affordance. **It is never silently re-rendered for the entrepreneur.** The accountant decides when the client sees the new interpretation.
- This wires the **existing but currently-unused** machinery: `staleSince` + `checkPublishedSync` exist (`src/modules/publishing/service.ts`) and today are set only by ingestion, **not** by mapping mutations. Every mapping write path must call the stale-flag step (today none do).

**Why**: financial integrity. A number the entrepreneur was shown (and may have made a decision on) must not change under them because the accountant reclassified an account three months later. This also resolves the retroactive-edit question ADR-0002 explicitly punted (its open question 4.3.b), for the mapping case: live surfaces re-render, published surfaces require a deliberate, audited re-publish. It costs almost nothing to build because the `staleSince` plumbing already exists.

### D15 — PR ordering (RESEQUENCED after Council review)

The order is driven by two rules: **deliver the broadly-valuable surface first**, and **defer the irreversible schema migration until the per-month editing need is validated**. The pure foundation already built (`src/lib/period.ts` + the `...AsOf` builders, 27 tests, typecheck clean) is correct and merge-ready; it is *used* by PR-3 but does not force the migration on its own.

| PR | Content | Schema migration? | Depends on |
|---|---|---|---|
| **PR-1 (Engine + trends)** | Per-month resolve-then-aggregate engine (D5) using the **current global** mapping resolved per month + cost-line/business-line trend graphs (D11). Fixes the existing YTD/single-month inconsistency. Valuable to 100% of clients. | **No** | — |
| **PR-2 (Validate)** | Confirm the per-month *editing* need with a real user (QHM21/Sorin): "would you set a different mapping per month, and where?" Gates PR-3. | — | PR-1 |
| **PR-3 (Period schema + editor)** | `effectiveFrom`/`effectiveTo` on all 6 tables + unique change + idempotent backfill (D6) + wire the `...AsOf` builders + two-layer resolution (D3) + scope-control editor (D10) + stale-flag wiring (D14) + bypass mapping caches (D7). | **Yes (the point of no return)** | PR-1, PR-2 |
| **PR-4 (History + impact)** | Per-account mapping timeline + "modificat in aceasta perioada" highlighting (D10) + before/after impact preview (D12). | No | PR-3 |
| **PR-5 (Costi)** | New tools + handlers + `costify-app.json` + tests (D13). | No | PR-3 |
| **PR-B (Audit rewrite)** | Atomic/chained/one-row-per-entity audit + append-only SQL step + verification job + integration tests (D8). | Yes (audit table only) | — (parallel anytime) |
| **PR-F (Cache, conditional)** | `ComputedMappingPeriod` + per-period watermark invalidation, **only if profiling shows the large-client compute is too slow** (D7). | Yes (one cache table) | PR-1, measurements |

PR-1 and PR-B can proceed in parallel and ship value with no dependence on the period schema. PR-3 is the only irreversible step and is gated on PR-2. PR-4/PR-5 depend on PR-3. PR-F is gated on measurement.

**Note on trends vs history**: PR-1's trend graphs are valuable immediately (they show how each line evolves month over month under the single current mapping). The "what changed this month" markers and the change-history timeline only light up once versions exist (PR-3) — until then a client simply has no mapping changes to show, which is correct.

## Open questions

1. **Default scope of an edit**: confirm the default is "din luna curenta inainte" (recommended, matches "I noticed this from now on") vs "pentru toate perioadele" (matches today's behaviour). The dialog offers all three regardless; this only sets the pre-selected radio. **Note**: the owner confirmed precise per-month control is the goal (D1/D5), so all three scope options are in v1; only the pre-selected default remains to confirm.
2. **YTD display when a mapping changed mid-year**: RESOLVED. D5 sums per-month with each month's mapping (confirmed). We surface a discreet note on the YTD total when any constituent month's mapping differs ("maparea s-a schimbat in [luna]"), so the number is never silently surprising.
3. **Trend window**: 12 months rolling (consistent with `EvolutionChart`), showing only months that exist for short-history clients (ADR-0003 open-question 1 precedent).
4. **Append-only enforcement mechanism**: `REVOKE` on the app role vs a `BEFORE UPDATE/DELETE` trigger. `REVOKE` is simpler but needs a separate migration role; the trigger is self-contained. Leaning trigger.
5. **Do partner-level mappings need their own timeline UI**, or is the account/category timeline enough for v1? Partner overrides are the highest-volume table; a full per-partner timeline UI may be post-v1.
6. **PR-2 validation outcome** (the real gate): if the real user says per-month *editing* is not needed, PR-3 (and the schema migration) is deferred indefinitely and we ship only PR-1 (engine + trends, no migration). This is a feature gate, not just a question.
7. **Bounded-override overlap**: the service forbids overlapping bounded overrides per key. Is "stacked" overrides (a narrower one inside a wider one) ever a real need? Assumed no for v1; revisit only if a real case appears.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `prisma db push` cannot express `REVOKE`/triggers; the audit append-only step needs real SQL | Append-only stays unenforced | Introduce a `prisma/sql/` step run by `devops/deploy.sh` (or adopt `prisma migrate` for this table). Decide in PR-B (open question 4). |
| Per-month resolve-then-aggregate is slower than resolve-once on large clients | Slow Mapari load on 200k-row clients | The journal is already loaded once; per-month resolution is pure JS over the same context (proven by `computeMonthlyTrends`). Measure on QHM21/Upperhouse in PR-1; if slow, PR-F adds the period cache. |
| Two-layer resolution (bounded override + open timeline) confuses resolution or overlaps ambiguously | Wrong numbers | Service enforces non-overlapping bounded overrides per key; resolution is bounded-first-then-as-of (D3). Unit-test the resolver for: inception only, single open version, open + bounded override window, tombstone (open and bounded), retroactive base edit under an existing override (must stay reference-correct). The open-layer cases are already covered (27 tests); add the bounded cases in PR-3. |
| Unique-constraint change `(clientId, cont)` -> `(clientId, cont, effectiveFrom)` breaks existing upsert call sites | Write paths throw | All 24 write paths audited (they upsert on the old key); each must move to the new key. Covered by PR-3; integration test asserts every write path still succeeds and emits audit. |
| Retroactive edit silently changes a number the entrepreneur already saw | Lost trust / integrity failure | D14 freeze: live surfaces re-render, published periods are flagged stale and require a deliberate re-publish. Wired into every mapping write path in PR-3. |
| Global `dataVersion` still over-invalidates the kept `ComputedPeriod` on mapping edits | Wasted recompute (not incorrectness) | Acceptable: `ComputedPeriod` is mapping-independent so it recomputes to the same value. Only revisit if profiling flags it. |
| Costi tool-count test and `costify-app.json` drift | CI red / stale Costi brain | PR-5 updates all three in lockstep (D13); the dispatch-completeness test enforces handler coverage. |

## Implementation map

| Layer | File(s) | PR | Status |
|-------|---------|----|--------|
| Period helpers | `src/lib/period.ts` (`periodKey`, `pickAsOf`, `ytdPeriods`, ...) + `tests/unit/period.test.ts` | PR-1 | **Done (15 tests)** |
| As-of resolvers (open layer) | `src/modules/categories/resolver.ts` (`buildResolverStateAsOf`), `src/modules/verticals/resolver.ts` (`buildVerticalResolverAsOf`) + `*-asof.test.ts` | PR-1/PR-3 | **Done (12 tests)** |
| Compute engine | `src/modules/reporting/owner/line-series.ts` (pure pivot `computeLineSeriesGeneric` + `computeCostLineSeries`/`computeBusinessLineSeries` adapters, D5/D11) + `src/modules/reporting/owner/line-trends.ts` (`loadLineTrends` single-read loader) | PR-1 | **Done (engine 13 + adapter 5 + equivalence 3 golden-master on QHM21; tsc clean)** |
| Trends UI | `src/components/clients/mapari-cashflow/line-trends-chart.tsx` (recharts stacked-area, axis ToggleGroup, legend toggles; mirrors `owner/evolution-chart.tsx`, D11) + `src/app/api/line-trends/route.ts` (auth-gated endpoint) | PR-1 | **Done (route 401-gated + compiles; page renders 200)** |
| Schema | `prisma/schema.prisma` (6 tables gain `effectiveFrom` + `effectiveTo` + unique change; `CostCategory`/`Vertical` gain `archivedAt`) | PR-3 | Pending (gated on PR-2) |
| Backfill | one-shot idempotent inception backfill (`effectiveFrom = 0`, D6) | PR-3 | Pending |
| Bounded layer | extend `...AsOf` builders with override-first resolution (D3) | PR-3 | Pending |
| Caching | `src/modules/cache/loaders.ts` (bypass mapping caches); later `ComputedMappingPeriod` sibling | PR-3 / PR-F | Pending |
| Write paths + stale-flag | `src/modules/{categories,verticals,partner-mappings}/actions.ts`, `seed.ts` (new unique key, transactional bump+audit, D14 stale-flag) | PR-3 | Pending |
| Audit | `src/modules/audit/{service,checksum,types,trail,helpers}.ts` (rewrite), new `prisma/sql/` append-only step, `src/modules/clients/data-version.ts` | PR-B | Pending |
| History/impact UI | `src/components/clients/mapari-cashflow/{category-workspace,edit-allocation-dialog,partner-lob-panel,lines-view}.tsx` (scope control, timeline, highlighting, before/after) | PR-3/PR-4 | Pending |
| Costi | `src/modules/costi/tools.ts`, `tool-handlers.ts`, `training/contabil/structured/costify-app.json`, `tests/unit/modules/costi/tools.test.ts` | PR-5 | Pending |
| Tests | `tests/unit/modules/categories\|verticals/resolver-asof.test.ts` (done), `tests/integration/audit/**` (new), write-path integration tests | PR-1/PR-3/PR-B | Partial |

## Testing strategy (every angle)

Two guarantees in this ADR are only real if tests prove them: **D6 "zero behavioural change on deploy"** (inception-only clients must produce byte-identical numbers) and **D14 "published periods never silently change"**. The plan below is built around proving those, then covering everything else by layer and by invariant. It reuses the harnesses that already exist (`runVerificationSuite`, baked fixtures, `tests/fixtures/{entries,balance-rows}.ts`) instead of inventing new ones.

### Angle map (what we are defending against -> how)

| Angle | Threat it kills | Layer / harness | Phase |
|---|---|---|---|
| Pure example tests | Wrong as-of pick, wrong precedence | `tests/unit/**` vitest | done + PR-1/PR-3 |
| Invariants / property tests | Money created or lost; order-dependence; non-determinism | seeded generators (no new dep) in `tests/unit/**/*-invariants.test.ts` | PR-1/PR-3 |
| Differential / golden-master | The refactor changes a real client's numbers | NEW `engine-equivalence` reconciliation reusing the 14 real-client fixtures | PR-1 |
| Characterization snapshot | Silent drift over time | extend `scripts/build-fixture-snapshot.ts` + snapshot asserts | PR-1 |
| Integration (DB) | Write path / migration / constraint / isolation bugs | `tests/integration/**` (new runner, see below) | PR-3/PR-B |
| Audit | Tamper, non-atomicity, lost before/after | `tests/integration/audit/**` | PR-B |
| API / e2e | Endpoint + Costi tool contract | `tests/e2e/**` (supertest) | PR-1/PR-5 |
| UI / Playwright | Editor writes wrong timeline; visual rule breaches | `tests/ui/**` | PR-3/PR-4 |
| Performance | Live compute too slow on big clients | benchmark with budget; gates PR-F | PR-1 |
| Negative / fuzz | Bad splits, overlaps, impossible periods | unit + integration | PR-3 |
| Concurrency | Lost update / overlap race on a key | integration with parallel writes | PR-3/PR-B |
| Security / tenant | Cross-tenant version leak | integration isolation test | PR-3 |

### Layer 0 — Pure unit (fast, no I/O)

- **Done**: `tests/unit/period.test.ts` (15), `tests/unit/modules/categories/resolver-asof.test.ts` (6), `tests/unit/modules/verticals/resolver-asof.test.ts` (6).
- **PR-1 engine** (`tests/unit/modules/reporting/line-series.test.ts`): single-month breakdown; YTD = Jan..M; trend series = array of monthly slices; tombstone -> OMFP fallback; analytic-over-contBase preserved per month; cross-year guard (YTD sums only Jan..M of the selected year; prior years closed to 121 are not double-counted); empty journal; single month of data.
- **PR-3 two-layer** (extend the two `-asof` files): bounded override wins in-window; base resolves outside-window **live after a base edit** (the reference-correctness regression the Council flagged); bounded tombstone; override spanning a year boundary; analytic override inside a bounded window.

### Layer 1 — Invariants / property tests (the "every angle" core)

Seeded pseudo-random generators (deterministic, no `fast-check` dependency) produce thousands of (journal, mapping-timeline, period) triples and assert laws that must hold for ANY input:

1. **Conservation**: `Σ line totals == Σ raw rulaj` for the resolved class (6/7), single-month and YTD. Mappings move money between lines, never create or destroy it.
2. **YTD additivity**: `ytd(year, M) == Σ_{m=1..M} singleMonth(year, m)` per line. Holds for global mappings AND period-scoped timelines.
3. **Split conservation**: `Σ applySplit(amount, splits) == round2(amount)` exactly (last slice absorbs rounding) for any valid split.
4. **Determinism / order-independence**: shuffling version input order never changes resolution (already asserted for `pickAsOf`; extend to full engine).
5. **Reference-correctness**: editing the base open version never changes any period covered by a bounded override, and changes every open period as expected.
6. **Idempotent migration**: running the inception backfill twice == once.
7. **Global-mapping equivalence (law form)**: with a single inception version, per-month-then-sum == resolve-once-over-YTD. This is the mathematical statement behind the golden-master below.

### Layer 2 — Differential / golden-master (proves D6)

The crown jewel for this refactor. We already reconcile 14 real clients against their Saga balances (`runVerificationSuite`). We add a sibling **engine-equivalence** suite:

- For each real fixture (qhm21, upperhouse, citibox, ...), at each closing period, assert the **new per-month engine output == the current `loadMapariCashflow` / owner-breakdown output to the bani**, given inception-only versions. If they ever diverge, the refactor changed a real number and the build fails.
- Capture the new engine's per-line + per-month series into the baked snapshot (`scripts/build-fixture-snapshot.ts`) so future drift is caught by a committed snapshot diff.
- One hand-built period-scoped scenario with a **hand-computed expected YTD** (cont reclassified mid-year): asserts the engine does the right thing when mappings actually differ across months (golden-master can't cover this because no real fixture has versions yet).

### Layer 3 — Integration (DB, PR-3/PR-B)

Stand up `tests/integration/**` against a disposable Postgres schema (testcontainers per AGENTS.md, or a `costify_test` schema reset per run; add `test:integration` script). Cover:

- **Migration + backfill**: `effectiveFrom`/`effectiveTo` columns exist; backfill sets every existing row to `effectiveFrom = 0`; resolution after migration == before (re-run a golden client through the DB path).
- **All 24 write paths**: each writes the correct version row on the new unique key, bumps `dataVersion`, emits exactly one audit row per entity, all inside one `$transaction` (assert: kill the audit insert -> mutation rolled back; D8 atomicity).
- **As-of resolution over real rows**: insert a timeline, query at several periods, assert.
- **Non-overlap constraint** (D3): service rejects an overlapping bounded override; concurrency test fires two overlapping writes in parallel and asserts exactly one wins.
- **Publish-freeze (D14)**: editing a mapping that touches a published period sets `staleSince` and does NOT mutate `PublishedPeriod.snapshotData`; re-publish clears it.
- **Tenant isolation**: tenant A's versions never resolve for tenant B.

### Layer 4 — Audit (PR-B)

- Hash-chain continuity across a sequence of writes; tamper one row -> verifier flags the break (today `verifyAuditChecksum` is never called).
- One row per entity for bulk ops (no 2000->1 collapse), grouped by `batchId`.
- `before`/`after` + `changedFields` correctness on create/update/delete/overwrite (the cases that are currently wrong).
- Append-only enforced at DB: `UPDATE`/`DELETE` on `AuditEvent` by the app role is rejected.
- Atomicity: a failed mutation leaves no audit row, no version, no bump.

### Layer 5 — API / e2e

- `/api/mapari-cashflow?year=&month=` returns the period-correct breakdown; the new trend endpoint returns the series.
- Costi tools (PR-5): `get_cost_lines` / `get_business_lines` / `get_mapping_timeline` / `get_mapping_changes` return period-aware shapes; `tests/unit/modules/costi/tools.test.ts` tool-count + required-param + dispatch-completeness gates updated.

### Layer 6 — UI / Playwright (PR-3/PR-4)

- Scope editor: "doar pentru luna" / "din luna inainte" / "toate perioadele" each produce the expected timeline (assert via the DB/API after the click).
- "Modificat in aceasta perioada" highlighting appears only on conts whose effective mapping differs from `M-1`.
- Per-account timeline affordance renders the version history.
- Before/after impact preview shows the right deltas.
- Trend graphs render (mirror existing `EvolutionChart` specs).
- Visual rules (grep the rendered DOM): no em dash in user copy, Romanian strings, no `text-white` on `bg-primary` (literal `#E9E8E3`).

### Layer 7 — Performance (gates PR-F)

- Benchmark the per-month engine on the two heaviest real fixtures (qhm21 ~16.8k, upperhouse ~194k rows): assert the full YTD + 12-month series computes under a budget (start: 400 ms typical, 2.5 s worst-case from the ADR analysis). A regression past budget fails CI and triggers the PR-F cache decision, not a silent slowdown.
- **Measured (PR-1, `tests/unit/modules/reporting/line-trends-bench.test.ts`, `BENCH=1`)**: the new work (12 monthly balance derivations + cost expense + cost revenue + business series, OMFP-fallback resolver = worst case for line count) over the real journals, excluding the DB read: **QHM21 16,802 entries -> 98 ms; Upperhouse 193,684 entries -> 501 ms.** Comfortably under budget. **Decision: ship PR-1 with no mapping cache** (profile first, cache last). PR-F's `ComputedMappingPeriod` stays deferred until a real large-client edit loop measures slow. The bench is skipped in the default suite and asserts `< 5000 ms` as a regression tripwire.

### Must-pin decisions the tests lock

- **Rounding**: per-month resolve-then-aggregate rounds each month's slice, then sums; this can differ by a few bani from sum-then-round. We pin **round at the boundary (sum raw, round once per line per view)** so YTD == Σ single-months exactly (invariant 2). A dedicated test asserts no rounding drift across 12 months.
- **Cross-year YTD**: YTD is strictly Jan..M of the selected year; prior years live in opening balances (121). Test asserts a December-of-prior-year mapping does not leak into the current-year YTD except via the closing balance.

### Coverage gates & CI

- Per AGENTS.md: modules 90%, the engine and resolvers 100% line + branch (they are pure and cheap to cover fully).
- Per-PR gate: `lint -> typecheck -> test:unit (incl. invariants + engine-equivalence) -> test:integration -> e2e -> ui`. PR-1 cannot merge unless the engine-equivalence suite is green on all 14 fixtures.
- Optional aspiration (not v1): mutation testing (Stryker) on the resolver + engine to confirm the invariant tests actually kill mutants.

### Test data factories

Extend `tests/fixtures/entries.ts` with a `mappingTimeline()` factory (open versions + bounded overrides + tombstones) and a `journalWithReclassification()` scenario builder, so period-scoped cases are generated, not hand-typed.

## References

- `docs/decisions/0002-tax-regime-timeline.md` — the effective-dated timeline pattern this ADR mirrors.
- `docs/decisions/0003-cashflow-control-antreprenor.md` — the Mapari module + owner view this extends; `computeMonthlyTrends` + `EvolutionChart` are the trend precedents.
- `docs/decisions/0001-plan-de-conturi-refactor.md` — catalog roles (mapping-independent KPIs that keep `ComputedPeriod` valid).
- `prisma/schema.prisma` — the six mapping tables (no temporal columns today).
- `src/modules/cache/loaders.ts`, `src/modules/balances/computed-period.ts` — the cache layers analysed in D7.
- `AGENTS.md` — "profile first, cache last"; "Costi is a first-class citizen"; "Simplicity is the product"; audit principles.
