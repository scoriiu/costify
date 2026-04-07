# Amortizare si Imobilizari -- Depreciation & Fixed Assets

Complete reference for Romanian depreciation rules, useful lives, and fixed asset accounting per Legea 15/1994, HG 2139/2004 (Catalogul privind clasificarea si duratele normale de functionare a mijloacelor fixe), and OMFP 1802/2014.

---

## Definitions

### Mijloc Fix (Fixed Asset)
An asset is classified as a fixed asset (mijloc fix / imobilizare) when:
- **Useful life** > 1 year
- **Value** >= 2,500 RON (threshold updated by HG -- was 2,500 RON since 2024)
- Used in the entity's operations (not held for sale)

Assets below the value threshold but with useful life > 1 year are classified as **obiecte de inventar** (small inventory items) -- account 303, expensed via 603.

### Valoare de Intrare (Entry Value)
The cost at which the asset is recorded:
- **Cost de achizitie** -- purchase price + transport + installation + customs + non-deductible TVA
- **Cost de productie** -- for self-constructed assets
- **Valoare de aport** -- for assets contributed as share capital
- **Valoare justa** -- for assets received gratuitously or via exchange

---

## Depreciation Methods (Metode de Amortizare)

### 1. Amortizare Liniara (Straight-Line)

```
Amortizare anuala = Valoare de intrare / Durata normala de functionare (ani)
Amortizare lunara = Amortizare anuala / 12
```

**Mandatory for:** Buildings (constructii) -- account 212
**Optional for:** All other fixed assets

**Example:**
```
Equipment value: 120,000 RON
Useful life: 5 years
Annual depreciation: 120,000 / 5 = 24,000 RON
Monthly depreciation: 24,000 / 12 = 2,000 RON

Journal entry (monthly):
6811 Cheltuieli cu amortizarea = 2813 Amortizarea instalatiilor  2,000
```

### 2. Amortizare Degresiva (Declining Balance)

Two variants:

#### AD1 (fara influenta uzurii morale)
```
Rata = (1 / Durata) x Coeficient multiplicator
Applied to: Net book value (valoare ramasa)

Coeficients:
  Durata 2-5 ani:   coeficient = 1.5
  Durata 5-10 ani:  coeficient = 2.0
  Durata > 10 ani:  coeficient = 2.5

Switch to straight-line when annual declining balance amount < straight-line
on remaining value over remaining life.
```

#### AD2 (cu influenta uzurii morale)
```
Same as AD1 but with additional acceleration in first years
Based on technological obsolescence factor
Less commonly used
```

**Example AD1:**
```
Equipment: 100,000 RON, 5 years useful life
Rate = (1/5) x 1.5 = 30%

Year 1: 100,000 x 30% = 30,000 (remaining: 70,000)
Year 2: 70,000 x 30% = 21,000 (remaining: 49,000)
Year 3: 49,000 x 30% = 14,700 (remaining: 34,300)
-- Switch to linear: 34,300 / 2 remaining years = 17,150
Year 3 actual: 17,150 (remaining: 17,150)  [linear > declining, so switch]
Year 4: 17,150
Year 5: 17,150 (but actually 0 remaining)

Actual calculation varies -- check switch point each year.
```

### 3. Amortizare Accelerata (Accelerated)

```
Year 1: Up to 50% of entry value
Remaining years: Straight-line over remaining useful life

Requires ANAF approval for tax purposes (Directia Generala a Finantelor Publice).
```

**Example:**
```
Equipment: 100,000 RON, 5 years
Year 1: 50,000 (50%)
Years 2-5: 50,000 / 4 = 12,500 per year
```

**Restrictions:**
- Not applicable to buildings
- Must be approved by tax authority for tax deduction
- Accounting depreciation can differ from fiscal depreciation

---

## Catalog Durate Normale de Functionare (Useful Life Catalog)

Per HG 2139/2004, updated periodically. Key categories:

### Grupa 1 -- Constructii (Buildings)

| Subgrupa | Description | Useful Life (years) |
|----------|-------------|---------------------|
| 1.1.1 | Cladiri industriale din beton armat | 40-60 |
| 1.1.2 | Cladiri industriale cu structura metalica | 24-36 |
| 1.1.3 | Cladiri industriale cu pereti din caramida | 30-50 |
| 1.2.1 | Cladiri pentru birouri din beton armat | 40-60 |
| 1.2.2 | Cladiri pentru birouri cu pereti din caramida | 30-50 |
| 1.3.1 | Cladiri de locuit din beton armat | 50-100 |
| 1.3.2 | Cladiri de locuit cu pereti din caramida | 40-80 |
| 1.4 | Constructii pentru depozitare | 20-40 |
| 1.5 | Constructii pentru transporturi si telecomunicatii | 15-40 |
| 1.6 | Constructii hidrotehnice | 10-50 |
| 1.7 | Imprejmuiri (garduri, porti) | 8-20 |

**Note:** Terenuri (land) -- account 2111 -- are NOT depreciated.

### Grupa 2 -- Echipamente Tehnologice (Technological Equipment)

| Subgrupa | Description | Useful Life (years) |
|----------|-------------|---------------------|
| 2.1 | Masini, utilaje si instalatii de lucru | 5-24 |
| 2.1.1 | Masini-unelte pentru prelucrat metale | 8-20 |
| 2.1.2 | Masini si utilaje pentru industria alimentara | 6-15 |
| 2.1.3 | Masini si utilaje pentru constructii | 5-12 |
| 2.1.4 | Masini si utilaje pentru agricultura | 6-12 |
| 2.1.5 | Masini si utilaje pentru industria textila | 8-15 |
| 2.1.6 | Masini si utilaje pentru industria lemnului | 8-18 |
| 2.1.17 | Masini si utilaje pentru tipar/editare | 5-10 |

### Grupa 3 -- Aparate si Instalatii de Masurare (Measurement Instruments)

| Subgrupa | Description | Useful Life (years) |
|----------|-------------|---------------------|
| 3.1 | Aparate de masura si control | 5-15 |
| 3.2 | Aparate si instrumente medicale | 4-12 |
| 3.3 | Aparate si instrumente optice | 6-12 |

### Grupa 4 -- Mijloace de Transport (Vehicles)

| Subgrupa | Description | Useful Life (years) |
|----------|-------------|---------------------|
| 4.1 | Autoturisme | 4-6 |
| 4.2 | Autobuze si microbuze | 6-9 |
| 4.3 | Autocamioane si autoutilitare | 5-8 |
| 4.4 | Autovehicule speciale | 4-8 |
| 4.5 | Tractoare | 6-10 |
| 4.6 | Remorci si semiremorci | 5-8 |
| 4.7 | Motociclete, scutere | 4-6 |
| 4.8 | Biciclete | 3-5 |
| 4.9 | Ambarcatiuni | 6-15 |

### Grupa 5 -- Animale si Plantatii

| Subgrupa | Description | Useful Life (years) |
|----------|-------------|---------------------|
| 5.1 | Animale de munca | 6-10 |
| 5.2 | Animale de reproductie | 3-6 |
| 5.3 | Plantatii pomicole | 12-30 |
| 5.4 | Plantatii viticole | 15-25 |

### Grupa 6 -- Mobilier, Birotica, Protectie (Furniture, Office Equipment)

| Subgrupa | Description | Useful Life (years) |
|----------|-------------|---------------------|
| 6.1 | Mobilier | 5-16 |
| 6.2 | Aparatura birotica | 3-8 |
| 6.3 | Sisteme de protectie | 4-12 |
| 6.4 | Alte active corporale | 3-12 |

### Grupa Specifica -- IT si Software

| Asset | Useful Life (years) | Account |
|-------|---------------------|---------|
| Calculatoare (computers) | 2-4 | 214 |
| Servere | 3-5 | 214 |
| Imprimante/Scanere | 2-5 | 214 |
| Echipamente retea (networking) | 3-5 | 2131 |
| Software achizitionat | 3 (or license period) | 2052 |
| Software dezvoltat intern | 3 (or estimated useful life) | 2052 |
| Licente pe durata determinata | Durata licentei | 205 |
| Licente pe durata nedeterminata | 5 | 205 |
| Fond comercial (goodwill) | Max 5 (or up to 10 with justification) | 207 |

---

## Special Depreciation Rules

### Autoturisme (Cars)
- Depreciation base limited to 1,500 EUR equivalent (approx 7,500 RON) for non-luxury
- No limit for cars used exclusively for business (taxi, driving school, rental)
- 50% TVA deductibility unless exclusively for business
- Fuel at 50% deductibility unless exclusively for business
- These are FISCAL limits -- accounting depreciation can be on full value

### Reevaluare (Revaluation)
- Optional, per OMFP 1802/2014
- Must apply to entire class of assets (not cherry-pick)
- Surplus goes to account 105 (Rezerve din reevaluare)
- Deficit goes to P&L (6813) unless reversing a previous surplus
- Revalued amount becomes new depreciation base

### Imobilizari in Curs (Assets Under Construction)
- Account 223 -- NOT depreciated
- Transferred to appropriate asset account upon completion
- Depreciation begins from the month of commissioning (punere in functiune)

---

## Fixed Asset Lifecycle in Costify

### 1. Acquisition (Achizitie)
```
%               = 404 Furnizori de imobilizari   (total cu TVA)
  2xxx Asset       (valoare neta)
  4426 TVA ded.    (TVA)
```

### 2. Commissioning (Punere in Functiune)
- Record PV (Proces Verbal) de receptie
- Assign depreciation method, useful life, location
- Start date for depreciation = month of commissioning

### 3. Monthly Depreciation (Amortizare Lunara)
```
6811 Cheltuieli cu amortizarea = 28xx Amortizarea    (rata lunara)
```

### 4. Revaluation (Reevaluare) -- Optional
```
Surplus:
21xx Asset = 105 Rezerve din reevaluare

Deficit (no prior surplus):
6813 Cheltuieli = 21xx Asset
```

### 5. Impairment (Depreciere)
```
6813 Cheltuieli cu ajustarile = 291 Ajustari pentru deprecierea imobilizarilor
```

### 6. Disposal -- Sale (Vanzare)
```
Receipt of payment:
461 Debitori diversi / 4111 Clienti = %
  7583 Venituri din vanzarea activelor  (pret fara TVA)
  4427 TVA colectata                     (TVA)

Derecognition:
%                   = 21xx Asset         (valoare bruta)
  28xx Amortizarea     (amortizare cumulata)
  6583 Cheltuieli      (valoare ramasa neamortizata)
```

### 7. Disposal -- Scrapping (Casare)
```
Fully depreciated:
28xx Amortizarea = 21xx Asset   (valoare bruta = amortizare cumulata)

Not fully depreciated:
%                   = 21xx Asset
  28xx Amortizarea     (amortizare cumulata)
  6583 Cheltuieli      (valoare ramasa -- pierdere)
```

### 8. Transfer Between Locations
- No accounting entry (same entity)
- Update fixed asset register (registrul mijloacelor fixe)
- Update responsible person (gestionar)

---

## Registrul Mijloacelor Fixe (Fixed Asset Register)

Mandatory register containing for each asset:
- Numar de inventar (inventory number)
- Denumire (description)
- Data achizitiei / punerii in functiune
- Valoare de intrare
- Durata normala de functionare
- Metoda de amortizare
- Amortizare cumulata
- Valoare ramasa (net book value)
- Locatie / gestionar
- Data si modalitatea iesirii din evidenta

Costify must maintain this register per tenant as a core feature.

---

## Fiscal vs Accounting Depreciation

Romanian law allows differences between:
- **Amortizare contabila** -- per accounting policy (OMFP 1802/2014)
- **Amortizare fiscala** -- per Cod Fiscal Art. 28

When they differ, a **diferenta temporara** arises, tracked for:
- Deferred tax calculation (if applicable under IFRS or OMFP)
- Fiscal result adjustment in D101

Common differences:
| Situation | Accounting | Fiscal |
|---|---|---|
| Car value cap | Full cost depreciated | Limited to threshold |
| Accelerated method | Not used | Used (with ANAF approval) |
| Useful life choice | Entity policy | Catalog range midpoint |
| Revaluation | Revalued amount | Original cost (or revalued if filed) |
