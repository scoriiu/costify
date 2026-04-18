# ADR-0001 — Plan de conturi refactor

**Status**: Accepted
**Date**: 2026-04-18
**Authors**: coriiu
**Context owners**: coriiu, claudia, sorin (internal), contabil extern (consulted, not blocking)

## Summary

We are moving the Romanian chart of accounts (plan de conturi) out of TypeScript files and into the database, in two layers:

1. **`AccountCatalog`** — the OMFP 1802 standard accounts (~700), platform-maintained, read-only per tenant.
2. **`ClientAccount`** — the analytic accounts (`401.00023`, `5121.BT`, etc.), per client, editable by the accountant, auto-populated at import time.

This unlocks: correct CPP with no silently dropped accounts, per-client account naming with sticky edits, the "Plan de Conturi" tab on the client page, and the foundation for SAF-T export later.

This ADR captures the decisions we're committing to — including the places where we deliberately diverge from the external accountant's proposals in `docs/ro/intrebari-contabil-plan-conturi.md`. The accountant was consulted and gave detailed written answers; they are not blocking approvals, and we reserve engineering judgement on the points below.

## Decisions

### D1 — Storage primary key is `clientId`, not `datasetId`

**Decision**: `ClientAccount` is keyed on `(clientId, cont)`. Unique constraint `@@unique([clientId, cont])`. There is no `datasetId` on this table.

**Why**: The product was refactored to journal-centric in the `766302d` commit — one journal per client, entries accumulate across imports, `ImportEvent` is audit-only. Datasets no longer exist as a concept. Reintroducing `datasetId` would be a regression.

**Divergence from accountant**: The accountant's proposed schema (section 3.5 of the questions doc) uses `datasetId`. They were working from an older mental model. Technical-only correction; the intent is unchanged.

---

### D2 — "Standard OMFP" = `AccountCatalog` membership, not a syntactic rule

**Decision**: An account is classified as standard iff its base code (the part before the first dot, if any) is a row in `AccountCatalog`. Everything else is analytic. The legacy "has a dot = analytic" rule in `src/lib/accounts.ts` is superseded.

**Why**: The accountant's answer in section 1.2 is correct and rigorous. Codes like `44271`, `46711`, `40111` look syntactically synthetic but are analytics by OMFP construction — the standard stops at 4 digits. Membership-based classification catches this; syntactic rules do not.

**Implication**: We need the *full* OMFP 1802 Anexa 1 seeded into `AccountCatalog`, not the ~100 accounts hardcoded today.

**Agreement with accountant**: Full alignment on section 1.2.

---

### D3 — Source of truth for `AccountCatalog` is OMFP 1802, not Saga's export

**Decision**: We seed `AccountCatalog` from the OMFP 1802 Anexa 1 (+ relevant amendments: OMFP 2844/2016 for IFRS, OMFP 85/2022, OMFP 2048/2022, OMFP 2493/2023). Saga's exported plan de conturi is used as a *scaffolding/reference* only; when Saga and OMFP disagree, OMFP wins.

**Why**: Saga is a vendor. Their export reflects their product choices — naming, analytics they pre-configure, accounts they chose to include. That's not authority; it's opinion. If we seed from Saga, we inherit Saga's opinions forever.

**Divergence from accountant**: Section 1.1 recommends Saga's export spreadsheet as "sursa practica cea mai completa." We use it as a *starting point* but validate every row against OMFP.

**Practical plan**:
- Extract OMFP 1802 Anexa 1 into `training/contabil/structured/plan-conturi-omfp.json` (authoritative).
- Cross-check against the Saga export — wherever they disagree, mark with a review flag in the seed script.
- Flag accounts that are OMFP 2844-only (IFRS) with `isIfrsOnly: true` so OMFP 1802 clients don't see them by default.

---

### D4 — Account type (A/P/B) lives in `AccountCatalog`

**Decision**: `AccountCatalog.type` is one of `"A"`, `"P"`, `"B"`. We seed it from OMFP rules and from the Saga reference. Analytics inherit the type of their `contBase`.

**Why**: Today `getAccountType()` in `src/lib/accounts.ts` is a function with ~20 hardcoded exceptions. A table is simpler, more auditable, and easier to correct when we find a case the function got wrong.

**Agreement with accountant**: Section 1.3 lists the exceptions we need. No objections.

---

### D5 — Special-account flags are explicit columns on `AccountCatalog`

**Decision**: Each row in `AccountCatalog` carries explicit booleans:
- `isClosing` — `121`, `1211`, `1212` (excluded from CPP)
- `isProfitTax` — `691`, `694`, `697`, `698` (separate CPP line, excluded from cheltuieli exploatare)
- `isProfitDistribution` — `129` (active despite class 1, subtracted from rezultat in bilant)
- `isTransit` — `473`, `5125`, `581` (see D8 for how we use these)
- `isExtraBilantier` — class 8/9 accounts (visible in balanta, excluded from bilant/CPP)

Family flags (`receivables_family`, `payables_family`, etc.) from the accountant's section 1.4 table become grouping columns, not booleans — see D7.

**Why**: Instead of encoding these rules in multiple places (CPP function, KPI function, balance function), they live on the account row itself. Anywhere we need to know "is this account special?", we read the flag. One source of truth.

**Agreement with accountant**: Section 1.4 is the authoritative list. We implement it exactly.

---

### D6 — CPP groupings are keyed to F20 line numbers in `AccountCatalog`

**Decision**: Each row in `AccountCatalog` has an optional `cppLine` column mapping to the ANAF F20 row number (01–62). The `computeCpp` function groups by `cppLine`, not by hardcoded prefix lists.

**Why**: 
- The bug we just fixed (missing 603, 725, 767) was caused by the prefix list in `src/modules/reporting/cpp.ts` being hardcoded and incomplete. Moving the mapping to data eliminates the whole bug class.
- Grouping by F20 lines means any account that gets added to the catalog with an F20 line shows up in the CPP automatically.

**Agreement with accountant**: Section 2.1 provides the full list. This is the single most valuable answer in the document.

---

### D7 — We ship **one** CPP display mode ("Simplificat") for v1

**Status**: Superseded by D17.

**Decision**: The CPP view renders at the account-line level with F20 groupings as section headers. We do not ship the "Detaliat F20" mode (62 rows mirroring the ANAF declaration) in v1.

**Why**: 
- Two display modes = two code paths, two test sets, two failure modes when a number disagrees with Saga.
- The F20 structure is latent in the data (every account has a `cppLine`), so adding F20 export later is a one-day build, not a rewrite.
- Users (accountants) read CPP daily for analysis; they file F20 annually. Ship the daily tool first.

**Divergence from accountant**: Section 2.2 recommends both modes. We ship only simplified; F20 export is deferred to v2.

**Supersession**: D17 reverses this — we now ship both modes. The underlying reasoning of D7 (two code paths is risky) was addressed by keeping the compute layers in lock-step via a shared reconciliation test: `F20.rezultatBrut === Simplificat.rezultatBrut` for any input, enforced in `cpp-f20.test.ts`.

---

### D8 — Cash KPI excludes in-transit accounts (`581`, `5125`)

**Decision**: 
```
cashBank = (5121 + 5124 + 5311 + 5314 + 542) finD − finC
```
Accounts `581` and `5125` are **not** in the cash KPI. Instead, we surface a data-quality warning when their sold ≠ 0.

**Why**:
- `581 Viramente interne` has an expected end-of-period sold of 0. If sold = 0, including it adds nothing. If sold ≠ 0, we're double-counting (the money is both on `581` and on one of the real cash accounts).
- `5125 Sume in curs decontare` is in-transit money that will land in `5121` shortly. Including it means when it lands mid-period, we count it twice.
- A data-quality warning is more useful to the accountant than a silently-inflated cash number.

**Divergence from accountant**: Section 2.4 includes both `581` and `5125` in the cash formula "with a warning if ≠ 0". The accountant's *reasoning* matches ours (sold should be 0, deviations are errors). We disagree on the conclusion — the right treatment of an account whose sold should be 0 is to exclude it from a sum KPI and surface a separate warning.

**Agreement with accountant**: `542 Avansuri trezorerie` stays in the cash KPI (money out with an employee is still firm liquidity).

---

### D9 — TVA KPI uses the computed formula, not the post-close snapshot

**Decision**: 
```
tvaDePlata = max(0, 4427 − 4426 − 4424 − 4428) rulajTC/TD on the selected period
```
We do **not** use `4423 finC` as the primary KPI.

**Why**: The monthly VAT regularization (when `4427`/`4426` net out into `4423`) happens at period close, often late in the month. A dashboard that runs on the 15th needs to show the *current* VAT obligation, not the last closed period's. The computed formula does that; `4423 finC` does not.

We may add a secondary "TVA dupa regularizare" panel that reads `4423` for users who want to see the post-close state, but it's not the primary KPI.

**Divergence from accountant**: Section 2.4 recommends `4423 finC` as primary. We invert the priority.

---

### D10 — Analytic name resolution: Saga `denumire` first, `explicatie` extraction second

**Decision**: For each analytic account, name resolution priority is:
1. User-edited name (`ClientAccount.customName`, when `source = "user_edit"`) — sticky, never overwritten.
2. `denumire_d` / `denumire_c` columns from the most recent Saga import (even if truncated).
3. Frequency-extracted name from `explicatie` (current `buildPartnerMappings` logic).
4. Base account name + suffix (e.g. "Furnizori 00023").
5. `needsReview = true` flag visible in UI.

**Why**:
- `denumire_d`/`denumire_c` is the account's official name inside Saga. Truncation (Saga sometimes caps at 40 chars) is *deterministic* — the same truncation every time. Frequency extraction from `explicatie` is *fuzzy* — the result drifts as the accountant writes different explanations across months.
- A stable-but-slightly-truncated name is better than a drifting name for display and for accountant workflow (they recognise "Orange Romania" even if it's truncated to "Orange Rom").

**Divergence from accountant**: Section 3.4 proposes `explicatie` first, `denumire` not mentioned as a source. We invert — Saga's column data is more reliable than parsing free text.

**Agreement with accountant**: 
- Sticky manual edits (D10 priority 1 = section 3.3).
- Never delete analytic accounts — only deactivate (section 3.2 question 3).
- Audit log for name history (section 3.2 question 2).

---

### D11 — Extra-bilantier accounts (class 8, 9) are visible in Balanta only

**Decision**: Accounts with `AccountCatalog.isExtraBilantier = true` appear in Registru Jurnal and Balanta de Verificare, but are excluded from Bilant, CPP, and KPIs. The Balanta UI gets a small flag ("extra-bilantier") on these rows.

**Why**: OMFP treats these as memorandum accounts. They track things like guarantees given/received that aren't part of the firm's own assets or liabilities. The balanta shows them (for completeness); the bilant and CPP must not (they'd skew totals).

**Agreement with accountant**: Section 1.3 part 3.

---

### D12 — `ClientAccount` unifies `JournalPartner` (they become one table)

**Decision**: We migrate `JournalPartner` into `ClientAccount` with `source = "saga_explicatie"`. Going forward there is one table for all account-level metadata per client.

**Why**: They represent the same thing (a per-client view of an account) with different provenance. Two tables = two places to query, two caches to invalidate, two sources of inconsistency. Unification matches the accountant's proposal and simplifies everything downstream.

**Agreement with accountant**: Section 3.5.

---

### D13 — `tax_regime` is a `Client` field; tax calculation stays manual (for now)

**Decision**: Add `Client.taxRegime` enum:
- `profit_standard` → CPP impozit line reads account `691`
- `profit_micro_1` / `profit_micro_3` → reads `698`
- `imca` → reads `697`
- `profit_specific` → reads `695`
- `deferred` → reads `698`

The field controls *which account* the impozit line in CPP displays. It does **not** compute what the tax *should* be.

**Why**: Mapping regime → display account is trivial. Computing expected tax is hard — requires knowing revenue thresholds, deductibility rules, micro-to-profit crossover detection, dividend treatment, loss carry-forward, etc. That's a product, not a field. Scoped out of this ADR explicitly.

**Agreement with accountant**: Section 2.3 (mapping). **Divergence**: we don't commit to a calculation.

---

### D14 — At reimport, new unknown accounts are auto-added with a review flag

**Decision**: When import discovers a cont whose `contBase` is not in `AccountCatalog`:
- Create the `ClientAccount` row automatically (no prompt to the user).
- Set `needsReview = true`.
- Surface in the "Plan de Conturi" tab with a red indicator.
- Log an `AuditEvent` with category `"unknown_account_discovered"` so we can sweep these across clients and update `AccountCatalog` centrally.

**Why**: Blocking imports on unknown accounts would frustrate accountants. Silently accepting them would recreate the "cont 6588 triunghi galben" problem. The middle path — accept + flag + log — keeps imports smooth and makes the gap visible to *us* for platform-level catalog updates.

**Agreement with accountant**: Section 4.2.

---

### D15 — Audit retention: 10 years, `AuditEvent` records for every account change

**Decision**: Every edit to `ClientAccount` (name, source, manual override, deactivation) produces an `AuditEvent` with `before` / `after` payloads and the standard checksum. Retention is 10 years minimum across all audit records.

**Why**: Financial records law. Non-negotiable.

**Agreement with accountant**: Section 8.1.

---

### D16 — `AccountCatalog` is platform-maintained, not client-editable

**Decision**: Only platform migrations modify `AccountCatalog`. Clients (accountants using Costify) can create/edit `ClientAccount` rows but cannot add to or change `AccountCatalog`. When a client uses an account we've never seen before, D14 applies; we decide centrally whether to add it to the catalog in the next release.

**Why**: If every tenant could edit the catalog, we'd have 1000 divergent catalogs within a month, we'd break CPP/KPI consistency across clients, and we'd lose the ability to ship bug fixes (a fix to how `4428` is handled would have to be reapplied per tenant).

**Agreement with accountant**: Section 4.2.

---

### D17 — Ship "Detaliat F20" CPP mode alongside "Simplificat" (supersedes D7)

**Decision**: The CPP tab offers two view modes, switchable with a toggle in the page header:
- **Simplificat** — one line per contributing account, grouped under 4 CPP sections. Used for daily analysis.
- **F20 detaliat** — 35 rows matching OMFP 1802 Anexa 3 exactly (rd. 01 … rd. 35), with sub-rows 13a-e, 14a-b, 15a-b, 16a-b, 17a-d, 18a-b. Used for annual filing and reconciliation with the declared form.

Both views compute from the same `BalanceRowView[]` in parallel inside `/api/balance`. Switching modes is a local UI state flip — no extra request.

**Why reverse D7?**
- The accountant explicitly asked for F20 conformity in section 2.2 of the questions doc.
- The latent concern in D7 (two code paths risk disagreement with Saga) is mitigated by an invariant test: `computeCppF20(rows).rezultatBrut === computeCpp(rows).rezultatBrut` for any input. Enforced in `tests/unit/modules/reporting/cpp-f20.test.ts` ("reconciliation with simplified CPP").
- F20 detaliat mode surfaces the sub-row decomposition (e.g. salarii 14a vs. asigurari 14b) that the simplified view doesn't — useful for audit/review, not just filing.
- The extra implementation cost is bounded: ~35 rows of seed data + one pure function (~220 lines with full provenance) + one presentational component. The Plan de Conturi and balanta layers are untouched.

**Architecture**:
- `seeds/f20-structure.json` — the authoritative 35-row form structure per OMFP 1802 Anexa 3 (with amendments OMFP 85/2022, OMFP 2048/2022). Every detail row declares its contributing accounts and their side (D or C); every subtotal/total declares a symbolic formula ("rd.12 - rd.19") evaluated by a tiny safe parser.
- `AccountCatalog.cppLine` + `cppLineLabel` — the F20 row each account maps to (e.g. 641 → "14a"). Populated from the structure seed via `scripts/backfill-cpp-line.mjs`. Accounts appearing on two rows (711/712 positive vs. negative stocks variation; 786 on rd.24 and rd.26b) use the *primary* row in the column; the compute layer handles the split at runtime based on sign.
- `src/modules/reporting/cpp-f20.ts` — pure `computeCppF20()`. Aggregates by contBase, evaluates rows in document order, applies `taxRegime` to rd.34 per D13.
- `src/components/datasets/cpp-f20-view.tsx` — 4-column table (Rand / Denumire / Conturi / Valoare), section banding A-G, tooltips showing the formula on subtotals/totals.
- `src/components/clients/cpp-tab.tsx` — rewritten to use `ToggleGroup` (view mode) + `Select` (tax regime), replacing the raw `<select>` that violated the shared-primitives rule.

**Out of scope for D17**:
- XML/PDF export of the F20 form (filing itself). The data is filed-ready; emitting the declaration file is a separate deliverable.
- Prior-period column ("exercitiul precedent") that appears on the annual paper form alongside the current period. Adds complexity without clear daily-use value.

---

## Out of scope for v1

Captured here so they don't get rediscovered later:

- **SAF-T export** — structure is F20-aware via D6/D17, but no XML emitter ships.
- **F20 filing emitter (XML/PDF)** — the F20 detailed mode shipped in D17 surfaces the filing-shape data in the app; emitting the canonical declaration file is a separate deliverable.
- **Prior-period F20 column ("exercitiul precedent")** — the current-period column ships in D17; the comparison column is deferred.
- **Tax amount calculation** — `taxRegime` maps display accounts (D13), does not compute expected liability.
- **Bulk CSV import of analytic names** — accountant section 5.4 marks this P1. Export CSV and auto-map are P0.
- **Global template of plan de conturi** (section 5.1 option B) — per-client only for v1.
- **v2 of interactive docs** — current v1 is fine until we hit a real friction; see `docs/research/interactive-docs-v2.md`.

## Follow-up questions to ask the accountant (batched, non-blocking)

When we have them on a call — not blocking progress:

1. **`ClientAccount` keyed on `clientId`** (not `datasetId`) — confirm no objection, we've moved past datasets.
2. **`581` and `5125` excluded from cash KPI** — confirm our reasoning.
3. **TVA KPI uses computed formula** (`4427 − 4426 − 4424 − 4428`), not `4423 finC` — confirm.
4. **Analytic name priority** — `denumire_d` before `explicatie`-extraction — confirm.
5. **F20 detailed mode shipped** (per D17) — confirm row labels, sub-row allocations (13a-e, 14a-b, 15a-b, 16a-b, 17a-d, 18a-b), and account mappings match what you'd file.
6. **QHM21 cont 121 diff** — we bring concrete numbers from our verify script.
7. **QHM21 cont 421 diff** — same.

## Implementation order (shipping plan)

1. `AccountCatalog` table + seed JSON from OMFP 1802 Anexa 1 + migration.
2. `ClientAccount` table + migration of `JournalPartner` data.
3. Refactor `src/lib/accounts.ts` to read from `AccountCatalog` (keep the function signatures stable to minimise blast radius).
4. Refactor `computeCpp` to group by `cppLine` (D6) and apply `isProfitTax` / `isClosing` (D5).
5. Refactor KPIs per D8, D9.
6. Import pipeline: on discovery, auto-create `ClientAccount` with review flag (D14).
7. "Plan de Conturi" tab on client page — read-only first, then editable.
8. Re-run the verification script on both real clients; confirm balanta still balances and CPP numbers match where they matched before.
9. Fix the two QHM21 diffs (D7 of the questions doc), now that we have the data model to do it cleanly.

Each step is a PR. Tests at every stage. No big-bang merges.
