# Costify Phase 1 -- Build Plan

**Goal:** Build the Costify financial control module with the jurnal contabil as input.
**Reference:** `reference/tb-report/` -- working prototype by the accountant, to be rewritten better.
**Date:** April 2026

---

## 1. What We're Building

An accountant manages 1000+ clients. For each client, the accountant does bookkeeping in Saga (or similar) and exports a **jurnal contabil** (accounting journal) as XLSX. Costify takes that journal and instantly produces:

- **Dashboard** -- Cash, receivables, payables, VAT, loans, P&L result
- **Bilant F10** -- Balance sheet per OMFP 1802/2014
- **CPP F20** -- Profit & Loss statement per OMFP 1802/2014
- **Financial Ratios** -- Liquidity, solvency, margins, DSO/DPO, debt ratio
- **Monthly Trends** -- Revenue, expenses, profit, cash per month
- **Cashflow** -- Inflows vs outflows by category
- **Year Comparison** -- YoY revenue/expense analysis
- **Partner View** -- Top clients/suppliers, outstanding amounts
- **Business Insights** -- 30+ auto-generated signals
- **Export** -- PDF, Excel, HTML

Everything derives from ONE input: the jurnal contabil.

---

## 2. How TB-Report Works (What We Learned)

### Data Flow

```
XLSX File (jurnal or balanta)
  │
  ▼
IMPORT API (sync, single HTTP request, 90s timeout)
  │
  ├─ Parse XLSX → JournalEntry[] or BalanceRow[]
  ├─ If journal: compute BalanceRow[] for every (year, month)
  ├─ If journal: extract partner names from descriptions
  └─ Store in ONE Prisma transaction: Dataset + Lines + Rows + Partners
  │
  ▼
DATABASE (PostgreSQL via Prisma)
  │
  │  Persisted: raw journal lines, pre-computed balance rows, partner names
  │  NOT persisted: KPIs, ratios, bilant, CPP, insights (recomputed per page load)
  │
  ▼
REPORT PAGES (Next.js Server Components)
  │
  ├─ /report/{id}  → 15+ financial computations → ReportView (8 sections)
  ├─ /bilant/{id}  → computeBilant() → BilantView (Activ/Pasiv tables)
  └─ /cpp/{id}     → computeCpp() → CppView (P&L line items)
  │
  ▼
CLIENT COMPONENTS (React, presentation only)
  Full page reload on period change. KPI drill-down to balance table.
```

### What's Persisted vs Computed On-the-Fly

| Data | TB-Report | Costify |
|------|-----------|---------|
| Raw journal lines | Persisted (JournalLine table) | Persisted |
| Pre-computed balance rows per (year,month) | Persisted (BalanceRow table) | Persisted |
| Partner name mappings | Persisted (JournalPartner table) | Persisted |
| KPIs (cash, receivables, payables, etc.) | Computed per page load | **Persisted** (cached, invalidated on new import) |
| Bilant F10 structure | Computed per page load | **Persisted** |
| CPP F20 structure | Computed per page load | **Persisted** |
| Financial ratios | Computed per page load | **Persisted** |
| Monthly trends | Computed per page load | **Persisted** |
| Year comparison | Computed per page load | **Persisted** |
| Insights | Computed per page load | **Persisted** |

### TB-Report's Key Design Decisions

| Decision | How It Works | Problem |
|----------|-------------|---------|
| Sync import | All parsing + computation in one HTTP request | 90s timeout, blocks server |
| Server-side rendering | All financial math in server components | Full page reload on period change |
| File-centric model | Each XLSX = one Dataset, isolated | No client continuity, no history |
| No caching | Recomputes KPIs/ratios every page load | Slow for complex datasets |
| Flat multi-tenancy | Organization + Membership at app level | No RLS, no DB-level isolation |
| No audit trail | Delete = gone forever | Non-compliant for financial data |
| No tests | Zero test files | Dangerous for financial code |

### TB-Report's Proven Algorithms (preserve the logic, rewrite the code)

1. **P&L year-end closing** -- For each year, accumulate journal entries, close class 6/7 to account 121. Opening balance of next year = closing balance with class 6/7 zeroed.

2. **Bifunctional account classification** -- Class 4 accounts classified by sign of net balance (finD - finC). Positive = asset, Negative = liability. Exception: 4551 always long-term liability.

3. **Class 5 treatment** -- Account 512 (bank) always ACTIV, even if negative (overdraft). Account 519 (short-term loans) always PASIV.

4. **Unclosed P&L result** -- Mid-year: compute cls7 - cls6 and add as "rezultat curent neclosat" to PASIV to balance the bilant.

5. **Leaf-only computation** -- Filter to isLeaf=true before aggregating. Parent accounts excluded to avoid double-counting.

6. **Contra-accounts** -- 609 reduces expenses (subtract totalCred). 709 reduces revenue (subtract totalDeb).

7. **Compound journal entries** -- "%" notation means one-to-many split. Parser handles both forward and backward compound patterns.

8. **Romanian number format** -- 1.234.567,89 (dot=thousands, comma=decimal). Special case: 1.234 = 1234 (not 1.234).

---

## 3. The Fundamental Shift: File-Centric → Client-Centric

| TB-Report (file-centric) | Costify (client-centric) |
|---|---|
| Upload a file → see a report | Select a client → see their financials |
| Each import is isolated | Imports are versioned history per client |
| "Dataset" is the top-level entity | "Client" is the top-level, datasets are snapshots |
| No concept of "current" data | Latest import = current picture |
| One user, one org | Accountant manages 1000+ clients, isolated |
| Delete dataset = gone forever | Soft-delete, audit trail preserved |
| Full page reload on period change | Client-side navigation, API calls |

### User Flow: Accountant's Perspective

```
1. Login → see Client List (1000+ clients)
2. Select "SC ALPHA SRL" → see their latest financial dashboard
3. Need to update? → Import new jurnal contabil XLSX
4. Import runs async → notification when ready
5. Dashboard refreshes with new data
6. Old import preserved as history → can compare versions
7. Switch to "SC BETA SRL" → completely different data, isolated
8. Export PDF for SC ALPHA → hand to client
```

---

## 4. Costify Phase 1 Architecture

```
                     ┌─────────────────────────────────┐
                     │  ACCOUNTANT'S BROWSER            │
                     │                                  │
                     │  Client List → Client Dashboard  │
                     │  Import XLSX → Async notification │
                     │  Report / Bilant / CPP views     │
                     │  Export PDF / Excel / HTML        │
                     └──────────────┬──────────────────┘
                                    │
                              HTTPS / WSS
                                    │
                     ┌──────────────▼──────────────────┐
                     │  NEXT.JS 15 (Frontend + SSR)     │
                     │                                  │
                     │  Pages:                          │
                     │  /                → Client list   │
                     │  /clients/{id}   → Dashboard      │
                     │  /clients/{id}/bilant  → F10      │
                     │  /clients/{id}/cpp    → F20       │
                     │  /clients/{id}/import → Upload    │
                     │  /clients/{id}/history → Versions │
                     └──────────────┬──────────────────┘
                                    │
                              API calls
                                    │
                     ┌──────────────▼──────────────────┐
                     │  FASTIFY API                     │
                     │                                  │
                     │  Auth + Tenant middleware         │
                     │  RLS injection (SET app.tenant_id)│
                     │                                  │
                     │  POST /import/journal             │
                     │    → store file, enqueue job      │
                     │                                  │
                     │  GET /clients/{id}/report         │
                     │    → read cached report snapshot  │
                     │                                  │
                     │  GET /clients/{id}/bilant         │
                     │    → read cached bilant snapshot  │
                     │                                  │
                     │  GET /clients/{id}/cpp            │
                     │    → read cached CPP snapshot     │
                     │                                  │
                     │  GET /clients/{id}/balanta        │
                     │    → read balance rows            │
                     │                                  │
                     │  GET /clients/{id}/trends         │
                     │    → read cached trends           │
                     │                                  │
                     │  GET /clients/{id}/datasets       │
                     │    → list import history          │
                     └──────────────┬──────────────────┘
                                    │
                        ┌───────────┼───────────┐
                        │                       │
             ┌──────────▼──────────┐ ┌─────────▼──────────┐
             │  POSTGRESQL 16      │ │  REDIS 7            │
             │                     │ │                     │
             │  RLS on all tables  │ │  Session cache      │
             │  Tenant isolation   │ │  BullMQ job queue   │
             │  Audit (append-only)│ │  Report cache       │
             └──────────┬─────────┘ │  WebSocket pub/sub  │
                        │           └──────────┬──────────┘
                        │                      │
             ┌──────────▼──────────────────────▼──────────┐
             │  BULLMQ WORKER                              │
             │                                             │
             │  Job: process-journal-import                 │
             │  1. Parse XLSX → JournalEntry[]              │
             │  2. Extract partner mappings                 │
             │  3. Compute BalanceRow[] per (year, month)   │
             │  4. Compute & persist report snapshots:      │
             │     KPIs, Bilant, CPP, Ratios, Trends       │
             │  5. Update dataset status → ready            │
             │  6. Push WebSocket notification              │
             │  7. Write audit event                        │
             └─────────────────────────────────────────────┘
```

---

## 5. Authentication Architecture

### Why Custom Auth (not NextAuth/Auth.js)

TB-Report uses NextAuth with credentials provider. It works but:
- Session strategy is JWT-based (stateless) -- can't revoke individual sessions
- Type augmentation is hacky (`session.user as { id: string }`)
- Black box: hard to add rate limiting, audit logging, session listing
- Upgrade path to Keycloak later is easier from a custom system than from NextAuth

Costify uses **server-side sessions with httpOnly cookies**:

```
REGISTER / LOGIN FLOW:
  
  Browser                           Fastify API                    PostgreSQL
    │                                   │                              │
    │  POST /api/auth/login             │                              │
    │  { email, password }              │                              │
    │ ─────────────────────────────────>│                              │
    │                                   │  SELECT * FROM platform_user │
    │                                   │  WHERE email = ?             │
    │                                   │ ────────────────────────────>│
    │                                   │              user row        │
    │                                   │ <────────────────────────────│
    │                                   │                              │
    │                                   │  bcrypt.compare(password,    │
    │                                   │    user.password_hash)       │
    │                                   │                              │
    │                                   │  INSERT INTO session         │
    │                                   │  (user_id, token, ip,        │
    │                                   │   user_agent, expires_at)    │
    │                                   │ ────────────────────────────>│
    │                                   │                              │
    │  Set-Cookie: sid={token};         │                              │
    │  HttpOnly; Secure; SameSite=Lax;  │                              │
    │  Path=/; Max-Age=604800           │                              │
    │ <─────────────────────────────────│                              │
    │                                   │                              │


EVERY SUBSEQUENT REQUEST:

  Browser                           Fastify API                    PostgreSQL
    │                                   │                              │
    │  GET /api/clients                 │                              │
    │  Cookie: sid={token}              │                              │
    │ ─────────────────────────────────>│                              │
    │                                   │                              │
    │                          auth.middleware:                         │
    │                                   │  SELECT u.*, s.expires_at    │
    │                                   │  FROM session s              │
    │                                   │  JOIN platform_user u        │
    │                                   │    ON s.user_id = u.id       │
    │                                   │  WHERE s.token = ?           │
    │                                   │    AND s.expires_at > now()  │
    │                                   │ ────────────────────────────>│
    │                                   │              user + session  │
    │                                   │ <────────────────────────────│
    │                                   │                              │
    │                          request.user = { id, email, name }      │
    │                          proceed to route handler                 │
    │                                   │                              │
```

### Session Security Rules

| Rule | Implementation |
|------|---------------|
| **HttpOnly** | Cookie cannot be read by JavaScript (XSS protection) |
| **Secure** | Cookie only sent over HTTPS (production) |
| **SameSite=Lax** | Cookie not sent on cross-site POST (CSRF protection) |
| **7-day expiry** | Session auto-expires, user must re-login |
| **One token per login** | Each login creates a new session. Multiple devices = multiple sessions |
| **Revocable** | User can see active sessions and revoke any of them |
| **IP + User-Agent logged** | For security audit (show user "Chrome on MacOS, logged in from 86.x.x.x") |
| **Rate limited** | 5 failed logins per 15 min per IP → 429 Too Many Requests |
| **Password rules** | Minimum 8 chars. Bcrypt cost=12. No max length (bcrypt handles it) |
| **Password reset** | Token valid 1 hour, single-use, invalidates all other reset tokens for that email |

### What's Deferred to Phase 2

- **MFA (TOTP/WebAuthn)** -- important for production, but not Phase 1
- **OAuth providers** (Google, Microsoft) -- nice to have, not critical
- **Keycloak migration** -- when team access is needed (Phase 2 multi-user orgs)
- **Brute force lockout** -- Phase 1 has rate limiting, Phase 2 adds account lockout
- **Password breach checking** (HaveIBeenPwned API) -- Phase 2

---

## 6. Data Model

### Entity Hierarchy

```
PlatformUser (accountant)
  └── Client[] (their client companies)
        ├── Dataset[] (versioned journal imports)
        │     ├── JournalLine[] (raw double-entry records)
        │     ├── BalanceRow[] (computed per year/month)
        │     ├── JournalPartner[] (name mappings)
        │     └── ReportSnapshot[] (cached computed reports)
        └── AuditEvent[] (immutable log)
```

### Key Tables

```sql
-- ============================================================
-- AUTH & USERS
-- ============================================================

-- The accountant / platform user
CREATE TABLE platform_user (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  avatar_url      TEXT,
  email_verified  BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Sessions (server-side, httpOnly cookie references this)
CREATE TABLE session (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES platform_user(id) ON DELETE CASCADE NOT NULL,
  token           TEXT UNIQUE NOT NULL,     -- opaque session token (stored in httpOnly cookie)
  ip_address      INET,
  user_agent      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),

  INDEX (token),
  INDEX (user_id),
  INDEX (expires_at)
);

-- Password reset tokens
CREATE TABLE password_reset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES platform_user(id) ON DELETE CASCADE NOT NULL,
  token           TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Email verification tokens
CREATE TABLE email_verification (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES platform_user(id) ON DELETE CASCADE NOT NULL,
  token           TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CLIENTS
-- ============================================================

-- A client company managed by the accountant
CREATE TABLE client (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES platform_user(id) NOT NULL,
  name            TEXT NOT NULL,           -- "SC ALPHA SRL"
  cui             TEXT,                    -- fiscal code
  caen            TEXT,                    -- CAEN code
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- An imported journal file (versioned per client)
CREATE TABLE dataset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES client(id) NOT NULL,
  name            TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_hash       TEXT NOT NULL,           -- SHA-256 of uploaded file
  source_type     TEXT NOT NULL DEFAULT 'registru_jurnal',
  status          TEXT NOT NULL DEFAULT 'processing',  -- processing, ready, failed
  period_year     INT,
  period_month    INT,
  created_by      UUID REFERENCES platform_user(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  
  INDEX (client_id, created_at DESC)
);

-- Raw journal lines (same as tb-report, proven schema)
CREATE TABLE journal_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      UUID REFERENCES dataset(id) ON DELETE CASCADE NOT NULL,
  data            DATE NOT NULL,
  year            INT NOT NULL,
  month           INT NOT NULL,
  ndp             TEXT NOT NULL,           -- document number
  cont_d          TEXT NOT NULL,           -- debit account (analytic)
  cont_d_base     TEXT NOT NULL,           -- debit account (synthetic)
  cont_c          TEXT NOT NULL,           -- credit account (analytic)
  cont_c_base     TEXT NOT NULL,           -- credit account (synthetic)
  suma            NUMERIC(18,2) NOT NULL,
  explicatie      TEXT NOT NULL,
  fel_d           TEXT,                    -- document type
  categorie       TEXT,                    -- cost category
  cod             TEXT,                    -- partner code
  validat         TEXT,
  tva             NUMERIC(18,2),
  
  INDEX (dataset_id, year, month),
  INDEX (dataset_id, cont_d_base),
  INDEX (dataset_id, cont_c_base),
  INDEX (dataset_id, categorie),
  INDEX (dataset_id, cod)
);

-- Computed balance rows (same structure as tb-report, proven)
CREATE TABLE balance_row (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      UUID REFERENCES dataset(id) ON DELETE CASCADE NOT NULL,
  year            INT,
  month           INT,                     -- 1-12 for monthly, NULL for annual
  cont            TEXT NOT NULL,           -- full account code (e.g., "5121.00001")
  cont_base       TEXT NOT NULL,           -- synthetic account (e.g., "5121")
  denumire        TEXT NOT NULL,           -- account name
  tip             TEXT NOT NULL,           -- A, P, B
  is_leaf         BOOLEAN DEFAULT true,
  has_child       BOOLEAN DEFAULT false,
  
  -- 14 financial columns (Romanian trial balance structure)
  deb_init        NUMERIC(18,2) DEFAULT 0,
  cred_init       NUMERIC(18,2) DEFAULT 0,
  sold_in_d       NUMERIC(18,2) DEFAULT 0,
  sold_in_c       NUMERIC(18,2) DEFAULT 0,
  deb_prec        NUMERIC(18,2) DEFAULT 0,
  cred_prec       NUMERIC(18,2) DEFAULT 0,
  rulaj_d         NUMERIC(18,2) DEFAULT 0,
  rulaj_c         NUMERIC(18,2) DEFAULT 0,
  rulaj_td        NUMERIC(18,2) DEFAULT 0,
  rulaj_tc        NUMERIC(18,2) DEFAULT 0,
  total_deb       NUMERIC(18,2) DEFAULT 0,
  total_cred      NUMERIC(18,2) DEFAULT 0,
  fin_d           NUMERIC(18,2) DEFAULT 0,
  fin_c           NUMERIC(18,2) DEFAULT 0,
  
  INDEX (dataset_id, year, month),
  INDEX (dataset_id, is_leaf),
  INDEX (dataset_id, cont_base)
);

-- Partner name lookups (same as tb-report)
CREATE TABLE journal_partner (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      UUID REFERENCES dataset(id) ON DELETE CASCADE NOT NULL,
  analytic_account TEXT NOT NULL,
  cont_base       TEXT NOT NULL,
  partner_name    TEXT NOT NULL,
  cod             TEXT,
  
  UNIQUE (dataset_id, analytic_account)
);

-- Cached computed reports (NEW -- tb-report doesn't have this)
CREATE TABLE report_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      UUID REFERENCES dataset(id) ON DELETE CASCADE NOT NULL,
  year            INT NOT NULL,
  month           INT NOT NULL,
  report_type     TEXT NOT NULL,            -- 'kpis', 'bilant', 'cpp', 'ratios', 'trends', 'comparison', 'insights'
  data            JSONB NOT NULL,           -- the computed report data
  computed_at     TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (dataset_id, year, month, report_type)
);

-- Audit trail (NEW -- tb-report doesn't have this)
CREATE TABLE audit_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL,
  actor_id        UUID,
  action          TEXT NOT NULL,            -- 'import', 'delete', 'export', 'view'
  entity_type     TEXT NOT NULL,            -- 'dataset', 'report', 'client'
  entity_id       UUID,
  metadata        JSONB DEFAULT '{}',
  checksum        TEXT NOT NULL,            -- SHA-256 tamper detection
  created_at      TIMESTAMPTZ DEFAULT now()
);
-- INSERT only, no UPDATE, no DELETE
```

---

## 7. Module Structure

```
src/
  modules/
    ingestion/
      sources/
        journal-xlsx.ts          -- Parse jurnal contabil XLSX (from tb-report parser.ts)
        balance-xlsx.ts          -- Parse balanta XLSX (from tb-report parser.ts)
      ingestion.service.ts       -- Orchestrate import: validate, store, enqueue
      ingestion.types.ts
      ingestion.test.ts

    balances/
      balances.service.ts        -- Compute BalanceRow[] from journal (from tb-report compute-balance.ts)
      validate.ts                -- Accounting equality checks (from tb-report validate.ts)
      balances.types.ts
      balances.test.ts

    reporting/
      reporting.service.ts       -- Orchestrate all report computations
      bilant.service.ts          -- Balance sheet F10 (from tb-report bilant/compute.ts)
      cpp.service.ts             -- P&L statement F20 (from tb-report cpp/compute.ts)
      kpi.service.ts             -- KPIs: cash, receivables, payables, VAT, loans, result
      ratios.service.ts          -- Financial ratios: liquidity, solvency, DSO, DPO, margin
      cash.service.ts            -- Cash position: available vs obligations
      expenses.service.ts        -- Expense breakdown by account group
      revenue.service.ts         -- Revenue breakdown by account group
      trends.service.ts          -- Monthly evolution + cashflow (from tb-report trends.ts)
      comparison.service.ts      -- Year-over-year analysis (from tb-report year-comparison.ts)
      insights.service.ts        -- Auto-generated business signals (from tb-report kpis.ts)
      outstanding.service.ts     -- Outstanding clients/suppliers per partner
      withdrawals.service.ts     -- Owner withdrawals and dividends
      reporting.types.ts
      reporting.test.ts

    auth/
      auth.service.ts            -- Register, login, logout, session management
      password.service.ts        -- Hash, verify, reset flow
      session.service.ts         -- Create, validate, revoke sessions
      auth.middleware.ts         -- Fastify middleware: extract user from session cookie
      auth.guard.ts              -- Route protection: requireAuth, requireOwner
      auth.types.ts
      auth.test.ts

    audit/
      audit.service.ts           -- Write audit events, verify checksums
      audit.types.ts
      audit.test.ts

  shared/
    types/
      chart-of-accounts.ts       -- Account type/name mapping (from tb-report account-map.ts)
      balance.ts                 -- BalanceRow, JournalEntry shared types
    utils/
      money.ts                   -- Romanian number parsing, formatting
      hash.ts                    -- SHA-256 for dedup + audit
    database/
      prisma.ts                  -- DB client
    errors/
      errors.ts                  -- Typed error classes
```

---

## 8. Import Flow (Detailed)

### TB-Report (how it works now)
```
1. User uploads XLSX via browser
2. File sent to POST /api/import/registru-jurnal
3. Server parses XLSX (2-30 seconds)
4. Server computes balance for every (year, month) (10-60 seconds)
5. Server stores everything in one transaction (5-15 seconds)
6. Server returns datasetId
7. Browser redirects to /bilant/{datasetId}
Total: 17-105 seconds, blocking HTTP request
```

### Costify (how it should work)
```
1. User uploads XLSX via browser
2. File sent to POST /api/import/journal
3. Server stores raw file, creates Dataset (status: processing)
4. Server enqueues BullMQ job, returns datasetId immediately (<500ms)
5. Browser shows "Processing..." with progress indicator
6. Worker picks up job:
   a. Parse XLSX → JournalEntry[]                    (2-30s)
   b. Extract partner mappings                        (1-2s)
   c. Compute BalanceRow[] per (year, month)          (10-60s)
   d. Compute & persist report snapshots              (5-10s)
   e. Write audit event                               (<1s)
   f. Update dataset status → ready                   (<1s)
   g. Push WebSocket notification                     (<1s)
7. Browser receives WS notification, loads dashboard
Total: same computation time, but user isn't blocked
```

---

## 9. API Surface

### Authentication
```
POST   /api/auth/register                        Create account (email, name, password)
POST   /api/auth/login                            Login (email, password) → session cookie
POST   /api/auth/logout                           Logout (revoke session)
GET    /api/auth/me                               Current user info (from session)
POST   /api/auth/forgot-password                  Request password reset email
POST   /api/auth/reset-password                   Reset password with token
POST   /api/auth/verify-email                     Verify email with token
GET    /api/auth/sessions                         List active sessions
DELETE /api/auth/sessions/:id                     Revoke specific session
```

### Client Management
```
GET    /api/clients                              List all clients for this user
POST   /api/clients                              Create new client
GET    /api/clients/:id                          Client details
PATCH  /api/clients/:id                          Update client info
DELETE /api/clients/:id                          Soft-delete client
```

### Import
```
POST   /api/clients/:id/import/journal           Upload jurnal contabil XLSX
POST   /api/clients/:id/import/balanta            Upload balanta XLSX
GET    /api/clients/:id/import/:jobId/status      Check import job status
```

### Datasets (Import History)
```
GET    /api/clients/:id/datasets                  List imports (newest first)
GET    /api/clients/:id/datasets/:datasetId       Dataset metadata
DELETE /api/clients/:id/datasets/:datasetId        Soft-delete dataset
```

### Reports (read from cached snapshots)
```
GET    /api/clients/:id/report?year=&month=       Full dashboard data (KPIs, summary, ratios)
GET    /api/clients/:id/bilant?year=&month=        Balance sheet F10
GET    /api/clients/:id/cpp?year=&month=           P&L statement F20
GET    /api/clients/:id/trends?year=               Monthly evolution trends
GET    /api/clients/:id/comparison                  Year-over-year comparison
GET    /api/clients/:id/insights?year=&month=       Business insights
GET    /api/clients/:id/balanta?year=&month=        Raw trial balance rows
```

### Export
```
POST   /api/clients/:id/export                     Export report (PDF, Excel, HTML)
```

### Reconciliation
```
GET    /api/clients/:id/reconcile?balantaId=&journalId=&year=&month=
```

### Audit
```
GET    /api/clients/:id/audit                      Audit trail for client
```

---

## 10. Frontend Pages

```
Auth (public, no session required):
/login                               → Login (email + password)
/register                            → Register (name + email + password)
/forgot-password                     → Request password reset
/reset-password?token=               → Set new password
/verify-email?token=                 → Email verification landing

Protected (session required):
/                                    → Client list (search, filter, sort)
/settings                            → User settings (name, email, password, sessions)
/clients/:id                         → Client dashboard (latest report)
/clients/:id/bilant                   → Balance sheet F10
/clients/:id/cpp                      → P&L statement F20
/clients/:id/import                   → Import wizard
/clients/:id/history                  → Dataset version history
```

### Dashboard Sections (same as tb-report, better UX)

| Section | Source Component (tb-report) | Costify Improvement |
|---------|---------------------------|---------------------|
| Financial Overview | `financial-overview.tsx` | Add sparkline trends inline |
| Monthly Trends | `evolution-trends-section.tsx` | Client-side period navigation (no reload) |
| Revenue & Expenses | `revenue-breakdown-chart.tsx` + `expense-breakdown-chart.tsx` | Side-by-side comparison |
| Financial Ratios | `financial-ratios-card.tsx` | Add historical ratio trends |
| Cash & KPIs | `kpi-cards.tsx` + `cash-position-chart.tsx` | KPI drill-down without page reload |
| Debts & Receivables | `outstanding-accounts.tsx` | Add aging analysis |
| Balance Structure | `balance-structure-chart.tsx` | Interactive drill-down |
| Insights | `insights-panel.tsx` | Prioritized, actionable |
| Balance Table | `balance-table.tsx` | Virtual scroll for large datasets |

---

## 11. What to Build, In Order

### Step 1: Project Setup + Auth
- [ ] Initialize Next.js 15 + Fastify + PostgreSQL + Redis + BullMQ
- [ ] Database schema (Prisma, tables above)
- [ ] **Auth module:**
  - [ ] Registration: validate email uniqueness, hash password (bcrypt, cost=12), create user + session
  - [ ] Login: verify credentials, create session, set httpOnly secure cookie
  - [ ] Logout: revoke session, clear cookie
  - [ ] Session middleware: on every request, read cookie → lookup session → inject user into context
  - [ ] Session management: list active sessions, revoke individual sessions, auto-expire (7 days)
  - [ ] Password reset: generate token (crypto.randomBytes, 1h expiry), email link, verify + update
  - [ ] Email verification: generate token on register, verify endpoint, flag user as verified
  - [ ] Auth guards: `requireAuth` middleware (401 if no session), ownership check (user_id matches)
  - [ ] Rate limiting: 5 login attempts per 15 min per IP, 3 password resets per hour per email
  - [ ] **Auth tests:** register, login, logout, session expiry, password reset flow, rate limiting
- [ ] **Auth UI:**
  - [ ] Login page (email + password, link to register, link to forgot password)
  - [ ] Register page (name + email + password + confirm password, redirect to client list)
  - [ ] Forgot password page (email input, success message)
  - [ ] Reset password page (new password + confirm, from token link)
  - [ ] Settings page (change name, change email, change password, active sessions list)
- [ ] Client CRUD (create, list, view, update, soft-delete)
- [ ] Basic UI shell (client list, client page, navigation)

### Step 2: Journal Import Pipeline
- [ ] XLSX parser (port from `reference/tb-report/src/lib/journal/parser.ts`)
- [ ] Balance computation (port from `reference/tb-report/src/lib/journal/compute-balance.ts`)
- [ ] Partner extraction (port from `reference/tb-report/src/lib/journal/partner.ts`)
- [ ] Account mapping (port from `reference/tb-report/src/lib/journal/account-map.ts`)
- [ ] BullMQ worker for async processing
- [ ] Import API endpoint + status polling
- [ ] Import wizard UI
- [ ] **Tests for every computation function**

### Step 3: Report Computation & Persistence
- [ ] KPI computation (port + decompose from `reference/tb-report/src/lib/balance/kpis.ts`)
- [ ] Bilant F10 (port from `reference/tb-report/src/lib/bilant/compute.ts`)
- [ ] CPP F20 (port from `reference/tb-report/src/lib/cpp/compute.ts`)
- [ ] Financial ratios (extract from kpis.ts)
- [ ] Cash position (extract from kpis.ts)
- [ ] Insights generation (extract from kpis.ts)
- [ ] Monthly trends (port from `reference/tb-report/src/lib/journal/trends.ts`)
- [ ] Year comparison (port from `reference/tb-report/src/lib/journal/year-comparison.ts`)
- [ ] Persist all computed reports as ReportSnapshot
- [ ] Report API endpoints (read from snapshots)
- [ ] **Tests for every report computation**

### Step 4: Dashboard UI
- [ ] Client dashboard page (KPIs, overview, charts)
- [ ] Bilant view (Activ/Pasiv tables)
- [ ] CPP view (P&L line items)
- [ ] Monthly trends charts
- [ ] Revenue/expense breakdown charts
- [ ] Financial ratios cards
- [ ] Cash position chart
- [ ] Outstanding clients/suppliers
- [ ] Insights panel
- [ ] Balance table with drill-down
- [ ] Period selector (client-side, no page reload)

### Step 5: Export & History
- [ ] PDF export
- [ ] Excel export
- [ ] HTML export
- [ ] Dataset version history per client
- [ ] Compare two versions side-by-side

### Step 6: Polish
- [ ] Audit trail (import, delete, export events)
- [ ] Error handling and validation UX
- [ ] Loading states, empty states
- [ ] Responsive design
- [ ] Localization (ro, en minimum)

---

## 12. Technology Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 15 + React 19 | SSR for initial load, client navigation for speed |
| Styling | TailwindCSS + shadcn/ui | Same as tb-report, proven component library |
| Charts | Recharts | Same as tb-report, sufficient for financial charts |
| API | Fastify | Separate from Next.js, proper middleware, better perf |
| Database | PostgreSQL 16 + Prisma | RLS support, proven with financial data |
| Cache | Redis 7 | Session cache, report cache, BullMQ backend |
| Job Queue | BullMQ | Async import processing, no HTTP timeout risk |
| Auth | Custom session-based (no NextAuth) | Full control over session lifecycle, no magic, easy to reason about |
| Password Hashing | bcrypt (cost=12) | Industry standard, timing-safe |
| Session Tokens | crypto.randomBytes(32) → hex | 256-bit entropy, stored in DB, httpOnly cookie |
| File Storage | Local filesystem (Phase 1) → S3 (Phase 2) | Keep simple initially |
| Testing | Vitest | Fast, TypeScript-native |
| Precision | decimal.js | Same as tb-report, avoids floating-point errors |
| XLSX Parsing | xlsx (SheetJS) | Same as tb-report, proven with Romanian formats |

---

## 13. Non-Goals for Phase 1

These are explicitly deferred to Phase 2+:

- Bank feed ingestion (FGO, direct bank, CSV)
- Automatic transaction classification engine
- Budget & forecast engine
- Cost category ownership and approval workflows
- Saga integration
- Notification system (email, push)
- Multi-currency support
- MFA authentication (TOTP/WebAuthn -- see Section 5, deferred to Phase 2)
- Custom report builder
- ML-assisted anything
- Mobile app
- API for external BI tools

Phase 1 is: **jurnal contabil in, financial control dashboard out, per client, with history.**
