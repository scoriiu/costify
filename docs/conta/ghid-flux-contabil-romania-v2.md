# Ghid complet: Fluxul contabil in Romania — pentru programatori

## De la documentul justificativ la situatiile financiare — cu detalii tehnice de implementare

---

## Cuprins

1. [Imaginea de ansamblu](#1-imaginea-de-ansamblu)
2. [Documentul justificativ](#2-documentul-justificativ)
3. [Nota contabila (articolul contabil)](#3-nota-contabila)
4. [Registrul Jurnal — structura si procesare](#4-registrul-jurnal)
5. [Parsarea Registrului Jurnal din XLSX](#5-parsarea-registrului-jurnal-din-xlsx)
6. [Nota contabila compusa (compound entries)](#6-nota-contabila-compusa)
7. [Inchiderea de luna si detectia post-closing](#7-inchiderea-de-luna)
8. [Clasificarea conturilor — tipuri A/P/B](#8-clasificarea-conturilor)
9. [Planul de conturi: clase, grupe, conturi sintetice si analitice](#9-planul-de-conturi)
10. [Calculul balantei de verificare din jurnal](#10-calculul-balantei-de-verificare)
11. [Inchiderea de an — conturile de rezultat](#11-inchiderea-de-an)
12. [Cartea Mare / Fise de cont](#12-cartea-mare)
13. [Balanta de verificare — structura completa](#13-balanta-de-verificare)
14. [Bilantul contabil (F10 ANAF)](#14-bilantul-contabil)
15. [Contul de Profit si Pierdere (CPP)](#15-contul-de-profit-si-pierdere)
16. [Clasificarea pe verticale de business](#16-clasificarea-pe-verticale)
17. [Extragerea partenerilor din jurnal](#17-extragerea-partenerilor)
18. [Categorii de costuri si reguli de matching](#18-categorii-de-costuri)
19. [Extragerea informatiilor utile](#19-extragerea-informatiilor)
20. [Indicatori financiari (KPI)](#20-indicatori-financiari)
21. [Pipeline-ul complet de procesare](#21-pipeline-ul-complet)
22. [Formate de numere si normalizare](#22-formate-de-numere)
23. [Edge cases si cazuri speciale](#23-edge-cases)
24. [Glosar rapid](#24-glosar)

---

## 1. Imaginea de ansamblu

Gandeste-te la contabilitate ca la un **ETL pipeline** (Extract-Transform-Load). Datele brute (documentele) intra in sistem, trec prin transformari succesive, si la final se produc rapoarte standardizate.

```
DOCUMENT JUSTIFICATIV (factura, chitanta, extras de cont...)
        |
        v
NOTA CONTABILA (articolul contabil — "inregistrarea")
    = traducerea documentului in limbaj contabil: conturi + sume
        |
        v
REGISTRUL JURNAL (toate notele contabile, in ordine cronologica)
    = baza de date bruta, un tabel cu TOATE tranzactiile
    = SINGLE SOURCE OF TRUTH — din el se pot reconstitui toate celelalte
        |
        v
CARTEA MARE / FISE DE CONT (aceleasi note, dar grupate pe conturi)
    = GROUP BY cont_contabil — acelasi dataset, alta perspectiva
        |
        v
BALANTA DE VERIFICARE (sinteza tuturor conturilor: solduri + rulaje)
    = un SUM() + GROUP BY pe intregul jurnal
    = "tabloul de bord" al contabilitatii
        |
        v
SITUATII FINANCIARE
    ├── BILANT (Active = Datorii + Capital — o "fotografie" la un moment dat)
    ├── CONT DE PROFIT SI PIERDERE (Venituri - Cheltuieli = Rezultat)
    └── Alte rapoarte (cash-flow, note explicative)
```

**Regula fundamentala:** Fiecare etapa preia datele de la etapa anterioara si le reorganizeaza. Registrul Jurnal este cel mai granular — daca ai acces la el, poti reconstitui TOTUL.

---

## 2. Documentul justificativ

**Ce este:** Orice document (hartie sau electronic) care dovedeste ca s-a intamplat ceva din punct de vedere economic.

**Exemple concrete:**
- **Factura** — primita de la un furnizor sau emisa catre un client
- **Chitanta** — dovada unei plati in numerar
- **Extrasul de cont bancar** — miscarile de bani din contul bancar
- **Bonul fiscal** — o achizitie de la magazin
- **Statul de plata** — pentru salarii
- **Procesul-verbal de receptie** — la primirea unui echipament

**Regula de aur:** Nicio inregistrare contabila nu se face fara un document justificativ. Documentul este "dovada" ca operatiunea a avut loc. Gandeste-te la el ca la un `source_id` — fiecare rand din jurnal trebuie sa aiba o referinta la documentul care l-a generat.

---

## 3. Nota contabila

**Ce este:** "Traducerea" documentului justificativ in limbajul contabilitatii.

**Principiul partidei duble:** Fiecare operatiune afecteaza minimum doua conturi — unul se **debiteaza**, altul se **crediteaza**. Suma debitului trebuie sa fie **intotdeauna egala** cu suma creditului.

> Gandeste-te la partida dubla ca la o tranzactie bancara: cand transferi bani, contul tau scade (credit) si contul destinatarului creste (debit). Suma totala din sistem ramane aceeasi.

**Exemplu concret — Achizitia unui laptop de 5.000 lei + TVA 19% (950 lei):**

Un singur document (factura) genereaza o nota contabila cu doua linii:

| Cont debitat | Cont creditat | Suma |
|---|---|---|
| 214 "Mobilier, aparatura birotica" | 404 "Furnizori de imobilizari" | 5.000 lei |
| 4426 "TVA deductibila" | 404 "Furnizori de imobilizari" | 950 lei |

**Tradus in limbaj de programator:**
```
// Firma a primit un laptop (activ +5.000)
// Firma are dreptul sa deduca TVA (+950)
// Firma datoreaza furnizorului totalul (datorie +5.950)

debit(214, 5000)   // creste valoarea echipamentelor
credit(404, 5000)  // creste datoria catre furnizor

debit(4426, 950)   // creste TVA de recuperat
credit(404, 950)   // creste datoria catre furnizor
```

**Important:** Un singur document poate genera **mai multe** note contabile in timp. Laptopul de mai sus va genera lunar o nota de **amortizare** (uzura):

| Cont debitat | Cont creditat | Suma |
|---|---|---|
| 6811 "Cheltuieli cu amortizarea" | 2814 "Amortizarea imobilizarilor" | ~139 lei/luna |

Deci din factura de laptop rezulta:
1. Nota de achizitie (o singura data)
2. Note de amortizare (lunar, timp de 36 de luni)

---

## 4. Registrul Jurnal — structura si procesare

**Ce este:** "Baza de date" a contabilitatii. Toate notele contabile, puse una dupa alta, in ordine cronologica.

### 4.1 Structura unui rand din Registrul Jurnal

Fiecare rand (linie) din jurnal reprezinta o **miscare contabila atomica**: un cont debitat, un cont creditat, o suma.

In sistemul nostru, structura este:

```typescript
interface JournalEntry {
  // Identificare temporala
  data: Date;              // Data operatiunii
  year: number;            // Anul (extras din data)
  month: number;           // Luna (extrasa din data)

  // Referinta document
  ndp: string;             // Numar document primar (ex: "FV-1234", "EC-001")

  // Conturile afectate
  contD: string;           // Cont DEBIT — complet, cu analitic (ex: "401.00023")
  contDBase: string;       // Cont DEBIT — doar baza, fara analitic (ex: "401")
  contC: string;           // Cont CREDIT — complet (ex: "5121.00001")
  contCBase: string;       // Cont CREDIT — doar baza (ex: "5121")

  // Valoarea
  suma: number;            // Suma in RON (intotdeauna pozitiva)

  // Descriere
  explicatie: string;      // Text liber — descrie operatiunea
  felD: string;            // Tip operatie (ex: "PLATA", "FACTURA")

  // Campuri optionale
  categorie: string | null;  // Cod categorie (daca exista)
  cod: string | null;        // Cod partener (CUI, cod intern)
  validat: string | null;    // Marker de validare
  tva: number | null;        // Valoare TVA (informativ)
  tip: string | null;        // "S" = storno/extrabilan, altfel normal
}
```

### 4.2 Relatia cont complet vs. cont baza

Aceasta distinctie este **critica** pentru procesare:

```
contD = "401.00023"    →  contDBase = "401"
contC = "5121.00001"   →  contCBase = "5121"
contD = "6811"         →  contDBase = "6811"   (fara punct = e deja baza)
contD = "4111.ROCHE"   →  contDBase = "4111"   (poate fi si text dupa punct)
```

**Regula:** Tot ce e INAINTE de punct = contul sintetic (baza). Tot ce e DUPA punct = contul analitic (detaliu).

Contul baza determina **tipul** contului si in ce raport financiar apare. Contul analitic determina **partenerul** sau **detaliul** (care furnizor, care client, care centru de cost).

### 4.3 Exemplu de Registru Jurnal (pentru o saptamana)

| Nr. | Data | Document | Explicatie | Cont Debit | Cont Credit | Suma (lei) |
|---|---|---|---|---|---|---|
| 1 | 03.03 | FV-1234 | Achizitie laptop | 214 | 404 | 5.000 |
| 2 | 03.03 | FV-1234 | TVA deductibila laptop | 4426 | 404 | 950 |
| 3 | 04.03 | FC-501 | Vanzare servicii Client X | 4111.001 | 704.01 | 10.000 |
| 4 | 04.03 | FC-501 | TVA colectata | 4111.001 | 4427 | 1.900 |
| 5 | 05.03 | EC-001 | Plata chirie birou | 612.01 | 5121.001 | 3.000 |
| 6 | 07.03 | SP-03 | Salarii luna februarie | 641 | 421 | 15.000 |

**Observatie importanta:** Randurile 3-4 au conturi analitice (4111.001, 704.01, 5121.001). La procesare, le grupezi dupa `contBase` cand vrei sinteza, sau dupa contul complet cand vrei detaliu pe partener/serviciu.

### 4.4 De ce Registrul Jurnal este cel mai important

- Este **obligatoriu** conform Legii contabilitatii nr. 82/1991
- Este **single source of truth** — din el se pot calcula TOATE celelalte rapoarte
- In proiectul nostru, intregul pipeline porneste de la jurnal: `jurnal → balanta → bilant + CPP`

---

## 5. Parsarea Registrului Jurnal din XLSX

In practica, registrul jurnal vine ca fisier **Excel (.xlsx)**. Parsarea lui este non-triviala din cauza variatiilor de format intre programele de contabilitate.

### 5.1 Detectia sheet-ului corect

Fisierul XLSX poate contine mai multe sheet-uri. Se cauta sheet-ul care contine "Registru" in nume (case-insensitive). Daca nu gaseste, se ia primul sheet.

### 5.2 Detectia coloanelor (header aliases)

Programele de contabilitate folosesc denumiri diferite pentru aceleasi coloane. Sistemul recunoaste urmatoarele alias-uri:

| Coloana logica | Alias-uri acceptate |
|---|---|
| **Data** | `data`, `date`, `data_doc`, `data_document`, `data_inregistrare` |
| **Numar document** | `ndp`, `nr_doc`, `document`, `tip_document`, `numar_document` |
| **Cont debit** | `cont_d`, `cont_debit`, `debit_cont`, `simbol_debit` |
| **Cont credit** | `cont_c`, `cont_credit`, `credit_cont`, `simbol_credit` |
| **Suma** | `suma`, `valoare`, `amount`, `value`, `suma_ron` |
| **Explicatie** | `explicatie`, `descriere`, `description`, `observatii` |
| **Categorie** (optional) | `categorie` |
| **Cod partener** (optional) | `cod` |
| **Validare** (optional) | `validat` |
| **TVA** (optional) | `tva` |
| **Tip** (optional) | `tip` — valoarea "S" = intrare extrabilantiara / storno |
| **Denumire cont D** (optional) | `denumire_d` — numele contului debit |
| **Denumire cont C** (optional) | `denumire_c` — numele contului credit |

**Coloane obligatorii:** `data`, `cont_d`, `cont_c`, `suma`. Daca lipseste oricare, parsarea esueaza.

### 5.3 Procesarea randurilor

Pentru fiecare rand din Excel:

```
1. Citeste data → parseaza in Date object, extrage year si month
2. Citeste contD si contC → extrage contDBase si contCBase (taie dupa punct)
3. Citeste suma → normalizeaza formatul (vezi sectiunea 22)
4. Citeste explicatia, ndp, felD
5. Daca exista coloane optional (categorie, cod, validat, tva, tip) → le preia
6. Daca exista denumire_d / denumire_c → le salveaza intr-un Map<cont, denumire>
7. Verifica daca randul face parte dintr-o nota compusa (vezi sectiunea 6)
8. Verifica daca randul e un post-closing entry (vezi sectiunea 7)
```

### 5.4 Extragerea denumirilor de conturi

Daca XLSX-ul contine coloane `denumire_d` si `denumire_c`, se construieste automat un **Map<string, string>** care mapeaza contul complet la denumirea lui:

```typescript
// accountNames: Map<string, string>
// "401.00023" → "ORANGE ROMANIA SA"
// "5121.001" → "BCR - cont curent RON"
// "704.01" → "Venituri consultanta IT"
```

Acest map e util pentru afisare — conturile sunt coduri numerice, iar utilizatorul vrea sa vada denumiri.

---

## 6. Nota contabila compusa (compound entries)

Aceasta este una din cele mai complicate parti ale parsarii. In contabilitate, exista doua tipuri de note:

### 6.1 Nota simpla

Un cont debit, un cont credit, o suma. Un singur rand in jurnal.

```
Debit: 5121 (Banca)     Credit: 4111 (Clienti)     Suma: 11.900 lei
```

### 6.2 Nota compusa

Un cont e FIX (acelasi pe mai multe randuri), celalalt variaza. Se marcheaza cu **"%"** (simbol special) in coloana contului fix, pe randul-antet.

**Exemplu — O factura cu 3 pozitii:**

Furnizorul Orange emite o factura cu: servicii telecom 200 lei + internet 150 lei + TVA 66,50 lei.

In jurnal, asta apare ca o **nota compusa cu credit fix**:

```
Rand 1 (ANTET):  contD = "%"     contC = "401.ORANGE"  suma = 416.50  (totalul)
Rand 2 (DETALIU): contD = "626"   contC = ""            suma = 200.00  (telecom)
Rand 3 (DETALIU): contD = "626.1" contC = ""            suma = 150.00  (internet)
Rand 4 (DETALIU): contD = "4426"  contC = ""            suma = 66.50   (TVA)
```

**Cum se proceseaza:**

Parserul transforma nota compusa in **note simple** (explodate):

```
→ contD = "626",   contC = "401.ORANGE", suma = 200.00
→ contD = "626.1", contC = "401.ORANGE", suma = 150.00
→ contD = "4426",  contC = "401.ORANGE", suma = 66.50
```

Adica fiecare rand de detaliu primeste contul fix (credit-ul) din antet.

### 6.3 Cele doua forme de note compuse

| Forma | Antet | Detalii | Ce se "copiaza" |
|---|---|---|---|
| **Debit fix** | contD = cont fix, contC = "%" | contC variaza | contD din antet → toate detaliile |
| **Credit fix** | contD = "%", contC = cont fix | contD variaza | contC din antet → toate detaliile |

### 6.4 Algoritmul de parsare

```
pending_buffer = []
current_header = null

pentru fiecare rand:
  daca contD == "%" sau contC == "%":
    // E un rand-antet de nota compusa
    flush(pending_buffer)  // proceseaza ce era inainte
    current_header = { fixed_side, fixed_account, total }
    pending_buffer = []
  
  altfel daca current_header != null si randul are un cont gol:
    // E un rand-detaliu — il adaugam in buffer
    pending_buffer.push(rand)
  
  altfel:
    // Nota simpla normala
    flush(pending_buffer)
    current_header = null
    emit(rand)  // adaugam direct in lista de JournalEntry

flush(buffer):
  daca current_header == null: return
  pentru fiecare rand din buffer:
    rand.contul_gol = current_header.fixed_account
    emit(rand)
```

**De ce exista un buffer:** In unele fisiere XLSX, ordinea poate fi: detalii INAINTE de antet (invers). Buffer-ul permite acumularea detaliilor si completarea lor cand apare antetul.

---

## 7. Inchiderea de luna si detectia post-closing

### 7.1 Ce este inchiderea de luna

La sfarsitul fiecarei luni, contabilul face o "inchidere" — o nota contabila speciala care totalizeaza anumite operatiuni. In jurnal, aceasta apare ca o inregistrare cu explicatia care contine **"Inchidere luna"** (sau variante).

### 7.2 Problema post-closing entries

Uneori, dupa inchiderea lunii martie (de exemplu), mai apar inregistrari cu data tot din martie. Aceste intrari sunt de fapt **ale lunii aprilie** — au fost inregistrate cu intarziere.

### 7.3 Cum se detecteaza si se trateaza

```
1. Gaseste ultima inregistrare cu "Inchidere luna" din luna curenta
2. Toate inregistrarile cu data din aceeasi luna DAR dupa pozitia inchiderii
   → se considera ca apartin lunii urmatoare
3. Li se seteaza month = month + 1 (si year daca e cazul)
```

**Exemplu:**

```
Rand 100: 31.03.2024, "Inchidere luna martie"
Rand 101: 31.03.2024, "Factura primita cu intarziere"  ← data zice martie
                                                         DAR e DUPA inchidere
                                                         → se muta in APRILIE
```

Aceasta logica este importanta pentru rapoartele lunare — fara ea, cifrele pe martie ar fi incorecte.

---

## 8. Clasificarea conturilor — tipuri A/P/B

Fiecare cont contabil are un **tip** care determina cum se interpreteaza soldul sau. Aceasta clasificare este fundamentala pentru toate calculele.

### 8.1 Cele trei tipuri

| Tip | Denumire | Sold normal | Inseamna |
|---|---|---|---|
| **A** | Activ | Debitor | Contul creste pe debit, scade pe credit |
| **P** | Pasiv | Creditor | Contul creste pe credit, scade pe debit |
| **B** | Bifunctional | Depinde | Poate fi activ SAU pasiv, in functie de sold |

### 8.2 Regulile de clasificare

```typescript
function getAccountType(contBase: string): "A" | "P" | "B" {

  // CLASA 1 — Capitaluri → de regula PASIV
  if (contBase.startsWith("1")) {
    if (contBase === "129") return "A";  // Exceptie: repartizarea profitului
    return "P";
  }

  // CLASA 2 — Imobilizari → de regula ACTIV
  if (contBase.startsWith("2")) {
    // Exceptii: amortizarile si deprecierile sunt PASIV
    // (ele reduc valoarea activelor)
    if (contBase.startsWith("28")) return "P";   // 280x, 281x = amortizari
    if (contBase.startsWith("29")) return "P";   // 290x, 291x = deprecieri
    return "A";
  }

  // CLASA 3 — Stocuri → de regula ACTIV
  if (contBase.startsWith("3")) {
    if (contBase.startsWith("39")) return "P";   // 390x = provizioane stocuri
    return "A";
  }

  // CLASA 4 — Terti → BIFUNCTIONAL (depinde de sold)
  if (contBase.startsWith("4")) {
    return "B";
  }

  // CLASA 5 — Trezorerie → de regula ACTIV
  if (contBase.startsWith("5")) {
    if (contBase === "519") return "P";  // Credite bancare pe termen scurt
    return "A";
  }

  // CLASA 6 — Cheltuieli → ACTIV (cresc pe debit)
  if (contBase.startsWith("6")) return "A";

  // CLASA 7 — Venituri → PASIV (cresc pe credit)
  if (contBase.startsWith("7")) return "P";

  // CLASA 8 — Conturi speciale → ACTIV
  if (contBase.startsWith("8")) return "A";

  return "A"; // fallback
}
```

### 8.3 Conturile bifunctionale (clasa 4) — explicatie detaliata

Conturile din clasa 4 (Terti) sunt speciale: acelasi cont poate avea sold debitor SAU creditor, si interpretarea se schimba:

- **Sold debitor** → **Creanta** (cineva iti datoreaza bani) → apare in **ACTIV** pe bilant
- **Sold creditor** → **Datorie** (tu datorezi bani) → apare in **PASIV** pe bilant

**Exemple de conturi bifunctionale:**

| Cont | Denumire | Sold D = | Sold C = |
|---|---|---|---|
| 4111 | Clienti | Clientul iti datoreaza | Ai incasat in avans |
| 401 | Furnizori | Ai platit in avans | Datorezi furnizorului |
| 4311 | Contrib. asig. sociale | Ai platit in avans la stat | Datorezi statului |
| 4411-4428 | Impozite si taxe | Ai platit in avans | Datorezi statului |
| 4551 | Actionari - dividende | Actionarul datoreaza | Datorezi dividende |

**In cod, clasificarea la runtime:**

```typescript
if (accountType === "B") {
  if (sold_final > 0) {
    // sold debitor → e o creanta → merge in ACTIV
    bilant.activ.push(row);
  } else {
    // sold creditor → e o datorie → merge in PASIV
    bilant.pasiv.push(row);
  }
}
```

### 8.4 De ce conteaza tipul contului

Tipul determina:
1. **Cum se calculeaza soldul net:** `A` → `sold = debit - credit`, `P` → `sold = credit - debit`
2. **Unde apare in bilant:** `A` → Activ, `P` → Pasiv
3. **Cum se interpreteaza:** Un sold pozitiv pe un cont A inseamna ca firma DETINE ceva; pe un cont P inseamna ca firma DATOREAZA ceva

---

## 9. Planul de conturi: clase, grupe, conturi sintetice si analitice

Planul de conturi este "schema" contabilitatii — defineste TOATE conturile posibile. In Romania e reglementat de **OMFP 1802/2014**.

### 9.1 Ierarhia: Clasa → Grupa → Cont sintetic → Cont analitic

```
CLASA 6 — Cheltuieli
├── GRUPA 60 — Cheltuieli cu stocurile
│   ├── 601 — Cheltuieli cu materiile prime         (sintetic grad I, 3 cifre)
│   ├── 602 — Cheltuieli cu materialele consumabile (sintetic grad I)
│   │   ├── 6021 — Cheltuieli cu materialele auxiliare    (sintetic grad II, 4 cifre)
│   │   ├── 6022 — Cheltuieli privind combustibilul       (sintetic grad II)
│   │   │   ├── 6022.01 — Combustibil electric            (ANALITIC — creat de firma)
│   │   │   └── 6022.02 — Combustibil benzina             (ANALITIC)
│   │   ├── 6024 — Cheltuieli privind piesele de schimb   (sintetic grad II)
│   │   └── 6028 — Cheltuieli privind alte mat. consumabile
│   │       ├── 6028.PAPETARIE — Papetarie                (ANALITIC cu cod text)
│   │       └── 6028.IT — Consumabile IT                  (ANALITIC)
│   └── 607 — Cheltuieli privind marfurile
├── GRUPA 61 — Cheltuieli cu lucrarile si serviciile
│   ├── 611 — Cheltuieli cu intretinerea si reparatiile
│   ├── 612 — Cheltuieli cu redeventele si chiriile
│   │   ├── 6123 — Chirii                                 (sintetic grad II)
│   │   │   ├── 6123.EMINESCU — Chirie birou Eminescu     (ANALITIC)
│   │   │   └── 6123.DEPOZIT — Chirie depozit             (ANALITIC)
│   │   └── ...
│   └── 613 — Cheltuieli cu primele de asigurare
└── ... (pana la GRUPA 69)
```

### 9.2 Conturi sintetice vs. analitice — regula de aur

| Proprietate | Sintetic | Analitic |
|---|---|---|
| **Cine il defineste** | Statul (OMFP 1802/2014) | Fiecare firma |
| **Format** | 3-4 cifre (ex: 401, 4111) | Sintetic + punct + cod (ex: 401.00023) |
| **Scop** | Clasificare standardizata | Detaliu specific firmei |
| **Exemplu** | 401 = toti furnizorii | 401.00023 = Orange Romania |

**Regula fundamentala:** `SUM(toate analiticele unui cont) = soldul contului sintetic`

```
401 (Furnizori)  sold = 50.000 lei
├── 401.00001 (Dedeman)     = 15.000 lei
├── 401.00023 (Orange)      =  5.000 lei
├── 401.00045 (Enel)        = 12.000 lei
└── 401.00067 (Emag)        = 18.000 lei
                        Total = 50.000 lei ✓
```

### 9.3 Cele 9 clase — rezumat complet

| Clasa | Denumire | Tip sold | Apare in | Exemple |
|---|---|---|---|---|
| **1** | Capitaluri | P (creditor) | Bilant — Pasiv | 101 capital social, 106 rezerve, 121 profit, 162 credite |
| **2** | Imobilizari | A (debitor) | Bilant — Activ | 211 terenuri, 212 constructii, 214 echipamente |
| **3** | Stocuri | A (debitor) | Bilant — Activ | 301 materii prime, 345 produse, 371 marfuri |
| **4** | Terti | **B** (bifunctional) | Bilant — Activ SAU Pasiv | 401 furnizori, 411 clienti, 421 salarii, 441 impozit profit |
| **5** | Trezorerie | A (debitor) | Bilant — Activ | 5121 cont banca RON, 5124 cont banca EUR, 5311 casa |
| **6** | Cheltuieli | A (debitor) | CPP — Cheltuieli | 601 materii prime, 641 salarii, 6811 amortizare |
| **7** | Venituri | P (creditor) | CPP — Venituri | 701 vanzari produse, 704 servicii, 707 marfuri |
| **8** | Speciale | A | Extrabilantiare | Nu intra in bilant / CPP |
| **9** | Gestiune | — | Contabilitate manageriala | Optional, rar folosite |

**Clasele 1-5 = conturi de BILANT** (au solduri permanente, se reporteaza de la an la an)
**Clasele 6-7 = conturi de REZULTAT** (se "inchid" la sfarsitul anului — se golesc in contul 121)

---

## 10. Calculul balantei de verificare din jurnal

Aceasta este operatia centrala: transformarea jurnalului (date brute) in balanta (date agregate).

### 10.1 Algoritmul conceptual

```
// Pseudocod simplificat
function computeBalance(entries: JournalEntry[], year: number, month?: number) {

  // PASUL 1: Calcul solduri initiale (tot ce s-a intamplat INAINTE de anul selectat)
  opening_balances = {}
  for entry in entries where entry.year < year:
    opening_balances[entry.contDBase].debit += entry.suma
    opening_balances[entry.contCBase].credit += entry.suma

  // IMPORTANT: La fiecare sfarsit de an anterior, conturile de rezultat
  // (clasa 6 si 7) se INCHID — se transfera in contul 121
  // (vezi sectiunea 11 pentru detalii)

  // PASUL 2: Calcul rulaje pe anul/luna selectat(a)
  turnovers = {}
  for entry in entries where entry.year == year
                        AND (month == null OR entry.month == month):
    turnovers[entry.contDBase].debit += entry.suma
    turnovers[entry.contCBase].credit += entry.suma

  // PASUL 3: Generare randuri de balanta
  for each cont:
    sold_initial = opening_balances[cont]  // debit - credit (sau invers pt P)
    rulaj_debit = turnovers[cont].debit
    rulaj_credit = turnovers[cont].credit
    sold_final = sold_initial + rulaj_debit - rulaj_credit  // pt tip A
    // sau = sold_initial - rulaj_debit + rulaj_credit      // pt tip P

    emit BalanceRow { cont, sold_initial, rulaj_debit, rulaj_credit, sold_final }
}
```

### 10.2 Structura completa a unui rand de balanta

In implementare, fiecare rand contine **14 coloane monetare**:

```typescript
interface BalanceRow {
  cont: string;           // Simbolul contului (ex: "401", "401.00023")
  categorie: string;      // Cod categorie optional
  denumire: string;       // Denumirea contului
  tip: "A" | "P" | "B";  // Tipul contului

  // Solduri initiale (1 ianuarie anul selectat)
  deb_init: number;       // Total debit cumulat pana la 1 ian
  cred_init: number;      // Total credit cumulat pana la 1 ian

  // Solduri la inceputul lunii selectate
  sold_in_d: number;      // Sold debitor la inceput de luna
  sold_in_c: number;      // Sold creditor la inceput de luna

  // Rulaje precedente (de la 1 ian pana la luna selectata)
  deb_prec: number;       // Debit cumulat lunile anterioare
  cred_prec: number;      // Credit cumulat lunile anterioare

  // Rulaje luna curenta
  rulaj_d: number;        // Debit luna curenta
  rulaj_c: number;        // Credit luna curenta

  // Rulaje totale pe an (year-to-date)
  rulajt_d: number;       // Debit total an curent
  rulajt_c: number;       // Credit total an curent

  // Totaluri
  total_deb: number;      // sold_init_d + rulajt_d
  total_cred: number;     // sold_init_c + rulajt_c

  // Solduri finale
  fin_d: number;          // Sold final debitor (daca total_deb > total_cred)
  fin_c: number;          // Sold final creditor (daca total_cred > total_deb)
}
```

**De ce atatea coloane?** Pentru ca rapoartele necesita diferite "vederi":
- **Sold initial** → pentru bilant la inceputul perioadei
- **Rulaj curent** → pentru CPP pe luna curenta
- **Rulaj YTD** → pentru CPP de la inceputul anului
- **Sold final** → pentru bilantul la sfarsit de perioada

---

## 11. Inchiderea de an — conturile de rezultat

Aceasta este o operatiune contabila **fundamentala** pe care programul trebuie s-o simuleze.

### 11.1 Ce se intampla

La sfarsitul fiecarui an (31 decembrie), conturile de cheltuieli (clasa 6) si venituri (clasa 7) se **inchid** — adica soldurile lor se transfera in contul **121 "Profit si pierdere"**.

### 11.2 De ce

Conturile de rezultat masoara performanta pe UN AN. La inceput de an nou, ele trebuie sa porneasca de la zero. Diferenta (venituri - cheltuieli) se muta in contul 121 care e cont de bilant (persista de la an la an).

### 11.3 Cum se implementeaza

```typescript
// La fiecare tranzitie de an (cand calculezi sold initial pentru anul N):
function closeYearEnd(balances: Map<string, {debit, credit}>) {

  let profit121_debit = 0;
  let profit121_credit = 0;

  for (const [cont, bal] of balances) {
    // Conturi clasa 6 (cheltuieli) — au sold debitor normal
    if (cont.startsWith("6")) {
      const net = bal.debit - bal.credit;  // sold net (ar trebui sa fie pozitiv)
      if (net > 0) {
        profit121_debit += net;   // cheltuielile scad profitul
      } else {
        profit121_credit += Math.abs(net);
      }
      bal.debit = 0;   // se reseteaza
      bal.credit = 0;  // contul porneste de la 0
    }

    // Conturi clasa 7 (venituri) — au sold creditor normal
    if (cont.startsWith("7")) {
      const net = bal.credit - bal.debit;  // sold net (ar trebui sa fie pozitiv)
      if (net > 0) {
        profit121_credit += net;  // veniturile cresc profitul
      } else {
        profit121_debit += Math.abs(net);
      }
      bal.debit = 0;
      bal.credit = 0;
    }
  }

  // Transfera in contul 121
  balances.get("121").debit += profit121_debit;
  balances.get("121").credit += profit121_credit;
}
```

**Rezultat:** Dupa inchidere:
- Toate conturile 6xx si 7xx au sold = 0
- Contul 121 contine diferenta: daca `credit > debit` → profit, daca `debit > credit` → pierdere

### 11.4 Implicatie practica

Cand calculezi balanta pentru anul 2024:
1. Acumulezi toate intrarile din anii anteriori (2020, 2021, 2022, 2023...)
2. La FIECARE tranzitie de an, aplici inchiderea (golesti cls 6+7, transferi in 121)
3. Astfel, soldul initial al lui 2024 reflecta corect profitul/pierderea cumulata din toti anii anteriori

---

## 12. Cartea Mare / Fise de cont

**Ce este:** Aceleasi date din Registrul Jurnal, dar reorganizate pe conturi. E un simplu `GROUP BY cont` + ordonare cronologica in cadrul fiecarui grup.

### 12.1 Exemplu — Fisa contului 5121 "Conturi la banci in lei"

| Data | Document | Explicatie | Debit (intrari) | Credit (iesiri) | Sold |
|---|---|---|---|---|---|
| 01.03 | Sold initial | — | — | — | 50.000 |
| 04.03 | EC-001 | Incasare client X | 11.900 | — | 61.900 |
| 05.03 | EC-001 | Plata chirie | — | 3.000 | 58.900 |
| 07.03 | EC-001 | Plata salarii | — | 15.000 | 43.900 |

### 12.2 In cod

```typescript
// Cartea Mare = jurnal filtrat pe un cont, cu sold running
function fisaCont(entries: JournalEntry[], cont: string): FisaRow[] {
  const rows = entries.filter(e =>
    e.contDBase === cont || e.contCBase === cont
  );

  let sold = soldInitial(cont);
  return rows.map(e => {
    const isDebit = e.contDBase === cont;
    const debit = isDebit ? e.suma : 0;
    const credit = !isDebit ? e.suma : 0;
    sold = sold + debit - credit;  // pentru conturi tip A
    return { data: e.data, document: e.ndp, explicatie: e.explicatie,
             debit, credit, sold };
  });
}
```

---

## 13. Balanta de verificare — structura completa

**Ce este:** Un tabel rezumat care arata, pentru FIECARE cont, soldurile si rulajele.

### 13.1 Exemplu

| Simbol | Denumire | Sold initial D | Sold initial C | Rulaj D | Rulaj C | Sold final D | Sold final C |
|---|---|---|---|---|---|---|---|
| 214 | Echipamente | 20.000 | — | 5.000 | — | 25.000 | — |
| 2814 | Amortizare echipamente | — | 8.000 | — | 139 | — | 8.139 |
| 401 | Furnizori | — | 5.000 | 5.000 | 12.000 | — | 12.000 |
| 4111 | Clienti | 15.000 | — | 11.900 | 11.900 | 15.000 | — |
| 5121 | Banca RON | 50.000 | — | 11.900 | 18.000 | 43.900 | — |
| 641 | Salarii | — | — | 15.000 | — | 15.000 | — |
| 704 | Venituri servicii | — | — | — | 10.000 | — | 10.000 |

### 13.2 Verificarea balantei

**Regula de aur:** `Total Solduri Debitoare = Total Solduri Creditoare`

Aceasta egalitate trebuie sa fie adevarata pentru:
- Solduri initiale: ΣD_init = ΣC_init
- Rulaje: ΣD_rulaj = ΣC_rulaj
- Solduri finale: ΣD_final = ΣC_final

Daca nu sunt egale → exista o eroare de procesare.

### 13.3 Ierarhia conturi parinte/frunza

Balanta contine atat conturi sintetice cat si analitice. Trebuie determinat care sunt "frunze" (conturi fara sub-conturi) si care sunt "parinti":

```
401        ← PARINTE (are sub-conturi analitice)
401.00001  ← FRUNZA
401.00023  ← FRUNZA
401.00045  ← FRUNZA
5121       ← PARINTE
5121.001   ← FRUNZA
5121.002   ← FRUNZA
641        ← FRUNZA (nu are sub-conturi)
```

**Algoritmul:** Se sorteaza conturile lexicografic. Pentru fiecare cont, se verifica (cu binary search) daca exista un alt cont care incepe cu el + ".":

```typescript
function computeLeafFlags(rows: BalanceRow[]): void {
  const sorted = rows.map(r => r.cont).sort();

  for (const row of rows) {
    const prefix = row.cont + ".";
    // Binary search: exista un cont care incepe cu prefix?
    const hasChildren = sorted.some(c => c.startsWith(prefix) && c !== row.cont);
    row.isLeaf = !hasChildren;
  }
}
```

**De ce conteaza:** La calcule se folosesc doar frunzele (pentru a evita dubla numarare). Parintii sunt doar pentru afisare ierarhica.

---

## 14. Bilantul contabil (F10 ANAF)

**Ce arata:** O "fotografie" a firmei la un moment dat — ce detine (activ), ce datoreaza (pasiv+capital).

**Ecuatia fundamentala:** `ACTIVE = DATORII + CAPITALURI PROPRII`

### 14.1 Structura bilantului (conform OMFP 1802/2014)

```
ACTIV
├── A. ACTIVE IMOBILIZATE
│   ├── A.I. Imobilizari necorporale (licente, brevete)
│   │   → conturi: 201, 203, 205, 208 minus 280x
│   ├── A.II. Imobilizari corporale (cladiri, echipamente)
│   │   → conturi: 211-217, 231-232 minus 281x
│   └── A.III. Imobilizari financiare (participatii)
│       → conturi: 261, 263, 265, 267
│
├── B. ACTIVE CIRCULANTE
│   ├── B.I. Stocuri
│   │   → conturi: 301-371 minus 39x (provizioane)
│   ├── B.II. Creante (ce iti datoreaza altii)
│   │   → conturi: 4111 (sold D), 4118, 425, 4282, 431-448 (sold D), 461
│   ├── B.III. Investitii pe termen scurt
│   │   → conturi: 501-508
│   └── B.IV. Casa si conturi la banci
│       → conturi: 5121, 5124, 5311, 5314, 531-541
│
└── C. CHELTUIELI IN AVANS
    → conturi: 471

PASIV
├── D. DATORII PE TERMEN SCURT (sub 1 an)
│   → conturi: 401, 403 (sold C), 404 (sold C), 419, 421, 423,
│              431-448 (sold C), 462, 473, 519
│
├── G. DATORII PE TERMEN LUNG (peste 1 an)
│   → conturi: 161, 162, 166, 167, 168
│
├── H. PROVIZIOANE
│   → conturi: 151x
│
├── I. VENITURI IN AVANS
│   → conturi: 472
│
└── J. CAPITALURI PROPRII
    ├── J.I. Capital social → conturi: 101, 1015-1018
    ├── J.II. Prime de capital → cont: 104
    ├── J.III. Rezerve din reevaluare → cont: 105
    ├── J.IV. Rezerve → cont: 106
    ├── J.V. Rezultat reportat → conturi: 107, 117
    └── J.VI. Rezultatul exercitiului → cont: 121
```

### 14.2 Clasificarea conturilor in bilant — algoritmul

```typescript
function classifyForBilant(contBase: string, sold_d: number, sold_c: number) {
  // Conturi bifunctionale (clasa 4) — se impart pe semn
  if (isBifunctional(contBase)) {
    if (sold_d > 0) return { side: "ACTIV", bucket: "B.II" };  // Creanta
    if (sold_c > 0) return { side: "PASIV", bucket: "D" };     // Datorie
  }

  // Imobilizari corporale
  if (["211","212","213","214","215","216","217","231","232"]
      .includes(contBase)) return { side: "ACTIV", bucket: "A.II" };

  // Amortizari (se SCAD din activ)
  if (contBase.startsWith("281")) return { side: "ACTIV", bucket: "A.II", sign: -1 };

  // Banca si casa
  if (["5121","5124","5311","5314"].includes(contBase) ||
      contBase.startsWith("53") || contBase.startsWith("54"))
    return { side: "ACTIV", bucket: "B.IV" };

  // Capital
  if (["101","1012","1015","1016","1017","1018"].includes(contBase))
    return { side: "PASIV", bucket: "J.I" };

  // Credite pe termen lung
  if (["161","162","166","167","168"].includes(contBase))
    return { side: "PASIV", bucket: "G" };

  // Rezultatul exercitiului curent
  if (contBase === "121") return { side: "PASIV", bucket: "J.VI" };

  // Conturile de rezultat (cls 6, 7) — nu apar direct in bilant
  // Ele se inchid in 121 la sfarsit de an
  if (contBase.startsWith("6")) return { bucket: "cls6" };  // CPP
  if (contBase.startsWith("7")) return { bucket: "cls7" };  // CPP

  // ... alte reguli
}
```

### 14.3 Verificare bilant

`totalActiv - totalPasiv` trebuie sa fie **~0** (sau exact 0). Daca diferenta e nenula, exista o problema de clasificare sau de calcul.

---

## 15. Contul de Profit si Pierdere (CPP)

**Ce arata:** Performanta firmei pe o perioada: venituri - cheltuieli = rezultat.

### 15.1 Cum se calculeaza din jurnal

```typescript
function computeCPP(entries: JournalEntry[], year: number, month?: number) {
  const turnovers: Map<string, {debit: number, credit: number}> = new Map();

  for (const entry of entries) {
    // Filtreaza pe an/luna
    if (entry.year !== year) continue;
    if (month && entry.month !== month) continue;

    // Exclude transferurile de inchidere (cont 121*)
    if (entry.contDBase.startsWith("121") ||
        entry.contCBase.startsWith("121")) continue;

    // Proceseaza doar conturile din clasa 6 si 7
    if (entry.contDBase.startsWith("6") || entry.contDBase.startsWith("7")) {
      turnovers.get(entry.contDBase).debit += entry.suma;
    }
    if (entry.contCBase.startsWith("6") || entry.contCBase.startsWith("7")) {
      turnovers.get(entry.contCBase).credit += entry.suma;
    }
  }

  // Veniturile = rulaj creditor cls 7
  // Cheltuielile = rulaj debitor cls 6
  // Rezultat = venituri - cheltuieli
}
```

### 15.2 Structura CPP (OMFP 1802/2014)

```
VENITURI DIN EXPLOATARE
├── Cifra de afaceri neta
│   ├── 701 — Vanzari de produse finite
│   ├── 704 — Venituri din servicii prestate
│   ├── 706 — Venituri din redevente, locatii, chirii
│   ├── 707 — Venituri din vanzarea marfurilor
│   └── 708 — Venituri din activitati diverse
├── 711 — Variatia stocurilor
├── 721 — Venituri din productia de imobilizari
├── 7417 — Venituri din subventii de exploatare
└── 758x — Alte venituri din exploatare

CHELTUIELI DIN EXPLOATARE
├── Grupa 60 — Cheltuieli cu stocurile
│   ├── 601 — Materii prime
│   ├── 602 — Materiale consumabile (6021-6028)
│   └── 607 — Marfuri
├── Grupa 61 — Cheltuieli cu lucrari/servicii terti
│   ├── 611 — Intretinere si reparatii
│   ├── 612 — Chirii (6123 = chirii imobiliare)
│   └── 613 — Asigurari
├── Grupa 62 — Alte servicii
│   ├── 621 — Colaboratori / PFA-uri
│   ├── 622 — Comisioane si onorarii
│   ├── 623 — Protocol, reclama, publicitate (6231)
│   ├── 624 — Transport bunuri si personal
│   ├── 625 — Deplasari, detasari, transferari
│   ├── 626 — Cheltuieli postale si telecom
│   ├── 627 — Servicii bancare si asimilate
│   └── 628 — Alte cheltuieli cu serviciile
├── Grupa 63 — Cheltuieli cu impozite si taxe (non-profit)
│   └── 635 — Impozite si taxe locale (impozit cladiri, teren)
├── Grupa 64 — Cheltuieli cu personalul
│   ├── 641 — Cheltuieli cu salariile
│   ├── 6451 — Contrib. unit. asig. sociale (CAS)
│   ├── 6452 — Contrib. unit. asig. somaj
│   ├── 6453 — Contrib. unit. asig. sociale de sanatate (CASS)
│   └── 6458 — Alte cheltuieli privind asigurarile (bonusuri, tichete)
├── Grupa 65 — Alte cheltuieli de exploatare
│   ├── 654 — Pierderi din creante
│   ├── 6581 — Despagubiri, amenzi, penalitati
│   └── 6588 — Alte cheltuieli de exploatare
└── Grupa 68 — Cheltuieli cu amortizarea si provizioanele
    └── 6811 — Cheltuieli de exploatare privind amortizarea

VENITURI FINANCIARE
├── 765 — Venituri din diferente de curs valutar
├── 766 — Venituri din dobanzi
└── 768 — Alte venituri financiare

CHELTUIELI FINANCIARE
├── 665 — Cheltuieli din diferente de curs valutar
├── 666 — Cheltuieli privind dobanzile
└── 668 — Alte cheltuieli financiare

────────────────────────────────────────────
REZULTAT DIN EXPLOATARE = Venituri exploatare − Cheltuieli exploatare
REZULTAT FINANCIAR = Venituri financiare − Cheltuieli financiare
REZULTAT BRUT = Rezultat exploatare + Rezultat financiar
IMPOZIT PE PROFIT = cont 691
REZULTAT NET = Rezultat brut − Impozit pe profit
```

### 15.3 Output-ul CPP in aplicatie

```typescript
interface CppData {
  lines: CppLine[];              // Randuri formatate cu indent si tip
  cifraAfaceri: number;          // Cifra de afaceri neta (venituri activitate principala)
  rezultatExploatare: number;    // Profit/pierdere din activitatea curenta
  rezultatFinanciar: number;     // Profit/pierdere din operatiuni financiare
  rezultatBrut: number;          // Profit/pierdere inainte de impozit
  impozitProfit: number;         // Impozit pe profit (16%)
  rezultatNet: number;           // Profit/pierdere dupa impozit
}
```

---

## 16. Clasificarea pe verticale de business

Proiectul gestioneaza o firma cu 3 verticale (linii de business). Clasificarea se face pe baza contului de venit si a partenerului din explicatie.

### 16.1 Regulile de clasificare

```typescript
function classifyRevenueVertical(entry: JournalEntry): string | null {
  const contCredit = entry.contCBase;
  const explicatie = entry.explicatie.toUpperCase();

  // Cont 704 (Venituri din servicii)
  if (contCredit === "704") {
    if (explicatie.includes("ROCHE DIAGNOSTICS")) return "outsourcing";
    return "recruitment";  // toti ceilalti clienti pe 704
  }

  // Cont 706 (Venituri din chirii) → coworking
  if (contCredit === "706") return "coworking";

  // Cont 708 (Activitati diverse) → recruitment
  if (contCredit === "708") return "recruitment";

  // Alte conturi de venit (707, 765, 766, 7583) → consolidat
  return null;  // nu se atribuie niciunei verticale specifice
}
```

### 16.2 Filtrarea pe verticala

Cand utilizatorul selecteaza o verticala:
- Se filtreaza intrarile din jurnal care apartin acelei verticale
- Se recalculeaza balanta doar pe intrarile filtrate
- Se regenereaza CPP si indicatorii

---

## 17. Extragerea partenerilor din jurnal

Jurnalul contine informatii despre parteneri (furnizori, clienti) in doua locuri:
1. **Contul analitic** — ex: `401.00023` → furnizorul cu codul 23
2. **Explicatia** — ex: "PLATA FACTURA ORANGE ROMANIA S.R.L. nr. 12345"

### 17.1 Conturile care identifica parteneri

| Prefix cont | Tip partener |
|---|---|
| 401 | Furnizor de marfuri/servicii |
| 404 | Furnizor de imobilizari (echipamente) |
| 411 | Client |

### 17.2 Algoritmul de extractie din explicatie

```typescript
function extractPartnerName(explicatie: string): string | null {
  // 1. Elimina prefixe de operatiune
  //    "ACHIT.", "PLATA", "INTRARE", "VAL. INTR.", etc.
  let text = removeOperationPrefixes(explicatie);

  // 2. Cauta sufixe de entitate juridica
  //    S.R.L., S.A., PFA, I.I., SNC, SCS
  const match = text.match(/([\w\s]+)(S\.?R\.?L\.?|S\.?A\.?|PFA|I\.?I\.?)/);
  if (match) return match[0].trim();

  // 3. Fallback: ia primele 2-6 cuvinte uppercase (min 4 caractere fiecare)
  const tokens = text.split(/\s+/).filter(t => t.length >= 4 && t === t.toUpperCase());
  if (tokens.length >= 2) return tokens.slice(0, 6).join(" ");

  // 4. Taie identificatori document (nr., CUI, IBAN, etc.)
  // 5. Daca nimic nu merge → return null
  return null;
}
```

### 17.3 Maparea partener → cont analitic

Se construieste un map care leaga conturile analitice de parteneri:

```typescript
// Rezultat:
[
  { analyticAccount: "401.00023", contBase: "401", partnerName: "ORANGE ROMANIA S.R.L.", cod: "RO12345678" },
  { analyticAccount: "401.00045", contBase: "401", partnerName: "ENEL ENERGIE S.A.", cod: "RO9876543" },
  { analyticAccount: "4111.001", contBase: "4111", partnerName: "ROCHE DIAGNOSTICS S.R.L.", cod: null },
]
```

Acest map e util pentru:
- Afisarea numelui partenerului in loc de codul analitic
- Analiza furnizorilor/clientilor (cine datoreaza cel mai mult, cui datoram noi)

---

## 18. Categorii de costuri si reguli de matching

Proiectul implementeaza un sistem de categorii de costuri pentru analiza detaliata. Fiecare categorie are **reguli de matching** care determina automat ce intrari din jurnal apartin categoriei respective.

### 18.1 Tipuri de reguli

```typescript
interface MatchRule {
  type: 'prefix' | 'exact' | 'explanation_contains';
  value: string;
  side?: 'debit' | 'credit';  // optional — limiteaza la o parte a inregistrarii
}
```

| Tip regula | Ce face | Exemplu |
|---|---|---|
| `prefix` | Contul incepe cu valoarea | `{type:'prefix', value:'641', side:'debit'}` → orice cont care incepe cu 641, pe partea de debit |
| `exact` | Contul e exact valoarea | `{type:'exact', value:'6123'}` → doar contul 6123 |
| `explanation_contains` | Explicatia contine textul | `{type:'explanation_contains', value:'ELECTRICA'}` → orice intrare cu "ELECTRICA" in explicatie |

### 18.2 Categoriile definite in proiect

**COSTURI VARIABILE:**

| Categorie | Conturi / Reguli |
|---|---|
| **Salarii (white collars)** | prefix `641` debit, prefix `6458` debit |
| **Utilitati — Electricitate** | explanation_contains `ELECTRICA` |
| **Utilitati — Gaz** | explanation_contains `GAZ` |
| **Utilitati — Apa** | explanation_contains `APA` |
| **Intretinere cladire** | prefix `611` debit |
| **Consumabile — Papetarie** | prefix `3028` (stocuri rechizite) |
| **Consumabile — IT** | prefix `303` |
| **Consumabile — Igiena** | explanation_contains `IGIENA` |
| **Consumabile — Alimente** | prefix `6024` |
| **Combustibil — Electric** | explanation_contains `ELECTRIC` + prefix `6022` |
| **Combustibil — Benzina** | prefix `6022` debit |
| **Deplasari — Transport** | prefix `625` debit |
| **Protocol — Mese** | prefix `6231` debit |
| **Neprevazute** | prefix `6581`, prefix `6588` |

**COSTURI FIXE:**

| Categorie | Conturi / Reguli |
|---|---|
| **Chirii** | prefix `6123` debit |
| **Impozite proprietate** | prefix `635` debit |
| **Credite — Dobanzi** | prefix `666` debit |
| **Amortizare** | prefix `6811` debit |
| **Abonamente** | explanation_contains (lista de ~25 servicii: Zoom, Microsoft, Adobe etc.) |
| **Servicii — Curatenie** | explanation_contains `CURATENIE` |
| **Servicii — Telecom** | explanation_contains `TELECOM` sau `ORANGE` |
| **Servicii — Internet** | explanation_contains `INTERNET` |
| **Servicii — Juridice** | explanation_contains `AVOCAT` sau `JURIDIC` |
| **Servicii — Contabilitate** | explanation_contains `CONTABIL` |
| **Asigurari** | prefix `613` |

### 18.3 Algoritmul de matching

```typescript
function matchEntry(entry: JournalEntry, rule: MatchRule): boolean {
  switch (rule.type) {
    case 'prefix':
      const cont = rule.side === 'debit' ? entry.contDBase : entry.contCBase;
      return cont.startsWith(rule.value);

    case 'exact':
      const cont2 = rule.side === 'debit' ? entry.contDBase : entry.contCBase;
      return cont2 === rule.value;

    case 'explanation_contains':
      return entry.explicatie.toUpperCase().includes(rule.value.toUpperCase());
  }
}
```

---

## 19. Extragerea informatiilor utile

### 19.1 Din balanta — extragere rapida

| Ce vrei | Cum extragi |
|---|---|
| **Venituri totale** | Σ rulaj_creditor pentru conturi `7xx` |
| **Cheltuieli totale** | Σ rulaj_debitor pentru conturi `6xx` |
| **Profit/pierdere** | Venituri − Cheltuieli |
| **Bani in banca** | Sold final `5121` + `5124` |
| **Bani in casa** | Sold final `5311` |
| **Datorii furnizori** | Sold creditor `401` + `404` |
| **Creante clienti** | Sold debitor `4111` |
| **TVA de plata** | Sold creditor `4427` − sold debitor `4426` |
| **Datorii credite** | Sold creditor `162` (termen lung) + `519` (termen scurt) |
| **Capital social** | Sold creditor `1012` |

### 19.2 Din jurnal — analize granulare

| Ce vrei | Cum extragi |
|---|---|
| **Venituri pe zi** | GROUP BY data WHERE contCBase starts with "7", SUM(suma) |
| **Cheltuieli pe categorie pe luna** | Aplica regulile de matching, GROUP BY month |
| **Top 10 furnizori** | GROUP BY contD analitic WHERE contDBase = "401", ORDER BY SUM DESC |
| **Top 10 clienti** | GROUP BY contD analitic WHERE contDBase = "4111", ORDER BY SUM DESC |
| **Cash in vs cash out** | Cont 5121: SUM(debit) = intrari, SUM(credit) = iesiri |
| **Evolutia lunara a cheltuielilor** | GROUP BY month, contDBase WHERE cls 6 |

---

## 20. Indicatori financiari (KPI)

### 20.1 KPI-uri din balanta

```typescript
// Cash & banca
const cashBank = sold_final_d("5121") + sold_final_d("5124") + sold_final_d("5311");

// Creante clienti
const clienti = sold_final_d("4111");

// Datorii furnizori
const furnizori = sold_final_c("401") + sold_final_c("404");

// TVA de plata
const tvaDePlata = sold_final_c("4427") - sold_final_d("4426");

// Credite termen lung
const crediteLung = sold_final_c("162");

// Credite termen scurt
const crediteScurt = sold_final_c("519");

// Rezultat curent
const rezultat = sold_final("121");  // credit = profit, debit = pierdere
```

### 20.2 Indicatori de profitabilitate (din CPP)

```
Marja bruta = (Venituri − Cost marfuri vandute) / Venituri × 100
Marja operationala = Rezultat exploatare / Venituri × 100
Marja neta = Rezultat net / Venituri × 100
```

### 20.3 Indicatori de lichiditate (din bilant)

```
Lichiditate curenta = Active circulante / Datorii termen scurt
Lichiditate imediata = (Banca + Casa) / Datorii termen scurt
```

### 20.4 Structura cheltuielilor

```
% Salarii = Cheltuieli cls 64 / Total cheltuieli × 100
% Chirii = Cheltuieli 612 / Total cheltuieli × 100
% Amortizare = Cheltuieli 6811 / Total cheltuieli × 100
```

---

## 21. Pipeline-ul complet de procesare

Aceasta este ordinea exacta a operatiunilor in aplicatie:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INPUT: Fisier XLSX cu Registrul Jurnal                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. PARSARE (parser.ts)                                          │
│    - Detectie sheet "Registru"                                  │
│    - Detectie coloane prin alias-uri                             │
│    - Procesare note compuse (% marker)                          │
│    - Detectie post-closing entries                               │
│    - Extragere denumiri conturi → Map<cont, denumire>           │
│    → OUTPUT: JournalEntry[] + accountNames Map                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CALCUL BALANTA (compute-balance.ts)                          │
│    - Calcul solduri initiale (ani anteriori cu inchidere cls67) │
│    - Calcul rulaje luna/an curenta                               │
│    - Clasificare conturi (A/P/B)                                │
│    - Determinare ierarhie parinte/frunza                        │
│    → OUTPUT: BalanceRow[]                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐
│ 4a. BILANT   │ │ 4b. CPP      │ │ 4c. ALTE RAPOARTE            │
│ (bilant/     │ │ (cpp/        │ │ - Cash flow                  │
│  compute.ts) │ │  compute.ts) │ │ - KPI-uri                    │
│              │ │              │ │ - Evolutie lunara             │
│ Clasificare  │ │ Conturi 6+7  │ │ - Categorizare costuri       │
│ conturi in   │ │ → venituri   │ │ - Verticale business         │
│ bucketuri    │ │ − cheltuieli │ │ - Analiza parteneri          │
│ F10 ANAF     │ │ = rezultat   │ │                              │
└──────────────┘ └──────────────┘ └──────────────────────────────┘
```

### 21.1 Functia principala

```typescript
function processCompanyXLSX(
  data: ArrayBuffer,
  companyName: string,
  year?: number,
  month?: number
): CompanyData {
  // 1. Parseaza XLSX → JournalEntry[]
  const { entries, accountNames } = parseJournalXLSX(data);

  // 2. Determina anul (cel mai recent din date, sau cel specificat)
  const years = [...new Set(entries.map(e => e.year))].sort();
  const selectedYear = year ?? years[years.length - 1];

  // 3. Calculeaza balanta din jurnal
  const balanceRows = computeBalanceFromJournal(entries, selectedYear, accountNames);

  // 4. Returneaza totul
  return {
    name: companyName,
    entries,
    years,
    balanceRows,
    accountNames
  };
}
```

---

## 22. Formate de numere si normalizare

Numerele din fisierele Excel pot veni in formate diferite. Normalizarea este critica.

### 22.1 Formatele intalnite

| Format | Exemplu | Origine |
|---|---|---|
| Romanesc | `1.234.567,89` | Punct = mii, Virgula = zecimale |
| Englezesc | `1,234,567.89` | Virgula = mii, Punct = zecimale |
| Ambiguu | `1.234` | Poate fi 1234 sau 1.234 |

### 22.2 Algoritmul de normalizare

```typescript
function normalizeMoney(value: any): number {
  if (typeof value === 'number') return value;

  let s = String(value).trim();

  // Elimina spatii si caractere non-numerice (exceptie: . , -)
  s = s.replace(/[^\d.,-]/g, '');

  // Detectie format romanesc: daca are virgula urmata de exact 2 cifre la final
  if (/,\d{2}$/.test(s)) {
    // Format romanesc: 1.234.567,89
    s = s.replace(/\./g, '');   // elimina punctele (separatori mii)
    s = s.replace(',', '.');     // virgula → punct (separator zecimale)
  }
  // Detectie ambigua: punct urmat de exact 3 cifre la final, fara virgula
  else if (/\.\d{3}$/.test(s) && !s.includes(',')) {
    // Probabil separator de mii: 1.234 → 1234
    s = s.replace(/\./g, '');
  }
  // Altfel: format englezesc sau numar simplu
  else {
    s = s.replace(/,/g, '');     // elimina virgulele (separatori mii)
  }

  return parseFloat(s) || 0;
}
```

**Cazul ambiguu:** `1.234` — sunt 1234 (o mie doua sute treizeci si patru) sau 1,234 (unu virgula doua sute treizeci si patru)? Regula: daca punctul e urmat de EXACT 3 cifre si nu exista virgula → e separator de mii → 1234.

---

## 23. Edge cases si cazuri speciale

### 23.1 Intrari extrabilanteriere (storno)

Unele intrari au campul `tip = "S"`. Acestea sunt:
- **Stornari** (anulari de inregistrari gresite)
- **Intrari extrabilanteriere** (informatii suplimentare care NU afecteaza bilantul)

Pot fi filtrate din calcule cand e nevoie.

### 23.2 Contul 121 in inchideri

Cand jurnalul contine explicit note de inchidere a conturilor de rezultat (transferuri in 121), aceste intrari trebuie EXCLUSE din calculul CPP — altfel s-ar numara dublu.

Regula: orice intrare cu `contDBase.startsWith("121") || contCBase.startsWith("121")` se exclude din CPP.

### 23.3 Conturi cu prefix comun

La classificare trebuie grija: `401` si `4011` sunt conturi DIFERITE. `startsWith("401")` le prinde pe ambele. De aceea se foloseste `contBase` (extras pana la punct) si nu contul complet.

### 23.4 Luni fara activitate

Daca o luna nu are nicio intrare, balanta pe acea luna va avea rulaje = 0 si solduri finale = solduri initiale. Nu e o eroare — trebuie tratat corect in UI (afisare luna fara date, nu eroare).

### 23.5 Ani cu date partiale

Primul an din jurnal poate sa nu inceapa de la ianuarie. De exemplu, daca firma s-a infiintat in martie 2023, ianuarie-februarie vor avea rulaje zero. Soldurile initiale pentru 2023 vor fi zero pe toate conturile.

### 23.6 Conturi analitice cu cod text

Unele firme folosesc coduri text pentru analitice: `401.ORANGE` in loc de `401.00023`. Parserul trebuie sa trateze tot ce e dupa punct ca analitic, indiferent daca e numar sau text.

---

## 24. Glosar rapid

| Termen | Explicatie pentru programator |
|---|---|
| **Debit** | Partea stanga a unei tranzactii. Pentru conturi A/cheltuieli = creste. Pentru conturi P/venituri = scade. |
| **Credit** | Partea dreapta. Invers fata de debit. |
| **Rulaj** | SUM() pe o perioada — cat s-a miscat pe debit sau pe credit (ca un delta). |
| **Sold** | Diferenta neta debit − credit (sau invers). Ca un `balance` dupa toate tranzactiile. |
| **Sold debitor** | Debit > Credit. Tipic pentru active si cheltuieli. |
| **Sold creditor** | Credit > Debit. Tipic pentru datorii, capitaluri, venituri. |
| **Partida dubla** | Fiecare tranzactie afecteaza min. 2 conturi; total debit = total credit. Ca o tranzactie atomica in DB. |
| **Cont sintetic** | Contul standardizat (3-4 cifre). Ca un `enum` definit de stat. |
| **Cont analitic** | Sub-cont creat de firma (sintetic + punct + cod). Ca un `foreign key` la detaliu. |
| **Bifunctional** | Cont care poate fi activ SAU pasiv. Clasificarea se face la runtime, pe baza semnului soldului. |
| **Inchidere de luna** | Operatiune contabila de sfarsit de luna. Delimiter in jurnal. |
| **Inchidere de an** | Golirea conturilor cls 6+7 si transferul in 121. Ca un `TRUNCATE` + `INSERT INTO 121`. |
| **Exercitiu financiar** | Perioada contabila, de obicei 1 ian — 31 dec. Ca un `fiscal_year`. |
| **Nota compusa** | O nota contabila cu un cont fix si mai multe detalii. Se "explodeaza" in note simple la parsare. |
| **F10 ANAF** | Formularul oficial de bilant depus la stat. Structura este standardizata. |
| **CPP** | Cont de Profit si Pierdere — raportul venituri vs cheltuieli. |
| **OMFP 1802/2014** | Ordinul Ministerului Finantelor care reglementeaza planul de conturi si rapoartele. |
| **ANAF** | Agentia Nationala de Administrare Fiscala — "IRS-ul" romanesc. |

---

## Anexa A — Cele mai folosite conturi in proiect

| Cont | Denumire | Clasa | Tip | Apare in |
|---|---|---|---|---|
| 101/1012 | Capital social | 1 | P | Bilant J.I |
| 106 | Rezerve | 1 | P | Bilant J.IV |
| 121 | Profit si pierdere | 1 | P | Bilant J.VI |
| 162 | Credite bancare termen lung | 1 | P | Bilant G |
| 211 | Terenuri | 2 | A | Bilant A.II |
| 212 | Constructii | 2 | A | Bilant A.II |
| 214 | Mobilier, echipamente | 2 | A | Bilant A.II |
| 2814 | Amortizare imobilizari corporale | 2 | P | Bilant A.II (scade) |
| 301 | Materii prime | 3 | A | Bilant B.I |
| 371 | Marfuri | 3 | A | Bilant B.I |
| 401 | Furnizori | 4 | B | Bilant B.II/D |
| 404 | Furnizori de imobilizari | 4 | B | Bilant B.II/D |
| 4111 | Clienti | 4 | B | Bilant B.II/D |
| 421 | Personal — salarii datorate | 4 | B | Bilant D |
| 4311 | Contrib. asig. sociale | 4 | B | Bilant D |
| 4411 | Impozit pe profit | 4 | B | Bilant D |
| 4426 | TVA deductibila | 4 | B | Bilant B.II |
| 4427 | TVA colectata | 4 | B | Bilant D |
| 519 | Credite bancare termen scurt | 5 | P | Bilant D |
| 5121 | Cont banca RON | 5 | A | Bilant B.IV |
| 5124 | Cont banca EUR | 5 | A | Bilant B.IV |
| 5311 | Casa in lei | 5 | A | Bilant B.IV |
| 601 | Chelt. materii prime | 6 | A | CPP — Chelt. exploatare |
| 607 | Chelt. marfuri | 6 | A | CPP — Chelt. exploatare |
| 611 | Chelt. intretinere | 6 | A | CPP — Chelt. exploatare |
| 612/6123 | Chelt. chirii | 6 | A | CPP — Chelt. exploatare |
| 613 | Chelt. asigurari | 6 | A | CPP — Chelt. exploatare |
| 621 | Chelt. colaboratori | 6 | A | CPP — Chelt. exploatare |
| 625 | Chelt. deplasari | 6 | A | CPP — Chelt. exploatare |
| 626 | Chelt. postale/telecom | 6 | A | CPP — Chelt. exploatare |
| 635 | Chelt. impozite locale | 6 | A | CPP — Chelt. exploatare |
| 641 | Chelt. salarii | 6 | A | CPP — Chelt. exploatare |
| 6458 | Chelt. alte asigurari | 6 | A | CPP — Chelt. exploatare |
| 666 | Chelt. dobanzi | 6 | A | CPP — Chelt. financiare |
| 6811 | Chelt. amortizare | 6 | A | CPP — Chelt. exploatare |
| 691 | Chelt. impozit profit | 6 | A | CPP — Impozit |
| 701 | Venituri produse | 7 | P | CPP — Venituri exploatare |
| 704 | Venituri servicii | 7 | P | CPP — Venituri exploatare |
| 706 | Venituri chirii | 7 | P | CPP — Venituri exploatare |
| 707 | Venituri marfuri | 7 | P | CPP — Venituri exploatare |
| 708 | Venituri diverse | 7 | P | CPP — Venituri exploatare |
| 765 | Venituri diferente curs | 7 | P | CPP — Venituri financiare |
| 766 | Venituri dobanzi | 7 | P | CPP — Venituri financiare |

---

*Document generat ca ghid tehnic pentru programatori — explica fluxul contabil romanesc si implementarea din proiectul Redspark FP&A Dashboard, conform OMFP 1802/2014.*
