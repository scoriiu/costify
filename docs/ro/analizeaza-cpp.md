# Analizeaza Cont Profit si Pierdere

Contul de Profit si Pierdere (CPP) este raportul care raspunde la intrebarea: **cat am castigat sau pierdut in aceasta perioada?** In Costify, CPP-ul se calculeaza automat din jurnal, respectand structura oficiala OMFP 1802.

## Deschide tab-ul CPP

Pe pagina clientului, al treilea tab este **"Cont Profit si Pierdere"**. Apasa-l.

CPP-ul se afiseaza pentru perioada selectata in partea de sus (acelasi selector An + Luna ca la Balanta). Este **cumulativ** pana la sfarsitul lunii selectate — de exemplu, pentru "Decembrie 2025" vezi rezultatul pe anul intreg 2025.

## Structura CPP conform OMFP 1802

Costify urmareste structura oficiala din OMFP 1802:

```
═══════════════════════════════════════════
  VENITURI DIN EXPLOATARE
═══════════════════════════════════════════
  701  Vanzari de produse finite              50.000 RON
  704  Venituri din servicii prestate        280.000 RON
  706  Venituri din chirii                    12.000 RON
  707  Venituri din vanzarea marfurilor       45.000 RON
  708  Venituri din activitati diverse         8.000 RON
  711  Variatia stocurilor                    -5.000 RON
  ...
  TOTAL VENITURI EXPLOATARE                  390.000 RON

═══════════════════════════════════════════
  CHELTUIELI DIN EXPLOATARE
═══════════════════════════════════════════
  601  Cheltuieli materii prime               25.000 RON
  602  Cheltuieli materiale consumabile       15.000 RON
  ...
  641  Cheltuieli cu salariile               120.000 RON
  645  Cheltuieli asigurari sociale           28.000 RON
  ...
  6811 Cheltuieli amortizare                  18.000 RON
  TOTAL CHELTUIELI EXPLOATARE                290.000 RON

───────────────────────────────────────────
  REZULTAT DIN EXPLOATARE                   100.000 RON
───────────────────────────────────────────

═══════════════════════════════════════════
  VENITURI FINANCIARE
═══════════════════════════════════════════
  765  Venituri din diferente de curs valutar    500 RON
  766  Venituri din dobanzi                      800 RON
  TOTAL VENITURI FINANCIARE                    1.300 RON

═══════════════════════════════════════════
  CHELTUIELI FINANCIARE
═══════════════════════════════════════════
  665  Cheltuieli diferente curs valutar       1.200 RON
  666  Cheltuieli cu dobanzile                  3.500 RON
  TOTAL CHELTUIELI FINANCIARE                  4.700 RON

───────────────────────────────────────────
  REZULTAT FINANCIAR                         -3.400 RON
───────────────────────────────────────────

═══════════════════════════════════════════
  REZULTAT BRUT                              96.600 RON
═══════════════════════════════════════════

  691  Impozit pe profit                       15.456 RON

═══════════════════════════════════════════
  REZULTAT NET                                81.144 RON
═══════════════════════════════════════════
```

Fiecare sectiune are:
- **Header** colorat (VENITURI / CHELTUIELI EXPLOATARE / FINANCIARE)
- **Lista de conturi** cu sumele respective
- **Subtotal** pentru sectiune
- **Calcul intermediar** (Rezultat exploatare, Rezultat financiar)
- **Rezultat brut si net** la final

## Cum se calculeaza fiecare linie

Pentru fiecare cont din CPP, Costify:

1. **Parcurge balanta** pentru perioada selectata
2. **Gaseste rulajele totale** ale contului (rulaj D pentru cheltuieli, rulaj C pentru venituri)
3. **Afiseaza suma** in sectiunea corespunzatoare

Formulele:

- **Total venituri exploatare** = suma rulaje credit (rulajTC) ale conturilor din grupa "Venituri exploatare"
- **Total cheltuieli exploatare** = suma rulaje debit (rulajTD) ale conturilor din grupa "Cheltuieli exploatare"
- **Rezultat exploatare** = Total venituri exploatare - Total cheltuieli exploatare
- **Total venituri financiare** = suma rulaje credit ale conturilor 765, 766, 767, 768
- **Total cheltuieli financiare** = suma rulaje debit ale conturilor 665, 666, 668
- **Rezultat financiar** = Total venituri financiare - Total cheltuieli financiare
- **Rezultat brut** = Rezultat exploatare + Rezultat financiar
- **Impozit pe profit** = rulaj debit al contului 691
- **Rezultat net** = Rezultat brut - Impozit pe profit

## Interpretarea rezultatelor

### Rezultat pozitiv (profit)

Daca **Rezultat Net** este pozitiv, firma a generat profit in perioada selectata. Costify il afiseaza in **verde**.

Interpretari:

- **Profit brut pozitiv + profit net pozitiv** = firma merge bine
- **Profit brut pozitiv dar profit net zero** = impozitul "mananca" tot profitul — fiscalitate inefficient
- **Profit brut pozitiv dar profit net negativ** = imposibil teoretic (impozitul nu poate fi mai mare ca profitul)

### Rezultat negativ (pierdere)

Daca **Rezultat Net** este negativ, firma a pierdut bani. Costify il afiseaza in **rosu**.

Interpretari:

- **Rezultat exploatare negativ** = activitatea principala pierde — problema fundamentala
- **Rezultat exploatare pozitiv dar rezultat financiar foarte negativ** = plati mari la dobanzi/diferente de curs — problema financiara, nu operationala
- **Rezultat brut negativ** = nu se aplica impozit, iar pierderea se reporteaza in anii urmatori

### Verificari rapide

Cateva reguli de bun simt:

1. **Cheltuielile salariale (641 + 645 + 646)** trebuie sa fie aproximativ in linie cu numarul de angajati. Daca sunt mult mai mici sau mai mari, ceva e gresit.

2. **Cheltuielile cu marfuri (607)** trebuie sa fie corelate cu veniturile din vanzari (707). Daca ai vanzari mari si cheltuieli cu marfuri zero, e posibil sa existe o eroare la inregistrarea stocurilor.

3. **Amortizarea (6811)** trebuie sa fie corelata cu valoarea imobilizarilor din bilant. Firmele cu multe echipamente au amortizare semnificativa.

4. **TVA-ul NU apare in CPP** — TVA-ul de plata/recuperat este o datorie/creanta, nu un venit/cheltuiala. Daca vezi TVA in CPP, ceva e gresit.

## Cazuri speciale

### Firma noua (cu pierdere in primul an)

E normal ca in primul an o firma sa aiba pierdere din cauza investitiilor initiale (achizitii, recrutare, setup). Costify va afisa un Rezultat Net negativ — asta nu e neaparat o problema.

### Microintreprindere

Daca firma este **microintreprindere**, impozitul NU e pe profit, ci pe **venituri** (1% sau 3% din cifra de afaceri). Costify afiseaza impozitul asa cum e inregistrat in contul 691 — contabilul alege cum sa-l inregistreze.

**Important**: daca firma ta e micro si contul 691 e zero (pentru ca inregistrezi impozitul in alt cont), Rezultat Brut = Rezultat Net in Costify. Asta nu e o eroare, doar o diferenta de inregistrare.

### Inchiderea de an

La sfarsitul anului fiscal, conturile 6xx si 7xx se **inchid** in contul 121 (profit si pierdere). Dupa inchidere, conturile 6xx si 7xx sunt toate zero, iar soldul 121 reflecta rezultatul anului.

Costify detecteaza aceasta inchidere automat — la sfarsitul de an, CPP-ul afiseaza rezultatul correct chiar daca jurnalul contine notele de inchidere.

## Diferente fata de Saga

In multe cazuri, CPP-ul din Costify va fi **identic** cu cel din Saga. Daca sunt mici diferente, cauzele comune:

1. **Conturi lipsa in gruparea CPP** — daca clientul foloseste un cont rar (ex: `6026`, `6213`), si noi nu il avem inca in arrayuri, contul e "invizibil" in CPP. **Solutia**: ne spui si il adaugam in cod — in viitor va fi editabil din UI (vezi [Maparea conturilor](./maparea-conturilor.md)).

2. **Rotunjiri** — diferente de cativa bani din cauza modului diferit de rotunjire pot aparea

3. **Inchideri de luna vs inchideri de an** — daca Saga face inchideri lunare pe 121 iar Costify foloseste algoritmul de inchidere anuala, pot aparea diferente pe conturi de tip 6/7 la sfarsitul lunilor intermediare

4. **Conturi nestandard** — daca contabilul foloseste conturi analitice neobisnuite, si Saga le gestioneaza prin reguli interne

Pentru diferente cunoscute, vezi [Intrebari contabil](./intrebari-contabil-plan-conturi.md).

## Ce nu apare in CPP

CPP-ul **nu contine**:

- **Soldurile bilantiere** (cash, datorii, active) — acestea sunt in **Bilant** (nu in CPP)
- **Capitalul social** (clasa 1xx) — ramane in bilant
- **Imobilizari** (clasa 2xx) — in bilant
- **Stocuri** (clasa 3xx) — in bilant
- **Furnizori si clienti** (clasa 4xx) — in bilant
- **Conturi de trezorerie** (clasa 5xx) — in bilant

Exceptii: conturile 6xx si 7xx sunt cele care apar in CPP.

## Urmatori pasi

- [Intelege KPI-urile](./intelege-kpi.md) — cei 8 indicatori financiari
- [Cont Profit si Pierdere (bazele)](./cont-profit-si-pierdere.md) — explicatie conceptuala
- [Calculul CPP](./calcul-cpp.md) — detalii tehnice despre algoritm
