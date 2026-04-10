# Citeste balanta de verificare

Balanta de verificare este **raportul central** pe care il vei consulta cel mai des in Costify. Este un tabel care arata toate conturile contabile ale firmei tale, cu solduri initiale, rulaje ale lunii si solduri finale.

## Ce este balanta de verificare

Daca registrul jurnal este "lista tuturor tranzactiilor in ordine cronologica", balanta de verificare este **aceeasi lista grupata pe conturi** cu sume agregate. Este o "fotografie" a contabilitatii la o anumita data.

Pe scurt: `SUM() + GROUP BY cont` pe intregul jurnal.

Pentru explicatia conceptuala completa a ceea ce inseamna balanta in sens contabil, vezi [Balanta de verificare (bazele)](./balanta-de-verificare.md).

Acest articol e despre **cum o folosesti** in Costify.

## Deschide tab-ul Balanta

Pe pagina oricarui client, al doilea tab este **"Balanta de Verificare"**. Apasa-l.

Daca e primul tau vizit, Costify iti afiseaza automat balanta pentru **luna curenta**. Daca jurnalul nu are date in luna curenta, iti arata luna cea mai recenta cu date.

## Selectorul de perioada

Sus pe pagina apare un selector **An + Luna**. Il folosesti pentru a naviga intre perioade.

```
An:  [2025 ▼]      Luna:  [Decembrie ▼]
```

Cand schimbi anul sau luna, Costify **recalculeaza** balanta live — nu e cache. Dureaza 50-300ms pentru firmele tipice.

**Important**: balanta este intotdeauna **cumulativa** pana la sfarsitul lunii selectate. Adica "Decembrie 2025" include toate operatiile de la 1 ianuarie 2025 pana la 31 decembrie 2025, nu doar cele din decembrie.

## Structura tabelului

Tabelul balantei are multe coloane. Hai sa le explicam pe toate:

### Coloane de identificare

- **Cont** — codul contului (ex: `401`, `5121.BT`, `6028.01`)
- **Denumire** — numele contului (ex: "Furnizori", "BT Cont Principal")
- **Tip** — A (Activ), P (Pasiv) sau B (Bifunctional)

### Coloane de solduri initiale (1 ianuarie al anului selectat)

- **Sold Initial D** — soldul debitor la inceputul anului
- **Sold Initial C** — soldul creditor la inceputul anului

Pentru un cont normal de activ (ex: 5121), sold initial D este valoarea din banca la 1 ianuarie. Pentru un cont normal de pasiv (ex: 401), sold initial C este datoria la furnizori la 1 ianuarie.

### Coloane de rulaje precedente (de la 1 ianuarie pana inainte de luna selectata)

- **Rulaj Prec D** — debit cumulat pe lunile anterioare
- **Rulaj Prec C** — credit cumulat pe lunile anterioare

Daca ai selectat Decembrie 2025, aceste coloane arata miscarile din ianuarie-noiembrie 2025.

### Coloane de rulaje luna curenta

- **Rulaj D** — debit al lunii selectate
- **Rulaj C** — credit al lunii selectate

Acestea sunt **doar miscarile lunii in care esti**. Pentru Decembrie 2025, sunt miscarile din decembrie.

### Coloane de rulaje totale (year-to-date)

- **Rulaj Total D** — debit cumulat ianuarie pana la sfarsitul lunii selectate
- **Rulaj Total C** — credit cumulat ianuarie pana la sfarsitul lunii selectate

Matematic: `Rulaj Total D = Rulaj Prec D + Rulaj D`.

### Coloane de totaluri

- **Total Debit** — sold initial + rulaj total = debit total pentru an
- **Total Credit** — sold initial + rulaj total = credit total pentru an

### Coloane de solduri finale (la sfarsitul lunii selectate)

- **Sold Final D** — daca totalul debit > total credit
- **Sold Final C** — daca totalul credit > total debit

Pentru orice cont, unul din aceste doua e **zero** si celalalt e diferenta. Un cont de activ normal are sold final D (ex: 5121 are bani in banca). Un cont de pasiv normal are sold final C (ex: 401 datoreaza la furnizori).

## KPI-urile deasupra tabelului

Deasupra tabelului de balanta apar **8 carduri KPI** cu cei mai importanti indicatori:

1. **Cash & Banca** — totalul in banca si casa
2. **Creante clienti** — cat au clientii de platit
3. **Datorii furnizori** — cat ai de platit la furnizori
4. **TVA de plata** — cat ai datorie la ANAF pentru TVA
5. **Venituri totale** — totalul veniturilor cumulate pe an
6. **Cheltuieli totale** — totalul cheltuielilor cumulate pe an
7. **Rezultat** — venituri minus cheltuieli (verde daca pozitiv, rosu daca negativ)
8. **Marja operationala** — rezultat / venituri x 100 (in procente)

Pentru explicatii detaliate, vezi [Intelege KPI-urile](./intelege-kpi.md).

## Toggle-ul "Analitice / Toate"

Sub selectorul de perioada este un toggle:

```
[ Analitice ]  [ Toate ]
```

- **Analitice** (default) — afiseaza doar conturile "frunza" (leaf): conturile care nu au sub-conturi. Exemplu: vezi `401.00023` si `401.00045` dar nu `401` agregat.
- **Toate** — afiseaza si conturile sintetice (parinte) cu sumele agregate. Exemplu: vezi `401` = `401.00023 + 401.00045 + ...`.

**Cand sa folosesti fiecare**:
- Pentru **detaliu** (sa vezi fiecare cont analitic exact): Analitice
- Pentru **privire de ansamblu** (sa vezi conturile sintetice mari): Toate
- Pentru **verificarea OMFP 1802** (unde apar doar sintetice): Toate

## Cautarea

Bara de cautare din dreapta sus filtreaza tabelul in timp real:

```
🔍 Cauta cont sau denumire...
```

Poti cauta dupa:
- **Cod cont**: `401`, `5121`, `6028`
- **Parte din cod**: `40` arata toate conturile din clasa 40xx
- **Denumire**: `furnizori`, `banca`, `salarii`
- **Text partial**: `chir` arata toate conturile care contin "chir" (chirii, chirii birou, etc.)

Cautarea este case-insensitive si diacritic-insensitive.

## Conturile nemapate

Daca vezi **triunghiuri galbene** langa unele randuri, acele conturi sunt **nemapate** — Costify nu le recunoaste in planul de conturi standard.

Exemple:
- `6588` — daca nu avem acest cont in catalogul nostru, va aparea ca "Cont 6588" cu triunghi galben
- `401.XYZ12` — daca Saga nu a exportat numele analitic, va aparea fara denumire

Deasupra tabelului apare o sectiune expandabila **"⚠ Conturi nemapate (N)"** cu lista tuturor acestor conturi. Apasa pentru a vedea toata lista.

**Ce sa faci cu ele**:
- **Pentru acum**: nu se afecteaza calculele. Balanta ramane corecta, doar afisarea este generica.
- **In viitor**: vom avea un ecran de management Plan de conturi unde poti mapa manual aceste conturi la denumiri proprii. Vezi [Maparea conturilor](./maparea-conturilor.md) (in dezvoltare).

## Interpretarea datelor

### Verificarea ca balanta "inchide"

In contabilitate, regula fundamentala este: **Total Debit = Total Credit** pe intregul jurnal. Asta garanteaza ca principiul dublei inregistrari este respectat.

Daca faci `SUM(Total Debit)` pe toate conturile si `SUM(Total Credit)` pe toate conturile, valorile trebuie sa fie **egale**. Daca nu sunt, exista o eroare in jurnal.

In Costify, jos in tabel (in dezvoltare) va aparea un rand de **TOTAL** cu ambele sume si un indicator verde/rosu daca sunt egale. Pentru acum, poti verifica manual sau intreba Costi AI.

### Verificari pe categorii

Grupul de conturi | Ce arata
---|---
**1xx** | Capital, rezerve, rezultat reportat, profit/pierdere curenta
**2xx** | Imobilizari (terenuri, cladiri, echipamente) si amortizari (28x)
**3xx** | Stocuri (materii prime, marfuri, produse finite)
**4xx** | Conturi cu terti (furnizori 40x, clienti 41x, salarii 42x, impozite 44x, asociati 45x)
**5xx** | Trezorerie (banci 512x, casa 53x, credite 519x)
**6xx** | Cheltuieli pe an (se inchid in 121 la sfarsitul anului)
**7xx** | Venituri pe an (se inchid in 121 la sfarsitul anului)

Pentru intelegerea profunda a conturilor, vezi [Clasele de conturi](./clase-de-conturi.md) si [Planul de conturi](./plan-de-conturi.md).

## Trucuri

### Trucul 1: Balanta a doua luni consecutive

Pentru a vedea **diferenta intre doua luni**, deschide tab-ul Balanta in doua ferestre de browser:

- Fereastra 1: selectat Decembrie 2025
- Fereastra 2: selectat Noiembrie 2025

Compara manual.

In versiuni viitoare vom avea functie de "comparatie perioade" direct in UI.

### Trucul 2: Export in Excel

In planificare: **buton de Export XLSX** care descarca balanta in format Excel cu toate coloanele. Util pentru prezentari la conducere sau pentru arhiva.

### Trucul 3: Verificare cu Saga

Un test bun: **compara balanta din Costify cu cea din Saga** pentru aceeasi perioada. Ar trebui sa fie identice (sau cu mici diferente, pe care le documentam in [Intrebari contabil](./intrebari-contabil-plan-conturi.md)).

Daca diferentele sunt mari, ceva e gresit — contacteaza echipa.

### Trucul 4: Intreaba Costi

Costi AI are acces direct la balanta si poate raspunde la intrebari de tipul:

- "Care e cel mai mare cont de cheltuieli in decembrie?"
- "Ce cont are sold debitor peste 100.000 RON?"
- "Arata-mi toate conturile din clasa 62xx ordonate descrescator"
- "Care e totalul TVA-ului deductibil pentru Q4 2025?"

## Urmatori pasi

- [Analizeaza Cont Profit si Pierdere](./analizeaza-cpp.md) — tab-ul CPP
- [Intelege KPI-urile](./intelege-kpi.md) — ce inseamna cei 8 indicatori
- [Foloseste asistentul Costi](./foloseste-costi.md) — cum sa intrebi despre balanta in limbaj natural
