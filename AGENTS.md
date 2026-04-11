# Costify — Engineering Standards & Architecture Guide

## Git Rules
- Never add `Co-Authored-By` lines to commit messages.

## Design System Rules

### Palette
- **Primary:** Evergreen Teal `#0D6B5E` (dark: `#0A5A4F`, light: `#34D3A0`)
- **Accent:** Indigo `#6366F1` (light: `#818CF8`)
- **Danger:** `#EF4444` · **Warning:** `#F59E0B` · **Green:** `#3FB950`
- **Light theme surfaces (primary experience):** warm, cream-based. `surface-0: #F0EFEA`, `surface-1: #F7F6F2`, `surface-2: #E6E4DE`, `surface-3: #D9D7D0`. Inspired by Danubian — paper-like, calm, never stark white.
- **Light theme text:** primary `#1A1918`, secondary `#44413C`, muted `#7A766E`
- **Text on light primary buttons:** `#E9E8E3` (warm off-white, never pure `#FFFFFF`)
- **Dark theme surfaces (secondary mode):** teal-tinted, not neutral gray. `surface-0: #0B1514`, `surface-1: #111F1E`, `surface-2: #182A28`, `surface-3: #223633`. No pure blacks — every surface carries a subtle teal undertone from the primary.
- **Dark theme text:** primary `#E9E8E3`, secondary `#C5C3BC`, muted `#8A877F`

### Typography
- **Font:** Altform (regular 400, semibold 600, bold 700). Geist Mono for numbers, labels, data.
- **Heading tracking:** `-0.04em` on all headings and semibold/bold text
- **Body tracking:** `-0.02em` on body text (set globally)
- **Type scale:** Hero 48px, Page title 28px, Section title 20px, Card title 16px, Body 14px, Label (mono) 11px uppercase
- **Financial numbers:** Always Geist Mono, right-aligned in tables

### Buttons
- Flat solid color, no gradients. Shadow glow for depth (`rgba(13,107,94,0.25)`).
- Primary: `bg-primary text-[#E9E8E3]`. Ghost: transparent + border. Danger: red tint.
- Border radius: `rounded-[10px]`. Padding: `px-5 py-2.5`. Font: 14px semibold.
- Never use gradients on buttons — keep the UI calm, Costi provides personality.

### Layout
- Top navigation (no sidebar) — accountants need full width for data tables.
- Nav: logo left, links center-left, user dropdown right.
- No secondary Topbar — page titles are inline in content.
- Max content width: `max-w-7xl` for data pages, `max-w-5xl` for reading pages, `max-w-2xl` for forms.

### Design Principles
- **Data density over whitespace** — accountants want to see more, not less.
- **Conservative color** — reserve strong color for meaning (green=positive, red=attention, teal=actions).
- **Familiar patterns, modern execution** — keep mental models they know (chart of accounts, trial balance) but render them with modern typography and spacing.
- **Progressive disclosure** — summary KPIs first, drill into details.
- **No icons in navigation** — pure typographic, clean.
- **Monospace for all data** — labels, values, numbers always in Geist Mono.
- **No emojis** — unless user explicitly requests.
- **All user-facing text in Romanian** — error messages, labels, tooltips, placeholders, confirmations. Code comments and variable names stay in English. Never mix languages in the same string.

### Component Rules
- Cards: `rounded-xl border border-dark-3 bg-dark-2 p-5`
- Tables: compact, monospaced numbers, right-aligned financial columns, `text-[0.6rem]` uppercase tracking headers
- Table column delimiters: `border-r border-white/[0.04]` on every cell and header, last column excluded. For flex-div grids (virtualized), use `items-stretch` on rows + `flex items-center` inside cells so vertical borders are continuous.
- Table row borders: `border-b border-dark-3/50` (data rows), `border-b border-dark-3` (header). Use `hover:bg-dark-2/40` on data rows.
- Table header padding: `py-2.5 px-3`. Consistent across `<table>` and flex-div grids.
- Virtualized tables (`<table>` not possible): use flex-div layout with `@tanstack/react-virtual`. Native `<table>` for anything under ~500 rows.
- KPI cards: **neutral white (`text-white`) for all informational values**. Color only for values that carry a signal — green/red on Rezultat and Marja (profit/loss), red on TVA de plata (you owe money). Never use a rainbow of colors on KPI cards.
- Status messages: semantic border + tinted background (green/red/yellow/blue at 5% + 20% border)
- Input labels: `font-mono text-[11px] font-medium uppercase` with `-0.04em` tracking

---

## Product Vision

Costify is a multi-tenant financial control platform. Each **user** (typically an accountant or finance manager) operates **thousands of clients**. Each client has their own bank accounts, transactions, budgets, and reports — fully isolated.

The system must scale horizontally to support thousands of concurrent users, each managing 1000+ client organizations.

### Distribution model — through the accountant, not around them

The Romanian entrepreneur rarely buys a financial SaaS directly. They already pay an accountant and expect "to see how the firm is doing" to come from that accountant. This is both a constraint and an opportunity.

- **The paying customer is the accountant.** Costify is priced, packaged and designed for someone who manages a portfolio of clients daily. The accountant is the primary user and decision-maker.
- **The entrepreneur is a guest on the platform.** When the accountant invites them, they get free read-only access to their own firm's data. Never a separate sale, never a separate price tier, never friction beyond accepting an invitation.
- **The accountant is our distribution channel.** Every happy accountant brings N entrepreneurs onto the platform. Every entrepreneur who sees a clear, useful Costify report recommends the accountant to others. That recommendation loop is our growth engine, not marketing spend.
- **Design consequence:** any feature that makes the accountant look good in front of their client is high priority. Inviting an entrepreneur must take two clicks. The report the entrepreneur sees must reinforce "my accountant is a professional" every single time.

### The bilingual product — two languages, one source of truth

Costify serves two very different people from the same data:

- **Contabilul** — the accountant, who works in the official OMFP 1802 vocabulary: jurnal, balanta, cont de profit si pierdere, cont 5121, plan de conturi, debit, credit, analitic, rulaj. This is the language of the profession and we must never water it down. The accountant needs precision and will reject a product that hides the primitives of their craft.
- **Antreprenorul** — the entrepreneur, who does not speak that language and never will. They think in: "cat am in banca", "cat imi datoreaza clientii", "cat trebuie sa platesc saptamana asta", "pot scoate salariul luna asta", "cat am castigat sau pierdut". Zero jargon. Zero numeric account codes. Zero OMFP terminology. If we have to explain what a word means, the word is wrong for them.

Both languages describe **the same underlying journal**. Nothing is fabricated, nothing is simplified into dishonesty. The CPP the accountant sees and the "cat ai castigat luna asta" the entrepreneur sees are the same number — the sentence around it is different. We are not hiding the truth, we are translating it.

**The rule for every new feature:**

1. Every surface (KPI card, table column, chart label, error message, empty state, export, email) must have a concrete form in **both** languages before the feature is considered shipped.
2. If you write a label in only one language, the feature is incomplete. The PR is not ready for merge.
3. If the "entrepreneur version" of a label is identical to the "accountant version" because you could not think of a translation — that is a design bug, not a shortcut. Ask, iterate, find the translation. A literal copy across modes is a failure.
4. The entrepreneur mode must work for someone who has never read a balance sheet in their life. Test with a non-accountant before merging anything entrepreneur-facing.
5. Plan de conturi, cont numeric, debit/credit, rulaj, analitic and other OMFP primitives must never appear in entrepreneur mode. They are translated into entities the entrepreneur already understands: banks, customers, suppliers, the state, employees, the owner themselves.

**The rule for process design:**

Both languages must arrive at the answer with the **same small number of steps**. If the accountant flow has three clicks and the entrepreneur flow has ten, the entrepreneur flow is wrong. Simple and well-defined processes are not a nice-to-have — they are the reason a Romanian entrepreneur would trust software at all. Every flow must pass the test: could I describe this to someone on the phone in one sentence?

- Import: upload a file, see the result. No column mapping, no manual recalculation, no "confirm processing" step the user doesn't understand.
- View: open a page, see numbers. No wizard, no filters to configure before the data appears.
- Share: invite by email, done. No role configuration, no permission matrix, no "set up your workspace first".

If a process needs documentation to use, the process is too complex. Documentation exists to explain **why** something is the way it is, not to operate the product.

---

## Journal-Centric Architecture

The Registru Jurnal (accounting journal) is the single source of truth for each client. Everything else — Balanta de verificare, Cont Profit si Pierdere, KPIs — is computed from it.

### Data Model

```
User (accountant)
  └── Client (company / SRL)
        └── JournalLine[]     -- ONE unified journal per client, grows over time
        └── ImportEvent[]     -- audit trail of each upload (when, what file, which entries)
        └── JournalPartner[]  -- extracted partner name mappings
```

A client has **one journal** that accumulates entries over time. There are no separate "datasets" — each upload appends new entries to the same journal. The `ImportEvent` tracks what was uploaded, when, and which entries came from it (for audit/rollback).

### Client Detail Page — Three Tabs

```
┌─────────────────────────────────────────────────────────┐
│  Client: 4Walls Studio SRL          [Upload Jurnal]     │
├─────────────┬──────────────────────┬────────────────────┤
│ Registru    │ Balanta de           │ Cont Profit si     │
│ Jurnal      │ Verificare           │ Pierdere           │
├─────────────┴──────────────────────┴────────────────────┤
│                                                         │
│  Tab 1: Virtualized Excel-like grid of journal entries  │
│         Column filters, fast scroll, 10K+ rows          │
│                                                         │
│  Tab 2: Computed trial balance with period selector      │
│         KPI cards, leaf/all toggle, search               │
│                                                         │
│  Tab 3: P&L statement computed from journal data         │
│         Exploatare/financiar, rezultat net               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Journal Entry Format (Saga Standard)

The journal is stored in Saga C format as the internal standard. Other accounting software formats (e.g. Ciel, WinMentor, FreERP) are translated to Saga format on import via format-specific adapters.

```
JournalLine {
  clientId        -- direct FK to client (no dataset indirection)
  importEventId   -- which upload brought this entry
  data            -- transaction date
  year, month     -- derived, indexed for fast period queries
  ndp             -- document number
  contD, contC    -- debit/credit accounts (analytic)
  contDBase, contCBase  -- base accounts (synthetic, e.g. "401" from "401.00023")
  suma            -- amount (Decimal 18,2)
  explicatie      -- description
  felD            -- document type
  deletedAt       -- soft-delete timestamp (null = active)
}
```

### Upload Flow (Append New Entries)

```
1. Accountant uploads XLSX (full journal export from Saga C)
2. System parses all entries from the file
3. System compares with existing journal entries for this client:
   - Computes dedup hash per entry (date + contD + contC + suma + explicatie)
   - Identifies NEW entries (not in existing journal)
   - Shows: "X intrari noi intre [data_start] si [data_end]"
4. Accountant confirms → new entries are appended
5. ImportEvent created with: fileName, fileHash, dateRange, entriesAdded count
6. Balanta + CPP recomputed for affected periods
7. Audit trail recorded
```

### Historical Correction Flow (Delete + Re-upload)

When the accountant needs to correct historical entries (e.g. wrong amounts, missing entries from a past month):

```
1. Accountant clicks "Corecteaza date istorice"
2. Selects a start date: "Sterge intrarile de la [data]"
3. System shows: "Se vor sterge N intrari de la [data] pana in prezent"
4. Modal confirmation: accountant must type "DELETE" (no copy-paste allowed)
5. Entries are SOFT-DELETED (deletedAt = now), not removed from DB
6. Audit event recorded with full snapshot of deleted entries
7. Accountant uploads corrected journal → append flow runs for the gap
8. Balanta + CPP recomputed
```

### Balanta & CPP Computation

Balanta de verificare and Cont Profit si Pierdere are always computed on-the-fly from the active (non-deleted) journal entries. They are NOT pre-stored snapshots.

```
getBalanceForPeriod(clientId, year, month):
  1. Query JournalLines WHERE clientId AND deletedAt IS NULL
  2. Filter by year/month range (cumulative up to selected month)
  3. computeBalanceFromJournal() — pure function, same as today
  4. Return computed rows

getCppForPeriod(clientId, year, month):
  1. Get balance rows from above
  2. computeCpp() — pure function, same as today
  3. Return P&L data
```

For performance, we may cache computed balances in the future (invalidated on journal changes), but the source of truth is always the live journal.

---

## Core Processing Pipeline

Every piece of financial data flows through a strict, audited pipeline. No shortcuts. No stage skipping.

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                            │
│  FGO.ro │ Direct Bank APIs │ CSV/XLSX Upload │ Saga │ ERP  │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ INGEST  │  ← Audit: raw payload hash, source, timestamp
                    └────┬────┘
                         │
                    ┌────▼─────────┐
                    │ NORMALIZE &  │  ← Audit: before/after normalization diff
                    │ DEDUPLICATE  │
                    └────┬─────────┘
                         │
                    ┌────▼─────────┐
                    │ CLASSIFY     │  ← Audit: rule matched, confidence, axes assigned
                    └────┬─────────┘
                         │
                    ┌────▼─────────┐
                    │ JOURNAL      │  ← Audit: journal entry created, amounts, allocations
                    │ (Transaction │
                    │  Ledger)     │
                    └────┬─────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼──────────┐
         │BALANCES│ │ACCOUNT │ │TRANSACTION  │  ← Audit: balance recalc,
         │(Total) │ │BALANCES│ │LOG (user-   │     snapshot stored
         └────┬───┘ └───┬────┘ │facing view) │
              │         │      └──┬──────────┘
              └─────────┼─────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼─────┐  ┌─────▼────┐  ┌─────▼──────┐
    │ BUDGET & │  │ REPORTS  │  │ SAGA /     │  ← Audit: report generated,
    │ FORECAST │  │ & DASH-  │  │ EXPORT     │     export sent, budget change
    │ ENGINE   │  │ BOARDS   │  │ INTEGR.    │
    └──────────┘  └──────────┘  └────────────┘
```

### Pipeline Stages in Detail

#### Stage 1: Ingest
- Pull transactions + balances from configured sources
- Sources are defined per client-organization: each bank account maps to exactly ONE source (FGO or direct bank, never both)
- Store raw payload as-is before any transformation
- **Audit point**: raw payload hash, source identifier, fetch timestamp, byte count

#### Stage 2: Normalize & Deduplicate
- Map raw data to unified transaction schema
- Compute deduplication hash (date + amount + counterparty IBAN + description)
- Reject duplicates, flag near-duplicates for review
- **Audit point**: normalization diff (raw → normalized), duplicate detection result

#### Stage 3: Classify
- Run classification engine: rules evaluated by priority
- Assign all axes: category, vertical, cost center, owner, recurrence
- Compute confidence score
- Handle splits (one transaction → multiple allocations)
- **Audit point**: which rule matched (or none), confidence score, all axes assigned, split details

#### Stage 4: Journal
- Write classified transaction into the immutable transaction journal
- Each journal entry is append-only — corrections are new entries, not mutations
- Allocations recorded with amounts and percentages
- **Audit point**: journal entry ID, amounts, allocation breakdown

#### Stage 5: Balances
- Recompute total balance across all accounts for the client-organization
- Recompute per-account balances
- Store balance snapshots (point-in-time records)
- Build user-facing transaction log (filterable, searchable, drillable)
- **Audit point**: previous balance, new balance, delta, snapshot timestamp

#### Stage 6: Outer Systems
- Budget & Forecast engine consumes journal data for BvA reports
- Reporting & Dashboards aggregate from journal + balances
- Saga/Export integration pushes classified invoices to accountant
- **Audit point**: every report generation, every export, every budget modification

---

## Audit System

The auditor is not a separate module — it is woven into every stage of the pipeline.

### Principles

1. **Every state change is audited.** No exception. If data changes, there is an audit record.
2. **Audit records are append-only.** They cannot be modified or deleted. Ever.
3. **Audit includes before and after.** Store the full diff, not just "something changed."
4. **Audit is queryable.** Any auditor can trace any transaction from raw ingestion to final report.
5. **Audit has its own storage.** Separate table/schema, separate retention policy (minimum 7 years for financial data).

### Audit Record Schema

```
audit_event {
  id              UUID
  tenant_id       UUID        -- client-organization
  actor_id        UUID        -- user or system job that caused the change
  actor_type      ENUM        -- 'user' | 'system' | 'scheduler' | 'rule_engine'
  pipeline_stage  ENUM        -- 'ingest' | 'normalize' | 'classify' | 'journal' | 'balance' | 'export' | 'budget' | 'admin'
  action          STRING      -- 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'recalculate' | 'export'
  entity_type     STRING      -- 'transaction' | 'balance' | 'budget_line' | 'rule' | 'user' | ...
  entity_id       UUID
  before          JSONB       -- state before (null for creates)
  after           JSONB       -- state after (null for deletes)
  metadata        JSONB       -- extra context: IP, rule_id, confidence, source_id, etc.
  checksum        STRING      -- SHA-256 of (before + after + metadata) for tamper detection
  created_at      TIMESTAMP
}
```

### Tamper Detection

Each audit record includes a `checksum` computed from its content. Periodic background jobs verify checksums haven't been altered. Any mismatch triggers an alert.

---

## Multi-Tenant Architecture

### Tenant Model

```
Platform User (accountant / finance manager)
  └── has many: Client Organizations (tenants)
        └── has many: Bank Accounts, Transactions, Budgets, Reports, Users (client staff)
```

### Isolation Strategy

- **Database-level**: Row-level security (RLS) with `tenant_id` on every table. No query ever returns data across tenants unless explicitly aggregating for the platform user's dashboard.
- **Application-level**: Tenant context injected at middleware layer. Every service method receives `tenantId` — never optional, never inferred.
- **Cache-level**: Redis keys prefixed with `tenant:{id}:` for complete namespace isolation.
- **Queue-level**: Jobs tagged with `tenantId`. Workers process jobs for any tenant but always operate within that tenant's context.

### Scale Targets

| Metric | Target |
|--------|--------|
| Concurrent platform users | 10,000+ |
| Client organizations per user | 1,000+ |
| Transactions per client/month | 10,000+ |
| Total transactions in system | 100M+ |
| API response time (p95) | < 200ms |
| Ingestion throughput | 50,000 txns/minute |
| Balance recalc latency | < 5 seconds after new transaction |

---

## Coding Standards

### General Rules

- **Max 100 lines per function.** If a function exceeds 100 lines, split it. No exceptions.
- **No redundant comments.** Code should be self-descriptive. Only comment the "why", never the "what."
- **Single responsibility.** Each function does one thing. Each module owns one domain.
- **Pure functions preferred.** Minimize side effects. Pass dependencies explicitly.
- **No magic numbers.** Use named constants.
- **No any types.** Full TypeScript strict mode. Every value has a type.

### Modularity

```
src/
  modules/
    ingestion/          -- Stage 1: data source connectors, raw fetch
      sources/
        fgo.ts
        bank-direct.ts
        csv-import.ts
        saga.ts
      ingestion.service.ts
      ingestion.types.ts
      ingestion.test.ts

    normalizer/         -- Stage 2: normalize, deduplicate, enrich
      normalizer.service.ts
      deduplicator.ts
      enricher.ts
      normalizer.types.ts
      normalizer.test.ts

    classifier/         -- Stage 3: rule engine, confidence scoring, splits
      classifier.service.ts
      rule-engine.ts
      split-handler.ts
      classifier.types.ts
      classifier.test.ts

    journal/            -- Stage 4: immutable transaction ledger
      journal.service.ts
      journal.types.ts
      journal.test.ts

    balances/           -- Stage 5: balance computation, snapshots
      balances.service.ts
      snapshot.service.ts
      balances.types.ts
      balances.test.ts

    budget/             -- Budget & forecast engine
      budget.service.ts
      forecast.service.ts
      scenarios.ts
      budget.types.ts
      budget.test.ts

    reporting/          -- Dashboards, reports, aggregations
      reporting.service.ts
      aggregator.ts
      reporting.types.ts
      reporting.test.ts

    integrations/       -- Saga, export, BI connectors
      saga.service.ts
      export.service.ts
      integrations.types.ts
      integrations.test.ts

    audit/              -- Cross-cutting audit system
      audit.service.ts
      audit.middleware.ts
      tamper-check.ts
      audit.types.ts
      audit.test.ts

    tenant/             -- Multi-tenant context, isolation
      tenant.service.ts
      tenant.middleware.ts
      tenant.types.ts
      tenant.test.ts

    auth/               -- Authentication, authorization, RBAC
      auth.service.ts
      rbac.ts
      auth.types.ts
      auth.test.ts

  shared/
    database/           -- DB client, migrations, RLS setup
    cache/              -- Redis client, tenant-scoped cache
    queue/              -- BullMQ setup, job definitions
    errors/             -- Error types, error handling
    utils/              -- Date, currency, hashing utilities
    types/              -- Shared type definitions
```

### Module Rules

1. **Each module has a clear public API** (the `.service.ts` file). Other modules only import from the service, never from internal files.
2. **Each module owns its types** (`.types.ts`). Shared types go in `shared/types/`.
3. **Each module has tests** (`.test.ts`). Tests live next to the code they test.
4. **No circular dependencies.** The dependency graph flows downward through the pipeline. `audit` is the only module that every other module depends on.
5. **Modules communicate through events** for async operations and direct calls for sync operations.

### Function Rules

```typescript
// BAD: 150-line function doing everything
async function processTransaction(raw: RawTransaction) {
  // ... 150 lines of normalize, dedupe, classify, journal, balance ...
}

// GOOD: orchestrator delegates to focused functions
async function processTransaction(raw: RawTransaction): Promise<JournalEntry> {
  const normalized = await normalize(raw)
  const isDuplicate = await checkDuplicate(normalized)
  if (isDuplicate) return handleDuplicate(normalized)

  const classified = await classify(normalized)
  const entry = await writeToJournal(classified)
  await recalculateBalances(entry.accountId)
  return entry
}
```

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `rule-engine.ts` |
| Types/Interfaces | PascalCase | `TransactionAllocation` |
| Functions | camelCase | `classifyTransaction` |
| Constants | UPPER_SNAKE | `MAX_RULES_PER_EVALUATION` |
| Database tables | snake_case | `transaction_allocation` |
| Database columns | snake_case | `created_at` |
| API endpoints | kebab-case | `/api/bank-accounts` |
| Environment vars | UPPER_SNAKE | `DATABASE_URL` |
| Event names | dot.separated | `transaction.classified` |

### Error Handling

- Use typed errors, not generic `Error`.
- Every error includes: `code`, `message`, `context` (the data that caused the error).
- Pipeline errors do NOT silently swallow. A failed classification still produces an audit record with the error.
- Use Result types (`{ ok: true, data } | { ok: false, error }`) for operations that can fail in expected ways.

### Testing

- Unit tests for pure logic (rule evaluation, normalization, balance math).
- Integration tests for pipeline stages (ingest → classify → journal).
- E2E tests for critical flows (full transaction lifecycle, budget approval).
- Test data factories for generating realistic tenant data.
- Every PR must maintain or increase coverage.

### Performance

- Database queries must use tenant_id in WHERE clause (enforced by RLS + middleware).
- Pagination required for all list endpoints. No unbounded queries.
- Heavy computations (balance recalc, report generation) run as async jobs, not in request handlers.
- Use database indexes on: `tenant_id`, `date`, `bank_account_id`, `classification_status`, `category_id`.
- Connection pooling (pgBouncer or built-in) sized for concurrent tenant load.

---

## Source Definition System

Users configure data sources per client-organization:

```
Source {
  id              UUID
  tenant_id       UUID
  name            STRING          -- "BT Business Account", "ING via FGO"
  type            ENUM            -- 'fgo' | 'bank_direct' | 'csv_import' | 'saga' | 'erp'
  bank_account_id UUID
  config          JSONB           -- connection params (encrypted at rest)
  sync_frequency  ENUM            -- 'hourly' | 'daily' | 'manual'
  active          BOOLEAN
  last_sync_at    TIMESTAMP
  last_sync_status STRING         -- 'success' | 'partial' | 'failed'
  created_at      TIMESTAMP
}
```

**Constraint**: One bank account can have exactly one active source. The system enforces this to prevent duplicate transactions.

---

## Test Suite Architecture

Testing is not optional. Every module, every flow, every screen has tests. The test suite is organized in layers that mirror the pipeline.

### Test Structure

```
tests/
  unit/                              -- Pure logic, no I/O, fast (<1s each)
    money.test.ts                    -- normalizeMoney, round2 (Romanian format, thousands, negatives)
    accounts.test.ts                 -- getContBase, getAccountType, isPnlAccount, computeLeafFlags
    balance.test.ts                  -- computeBalanceFromJournal (debit/credit, P&L closing, leaf, verification)

    shared/
      errors.test.ts                 -- Result pattern (ok/err), error factories (notFound, validation, etc.)
      types.test.ts                  -- paginate helper, PaginatedResult

    modules/
      audit/
        checksum.test.ts             -- SHA-256 computation, determinism, tamper detection, verification
      auth/
        rbac.test.ts                 -- Permission evaluation per role, authorize throws, role union
      reporting/
        kpi.test.ts                  -- KPI computation: cash, creante, datorii, TVA, rezultat, marja
        cpp.test.ts                  -- CPP computation: exploatare/financiar, impozit, loss, empty
      ingestion/
        parser.test.ts               -- XLSX parsing, header resolution, compound entries, post-closing
        partner-extractor.test.ts    -- Partner name extraction, suffix matching, frequency picking
      balances/
        compute-balance.test.ts      -- Balance math, opening balances, year closing, multi-period

  integration/                       -- Database + Redis, real I/O
    pipeline/
      ingest-to-balance.test.ts      -- Full: XLSX → parse → store → compute balance → verify
      duplicate-rejection.test.ts    -- Same file imported twice → second gets deduplicated
    tenant/
      isolation.test.ts              -- Tenant A cannot see Tenant B data
      access-control.test.ts         -- verifyTenantAccess, getTenantBySlug boundary checks
    audit/
      audit-trail.test.ts            -- Verify audit records created at each pipeline stage
      tamper-detection.test.ts       -- Modify audit record → checksum mismatch detected

  e2e/                               -- Full API tests, HTTP requests against running server
    flows/
      import-lifecycle.test.ts       -- Upload XLSX → dataset created → balance viewable
      user-onboarding.test.ts        -- Register → create client → import → view reports
    security/
      auth.test.ts                   -- Login, session expiry, logout clears cookie
      rbac-enforcement.test.ts       -- Each role can only access permitted endpoints
      tenant-boundary.test.ts        -- API requests scoped to tenant, cross-tenant blocked
      input-validation.test.ts       -- Oversized payloads, missing fields, malformed data

  ui/                                -- Playwright browser tests
    setup/
      global-setup.ts               -- Start test server, seed database, create test users
      global-teardown.ts            -- Cleanup test data, stop server
      fixtures.ts                   -- Page objects, test tenant factory, auth helpers
    auth/
      login.spec.ts                 -- Login flow, invalid credentials, redirect
      logout.spec.ts                -- Logout clears session, redirect to login
    clients/
      list.spec.ts                  -- Client grid renders, create dialog works
      detail.spec.ts                -- Client detail, dataset list, import link
    datasets/
      import.spec.ts                -- Upload XLSX, progress, success redirect
      balance-view.spec.ts          -- Balance table renders, period selector, tab switch
      cpp-view.spec.ts              -- CPP table renders, totals correct
      kpi-cards.spec.ts             -- KPI cards render with correct values
    costi/
      chat.spec.ts                  -- Chat opens, sends message, receives response
    settings/
      profile.spec.ts               -- User info displays correctly
    responsive/
      mobile.spec.ts                -- Key screens render correctly on mobile viewport

  fixtures/                          -- Shared test data factories
    entries.ts                       -- Factory for JournalEntry with sensible defaults
    balance-rows.ts                  -- Factory for BalanceRowView with overrides
    tenants.ts                       -- Factory for generating test tenants
    users.ts                         -- Users with different roles and permissions
```

### Test Principles

1. **Unit tests are fast.** No database, no network, no file system. Mock external boundaries. Run in <10 seconds total.
2. **Integration tests use real database.** Spin up PostgreSQL in Docker (testcontainers). Real Redis. Real queries. Real RLS policies.
3. **E2E tests hit the real API.** Running server, real HTTP requests, real auth tokens. Test the contract, not the implementation.
4. **Playwright tests run against the full stack.** Seeded database, real browser, real user interactions. These are the final safety net.
5. **Every pipeline stage has its own integration test.** If stage 3 (classify) breaks, we know immediately — we don't have to debug a failing stage 5 test.
6. **Security tests are not optional.** They run on every PR. RBAC, tenant isolation, input validation — all tested explicitly.
7. **Test data factories over fixtures.** Generate realistic data programmatically. Factories accept overrides for specific test scenarios.

### Test Commands

```bash
# Unit tests (fast, no I/O)
pnpm test:unit

# Integration tests (needs Docker for PG + Redis)
pnpm test:integration

# E2E API tests (starts server automatically)
pnpm test:e2e

# Playwright UI tests (starts full stack)
pnpm test:ui

# All tests
pnpm test

# CI pipeline (lint → typecheck → unit → integration → e2e → ui)
pnpm ci:test
```

### Coverage Requirements

| Layer | Minimum Coverage |
|-------|-----------------|
| Unit (modules/) | 90% |
| Integration (pipeline/) | 80% |
| E2E (flows/) | Critical paths 100% |
| UI (Playwright) | All user-facing flows |

### Playwright Configuration

```typescript
// playwright.config.ts
{
  testDir: './tests/ui',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
}
```

---

## Security Architecture

Security is not a feature — it is a constraint that applies to every layer, every endpoint, every byte of data.

### Threat Model

| Threat | Vector | Impact | Mitigation |
|--------|--------|--------|------------|
| Tenant data leak | Broken RLS, missing tenant_id filter | Critical — financial data exposure | RLS enforced at DB level + middleware + integration tests |
| Account takeover | Stolen credentials, session hijack | Critical — full tenant access | MFA, short-lived JWTs, refresh token rotation, IP anomaly detection |
| Privilege escalation | RBAC bypass, role manipulation | High — unauthorized actions | Permissions checked at service layer, not just UI. Tested per endpoint |
| SQL injection | Unparameterized queries | Critical — data breach | Parameterized queries only (ORM enforced), no raw SQL interpolation |
| XSS | Unsanitized user input rendered | High — session theft | CSP headers, output encoding, React auto-escaping, DOMPurify for rich text |
| CSRF | State-changing requests without token | Medium — unauthorized actions | SameSite cookies, CSRF tokens on all mutation endpoints |
| Data tampering | Modified audit records | High — compliance failure | Audit checksums, append-only storage, tamper detection jobs |
| DDoS | API flood | Medium — service degradation | Rate limiting per tenant, per IP. WAF. Queue-based processing |
| Supply chain | Compromised dependency | High — code execution | Lockfile pinning, automated dependency audits, minimal dependencies |
| Insider threat | Malicious platform operator | Critical — mass data breach | Encryption at rest, key rotation, principle of least privilege, audit everything |

### Authentication

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Client   │────▶│  Auth Server  │────▶│  MFA Check  │
│ (Browser) │     │ (Keycloak /   │     │ (TOTP/WebAuthn)│
└──────────┘     │  Auth.js)     │     └──────┬──────┘
                 └──────┬───────┘            │
                        │                     │
                 ┌──────▼───────┐     ┌──────▼──────┐
                 │ Access Token │     │ Refresh Token│
                 │ (JWT, 15min) │     │ (httpOnly    │
                 │ signed RS256 │     │  cookie, 7d) │
                 └──────┬───────┘     └──────┬──────┘
                        │                     │
                 ┌──────▼─────────────────────▼──────┐
                 │         API Gateway                │
                 │  1. Verify JWT signature (RS256)   │
                 │  2. Check token expiry             │
                 │  3. Extract: user_id, tenant_id,   │
                 │     roles[], permissions[]          │
                 │  4. Inject into request context     │
                 └────────────────────────────────────┘
```

- **Access tokens**: JWT, RS256 signed, 15-minute expiry. Contains user_id, tenant_id, roles.
- **Refresh tokens**: httpOnly secure cookie, 7-day expiry, single-use (rotation on every refresh).
- **MFA required**: For all accounts. TOTP (authenticator app) or WebAuthn (hardware key / biometric).
- **Session management**: Active sessions listed in user settings. Remote session revocation supported.
- **Brute force protection**: Account lockout after 5 failed attempts. Exponential backoff. Unlock via email.

### Authorization (RBAC + ABAC)

Two layers of access control:

**Role-Based (RBAC)** — what type of actions can this user perform?

| Role | Description |
|------|-------------|
| platform_admin | Costify system administrator. Manages platform-level settings |
| account_owner | The accountant/finance manager who owns the Costify account. Manages their client organizations |
| org_admin | Admin of a specific client organization. Full access within that tenant |
| org_manager | Vertical/department manager. Sees and manages their scope |
| org_member | Category owner or contributor. Sees assigned categories, classifies, comments |
| org_viewer | Read-only access. Auditors, external consultants |

**Attribute-Based (ABAC)** — what specific resources can this user access?

```typescript
// Permission checks are explicit, never implicit
interface Permission {
  resource: 'transaction' | 'budget' | 'rule' | 'report' | 'user' | 'source' | 'settings'
  action: 'read' | 'create' | 'update' | 'delete' | 'approve' | 'export'
  scope: {
    tenantId: string
    verticalIds?: string[]      // null = all verticals
    categoryIds?: string[]      // null = all categories
    accountIds?: string[]       // null = all accounts
  }
}

// Every service method starts with permission check
async function classifyTransaction(ctx: RequestContext, txnId: string, classification: Classification) {
  await authorize(ctx, {
    resource: 'transaction',
    action: 'update',
    scope: { tenantId: ctx.tenantId }
  })
  // ... proceed
}
```

### Data Security

#### Encryption

| Layer | Method |
|-------|--------|
| In transit | TLS 1.3 minimum. HSTS enforced. Certificate pinning for mobile |
| At rest (database) | PostgreSQL TDE or volume-level encryption (AES-256) |
| At rest (files) | S3 server-side encryption (SSE-S3 or SSE-KMS) |
| Application-level | Sensitive fields (IBAN, fiscal code, API keys) encrypted with AES-256-GCM before storage |
| Backups | Encrypted with separate key. Stored in different region |
| Secrets | Environment variables via secrets manager (Vault, AWS Secrets Manager, or Doppler). Never in code, never in git |

#### Key Management

- Encryption keys rotated every 90 days
- Old keys retained for decryption of historical data
- Key access logged and audited
- Separate keys per environment (dev, staging, production)

### API Security

```typescript
// Every endpoint has these middleware layers in order:
[
  rateLimiter({ window: '1m', max: 100, keyBy: 'tenantId' }),
  cors({ origin: allowedOrigins, credentials: true }),
  csrfProtection(),
  authenticate(),                  // verify JWT, extract user context
  tenantContext(),                  // set tenant_id, enforce RLS
  authorize({ resource, action }), // check RBAC + ABAC
  validateInput(schema),           // Zod schema validation, reject malformed
  handler(),                       // actual business logic
  auditLog(),                      // record the action
]
```

#### Input Validation

- All inputs validated with Zod schemas. No unvalidated data reaches the service layer.
- File uploads: type validation (magic bytes, not just extension), size limits, virus scan.
- Query parameters: strict type coercion, pagination limits enforced (max 100 per page).
- Request body size limit: 1MB default, 50MB for file uploads.
- No `eval()`, no `new Function()`, no dynamic require/import with user input.

#### Output Security

- All API responses strip internal IDs, stack traces, and debug info in production.
- Error responses use generic messages. Detailed errors logged server-side only.
- Pagination metadata included (total count, page, has_next) to prevent enumeration.
- Rate limit headers included (X-RateLimit-Remaining, X-RateLimit-Reset).

### HTTP Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.costify.io
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (rely on CSP instead)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Database Security

- **Row-Level Security (RLS)**: Enabled on every table with tenant data. Policies enforce `tenant_id = current_setting('app.tenant_id')`. Even if application code has a bug, the database won't return wrong-tenant data.
- **Prepared statements only**: No string concatenation in queries. ORM (Drizzle/Prisma) enforced.
- **Least privilege DB users**: App connects with a user that has SELECT/INSERT/UPDATE on data tables, no DROP/ALTER/TRUNCATE. Migrations run with a separate privileged user.
- **Connection encryption**: `sslmode=require` for all database connections.
- **Audit schema is append-only**: The application DB user has INSERT-only on audit tables. No UPDATE, no DELETE.

### Infrastructure Security

- Containers run as non-root user
- Read-only filesystem where possible
- Network segmentation: database and Redis not exposed to internet
- Secrets injected at runtime, never baked into images
- Container images scanned for vulnerabilities on every build
- Automated dependency updates (Renovate/Dependabot) with security advisory alerts
- Production access requires VPN + MFA + approval

### Compliance & Data Retention

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Transactions | 10 years | Romanian fiscal law |
| Audit logs | 10 years | Compliance, traceability |
| Bank statements (raw) | 10 years | Source document preservation |
| User sessions | 30 days | Security monitoring |
| Deleted tenant data | 90 days soft-delete, then purge | GDPR right to erasure |
| Backups | 90 days | Disaster recovery |

### Security Testing (in CI)

| Test Type | Tool | Frequency |
|-----------|------|-----------|
| Dependency audit | `pnpm audit` | Every PR |
| SAST (static analysis) | Semgrep / ESLint security rules | Every PR |
| Secret scanning | Gitleaks | Every PR |
| Container scanning | Trivy | Every build |
| DAST (dynamic) | OWASP ZAP | Weekly + before release |
| Penetration testing | Manual (external firm) | Annually |
| RLS verification | Custom integration tests | Every PR |
| RBAC verification | E2E security tests | Every PR |

---

## Git & Development Workflow

- Branch naming: `feat/`, `fix/`, `refactor/`, `chore/`
- Commit messages: imperative mood, concise ("add transaction classifier", not "added" or "adding")
- PRs require passing CI (lint → typecheck → unit → integration → e2e → ui → security scan) before merge
- No force pushes to `main`
- Database migrations are versioned and reversible
- All secrets managed via environment variables / secrets manager, never committed

### CI Pipeline

```
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌─────────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐
│  Lint   │──▶│ Typecheck  │──▶│   Unit    │──▶│ Integration │──▶│   E2E    │──▶│Playwright│──▶│Security Scan │
│         │   │            │   │  Tests    │   │   Tests     │   │  Tests   │   │ UI Tests │   │              │
└─────────┘   └───────────┘   └───────────┘   └─────────────┘   └──────────┘   └──────────┘   └──────────────┘
   ESLint       tsc --noEmit    Vitest          Testcontainers    Supertest     Playwright      Semgrep +
   Prettier                     (no I/O)        (PG + Redis)      (HTTP)        (3 browsers)    Trivy +
                                                                                                Gitleaks
```

---

## Design System & Visual Identity

### Reference Implementation

The definitive design reference is `docs/costify-pitch.html`. All UI work must align with this visual language.

### Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#6C5CE7` | Primary actions, links, active states, brand accent |
| `--primary-dark` | `#5A4BD1` | Hover states on primary elements |
| `--primary-light` | `#A29BFE` | Badges, highlighted text, secondary accent |
| `--accent` | `#00B894` | Success states, positive indicators, growth metrics |
| `--accent-light` | `#55EFC4` | Success badges, positive deltas |
| `--danger` | `#E63946` | Errors, destructive actions, negative deltas, alerts |
| `--warn` | `#FDCB6E` | Warnings, partial states, attention needed |
| `--dark` | `#0D1117` | Page background |
| `--dark-2` | `#161B22` | Card backgrounds, elevated surfaces |
| `--dark-3` | `#21262D` | Borders, dividers, subtle backgrounds |
| `--gray` | `#8B949E` | Secondary text, labels, placeholders |
| `--gray-light` | `#C9D1D9` | Body text |
| `--white` | `#F0F6FC` | Headings, primary text, high contrast |
| `--blue` | `#58A6FF` | Informational, links, data visualization |
| `--orange` | `#F0883E` | Warnings, secondary data visualization |
| `--green` | `#3FB950` | Success, positive, checkmarks |
| `--purple` | `#BC8CFF` | Tertiary accent, data visualization |

### Typography

- **Font**: Inter (weights: 300-900)
- **Headings**: 800-900 weight, `--white` color, tight letter-spacing (-0.02em to -0.03em)
- **Body**: 400-500 weight, `--gray-light` color, 1.6-1.7 line-height
- **Labels**: 600 weight, uppercase, 0.1-0.15em letter-spacing, `--primary` or `--gray`
- **Code/data**: Monospace inherited, tabular numbers for financial data

### Component Patterns

- **Cards**: `--dark-2` background, `--dark-3` border, 16px radius, 2rem padding. Hover: subtle border glow + translateY(-2px). Top gradient line appears on hover.
- **Tags/badges**: 0.7rem font, small padding, rounded, semi-transparent background with matching border color.
- **Tables**: Separate border-spacing, 16px border-radius container, `--dark-2` header, row hover with subtle primary tint.
- **Sections**: 6rem vertical padding, 1200px max-width. Section label (uppercase, primary color) + title (large, white) + desc (gray, 650px max-width).
- **Metrics/KPI cards**: Centered text, large bold number in white, unit/suffix in primary color, small gray label below.
- **Timeline**: Left vertical gradient line, circular dots with color-coded borders, indented content.
- **Pipeline/flow**: Horizontal flex with colored boxes (source=blue, process=purple, data=green, output=orange) connected by arrows.

### Light Theme First

Costify is light-theme-first. The warm cream palette (`#F0EFEA` base) is the primary experience — paper-like, calm, professional. Accountants spend hours inside the app, so the default experience is quiet and low-contrast, inspired by Danubian. Dark theme is a secondary mode for users who prefer it. All designs must look excellent in light mode before considering dark, and every new component must ship with both themes working — never ship a light-first feature that breaks in dark mode.

### Responsive Breakpoints

- Desktop: 1200px max-width content
- Tablet: Cards collapse to single column below 768px, nav links hide
- Mobile: Full-width cards, stacked layouts, reduced padding

### HTML Templates

Reusable starting points live in `templates/`:
- `templates/landing.html` — Marketing/landing page with hero, features, pricing, CTA
- `templates/dashboard.html` — App-like dashboard with sidebar, KPI cards, tables, charts
- `templates/docs.html` — Documentation/content page with sidebar nav and prose

These templates use the same CSS variables and component patterns as the pitch. Use them as starting points for any new page or prototype.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 22+ |
| Frontend | Next.js 15 + React 19 + TailwindCSS |
| Backend API | Fastify |
| Database | PostgreSQL 16 (with RLS) |
| Cache | Redis 7 |
| Job Queue | BullMQ |
| Auth | Keycloak or Auth.js + MFA |
| File Storage | S3-compatible |
| Testing | Vitest (unit/integration) + Supertest (e2e) + Playwright (ui) |
| Security | Semgrep + Trivy + Gitleaks + OWASP ZAP |
| Monitoring | Grafana + Prometheus |
| Deployment | Docker, Kubernetes-ready |
| CI/CD | GitHub Actions |

---

## Costi AI — Knowledge Architecture

Costi's knowledge is split into two domains, loaded independently:

### Costi Is a First-Class Citizen — Never Let Him Fall Behind

Costi is the contabil's primary interface to the data. Every time we add or change a feature, Costi must be updated in lock-step — same PR, same deploy. Treat Costi like any other top-level surface of the app: if it breaks or lies, the user loses trust in the whole platform.

**Every feature PR that touches data, workflows, or UI affordances must also:**

1. **Update the tool definitions** in `src/modules/costi/tools.ts` — add new tools for new capabilities, or extend existing ones if the surface changed.
2. **Update the tool handlers** in `src/modules/costi/tool-handlers.ts` — make sure the response shape reflects any new fields (e.g. when we added `unmapped` to `BalanceRowView`, `get_balance` had to return it too).
3. **Update `training/contabil/structured/costify-app.json`** — this is Costi's system-prompt reference for the platform. If a feature isn't described here, Costi doesn't know about it. Include: architecture notes, resolution algorithms, UI indicators, what tools are available to introspect it.
4. **Update tests in `tests/unit/modules/costi/tools.test.ts`** — the tool count, required params, and unique name assertions must match reality. Add new tool-definition tests whenever you add a tool.
5. **Never ship a user-facing feature Costi cannot explain or query.** If the contabil can click something in the UI, Costi must be able to answer questions about it.

**Examples of things that historically broke Costi and must never happen again:**
- Adding the three-tier chart-of-accounts system without giving Costi `get_unmapped_accounts` or `get_account_catalog` tools → Costi couldn't answer "ce conturi am nemapate?".
- Changing CPP grouping from hardcoded prefixes to catalog-driven without updating `costify-app.json` → Costi's description of CPP was stale for weeks.
- Adding the `unmapped` flag to `BalanceRowView` without threading it through `handleGetBalance` → Costi saw balance rows but couldn't tell which were flagged in the UI.

**When in doubt: grep for `costi`, `COSTI_TOOLS`, `handleToolCall`, and `costify-app.json` before finalizing any PR that touches the data pipeline or UI.**

### Domain 1: Costify Platform (always loaded)

`training/contabil/structured/costify-app.json` — the app's features, workflows, UI structure. Always in Costi's system prompt because he IS the platform's assistant. **Update this file whenever we add/change functionality.**

### Domain 2: Romanian Accounting (loaded on demand)

Romanian accounting training lives in `training/contabil/`. **Do NOT load these files automatically.** Only read them when the user explicitly asks an accounting question or says to consult the contabil (e.g. "ask the contabil", "check the accounting rules", "how does TVA work", etc.).

**Structured data (always loaded):** `tax-rates.json`, `payroll.json`, `corporate.json`, `penalties.json`, `tax-calendar.json` — quick reference values.

**Deep knowledge (keyword-triggered):** `saga-c.md` loads when user mentions Saga-related terms.

When asked, start by reading `training/contabil/SKILL.md`, then load the specific file relevant to the question:

**Level 1 — Professional Identity:**
- **Profession / who can do accounting / access to profession** -> `training/contabil/profesie-og65.md`
- **CECCAR organization / standards 21/22/35 / internship** -> `training/contabil/profesie-ceccar.md`
- **Professional ethics / independence / conflicts of interest** -> `training/contabil/etica-profesionala.md`

**Level 2 — Accounting Engine:**
- **Accounting law / registers / documents / sanctions** -> `training/contabil/legea-contabilitatii.md`
- **Accounting regulations / OMFP 1802 / principles / recognition / measurement** -> `training/contabil/omfp-1802.md`
- **IFRS / OMFP 2844 / deferred tax / IFRS 16 / IFRS 15** -> `training/contabil/ifrs-omfp2844.md`
- **Plan de conturi / chart of accounts** -> `training/contabil/plan-de-conturi.md`
- **Journal entries / note contabile** -> `training/contabil/note-contabile.md`
- **Debit/credit rules** -> `training/contabil/debit-credit.md`
- **Trial balance / bilant / financial statements** -> `training/contabil/balanta-bilant.md`
- **Depreciation / fixed assets** -> `training/contabil/amortizare-imobilizari.md`

**Level 3 — Tax Engine:**
- **Fiscal code / profit tax / micro / TVA / contributions / dividends** -> `training/contabil/codul-fiscal.md`
- **Tax procedure / inspections / contestations / enforcement / penalties** -> `training/contabil/procedura-fiscala.md`
- **Tax legislation summary (legacy)** -> `training/contabil/legislatie-fiscala.md`
- **All Romanian legal codes overview** -> `training/contabil/coduri-romania.md`

**Level 4 — Compliance & Risk:**
- **AML / KYC / beneficial owner / suspicious transactions / sanctions** -> `training/contabil/aml-kyc.md`
- **CAEN codes / activity classification / sector-specific rules** -> `training/contabil/coduri-caen.md`

**Level 5 — Corporate & Payroll:**
- **Company law / capital / AGA / dividends / mergers / dissolution** -> `training/contabil/legea-societatilor.md`
- **Payroll / labor code / Revisal / D112 / salary calculation** -> `training/contabil/salarizare-payroll.md`

**Level 6 — Digital Reporting:**
- **e-Factura / SAF-T / e-Transport / ANAF API** -> `training/contabil/e-factura-saft.md`
- **Transaction classification patterns** -> `training/contabil/clasificare-tranzactii.md`

**Level 7 — Software Contabil (Saga C):**
- **Saga C usage / configuration / operations / closing / declarations / e-Factura from Saga** -> `training/contabil/saga-c.md`

**Fiscal constants (ALWAYS read first for any rate/threshold question):**
- **Tax rates / thresholds / deadlines / penalties for current year** -> `training/contabil/constante-fiscale-2026.md`

**Master reference:**
- **Training matrix (all 17 acts, task types, example questions)** -> `training/contabil/training-matrix.md`

---

## Workspace Rules

- **Temp files stay in this project.** Never write to `/tmp`, `~`, or any directory outside this repo. Use `temp/` inside the project root for any temporary files, scaffolding, or scratch work. Clean up after.
- **Logs stay in this project.** Server logs, build logs, etc. go to `temp/` inside the project root (e.g. `temp/server.log`), never outside.
- **Server start script:** Use `./start.sh` to run the dev server on port 3041.
