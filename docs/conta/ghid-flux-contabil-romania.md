# Ghid complet: Fluxul contabil în România
## De la documentul justificativ la situațiile financiare — explicat pentru persoane non-tehnice

---

## 1. Imaginea de ansamblu: cum „curge" informația în contabilitate

Gândește-te la contabilitate ca la un sistem de filtrare a apei. Apa brută (documentele) intră în sistem, trece prin mai multe etape de procesare și la final iese apa curată (situațiile financiare — bilanț, cont de profit și pierdere).

Iată fluxul complet, pas cu pas:

```
DOCUMENT JUSTIFICATIV (factură, chitanță, extras de cont…)
        ↓
NOTĂ CONTABILĂ (articolul contabil — „înregistrarea")
        ↓
REGISTRUL JURNAL (toate notele contabile, în ordine cronologică)
        ↓
CARTEA MARE / FIȘE DE CONT (aceleași note, dar grupate pe conturi)
        ↓
BALANȚA DE VERIFICARE (sinteza tuturor conturilor: solduri + rulaje)
        ↓
SITUAȚII FINANCIARE (bilanț, cont de profit și pierdere, note explicative)
```

Fiecare etapă preia datele de la etapa anterioară, le organizează diferit și adaugă un nivel de sinteză. Scopul final: oricine privește situațiile financiare trebuie să poată înțelege sănătatea financiară a firmei.

---

## 2. Etapa 1 — Documentul justificativ

**Ce este:** Orice hârtie (sau document electronic) care dovedește că s-a întâmplat ceva din punct de vedere economic: o vânzare, o cumpărare, o plată, un încasare.

**Exemple concrete:**
- **Factura** — primită de la un furnizor sau emisă către un client
- **Chitanța** — dovada unei plăți în numerar
- **Extrasul de cont bancar** — mișcările de bani din contul bancar
- **Bonul fiscal** — o achiziție de la magazin
- **Contractul de muncă + statul de plată** — pentru salarii
- **Procesul-verbal de recepție** — la primirea unui echipament

**Regulă de aur:** Nicio înregistrare contabilă nu se face fără un document justificativ. Documentul este „dovada" că operațiunea a avut loc.

**Exemplu practic:**
Firma ta cumpără un laptop de 5.000 lei + TVA. Primești o factură de la furnizor. Aceasta este documentul justificativ. Fără această factură, contabilul nu poate înregistra nimic.

---

## 3. Etapa 2 — Nota contabilă (articolul contabil)

**Ce este:** „Traducerea" documentului justificativ în limbajul contabilității. Fiecare document generează cel puțin o notă contabilă — uneori mai multe.

**Cum funcționează:** Contabilitatea se bazează pe principiul **partidei duble**: fiecare operațiune afectează minimum două conturi — unul se debitează, altul se creditează. Suma debitului trebuie să fie întotdeauna egală cu suma creditului.

**Gândește-te la partidă dublă ca la un balansoar:** când o parte urcă (debit), cealaltă coboară (credit), dar greutatea totală rămâne aceeași.

**Exemplu concret — Achiziția laptopului de 5.000 lei + TVA 19% (950 lei):**

Un singur document (factura) generează o notă contabilă:

| Cont debitat | Cont creditat | Sumă |
|---|---|---|
| 214 „Mobilier, aparatură birotică…" (laptopul) | 404 „Furnizori de imobilizări" | 5.000 lei |
| 4426 „TVA deductibilă" | 404 „Furnizori de imobilizări" | 950 lei |

Tradus în limbaj normal: „Firma a primit un laptop în valoare de 5.000 lei și are dreptul de a deduce 950 lei TVA, dar datorează furnizorului 5.950 lei."

**Exemplu de document care generează mai multe note contabile:**

Același laptop, odată înregistrat, va genera în fiecare lună o notă contabilă suplimentară pentru **amortizare** (uzura laptopului în timp). Dacă laptopul se amortizează în 3 ani (36 de luni), în fiecare lună se va înregistra:

| Cont debitat | Cont creditat | Sumă |
|---|---|---|
| 6811 „Cheltuieli de exploatare privind amortizarea" | 2814 „Amortizarea altor imobilizări corporale" | ~139 lei/lună |

Tradus: „Luna aceasta, laptopul și-a pierdut din valoare cu 139 lei. Această pierdere de valoare este o cheltuială a firmei."

Deci dintr-un singur document (factura de laptop) rezultă:
1. Nota contabilă de achiziție (o singură dată)
2. Note contabile de amortizare (lunar, timp de 36 de luni)

---

## 4. Etapa 3 — Registrul Jurnal

**Ce este:** „Jurnalul de bord" al contabilității. Toate notele contabile din toate documentele, puse una după alta, în ordine cronologică (după data la care s-au întâmplat).

**Analogie:** Imaginează-ți un caiet în care scrii, zi de zi, absolut tot ce se întâmplă financiar în firmă. Nu grupezi pe categorii, nu faci rezumate — doar notezi totul, în ordinea în care se întâmplă.

**Ce conține fiecare rând din Registrul Jurnal:**
- Numărul de ordine al înregistrării
- Data operațiunii
- Documentul justificativ (tip, număr, dată)
- Explicația operațiunii
- Conturile debitoare și creditoare
- Sumele

**Exemplu simplificat de Registru Jurnal (pentru o săptămână):**

| Nr. | Data | Document | Explicație | Cont Debit | Cont Credit | Sumă (lei) |
|---|---|---|---|---|---|---|
| 1 | 03.03 | Factură #1234 | Achiziție laptop | 214 | 404 | 5.000 |
| 2 | 03.03 | Factură #1234 | TVA deductibilă laptop | 4426 | 404 | 950 |
| 3 | 04.03 | Factură #501 | Vânzare servicii client X | 4111 | 704 | 10.000 |
| 4 | 04.03 | Factură #501 | TVA colectată | 4111 | 4427 | 1.900 |
| 5 | 05.03 | Extras bancar | Plată chirie birou | 612 | 5121 | 3.000 |
| 6 | 07.03 | Stat de plată | Salarii luna februarie | 641 | 421 | 15.000 |

**De ce este important:** Registrul Jurnal este obligatoriu conform Legii contabilității nr. 82/1991. Este registrul din care poți reconstitui toată activitatea firmei, pas cu pas.

**Din perspectiva unui program de analiză:** Registrul Jurnal este cel mai detaliat set de date. Dacă ai acces la el, ai acces la TOATE informațiile — fiecare tranzacție, fiecare sumă, fiecare cont afectat.

---

## 5. Etapa 4 — Cartea Mare (Fișele de cont)

**Ce este:** Aceleași informații din Registrul Jurnal, dar reorganizate **pe conturi**. Dacă Registrul Jurnal este un jurnal cronologic, Cartea Mare este un dicționar: pentru fiecare cont contabil, arată toate mișcările care l-au afectat.

**Analogie:** Registrul Jurnal = agenda pe zile. Cartea Mare = câte un dosar pentru fiecare subiect (un dosar „Furnizori", un dosar „Banca", un dosar „Salarii" etc.).

**Exemplu — Fișa contului 5121 „Conturi la bănci în lei":**

| Data | Document | Explicație | Debit (intrări) | Credit (ieșiri) | Sold |
|---|---|---|---|---|---|
| 01.03 | Sold inițial | — | — | — | 50.000 |
| 04.03 | Extras bancar | Încasare client X | 11.900 | — | 61.900 |
| 05.03 | Extras bancar | Plată chirie | — | 3.000 | 58.900 |
| 07.03 | Extras bancar | Plată salarii | — | 15.000 | 43.900 |

**De ce este importantă:** Cartea Mare îți arată, pentru orice cont, cum a evoluat soldul în timp. Asta e util când vrei să verifici, de exemplu, câți bani mai ai în bancă, sau cât îți datorează un anumit client.

---

## 6. Etapa 5 — Balanța de verificare

**Ce este:** Un tabel rezumat care arată, pentru fiecare cont, patru informații esențiale:
1. **Soldul inițial** (la începutul perioadei — de obicei, la 1 ianuarie)
2. **Rulajul debitor** (toate sumele intrate pe debit în perioada analizată)
3. **Rulajul creditor** (toate sumele intrate pe credit în perioada analizată)
4. **Soldul final** (calculat automat)

**Analogie:** Dacă Registrul Jurnal este jurnalul de bord și Cartea Mare sunt dosarele pe subiecte, Balanța este „tabloul de bord" — vezi dintr-o privire starea tuturor conturilor.

**Exemplu simplificat de Balanță de verificare (la 31 martie):**

| Simbol cont | Denumire cont | Sold inițial D | Sold inițial C | Rulaj D | Rulaj C | Sold final D | Sold final C |
|---|---|---|---|---|---|---|---|
| 214 | Mobilier, aparatură | 20.000 | — | 5.000 | — | 25.000 | — |
| 2814 | Amortizare imobilizări | — | 8.000 | — | 139 | — | 8.139 |
| 401 | Furnizori | — | 5.000 | 5.000 | 12.000 | — | 12.000 |
| 404 | Furnizori de imobilizări | — | — | — | 5.950 | — | 5.950 |
| 4111 | Clienți | 15.000 | — | 11.900 | 11.900 | 15.000 | — |
| 4426 | TVA deductibilă | — | — | 950 | — | 950 | — |
| 4427 | TVA colectată | — | — | — | 1.900 | — | 1.900 |
| 5121 | Conturi la bănci | 50.000 | — | 11.900 | 18.000 | 43.900 | — |
| 612 | Cheltuieli cu chiriile | — | — | 3.000 | — | 3.000 | — |
| 641 | Cheltuieli cu salariile | — | — | 15.000 | — | 15.000 | — |
| 6811 | Cheltuieli cu amortizarea | — | — | 139 | — | 139 | — |
| 704 | Venituri din servicii | — | — | — | 10.000 | — | 10.000 |
| **TOTAL** | | **85.000** | **13.000**¹ | **52.889** | **59.889**¹ | **…** | **…** |

*(Notă: într-o balanță reală, totalul debitelor = totalul creditelor — acesta este „verificarea" din numele balanței.)*

**Regula fundamentală a balanței:** Total Solduri Debitoare = Total Solduri Creditoare. Dacă nu sunt egale, înseamnă că există o eroare undeva în înregistrări.

**De ce este importantă pentru un program de analiză financiară:** Balanța de verificare este cel mai utilizat punct de plecare pentru analiza financiară. Din ea poți extrage direct veniturile, cheltuielile, activele, datoriile, soldurile bancare — tot ce ai nevoie.

---

## 7. Etapa 6 — Situațiile financiare

**Ce sunt:** Rapoartele finale, oficiale, care sintetizează toată activitatea firmei într-o perioadă (de obicei, un an). Acestea se depun la ANAF și sunt publice.

### 7.1. Bilanțul contabil

**Ce arată:** O „fotografie" a firmei la un moment dat — de obicei 31 decembrie. Arată ce deține firma (active), ce datorează (datorii) și care este diferența (capitaluri proprii).

**Ecuația fundamentală:** ACTIVE = DATORII + CAPITALURI PROPRII

**Analogie:** Bilanțul este ca inventarul casei tale: ai o casă (activ) care valorează 200.000€, dar mai ai de plătit la bancă 120.000€ (datorie). Partea ta reală este 80.000€ (capital propriu).

**De unde vin datele:** Din balanța de verificare, conturile din clasele 1-5:
- **Active** = soldurile debitoare ale conturilor din clasele 2 (imobilizări), 3 (stocuri), 4 (creanțe — ce îți datorează alții), 5 (bani)
- **Datorii** = soldurile creditoare ale conturilor din clasele 1 (împrumuturi), 4 (furnizori — ce datorezi tu)
- **Capitaluri proprii** = capital social + rezerve + profit reportat (clasa 1)

### 7.2. Contul de Profit și Pierdere

**Ce arată:** „Filmul" activității firmei pe o perioadă (un an, un trimestru). Cât a câștigat firma (venituri) minus cât a cheltuit (cheltuieli) = profit sau pierdere.

**Ecuația:** VENITURI − CHELTUIELI = REZULTAT (profit sau pierdere)

**De unde vin datele:** Din balanța de verificare:
- **Venituri** = rulajele creditoare ale conturilor din clasa 7
- **Cheltuieli** = rulajele debitoare ale conturilor din clasa 6

**Exemplu simplu:**
- Venituri din servicii (cont 704): 10.000 lei
- Cheltuieli cu chiriile (cont 612): 3.000 lei
- Cheltuieli cu salariile (cont 641): 15.000 lei
- Cheltuieli cu amortizarea (cont 6811): 139 lei
- **Rezultat:** 10.000 − 3.000 − 15.000 − 139 = **−8.139 lei (pierdere)**

### 7.3. Alte componente

- **Note explicative** — detalii și explicații suplimentare
- **Situația modificărilor capitalului propriu** — cum s-a schimbat capitalul (pentru firme mari)
- **Situația fluxurilor de numerar** (cash-flow) — de unde au venit banii și unde au plecat

---

## 8. Planul de conturi: Structura și clasele

Planul de conturi este „catalogul" tuturor conturilor pe care o firmă le poate folosi. În România, este reglementat de OMFP 1802/2014 și cuprinde 9 clase:

**Clasele 1-5 = Conturi de bilanț** (apar în bilanț, au solduri la final de perioadă):

- **Clasa 1 — Capitaluri:** capital social, rezerve, profit reportat, împrumuturi pe termen lung, provizioane
- **Clasa 2 — Imobilizări:** clădiri, echipamente, mașini, licențe, brevete, participații (active pe termen lung)
- **Clasa 3 — Stocuri:** materii prime, mărfuri, produse finite, producție în curs
- **Clasa 4 — Terți:** clienți (cine îți datorează), furnizori (cui datorezi), stat (TVA, impozite), personal (salarii)
- **Clasa 5 — Trezorerie:** bani în bancă, bani în casă, investiții pe termen scurt

**Clasele 6-7 = Conturi de rezultat** (apar în contul de profit și pierdere, se „închid" la final de an):

- **Clasa 6 — Cheltuieli:** tot ce costă firma bani — materii prime, salarii, chirii, servicii, amortizare, impozite, dobânzi
- **Clasa 7 — Venituri:** tot ce aduce bani firmei — vânzări de produse, servicii prestate, chirii încasate, dobânzi primite

**Clasa 8 — Conturi speciale** (extrabilanțiere, adică informații suplimentare care nu intră direct în bilanț)

**Clasa 9 — Conturi de gestiune** (contabilitate de gestiune / managerială — opționale)

---

## 9. Conturi sintetice vs. conturi analitice

Aceasta este o distincție crucială pentru oricine vrea să construiască un program de analiză financiară.

### 9.1. Contul sintetic

**Ce este:** Contul „mare", cel de bază, definit în planul de conturi național. Are un simbol de 3 cifre (grad I) sau 4 cifre (grad II).

**Exemple:**
- **401** = „Furnizori" (toate datoriile către toți furnizorii firmei — un singur număr total)
- **4111** = „Clienți" (tot ce îți datorează toți clienții — o singură sumă totală)
- **5121** = „Conturi la bănci în lei" (tot ce ai în toate conturile bancare în lei)
- **641** = „Cheltuieli cu salariile personalului"

### 9.2. Contul analitic

**Ce este:** O detaliere a contului sintetic, creată de fiecare firmă în funcție de nevoile proprii. Adaugă cifre sau coduri suplimentare după simbolul contului sintetic.

**Exemplu concret:**
```
401       „Furnizori" (sintetic — totalul pe toți furnizorii)
├── 401.001   „Furnizor - Orange România" (analitic)
├── 401.002   „Furnizor - Dedeman" (analitic)
├── 401.003   „Furnizor - Emag" (analitic)
└── 401.004   „Furnizor - Enel Energie" (analitic)
```

**Alt exemplu — pentru cheltuieli:**
```
612       „Cheltuieli cu redevențele, locațiile de gestiune și chiriile" (sintetic)
├── 612.01    „Chirie birou central" (analitic)
├── 612.02    „Chirie depozit" (analytic)
└── 612.03    „Chirie loc de parcare" (analitic)
```

**Alt exemplu — pentru venituri:**
```
704       „Venituri din servicii prestate" (sintetic)
├── 704.01    „Venituri din consultanță IT" (analitic)
├── 704.02    „Venituri din mentenanță" (analitic)
└── 704.03    „Venituri din training" (analitic)
```

### 9.3. De ce contează pentru un program de analiză

**Regula de aur:** Suma tuturor analiticelor unui cont = soldul contului sintetic.

Dacă contul 704 (Venituri din servicii) arată un total de 100.000 lei, iar analiticele arată:
- 704.01 Consultanță IT = 60.000 lei
- 704.02 Mentenanță = 30.000 lei
- 704.03 Training = 10.000 lei

…atunci 60.000 + 30.000 + 10.000 = 100.000 lei ✓

**Implicație practică:** Un program de analiză financiară poate:
- La nivel sintetic: arăta totalul veniturilor din servicii
- La nivel analitic: arăta pe ce tip de serviciu câștigă firma cel mai mult

---

## 10. Cum extragi informații utile din balanță sau registru jurnal

Acesta este scopul final al unui program de analiză financiară: să ia datele „brute" și să le transforme în informații pe care le înțelege un patron, un manager sau un investitor.

### 10.1. Extragerea veniturilor

**Din balanță:** Ia toate conturile care încep cu **7** (clasa 7). Rulajul creditor al acestor conturi = veniturile firmei.

**Defalcarea pe categorii:**
- **Grupa 70** — Cifra de afaceri netă (venituri din activitatea principală)
  - 701 = vânzări de produse
  - 704 = venituri din servicii
  - 707 = venituri din vânzarea mărfurilor
- **Grupa 76** — Venituri financiare
  - 766 = venituri din dobânzi
  - 765 = venituri din diferențe de curs valutar
- **Grupa 78** — Venituri din provizioane și ajustări (tehnice, de corecție)

**Din registrul jurnal:** Filtrezi toate înregistrările care au în coloana „Cont Credit" un cont din clasa 7, apoi totalizezi sumele.

### 10.2. Extragerea cheltuielilor

**Din balanță:** Ia toate conturile care încep cu **6** (clasa 6). Rulajul debitor al acestor conturi = cheltuielile firmei.

**Defalcarea pe categorii:**
- **Grupa 60** — Cheltuieli cu stocurile (materii prime, materiale, mărfuri)
- **Grupa 61** — Cheltuieli cu lucrările/serviciile de la terți (chirii, reparații, întreținere)
- **Grupa 62** — Cheltuieli cu alte servicii (poștă, telecom, asigurări, deplasări, reclama)
- **Grupa 63** — Cheltuieli cu impozite și taxe (altele decât impozitul pe profit)
- **Grupa 64** — Cheltuieli cu personalul (salarii + contribuții sociale)
- **Grupa 65** — Alte cheltuieli de exploatare (amenzi, penalități, donații)
- **Grupa 66** — Cheltuieli financiare (dobânzi, pierderi din curs valutar)
- **Grupa 68** — Cheltuieli cu amortizarea și provizioanele

### 10.3. Calcularea profitului

**Profit din exploatare** = Venituri din exploatare (grupele 70-75) − Cheltuieli din exploatare (grupele 60-65, 68)

**Profit financiar** = Venituri financiare (grupa 76) − Cheltuieli financiare (grupa 66)

**Profit brut** = Profit din exploatare + Profit financiar

**Profit net** = Profit brut − Impozit pe profit (contul 691)

### 10.4. Extragerea activelor, datoriilor, capitalurilor (pentru bilanț)

**Active imobilizate** (ce deține firma pe termen lung):
- Conturi din clasa 2 (20x, 21x) minus amortizarea (conturi 28x)

**Active circulante** (ce deține firma pe termen scurt):
- Stocuri = solduri debitoare clasa 3
- Creanțe = solduri debitoare conturi 4111, 4118, 461 etc.
- Bani = solduri debitoare clasa 5

**Datorii:**
- Furnizori = solduri creditoare conturi 401, 404
- Datorii către stat = solduri creditoare conturi 441, 4427, 431 etc.
- Datorii la bănci = solduri creditoare conturi 162, 519 etc.

**Capitaluri proprii:**
- Capital social = sold creditor cont 1012
- Rezerve = sold creditor conturi 106x
- Profit/pierdere = sold cont 121

---

## 11. Exemple de analize pe care le poate face un program

Pornind de la o balanță de verificare sau un registru jurnal, un program poate calcula:

**Indicatori de profitabilitate:**
- Marja brută = (Venituri − Cost mărfuri vândute) / Venituri × 100
- Marja operațională = Profit din exploatare / Venituri × 100
- Marja netă = Profit net / Venituri × 100

**Indicatori de lichiditate:**
- Lichiditate curentă = Active circulante / Datorii pe termen scurt
- Lichiditate imediată = Disponibilități bănești / Datorii pe termen scurt

**Structura cheltuielilor:**
- Ce procent din cheltuieli merg pe salarii? Pe chirii? Pe materii prime?
- Cum evoluează fiecare categorie de la lună la lună?

**Evoluția veniturilor:**
- Pe ce serviciu/produs câștigă firma cel mai mult? (folosind conturile analitice)
- Cum evoluează vânzările în timp?

**Analiza clienților și furnizorilor:**
- Care client datorează cel mai mult? (analitice cont 4111)
- Cui datorează firma cel mai mult? (analitice cont 401)

---

## 12. Rezumat: Ce date ai nevoie pentru un program de analiză

| Sursă de date | Ce conține | Ce poți face cu ea |
|---|---|---|
| **Registrul Jurnal** | Fiecare tranzacție individuală, cu data, conturi, sume | Analiză granulară: pe zi, pe document, pe tranzacție |
| **Balanța de verificare** | Solduri și rulaje pe fiecare cont, la nivel sintetic și analitic | Analiză de sinteză: venituri totale, cheltuieli pe categorii, active, datorii |
| **Ambele combinat** | Atât detaliul cât și sinteza | Program complet de analiză financiară |

**Recomandare pentru construcția programului:**
- Dacă ai doar **balanța**, poți construi bilanțul, contul de profit și pierdere și indicatorii financiari de bază.
- Dacă ai doar **registrul jurnal**, poți reconstitui balanța (prin totalizare pe conturi) și apoi face tot ce face balanța, plus analize detaliate pe tranzacții.
- Ideal: pornești de la **registrul jurnal** (date brute), construiești automat balanța, și apoi generezi situații financiare și indicatori.

---

## 13. Glosar rapid

| Termen | Explicație simplă |
|---|---|
| **Debit** | Partea stângă a unui cont. Pentru conturi de activ/cheltuieli = creștere. Pentru conturi de pasiv/venituri = scădere. |
| **Credit** | Partea dreaptă a unui cont. Invers față de debit. |
| **Rulaj** | Totalul mișcărilor pe o perioadă (cât s-a mișcat pe debit sau pe credit). |
| **Sold** | Diferența dintre debit și credit = „cât rămâne" în cont. |
| **Sold debitor** | Debit > Credit (tipic pentru active și cheltuieli). |
| **Sold creditor** | Credit > Debit (tipic pentru datorii, capitaluri, venituri). |
| **Partidă dublă** | Fiecare tranzacție afectează min. 2 conturi; total debit = total credit. |
| **Exercițiu financiar** | Perioada contabilă, de obicei 1 ianuarie — 31 decembrie. |
| **ANAF** | Agenția Națională de Administrare Fiscală — instituția unde se depun situațiile financiare. |

---

*Document generat ca material educativ pentru înțelegerea fluxului contabil românesc în vederea construirii unui program de analiză financiară.*
