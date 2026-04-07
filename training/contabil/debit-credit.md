# Debit & Credit -- Romanian Double-Entry Bookkeeping Rules

The foundation of all accounting in Costify. Every transaction must follow these rules without exception.

---

## The Fundamental Equation

```
ACTIV = PASIV

Expanded:
ACTIVE + CHELTUIELI = CAPITALURI + DATORII + VENITURI

In English:
ASSETS + EXPENSES = EQUITY + LIABILITIES + REVENUE
```

This equation must ALWAYS balance. Every journal entry maintains this balance by affecting at least two accounts with equal debit and credit amounts.

---

## Account Classification & Behavior

### Conturi de Activ (Asset Accounts) -- Classes 2, 3, 5

```
┌─────────────────────────────────┐
│         CONT DE ACTIV           │
├────────────────┬────────────────┤
│     DEBIT      │    CREDIT      │
├────────────────┼────────────────┤
│ Sold initial   │                │
│ + Creste       │ - Scade        │
│                │                │
│ Sold final (D) │                │
└────────────────┴────────────────┘

Normal balance: DEBITOR (Debit)
Debit = increase
Credit = decrease
```

**Examples:**
- 5121 (Bank account): Debit when money comes IN, Credit when money goes OUT
- 2133 (Vehicles): Debit when purchased, Credit when sold/disposed
- 301 (Raw materials): Debit when received, Credit when consumed
- 4111 (Customers/Receivables): Debit when invoiced, Credit when paid

### Conturi de Pasiv (Liability & Equity Accounts) -- Class 1, portions of Class 4

```
┌─────────────────────────────────┐
│         CONT DE PASIV           │
├────────────────┬────────────────┤
│     DEBIT      │    CREDIT      │
├────────────────┼────────────────┤
│                │ Sold initial   │
│ - Scade        │ + Creste       │
│                │                │
│                │ Sold final (C) │
└────────────────┴────────────────┘

Normal balance: CREDITOR (Credit)
Debit = decrease
Credit = increase
```

**Examples:**
- 401 (Suppliers/Payables): Credit when invoiced, Debit when paid
- 1012 (Share capital): Credit when capital increases, Debit when reduced
- 162 (Long-term loans): Credit when loan received, Debit when repaid
- 421 (Salaries payable): Credit when salary accrued, Debit when paid

### Conturi de Cheltuieli (Expense Accounts) -- Class 6

```
┌─────────────────────────────────┐
│       CONT DE CHELTUIELI        │
├────────────────┬────────────────┤
│     DEBIT      │    CREDIT      │
├────────────────┼────────────────┤
│ + Creste       │ - Scade        │
│ (expense       │ (reversal/     │
│  recorded)     │  year-end      │
│                │  closing)      │
│ Sold final (D) │                │
└────────────────┴────────────────┘

Normal balance: DEBITOR (Debit) -- zero at year-end
Debit = expense increases
Credit = reversal or year-end closing to 121
```

**Examples:**
- 641 (Salary expense): Debit when salaries recorded
- 605 (Energy expense): Debit when utility bill recorded
- 627 (Bank fees): Debit when bank charges
- 666 (Interest expense): Debit when interest accrues

### Conturi de Venituri (Revenue Accounts) -- Class 7

```
┌─────────────────────────────────┐
│        CONT DE VENITURI         │
├────────────────┬────────────────┤
│     DEBIT      │    CREDIT      │
├────────────────┼────────────────┤
│ - Scade        │ + Creste       │
│ (reversal/     │ (revenue       │
│  year-end      │  recorded)     │
│  closing)      │                │
│                │ Sold final (C) │
└────────────────┴────────────────┘

Normal balance: CREDITOR (Credit) -- zero at year-end
Debit = reversal or year-end closing to 121
Credit = revenue increases
```

**Examples:**
- 704 (Service revenue): Credit when service invoiced
- 707 (Merchandise sales): Credit when goods sold
- 766 (Interest income): Credit when interest earned
- 765 (FX gains): Credit when favorable exchange difference

### Conturi Bifunctionale (Bifunctional Accounts) -- portions of Class 4

```
┌─────────────────────────────────┐
│     CONT BIFUNCTIONAL           │
├────────────────┬────────────────┤
│     DEBIT      │    CREDIT      │
├────────────────┼────────────────┤
│ + Creste       │ + Creste       │
│ (as receivable)│ (as payable)   │
│                │                │
│ Sold D or C    │ Sold D or C    │
└────────────────┴────────────────┘

Can have either debit or credit balance depending on the relationship.
```

**Examples:**
- 456 (Settlements with shareholders): Debit = shareholders owe money, Credit = entity owes to shareholders
- 473 (Pending transactions): Depends on resolution
- 4428 (Non-due VAT): Can be either

---

## The Debit-Credit Matrix

| Account Type | Debit (+) | Credit (-) | Normal Balance |
|---|---|---|---|
| **Active (Assets)** | Increase | Decrease | Debit |
| **Cheltuieli (Expenses)** | Increase | Decrease | Debit |
| **Capitaluri (Equity)** | Decrease | Increase | Credit |
| **Datorii (Liabilities)** | Decrease | Increase | Credit |
| **Venituri (Revenue)** | Decrease | Increase | Credit |

**Memory aid (Romanian):**
```
DEBIT creste: Active, Cheltuieli         (ce avem si ce cheltuim)
CREDIT creste: Capitaluri, Datorii, Venituri  (de unde vin banii)
```

---

## Transaction Analysis Framework

For every transaction in Costify, apply this 5-step analysis:

### Step 1: Identify the accounts affected
What accounts change? At least 2.

### Step 2: Classify each account
Is it Active, Pasiv, Cheltuiala, Venit, or Bifunctional?

### Step 3: Determine increase or decrease
Does each account increase or decrease?

### Step 4: Apply debit/credit rules
- Asset/Expense increase = DEBIT
- Asset/Expense decrease = CREDIT
- Liability/Equity/Revenue increase = CREDIT
- Liability/Equity/Revenue decrease = DEBIT

### Step 5: Verify the entry balances
Total debits must equal total credits.

### Example: Company pays 12,100 RON for office supplies (10,000 + 21% TVA)

```
Step 1: Accounts: 604 (supplies expense), 4426 (input VAT), 5121 (bank)
Step 2: 604 = Cheltuiala, 4426 = Activ, 5121 = Activ
Step 3: 604 increases, 4426 increases, 5121 decreases
Step 4: 604 D 10,000 | 4426 D 2,100 | 5121 C 12,100
Step 5: D: 10,000 + 2,100 = 12,100 | C: 12,100 ✓

Journal entry:
%                = 5121 Conturi la banci    12,100
  604 Materiale nestocate      10,000
  4426 TVA deductibila          2,100
```

---

## Common Patterns for Costify Classification

### Pattern: Money IN to bank account
```
5121 D = [source] C
Source could be: 4111 (client), 766 (interest), 4424 (TVA refund), 456 (capital)
```

### Pattern: Money OUT from bank account
```
[destination] D = 5121 C
Destination could be: 401 (supplier), 421 (salary), 4423 (TVA), 627 (bank fee)
```

### Pattern: Purchase with TVA
```
% = 401
  6xx D (expense)
  4426 D (TVA)
```

### Pattern: Sale with TVA
```
4111 = %
  70x C (revenue)
  4427 C (TVA)
```

### Pattern: Expense recognition (no third party)
```
6xx D = 28x/39x/15x C
(depreciation, impairment, provisions)
```

### Pattern: Period-end closing
```
Revenue closing: 7xx D = 121 C
Expense closing: 121 D = 6xx C
```

---

## Rectificari (Corrections)

### Storno in Rosu (Red Reversal)
The original entry is repeated with NEGATIVE amounts. This is the standard Romanian method.

```
Original (wrong):
627 D 100 / 5121 C 100

Correction (storno rosu):
627 D -100 / 5121 C -100

New correct entry:
625 D 100 / 5121 C 100
```

### Storno in Negru (Black Reversal)
The debit and credit sides are swapped.

```
Original (wrong):
627 D 100 / 5121 C 100

Correction (storno negru):
5121 D 100 / 627 C 100

New correct entry:
625 D 100 / 5121 C 100
```

**Note:** Storno in rosu is preferred because it doesn't artificially inflate turnovers (rulaje). Costify should implement storno in rosu as the default correction method.

---

## Verificari Automate (Automatic Validations for Costify)

The system must enforce:

1. **Every journal entry balances**: Sum of debits = Sum of credits
2. **Account function respected**: Asset accounts should not have persistent credit balances (exception: 28x amortization, 29x/39x/49x adjustments which are contra-asset accounts)
3. **TVA accounts used correctly**: 4426 only on purchases, 4427 only on sales
4. **Expense/Revenue accounts are zero after year-end closing**
5. **Cash accounts (531x) never negative**: You cannot pay more cash than you have
6. **Bank accounts (512x) alert on negative**: May indicate overdraft or error
7. **Supplier accounts (401) normally credit**: Debit balance means overpayment
8. **Customer accounts (4111) normally debit**: Credit balance means advance received
9. **Monthly TVA settlement performed**: 4426 and 4427 must be closed monthly
10. **Payroll accounts settled monthly**: 421, 431x, 444 should be zero after payments
