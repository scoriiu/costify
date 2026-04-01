# RedSparQ Financial Control Platform

## Project Plan & Implementation Roadmap

**Client:** RedSparQ (23 employees, 3 business verticals)
**Prepared by:** Nisindo
**Date:** April 2026
**Version:** 1.0

---

## 1. Executive Summary

RedSparQ currently manages financial data across multiple Excel spreadsheets covering 3 business verticals (Outsourcing, Recruitment, Coworking) plus a consolidated view. The existing model tracks ~23 main cost categories with 98-116 subcategories per sheet, organized monthly with Budget/Forecast/Actual/Delta columns.

This project will replace the manual Excel-based workflow with a digital platform that provides:

- **Automatic transaction ingestion** from FGO.ro and bank accounts
- **Rule-based classification** of every transaction (expense tags, employee attribution, subscription tracking, utility categorization)
- **Real-time dashboards** with total balance, per-account balance, budget vs actual, and projections
- **Ownership & permissions** per cost category for the 23-person team
- **Invoice workflow** integrated with Saga for accountant submission
- **Forecast & optimization engine** for predictive cost management

---

## 2. Current State Analysis

### What RedSparQ Has Today
| Asset | Details |
|-------|---------|
| Financial model | Excel with 4 sheets (Consolidated, Outsourcing, Recruitment, Coworking) + Calendar |
| Cost taxonomy | 2-level: ~23 categories, 98-116 subcategories per vertical |
| Tracking | Monthly columns: Budget, FRC/Forecast, Actual, Delta |
| Banking | FGO.ro platform + multiple bank accounts |
| Invoicing | Saga for invoice submission to accountant |
| Team | 23 employees needing differentiated access |

### Pain Points
1. **Manual data entry** - transactions copied from bank statements into Excel
2. **No traceability** - cannot drill down from a category total to the source transaction
3. **Ownership ambiguity** - unclear who is responsible for reviewing which costs
4. **Stale forecasts** - reforecasting requires manual effort so it happens infrequently
5. **No automation** - subscriptions, recurring costs, and patterns are tracked by memory
6. **Version chaos** - multiple Excel versions, no audit trail, no approval workflow
7. **No real-time visibility** - balance and expense data is always days/weeks behind

---

## 3. Solution Overview

### Platform Name: **RedSparQ Financial Control**

A modular web application with 7 core systems:

```
+------------------------------------------------------------------+
|                    RedSparQ Financial Control                     |
+------------------------------------------------------------------+
|                                                                    |
|  [1. Data Ingestion]  -->  [2. Classification Engine]              |
|        |                          |                                |
|        v                          v                                |
|  [3. Transaction Store]  <-->  [4. Budget & Forecast]              |
|        |                          |                                |
|        v                          v                                |
|  [5. Ownership & RBAC]  <-->  [6. Reporting & Dashboards]          |
|        |                          |                                |
|        +--------->  [7. Integration Layer (Saga, FGO, Banks)]      |
|                                                                    |
+------------------------------------------------------------------+
```

---

## 4. Functional Modules

### 4.1 Data Ingestion Engine

**Purpose:** Automatically pull and normalize financial data from all sources.

#### Connectors
| Source | Method | Frequency |
|--------|--------|-----------|
| FGO.ro (aggregator) | API / scraping | Hourly |
| Bank accounts (direct, bypassing FGO) | Open Banking API / CSV import | Hourly |
| Saga | API integration | On invoice submission |
| Balante contabile / ERP | Import fisiere contabile (XLSX, CSV) | Monthly / on demand |
| Manual upload | XLSX, CSV, PDF parsing | On demand |

#### Processing Pipeline
1. **Pull** - Scheduled jobs fetch transactions from FGO/banks
2. **Normalize** - Map to unified schema: date, document, accounting code (cont contabil), counterparty, description, amount, currency, VAT, entity, vertical, location, cost center, project
3. **Deduplicate** - Hash-based detection prevents double-importing
4. **Enrich** - Look up counterparty details, extract keywords from descriptions
5. **Queue for classification** - Pass to the classification engine

### 4.2 Classification Engine

**Purpose:** Automatically tag and categorize every transaction using configurable rules.

#### Rule Types
| Rule Type | Example | Priority |
|-----------|---------|----------|
| IBAN match | `RO49BTRL...` -> "Rent - Coworking Unirii" | Highest |
| Vendor match | "VODAFONE" -> Subscription > Telecom | High |
| Keyword in description | "salariu" -> Personnel > Salaries | High |
| Amount range | 0-50 RON from POS -> Office > Petty Cash | Medium |
| Account + amount pattern | Recurring 299 EUR monthly -> Subscription > SaaS | Medium |
| Accounting code | 6xx -> Expense category mapping | Standard |
| TVA / VAT rate | 19% vs 9% vs exempt -> different handling | Standard |
| Location | Transactions from "Birou Unirii" vs "Birou Victoriei" | Standard |
| ML suggestion | Pattern-based classification (Phase 2) | Lowest |

#### Classification Axes (Multi-dimensional)
Every transaction gets classified on these axes simultaneously:
- **Cost nature**: Personnel, Subscription, Utility, Rent, Marketing, etc.
- **Business vertical**: Outsourcing / Recruitment / Coworking / Shared
- **Entity**: Legal entity (for multi-entity support)
- **Cost center**: Department or functional unit
- **Project / Initiative**: Optional project attribution
- **Owner**: The person responsible for this cost category
- **Recurrence**: One-time / Monthly / Quarterly / Annual
- **Employee**: For personnel-related costs, attributed to specific employee

#### Transaction Statuses
Each transaction follows a lifecycle: **Nou** (New) -> **Clasificat** (Classified) -> **In revizuire** (In Review) -> **Aprobat** (Approved) -> **Inchis** (Closed). Transactions can also be marked **Respins** (Rejected) at any review stage.

#### Transaction Markers
Transactions can be flagged as: recurring, exceptional, temporarily unallocable, or pending clarification.

#### Split Transactions
A single transaction can be split across multiple categories/cost centers:
- Example: Office rent split 40% Outsourcing / 30% Recruitment / 30% Coworking

### 4.3 Accounting & Balance System

**Purpose:** Provide a real-time consolidated financial picture.

#### Features
- **Total balance** across all bank accounts, updated automatically
- **Per-account balance** with transaction history
- **Cash flow tracking** - inflows vs outflows over time
- **Multi-currency support** (RON primary, EUR/USD secondary)
- **Account reconciliation** - match bank statement with internal records
- **Monthly close** - lock periods, prevent retroactive edits

#### Views
| View | Shows |
|------|-------|
| Treasury overview | All accounts, balances, 30-day trend |
| Account detail | Single account transactions with running balance |
| Cash flow | Daily/weekly/monthly in vs out |
| Consolidation | Across all entities and verticals |
| Location view | Costs broken down by physical location |

#### Consolidation & Inter-company
- Consolidation across 3+ business verticals + consolidated view (matching current Excel structure)
- Consolidation by legal entities, brands, locations, and business lines
- Inter-company allocation rules for shared services (e.g., IT costs split across verticals)
- Shared services cost distribution with configurable allocation percentages
- Automatic recalculation of all aggregated indicators after any reclassification or approval

### 4.4 Budget Management

**Purpose:** Define, version, and track budgets at any granularity level.

#### Budget Lifecycle
```
Draft --> Review --> Approved --> Locked
                        |
                        v
                   Revised (new version)
```

#### Capabilities
- Annual budgets broken down monthly, per vertical, per category
- Import initial budgets from existing Excel model
- Version history: Draft, Approved, Revised Q1, Revised Q2, etc.
- Budget templates for quick setup of next year
- Allocation rules for shared costs across verticals
- Approval workflow: Owner proposes -> Vertical Manager reviews -> CFO approves

### 4.5 Forecast & Projections

**Purpose:** Predict future costs and revenues based on actuals + adjustments.

#### Forecast Methods
| Method | Description |
|--------|-------------|
| Run-rate | Last N months average projected forward |
| Seasonality | Same-month-last-year with growth factor |
| Moving average | Weighted average of last 3/6/12 months |
| Commitment-based | Known contracts + recurring payments |
| Manual override | Owner adjusts with justification |

#### Scenarios
- **Base case**: Most likely outcome based on current trends
- **Conservative**: Assume higher costs, lower revenue
- **Stretch**: Best-case optimization scenario
- **Custom**: User-defined scenarios for specific analysis

#### Optimization Engine
- Identify subscriptions that can be consolidated or cancelled
- Flag duplicate vendor payments
- Detect cost anomalies (sudden spikes)
- Suggest renegotiation opportunities based on spend volume
- Track commitment vs actual usage for subscriptions

### 4.6 Ownership & Access Control

**Purpose:** Every cost category has a clear owner with specific permissions.

#### Role Matrix
| Role | See | Edit | Approve | Admin |
|------|-----|------|---------|-------|
| Administrator | Everything | Everything | Everything | Yes |
| CFO / Finance Manager | All verticals consolidated | Budgets, forecasts | Close periods, approve budgets | Partial |
| Vertical Manager | Own vertical only | Own vertical costs | Own vertical budgets | No |
| Category Owner | Assigned categories | Classify, comment, forecast | Propose changes | No |
| Back-office / Accounting | All transactions | Import, reconcile | Confirm classifications | No |
| Auditor | Everything (read-only) | Nothing | Nothing | No |

#### Ownership Features
- Primary + backup owner per category
- Ownership is versioned (track who owned what, when)
- Notification system: alerts for unclassified costs, budget deviations, forecast windows
- Configurable review frequency per category: weekly / bi-weekly / monthly / quarterly

#### Operational Calendar
Replicates the existing Excel "Calendar" sheet as a digital system:
- Defines forecast/reforecast windows per category (when owners must submit updates)
- Schedules monthly review cycles with deadlines
- Tracks reporting frequency per category (weekly, bi-weekly, monthly, quarterly, annual)
- Sends automated reminders before each deadline
- Shows a consolidated calendar view of all upcoming financial operations

### 4.7 Integrations

#### FGO.ro Integration (Primary Path)
- FGO.ro acts as an aggregator that connects to the banks on RedSparQ's behalf
- Pull all transactions automatically via API or structured scraping
- Sync account balances hourly
- Map FGO categories to RedSparQ taxonomy

#### Direct Bank Integration (Alternative Path, bypassing FGO)
- Where FGO is insufficient or we want faster/richer data, connect directly to banks
- Direct bank feeds via Open Banking API where available
- Fallback: scheduled import of bank statement files (CSV/XLSX/MT940)
- Support for multiple banks and accounts
- The system supports **either** path per account: FGO or direct bank, not both simultaneously for the same account (to avoid duplicates)

#### Trial Balance / ERP Integration
- Import trial balances (balante contabile) from accounting software or ERP
- Map accounting codes to cost taxonomy
- Reconcile trial balance entries with bank transactions
- Support for auxiliary accounting files

#### Saga Integration
- Push classified invoices to Saga
- Send invoice data to accountant automatically
- Sync invoice status back into the platform

#### Export Capabilities
- Excel export matching the existing 4-sheet format (for transition period)
- PDF reports for management
- API for BI tools (Power BI, Tableau, Metabase)

---

## 5. Reporting & Dashboards

### Executive Dashboard
- Total balance (all accounts)
- Monthly burn rate
- Budget vs Actual vs Forecast (current month + YTD)
- Top 5 cost categories by deviation
- Unclassified transactions count
- Cash runway projection

### Vertical Dashboard (per vertical: Outsourcing, Recruitment, Coworking)
- Vertical P&L summary
- Category breakdown with owner names
- Month-over-month trends
- Budget utilization percentage
- Forecast accuracy tracking

### Owner Dashboard
- My categories: actual vs budget this month
- Unclassified transactions in my area
- Pending approvals
- Forecast submission status
- Comments requiring my response

### Operational Reports
| Report | Frequency | Audience |
|--------|-----------|----------|
| Budget vs Forecast vs Actual | Monthly | CFO, Vertical Managers |
| Cost breakdown by vertical | Monthly | Management |
| Subscription register | Monthly | Operations |
| Personnel cost per employee | Monthly | HR, Finance |
| Unclassified transactions | Weekly | Back-office |
| Vendor spend analysis | Quarterly | Procurement |
| Cost optimization opportunities | Monthly | CFO |
| Audit trail log | On demand | Auditors |

---

## 6. Technical Architecture

### Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js + React + TailwindCSS | Fast, modern, excellent DX |
| Backend API | Node.js (Fastify) or Go | High performance, API-first |
| Database | PostgreSQL | Relational integrity, JSON support, proven at scale |
| Cache | Redis | Session management, real-time aggregations |
| Job queue | BullMQ (Redis-backed) | Scheduled imports, classification jobs |
| File storage | S3-compatible (MinIO or AWS S3) | Source documents, bank statements |
| Auth | Keycloak or Auth0 | RBAC, SSO-ready, audit logging |
| Deployment | Docker + Docker Compose (initially) | Simple ops for 23-user company |
| Monitoring | Grafana + Prometheus | Observability |

### Data Model (Core Entities)
```
Transaction
  - id, date, amount, currency, description
  - bank_account_id, counterparty_id, source_document_id
  - classification_status, recurrence_type

ClassificationRule
  - id, name, priority, conditions (JSON), target_category_id
  - created_by, active

CostCategory (hierarchical)
  - id, parent_id, name, level (group/category/subcategory/analytic)
  - business_vertical_id, cost_center_id

OwnershipAssignment
  - id, cost_category_id, user_id, role (primary/backup)
  - valid_from, valid_to

BudgetVersion
  - id, name, status (draft/approved/revised), fiscal_year, approved_by

BudgetLine
  - id, budget_version_id, cost_category_id, period (month)
  - amount, notes

ForecastVersion
  - id, name, scenario_type, created_by, period_start, period_end

ForecastLine
  - id, forecast_version_id, cost_category_id, period
  - amount, method, justification

BankAccount
  - id, bank_name, account_number, iban, currency, current_balance

AuditLog
  - id, user_id, action, entity_type, entity_id
  - old_value, new_value, timestamp
```

### Integration Architecture
```
[FGO.ro] ---API/Scrape---> [Ingestion Workers] ---> [PostgreSQL]
[Banks]  ---OpenBanking---> [Ingestion Workers] ---> [PostgreSQL]
[Manual CSV/XLSX] --------> [Import Service]   ---> [PostgreSQL]

[PostgreSQL] <--- [Classification Engine] (BullMQ workers)
[PostgreSQL] ---> [API Layer] ---> [Next.js Frontend]
[PostgreSQL] ---> [Saga Export Service] ---> [Saga / Accountant]
```

---

## 7. Implementation Roadmap

### Phase 0: Discovery & Setup (Weeks 1-2)
- [ ] Transpose Excel taxonomy into database schema
- [ ] Define all classification rules from current manual practice
- [ ] Map FGO.ro API capabilities and bank account access
- [ ] Set up development environment, CI/CD pipeline
- [ ] Import 3-6 months of historical data for validation

**Deliverable:** Validated data model, complete cost taxonomy, integration assessment

### Phase 1: MVP - Core Platform (Weeks 3-8)
- [ ] Bank statement import (CSV/XLSX) + FGO.ro automated pull
- [ ] Transaction store with normalization and deduplication
- [ ] 4-level cost taxonomy: group, category, subcategory, analytic attribute (configurable)
- [ ] Manual classification + basic auto-classification rules
- [ ] Ownership assignment per category
- [ ] Annual budget definition per category and vertical
- [ ] Monthly forecast (simple run-rate)
- [ ] Budget vs Forecast vs Actual report
- [ ] Drill-down from aggregated report to individual transaction
- [ ] Consolidated view + 3 vertical views
- [ ] Comments on transactions and categories
- [ ] Audit trail for all changes
- [ ] Role-based access (6 roles)

**Deliverable:** Working platform with real data, replacing core Excel workflow

### Phase 2: Automation & Intelligence (Weeks 9-14)
- [ ] Real-time bank balance sync (Open Banking where available)
- [ ] Advanced classification rules (IBAN + vendor + keyword combos)
- [ ] Transaction split across categories/cost centers
- [ ] Forecast scenarios (Base, Conservative, Stretch)
- [ ] Advanced forecast methods (seasonality, moving average)
- [ ] Subscription tracking module
- [ ] Personnel cost attribution per employee
- [ ] Saga integration for invoice workflow
- [ ] Budget approval workflow (propose -> review -> approve)
- [ ] Email/in-app notifications for owners
- [ ] Cost optimization suggestions
- [ ] Period close and lock mechanism

**Deliverable:** Fully automated financial control platform

### Phase 3: Advanced Reporting & Scale (Weeks 15-20)
- [ ] Custom report builder
- [ ] Executive dashboard with KPIs
- [ ] Cost optimization engine with recommendations
- [ ] ML-assisted classification suggestions
- [ ] Multi-level approval workflows
- [ ] Advanced alerting (threshold-based, anomaly detection)
- [ ] API for BI tool integration
- [ ] Multi-currency support
- [ ] Mobile-responsive dashboards

**Deliverable:** Enterprise-grade financial management system

---

## 8. Migration Plan (Excel to Platform)

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Import cost taxonomy from Excel (23 categories, 98-116 subcategories) | Week 1 |
| 2 | Import historical bank transactions (6 months) | Week 2 |
| 3 | Configure classification rules matching current manual practice | Week 2-3 |
| 4 | Set up ownership assignments matching existing Excel owners | Week 3 |
| 5 | Import current year budgets | Week 3 |
| 6 | Run parallel: Excel + Platform for 1 month | Week 6-9 |
| 7 | Validate: Platform results match Excel for the parallel period | Week 9-10 |
| 8 | Go live: Platform becomes primary, Excel for backup only | Week 11 |
| 9 | Full cutover: Excel retired | Week 15+ |

---

## 9. Success Criteria

| Metric | Target |
|--------|--------|
| Transaction classification rate | >90% auto-classified within 24h |
| Data freshness | Balance data < 1 hour old |
| Budget vs Actual visibility | Real-time, no manual intervention |
| Forecast accuracy | Within 10% of actual by month-end |
| Time to close monthly books | < 2 business days (vs current ~1 week) |
| Unclassified transactions | < 5% at any given time |
| Audit trail coverage | 100% of changes tracked |
| User adoption | All 23 employees active within 30 days of launch |

---

## 10. Effort Estimation

| Phase | Duration | Team |
|-------|----------|------|
| Phase 0: Discovery | 2 weeks | 1 architect + 1 analyst |
| Phase 1: MVP | 6 weeks | 2 full-stack devs + 1 designer |
| Phase 2: Automation | 6 weeks | 2 full-stack devs + 1 integration specialist |
| Phase 3: Advanced | 6 weeks | 2 full-stack devs |
| **Total** | **20 weeks** | |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| FGO.ro has no public API | Cannot auto-pull transactions | Build browser automation / scraping fallback |
| Bank doesn't support Open Banking | Manual import required | Scheduled CSV import with notification reminders |
| Classification rules don't cover edge cases | Unclassified transactions pile up | "Review queue" with bulk-action UI for fast manual classification |
| Team resistance to new tool | Low adoption | Parallel run period, training sessions, show immediate value |
| Historical data inconsistency | Migration errors | Validation step comparing platform totals to Excel totals |

---

## 12. Appendix: Cost Category Taxonomy (from Excel model)

The existing Excel model uses approximately 23 main categories across each vertical. These will be imported as the initial taxonomy and can be extended:

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

*Full taxonomy to be finalized during Phase 0 based on the raport_3_verticale.xlsx analysis.*
