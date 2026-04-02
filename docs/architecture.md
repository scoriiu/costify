# Costify — System Architecture

## Overview

Costify is a multi-tenant financial control platform. Each platform user (accountant, finance manager) manages thousands of client organizations. Each client organization is a fully isolated tenant with its own bank accounts, transactions, budgets, and reports.

The system processes financial data through a strict, audited pipeline: **Ingest → Normalize → Classify → Journal → Balances → Outer Systems**. Every stage produces audit records. No stage can be skipped.

---

## High-Level Architecture

```
                            ┌─────────────────────────────┐
                            │       Client Browsers        │
                            │   (thousands of users,       │
                            │    each managing 1000+       │
                            │    client organizations)     │
                            └─────────────┬───────────────┘
                                          │
                                    HTTPS / WSS
                                          │
                            ┌─────────────▼───────────────┐
                            │    CDN + Load Balancer       │
                            │    (CloudFlare / ALB)        │
                            └─────────────┬───────────────┘
                                          │
                      ┌───────────────────┼───────────────────┐
                      │                   │                   │
           ┌──────────▼──────────┐ ┌──────▼──────┐ ┌─────────▼──────────┐
           │   Frontend App      │ │ API Gateway  │ │  Worker Cluster    │
           │   (Next.js SSR)     │ │ (Fastify)    │ │  (BullMQ)          │
           │                     │ │              │ │                    │
           │ - Dashboards        │ │ - Auth/MFA   │ │ - Ingestion        │
           │ - Transaction views │ │ - Rate limit │ │ - Classification   │
           │ - Budget editor     │ │ - RLS inject │ │ - Balance recalc   │
           │ - Report builder    │ │ - Validation │ │ - Report gen       │
           │ - Settings          │ │ - Audit log  │ │ - Saga export      │
           │ - Tenant switcher   │ │              │ │ - Notifications    │
           └──────────────────────┘ └──────┬──────┘ └─────────┬──────────┘
                                           │                  │
                      ┌────────────────────┼──────────────────┘
                      │                    │
           ┌──────────▼──────────┐  ┌──────▼──────────────────┐
           │    PostgreSQL 16    │  │    Redis 7               │
           │                    │  │                          │
           │ - RLS on all       │  │ - Session cache          │
           │   tenant tables    │  │ - tenant:{id}: scoped    │
           │ - Audit schema     │  │ - Balance cache          │
           │   (append-only)    │  │ - Job queue (BullMQ)     │
           │ - Partitioned by   │  │ - Pub/Sub live updates   │
           │   tenant + date    │  │ - Rate limit counters    │
           └──────────────────────┘  └────────────────────────┘
```

---

## Core Processing Pipeline

Every financial datum flows through this pipeline. Audit records are produced at every stage.

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
                    │ JOURNAL      │  ← Audit: journal entry created, allocations
                    │ (Immutable   │
                    │  Ledger)     │
                    └────┬─────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼──────────┐
         │TOTAL   │ │ACCOUNT │ │TRANSACTION  │  ← Audit: balance snapshot,
         │BALANCES│ │BALANCES│ │LOG          │     recalc delta
         └────┬───┘ └───┬────┘ └──┬──────────┘
              │         │         │
              └─────────┼─────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼─────┐  ┌─────▼────┐  ┌─────▼──────┐
    │ BUDGET & │  │ REPORTS  │  │ SAGA /     │  ← Audit: report gen, export,
    │ FORECAST │  │ & DASH-  │  │ EXPORT     │     budget change
    │ ENGINE   │  │ BOARDS   │  │ INTEGR.    │
    └──────────┘  └──────────┘  └────────────┘
```

### Stage 1: Ingest

Sources are defined per tenant. Each bank account maps to exactly one source (FGO or direct bank, never both — prevents duplicates).

| Source Type | Method | Frequency |
|-------------|--------|-----------|
| FGO.ro (aggregator) | API / structured scraping | Hourly |
| Direct bank (bypassing FGO) | Open Banking API | Hourly |
| CSV/XLSX upload | File parse | On demand |
| Saga | API webhook | On invoice |
| ERP / Trial balance | File import | Monthly / on demand |

Processing:
1. Fetch/receive raw data from source
2. Store raw payload as-is (immutable source record)
3. Hash raw payload for integrity verification
4. Emit `source.fetched` event
5. **Audit**: raw payload hash, source ID, byte count, fetch timestamp

### Stage 2: Normalize & Deduplicate

1. Parse format (CSV, XLSX, MT940, JSON, PDF)
2. Map to unified Transaction schema: date, amount, currency, description, counterparty, IBAN, reference
3. Compute deduplication hash: `SHA-256(date + amount + counterparty_iban + description_normalized)`
4. Check hash against existing transactions for this tenant
5. Reject exact duplicates, flag near-duplicates (same date + amount, different description) for manual review
6. Enrich: counterparty lookup, keyword extraction
7. **Audit**: normalization diff (raw fields → normalized fields), dedup result (new / duplicate / near-duplicate)

### Stage 3: Classify

1. Load active rules for this tenant, ordered by priority (cached in Redis)
2. Evaluate each rule's conditions against transaction fields
3. First-match-wins for primary classification; enrichment rules continue
4. Assign all axes: cost category, business vertical, cost center, owner, recurrence type
5. Compute confidence score (0-100)
6. If confidence > threshold: auto-classify
7. If confidence < threshold: mark as `needs_review`, notify owner
8. If no rule matches: mark as `unclassified`, add to review queue
9. Handle splits: one transaction → multiple allocations with amounts/percentages
10. **Audit**: rule ID matched (or none), confidence score, all axes assigned, split breakdown

### Stage 4: Journal (Immutable Transaction Ledger)

The journal is append-only. Corrections create new entries — existing entries are never mutated.

1. Create journal entry with: transaction data, classification, allocations
2. Link to source record (stage 1) and normalized record (stage 2)
3. Assign sequential journal number per tenant (gap-free for compliance)
4. **Audit**: journal entry ID, all amounts, allocation details, linked source/classification records

### Stage 5: Balances

1. Recalculate total balance across all accounts for the tenant
2. Recalculate per-account running balance
3. Create balance snapshot (point-in-time, immutable)
4. Build/update transaction log (the user-facing view with running balances, filters, search)
5. Update Redis cache for real-time dashboard display
6. **Audit**: previous balance, new balance, delta, snapshot ID, accounts affected

### Stage 6: Outer Systems

All downstream consumers read from the journal and balance snapshots:

- **Budget & Forecast Engine**: Compares actuals (from journal) against budget lines. Computes deviations.
- **Reports & Dashboards**: Aggregates journal + balances into KPIs, charts, drill-down tables.
- **Saga / Export Integration**: Pushes classified invoices to Saga for accountant. Exports to Excel/PDF.
- **Audit**: every report generation, every export, every budget modification, every forecast adjustment.

---

## Multi-Tenant Data Model

### Tenant Hierarchy

```
Platform
  └── Platform User (accountant / finance manager)
        └── Client Organization (tenant)
              ├── Bank Accounts
              ├── Sources (one per bank account)
              ├── Transactions & Journal
              ├── Classification Rules
              ├── Cost Taxonomy
              ├── Budgets & Forecasts
              ├── Users (client staff with roles)
              └── Audit Log
```

### Database Schema

All tables with tenant data include `tenant_id` and are protected by RLS.

```sql
-- ============================================================
-- TENANT & AUTH
-- ============================================================

CREATE TABLE platform_user (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  mfa_secret      TEXT,
  mfa_enabled     BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id UUID REFERENCES platform_user(id),
  name            TEXT NOT NULL,
  cui             TEXT,                          -- fiscal code
  address         TEXT,
  settings        JSONB DEFAULT '{}',
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_user (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL,                 -- org_admin, org_manager, org_member, org_viewer
  permissions     JSONB DEFAULT '[]',
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- ============================================================
-- SOURCES & BANK ACCOUNTS
-- ============================================================

CREATE TABLE bank_account (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  bank_name       TEXT NOT NULL,
  iban            TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'RON',
  label           TEXT,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, iban)
);

CREATE TABLE source (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  bank_account_id UUID REFERENCES bank_account(id) NOT NULL,
  type            TEXT NOT NULL,                 -- 'fgo' | 'bank_direct' | 'csv_import' | 'saga' | 'erp'
  name            TEXT NOT NULL,
  config          JSONB DEFAULT '{}',            -- encrypted connection params
  sync_frequency  TEXT NOT NULL DEFAULT 'hourly',
  active          BOOLEAN DEFAULT true,
  last_sync_at    TIMESTAMPTZ,
  last_sync_status TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bank_account_id)                        -- one source per bank account
);

-- ============================================================
-- RAW INGESTION (immutable source records)
-- ============================================================

CREATE TABLE raw_ingestion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  source_id       UUID REFERENCES source(id) NOT NULL,
  payload         JSONB NOT NULL,               -- raw data as received
  payload_hash    TEXT NOT NULL,                 -- SHA-256 of raw payload
  byte_count      INTEGER NOT NULL,
  fetched_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NORMALIZED TRANSACTIONS
-- ============================================================

CREATE TABLE transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  raw_ingestion_id UUID REFERENCES raw_ingestion(id),
  bank_account_id UUID REFERENCES bank_account(id) NOT NULL,
  date            DATE NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'RON',
  description     TEXT,
  counterparty_name TEXT,
  counterparty_iban TEXT,
  reference       TEXT,
  dedup_hash      TEXT NOT NULL,                -- SHA-256 for deduplication
  classification_status TEXT NOT NULL DEFAULT 'pending',  -- pending, classified, needs_review, unclassified
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, dedup_hash)
);

-- ============================================================
-- COST TAXONOMY
-- ============================================================

CREATE TABLE cost_group (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  name            TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE TABLE cost_category (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  cost_group_id   UUID REFERENCES cost_group(id) NOT NULL,
  name            TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE TABLE cost_subcategory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  cost_category_id UUID REFERENCES cost_category(id) NOT NULL,
  name            TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE TABLE business_vertical (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT
);

CREATE TABLE cost_center (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  vertical_id     UUID REFERENCES business_vertical(id),
  name            TEXT NOT NULL
);

-- ============================================================
-- CLASSIFICATION
-- ============================================================

CREATE TABLE classification_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  name            TEXT NOT NULL,
  priority        INTEGER NOT NULL DEFAULT 100,
  conditions      JSONB NOT NULL,               -- rule condition tree
  target_category_id UUID REFERENCES cost_subcategory(id),
  target_vertical_id UUID REFERENCES business_vertical(id),
  target_cost_center_id UUID REFERENCES cost_center(id),
  target_owner_id UUID,
  recurrence_type TEXT,                         -- one_time, monthly, quarterly, annual
  active          BOOLEAN DEFAULT true,
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- JOURNAL (immutable ledger)
-- ============================================================

CREATE TABLE journal_entry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  journal_number  BIGINT NOT NULL,              -- sequential per tenant, gap-free
  transaction_id  UUID REFERENCES transaction(id) NOT NULL,
  date            DATE NOT NULL,
  total_amount    NUMERIC(15,2) NOT NULL,
  currency        TEXT NOT NULL,
  description     TEXT,
  classification_rule_id UUID REFERENCES classification_rule(id),
  confidence      INTEGER,                      -- 0-100
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, journal_number)
);

CREATE TABLE journal_allocation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entry(id) NOT NULL,
  cost_subcategory_id UUID REFERENCES cost_subcategory(id),
  vertical_id     UUID REFERENCES business_vertical(id),
  cost_center_id  UUID REFERENCES cost_center(id),
  owner_id        UUID,
  amount          NUMERIC(15,2) NOT NULL,
  percentage      NUMERIC(5,2),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BALANCES
-- ============================================================

CREATE TABLE balance_snapshot (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  bank_account_id UUID REFERENCES bank_account(id),  -- NULL = total across all accounts
  balance         NUMERIC(15,2) NOT NULL,
  currency        TEXT NOT NULL,
  snapshot_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BUDGET & FORECAST
-- ============================================================

CREATE TABLE budget_version (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  name            TEXT NOT NULL,
  fiscal_year     INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft', -- draft, review, approved, locked, revised
  created_by      UUID,
  approved_by     UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE budget_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  budget_version_id UUID REFERENCES budget_version(id) NOT NULL,
  cost_subcategory_id UUID REFERENCES cost_subcategory(id) NOT NULL,
  vertical_id     UUID REFERENCES business_vertical(id),
  cost_center_id  UUID REFERENCES cost_center(id),
  period          DATE NOT NULL,                -- first of month
  amount          NUMERIC(15,2) NOT NULL,
  notes           TEXT
);

CREATE TABLE forecast_version (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  name            TEXT NOT NULL,
  scenario_type   TEXT NOT NULL DEFAULT 'base', -- base, conservative, stretch, custom
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE forecast_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  forecast_version_id UUID REFERENCES forecast_version(id) NOT NULL,
  cost_subcategory_id UUID REFERENCES cost_subcategory(id) NOT NULL,
  vertical_id     UUID REFERENCES business_vertical(id),
  cost_center_id  UUID REFERENCES cost_center(id),
  period          DATE NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  method          TEXT,                         -- run_rate, seasonality, moving_avg, commitment, manual
  justification   TEXT
);

-- ============================================================
-- OWNERSHIP & COLLABORATION
-- ============================================================

CREATE TABLE ownership_assignment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  cost_category_id UUID REFERENCES cost_category(id) NOT NULL,
  user_id         UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'primary',  -- primary, backup
  review_frequency TEXT DEFAULT 'monthly',
  valid_from      DATE NOT NULL,
  valid_to        DATE
);

CREATE TABLE comment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  user_id         UUID NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approval (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenant(id) NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  user_id         UUID NOT NULL,
  status          TEXT NOT NULL,                -- approved, rejected, needs_changes
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT (append-only, separate retention)
-- ============================================================

CREATE TABLE audit_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  actor_id        UUID,
  actor_type      TEXT NOT NULL,                -- user, system, scheduler, rule_engine
  pipeline_stage  TEXT NOT NULL,                -- ingest, normalize, classify, journal, balance, export, budget, admin
  action          TEXT NOT NULL,                -- create, update, delete, approve, reject, recalculate, export
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  before          JSONB,
  after           JSONB,
  metadata        JSONB DEFAULT '{}',
  checksum        TEXT NOT NULL,                -- SHA-256 tamper detection
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- App user has INSERT-only on audit_event. No UPDATE, no DELETE.
```

### Key Indexes

```sql
-- Transaction lookups
CREATE INDEX idx_txn_tenant_date ON transaction(tenant_id, date);
CREATE INDEX idx_txn_tenant_account ON transaction(tenant_id, bank_account_id);
CREATE INDEX idx_txn_tenant_status ON transaction(tenant_id, classification_status);
CREATE INDEX idx_txn_dedup ON transaction(tenant_id, dedup_hash);

-- Journal queries
CREATE INDEX idx_journal_tenant_date ON journal_entry(tenant_id, date);
CREATE INDEX idx_journal_tenant_num ON journal_entry(tenant_id, journal_number);
CREATE INDEX idx_alloc_tenant_cat ON journal_allocation(tenant_id, cost_subcategory_id);
CREATE INDEX idx_alloc_tenant_vert ON journal_allocation(tenant_id, vertical_id);

-- Balance lookups
CREATE INDEX idx_balance_tenant_acct ON balance_snapshot(tenant_id, bank_account_id, snapshot_at DESC);

-- Budget queries
CREATE INDEX idx_budget_line_version ON budget_line(budget_version_id, period);
CREATE INDEX idx_forecast_line_version ON forecast_line(forecast_version_id, period);

-- Audit trail
CREATE INDEX idx_audit_tenant_entity ON audit_event(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_tenant_stage ON audit_event(tenant_id, pipeline_stage, created_at);
CREATE INDEX idx_audit_actor ON audit_event(actor_id, created_at);

-- Source sync
CREATE INDEX idx_source_next_sync ON source(active, sync_frequency, last_sync_at);
```

### Row-Level Security

```sql
-- Enable RLS on all tenant tables
ALTER TABLE transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_snapshot ENABLE ROW LEVEL SECURITY;
-- ... (all tenant tables)

-- Policy: tenant can only see its own data
CREATE POLICY tenant_isolation ON transaction
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Middleware sets this on every request:
-- SET LOCAL app.tenant_id = '<uuid>';
```

### Table Partitioning (for scale)

```sql
-- Partition transactions by tenant + month for large-scale deployments
CREATE TABLE transaction (
  ...
) PARTITION BY RANGE (date);

-- Partition audit events by month (high volume, time-series queries)
CREATE TABLE audit_event (
  ...
) PARTITION BY RANGE (created_at);
```

---

## Classification Rule Engine

### Rule Condition Schema

```json
{
  "operator": "AND",
  "conditions": [
    { "field": "counterparty.iban", "op": "equals", "value": "RO49BTRL..." },
    { "field": "description", "op": "contains", "value": "chirie" },
    { "field": "amount", "op": "between", "value": [1000, 5000] },
    { "field": "bank_account.currency", "op": "equals", "value": "RON" }
  ]
}
```

### Supported Operators

| Field Operator | Description |
|---------------|-------------|
| `equals` | Exact match |
| `not_equals` | Not equal |
| `contains` | Substring match (case-insensitive) |
| `starts_with` | Prefix match |
| `regex` | Regular expression |
| `between` | Numeric range [min, max] |
| `greater_than` | Numeric comparison |
| `less_than` | Numeric comparison |
| `in` | Value in list |
| `not_in` | Value not in list |

### Evaluation Pipeline

```
Transaction arrives
     │
     ▼
Load rules for tenant (cached in Redis, invalidated on rule change)
     │
     ▼
For each rule (ordered by priority ASC):
  ├─ Evaluate conditions against transaction fields
  ├─ If ALL conditions match:
  │    ├─ Apply: category, vertical, cost_center, owner, recurrence
  │    ├─ Compute confidence (100 for exact IBAN match, lower for keyword)
  │    └─ Stop (first-match-wins)
  └─ Continue to next rule
     │
     ▼
No rule matched?
  ├─ Status = 'unclassified'
  ├─ Add to review queue
  └─ Compute top 3 suggestions (similarity scoring against recent classifications)
```

---

## Budget & Forecast Flow

```
                    ┌───────────────────┐
                    │  Budget Creation   │
                    │  - Manual entry    │
                    │  - Excel import    │
                    │  - Copy from prev  │
                    └────────┬──────────┘
                             │
                    ┌────────▼──────────┐
                    │  Draft Version     │
                    │  (editable)        │
                    └────────┬──────────┘
                             │
                    Owner edits / Manager reviews
                             │
                    ┌────────▼──────────┐
                    │  Review            │
                    │  (comments,        │
                    │   adjustments)     │
                    └────────┬──────────┘
                             │
                    CFO / Admin approval
                             │
                    ┌────────▼──────────┐
                    │  Approved Version  │───▶ Locked (immutable)
                    └────────┬──────────┘
                             │
                    Mid-period revision needed
                             │
                    ┌────────▼──────────┐
                    │  Revised Version   │
                    │  (new version,     │
                    │   old preserved)   │
                    └───────────────────┘
```

### Forecast Methods

| Method | Description |
|--------|-------------|
| Run-rate | Last N months average projected forward |
| Seasonality | Same-month-last-year with growth factor |
| Moving average | Weighted average of last 3/6/12 months |
| Commitment-based | Known contracts + recurring payments |
| Manual override | Owner adjusts with justification |

### Scenarios

- **Base case**: Most likely outcome based on current trends
- **Conservative**: Assume higher costs, lower revenue
- **Stretch**: Best-case optimization scenario
- **Custom**: User-defined scenarios

---

## API Design

### Endpoint Structure

All endpoints are prefixed with `/api/v1` and require authentication. Tenant context is injected from the JWT.

```
# Sources
GET    /api/v1/sources                          List configured sources
POST   /api/v1/sources                          Add new source
PUT    /api/v1/sources/:id                      Update source config
POST   /api/v1/sources/:id/sync                 Trigger manual sync
GET    /api/v1/sources/:id/status               Get last sync status

# Transactions
GET    /api/v1/transactions                     List (paginated, filterable, sortable)
GET    /api/v1/transactions/:id                 Detail with allocations + audit trail
POST   /api/v1/transactions/import              Upload file for import
POST   /api/v1/transactions/:id/classify        Manual classification
POST   /api/v1/transactions/:id/split           Split across categories
PATCH  /api/v1/transactions/:id                 Update metadata

# Journal
GET    /api/v1/journal                          Journal entries (paginated)
GET    /api/v1/journal/:id                      Entry detail with allocations

# Balances
GET    /api/v1/balances                         Total balance + per-account
GET    /api/v1/balances/:accountId              Account balance + history
GET    /api/v1/balances/snapshots               Historical balance snapshots

# Classification Rules
GET    /api/v1/rules                            List rules
POST   /api/v1/rules                            Create rule
PUT    /api/v1/rules/:id                        Update rule
POST   /api/v1/rules/test                       Test rule against sample data
DELETE /api/v1/rules/:id                        Deactivate rule

# Taxonomy
GET    /api/v1/taxonomy                         Full category tree
POST   /api/v1/taxonomy/groups                  Add group
POST   /api/v1/taxonomy/categories              Add category
POST   /api/v1/taxonomy/subcategories           Add subcategory
PUT    /api/v1/taxonomy/:type/:id               Update
PATCH  /api/v1/taxonomy/reorder                 Reorder items

# Budget
GET    /api/v1/budgets                          List versions
POST   /api/v1/budgets                          Create version
GET    /api/v1/budgets/:id/lines                Get all lines
PUT    /api/v1/budgets/:id/lines                Bulk update lines
POST   /api/v1/budgets/:id/submit               Submit for review
POST   /api/v1/budgets/:id/approve              Approve version
POST   /api/v1/budgets/:id/lock                 Lock period

# Forecast
GET    /api/v1/forecasts                        List versions
POST   /api/v1/forecasts/generate               Auto-generate from actuals
PUT    /api/v1/forecasts/:id/lines              Update with overrides

# Reports
GET    /api/v1/reports/bva                      Budget vs Actual vs Forecast
GET    /api/v1/reports/cashflow                  Cash flow analysis
GET    /api/v1/reports/balances                  Account balance report
GET    /api/v1/reports/categories                Category breakdown
GET    /api/v1/reports/verticals                 Vertical comparison
POST   /api/v1/reports/export                    Export to Excel/PDF

# Dashboard
GET    /api/v1/dashboard/executive              Executive KPIs
GET    /api/v1/dashboard/vertical/:id           Vertical KPIs
GET    /api/v1/dashboard/owner                  Owner's categories KPIs

# Audit
GET    /api/v1/audit                            Query audit trail (filterable by entity, stage, actor, date)
GET    /api/v1/audit/entity/:type/:id           Full audit history for an entity

# Tenant Management
GET    /api/v1/tenants                          List client organizations
POST   /api/v1/tenants                          Create new client org
PUT    /api/v1/tenants/:id                      Update settings
GET    /api/v1/tenants/:id/users                List users in org
POST   /api/v1/tenants/:id/users                Invite user

# Ownership
GET    /api/v1/ownership                        List assignments
POST   /api/v1/ownership                        Assign owner
PUT    /api/v1/ownership/:id                    Update assignment

# Sync Status
GET    /api/v1/sync/status                      Last sync status per source
```

---

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `sync-sources` | Hourly | Pull transactions from all active sources (FGO + direct bank) |
| `classify-pending` | Every 5 min | Run classification on pending transactions |
| `recalc-balances` | After each journal write | Recalculate account and total balances |
| `balance-snapshot` | Daily at 23:00 | Record end-of-day balance per account per tenant |
| `forecast-refresh` | Weekly (Monday 07:00) | Auto-refresh run-rate forecasts |
| `notification-digest` | Daily at 09:00 | Send digest to owners with pending items |
| `audit-checksum-verify` | Daily at 03:00 | Verify audit record checksums, alert on tampering |
| `db-backup` | Daily at 02:00 | Full database backup to S3 (encrypted) |
| `audit-archive` | Monthly | Partition/archive audit logs older than 2 years |

---

## Deployment Architecture

### Production

```
┌──────────────────┐     ┌──────────────────┐
│ CDN (CloudFlare) │     │ Object Storage   │
│                  │     │ (S3 / MinIO)     │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
┌────────▼─────────┐              │
│ Load Balancer    │              │
│ (ALB / Nginx)    │              │
└────────┬─────────┘              │
         │                        │
   ┌─────┴──────┐                 │
   │            │                 │
┌──▼───┐  ┌────▼──┐  ┌───────────▼─────────┐
│ App  │  │ App   │  │ Worker Nodes (auto-  │
│ Node │  │ Node  │  │ scaled)              │
│ (1)  │  │ (N)   │  │ - Ingestion workers  │
└──┬───┘  └──┬────┘  │ - Classification     │
   │         │       │ - Balance recalc     │
   └────┬────┘       │ - Report generation  │
        │             │ - Notifications      │
   ┌────▼──────┐     └──────────┬───────────┘
   │PostgreSQL │                │
   │ Primary + │     ┌──────────▼───────────┐
   │ Replica(s)│     │ Redis Cluster        │
   │ (RLS)     │     │ (sessions, cache,    │
   └───────────┘     │  queues, pub/sub)    │
                     └──────────────────────┘
```

### Scale Considerations

- App nodes: stateless, horizontally scalable behind load balancer
- Worker nodes: auto-scaled based on queue depth
- PostgreSQL: primary + read replicas. Partitioned by tenant + date for large tables
- Redis: cluster mode for high availability
- Connection pooling: pgBouncer between app/workers and PostgreSQL
- All components run in Docker, orchestrated by Kubernetes in production
