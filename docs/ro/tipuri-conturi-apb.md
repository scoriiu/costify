# Tipuri de conturi: A, P, B

Toate conturile din planul OMFP 1802 sunt impartite in trei tipuri, in functie de **cum se comporta** atunci cand se debiteaza sau se crediteaza:

- **A** — Active (cresc pe debit)
- **P** — Pasive (cresc pe credit)
- **B** — Bifunctionale (pot fi A sau P in functie de situatie)

Acest articol explica diferenta si cum sa identifici tipul unui cont fara sa-l cauti intr-un manual.

## Conturi de Activ (A)

Un **cont de activ** reprezinta **ce ai** sau **ce ti se cuvine**:

- Bani in banca → cont activ
- Bani in casa → cont activ
- Marfa in stoc → cont activ
- Imprumuturi date catre altii → cont activ
- Echipamente, cladiri → cont activ
- Cheltuieli (consum de resurse) → cont activ

**Regula**: conturile de activ **cresc pe debit** si **scad pe credit**. Daca debitezi un cont activ, soldul lui creste. Daca il creditezi, scade.

### Exemplu: contul 5121 (Banca)

```
Soldul initial: 10.000 RON

Tranzactie: incasezi 5.000 RON de la un client
D: 5121 (Banca)            5.000   ← debitezi banca
C: 4111 (Clienti)          5.000

Soldul nou: 10.000 + 5.000 = 15.000 RON
```

```
Tranzactie: platesti 3.000 RON unui furnizor
D: 401 (Furnizori)         3.000
C: 5121 (Banca)            3.000   ← creditezi banca

Soldul nou: 15.000 - 3.000 = 12.000 RON
```

Banca crestea cand era debitata, scadea cand era creditata. Asta este definitia unui cont activ.

### Lista cu conturi de activ frecvente

- **Clasa 2**: 211, 212, 213x, 214 (imobilizari)
- **Clasa 3**: 301, 302, 303, 345, 371, 381 (stocuri)
- **Clasa 4 (creante)**: 4111, 4118, 461, 542 (debitori)
- **Clasa 5**: 5121, 5124, 5311, 5314, 542 (bani lichizi)
- **Clasa 6 (toate)**: 6xx (cheltuieli)

## Conturi de Pasiv (P)

Un **cont de pasiv** reprezinta **ce datorezi** sau **de unde a venit finantarea**:

- Bani datorati furnizorilor → cont pasiv
- Salarii datorate angajatilor → cont pasiv
- Credite primite de la banca → cont pasiv
- Capital social (banii pusi de asociat) → cont pasiv
- Profit reportat (banii ramasi din anii anteriori) → cont pasiv
- Venituri (sursa de profit nou) → cont pasiv

**Regula**: conturile de pasiv **cresc pe credit** si **scad pe debit**. Exact invers fata de active.

### Exemplu: contul 401 (Furnizori)

```
Soldul initial: 0

Tranzactie: primesti factura 5.000 RON de la furnizor (nu ai platit inca)
D: 628 (Cheltuieli servicii)    5.000
C: 401 (Furnizori)              5.000   ← creditezi furnizori

Soldul nou: 5.000 RON (datorezi 5.000 RON)
```

```
Tranzactie: platesti factura
D: 401 (Furnizori)             5.000   ← debitezi furnizori
C: 5121 (Banca)                5.000

Soldul nou: 5.000 - 5.000 = 0 (datoria s-a stins)
```

Datoria catre furnizori a crescut cand era creditata, a scazut cand era debitata. Asta este definitia unui cont pasiv.

### Lista cu conturi de pasiv frecvente

- **Clasa 1**: 101, 104, 106, 117, 162, 419 (capital, rezerve, credite pe termen lung)
- **Clasa 2 (amortizari)**: 281x — sunt **opusul** imobilizarilor, deci de tip pasiv
- **Clasa 3 (ajustari)**: 391, 397 — ajustari de stoc, sunt de tip pasiv
- **Clasa 4 (datorii)**: 401, 404, 408, 419 (avansuri primite), 421, 425, 431x, 437, 4423, 4427, 444, 446, 447, 462
- **Clasa 5**: 5191 (credite pe termen scurt) — pasiv
- **Clasa 6**: niciunul (toate sunt active)
- **Clasa 7 (toate)**: 7xx (venituri)

## Conturi Bifunctionale (B)

Un **cont bifunctional** poate avea **fie sold debitor, fie sold creditor**, in functie de circumstante. In esenta, se comporta uneori ca activ, alteori ca pasiv.

Cel mai cunoscut exemplu: **contul 121 — Profit sau pierdere**.

- Daca firma a inregistrat profit anul anterior → 121 are sold creditor (e ca un cont pasiv: profit = sursa de capital).
- Daca firma a inregistrat pierdere → 121 are sold debitor (pierderea "consuma" capital).

Alt exemplu: **contul 4423 — TVA de plata**. In mod normal, are sold creditor (datorezi TVA statului). Dar daca o luna ai mai multa TVA dedusa decat colectata, balanta TVA inverseaza si ai TVA de recuperat — atunci contul are sold debitor (sau, mai corect, mergi pe contul 4424 — TVA de recuperat).

### Cum apar in balanta

In Costify, conturile bifunctionale sunt afisate cu sold pe coloana corecta (debit sau credit), in functie de situatie. Algoritmul nu impune o coloana fixa.

### Lista cu conturi bifunctionale frecvente

- **121** — Profit sau pierdere (poate fi profit sau pierdere)
- **129** — Repartizarea profitului
- **4423** / **4424** — TVA de plata / de recuperat
- **481, 482** — Decontari intre subunitati

## Cum sa identifici tipul fara manual

Daca esti la inceput, poti memora cele 50-100 conturi cele mai frecvente cu tipul lor. Dar exista si o regula generala bazata pe **prima cifra a codului** (clasa) si pe **continut**:

| Clasa | Tipul predominant | Exceptii |
|---|---|---|
| 1 | P (capital, datorii pe termen lung) | 121 e B (profit/pierdere) |
| 2 | A (imobilizari) | 281x e P (amortizari, opusul imobilizarilor) |
| 3 | A (stocuri) | 39x e P (ajustari de stoc) |
| 4 | Variabil — depinde de cont | 401 P, 4111 A, 4423 B |
| 5 | A (banca, casa) | 5191 P (credit pe termen scurt) |
| 6 | A (toate cheltuielile) | niciuna |
| 7 | P (toate veniturile) | niciuna |
| 8 | Variabil | rareori folosit |

**Regula simplificata**:
- Daca contul reprezinta **ceva ce ai sau o cheltuiala** → A
- Daca contul reprezinta **o datorie sau un venit** → P
- Daca contul poate fi in ambele situatii → B

## De ce e important

Cand interpretezi o balanta sau un raport, **trebuie sa stii pe ce coloana sa cauti soldul**:

- Pentru un cont de **activ** → soldul apare pe **Sold final D**.
- Pentru un cont de **pasiv** → soldul apare pe **Sold final C**.
- Pentru un cont **bifunctional** → poate fi pe oricare coloana.

Daca vezi un cont activ cu sold pe coloana credit (sau invers), ai o anomalie. Cele mai frecvente cauze:
1. **Eroare de inregistrare** — cineva a confundat D cu C.
2. **Avans** — gen 419 (Clienti-creditori), care e tehnic in clasa 4 dar reprezinta un avans primit, deci se comporta ca pasiv.
3. **Cont in stingere** — la sfarsitul lunii, contul ar trebui sa fie zero.

In Costify, balanta afiseaza **ambele coloane** mereu (Sold D si Sold C), astfel poti vedea instant pe care exista valori si daca exista anomalii.

## Greseli frecvente la incepatori

1. **"Cheltuielile sunt active?"** — Da. Pare contraintuitiv pentru ca "iese cheva", dar conturile de cheltuieli (clasa 6) sunt **toate active**. Logica: cheltuiala "consuma" o resursa (banii sau alte active), iar consumul se acumuleaza pe debit.

2. **"Veniturile sunt pasive?"** — Da. Pare contraintuitiv pentru ca "intra ceva", dar conturile de venituri (clasa 7) sunt **toate pasive**. Logica: venitul "creeaza" o sursa de finantare (capital nou), iar sursele se acumuleaza pe credit.

3. **"Banca e mereu pe debit, deci e mereu pozitiva"** — Cu o exceptie: daca ai descoperit de cont, soldul tau real la banca poate fi negativ. In contabilitate, asta inseamna sold creditor pe 5121, ceea ce este un semnal ca trebuie sa-l muti pe 5191 (credit bancar pe termen scurt).

## Urmatori pasi

- [Debit si credit](./debit-credit.md) — regulile de baza
- [Planul de conturi OMFP 1802](./plan-de-conturi.md) — lista completa
- [Clasele de conturi (1-9)](./clase-de-conturi.md) — detalii pe fiecare clasa
- [Balanta de verificare](./balanta-de-verificare.md) — unde apar tipurile in raport
