# Costify — Product Plan & Implementation Roadmap

**Product:** Costify — Financial Control Platform
**Built by:** Nisindo
**Date:** April 2026
**Version:** 2.0

---

## 1. Executive Summary

Costify is a multi-tenant SaaS platform for financial control. It targets accountants and finance managers who manage multiple client organizations — each with their own bank accounts, cost structures, budgets, and reports.

The platform replaces Excel-based financial workflows with an automated pipeline that ingests transactions from bank accounts (via FGO.ro or direct bank APIs), classifies them using configurable rules, writes them to an immutable journal, computes balances, and feeds downstream systems (budgets, reports, Saga integration).

Every stage of the pipeline is audited. Every data change is traceable from source to report.

### Core Value Proposition

- **For accountants**: Manage 1000+ clients from one platform. Automated bank feeds, classification, and Saga export eliminate manual data entry.
- **For finance managers**: Real-time visibility into costs, budgets vs actuals, cash flow, and forecasts — across multiple business verticals.
- **For business owners**: Know exactly where money goes, who is responsible, and whether you're on budget — without waiting for month-end reports.

---

## 2. Target Market

### Primary Segment

Accountants and accounting firms managing multiple client companies. Romania-first (FGO.ro, Saga integration, Romanian banking), expandable to EU.

| Characteristic | Detail |
|---------------|--------|
| User type | Accountant / finance manager |
| Clients per user | 50-2000+ companies |
| Company size (client) | 5-200 employees |
| Current tools | Excel, FGO.ro, Saga, manual bank statement processing |
| Pain | Manual data entry, no real-time visibility, no audit trail, version chaos |

### Secondary Segment

SMBs (10-200 employees) with multiple business lines/cost centers who manage their own finances and outgrew Excel but don't need SAP/Oracle.

---

## 3. Current State (Problem)

### What exists today (typical client)

| Asset | Details |
|-------|---------|
| Financial model | Excel with multiple sheets per business vertical + consolidated view |
| Cost taxonomy | 2-level: ~23 categories, 100+ subcategories per vertical |
| Tracking | Monthly columns: Budget, Forecast, Actual, Delta |
| Banking | FGO.ro platform + multiple bank accounts (BT, ING, etc.) |
| Invoicing | Saga for invoice submission to accountant |
| Team | 10-50 employees needing differentiated access |

### Pain Points

1. **Manual data entry** — transactions copied from bank statements into Excel
2. **No traceability** — cannot drill down from a category total to the source transaction
3. **Ownership ambiguity** — unclear who is responsible for reviewing which costs
4. **Stale forecasts** — reforecasting requires manual effort, happens infrequently
5. **No automation** — subscriptions, recurring costs, and patterns tracked by memory
6. **Version chaos** — multiple Excel versions, no audit trail, no approval workflow
7. **No real-time visibility** — balance and expense data is always days/weeks behind
8. **Scale limitation** — an accountant managing 100+ clients cannot maintain Excel models for all of them

---

## 4. Solution: The Costify Pipeline

Data flows through a strict, audited pipeline. No stage can be skipped.

```
SOURCES → INGEST → NORMALIZE → CLASSIFY → JOURNAL → BALANCES → OUTER SYSTEMS
                                                         │
                                                    ┌────┴────┐
                                              ┌─────┤ BALANCES├─────┐
                                              │     └─────────┘     │
                                         ┌────▼───┐          ┌─────▼─────┐
                                         │BUDGET &│          │REPORTS &  │
                                         │FORECAST│          │DASHBOARDS │
                                         └────────┘          └───────────┘
```

Every stage produces audit records → complete traceability from raw bank data to final report.

---

## 5. Functional Modules

### 5.1 Source Management

Users define data sources per client organization. Each bank account maps to exactly one source.

| Source Type | Method | Frequency |
|------------|--------|-----------|
| FGO.ro (aggregator) | API / structured scraping | Hourly |
| Direct bank (bypassing FGO) | Open Banking API | Hourly |
| CSV/XLSX upload | File parse | On demand |
| Saga | API webhook | On invoice |
| ERP / Trial balance | File import | Monthly / on demand |

**Constraint**: One bank account = one active source. FGO or direct bank, never both (prevents duplicates).

### 5.2 Ingestion & Normalization

- Fetch raw data, store as-is (immutable source record)
- Parse format (CSV, XLSX, MT940, JSON, PDF)
- Map to unified transaction schema
- Compute deduplication hash, reject duplicates
- Enrich: counterparty lookup, keyword extraction
- **Audit at every step**

### 5.3 Classification Engine

Configurable rule engine that auto-classifies transactions on multiple axes simultaneously:

| Axis | Examples |
|------|---------|
| Cost category | Personnel > Salaries, Technology > SaaS |
| Business vertical | Outsourcing, Recruitment, Coworking |
| Cost center | Department, location |
| Owner | Person responsible for this cost |
| Recurrence | One-time, monthly, quarterly, annual |

#### Rule types (by priority)

1. IBAN match → highest confidence
2. Vendor/counterparty match
3. Keyword in description
4. Amount range + account pattern
5. Accounting code mapping
6. ML suggestion (future)

#### Split transactions

A single transaction can be split across multiple categories/verticals/cost centers with amount or percentage allocation.

#### Confidence scoring

Each classification gets a confidence score (0-100). Above threshold: auto-classified. Below: routed to review queue.

### 5.4 Immutable Journal

The journal is the single source of truth. Append-only — corrections create new entries, never mutate existing ones.

- Sequential journal numbers per tenant (gap-free for compliance)
- Each entry links back to: source record, normalized transaction, classification rule, allocations
- Full audit trail on every entry

### 5.5 Balances

- Total balance across all accounts (real-time)
- Per-account balance with transaction history
- Balance snapshots (point-in-time, immutable)
- Cash flow tracking: inflows vs outflows over time
- Multi-currency support (RON primary, EUR/USD secondary)
- User-facing transaction log with running balances, filters, search, drill-down

### 5.6 Budget & Forecast

#### Budget lifecycle
```
Draft → Review → Approved → Locked
                    │
                    ▼
              Revised (new version, old preserved)
```

- Annual budgets broken down monthly, per vertical, per category
- Import from Excel or create from scratch
- Version history preserved
- Approval workflow: Owner → Manager → CFO/Admin
- Allocation rules for shared costs across verticals

#### Forecast methods

| Method | Description |
|--------|-------------|
| Run-rate | Last N months average projected forward |
| Seasonality | Same-month-last-year with growth factor |
| Moving average | Weighted average of last 3/6/12 months |
| Commitment-based | Known contracts + recurring payments |
| Manual override | Owner adjusts with justification |

#### Scenarios

Base case, Conservative, Stretch, Custom

### 5.7 Ownership & Access Control

Multi-level RBAC:

| Role | Scope | Permissions |
|------|-------|-------------|
| Platform Admin | System-wide | Everything |
| Account Owner | All their client orgs | Full management |
| Org Admin | One client org | Full access within tenant |
| Org Manager | Vertical/department | Manage their scope |
| Org Member | Assigned categories | Classify, comment, forecast |
| Org Viewer | Read-only | Auditors, consultants |

- Primary + backup owner per cost category
- Ownership is versioned (who owned what, when)
- Notification system for unclassified costs, budget deviations, deadlines

### 5.8 Integrations

#### FGO.ro (primary bank aggregator path)
- Pulls all transactions via API or structured scraping
- Syncs account balances hourly

#### Direct Bank APIs (alternative path, bypassing FGO)
- Open Banking API where available
- Fallback: scheduled file import (CSV/XLSX/MT940)

#### Saga (accountant workflow)
- Push classified invoices to Saga
- Sync invoice status back

#### Export
- Excel export (matching existing multi-sheet format for migration)
- PDF reports
- API for BI tools (Power BI, Tableau, Metabase)

### 5.9 Audit System

Not a module — a cross-cutting concern woven into every pipeline stage.

- Every state change produces an audit record
- Audit records are append-only, never modified or deleted
- Include before/after state, actor, pipeline stage, metadata
- SHA-256 checksum on each record for tamper detection
- Queryable: trace any transaction from raw ingestion to final report
- Minimum 10-year retention (Romanian fiscal law)

---

## 6. Reporting & Dashboards

### Executive Dashboard
- Total balance (all accounts)
- Monthly burn rate
- Budget vs Actual vs Forecast (current month + YTD)
- Top cost categories by deviation
- Unclassified transactions count
- Cash runway projection

### Vertical Dashboard
- Vertical P&L summary
- Category breakdown with owner names
- Month-over-month trends
- Budget utilization percentage

### Owner Dashboard
- My categories: actual vs budget this month
- Unclassified transactions in my area
- Pending approvals
- Forecast submission status

### Operational Reports

| Report | Frequency | Audience |
|--------|-----------|----------|
| Budget vs Forecast vs Actual | Monthly | CFO, Managers |
| Cost breakdown by vertical | Monthly | Management |
| Subscription register | Monthly | Operations |
| Personnel cost per employee | Monthly | HR, Finance |
| Unclassified transactions | Weekly | Back-office |
| Vendor spend analysis | Quarterly | Procurement |
| Full audit trail | On demand | Auditors |

---

## 7. Technical Architecture

See `architecture.md` for full detail. Summary:

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Frontend | Next.js 15 + React 19 + TailwindCSS |
| Backend API | Fastify |
| Database | PostgreSQL 16 (RLS, partitioned) |
| Cache | Redis 7 |
| Job Queue | BullMQ |
| Auth | Keycloak or Auth.js + MFA |
| File Storage | S3-compatible |
| Testing | Vitest + Supertest + Playwright |
| Security | Semgrep + Trivy + Gitleaks + OWASP ZAP |
| CI/CD | GitHub Actions |
| Deployment | Docker, Kubernetes-ready |

---

## 8. Implementation Roadmap

### Phase 0: Discovery & Foundation (Weeks 1-3)

- [ ] Finalize multi-tenant data model and schema
- [ ] Set up project: Next.js + Fastify + PostgreSQL + Redis + BullMQ
- [ ] Implement tenant isolation (RLS policies, middleware)
- [ ] Implement auth: registration, login, MFA, JWT, refresh tokens
- [ ] Set up CI pipeline: lint → typecheck → unit → integration → e2e → ui → security
- [ ] Import sample cost taxonomy from existing client Excel models
- [ ] Assess FGO.ro API capabilities and direct bank access
- [ ] Set up audit system (append-only table, checksum computation)

**Deliverable:** Running skeleton with auth, tenant isolation, audit, and CI pipeline. All verified by tests.

### Phase 1: Core Pipeline (Weeks 4-10)

- [ ] Source management UI (add/configure bank sources per client org)
- [ ] Ingestion workers: FGO.ro connector, direct bank connector, CSV/XLSX import
- [ ] Normalization and deduplication
- [ ] Classification rule engine with confidence scoring
- [ ] Split transaction support
- [ ] Immutable journal with sequential numbering
- [ ] Balance computation: total, per-account, snapshots
- [ ] Transaction log UI: list, filter, search, drill-down
- [ ] Manual classification UI
- [ ] Cost taxonomy management (groups, categories, subcategories)
- [ ] Ownership assignment per category
- [ ] Basic Budget vs Actual report
- [ ] Audit trail at every pipeline stage

**Deliverable:** Working pipeline from bank feed to classified journal to balances. Replaces core Excel workflow.

### Phase 2: Budget, Forecast & Workflows (Weeks 11-16)

- [ ] Budget version lifecycle: Draft → Review → Approved → Locked
- [ ] Budget editor UI (grid, inline editing, Excel import)
- [ ] Forecast engine (run-rate, seasonality, moving average, commitment)
- [ ] Forecast scenarios (base, conservative, stretch)
- [ ] Approval workflows (propose → review → approve)
- [ ] Saga integration (push classified invoices, sync status)
- [ ] Notification system (email + in-app)
- [ ] Period close and lock mechanism
- [ ] Executive dashboard with KPIs
- [ ] Vertical and Owner dashboards

**Deliverable:** Full budgeting and forecasting. Saga integration. Real-time dashboards.

### Phase 3: Scale, Intelligence & Polish (Weeks 17-24)

- [ ] Custom report builder
- [ ] ML-assisted classification suggestions
- [ ] Cost optimization engine (duplicate detection, anomaly flagging)
- [ ] Subscription tracking module
- [ ] Multi-currency support
- [ ] Mobile-responsive UI
- [ ] API for BI tool integration
- [ ] Advanced alerting (threshold-based, anomaly detection)
- [ ] Performance optimization for 1000+ tenants per user
- [ ] Horizontal scaling: worker auto-scaling, read replicas, connection pooling
- [ ] Penetration testing and security hardening

**Deliverable:** Production-ready SaaS platform at scale.

---

## 9. Migration Plan (for existing Excel-based clients)

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Create client organization in Costify | Day 1 |
| 2 | Import cost taxonomy from their Excel model | Day 1 |
| 3 | Connect bank accounts (FGO or direct) | Day 1-2 |
| 4 | Configure classification rules from their current practice | Week 1 |
| 5 | Import 3-6 months of historical transactions | Week 1 |
| 6 | Set up ownership assignments | Week 1 |
| 7 | Import current year budgets | Week 1-2 |
| 8 | Parallel run: Excel + Costify for 1 month | Week 2-5 |
| 9 | Validate: Costify results match Excel for the parallel period | Week 5 |
| 10 | Go live: Costify becomes primary | Week 6 |

---

## 10. Success Criteria

| Metric | Target |
|--------|--------|
| Transaction auto-classification rate | >90% within 24h |
| Data freshness | Balance data < 1 hour old |
| Budget vs Actual visibility | Real-time, no manual intervention |
| Forecast accuracy | Within 10% of actual by month-end |
| Monthly close time | < 2 business days |
| Unclassified transactions | < 5% at any time |
| Audit trail coverage | 100% of changes tracked |
| API response time (p95) | < 200ms |
| System uptime | 99.9% |
| Tenants per platform user | 1000+ supported |

---

## 11. Scale Targets

| Metric | Target |
|--------|--------|
| Concurrent platform users | 10,000+ |
| Client organizations per user | 1,000+ |
| Transactions per client/month | 10,000+ |
| Total transactions in system | 100M+ |
| Ingestion throughput | 50,000 txns/minute |
| Balance recalc latency | < 5 seconds |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| FGO.ro has no public API | Cannot auto-pull transactions | Browser automation / scraping fallback + direct bank path |
| Bank doesn't support Open Banking | Manual import required | Scheduled CSV import with reminders |
| Classification rules don't cover edge cases | Unclassified pile-up | Review queue with bulk-action UI |
| Multi-tenant data leak | Critical — financial data exposure | RLS at DB level + integration tests on every PR |
| Audit record tampering | Compliance failure | SHA-256 checksums + daily verification job |
| Scale bottleneck at PostgreSQL | Slow queries for large tenants | Partitioning by tenant + date, read replicas, connection pooling |
| Team resistance to new tool | Low adoption | Parallel run period, training, show immediate value |

---

## 13. Appendix: Sample Cost Category Taxonomy

Based on analysis of real client Excel models:

**Personnel**: Salaries, Bonuses, Benefits, Social contributions, Training
**Rent & Facilities**: Office rent, Utilities, Maintenance, Cleaning, Security
**Technology**: SaaS subscriptions, Hardware, Cloud infrastructure, Licenses
**Marketing**: Digital advertising, Events, Content, PR, Sponsorships
**Professional Services**: Legal, Audit, Consulting, Outsourced services
**Travel & Entertainment**: Travel, Accommodation, Meals, Client entertainment
**Office**: Supplies, Equipment, Courier, Printing
**Insurance**: Business insurance, Fleet insurance, Health insurance
**Financial**: Bank fees, Interest, FX costs, Payment processing
**Other**: Miscellaneous, One-time costs, Inter-company allocations

*Taxonomy is fully configurable per tenant. Imported from client's existing structure during onboarding.*
