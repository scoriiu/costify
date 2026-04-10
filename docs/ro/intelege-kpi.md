# Intelege KPI-urile

Costify afiseaza **8 indicatori cheie de performanta (KPI)** deasupra balantei. Ei iti ofera o privire rapida asupra sanatatii financiare a firmei, fara sa trebuiasca sa citesti intregul tabel.

## Cele 8 KPI-uri

### 1. Cash & Banca

**Ce inseamna**: cati bani ai efectiv in banca si casa.

**Formula**:
```
Cash & Banca = 5121 + 5124 + 5311 + 5314
```

Unde:
- `5121` = cont curent la banci in lei
- `5124` = cont curent la banci in valuta (echivalent in lei)
- `5311` = casa in lei
- `5314` = casa in valuta (echivalent in lei)

Acesti patru conturi sunt calculate cu **sold final debitor** (pentru ca sunt conturi de activ).

**Interpretare**: cat cash ai *chiar acum* (sau la sfarsitul perioadei selectate). Este cel mai direct indicator de lichiditate.

**Exemplu**: daca Cash & Banca = 250.000 RON, poti plati mai multe luni de salarii si datorii fara sa trebuiasca sa iei credit.

### 2. Creante clienti

**Ce inseamna**: cat iti datoreaza clientii tai — facturi emise dar neincasate.

**Formula**:
```
Creante clienti = 4111 (sold final debitor)
```

Unde `4111` = Clienti (sold debitor inseamna "clientii imi datoreaza X RON").

**Interpretare**: bani pe care ii astepti sa ii incasezi. Un numar mare arata ca ai facturat mult, dar poate arata si ca ai probleme cu incasarile.

**Alarme**:
- Daca Creantele cresc constant fara ca vanzarile sa creasca, inseamna ca clientii platesc cu intarziere
- Daca Creantele sunt mai mari decat venitul pe 3 luni, ai risc de cash flow negativ
- **DSO (Days Sales Outstanding)** = `Creante / Venituri_lunare * 30` — cate zile in medie dureaza pana incasezi o factura. Valoare sanatoasa: sub 60 zile.

### 3. Datorii furnizori

**Ce inseamna**: cat datorezi furnizorilor tai — facturi primite dar neplatite.

**Formula**:
```
Datorii furnizori = 401 + 404 (sold final creditor)
```

Unde:
- `401` = Furnizori (datorii generale)
- `404` = Furnizori de imobilizari (datorii pentru echipamente/cladiri)

**Interpretare**: datoriile tale operationale. Un numar mare inseamna ca folosesti "credit comercial" de la furnizori, ceea ce e bine daca iti planifici cash flow-ul.

**Alarme**:
- Datorii crescute fara putere de plata = risc de intarzieri la plati si penalitati
- Daca Datorii > Cash & Banca, s-ar putea sa ai probleme sa platesti la termen

### 4. TVA de plata

**Ce inseamna**: cat TVA datorezi la ANAF.

**Formula** (simplificata):
```
TVA de plata = 4427 (sold creditor) - 4426 (sold debitor)
```

Unde:
- `4427` = TVA colectata (din vanzari)
- `4426` = TVA deductibila (din cumparari)

Daca **4427 > 4426**, ai TVA de plata la ANAF (colorat rosu in UI).
Daca **4426 > 4427**, ai TVA de recuperat (deductibil > colectat).

**Interpretare**: asta iti arata cat TVA datorezi la ANAF pentru perioada curenta. Termenul de plata este pana pe 25 ale lunii urmatoare.

**Formula reala in legislatie** e mai complexa (include si 4423, 4424, 4428), dar pentru un KPI de privire rapida formula simplificata e suficienta.

### 5. Venituri totale

**Ce inseamna**: totalul veniturilor pe anul selectat (cumulativ pana la sfarsitul lunii).

**Formula**:
```
Venituri totale = SUM(rulaj total credit) pentru toate conturile clasa 7
```

Include toate conturile de venit: vanzari produse (701), servicii (704), chirii (706), marfuri (707), venituri financiare (765-768), etc.

**Interpretare**: cifra de afaceri totala. Pentru o analiza mai buna, ar trebui separate veniturile din exploatare de cele financiare (vezi [Analizeaza CPP](./analizeaza-cpp.md)).

### 6. Cheltuieli totale

**Ce inseamna**: totalul cheltuielilor pe anul selectat.

**Formula**:
```
Cheltuieli totale = SUM(rulaj total debit) pentru toate conturile clasa 6
```

Include: cheltuieli cu materialele, salariile, chiriile, utilitatile, serviciile, amortizarea, dobanzi, etc.

**Interpretare**: costurile totale de operare ale firmei.

### 7. Rezultat

**Ce inseamna**: venitul net — diferenta intre venituri si cheltuieli.

**Formula**:
```
Rezultat = Venituri totale - Cheltuieli totale
```

**Afisare in Costify**:
- **Verde** daca pozitiv (profit)
- **Rosu** daca negativ (pierdere)

**Important**: aceasta formula este **simplificata**. Nu include impozitul pe profit (691). Pentru rezultatul net real (dupa impozit), vezi CPP-ul.

**Interpretare**: cat a castigat firma in perioada selectata, **inainte** de impozit.

### 8. Marja operationala

**Ce inseamna**: profitul ca procent din venituri — cat din fiecare leu incasat devine profit.

**Formula**:
```
Marja operationala = (Rezultat / Venituri totale) × 100
```

**Afisare**:
- **Verde** daca pozitiv
- **Rosu** daca negativ

**Interpretare**:
- **Marja > 20%** = foarte profitabil (tech, SaaS, consultanta premium)
- **Marja 10-20%** = sanatos (IT, servicii profesionale)
- **Marja 5-10%** = stabil dar fragil (retail, constructii)
- **Marja 0-5%** = marje foarte mici, orice perturbare duce la pierdere
- **Marja negativa** = firma pierde bani

Marja operationala e un KPI mai util decat doar "profit absolut" — te ajuta sa compari firme de marimi diferite si sa vezi daca situatia se imbunatateste sau se deterioreaza in timp.

## Cum folosesti KPI-urile

### Scanare rapida

Cand deschizi o firma, primul lucru la care te uiti sunt KPI-urile. In 5 secunde iti dai seama:

- **Cash & Banca**: are bani sau nu?
- **Creante vs Datorii**: creantele sunt mai mari ca datoriile? (bine)
- **Rezultat**: profit sau pierdere?
- **Marja**: procent rezonabil?

### Comparatie intre perioade

Schimba luna in selectorul de perioada si vezi cum se schimba KPI-urile. De exemplu:

- Noiembrie 2025: Rezultat = 80K RON, Marja = 16%
- Decembrie 2025: Rezultat = 95K RON, Marja = 17%

Semn bun — profitul creste.

### Alarme

Semne rosii de care sa te preocupi:
- **Cash & Banca scade constant** = cash flow negativ
- **Creante crescute peste 90 zile** = probleme cu incasarile
- **Datorii > Cash & Banca** = risc de lichiditate
- **TVA de plata mare cu putin cash** = iti vei plati cu greu obligatiile la ANAF
- **Rezultat si Marja in scadere constanta** = afacerea pierde tractiune

## Diferente cu CPP-ul

KPI-ul **"Rezultat"** din cardul de sus este o formula **simplificata** (venituri totale - cheltuieli totale). El **nu** respecta structura OMFP 1802 precum CPP-ul.

Pentru rezultatul **oficial** conform OMFP, mergi la tab-ul **Cont Profit si Pierdere** — acolo este structurat corect, cu separarea exploatare/financiar, impozit pe profit si rezultat net.

Cele doua pot sa difere putin pentru ca:
- KPI-ul ignora impozitul pe profit (691) — CPP-ul il scade
- KPI-ul pune totul impreuna — CPP-ul separa exploatare de financiar

## Limitari cunoscute

KPI-urile actuale sunt **statice** — iti arata doar valoarea curenta. Nu arata:

- **Trenduri** — cum evolueaza in timp (grafic sparkline)
- **Comparatie cu perioada precedenta** — "cu cat mai mult decat luna trecuta?"
- **Comparatie cu buget** — "am atins tinta?"
- **Sanatatea istorica** — "cum arata aceste KPI-uri in ultimii 12 luni?"

Toate acestea sunt in roadmap pentru versiuni viitoare. Pentru acum, compari perioade manual schimband selectorul.

## Urmatori pasi

- [Citeste balanta](./citeste-balanta.md) — tab-ul de unde provin KPI-urile
- [Analizeaza CPP](./analizeaza-cpp.md) — versiunea oficiala a rezultatului
- [Foloseste Costi AI](./foloseste-costi.md) — intreaba in limbaj natural despre KPI-uri
