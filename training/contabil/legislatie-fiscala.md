# Legislatie Fiscala Romaneasca -- Romanian Tax & Accounting Legislation

Complete reference for the legal framework Costify must comply with.

---

## Primary Legislation

### 1. Legea 227/2015 -- Codul Fiscal (Fiscal Code)

The central tax law of Romania. Key titles relevant to Costify:

#### Titlul I -- Dispozitii Generale (General Provisions)
- Art. 7: Definitions of common terms
- Art. 11: Special provisions for fiscal code application (transfer pricing, anti-abuse)

#### Titlul II -- Impozitul pe Profit (Profit Tax)
- **Rate**: 16% standard rate
- **Contribuabili**: Legal entities registered in Romania, permanent establishments of foreign entities
- **Baza impozabila**: Profit impozabil = Total revenues - Total deductible expenses +/- Fiscal adjustments
- **Cheltuieli deductibile integral**: Expenses made for business purposes with proper documentation
- **Cheltuieli cu deductibilitate limitata**:
  - Protocol (entertainment): max 2% of adjusted accounting profit
  - Sponsorship: max 0.75% of turnover or 20% of profit tax
  - Daily travel allowances: 2.5x legal limit
  - Auto expenses: 50% for vehicles not exclusively used for business
  - Private health insurance: max 400 EUR/year/employee
  - Voluntary pension contributions: max 400 EUR/year/employee
- **Cheltuieli nedeductibile**:
  - Fines and penalties to state authorities
  - Expenses without justifying documents
  - Income tax expense itself
  - Losses from disposal of shares held < 1 year (certain conditions)
  - Expenses for personal benefit of shareholders

```
FORMULA:
Profit impozabil = Profit contabil brut
  - Venituri neimpozabile (non-taxable income)
  + Cheltuieli nedeductibile (non-deductible expenses)
  - Deduceri fiscale (tax deductions)
  +/- Alte ajustari (other adjustments)

Impozit pe profit = Profit impozabil x 16%
```

#### Titlul III -- Impozitul pe Venitul Microintreprinderilor (Micro-Enterprise Tax)

**Conditions for micro-enterprise status (2026):**
- Revenue under **100,000 EUR** at previous year-end (was 500k in 2023, 250k in 2024-2025)
- Not operating in banking, insurance, capital markets, gambling
- Has at least 1 employee (mandatory — no employee = no micro regime)
- Share capital is held by persons other than the state

**Tax rate:**
- **1%** of revenue (single rate; the former 3% rate no longer applies)

**Revenue base:**
- Total income from any source per accounting records
- EXCLUDING: income from provisions/adjustments reversal, production of fixed assets, subsidies related to assets, FX gains from asset revaluation, and others per Art. 53

**Quarterly payment**: By the 25th of the month following the quarter

**Exit conditions (forced to profit tax):**
- Revenue exceeds **100,000 EUR** during the year — profit tax from that quarter, no return to micro
- Share capital changes to state ownership
- Employee contract ceases (no 60-day grace period in current form)
- Starts activities in excluded sectors

See `constante-fiscale-2026.md` for current thresholds.

#### Titlul IV -- Impozitul pe Venit (Personal Income Tax)
- **Rate**: 10% flat rate on most income categories
- **Venituri din salarii**: Taxable = Gross - CAS - CASS - personal deduction
- **Deducere personala**: Graduated based on gross salary and dependents (Art. 77)
- **Venituri din dividende**: 16% withholding tax (from 2026; was 5% → 8% → 10% → 16%). See `constante-fiscale-2026.md`.

#### Titlul V -- Contributii Sociale Obligatorii (Mandatory Social Contributions)

| Contribution | Rate | Payer | Account |
|---|---|---|---|
| CAS (Pensie) | 25% | Employee (withheld from gross) | 4312 |
| CASS (Sanatate) | 10% | Employee (withheld from gross) | 4314 |
| CAM (Contributia asiguratorie pentru munca) | 2.25% | Employer (on top of gross) | 4311 |

**Salary tax calculation flow:**
```
Gross salary: 10,000 RON
- CAS (25%): 2,500
- CASS (10%): 1,000
= Taxable base: 6,500
- Personal deduction: (varies, e.g., 0 for high salaries)
= Net taxable: 6,500
x Tax rate (10%): 650
= Net salary: 10,000 - 2,500 - 1,000 - 650 = 5,850

Employer cost: 10,000 + CAM (2.25% = 225) = 10,225
Total cost to company: 10,225
```

#### Titlul VII -- Taxa pe Valoarea Adaugata (Value Added Tax / TVA)

**Registration threshold**: **395,000 RON** (from 1 September 2025; was 300,000 RON). Only domestic supplies count (no immovable assets). See `constante-fiscale-2026.md`.

**Standard rate**: 21% (from 1 July 2025; was 19%)

**Reduced rate:**
- **11%**: Food and non-alcoholic beverages, water supply, medicines (non-exempt), hotel accommodation, restaurant/catering services (excl. alcohol), fertilizers/pesticides, agricultural inputs, textbooks, books, newspapers, firewood, access to museums/monuments/zoos, thermal energy, social housing
- **9%**: Transitional exception — certain housing deliveries until 31 July 2026

**Note:** The former 5% and 9% reduced rates were abrogated from 1 July 2025 and replaced by a single 11% reduced rate. Exception: 9% transitional rate for certain housing deliveries until 31 July 2026.

**Exempt with credit (scutit cu drept de deducere):**
- Exports (0%)
- Intra-community deliveries to VAT-registered buyers (0%)
- International transport

**Exempt without credit (scutit fara drept de deducere):**
- Medical services
- Education services
- Insurance services
- Banking/financial services
- Rental of residential property

**TVA filing obligations:**
- **D300** (Decont de TVA): Monthly for standard taxpayers, quarterly for small
- **D390** (Declaratie recapitulativa): Monthly, for intra-EU transactions
- **D394** (Declaratie informativa): Monthly, for domestic B2B transactions

**TVA accounts flow:**
```
Purchase: 4426 D (input VAT collected from suppliers)
Sale:     4427 C (output VAT charged to customers)

Monthly settlement:
If 4427 > 4426: Pay difference (4423 - TVA de plata)
If 4426 > 4427: Claim refund (4424 - TVA de recuperat)

Filing: D300 by 25th of following month
```

**Reverse charge (taxare inversa):**
For certain transactions (intra-EU acquisitions, local reverse charge categories), the buyer records both 4426 and 4427:
```
%    = 401
  3xx/6xx D  (net amount)
  4426 D     (TVA deductibila)
  4427 C     (TVA colectata)
```

---

### 2. Legea 207/2015 -- Codul de Procedura Fiscala (Tax Procedure Code)

Key provisions affecting Costify:
- **Obligatia de a conduce evidenta contabila**: All taxpayers must maintain accounting records
- **Termenele de depunere**: Deadlines for filing declarations (penalties for late filing)
- **Inspectia fiscala**: Tax authority inspection procedures
- **Prescriptie**: 5-year statute of limitations for tax assessment (7 years for certain cases)
- **Dobanzi si penalitati de intarziere**: 0.02% per day of delay for unpaid taxes

---

### 3. OMFP 1802/2014 -- Reglementari Contabile (Accounting Regulations)

The main accounting regulation implementing EU Directive 2013/34/EU in Romania.

#### Key Principles (Principii Contabile):

1. **Principiul continuitatii activitatii** (Going concern)
2. **Principiul permanentei metodelor** (Consistency)
3. **Principiul prudentei** (Prudence)
4. **Principiul independentei exercitiului** (Accrual / Matching)
5. **Principiul evaluarii separate a elementelor de activ si de pasiv** (Separate valuation)
6. **Principiul intangibilitatii** (Intangibility of opening balance)
7. **Principiul necompensarii** (Non-offsetting)
8. **Principiul prevalentei economicului asupra juridicului** (Substance over form)
9. **Principiul pragului de semnificatie** (Materiality)

#### Entity Categories and Reporting Requirements:

**Microentitati** (Micro-entities):
- Criteria (at least 2 of 3): Total assets < 1,500,000 RON, Turnover < 3,000,000 RON, Employees < 10
- File: Abbreviated balance sheet + abbreviated P&L
- No notes required (optional)

**Entitati mici** (Small entities):
- Criteria (at least 2 of 3): Total assets < 17,500,000 RON, Turnover < 35,000,000 RON, Employees < 50
- File: Abbreviated balance sheet + P&L + selective notes

**Entitati mijlocii si mari** (Medium and large entities):
- Exceed small entity thresholds
- File: Full balance sheet + P&L + cash flow + equity changes + full notes
- Statutory audit required

#### Document Requirements (Documente Justificative):

Every accounting entry must be supported by:
- **Factura** (Invoice) -- for sales and purchases
- **Chitanta** (Receipt) -- for cash transactions
- **Bon fiscal** (Cash register receipt) -- for retail sales
- **Extras de cont bancar** (Bank statement) -- for bank transactions
- **Stat de plata** (Payroll record) -- for salary entries
- **Nota de receptie** (Goods receipt note) -- for inventory intake
- **Bon de consum** (Consumption voucher) -- for materials issued to production
- **Proces verbal** (Minutes/Protocol) -- for various decisions
- **Contract** -- underlying legal agreement

---

### 4. Legea 82/1991 -- Legea Contabilitatii (Accounting Law)

Foundation law establishing:
- Mandatory accounting for all legal entities in Romania
- Double-entry bookkeeping requirement
- Romanian language and RON as primary accounting currency
- Mandatory annual financial statements
- Personal liability of administrators for accounting compliance
- Penalties for non-compliance (fines from 200 to 10,000 RON)

#### Mandatory Accounting Registers:

1. **Registrul-jurnal** (General Journal) -- chronological record of all transactions
2. **Registrul-inventar** (Inventory Register) -- annual inventory of all assets/liabilities
3. **Cartea mare** (General Ledger) -- account-organized record

These registers must be:
- Numbered and stamped by tax authority (ANAF)
- Retained for 10 years
- Made available for inspection

---

### 5. OMFP 2634/2015 -- Documente Financiar-Contabile (Financial Documents)

Defines the standard forms for:
- Factura (Invoice format)
- Aviz de insotire a marfii (Delivery note)
- Chitanta (Receipt)
- Dispozitie de plata/incasare (Cash voucher)
- Nota de receptie (Goods receipt)
- Bon de consum (Material requisition)
- Fisa de magazie (Stock card)
- Lista de inventariere (Inventory count sheet)
- Registrul de casa (Cash book)
- Proces verbal de receptie (Acceptance protocol)
- Decont de cheltuieli (Expense report)

---

## E-Factura & E-Transport (Digital Obligations)

### RO e-Factura
Starting January 2024, **all B2B transactions** between Romanian VAT payers must go through the e-Factura system (ANAF electronic invoicing platform).

**Implications for Costify:**
- Must support e-Factura XML format (CIUS-RO based on EN 16931)
- Invoices have a unique ANAF loading index
- Must validate invoice against e-Factura registry

### RO e-Transport
For physical goods transport above certain thresholds:
- Must generate transport declarations (UIT codes)
- GPS monitoring for certain categories

### SAF-T (Standard Audit File for Tax)
Romania is implementing SAF-T (D406) reporting:
- Large taxpayers: Already mandatory
- Medium/Small: Being phased in
- XML-based detailed export of accounting data
- Costify must be able to generate SAF-T compliant exports

---

## Tax Calendar Summary

| Month | Deadline | Filing |
|-------|----------|--------|
| Jan 25 | D300 (Dec), D112 (Dec), D100 (Q4) | Monthly TVA, Payroll, Quarterly taxes |
| Feb 25 | D300 (Jan), D112 (Jan) | Monthly filings |
| Mar 25 | D300 (Feb), D112 (Feb), D101 (annual) | + Annual profit tax |
| Apr 25 | D300 (Mar), D112 (Mar), D100 (Q1) | + Q1 taxes, Q1 micro tax |
| May 25/31 | D300 (Apr), D112 (Apr) | |
| May 31 | Annual financial statements | Balance sheet + P&L + Notes |
| Jun 25 | D300 (May), D112 (May) | |
| Jul 25 | D300 (Jun), D112 (Jun), D100 (Q2) | + Q2 taxes, Q2 micro tax |
| Aug 25 | D300 (Jul), D112 (Jul) | |
| Sep 25 | D300 (Aug), D112 (Aug) | |
| Oct 25 | D300 (Sep), D112 (Sep), D100 (Q3) | + Q3 taxes, Q3 micro tax |
| Nov 25 | D300 (Oct), D112 (Oct) | |
| Dec 25 | D300 (Nov), D112 (Nov) | |

---

## Penalties for Non-Compliance

| Violation | Fine (RON) |
|-----------|-----------|
| Late filing of financial statements | 300 - 4,500 |
| Failure to maintain accounting records | 1,000 - 10,000 |
| Late filing of tax declarations | 1,000 - 5,000 |
| Late payment of taxes | 0.02%/day interest + 0.01%/day penalty |
| Failure to register for VAT | 1% of tax due, min 500 |
| Non-compliance with e-Factura | 5,000 - 10,000 (legal entities) |
| Failure to issue invoices | 10,000 - 40,000 |

---

## Key Accounting Policy Decisions

For each Costify tenant, these accounting policies must be configured:

### 1. Inventory Valuation Method
- **FIFO** (First In, First Out) -- most common
- **CMP** (Cost Mediu Ponderat / Weighted Average Cost) -- also common
- **LIFO** is NOT permitted under Romanian GAAP

### 2. Depreciation Method
- **Liniara** (Straight-line) -- most common
- **Degresiva** (Declining balance) -- tax advantage in early years
- **Accelerata** (Accelerated) -- 50% in first year, rest straight-line
- **Pe unitati de productie** (Units of production) -- for specific assets

### 3. Revenue Recognition
- At point of delivery for goods
- At completion (or percentage of completion) for services
- Following OMFP 1802/2014 Section 8

### 4. Foreign Currency Translation
- Monetary items: Revalued at BNR exchange rate at each reporting date
- Non-monetary items: Kept at historical rate
- FX differences: Recognized in P&L (665 or 765)

### 5. Provisioning Policy
- Specific provisions based on individual assessment
- Statistical provisions based on portfolio analysis
- Must follow prudence principle
