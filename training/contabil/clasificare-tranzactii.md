# Clasificare Tranzactii -- Transaction Classification Engine

How the AI contabil classifies bank transactions into Romanian accounting entries for Costify. This is the core intelligence that powers automatic transaction categorization.

---

## Classification Pipeline

```
Bank Transaction (raw)
  │
  ├── 1. PATTERN MATCHING (keywords, IBAN, amount patterns)
  ├── 2. COUNTERPARTY IDENTIFICATION (CUI lookup, known suppliers/clients)
  ├── 3. ACCOUNTING DETERMINATION (which accounts, debit/credit)
  ├── 4. TAX TREATMENT (TVA, deductibility, withholding)
  ├── 5. CATEGORY MAPPING (Costify category/vertical/cost center)
  └── 6. CONFIDENCE SCORING (0-100%)
```

---

## Bank Statement Transaction Patterns

### INCOME Patterns (Credit on bank statement = Debit 5121)

#### Client Payments (Incasari de la clienti)
```
Keywords: "incasare", "plata", "factura", "f/", "fv", "transfer de la", client name
Account: 5121 D / 4111 C
TVA: No (payment, not invoice)
Category: Operating > Revenue Collection
Confidence: HIGH if matches open invoice
```

#### Interest Income (Dobanzi incasate)
```
Keywords: "dobanda", "dobânda", "interest", "rata dobanzii"
Account: 5121 D / 766 C
TVA: Exempt (financial service)
Category: Financial > Interest Income
Confidence: HIGH
```

#### TVA Refund (Rambursare TVA)
```
Keywords: "rambursare tva", "trezorerie", "DGFP", "ANAF rambursare"
Account: 5121 D / 4424 C
TVA: N/A
Category: Tax > TVA Recovery
Confidence: HIGH
```

#### Capital Contribution (Aport capital)
```
Keywords: "aport", "majorare capital", "varsare capital", shareholder name
Account: 5121 D / 456 C
TVA: N/A
Category: Capital > Shareholder Contribution
Confidence: MEDIUM (verify with shareholder records)
```

#### Loan Received (Credit primit)
```
Keywords: "credit", "imprumut", "transa", "disbursare", bank name
Account: 5121 D / 162 or 5191 C
TVA: N/A
Category: Financial > Loan Proceeds
Confidence: MEDIUM (verify with loan agreement)
```

#### Subsidy/Grant (Subventie)
```
Keywords: "subventie", "grant", "ajutor de stat", "fonduri", "PNRR"
Account: 5121 D / 445 C (or 4752/7584 depending on type)
TVA: N/A
Category: Other > Subsidies
Confidence: MEDIUM
```

#### Insurance Claim (Despagubire asigurare)
```
Keywords: "despagubire", "dauna", "asigurare", insurance company name
Account: 5121 D / 461 C (or 7581)
TVA: N/A
Category: Other > Insurance Claims
Confidence: MEDIUM
```

---

### EXPENSE Patterns (Debit on bank statement = Credit 5121)

#### Supplier Payments (Plati furnizori)
```
Keywords: "plata", "furnizor", "factura", "f/", supplier name, CUI in reference
Account: 401 D / 5121 C
TVA: No (payment, not invoice)
Category: Operating > Supplier Payment
Confidence: HIGH if matches open payable
```

#### Salary Payments (Plati salarii)
```
Keywords: "salariu", "salarii", "stat plata", "lichidare", "net salarii", 
          "virare salarii", "drepturi salariale", multiple small amounts on same day
Account: 421 D / 5121 C
TVA: N/A
Category: Personnel > Salary Payment
Confidence: HIGH
```

#### Tax Payments -- CAS/CASS/CAM
```
Keywords: "CAS", "CASS", "contributii", "asigurari sociale", "4312", "4314",
          "4311", "D112", budget treasury IBAN
Account: 4312/4314/4311 D / 5121 C
TVA: N/A
Category: Personnel > Social Contributions
Confidence: HIGH (verify IBAN matches treasury)
```

#### Tax Payments -- Income Tax on Salaries
```
Keywords: "impozit salarii", "impozit venit", "444", "retinere", treasury IBAN
Account: 444 D / 5121 C
TVA: N/A
Category: Personnel > Salary Tax
Confidence: HIGH
```

#### Tax Payments -- TVA
```
Keywords: "TVA", "taxa valoare adaugata", "4423", "D300", treasury IBAN
Account: 4423 D / 5121 C
TVA: N/A
Category: Tax > TVA Payment
Confidence: HIGH
```

#### Tax Payments -- Profit Tax
```
Keywords: "impozit profit", "4411", "D100", "D101", treasury IBAN
Account: 4411 D / 5121 C
TVA: N/A
Category: Tax > Profit Tax
Confidence: HIGH
```

#### Tax Payments -- Micro-enterprise Tax
```
Keywords: "impozit micro", "4418", "microintreprindere", treasury IBAN
Account: 4418 D / 5121 C
TVA: N/A
Category: Tax > Micro Tax
Confidence: HIGH
```

#### Tax Payments -- Local Taxes
```
Keywords: "impozit cladiri", "impozit teren", "impozit auto", "taxa firma",
          local treasury IBAN
Account: 446 D / 5121 C
TVA: N/A
Category: Tax > Local Taxes
Confidence: HIGH
```

#### Bank Fees (Comisioane bancare)
```
Keywords: "comision", "taxa administrare", "taxa cont", "comision transfer",
          "taxa card", "taxa mentenanta", "fee", "charge"
Account: 627 D / 5121 C
TVA: Exempt (bank services)
Category: Operating > Bank Fees
Confidence: VERY HIGH
```

#### Rent (Chirie)
```
Keywords: "chirie", "locatiune", "rent", "inchiriere", landlord name
Account: 612 D / 5121 C (or 401 D if through supplier)
TVA: 21% if commercial property, exempt if residential (from 1 jul 2025; see constante-fiscale-2026.md)
Category: Operating > Rent
Confidence: HIGH if recurring same amount
```

#### Utilities (Utilitati)
```
Keywords: "energie", "electrica", "Enel", "E.ON", "Engie", "gaz", "apa",
          "Apa Nova", "termoficare", "internet", "RCS", "Digi", "Orange",
          "Vodafone", "Telekom"
Account: 605 D / 5121 C (or 401 D)
TVA: 21% standard (see constante-fiscale-2026.md)
Category: Operating > Utilities
Confidence: HIGH (known utility companies)
```

#### Fuel (Combustibil)
```
Keywords: "carburant", "combustibil", "benzina", "motorina", "GPL", "OMV",
          "Petrom", "Rompetrol", "Lukoil", "Mol", "Socar"
Account: 6022 D / 5121 C
TVA: 50% deductible (unless exclusively business use)
Category: Operating > Fuel & Transport
Confidence: HIGH (known fuel companies)
```

#### Insurance (Asigurari)
```
Keywords: "asigurare", "CASCO", "RCA", "polita", "Allianz", "Generali",
          "Groupama", "Euroins", "Omniasig", "City Insurance"
Account: 613 D / 5121 C
TVA: Exempt (insurance services)
Category: Operating > Insurance
Confidence: HIGH
```

#### Loan Repayment (Rambursare credit)
```
Keywords: "rata credit", "rambursare", "amortizare credit", "rata imprumut",
          bank name + "credit"
Account: 5191 or 162 D / 5121 C (principal)
         666 D / 5121 C (interest portion)
TVA: N/A
Category: Financial > Loan Repayment
Confidence: MEDIUM (need to split principal/interest)
```

#### Dividend Payment (Plata dividende)
```
Keywords: "dividend", "distribuire profit", shareholder name
Account: 457 D / 5121 C
TVA: N/A
Category: Capital > Dividend Payment
Confidence: MEDIUM
```

#### Equipment Purchase (Achizitie echipamente)
```
Keywords: "echipament", "calculator", "laptop", "imprimanta", "server",
          "mobilier", "aparatura", large one-time amounts, IT supplier names
Account: 2xxx D + 4426 D / 5121 C (if paid directly)
         404 D / 5121 C (if through supplier account)
TVA: 21% deductible (see constante-fiscale-2026.md)
Category: Investment > Equipment
Confidence: MEDIUM (need to determine if >2500 RON for capitalization)
```

#### Travel & Accommodation (Deplasari)
```
Keywords: "cazare", "hotel", "bilet avion", "bilet tren", "Booking",
          "Airbnb", "diurna", "deplasare", "travel"
Account: 625 D / 5121 C
TVA: Depends (hotel 9%, transport varies)
Category: Operating > Travel
Confidence: MEDIUM
```

#### Subscriptions & Software (Abonamente & Software)
```
Keywords: "abonament", "subscriptie", "licenta", "Microsoft", "Google",
          "Adobe", "Slack", "Zoom", "AWS", "hosting", "domeniu", "SaaS"
Account: 628 D / 5121 C (if expense)
         2052 D / 5121 C (if capitalized software)
TVA: 21% (or reverse charge if EU provider; see constante-fiscale-2026.md)
Category: Operating > Software & Subscriptions
Confidence: HIGH (known SaaS providers)
```

#### Cash Withdrawal (Ridicare numerar)
```
Keywords: "retragere", "ridicare numerar", "ATM", "CEC", "numerar"
Account: 581 D / 5121 C then 5311 D / 581 C
TVA: N/A (internal transfer)
Category: Treasury > Cash Withdrawal
Confidence: VERY HIGH
```

#### Internal Transfer (Transfer intre conturi)
```
Keywords: transfer to own account (same CUI), "virament intern"
Account: 581 D / 5121 (source) then 5121 (dest) D / 581 C
TVA: N/A
Category: Treasury > Internal Transfer
Confidence: VERY HIGH (if same CUI on both sides)
```

---

## Treasury IBAN Recognition

Romanian treasury accounts follow patterns:

```
Budget type    IBAN prefix     Purpose
State budget   RO..TREZ...    Impozite si taxe catre stat
Local budget   RO..TREZ...    Impozite locale
Social budget  RO..TREZ...    Contributii sociale

The TREZ prefix in IBAN indicates treasury payment.
```

---

## Counterparty CUI Lookup

For each transaction counterparty, Costify should:
1. Extract CUI from payment reference or IBAN owner
2. Query ANAF web service: `https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva`
3. Determine:
   - Is counterparty VAT registered? (affects TVA treatment)
   - Is counterparty active/inactive? (inactive = non-deductible)
   - Company name and address for verification
4. Cache results (refresh weekly)

---

## Confidence Scoring

| Factor | Score Impact |
|--------|-------------|
| Exact keyword match | +20 |
| Known counterparty (previous transactions) | +25 |
| Amount matches open invoice/payable | +30 |
| Recurring pattern (same amount, same day of month) | +15 |
| Treasury IBAN recognized | +25 |
| CAEN-specific pattern | +10 |
| Multiple matching signals | +5 each additional |
| Ambiguous description | -20 |
| New counterparty | -10 |
| Unusual amount | -10 |

**Thresholds:**
- **>= 85%**: Auto-classify, no review needed
- **70-84%**: Auto-classify, flag for review
- **50-69%**: Suggest classification, require confirmation
- **< 50%**: Cannot classify, require manual entry

---

## Split Transaction Rules

Some bank transactions represent multiple accounting entries:

### Loan Payment (rata credit = principal + dobanda)
```
Bank: -5,000 RON "rata credit luna martie"
Split:
  5191 D 4,200 / 5121 C 4,200  (principal)
  666  D   800 / 5121 C   800  (interest)
```

### Payment with Discount
```
Bank: -9,500 RON "plata factura cu scont"
Original invoice: 10,000 RON
Split:
  401  D 10,000 / 5121 C  9,500  (payment)
                / 767  C    500  (discount received)
```

### Salary Payment (bulk payment split per employee)
```
Bank: -50,000 RON "salarii martie 2024"
Split per employee from payroll records:
  421 D (Employee 1 net) / 5121 C
  421 D (Employee 2 net) / 5121 C
  ...
```

---

## Industry-Specific Classification Rules

### Construction (CAEN 41-43)
- Materials (301, 302) are primary expenses
- Subcontractor costs via 401/628
- Reverse charge TVA on B2B construction services
- Retention guarantees (retineri de garantie) -- special treatment

### IT Services (CAEN 62xx)
- Software development revenue -> 704
- SaaS subscriptions -> 628 (expense) or 2052 (capitalize if > 2500 RON and > 1 year)
- Freelancer/contractor payments -> 621
- Server/hosting -> 628 or 611

### Retail/Commerce (CAEN 47xx)
- Goods purchased for resale -> 371 (not 301)
- COGS -> 607 (not 601)
- Cash register receipts reconciliation
- Inventory management critical

### Transport (CAEN 49xx)
- Fuel is primary expense -> 6022
- Vehicle maintenance -> 611
- Road taxes -> 635
- RCA/CASCO insurance -> 613
- Leasing payments -> 612 or split (principal/interest)

### HoReCa (CAEN 55-56)
- Food supplies -> 601/602 (at 11% TVA; see constante-fiscale-2026.md)
- Beverage supplies -> 607 or 601
- Revenue at 11% TVA (restaurant services, excl. alcohol)
- Tips handling
- Shift/seasonal employee patterns

---

## Month-End Automated Processing

Costify should automatically perform these month-end operations:

### 1. TVA Settlement (Regularizare TVA)
```
Calculate: Sum(4427) vs Sum(4426)
If 4427 > 4426:
  4427 D / 4426 C (clear input VAT)
  4427 D / 4423 C (remaining = TVA de plata)
If 4426 > 4427:
  4427 D / 4426 C (clear output VAT)
  4424 D / 4426 C (remaining = TVA de recuperat)
```

### 2. FX Revaluation (Reevaluare valutara)
```
For each foreign currency balance:
  New value = Balance x BNR rate (last business day)
  Old value = Current book value
  Difference = New - Old
  If positive: 5124 D / 765 C
  If negative: 665 D / 5124 C
```

### 3. Depreciation Run (Calcul amortizare)
```
For each active fixed asset:
  6811 D / 28xx C (monthly depreciation amount)
```

### 4. Accruals Check (Verificare angajamente)
```
Flag items that may need accrual:
  - Invoices recorded but not yet paid
  - Services received but invoice not yet arrived (408)
  - Revenue earned but not yet invoiced (418)
```

### 5. Trial Balance Generation (Generare balanta)
```
Verify all 4 equalities balance
Flag any anomalies (negative cash, credit balance on asset accounts, etc.)
```
