# Costify — Engineering Standards & Architecture Guide

## Product Vision

Costify is a multi-tenant financial control platform. Each **user** (typically an accountant or finance manager) operates **thousands of clients**. Each client has their own bank accounts, transactions, budgets, and reports — fully isolated.

The system must scale horizontally to support thousands of concurrent users, each managing 1000+ client organizations.

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
  unit/                          -- Pure logic, no I/O, fast (<1s each)
    modules/
      normalizer/
        normalizer.test.ts       -- Field mapping, currency conversion, date parsing
        deduplicator.test.ts     -- Hash computation, duplicate detection logic
      classifier/
        rule-engine.test.ts      -- Rule matching, priority ordering, condition evaluation
        split-handler.test.ts    -- Amount splitting, percentage validation, rounding
        confidence.test.ts       -- Confidence score computation
      journal/
        journal.test.ts          -- Entry creation, immutability enforcement
      balances/
        balance-calc.test.ts     -- Balance math, running totals, multi-currency
        snapshot.test.ts         -- Point-in-time snapshot creation
      budget/
        budget.test.ts           -- Version lifecycle, line calculations
        forecast.test.ts         -- Run-rate, seasonality, moving average methods
        scenarios.test.ts        -- Scenario generation, comparison
      audit/
        checksum.test.ts         -- Tamper detection hash computation
        audit-record.test.ts     -- Record creation, required fields
      auth/
        rbac.test.ts             -- Permission evaluation, role hierarchy
        tenant-isolation.test.ts -- Tenant context enforcement
      shared/
        currency.test.ts
        date-utils.test.ts
        hashing.test.ts

  integration/                   -- Database + Redis + queues, real I/O
    pipeline/
      ingest-to-journal.test.ts  -- Full: raw data → normalize → classify → journal entry
      classify-and-split.test.ts -- Transaction with split across categories/verticals
      balance-recalc.test.ts     -- Journal write triggers balance recalculation
      duplicate-rejection.test.ts-- Same transaction ingested twice → second rejected
      reclassification.test.ts   -- Re-classify existing transaction, verify audit trail
    sources/
      fgo-connector.test.ts      -- FGO.ro API integration (mocked external, real DB)
      bank-connector.test.ts     -- Direct bank API integration
      csv-import.test.ts         -- CSV/XLSX file parsing and ingestion
      saga-export.test.ts        -- Push classified invoice to Saga
    budget/
      budget-lifecycle.test.ts   -- Draft → Review → Approved → Locked → Revised
      approval-workflow.test.ts  -- Multi-step approval with role checks
      bva-report.test.ts         -- Budget vs Actual vs Forecast computation
    tenant/
      isolation.test.ts          -- Tenant A cannot see Tenant B data (RLS verified)
      cross-tenant-admin.test.ts -- Platform user sees aggregated view across tenants
    audit/
      audit-trail.test.ts        -- Verify audit records created at each pipeline stage
      tamper-detection.test.ts   -- Modify audit record → detection job catches it
      audit-query.test.ts        -- Trace a transaction from ingestion to report

  e2e/                           -- Full API tests, HTTP requests against running server
    flows/
      transaction-lifecycle.test.ts  -- Ingest → Classify → Journal → Balance → Report
      budget-cycle.test.ts           -- Create budget → Owner fills → Manager reviews → CFO approves
      monthly-close.test.ts          -- Close period → Lock → Verify immutability
      source-management.test.ts      -- Add source → Sync → Verify transactions appear
      user-onboarding.test.ts        -- Create tenant → Add bank accounts → First sync
      invoice-to-saga.test.ts        -- Classify invoice → Push to Saga → Verify status sync
    security/
      auth.test.ts                   -- Login, JWT refresh, session expiry
      rbac-enforcement.test.ts       -- Each role can only access permitted endpoints
      tenant-boundary.test.ts        -- API requests scoped to tenant, cross-tenant blocked
      rate-limiting.test.ts          -- Verify rate limits enforced per tenant
      input-validation.test.ts       -- SQL injection, XSS, oversized payloads, malformed JSON
      csrf.test.ts                   -- CSRF token validation on state-changing requests

  ui/                            -- Playwright browser tests
    setup/
      global-setup.ts            -- Start test server, seed database, create test users
      global-teardown.ts         -- Cleanup test data, stop server
      fixtures.ts                -- Page objects, test tenant factory, auth helpers
    auth/
      login.spec.ts              -- Login flow, invalid credentials, locked account
      logout.spec.ts             -- Logout clears session, redirect to login
      session-expiry.spec.ts     -- Expired token → redirect to login with return URL
    dashboard/
      executive.spec.ts          -- KPI cards render, charts load, period filter works
      vertical.spec.ts           -- Switch between verticals, data changes correctly
      owner.spec.ts              -- Owner sees only their categories
    transactions/
      list.spec.ts               -- Table renders, pagination, column sorting
      filter.spec.ts             -- Filter by date, category, status, account, amount range
      search.spec.ts             -- Full-text search in descriptions
      classify.spec.ts           -- Manual classification modal, category picker, save
      split.spec.ts              -- Split transaction UI, percentage slider, amount validation
      bulk-actions.spec.ts       -- Select multiple, bulk classify, bulk approve
    budget/
      editor.spec.ts             -- Budget grid, inline editing, save
      import.spec.ts             -- Upload Excel, mapping preview, confirm import
      approval.spec.ts           -- Submit for review, manager approves, status changes
      version-history.spec.ts    -- View past versions, compare versions side by side
    reports/
      bva.spec.ts                -- Budget vs Actual loads, drill-down to transactions
      cashflow.spec.ts           -- Cash flow chart renders, date range filter
      export.spec.ts             -- Export to Excel/PDF, verify downloaded file
    settings/
      sources.spec.ts            -- Add bank source, configure sync, test connection
      rules.spec.ts              -- Create classification rule, test against sample data
      users.spec.ts              -- Invite user, assign role, deactivate user
      taxonomy.spec.ts           -- Add/edit/reorder categories, drag-and-drop
    tenant/
      switch-client.spec.ts      -- Switch between client organizations, data changes
      create-client.spec.ts      -- Create new client org, initial setup wizard
    accessibility/
      keyboard-nav.spec.ts       -- Tab order, focus management, keyboard shortcuts
      screen-reader.spec.ts      -- ARIA labels, role attributes, announcements
    responsive/
      mobile.spec.ts             -- Key screens render correctly on mobile viewport
      tablet.spec.ts             -- Tablet breakpoints, sidebar behavior

  fixtures/                      -- Shared test data
    tenants.ts                   -- Factory for generating test tenants
    transactions.ts              -- Factory for realistic transaction data
    bank-statements.ts           -- Sample CSV/XLSX/MT940 files
    classification-rules.ts      -- Standard rule sets for testing
    budgets.ts                   -- Sample budget versions with lines
    users.ts                     -- Users with different roles and permissions
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

### Dark Theme First

Costify is dark-theme-first. The dark palette (`#0D1117` base) is the primary experience. Light theme is a secondary mode that inverts the scale. All designs must look excellent in dark mode before considering light.

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
