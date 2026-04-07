# Note Contabile -- Romanian Journal Entries Reference

This document contains the standard journal entries (note contabile / formule contabile) for all common business transactions in Romania, organized by business process. This is the reference Costify uses for automatic transaction classification.

---

## 1. Achizitii si Furnizori (Purchases & Suppliers)

### Achizitie materii prime cu factura
```
%           = 401 Furnizori
  301 Materii prime         (valoare neta)
  4426 TVA deductibila      (TVA)
```

### Achizitie materiale consumabile
```
%           = 401 Furnizori
  302 Materiale consumabile (valoare neta)
  4426 TVA deductibila      (TVA)
```

### Achizitie marfuri (goods for resale)
```
%           = 401 Furnizori
  371 Marfuri               (valoare neta)
  4426 TVA deductibila      (TVA)
```

### Achizitie servicii (services received)
```
%           = 401 Furnizori
  628 Alte cheltuieli cu serviciile  (valoare neta)
  4426 TVA deductibila              (TVA)
```

### Plata furnizor prin banca
```
401 Furnizori = 5121 Conturi la banci in lei
```

### Plata furnizor din casa
```
401 Furnizori = 5311 Casa in lei
```

### Avans acordat furnizor
```
%           = 5121 Conturi la banci in lei
  4091 Furnizori debitori   (valoare neta)
  4426 TVA deductibila      (TVA pe avans)
```

### Factura furnizor nesosite (accrual at month-end)
```
%           = 408 Furnizori - facturi nesosite
  6xx Cheltuiala            (valoare neta)
  4428 TVA neexigibila      (TVA)
```

### Sosirea facturii (reversare nesosite)
```
408 Furnizori - facturi nesosite = %
  6xx Cheltuiala reversal        (-)
  4428 TVA neexigibila reversal  (-)

%           = 401 Furnizori
  6xx Cheltuiala            (valoare definitiva)
  4426 TVA deductibila      (TVA definitiv)
```

---

## 2. Vanzari si Clienti (Sales & Customers)

### Vanzare produse finite cu factura
```
4111 Clienti = %
  701 Venituri din vanzarea produselor finite (valoare neta)
  4427 TVA colectata                          (TVA)
```

### Vanzare servicii cu factura
```
4111 Clienti = %
  704 Venituri din servicii prestate (valoare neta)
  4427 TVA colectata                  (TVA)
```

### Vanzare marfuri cu factura
```
4111 Clienti = %
  707 Venituri din vanzarea marfurilor (valoare neta)
  4427 TVA colectata                    (TVA)
```

### Incasare client prin banca
```
5121 Conturi la banci in lei = 4111 Clienti
```

### Incasare client in numerar
```
5311 Casa in lei = 4111 Clienti
```

### Avans primit de la client
```
5121 Conturi la banci in lei = %
  419 Clienti creditori     (valoare neta)
  4427 TVA colectata        (TVA pe avans)
```

### Factura de intocmit (unbilled revenue at month-end)
```
418 Clienti - facturi de intocmit = %
  70x Venituri              (valoare neta)
  4428 TVA neexigibila      (TVA)
```

### Scoatere din evidenta creanta neincasabila
```
654 Pierderi din creante = 4111 Clienti
```

---

## 3. Salarizare (Payroll)

### Inregistrare salarii brute lunare
```
641 Cheltuieli cu salariile = 421 Personal - salarii datorate
```

### Retinere CAS angajat (25%)
```
421 Personal - salarii datorate = 4312 CAS angajat
```

### Retinere CASS angajat (10%)
```
421 Personal - salarii datorate = 4314 CASS angajat
```

### Retinere impozit pe venit din salarii (10%)
```
421 Personal - salarii datorate = 444 Impozit pe venituri de natura salariilor
```

### Contributia asiguratorie pentru munca - CAM angajator (2.25%)
```
646 Cheltuieli cu CAM = 4311 CAM angajator
```

### Plata salariu net prin banca
```
421 Personal - salarii datorate = 5121 Conturi la banci in lei
```

### Plata CAS catre buget
```
4312 CAS angajat = 5121 Conturi la banci in lei
```

### Plata CASS catre buget
```
4314 CASS angajat = 5121 Conturi la banci in lei
```

### Plata CAM catre buget
```
4311 CAM angajator = 5121 Conturi la banci in lei
```

### Plata impozit pe salarii catre buget
```
444 Impozit pe venituri de natura salariilor = 5121 Conturi la banci in lei
```

### Tichete de masa
```
642 Cheltuieli cu tichete de masa = 5328 Alte valori (tichete)
```

---

## 4. TVA - Taxa pe Valoarea Adaugata (VAT)

### Regularizare TVA lunara - TVA de plata (4427 > 4426)
```
4427 TVA colectata = %
  4426 TVA deductibila      (suma TVA deductibila)
  4423 TVA de plata          (diferenta = TVA colectata - TVA deductibila)
```

### Regularizare TVA lunara - TVA de recuperat (4426 > 4427)
```
%           = 4426 TVA deductibila
  4427 TVA colectata         (suma TVA colectata)
  4424 TVA de recuperat      (diferenta = TVA deductibila - TVA colectata)
```

### Plata TVA de plata catre buget
```
4423 TVA de plata = 5121 Conturi la banci in lei
```

### Incasare rambursare TVA
```
5121 Conturi la banci in lei = 4424 TVA de recuperat
```

---

## 5. Impozite (Taxes)

### Impozit pe profit trimestrial
```
691 Cheltuieli cu impozitul pe profit = 4411 Impozit pe profit
```

### Plata impozit pe profit
```
4411 Impozit pe profit = 5121 Conturi la banci in lei
```

### Impozit microintreprindere trimestrial
```
698 Cheltuieli cu impozitul pe venit micro = 4418 Impozit pe venit micro
```

### Plata impozit microintreprindere
```
4418 Impozit pe venit micro = 5121 Conturi la banci in lei
```

### Alte taxe locale (impozit cladiri, teren, auto)
```
635 Cheltuieli cu alte impozite = 446 Alte impozite, taxe
```

### Plata taxe locale
```
446 Alte impozite, taxe = 5121 Conturi la banci in lei
```

---

## 6. Imobilizari (Fixed Assets)

### Achizitie echipament/masina
```
%           = 404 Furnizori de imobilizari
  213x Instalatii/masini    (valoare neta)
  4426 TVA deductibila      (TVA)
```

### Achizitie software
```
%           = 404 Furnizori de imobilizari
  2052 Software              (valoare neta)
  4426 TVA deductibila      (TVA)
```

### Achizitie autoturism
```
%           = 404 Furnizori de imobilizari
  2133 Mijloace de transport (valoare neta)
  4426 TVA deductibila      (TVA - 50% deductibil pentru auto)
```

### Plata furnizor de imobilizari
```
404 Furnizori de imobilizari = 5121 Conturi la banci in lei
```

### Amortizare lunara
```
6811 Cheltuieli cu amortizarea = 28xx Amortizari
```

### Casare imobilizare complet amortizata
```
28xx Amortizari = 2xxx Imobilizarea (la valoarea bruta)
```

### Vanzare imobilizare
```
4111 Clienti = %
  7583 Venituri din vanzarea activelor (pret vanzare fara TVA)
  4427 TVA colectata                   (TVA)

%           = 2xxx Imobilizarea
  28xx Amortizarea cumulata    (amortizare)
  6583 Cheltuieli cu activele cedate (valoare ramasa neamortizata)
```

---

## 7. Operatiuni Bancare (Banking Operations)

### Comision bancar
```
627 Cheltuieli cu serviciile bancare = 5121 Conturi la banci in lei
```

### Dobanda incasata
```
5121 Conturi la banci in lei = 766 Venituri din dobanzi
```

### Dobanda platita la credit
```
666 Cheltuieli privind dobanzile = 5121 Conturi la banci in lei
```

### Ridicare numerar din banca (CEC/ATM)
```
581 Viramente interne = 5121 Conturi la banci in lei
5311 Casa in lei = 581 Viramente interne
```

### Depunere numerar in banca
```
581 Viramente interne = 5311 Casa in lei
5121 Conturi la banci in lei = 581 Viramente interne
```

### Transfer intre conturi bancare
```
581 Viramente interne = 5121 Cont banca sursa
5121 Cont banca destinatie = 581 Viramente interne
```

### Primire credit bancar pe termen scurt
```
5121 Conturi la banci in lei = 5191 Credite bancare pe termen scurt
```

### Rambursare credit bancar pe termen scurt
```
5191 Credite bancare pe termen scurt = 5121 Conturi la banci in lei
```

### Primire credit bancar pe termen lung
```
5121 Conturi la banci in lei = 162 Credite bancare pe termen lung
```

---

## 8. Capital si Dividende

### Subscrierea capitalului social
```
456 Decontari cu asociatii privind capitalul = 1011 Capital subscris nevarsat
```

### Varsarea capitalului in banca
```
5121 Conturi la banci in lei = 456 Decontari cu asociatii privind capitalul
```

### Trecerea capitalului la varsat
```
1011 Capital subscris nevarsat = 1012 Capital subscris varsat
```

### Repartizarea profitului la dividende
```
129 Repartizarea profitului = 457 Dividende de plata
```

### Retinere impozit pe dividende (16%)
```
457 Dividende de plata = 446 Alte impozite (impozit dividende 16%)
```

### Plata dividende
```
457 Dividende de plata = 5121 Conturi la banci in lei
```

### Constituire rezerve legale (5% din profit brut)
```
129 Repartizarea profitului = 1061 Rezerve legale
```

---

## 9. Cheltuieli Curente de Exploatare

### Chirie sediu/birou
```
%           = 401 Furnizori
  612 Cheltuieli cu chiriile (valoare neta)
  4426 TVA deductibila       (TVA)
```

### Utilitati (energie, apa, gaz)
```
%           = 401 Furnizori
  605 Cheltuieli cu energia si apa (valoare neta)
  4426 TVA deductibila             (TVA)
```

### Combustibil/carburant
```
%           = 401 Furnizori
  6022 Cheltuieli cu combustibilul (valoare neta)
  4426 TVA deductibila             (TVA - 50% deductibil pt auto)
```

### Telefon/internet
```
%           = 401 Furnizori
  626 Cheltuieli postale si telecomunicatii (valoare neta)
  4426 TVA deductibila                       (TVA)
```

### Asigurari (CASCO, RCA, sediu)
```
613 Cheltuieli cu primele de asigurare = 401 Furnizori
(fara TVA - asigurarile sunt scutite de TVA)
```

### Servicii contabilitate/juridice
```
%           = 401 Furnizori
  622 Cheltuieli cu comisioanele si onorariile (valoare neta)
  4426 TVA deductibila                         (TVA)
```

### Publicitate/marketing
```
%           = 401 Furnizori
  623 Cheltuieli de reclama si publicitate (valoare neta)
  4426 TVA deductibila                      (TVA)
```

### Deplasari/transport personal
```
625 Cheltuieli cu deplasari = 5121 Conturi la banci in lei
(sau = 5311 Casa in lei daca platit cash)
```

---

## 10. Operatiuni Valutare (Foreign Currency)

### Incasare factura in EUR
```
5124 Conturi la banci in valuta = 4111 Clienti
(la cursul BNR din ziua incasarii)
```

### Diferenta favorabila de curs (curs incasare > curs facturare)
```
4111 Clienti = 765 Venituri din diferente de curs valutar
```

### Diferenta nefavorabila de curs (curs incasare < curs facturare)
```
665 Cheltuieli din diferente de curs valutar = 4111 Clienti
```

### Evaluare lunara solduri in valuta (reevaluare la curs BNR)
```
Diferenta favorabila:
5124 Conturi la banci in valuta = 765 Venituri din diferente de curs valutar

Diferenta nefavorabila:
665 Cheltuieli din diferente de curs valutar = 5124 Conturi la banci in valuta
```

---

## 11. Inchiderea Exercitiului Financiar (Year-End Closing)

### Inchiderea conturilor de cheltuieli
```
121 Profit sau pierdere = 6xx Fiecare cont de cheltuieli
(se debiteaza 121 cu totalul cheltuielilor)
```

### Inchiderea conturilor de venituri
```
7xx Fiecare cont de venituri = 121 Profit sau pierdere
(se crediteaza 121 cu totalul veniturilor)
```

### Daca 121 are sold creditor -> PROFIT
### Daca 121 are sold debitor -> PIERDERE

### Repartizarea profitului
```
121 Profit sau pierdere = 129 Repartizarea profitului
129 Repartizarea profitului = 1061 Rezerve legale (5%)
129 Repartizarea profitului = 457 Dividende de plata
129 Repartizarea profitului = 1171 Rezultatul reportat (rest)
```

---

## 12. Storno (Reversal Entries)

In Romanian accounting, errors are corrected using storno entries:

### Storno in rosu (Red reversal -- negative amounts, same accounts)
```
Same debit/credit accounts but with NEGATIVE amounts
This is the preferred method in Romania
```

### Storno in negru (Black reversal -- reverse debit/credit)
```
Original entry reversed: credit becomes debit, debit becomes credit
Used when storno in rosu is not possible
```

---

## 13. Provizioane (Provisions)

### Constituire provizion pentru litigii
```
6812 Cheltuieli cu provizioanele = 1511 Provizioane pentru litigii
```

### Anulare/diminuare provizion
```
1511 Provizioane pentru litigii = 7812 Venituri din provizioane
```

### Constituire ajustari pentru deprecierea creantelor clienti
```
6814 Cheltuieli cu ajustarile pentru deprecierea activelor circulante = 491 Ajustari pentru deprecierea creantelor
```

---

## Formule Contabile Compuse vs Simple

**Formula simpla** (un cont debit, un cont credit):
```
5121 = 4111   (incasare client)
```

**Formula compusa** (mai multe conturi debit sau credit):
```
%    = 401    (achizitie cu TVA -- mai multe debite)
  301
  4426

4111 = %      (vanzare cu TVA -- mai multe credite)
  701
  4427
```

The `%` sign in Romanian accounting means "multiple accounts" (echivalent with compound/split entry).
