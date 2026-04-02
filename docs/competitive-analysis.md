# Costify — Competitive Analysis & Product Roadmap

**Date:** April 2026
**Prepared by:** Nisindo

---

## 1. The Romanian Financial Software Market

The Romanian market for business financial software is fragmented into narrow, single-purpose tools. No player owns the full stack from invoicing to management intelligence. This is our opportunity.

### Market Size Context
- ~1.1M active companies in Romania (ONRC 2025)
- ~60,000 active accounting firms/freelance accountants
- SmartBill claims 170,000 clients
- Oblio claims 150,000+ users
- Saga is the legacy incumbent used by the majority of accounting cabinets
- Keez has 8,500+ clients (service model)
- Total addressable: every Romanian SRL, PFA, II, IF that does business

---

## 2. Competitor Deep Dive

### 2.1 Saga (sagasoft.ro)

**What they are:** The legacy king of Romanian accounting software. Desktop-first, recently launched Saga Web. Used by the majority of accounting cabinets.

**Products:**
- **Saga C** — Double-entry bookkeeping (partida dubla) for SRLs, NGOs, accounting cabinets
- **Saga PS** — Single-entry bookkeeping (partida simpla) for PFA, II, IF
- **Saga Web** — Cloud version of Saga C and PS (browser-based)
- **Saga Facturare** — Mobile invoicing app (iOS/Android, Saga Web users only)
- **factura.ro** — Simplified web invoicing
- **MarketLine** — POS extension for retail
- **PubLine** — POS extension for HoReCa (restaurants, bars, hotels)
- **Declaratii ANAF** — Fiscal declaration submission to ANAF

**Core capabilities:**
- Full chart of accounts (plan de conturi)
- Double/single entry bookkeeping
- Bank statement import
- Inventory management (evidenta stocuri)
- Payroll (salarizare)
- e-Factura (electronic invoicing via ANAF SPV)
- e-Transport
- SAF-T / D406 reporting
- REGES (employee registry)
- Intrastat (EU trade reporting)
- Multi-user with configurable access in Web version
- Data migration from desktop to web

**Pricing:**
| Package | Desktop licenses | Web licenses (CUIs) | Price/year |
|---------|-----------------|--------------------|-----------:|
| Saga Web 3 | 1 | 3 | 600 RON |
| Saga Web 10 | 1 | 10 | 1,200 RON |
| Saga Web 20 | 1 | 20 | 1,800 RON |
| Saga Web 50 | 1 | 50 | 2,500 RON |
| Saga Web 1 (no desktop) | 0 | 1 | 500 RON |

**What they do well:**
- Complete accounting engine trusted by thousands of accountants over 20+ years
- Legislative compliance is fast — they update quickly when tax laws change
- Strong community: active forum, blog with fiscal updates, video tutorials
- The accountant knows Saga deeply — muscle memory, workflows, shortcuts
- Affordable pricing for multi-company management
- Saga Web brings cloud access + team collaboration

**What they do poorly:**
- Desktop-first DNA — Saga Web is a port, not a rethink
- UI/UX is functional but dated — built for accountants, hostile to entrepreneurs
- No management dashboards, no analytics, no business intelligence
- No budgeting, no forecasting, no cost control
- No automatic bank feeds (just manual import of statements)
- No cost classification engine or rule-based automation
- No real-time visibility — you see numbers after the accountant processes them
- No treasury management, no cash flow forecasting
- The entrepreneur gets zero value from Saga directly — it's a black box operated by the accountant
- No API for third-party integrations (closed ecosystem)
- Mobile app is invoicing-only

---

### 2.2 SmartBill (smartbill.ro)

**What they are:** The market leader in online invoicing. Modern, cloud-native, excellent UX. Part of Visma Group (Norwegian).

**Products:**
- **SmartBill Facturare** — Online invoicing (their core)
- **SmartBill Gestiune** — Inventory management + invoicing
- **SmartBill Conta** — Accounting module (double-entry bookkeeping)
- **SmartBill POS** — Point of sale with fiscal receipt
- **ManagerConta** — For accountants managing multiple client companies
- **Mobile apps** — iOS and Android

**Core capabilities:**
- Invoice creation, delivery, collection
- e-Factura (send/receive via ANAF SPV) — automated, bulk, or manual
- e-Transport
- SAF-T / D406
- Proforma invoices, advance invoices, credit notes
- Stock management (NIR, inventory, transfers)
- Basic accounting (chart of accounts, journal entries, trial balance)
- Multiple users with different access rights
- eCommerce integrations (WooCommerce, Shopify, PrestaShop, OpenCart)
- API for third-party integrations
- Payment processing integration
- Fiscal receipt printing (casa de marcat)
- 170,000 clients, 6.9M invoices/month, €48B invoiced/year

**Pricing:** Tiered plans (Silver, Gold, Platinum). Free for 12 months for newly registered companies. Specific pricing not publicly listed on main page.

**What they do well:**
- Best UX in the Romanian market — clean, modern, intuitive
- Cloud-native from day one — no legacy desktop baggage
- Strong mobile apps
- Excellent e-Factura integration (99.9% validation rate)
- Rich API and eCommerce integrations
- Good accounting module (SmartBill Conta) that bridges invoicing and bookkeeping
- Strong brand, strong community, podcasts, educational content
- Part of Visma — financial stability, Norwegian engineering culture
- ManagerConta gives accountants multi-company management

**What they do poorly:**
- Invoicing-centric — everything revolves around the invoice, not the business
- No management layer for the entrepreneur
- No budgeting, no forecasting, no cost control
- No automatic bank feeds or transaction classification
- No treasury management or cash flow forecasting
- No multi-vertical cost allocation
- No ownership/responsibility assignment for costs
- Reports are basic (sales, collections, unpaid invoices, profit per product)
- No real-time financial dashboard with KPIs
- No audit trail beyond basic document history
- Pricing becomes expensive at scale for accountants managing many companies

---

### 2.3 Oblio (oblio.eu)

**What they are:** The aggressive challenger in invoicing. Cloud-native, very affordable, loved for simplicity.

**Products:**
- **Oblio Facturare** — Online invoicing
- **Oblio Stocuri** — Inventory + production/manufacturing (BOM/recipes)
- **Oblio Wallet** — Auto-transfer invoice data between Oblio users
- **Bizoo.ro** — Customer review collection platform

**Core capabilities:**
- Invoice creation and delivery
- e-Factura, e-Transport, SAF-T
- NIR (reception notes) — automatic from supplier invoices
- Stock management with production module (recipes/BOM)
- Fiscal receipt printing
- Integration with Saga, WinMentor, Ciel for accounting data export
- API + WooCommerce, PrestaShop, OpenCart, Shopify, eMag plugins
- Multi-company, multi-user, unlimited — all in one price

**Pricing:**
- **Free forever** if ≤3 documents/month
- **29 EUR/year** for unlimited everything — this is their killer move
- Free for first year for new users

**What they do well:**
- Insanely cheap — 29 EUR/year for unlimited use
- Very simple and intuitive UI
- Strong inventory + production module (unique at this price point)
- Good integrations with existing accounting software (Saga, WinMentor, Ciel)
- Oblio Wallet concept — invoice data flows between users automatically
- e-Factura integration is fast and simple
- 150K+ users and growing fast

**What they do poorly:**
- No accounting engine (deliberate — they say "your accountant uses what they like")
- No management layer whatsoever
- No bank feeds, no transaction classification
- No budgeting, forecasting, cost control
- No dashboards beyond basic sales reports
- No payroll
- Limited reporting (sales, stock, basic profit per product)
- At 29 EUR/year, the business model question is: how do they sustain R&D?
- No mobile-native app (PWA only)

---

### 2.4 Keez (keez.ro)

**What they are:** Not a software company — a service company with software. They sell "contabil + aplicatie" (accountant + app). Part of Visma Group.

**Products:**
- **Keez platform** — Web + mobile app for document management, invoicing, reports
- **Contabilitate** — Full accounting service (they assign you a CECCAR-certified expert)
- **Salarizare** — Payroll service
- **Facturare** — Invoicing from app
- **Gestiune** — Inventory management

**Core capabilities:**
- Dedicated accountant assigned to your company
- Digital document collection (no more "sacosa cu facturi")
- Real-time accounting (not monthly — this is their differentiation)
- P&L in real time
- e-Factura — integrated natively, auto-submission
- SAF-T
- SPV integration (ANAF digital mailbox)
- Salarizare included
- Gestiune included
- Company formation services (SRL, PFA)
- Webinars and consultancy

**Pricing:**
- PFA Norma de Venit: from 29 EUR/month
- SRL: from 59 EUR/month (currently discounted to 59 EUR)
- Includes accountant + full platform access

**What they do well:**
- The only player offering real-time accounting (not batched monthly)
- Service model removes the "find a good accountant" pain
- Modern platform — web + mobile
- Full package: accounting + payroll + invoicing + inventory
- Strong educational content and community
- 8,500+ clients, growing fast
- Backed by Visma — the Norwegian giant owns Keez, SmartBill, and has stakes in the market
- 30,000+ declarations/month, 200,000+ invoices/month, 6,000+ salary slips/month

**What they do poorly:**
- It's a service, not self-serve software — doesn't scale the same way
- Expensive compared to pure software plays (59+ EUR/month vs 29 EUR/year)
- The entrepreneur still doesn't get management tools — just better, faster accounting
- No budgeting, forecasting, cost control
- No treasury management, cash flow projections
- No multi-vertical cost allocation
- No classification engine or automation
- Locked to Keez accountants — can't bring your own
- Limited to Romanian market due to service model

---

### 2.5 Others Worth Noting

| Player | What they do | Relevance |
|--------|-------------|-----------|
| **WinMentor** | Legacy desktop ERP/accounting. Still widely used | Dying breed, migration opportunity |
| **Ciel** | Desktop accounting | Same as WinMentor |
| **FGO.ro** | Bank aggregator — view all bank accounts in one place | Data source for Costify, not a competitor |
| **Agicap** (EU) | Treasury management, cash flow forecasting | Validates the management layer opportunity, but not in Romania |
| **Pennylane** (FR) | Accounting + management for entrepreneurs | Closest to our vision, but French market only |
| **Pleo/Spendesk** (EU) | Spend management, corporate cards | Adjacent space, enterprise-focused |
| **Xero/QuickBooks** | Global cloud accounting | Not localized for Romania (no e-Factura, no SAF-T, no ANAF) |

---

## 3. The Gap — What Nobody Does

Every player in the Romanian market is built for one of two users:

1. **The accountant** — Saga, SmartBill Conta, WinMentor, Ciel
2. **The invoicer** — SmartBill, Oblio (the entrepreneur who just needs to send bills)

**Nobody builds for the entrepreneur who wants to understand and control their business financially.**

The entrepreneur today:
- Sends invoices through SmartBill/Oblio
- Gives documents to the accountant who uses Saga
- Gets a P&L and balance sheet months later
- Manages budgets in Excel (if at all)
- Has no idea about real-time cash position across all accounts
- Cannot answer "are we on budget this month?" without calling the accountant
- Has no cost ownership — nobody is responsible for specific expense categories
- Cannot forecast — "will we run out of cash in 3 months?" is a guess
- Manages multiple business lines/verticals by gut feel

This is the gap. And it's massive.

---

## 4. Costify's Positioning

### The One-Line

**Costify is the financial operating system for Romanian businesses — the only platform where the accountant does their job AND the entrepreneur runs their business, from the same data.**

### Two Faces, One Platform

```
┌─────────────────────────────────────────────────────────────────┐
│                         COSTIFY                                 │
│                                                                 │
│   ┌──────────────────────┐    ┌──────────────────────────────┐  │
│   │   ACCOUNTANT SIDE    │    │   ENTREPRENEUR/MANAGER SIDE  │  │
│   │                      │    │                              │  │
│   │ • Chart of accounts  │    │ • Executive dashboard        │  │
│   │ • Double-entry       │    │ • Budget vs Actual vs FRC    │  │
│   │   bookkeeping        │    │ • Cost classification        │  │
│   │ • Trial balance      │    │ • Treasury & cash flow       │  │
│   │ • e-Factura          │    │ • Spend analytics            │  │
│   │ • e-Transport        │    │ • Forecast & scenarios       │  │
│   │ • SAF-T / D406       │    │ • Cost ownership             │  │
│   │ • ANAF declarations  │    │ • Subscription tracking      │  │
│   │ • Payroll            │    │ • Optimization engine        │  │
│   │ • Invoicing          │    │ • Multi-vertical P&L         │  │
│   │ • Inventory/stock    │    │ • Approval workflows         │  │
│   │ • Bank reconciliation│    │ • Real-time alerts           │  │
│   │ • Period close       │    │ • Custom reports & BI        │  │
│   └──────────┬───────────┘    └──────────────┬───────────────┘  │
│              │          SHARED DATA           │                  │
│              └───────────────┬────────────────┘                  │
│                              │                                   │
│              ┌───────────────▼────────────────┐                  │
│              │   AUTOMATIC BANK FEEDS         │                  │
│              │   CLASSIFICATION PIPELINE      │                  │
│              │   IMMUTABLE JOURNAL            │                  │
│              │   AUDIT TRAIL                  │                  │
│              └───────────────────────────────┘                  │
│                                                                 │
│   Multi-tenant: one accountant manages 1000+ companies          │
│   Each company has its own entrepreneur dashboard               │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Wins

| Stakeholder | Today | With Costify |
|------------|-------|-------------|
| **Entrepreneur** | Sends invoices in SmartBill, gets P&L from accountant monthly, manages budgets in Excel, no real-time visibility | Real-time dashboard, budget control, cash forecast, cost ownership, alerts — without needing accounting knowledge |
| **Accountant** | Uses Saga/WinMentor, receives documents from clients, processes monthly, submits to ANAF | Same workflow but in a modern cloud platform. Plus: bank feeds automated, classification assisted, less manual entry |
| **Finance Manager** | Stuck between Excel and the accounting software, builds reports manually | Native BvA reporting, multi-vertical views, approval workflows, forecast scenarios |

### The Switching Argument

- **To the entrepreneur**: "You finally see where your money goes, in real time. Your accountant works in the same system."
- **To the accountant**: "It's Saga in the cloud, but better. Your clients see their dashboards, ask fewer questions, and the bank feeds are automatic."
- **To both**: "One platform, two views. The accountant sees the journal. The entrepreneur sees the business."

---

## 5. Complete Module Map

### LAYER 1: Foundation (what every competitor has)

| Module | Description | Competes with |
|--------|-------------|---------------|
| **Invoicing** | Emit, receive, e-Factura, e-Transport, proforma, advance, credit notes | SmartBill, Oblio, Saga |
| **Accounting** | Chart of accounts, double-entry bookkeeping, trial balance, balance sheet, P&L | Saga, SmartBill Conta |
| **Payroll** | Salaries, taxes, contributions, REGES, fluturas de salariu | Saga, Keez |
| **Inventory** | Stock management, NIR, transfers, production/BOM | SmartBill Gestiune, Oblio Stocuri |
| **Fiscal Compliance** | SAF-T, ANAF declarations, e-Factura, e-Transport, Intrastat | Saga, SmartBill |
| **POS** | Fiscal receipt printing, casa de marcat, retail/HoReCa | Saga MarketLine/PubLine, SmartBill POS |

### LAYER 2: Automation (what SmartBill/Keez partially do)

| Module | Description | Competitive advantage |
|--------|-------------|----------------------|
| **Bank Feeds** | Automatic transaction ingestion from FGO.ro, direct bank APIs, Open Banking | Nobody does this well in Romania. FGO is manual, SmartBill has no bank feeds |
| **Auto-Classification** | Rule engine that classifies transactions by IBAN, vendor, keyword, amount, pattern | Unique — no Romanian competitor has this |
| **Smart Reconciliation** | Automatic matching of bank transactions to invoices and journal entries | Partial in Saga, not automated |
| **Document OCR** | Scan/photograph receipts and invoices, extract data automatically | Keez has basic version |

### LAYER 3: Management Intelligence (what NOBODY has)

| Module | Description | Why it matters |
|--------|-------------|---------------|
| **Executive Dashboard** | Real-time KPIs: balance, burn rate, runway, BvA, top costs, unclassified | The entrepreneur's cockpit |
| **Budget Management** | Create, version, approve, lock budgets per category/vertical/period | Replaces the Excel budget |
| **Forecast Engine** | Run-rate, seasonality, commitment-based, scenario modeling | "Will we make it to December?" answered instantly |
| **Cost Control** | Multi-axis classification, cost ownership, approval workflows | "Who spent this?" and "Was it budgeted?" |
| **Treasury** | All accounts in one view, cash flow in/out, runway projection | "How much cash do we have right now?" |
| **Multi-Vertical P&L** | P&L per business line, consolidated, shared cost allocation | For businesses with multiple verticals |
| **Subscription Tracker** | Detect recurring payments, track SaaS/service costs, flag unused | "What are we paying for monthly?" |
| **Optimization Engine** | Anomaly detection, duplicate payments, cost reduction opportunities | AI-powered cost savings |
| **Custom Reports** | Drag-and-drop report builder, scheduled delivery, export | Replace the accountant's manual Excel reports |
| **Alerts & Notifications** | Budget threshold alerts, unclassified items, approval reminders, cash low warnings | Proactive, not reactive |

### LAYER 4: Platform (what makes us a business, not a tool)

| Module | Description | Why it matters |
|--------|-------------|---------------|
| **Multi-Tenant** | One accountant manages 1000+ companies, each with their own data and dashboards | Scale for accounting firms |
| **Client Portal** | Entrepreneur logs in, sees their company dashboard, submits documents | The entrepreneur face of the platform |
| **Team Collaboration** | Comments on transactions, @mentions, task assignments, approval chains | Replace WhatsApp/email threads about invoices |
| **API & Integrations** | REST API, webhooks, eCommerce connectors, BI tool connectors | Ecosystem play |
| **Mobile App** | Full-featured iOS/Android — not just invoicing, but dashboards, approvals, alerts | Management on the go |
| **White-Label** | Accounting firms can brand the client portal with their logo | Sticky for accounting firms |

---

## 6. What We Do Better Than Each Competitor

### vs. Saga
| Saga | Costify |
|------|---------|
| Desktop-first, recently ported to web | Cloud-native, built for web from day one |
| Accountant-only UI | Two faces: accountant + entrepreneur |
| Manual bank statement import | Automatic bank feeds (hourly) |
| No classification | AI-assisted auto-classification |
| No budgeting/forecasting | Full BvA, forecasts, scenarios |
| No dashboards | Real-time executive dashboards |
| No cost ownership | Per-category ownership with approvals |
| No audit trail beyond basic logs | Pipeline-level audit with tamper detection |
| Static reports | Dynamic, drillable, customizable reports |
| No API | Full REST API + webhooks |

### vs. SmartBill
| SmartBill | Costify |
|-----------|---------|
| Invoicing-centric | Full financial operating system |
| Basic accounting (Conta) | Complete double-entry + management layer |
| No bank feeds | Automatic bank feeds |
| No classification | Auto-classification engine |
| No budgeting/forecasting | Full budget lifecycle + forecasting |
| Basic reports (sales, collections) | Deep analytics, BvA, cost breakdown, trends |
| No cost control or ownership | Category ownership, approval workflows |
| No treasury management | Multi-account treasury with cash flow |
| ManagerConta for accountants | Full multi-tenant with client portals |

### vs. Oblio
| Oblio | Costify |
|-------|---------|
| Invoicing + inventory | Full financial platform |
| No accounting | Complete accounting engine |
| No payroll | Full payroll |
| No bank feeds | Automatic bank feeds |
| No management tools | Complete management layer |
| 29 EUR/year | Higher price, 100x more value |
| "Your accountant uses what they like" | Your accountant works IN Costify |

### vs. Keez
| Keez | Costify |
|------|---------|
| Service model (human accountant included) | Software platform (bring your own accountant, or use ours) |
| Real-time accounting (their differentiator) | Real-time accounting + real-time management |
| No budgeting/forecasting | Full budget lifecycle + forecasting |
| No cost control | Complete cost classification and ownership |
| No treasury management | Multi-account treasury |
| Locked to Keez accountants | Open — any accountant can use it |
| 59+ EUR/month for service | Software-only pricing available, service as add-on |
| 8,500 clients | Target: 100,000+ companies |

---

## 7. Roadmap to Greatness

### Phase 0: Foundation (Months 1-2)

**Goal:** Buildable skeleton — auth, multi-tenant, audit, CI pipeline.

| Deliverable | Detail |
|-------------|--------|
| Project setup | Next.js 15 + Fastify + PostgreSQL + Redis + BullMQ |
| Multi-tenant core | Tenant model, RLS policies, tenant context middleware |
| Auth system | Registration, login, MFA (TOTP), JWT + refresh tokens |
| Audit system | Append-only audit table, checksum computation, pipeline stage tracking |
| CI pipeline | GitHub Actions: lint → typecheck → unit → integration → e2e → Playwright → security scan |
| Design system | UI component library, dark/light mode, responsive grid |
| Database schema | Core tables with migrations (all tenant-scoped, RLS-enabled) |

**Exit criteria:** A user can register, create a tenant (company), log in, and see an empty dashboard. All protected by MFA, RLS, and audit logging. CI pipeline passes on every PR.

---

### Phase 1: The Pipeline — Bank to Dashboard (Months 3-5)

**Goal:** Replace Excel. Automatic bank feeds → classified transactions → real-time balances → dashboard.

This is the unique wedge that no Romanian competitor has. Ship this first.

| Deliverable | Detail |
|-------------|--------|
| **Source management** | Add/configure bank sources per company (FGO.ro, direct bank, CSV/XLSX upload) |
| **Ingestion workers** | FGO.ro connector, bank API connector, file parser (CSV, XLSX, MT940) |
| **Normalization** | Parse, normalize, deduplicate, enrich (counterparty lookup, keyword extraction) |
| **Classification engine** | Rule builder UI, priority ordering, condition evaluation, confidence scoring |
| **Split transactions** | One payment → multiple categories/verticals with percentage/amount allocation |
| **Immutable journal** | Append-only transaction ledger, sequential numbering, full linkage to source |
| **Balance engine** | Total balance, per-account balance, balance snapshots, running balance |
| **Transaction log UI** | List, filter, search, drill-down, manual classify, bulk actions |
| **Cost taxonomy** | Groups, categories, subcategories — configurable per tenant, import from Excel |
| **Ownership** | Assign owners per category, primary + backup, versioned |
| **Executive dashboard** | KPI cards (balance, burn rate, unclassified, top categories), charts, period selector |
| **Treasury view** | All accounts in one view, balance per account, cash in/out |

**Exit criteria:** A user connects their bank accounts, transactions appear automatically (hourly), are classified, and feed a real-time dashboard. The user can see "where is my money going?" without touching Excel.

**This alone is worth paying for.** No competitor offers this in Romania.

---

### Phase 2: Invoicing + Accounting Core (Months 6-9)

**Goal:** Replace Saga/SmartBill for the accountant. Full invoicing and double-entry bookkeeping.

| Deliverable | Detail |
|-------------|--------|
| **Invoicing** | Create, send, track invoices. Proforma, advance, credit notes |
| **e-Factura** | ANAF SPV integration — send and receive electronic invoices |
| **e-Transport** | Generate and submit transport documents |
| **Receivables** | Track who owes you, aging analysis, payment reminders |
| **Chart of accounts** | Romanian plan de conturi, customizable per company |
| **Journal entries** | Double-entry bookkeeping, auto-generated from invoices and bank transactions |
| **Trial balance** | Real-time balanta de verificare |
| **Financial statements** | Balance sheet (bilant), P&L (cont de profit si pierdere) |
| **Bank reconciliation** | Match bank transactions to journal entries, flag discrepancies |
| **Period close** | Lock periods, prevent retroactive edits, accountant signs off |
| **Document management** | Upload, store, link invoices/receipts to transactions. OCR extraction |
| **Client-accountant flow** | Entrepreneur uploads documents → accountant processes → entrepreneur sees results |

**Exit criteria:** An accountant can do 100% of their monthly work in Costify: process invoices, record journal entries, reconcile bank, generate trial balance, close the month. The entrepreneur can emit invoices and see their financial statements without calling the accountant.

---

### Phase 3: Budget, Forecast & Cost Control (Months 10-12)

**Goal:** The management layer. What makes Costify unique.

| Deliverable | Detail |
|-------------|--------|
| **Budget management** | Create annual budgets by category, vertical, period. Version control (Draft → Approved → Locked → Revised) |
| **Budget editor** | Grid UI with inline editing, Excel import, templates, copy from previous year |
| **Budget vs Actual** | Real-time BvA with drill-down to transactions. By category, vertical, period |
| **Forecast engine** | Methods: run-rate, seasonality, moving average, commitment-based, manual override |
| **Scenarios** | Base, conservative, stretch, custom. Side-by-side comparison |
| **Cash flow forecast** | "When will we run out of money?" with visualization |
| **Approval workflows** | Owner proposes → Manager reviews → CFO/Admin approves. For budgets, reclassifications, exceptional spend |
| **Alerts system** | Budget threshold exceeded, unusual spend detected, cash low warning, unclassified backlog |
| **Notification center** | In-app + email. Digest mode (daily summary) or real-time |
| **Vertical dashboards** | Per-vertical P&L, cost breakdown, trends, budget utilization |
| **Owner dashboard** | My categories, my budget status, my pending items |

**Exit criteria:** An entrepreneur with 3 business verticals can set budgets, track actuals in real time, see forecasts, get alerts when something is off, and drill from a KPI card all the way down to the source bank transaction.

---

### Phase 4: Payroll & Fiscal Compliance (Months 13-16)

**Goal:** Complete the accountant's toolkit. Full parity with Saga.

| Deliverable | Detail |
|-------------|--------|
| **Payroll** | Salary calculation, taxes, social contributions (CAS, CASS), net salary |
| **Pay slips** | Generate fluturas de salariu, PDF or in-app |
| **REGES** | Employee registry integration — hire, suspend, terminate |
| **Employment contracts** | Generate from templates, store digitally |
| **ANAF declarations** | D112 (monthly payroll declaration), D100, D300 (TVA), D101, D205, D207, Declaratia Unica |
| **SAF-T / D406** | Full SAF-T export per ANAF specification |
| **Intrastat** | EU trade reporting for companies with intra-community operations |
| **Fiscal calendar** | Automatic reminders for declaration deadlines |
| **SPV integration** | Submit declarations directly to ANAF, retrieve receipts |

**Exit criteria:** An accountant using Costify has zero need to open Saga. Every fiscal obligation can be fulfilled from the platform.

---

### Phase 5: Intelligence & Optimization (Months 17-20)

**Goal:** Move from tracking to intelligence. Help the entrepreneur make better decisions.

| Deliverable | Detail |
|-------------|--------|
| **ML classification** | Learn from manual classifications, suggest categories for new transactions |
| **Anomaly detection** | Flag unusual spending, duplicate payments, sudden spikes |
| **Subscription tracker** | Detect recurring payments, track SaaS/service costs, flag unused subscriptions |
| **Vendor analysis** | Spend per vendor, negotiation opportunities, vendor consolidation suggestions |
| **Cost optimization** | Actionable recommendations: "You're paying for 3 cloud providers, consolidate to save X" |
| **Custom report builder** | Drag-and-drop report builder, save templates, schedule delivery |
| **BI export** | Connect to Power BI, Tableau, Metabase, Looker |
| **Benchmarking** | (Anonymized) comparison: "Your marketing spend is 15% vs 10% industry average" |

**Exit criteria:** Costify doesn't just show you numbers — it tells you what to do about them. The entrepreneur gets proactive recommendations.

---

### Phase 6: Platform & Scale (Months 21-26)

**Goal:** From product to platform. Ecosystem, integrations, market expansion.

| Deliverable | Detail |
|-------------|--------|
| **Inventory + production** | Full stock management, NIR, BOM, manufacturing. Compete with Oblio Stocuri |
| **POS module** | Retail and HoReCa point-of-sale with fiscal receipt. Compete with MarketLine/PubLine |
| **eCommerce connectors** | WooCommerce, Shopify, PrestaShop, eMag, Amazon |
| **Mobile app** | Full iOS/Android app — dashboards, invoicing, approvals, alerts, document scan |
| **White-label** | Accounting firms brand the client portal with their logo, domain, colors |
| **Marketplace** | Third-party developers build integrations and extensions |
| **API v2** | GraphQL API, real-time subscriptions, webhooks for everything |
| **Horizontal scale** | 10K+ concurrent users, 1000+ companies per accountant, 100M+ transactions |
| **EU expansion** | Localize for Bulgaria, Hungary, Czech Republic (similar markets, similar gap) |

**Exit criteria:** Costify is a platform, not just a product. Accounting firms run their entire practice on it. Entrepreneurs manage their business from it. Third-party developers build on it.

---

## 8. Pricing Strategy (Draft)

### Model: Tiered SaaS, per company per month

| Tier | Target | Includes | Price |
|------|--------|----------|-------|
| **Starter** | Solo entrepreneur, PFA | Invoicing, bank feeds, dashboard, basic reports | 15 EUR/month |
| **Business** | SRL with 1-20 employees | Everything in Starter + accounting, payroll, budgets, forecasts, cost control | 49 EUR/month |
| **Enterprise** | Multi-vertical, 20-200 employees | Everything in Business + multi-vertical, approval workflows, custom reports, API access | 99 EUR/month |
| **Accountant** | Accounting firms | Multi-tenant management, up to 50 companies | 149 EUR/month |
| **Accountant Pro** | Large accounting firms | Up to 500 companies, white-label, priority support | 399 EUR/month |

### Why this works
- **Starter at 15 EUR/month**: Undercuts SmartBill on features (they have no bank feeds, no dashboard). More than Oblio (29 EUR/year), but 10x more valuable.
- **Business at 49 EUR/month**: Replaces Saga + Excel. Less than Keez (59+ EUR/month) but without the mandatory accountant lock-in.
- **Accountant at 149 EUR/month for 50 companies**: That's 3 EUR/company/month. Saga charges 50 RON/CUI/year minimum. We're competitive AND offer the management layer.

---

## 9. Go-To-Market Strategy

### Phase 1 GTM: The Wedge (Months 3-5)

**Target:** Entrepreneurs who manage budgets in Excel alongside their business. RedSparQ-like companies (10-50 employees, multiple business lines).

**Message:** "See where your money goes. In real time. Without Excel."

**Channels:**
- Direct outreach to companies we know (RedSparQ as first client and case study)
- LinkedIn content: "Why Romanian entrepreneurs are blind to their cash flow"
- Partnership with 3-5 forward-thinking accounting firms who want to offer more to their clients

### Phase 2 GTM: The Accountant (Months 6-12)

**Target:** Accounting cabinets managing 50-500 companies. Especially those frustrated with Saga.

**Message:** "It's everything Saga does, plus your clients can finally see their own numbers."

**Channels:**
- Accounting association partnerships (CECCAR events, conferences)
- Free migration from Saga (import tool)
- Content marketing: "How to run a modern accounting practice"
- Referral program: accountants get revenue share from their clients' subscriptions

### Phase 3 GTM: The Market (Months 13+)

**Target:** Mass market — every Romanian SRL and PFA.

**Message:** "The financial OS for your business."

**Channels:**
- SEO: rank for "program contabilitate", "program facturare", "e-factura"
- Partnerships with company formation services (like Keez does with infiintare SRL)
- Free tier or trial period
- Government/ANAF partnerships (if possible)
- EU expansion: replicate the model in similar markets

---

## 10. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Building too much before shipping | Never find market fit | Ship Phase 1 (bank feeds + dashboard) ASAP, get paying clients, iterate |
| Saga accountants won't switch | Slow adoption | Don't force switching — integrate WITH Saga initially (Phase 1-2). Replace later |
| e-Factura/SAF-T compliance is complex | Delays, legal risk | Hire/contract a fiscal compliance expert from day one. Use ANAF test environment |
| Visma owns SmartBill + Keez + stakes in market | They could build this | They haven't in 18 years. Visma buys, doesn't build from scratch. Our speed is our advantage |
| FGO.ro doesn't have a proper API | Bank feeds won't work | Build scraping fallback + direct bank integration. Open Banking is mandated in EU |
| Pricing is wrong | Too expensive or too cheap | Start with beta pricing, measure willingness to pay, adjust quarterly |
| Multi-tenant security breach | Fatal to business | RLS at DB level, integration tests on every PR, annual pen testing |

---

## 11. Success Metrics

### Year 1
| Metric | Target |
|--------|--------|
| Paying companies (tenants) | 500 |
| Active accountants on platform | 50 |
| MRR (Monthly Recurring Revenue) | 25,000 EUR |
| Transaction auto-classification rate | >85% |
| NPS (Net Promoter Score) | >50 |

### Year 2
| Metric | Target |
|--------|--------|
| Paying companies | 5,000 |
| Active accountants | 300 |
| MRR | 150,000 EUR |
| Full accounting parity with Saga | Yes |
| Mobile app | Shipped |

### Year 3
| Metric | Target |
|--------|--------|
| Paying companies | 25,000 |
| Active accountants | 1,000 |
| ARR (Annual Recurring Revenue) | 3M EUR |
| EU expansion | 1-2 additional countries |
| Platform/marketplace | Live |
