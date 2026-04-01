# RedSparQ Financial Control - System Architecture

## High-Level Architecture

```
                              +---------------------------+
                              |      Client Browsers      |
                              |   (23 users, 6 roles)     |
                              +------------+--------------+
                                           |
                                     HTTPS / WSS
                                           |
                              +------------v--------------+
                              |     Load Balancer /        |
                              |     Reverse Proxy (Nginx)  |
                              +------------+--------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
          +----------v-----------+                  +-----------v-----------+
          |   Frontend App       |                  |    API Gateway        |
          |   (Next.js SSR)      |                  |    (Fastify)          |
          |                      |                  |                       |
          |  - Dashboards        |   REST / WS      |  - Auth middleware    |
          |  - Transaction views |<---------------->|  - Rate limiting      |
          |  - Budget editor     |                  |  - Request validation |
          |  - Report builder    |                  |  - Audit logging      |
          |  - Admin panels      |                  |                       |
          +----------------------+                  +-----------+-----------+
                                                                |
                     +------------------------------------------+---------------------------+
                     |                    |                      |                           |
          +----------v-------+  +--------v---------+  +--------v---------+  +--------------v--------+
          | Transaction      |  | Budget &         |  | Classification   |  | Integration           |
          | Service          |  | Forecast Service |  | Service          |  | Service               |
          |                  |  |                  |  |                  |  |                       |
          | - CRUD txns      |  | - Budget CRUD    |  | - Rule engine    |  | - FGO.ro connector    |
          | - Import/parse   |  | - Forecast calc  |  | - Auto-classify  |  | - Bank connectors     |
          | - Deduplication  |  | - Scenarios      |  | - ML suggestions |  | - Saga connector      |
          | - Reconciliation |  | - Approval flow  |  | - Split logic    |  | - File import/export  |
          | - Balance calc   |  | - Period close   |  | - Rule CRUD      |  | - Webhook handlers    |
          +--------+---------+  +--------+---------+  +--------+---------+  +-----------+-----------+
                   |                     |                      |                        |
                   +---------------------+----------------------+------------------------+
                                                    |
                              +---------------------v---------------------+
                              |              PostgreSQL                    |
                              |                                           |
                              |  Schemas:                                  |
                              |  - core (transactions, accounts, vendors) |
                              |  - taxonomy (categories, cost_centers)    |
                              |  - budget (versions, lines, approvals)    |
                              |  - forecast (versions, lines, scenarios)  |
                              |  - auth (users, roles, permissions)       |
                              |  - audit (logs, comments)                 |
                              +---------------------+---------------------+
                                                    |
                              +---------------------v---------------------+
                              |              Redis                         |
                              |                                           |
                              |  - Session cache                          |
                              |  - Real-time balance cache                |
                              |  - Job queue (BullMQ)                     |
                              |  - Pub/Sub for live updates               |
                              +-------------------------------------------+
```

---

## Data Flow Architecture

### 1. Transaction Ingestion Flow

```
+----------+     +-----------+     +------------+     +-----------+
| FGO.ro   |     | Banks     |     | Manual     |     | Saga      |
|(aggregat)|     | (direct,  |     | Upload     |     | (invoices)|
| hourly   |     | bypass    |     | (CSV/XLSX) |     |           |
|          |     |  FGO)     |     |            |     |           |
|          |     |  hourly   |     |            |     |           |
+----+-----+     +-----+-----+     +------+-----+     +-----+-----+
     |                 |                   |                 |
     v                 v                   v                 v
+----+-----------------+-------------------+-----------------+-----+
|                    Ingestion Workers (BullMQ)                     |
|                                                                   |
|  1. Fetch/receive raw data                                        |
|  2. Parse format (CSV, XLSX, MT940, JSON, PDF)                   |
|  3. Normalize to unified Transaction schema                       |
|  4. Compute deduplication hash                                    |
|  5. Enrich (counterparty lookup, keyword extraction)              |
|  6. Store raw + normalized                                        |
|  7. Emit "transaction.created" event                              |
+----------------------------+--------------------------------------+
                             |
                             v
+----------------------------+--------------------------------------+
|                    Classification Engine                           |
|                                                                   |
|  1. Load active rules (ordered by priority)                       |
|  2. Evaluate conditions against transaction fields                |
|  3. If match: apply category, tags, owner, vertical               |
|  4. If no match: mark as "unclassified" -> owner notification     |
|  5. If uncertain: mark as "needs review" with confidence score    |
|  6. Handle splits (one transaction -> multiple allocations)       |
|  7. Emit "transaction.classified" event                           |
+----------------------------+--------------------------------------+
                             |
                             v
+----------------------------+--------------------------------------+
|                    Aggregation Engine                              |
|                                                                   |
|  1. Recalculate period totals per category/vertical/entity        |
|  2. Update running balances                                       |
|  3. Compare against budget/forecast lines                         |
|  4. Compute deviations (delta, %)                                 |
|  5. Check threshold alerts                                        |
|  6. Update Redis cache for real-time dashboards                   |
|  7. Emit "aggregation.updated" event                              |
+---------------------------------------------------------------+
```

### 2. Budget & Forecast Flow

```
                    +-------------------+
                    |  Budget Creation  |
                    |                   |
                    |  - Manual entry   |
                    |  - Excel import   |
                    |  - Copy from prev |
                    +--------+----------+
                             |
                             v
                    +--------+----------+
                    |  Draft Version    |
                    |  (editable)       |
                    +--------+----------+
                             |
                    Owner edits / CFO reviews
                             |
                             v
                    +--------+----------+
                    |  Review           |
                    |  (comments,       |
                    |   adjustments)    |
                    +--------+----------+
                             |
                    CFO approval
                             |
                    +--------v----------+
                    |  Approved Version |-----> Locked (immutable)
                    |  (active)         |
                    +--------+----------+
                             |
                    Mid-year revision needed
                             |
                    +--------v----------+
                    |  Revised Version  |
                    |  (new version,    |
                    |   old preserved)  |
                    +-------------------+

Forecast Generation:
                    +-------------------+
                    | Actuals (YTD)     |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v-----+  +-----v-------+
     | Run-rate   |  | Seasonality|  | Commitment  |
     | method     |  | method     |  | method      |
     +--------+---+  +------+-----+  +-----+-------+
              |              |              |
              +--------------+--------------+
                             |
                    +--------v----------+
                    | Blended Forecast  |
                    | + Owner overrides |
                    +--------+----------+
                             |
                    Scenario analysis
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v-----+  +-----v-------+
     | Base case  |  |Conservative|  | Stretch     |
     +------------+  +------------+  +-------------+
```

---

## Database Schema (ERD)

### Core Domain

```sql
-- Organizational Structure
legal_entity        (id, name, cui, address)
business_vertical   (id, name, legal_entity_id, description)
location            (id, name, address, vertical_id)
cost_center         (id, name, vertical_id, location_id)
project             (id, name, cost_center_id, start_date, end_date, status)

-- Cost Taxonomy (4 levels)
cost_group          (id, name, sort_order)
cost_category       (id, name, cost_group_id, sort_order)
cost_subcategory    (id, name, cost_category_id, sort_order)
cost_analytic       (id, name, cost_subcategory_id, sort_order)

-- Banking & Transactions
bank_account        (id, bank_name, iban, currency, legal_entity_id, fgo_account_id)
counterparty        (id, name, fiscal_code, iban, default_category_id)

source_document     (id, type, filename, storage_path, hash, imported_at, imported_by)

transaction         (id, date, amount, currency, description,
                     bank_account_id, counterparty_id, source_document_id,
                     classification_status, recurrence_type,
                     created_at, updated_at)

-- Classification
classification_rule (id, name, priority, conditions_json, 
                     target_category_id, target_vertical_id, target_cost_center_id,
                     active, created_by, created_at)

transaction_allocation (id, transaction_id,
                        cost_subcategory_id, business_vertical_id, 
                        cost_center_id, project_id, owner_id,
                        amount, percentage,
                        method, confidence, classified_by, classified_at)

-- Ownership
ownership_assignment (id, cost_category_id, user_id, role,
                      review_frequency, valid_from, valid_to)

-- Budget
budget_version      (id, name, fiscal_year, status, created_by, approved_by, created_at)
budget_line         (id, budget_version_id, cost_subcategory_id, 
                     business_vertical_id, cost_center_id,
                     period, amount, notes)

-- Forecast
forecast_version    (id, name, scenario_type, created_by, period_start, period_end, created_at)
forecast_line       (id, forecast_version_id, cost_subcategory_id,
                     business_vertical_id, cost_center_id,
                     period, amount, method, justification)

-- Collaboration
comment             (id, entity_type, entity_id, user_id, text, created_at)
approval            (id, entity_type, entity_id, user_id, status, comment, created_at)

-- Audit
audit_log           (id, user_id, action, entity_type, entity_id,
                     old_value_json, new_value_json, ip_address, created_at)

-- Auth
"user"              (id, email, name, role, active, created_at)
permission          (id, user_id, resource_type, resource_id, actions[])
```

### Key Indexes
```sql
CREATE INDEX idx_transaction_date ON transaction(date);
CREATE INDEX idx_transaction_account ON transaction(bank_account_id);
CREATE INDEX idx_transaction_status ON transaction(classification_status);
CREATE INDEX idx_allocation_category ON transaction_allocation(cost_subcategory_id);
CREATE INDEX idx_allocation_vertical ON transaction_allocation(business_vertical_id);
CREATE INDEX idx_allocation_period ON transaction_allocation(transaction_id, cost_subcategory_id);
CREATE INDEX idx_budget_version_year ON budget_line(budget_version_id, period);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
```

---

## Classification Rule Engine Detail

### Rule Condition Schema (JSON)
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

### Rule Evaluation Pipeline
```
Transaction arrives
     |
     v
Load rules ordered by priority (cached in Redis)
     |
     v
For each rule:
  - Evaluate conditions against transaction fields
  - If ALL conditions match:
      -> Apply: category, vertical, cost_center, owner, tags
      -> Stop (first-match-wins for single rules)
      -> Continue (for enrichment rules that add tags)
     |
     v
No rule matched?
  -> Status = "unclassified"
  -> Notify category-less review queue
  -> Suggest top 3 most likely categories (similarity scoring)
```

---

## Deployment Architecture

### Initial (Phase 1-2): Single Server
```
+----------------------------------------------------+
|  VPS / Cloud VM (4 vCPU, 16GB RAM, 200GB SSD)     |
|                                                     |
|  +-------------------+  +------------------------+ |
|  | Docker Compose    |  | Volumes                | |
|  |                   |  |  - pg_data             | |
|  |  - nginx          |  |  - redis_data          | |
|  |  - nextjs-app     |  |  - uploads             | |
|  |  - api-server     |  |  - backups             | |
|  |  - worker         |  +------------------------+ |
|  |  - postgres       |                             |
|  |  - redis          |  +------------------------+ |
|  |  - scheduler      |  | Cron                   | |
|  +-------------------+  |  - DB backup (daily)   | |
|                          |  - FGO sync (hourly)  | |
|                          |  - Bank sync (hourly) | |
|                          +------------------------+ |
+----------------------------------------------------+
```

### Production (Phase 3+): Scaled
```
+------------------+     +------------------+
| CDN              |     | Object Storage   |
| (CloudFlare)     |     | (S3 / MinIO)     |
+--------+---------+     +--------+---------+
         |                        |
+--------v---------+              |
| Load Balancer    |              |
+--------+---------+              |
         |                        |
   +-----+------+                 |
   |            |                 |
+--v---+  +----v--+  +-----------v---------+
| App  |  | App   |  | Worker Nodes (2+)   |
| Node |  | Node  |  | - Ingestion workers |
| (1)  |  | (2)   |  | - Classification    |
+--+---+  +--+----+  | - Aggregation       |
   |         |        | - Notifications     |
   +---------+        +---------+-----------+
         |                      |
   +-----v------+        +-----v------+
   | PostgreSQL  |        | Redis      |
   | (Primary +  |        | (Cluster)  |
   |  Replica)   |        +------------+
   +-------------+
```

---

## Security Architecture

### Authentication & Authorization
```
User Login
     |
     v
[Auth Provider (Keycloak/Auth0)]
     |
     +--> JWT Token (short-lived, 15 min)
     +--> Refresh Token (secure httpOnly cookie, 7 days)
     |
     v
[API Gateway]
     |
     +--> Verify JWT signature
     +--> Extract user_id, role, permissions[]
     +--> Check permission against requested resource
     |
     v
[Service Layer]
     |
     +--> Row-level security: user can only see/edit
          resources matching their role + assignments
```

### Data Security
- All data encrypted at rest (PostgreSQL TDE or volume encryption)
- All traffic encrypted in transit (TLS 1.3)
- Sensitive fields (IBAN, fiscal code) encrypted at application level
- Database credentials managed via environment variables / secrets manager
- Regular automated backups with encryption (daily, retained 30 days)
- IP allowlisting for production database access

---

## API Design (Key Endpoints)

```
# Transactions
GET    /api/transactions                    (list, filter, paginate)
GET    /api/transactions/:id                (detail with allocations)
POST   /api/transactions/import             (upload file for import)
POST   /api/transactions/:id/classify       (manual classification)
POST   /api/transactions/:id/split          (split across categories)
PATCH  /api/transactions/:id                (update metadata)

# Classification Rules
GET    /api/rules                           (list all rules)
POST   /api/rules                           (create rule)
PUT    /api/rules/:id                       (update rule)
POST   /api/rules/test                      (test rule against sample transactions)

# Budget
GET    /api/budgets                         (list versions)
POST   /api/budgets                         (create version)
GET    /api/budgets/:id/lines               (get all lines for a version)
PUT    /api/budgets/:id/lines               (bulk update lines)
POST   /api/budgets/:id/approve             (approve version)
POST   /api/budgets/:id/lock                (lock period)

# Forecast
GET    /api/forecasts                       (list versions)
POST   /api/forecasts/generate              (auto-generate from actuals)
PUT    /api/forecasts/:id/lines             (update with overrides)

# Reports
GET    /api/reports/bva                     (budget vs actual vs forecast)
GET    /api/reports/cashflow                (cash flow analysis)
GET    /api/reports/balances                (account balances)
GET    /api/reports/subscriptions           (subscription register)
GET    /api/reports/optimization            (cost optimization opportunities)

# Taxonomy
GET    /api/taxonomy                        (full tree)
POST   /api/taxonomy/categories             (add category)
PUT    /api/taxonomy/categories/:id         (update)

# Ownership
GET    /api/ownership                       (list assignments)
POST   /api/ownership                       (assign owner)

# Sync
POST   /api/sync/fgo                        (trigger FGO sync)
POST   /api/sync/bank/:id                   (trigger bank sync)
GET    /api/sync/status                     (last sync status per source)

# Dashboard
GET    /api/dashboard/executive             (KPIs for executive view)
GET    /api/dashboard/vertical/:id          (KPIs for a vertical)
GET    /api/dashboard/owner/:id             (KPIs for an owner)
```

---

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `sync-fgo` | Hourly | Pull latest transactions via FGO.ro (for accounts routed through FGO) |
| `sync-banks` | Hourly | Pull bank statements directly (for accounts bypassing FGO) |
| `classify-pending` | Every 15 minutes | Run classification on unclassified transactions |
| `recalc-aggregates` | Every 30 minutes | Recalculate period totals and deviations |
| `balance-snapshot` | Daily at 23:00 | Record end-of-day balance per account |
| `forecast-refresh` | Weekly (Monday 07:00) | Auto-refresh run-rate forecasts |
| `notification-digest` | Daily at 09:00 | Send daily digest to owners with pending items |
| `db-backup` | Daily at 02:00 | Full database backup to S3 |
| `audit-cleanup` | Monthly | Archive audit logs older than 2 years |
