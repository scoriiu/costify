# Balanta de Verificare & Bilant -- Trial Balance & Financial Statements

Reference for Romanian financial reporting as implemented in Costify.

---

## Balanta de Verificare (Trial Balance)

The trial balance (balanta de verificare) is the most important verification and reporting tool in Romanian accounting. It must be generated monthly and is the basis for all financial statements.

### Structure

The Romanian trial balance has the following columns:

```
| Simbol | Denumire cont | Sold initial D | Sold initial C | Rulaj luna D | Rulaj luna C | Total sume D | Total sume C | Sold final D | Sold final C |
|--------|---------------|----------------|----------------|--------------|--------------|--------------|--------------|--------------|--------------|
```

### The 4 Equality Checks (Egalitati)

A correct trial balance satisfies these equalities:

1. **Total Sold Initial Debitor = Total Sold Initial Creditor**
2. **Total Rulaj Debitor = Total Rulaj Creditor**
3. **Total Sume Debitoare = Total Sume Creditoare**
4. **Total Sold Final Debitor = Total Sold Final Creditor**

Additionally:
- Total Sume = Sold Initial + Rulaj
- Sold Final = Sold Initial + Rulaj Debit - Rulaj Credit (for debit accounts)
- Sold Final = Sold Initial + Rulaj Credit - Rulaj Debit (for credit accounts)

### Types of Trial Balance

#### Balanta cu 4 egalitati (4 sets of columns)
Full trial balance with: initial balance, turnover, cumulative, final balance. Used for monthly reporting.

#### Balanta cu sume si solduri
Simplified: only cumulative totals and final balances.

#### Balanta sintetica
Synthetic: only first-level accounts (3-digit).

#### Balanta analitica
Analytical: includes sub-accounts and detail accounts. Must reconcile to synthetic balance.

### Costify Implementation

```typescript
interface TrialBalanceRow {
  accountCode: string        // e.g., "5121"
  accountName: string        // e.g., "Conturi la banci in lei"
  openingDebit: number       // Sold initial debitor
  openingCredit: number      // Sold initial creditor
  periodDebit: number        // Rulaj curent debitor
  periodCredit: number       // Rulaj curent creditor
  cumulativeDebit: number    // Total sume debitoare
  cumulativeCredit: number   // Total sume creditoare
  closingDebit: number       // Sold final debitor
  closingCredit: number      // Sold final creditor
}

interface TrialBalance {
  tenantId: string
  period: { year: number; month: number }
  rows: TrialBalanceRow[]
  totals: TrialBalanceRow     // sums of all rows -- must balance
  isBalanced: boolean         // all 4 equalities satisfied
  generatedAt: Date
}
```

### Errors Detected by Trial Balance

| Error Type | Symptom | Resolution |
|-----------|---------|------------|
| Missing entry side | Debit/credit totals don't match | Find unmatched entry |
| Wrong amount | Balance doesn't match source docs | Verify against documents |
| Omitted transaction | Account balance seems low/high | Check completeness |
| Double entry | Account balance seems high | Check for duplicates |
| Wrong account | One account too high, another too low | Verify account mapping |
| Arithmetic error | Column totals don't add up | Recalculate |

### Errors NOT Detected by Trial Balance

- Compensating errors (two errors that cancel out)
- Entry in wrong accounts but correct debit/credit (e.g., debit 601 instead of 602)
- Omission of a complete double-entry transaction
- Recording the same wrong amount on both sides

---

## Bilantul (Balance Sheet)

Per OMFP 1802/2014, the Romanian balance sheet follows a prescribed format.

### Structure (Activ / Pasiv)

```
ACTIV (Assets)
├── A. Active imobilizate (Non-current assets)
│   ├── I. Imobilizari necorporale (Intangible assets)
│   │   ├── Cheltuieli de constituire (201 - 2801)
│   │   ├── Cheltuieli de dezvoltare (203 - 2803)
│   │   ├── Concesiuni, brevete, licente (205 - 2805)
│   │   ├── Fond comercial (207 - 2807)
│   │   └── Avansuri (din 4094)
│   ├── II. Imobilizari corporale (Tangible assets)
│   │   ├── Terenuri si constructii (211 + 212 - 2811 - 2812)
│   │   ├── Instalatii tehnice si masini (213 - 2813)
│   │   ├── Alte instalatii, utilaje, mobilier (214 - 2814)
│   │   ├── Investitii imobiliare (215 - 2815)
│   │   ├── Active biologice productive (216 - 2816)
│   │   ├── Imobilizari in curs (223)
│   │   └── Avansuri (din 4093)
│   └── III. Imobilizari financiare (Financial assets)
│       ├── Actiuni la entitati afiliate (261 - 2961)
│       ├── Imprumuturi acordate entitatilor afiliate (2671)
│       ├── Interese de participare (263 - 2963)
│       ├── Alte titluri imobilizate (265 - 2965)
│       └── Alte creante imobilizate (2672 + 2673 + 2674 + 2675 + 2676 + 2678 - 2966)
│
├── B. Active circulante (Current assets)
│   ├── I. Stocuri (Inventories)
│   │   ├── Materii prime si materiale consumabile (301 + 302 + 303 + 308 - 391 - 392)
│   │   ├── Productia in curs de executie (331 + 332 - 393)
│   │   ├── Produse finite si marfuri (341 + 345 + 346 + 348 + 361 + 371 + 378 + 381 + 388 - 394 - 396 - 397 - 398)
│   │   └── Avansuri pentru cumparari de stocuri (din 4091)
│   ├── II. Creante (Receivables)
│   │   ├── Creante comerciale (4111 + 4118 + 413 + 418 - 491)
│   │   ├── Sume de incasat de la entitati afiliate (451 + 453)
│   │   ├── Alte creante (425 + 4282 + 4382 + 4424 + 4428D + 4482 + 461 + 473D + altele)
│   │   └── Capital subscris si nevarsat (456D)
│   ├── III. Investitii pe termen scurt (Short-term investments)
│   │   └── (501 + 505 + 506 + 508 - 591 - 595 - 596 - 598)
│   └── IV. Casa si conturi la banci (Cash and bank)
│       └── (5121 + 5124 + 5125 + 531 + 532 + 541 + 542)
│
├── C. Cheltuieli in avans (Prepaid expenses)
│   └── (471)
│
└── D. Datorii ce trebuie platite intr-o perioada de un an (Current liabilities)
    (shown on PASIV side in some formats)

PASIV (Equity + Liabilities)
├── D. Datorii ce trebuie platite intr-o perioada de un an (Current liabilities)
│   ├── Imprumuturi din emisiuni de obligatiuni (161 short-term portion)
│   ├── Sume datorate institutiilor de credit (5191 + 5192 + 5198)
│   ├── Avansuri incasate in contul comenzilor (419)
│   ├── Datorii comerciale - furnizori (401 + 403 + 404 + 405 + 408)
│   ├── Efecte de comert de platit (403 + 405)
│   ├── Sume datorate entitatilor afiliate (451C + 453C)
│   ├── Alte datorii (421 + 423 + 424 + 426 + 427 + 4281 + 431 + 437 + 4381 + 441 + 4423 + 4428C + 444 + 446 + 447 + 4481 + 455 + 457 + 462 + 473C)
│   └── inclusiv datorii fiscale si sociale
│
├── E. Active circulante nete/Datorii curente nete
│   (B + C - D - I = Capital de lucru net)
│
├── F. Total active minus datorii curente (A + E)
│
├── G. Datorii ce trebuie platite intr-o perioada mai mare de un an (Non-current liabilities)
│   ├── Imprumuturi din emisiuni de obligatiuni (161 long-term)
│   ├── Sume datorate institutiilor de credit (162)
│   └── Alte imprumuturi si datorii (166 + 167 + 168 + 169)
│
├── H. Provizioane (Provisions)
│   └── (151x)
│
├── I. Venituri in avans (Deferred income)
│   ├── Subventii pentru investitii (475)
│   └── Venituri inregistrate in avans (472)
│
└── J. Capital si rezerve (Equity)
    ├── I. Capital subscris (1011 + 1012)
    ├── II. Prime de capital (1041 + 1042 + 1043 + 1044)
    ├── III. Rezerve din reevaluare (105)
    ├── IV. Rezerve (1061 + 1063 + 1068)
    ├── V. Profitul sau pierderea reportat/a (117x)
    ├── VI. Profitul sau pierderea exercitiului financiar (121 - 129)
    └── VII. Repartizarea profitului (-129)
```

### Balance Sheet Equation
```
TOTAL ACTIV = TOTAL PASIV

Where:
TOTAL ACTIV = A + B + C
TOTAL PASIV = D + G + H + I + J

Or equivalently:
Assets = Liabilities + Equity
Active = Datorii + Capitaluri proprii
```

---

## Contul de Profit si Pierdere (Income Statement / P&L)

Romanian P&L uses the nature-of-expense classification (pe natura cheltuielilor):

```
1. Cifra de afaceri neta (Net turnover)
   = 701 + 702 + 703 + 704 + 705 + 706 + 707 + 708
   - Reduceri comerciale acordate

2. Variatia stocurilor de produse finite si productie in curs
   = 711 (sold creditor + / sold debitor -)

3. Productia realizata de entitate pentru scopurile sale proprii si capitalizata
   = 721 + 722

4. Alte venituri din exploatare
   = 741 + 754 + 758

5. VENITURI DIN EXPLOATARE TOTAL (1 + 2 + 3 + 4)

a) Cheltuieli cu materiile prime si materialele consumabile
   = 601 + 602

b) Alte cheltuieli externe
   = 604 + 605 + 608 + 611 + 612 + 613 + 614 + 621 + 622 + 623 + 624 + 625 + 626 + 627 + 628

c) Cheltuieli cu personalul
   = 641 + 642 + 643 + 644 + 645 + 646

d) Ajustari de valoare privind imobilizarile corporale si necorporale
   = 6811 - 7813

e) Ajustari de valoare privind activele circulante
   = 654 + 6814 - 754 - 7814

f) Alte cheltuieli de exploatare
   = 635 + 652 + 658

6. CHELTUIELI DE EXPLOATARE TOTAL (a + b + c + d + e + f)

7. PROFITUL SAU PIERDEREA DIN EXPLOATARE (5 - 6)

8. Venituri din interese de participare
   = 761 + 762 + 763 + 764

9. Venituri din dobanzi si alte venituri financiare
   = 765 + 766 + 767 + 768

10. Ajustari de valoare privind imobilizarile financiare si investitiile financiare
    = 6863 + 6864 + 6868 - 786

11. Cheltuieli privind dobanzile si alte cheltuieli financiare
    = 663 + 664 + 665 + 666 + 667 + 668

12. PROFITUL SAU PIERDEREA FINANCIAR/A (8 + 9 - 10 - 11)

13. PROFITUL SAU PIERDEREA CURENT/A (7 + 12)

14. Impozitul pe profit (691)

15. Alte impozite neprezentate (698)

16. PROFITUL SAU PIERDEREA EXERCITIULUI FINANCIAR (13 - 14 - 15)
```

---

## Situatia Fluxurilor de Trezorerie (Cash Flow Statement)

Romanian entities can use either the direct or indirect method.

### Metoda Directa (Direct Method)
```
A. FLUXURI DE TREZORERIE DIN ACTIVITATI DE EXPLOATARE
   + Incasari de la clienti
   - Plati catre furnizori si angajati
   + Alte incasari din exploatare
   - Plati privind impozitul pe profit
   = Numerar net din exploatare

B. FLUXURI DE TREZORERIE DIN ACTIVITATI DE INVESTITII
   - Plati pentru achizitia de imobilizari
   + Incasari din vanzarea de imobilizari
   + Incasari de dobanzi
   + Incasari de dividende
   = Numerar net din investitii

C. FLUXURI DE TREZORERIE DIN ACTIVITATI DE FINANTARE
   + Incasari din emisiunea de actiuni
   + Incasari din imprumuturi
   - Rambursari de imprumuturi
   - Plati de dividende
   - Plati de dobanzi la imprumuturi
   = Numerar net din finantare

VARIATIA NETA A TREZORERIEI (A + B + C)
TREZORERIE LA INCEPUTUL PERIOADEI
TREZORERIE LA SFARSITUL PERIOADEI
```

### Metoda Indirecta (Indirect Method)
```
A. FLUXURI DIN EXPLOATARE
   Profitul inainte de impozitare
   + Amortizari
   +/- Ajustari pentru depreciere
   +/- Provizioane
   +/- Diferente de curs valutar nerealizate
   - Venituri din dobanzi
   - Venituri din dividende
   + Cheltuieli cu dobanzile
   +/- Variatia stocurilor
   +/- Variatia creantelor comerciale
   +/- Variatia datoriilor comerciale
   - Impozit pe profit platit
   = Numerar net din exploatare
```

---

## Declaratii si Rapoarte Obligatorii (Mandatory Filings)

### Lunare (Monthly)
| Declaratie | Continut | Termen |
|-----------|---------|--------|
| D300 | Decont de TVA | 25 ale lunii urmatoare |
| D112 | Declaratia privind obligatiile de plata a contributiilor sociale, impozitului pe venit si evidenta nominala a persoanelor asigurate | 25 ale lunii urmatoare |
| D394 | Declaratie informativa privind livrarile/prestarile si achizitiile efectuate pe teritoriul national | 30 ale lunii urmatoare |

### Trimestriale (Quarterly)
| Declaratie | Continut | Termen |
|-----------|---------|--------|
| D100 | Declaratie privind obligatiile de plata la bugetul de stat | 25 ale lunii urmatoare trimestrului |
| D101 | Declaratia privind impozitul pe profit | 25 ale lunii urmatoare trimestrului |

### Anuale (Annual)
| Declaratie | Continut | Termen |
|-----------|---------|--------|
| Situatii financiare anuale | Bilant + P&L + Note | 150 zile de la inchiderea exercitiului (31 mai) |
| D101 | Declaratia anuala privind impozitul pe profit | 25 martie anul urmator |
| D205 | Declaratie informativa privind impozitul retinut la sursa | Ultima zi a lunii februarie anul urmator |

### Categorii de Entitati si Obligatii de Raportare

| Criteriu | Micro | Mici | Mijlocii/Mari |
|----------|-------|------|---------------|
| Cifra afaceri | < 700.000 EUR | < 8.000.000 EUR | >= 8.000.000 EUR |
| Total active | < 350.000 EUR | < 4.000.000 EUR | >= 4.000.000 EUR |
| Nr angajati | < 10 | < 50 | >= 50 |
| Situatii financiare | Bilant prescurtat + CPP | Bilant prescurtat + CPP + Note | Set complet |
| Audit obligatoriu | Nu | Nu | Da |
