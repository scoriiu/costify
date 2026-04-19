# ADR-0002 — Tax regime as a timeline, not a single value

**Status**: Accepted
**Date**: 2026-04-19
**Authors**: coriiu
**Context owners**: coriiu (internal), contabil extern (informed, not blocking)
**Supersedes parts of**: ADR-0001 D13 (which assumed `Client.taxRegime` was the single source of truth for the impozit row).

## Summary

We are replacing the single `Client.taxRegime` flag with a **timeline of transitions** (`TaxRegimePeriod`). Each row represents one regime change with an exact start date. For any report on (year, month), the active regime is resolved by taking the most recent transition with `startDate <= last day of month`.

This unlocks correct accounting for firms that change regimes mid-year (the common case: micro → profit standard upon exceeding the revenue threshold), without forcing the accountant to remember to switch a dropdown before opening each month's report.

## Context

ADR-0001 D13 introduced `Client.taxRegime` as a single column on `Client`, with a dropdown on the CPP tab to switch it. That worked for the simple case (a firm that has been one regime for its whole life), but it produced **silent accounting errors** for the realistic case:

- A firm that was micro in Q1 2025 and switched to profit standard from April 2025 has *both* 691 and 698 with legitimate balances in 2025.
- The dropdown could only point at one of them. Whichever the user selected, the other regime's tax was dropped from rd. 34 of F20.
- The user had no warning; they would close the report and file an incorrect F20.

The dropdown also created a UX trap: the accountant could change the regime by accident, the report would silently shift by tens of thousands of RON, and they had no audit trail of "who changed what when".

## Decisions

### D1 — Model: `TaxRegimePeriod` table, one row per transition

**Decision**: New table `TaxRegimePeriod`:

```prisma
model TaxRegimePeriod {
  id         String   @id @default(cuid())
  clientId   String
  startDate  DateTime
  taxRegime  String
  reason     String?
  createdBy  String?
  createdAt  DateTime @default(now())
  client     Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  @@unique([clientId, startDate])
  @@index([clientId, startDate])
}
```

Each row is one transition. The `@@unique([clientId, startDate])` constraint prevents two transitions on the same day (that would be ambiguous).

**Why**: We considered storing one row per (clientId, year, month) — i.e. a dense grid where every month has an explicit value. We rejected that because:

1. It forces 12 inserts for every change ("set from April onward"), creating noise in the audit log.
2. It models the **wrong mental object**. Accountants think in transitions ("a trecut la profit din aprilie"), not in monthly toggles. Storage should match the mental model.
3. The dense grid would become inconsistent with itself if a transition is added retroactively — we'd have to backfill or sweep.

The transition timeline is a single insert per regime change. Reads use the `ORDER BY startDate DESC LIMIT 1` resolution algorithm below. Both write and read are O(1) effectively, given the small number of transitions per client (typically 1-3).

### D2 — Resolution algorithm: most recent transition with `startDate <= last day of month`

**Decision**: For a query on (year, month):

```
last_day = last calendar day of month
SELECT * FROM TaxRegimePeriod
  WHERE clientId = X AND startDate <= last_day
  ORDER BY startDate DESC LIMIT 1
```

If no row exists: fall back to `Client.taxRegime` (legacy column). If client missing: `DEFAULT_TAX_REGIME = "profit_standard"`.

Implemented in `src/modules/clients/tax-regime.ts:getRegimeForPeriod()`. Pure function over the transitions list lives in `src/modules/clients/tax-regime-resolver.ts:resolveRegimeForPeriod()` and is unit-tested.

**Why "last day of month" not "first day"**: A transition starting mid-month (e.g. April 15) is the regime "for April". The user's intent is "this regime is active starting on this date". The first month it's relevant is the month containing its start date. Using the last day of the queried month captures that.

**Edge cases tested**:
- Transition exactly on the first of the month → applies to that month.
- Transition mid-month → applies to that whole month.
- No transitions before the queried month, but one in a later month → falls back to legacy column or DEFAULT (the queried month is *before* any known regime).

### D3 — Inception transition for legacy clients (1970-01-01)

**Decision**: A helper `seedInceptionTransitionsForLegacyClients()` (idempotent) creates a synthetic transition dated `1970-01-01` for every client that has a value in `Client.taxRegime` but zero rows in `TaxRegimePeriod`. The synthetic transition uses the legacy regime as its `taxRegime`.

In the UI, transitions with `startDate.getUTCFullYear() <= 1970` are rendered as **"De la inceput"** (not as a calendar date). Cannot be deleted while it's the only transition (deletion would leave the client without any regime).

**Why**: We need every client to always have at least one transition so the resolver never returns DEFAULT for a real client. `1970-01-01` is the cleanest "before all real data" sentinel that doesn't require a special boolean column. The helper is idempotent so it can be re-run safely (e.g. in a deploy script or as a one-off migration command).

### D4 — `Client.taxRegime` column kept temporarily, marked `@deprecated`

**Decision**: The legacy column stays in `schema.prisma` with a `/// @deprecated` comment, used only as a fallback when no `TaxRegimePeriod` row matches. It will be dropped in a follow-up migration after we verify all production clients have at least one timeline row.

**Why**: A clean drop in the same migration would risk breaking any code path we missed. Phased removal: keep the fallback, monitor with a metric, drop when zero clients depend on it.

### D5 — UI: timeline lives in Setari tab, CPP shows read-only label

**Decision**:
- **CPP tab**: replaces the regime dropdown with a read-only chip (`Profit standard 16% · Cont 691`) plus a "Gestioneaza" link that deep-links to `/clients/{slug}?tab=setari#regim-fiscal`. The chip updates automatically when the user changes the period selector.
- **Setari tab**: new fifth tab on the client detail page. Section "Regim fiscal" displays the timeline with the current transition badged at the top, history below, and a `+ Adauga tranzitie` button. Modal for add/edit asks for `startDate`, `taxRegime`, optional `reason`.

**Why**: ADR-0001 D13's dropdown placement was the source of the silent-error problem. By moving the regime to a separate config tab, we make changes deliberate, visible, and auditable. The read-only chip on CPP keeps the information visible (so the accountant always knows which regime produced the numbers) without making it a casual click target.

### D6 — Costi tool: `get_tax_regime_timeline`

**Decision**: New tool `get_tax_regime_timeline(client_name)` returns the full ordered timeline plus the current regime resolved as of today. The existing `get_cpp` tool also includes the resolved `taxRegime` in its response so Costi answers consistently.

**Why**: Per the AGENTS.md "Costi is a first-class citizen" rule: any feature that adds data the accountant can ask about must be queryable by Costi in the same PR. Without this tool, Costi cannot truthfully answer "ce regim are firma X in iunie 2025?".

### D7 — Tax computation contract unchanged

**Decision**: The pure functions `computeCpp` and `computeCppF20` continue to accept `taxRegime` as an option. Only the **resolution** changes — callers (`src/app/api/balance/route.ts`, `src/modules/reporting/service.ts`, Costi handlers) now use `getRegimeForPeriod(clientId, year, month)` instead of `client.taxRegime`.

**Why**: Pure functions stay pure. The resolution is an I/O concern (it reads the database), so it lives in the service layer. Tests for the pure functions did not need to change — only the call sites.

## Open questions (deferred to a future ADR or accountant consultation)

- **Cumulative-period reporting on a transition year**: When the user opens CPP cumulative for 2025 on a firm that switched mid-year, the chip shows the December regime (profit standard) and rd. 34 sums only the 691 account — losing the Q1 micro impozit (698). Options: (a) split rd. 34 across regimes and sum, (b) keep current behavior and warn the user, (c) auto-detect transition and silently sum both. See `docs/ro/intrebari-contabil-f20-detaliat.md` § 4.3 dubiu 4.3.a.
- **Retroactive transitions**: Adding a transition with a past startDate retroactively changes all CPP reports for affected periods. This is correct (live computation from timeline) but should it generate an explicit audit event when a "previously seen" period changes? See § 4.3 dubiu 4.3.b.
- **Multi-row F20 rd. 34**: F20 itself accepts only one number on rd. 34. For a transition year, what we report there is the sum of the relevant accounts across the year — but the regime label on the cover sheet is ambiguous. Need legal/accounting guidance.

## Implementation map

| Layer | File | Status |
|-------|------|--------|
| Schema | `prisma/schema.prisma` (model `TaxRegimePeriod`, `Client.taxRegime` deprecated) | Done |
| Pure resolver | `src/modules/clients/tax-regime-resolver.ts` | Done, unit tested |
| Service | `src/modules/clients/tax-regime.ts` (`getRegimeForPeriod`, `getTransitions`, CRUD, seed helper) | Done |
| Server actions | `src/modules/clients/actions.ts` (create/update/delete transition + `updateClientInfoAction`) | Done |
| API | `src/app/api/balance/route.ts` uses `getRegimeForPeriod` | Done |
| Reporting | `src/modules/reporting/service.ts` (`getClientCpp`, `getClientCppF20`) uses resolver | Done |
| CPP UI | `src/components/clients/cpp-tab.tsx` shows read-only chip + Gestioneaza link | Done |
| Setari UI | `src/components/clients/setari-tab.tsx` (3 sections: Informatii / Regim fiscal / Zona periculoasa) | Done |
| Costi tools | `src/modules/costi/tools.ts` (`get_tax_regime_timeline`), `tool-handlers.ts` (handler) | Done |
| Costi training | `training/contabil/structured/costify-app.json` (`setari_tab`, `tax_regime_timeline` blocks) | Done |
| User docs | `docs/ro/setari-client.md`, navigation entry, CPP doc cross-link | Done |
| Tests | `tests/unit/modules/clients/tax-regime-resolver.test.ts`, tool count assertion bumped to 9 | Done |
