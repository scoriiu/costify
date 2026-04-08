# Journal Processing Pipeline

## Overview

```
XLSX upload → Parse headers → Parse rows → Handle "%" compounds →
Post-closing shift → Store journal lines → Compute balances per month → Store balance rows
```

## Data Flow

```
XLSX File
  ↓
parseJournalXLSX(buffer)
  ├─→ resolveHeaders(rawHeaders)
  ├─→ parseDate(), normalizeMoney()
  ├─→ Handle "%" compound entries
  ├─→ applyPostClosingShift()
  └─→ JournalEntry[] + Map<account, name>
        ↓
buildPartnerMappings(entries)
  └─→ JournalPartner[] (extracted names)
        ↓
[Store to DB: JournalLine, JournalPartner]
        ↓
For each (year, month):
  computeBalanceFromJournal(entries, year, month)
    ├─→ computeOpeningBalances()
    │     └─→ Year-by-year P&L closing to 121
    ├─→ buildAccountAggregations()
    │     └─→ YTD and monthly turnover
    ├─→ buildRawRows()
    │     └─→ D/C split balances
    └─→ computeLeafFlags()
          └─→ Parent/child classification
            ↓
[Store to DB: BalanceRow]
        ↓
(Phase 2) Report computation
  ├─→ Bilant F10 (balance sheet)
  ├─→ CPP F20 (P&L statement)
  ├─→ KPIs (cash, receivables, payables)
  ├─→ Financial ratios
  └─→ Monthly trends
```

## 1. XLSX Parsing & Column Detection

### Header Resolution (`src/modules/ingestion/header-resolver.ts`)

Alias-based matching normalizes varying column names from different Romanian accounting exports:

- `data` → "data", "date", "data_doc", "data_inregistrare"
- `cont_d` → "cont_d", "cont_debit", "simbol_debit"
- `cont_c` → "cont_c", "cont_credit", "simbol_credit"
- `suma` → "suma", "valoare", "amount", "suma_ron"
- `explicatie` → "explicatie", "descriere", "description"
- `fel_d`, `categorie`, `cod`, `validat`, `tva` (optional)

Process: normalize headers (lowercase, trim, remove dots, replace spaces with underscores), try exact canonical match, fall back to alias list.

### Romanian Number Format (`src/lib/money.ts`)

```
"1.234.567,89" → 1234567.89  (dots=thousands, comma=decimal)
"1,234.56"     → 1234.56     (US format)
"1.234"        → 1234        (ambiguous: 1-3 digits after dot = thousands sep)
```

## 2. Compound Journal Entries ("%" Notation)

Romanian journal exports use compound entries (nota contabila compusa):

```
Row 1:  cont_d="4111"  cont_c="%"     suma=1190   ← Header (marker)
Row 2:  cont_d=""      cont_c="704"   suma=1000   ← Detail 1
Row 3:  cont_d=""      cont_c="4427"  suma=190    ← Detail 2
```

Output: Two entries — 4111→704 (1000) and 4111→4427 (190).

Rules:
- Compounds NEVER span dates — date change clears compound state
- Header row (with "%") is SKIPPED; only details become entries
- Both sides must be populated for a valid entry

### Post-Closing Period Shift

Entries after "inchidere luna" (month closing) in the same month are shifted to the next period. This handles Romanian accounting practice where closing transactions mark month-end.

## 3. Journal Entry Structure

```typescript
{
  data: Date;           // Transaction date
  year: number;         // From date
  month: number;        // 1-12, may be shifted by post-closing logic
  ndp: string;          // Document type/number
  contD: string;        // Debit account (may have analytic: "5121.00001")
  contDBase: string;    // Base account ("5121")
  contC: string;        // Credit account
  contCBase: string;    // Base account
  suma: number;         // Amount (always positive; sign implicit in D/C)
  explicatie: string;   // Description
  felD: string;         // Operation type
  categorie: string;    // Optional category
  cod: string;          // Partner code
  validat: string;      // Validation marker
  tva: number;          // VAT value
}
```

## 4. Balance Computation Algorithm

### Step 1: Opening Balances with Year-by-Year P&L Closing

For each prior year sequentially:
1. Accumulate all entries for that year
2. Close P&L accounts (class 6/7) — zero them out, transfer net to account 121
3. Carry forward to next year

This ensures class 6/7 start fresh each year while 121 carries cumulative profit/loss.

### Step 2: Account Aggregations for Current Year

Using post-closing opening balances, aggregate:
- `rulajtD`, `rulajtC` — Year-to-date turnover
- `rulajD`, `rulajC` — Current month turnover

### Step 3: Raw Row Calculation

14 columns per account:

| Column | Meaning |
|--------|---------|
| debInit, credInit | Opening balance (start of year) |
| soldInD, soldInC | Opening balance current month |
| debPrec, credPrec | Totals up to previous month |
| rulajD, rulajC | Current month turnover |
| rulajTD, rulajTC | Year-to-date turnover |
| totalDeb, totalCred | Total D/C through period |
| finD, finC | Closing balance at end of period |

### Step 4: Leaf/Parent Classification

Prevents double-counting in hierarchical accounts:
- "5121" = synthetic (parent)
- "5121.00001" = analytic (child)

Only leaf accounts are included in report aggregation.

## 5. Account Classification

| Class | Type | Notes |
|-------|------|-------|
| 1 | P (Liability) | except 129 (asset) |
| 2 | A (Asset) | except 28x, 29x (contra = liability) |
| 3 | A (Asset) | except 39x (contra = liability) |
| 4 | B (Bifunctional) | Classified by balance sign at report time |
| 5 | A (Asset) | except 519 (liability) |
| 6 | A (Expense) | P&L, closed to 121 at year-end |
| 7 | P (Revenue) | P&L, closed to 121 at year-end |

Class 4 bifunctional: `finD > finC` → Asset, `finC > finD` → Liability.

## 6. Partner Extraction

- Only from partner accounts: 401, 404, 411 (with analytic suffix ".")
- Regex matches formal company names (SRL, SA, PFA, etc.)
- Falls back to first 2-6 tokens if no formal name found
- Most frequent name per analytic account wins

## 7. Import API Flow (`POST /api/import`)

1. Parse XLSX → JournalEntry[]
2. Extract partners → JournalPartner[]
3. Create Dataset record
4. Store JournalLines (batched in 5000)
5. Compute & store BalanceRows for each (year, month)
6. Store JournalPartner mappings

## 8. Critical Invariants

1. P&L Closing: every year boundary must close class 6/7 to account 121
2. Double Entry: debit amount = credit amount on every entry (implicit in suma)
3. Leaf Computation: only leaf accounts in balances (no double-counting)
4. Sign-Based Classification: class 4 accounts classified by net balance sign
5. Romanian Numbers: all parsing handles "1.234.567,89" format
6. Monthly Accuracy: rulajD + rulajC must equal monthly movements
7. Year Continuity: closing balance year N = opening balance year N+1 (with P&L reset)

## 9. Known Gaps

1. **No report layer** — balance rows computed but no Bilant F10, CPP F20, KPIs, ratios
2. **Mid-year unclosed P&L** — Bilant needs to show provisional result as liability
3. **No double-entry validation** — should verify total debits = total credits
4. **Simplified compound handling** — missing pending buffer for non-standard exports
5. **No rounding drift detection** — re-imports may silently change historical data

## Key Source Files

- `src/modules/ingestion/journal-parser.ts` — XLSX parsing, compound entries
- `src/modules/ingestion/header-resolver.ts` — Column name matching
- `src/modules/ingestion/partner-extractor.ts` — Partner name extraction
- `src/modules/balances/compute-balance.ts` — Balance computation algorithm
- `src/lib/accounts.ts` — Account type classification, leaf flags
- `src/lib/account-names.ts` — Chart of accounts (5000+ mappings)
- `src/lib/money.ts` — Romanian number parsing
- `src/app/api/import/route.ts` — Import API endpoint
