# Balanta de verificare

Daca jurnalul este "ce s-a intamplat in ordine cronologica", balanta de verificare este "ce avem agregat per cont la o data anume". Este unul dintre cele mai importante rapoarte contabile si **prima oprire a oricarui control fiscal sau audit**.

Acest articol explica ce contine, cum se citeste, si la ce iti foloseste.

## Definitie

> Balanta de verificare este un document contabil de sinteza, care prezinta toate conturile cu rulaje sau solduri, intr-o forma agregata, pentru o perioada sau pana la o data anume.

In esenta: pentru fiecare cont din planul de conturi, balanta arata cat s-a debitat, cat s-a creditat, si care este soldul rezultat.

## Structura unei balante

Balanta clasica romaneasca are urmatoarele coloane:

| Coloana | Ce contine |
|---|---|
| **Cont** | Codul contului (ex: 401, 5121, 4111.00023) |
| **Denumire** | Numele contului (ex: "Furnizori", "Conturi la banci") |
| **Tip** | A, P sau B |
| **Sold initial debit** | Soldul debitor la inceputul perioadei |
| **Sold initial credit** | Soldul creditor la inceputul perioadei |
| **Rulaj debit** | Cat s-a debitat in perioada selectata |
| **Rulaj credit** | Cat s-a creditat in perioada selectata |
| **Total debit** | Sold initial D + Rulaj D |
| **Total credit** | Sold initial C + Rulaj C |
| **Sold final debit** | Soldul debitor la sfarsitul perioadei |
| **Sold final credit** | Soldul creditor la sfarsitul perioadei |

In Costify, balanta are aceeasi structura, plus cateva coloane utile pentru navigatie:
- **Sold in D / C** — soldul la inceputul **lunii curente** (nu al anului)
- **Rulaj precedent D / C** — rulajele de la inceputul anului pana la luna precedenta
- **Rulaj total D / C** — toate rulajele de la inceputul anului pana la finalul lunii curente

Asta permite sa vezi atat **luna individuala** (rulaj curent) cat si **cumulul anului** (rulaj total).

## Exemplu

Iata o balanta simpla pentru o firma in luna decembrie 2025, dupa ce a inregistrat:

- Aport asociat: 50.000 RON in banca
- Vanzari: 12.000 RON cu TVA inclus
- Cheltuieli: 5.000 RON facturi furnizori cu TVA inclus

```
Cont    Denumire                          Sold in D    Sold in C    Rulaj D    Rulaj C    Total D    Total C    Sold final D    Sold final C
117     Profit reportat                          -            -          -          -          -          -            -                -
1012    Capital subscris varsat                  -            -          -      50.000          -      50.000           -          50.000
401     Furnizori                                -            -          -       5.000          -       5.000           -           5.000
4111    Clienti                                  -            -     12.000          -      12.000          -       12.000              -
4426    TVA deductibila                          -            -        798          -         798          -          798              -
4427    TVA colectata                            -            -          -      1.916          -       1.916           -           1.916
5121    Banca lei                                -            -     50.000          -      50.000          -       50.000              -
628     Cheltuieli servicii                      -            -      4.202          -       4.202          -        4.202              -
707     Venituri vanzari                         -            -          -     10.084          -      10.084           -          10.084
                                              ─────       ──────     ──────     ──────     ──────     ──────       ──────          ──────
                                                  -            -     67.000     67.000     67.000     67.000      67.000          67.000
```

**Verificarile cheie**:
1. **Total Rulaj D = Total Rulaj C** = 67.000 RON ✓
2. **Total Sold final D = Total Sold final C** = 67.000 RON ✓
3. Daca aceste totaluri NU se egaleaza, balanta e gresita.

## Cum se citeste o balanta

### Pasul 1: Verifica daca se egala

In partea de jos a balantei, sumele Rulaj D = Rulaj C, si Sold final D = Sold final C. **Daca nu se egaleaza, ceva e gresit in jurnal.** Cauzele frecvente:
- Note contabile incomplete (cont D fara cont C sau invers).
- Erori de introducere in software.
- Probleme la import.

In Costify, balanta foloseste algoritmul exact din [Calculul balantei](./calcul-balanta.md). Daca nu se egala, e o problema in jurnal, nu in calcul.

### Pasul 2: Identifica conturile cu sold

Conturile cu sold final 0 nu sunt interesante (nimic activ acolo). Concentreaza-te pe cele cu sold:

- **5121 / 5311**: cati bani ai in banca/casa
- **4111**: cat ai de incasat de la clienti
- **401**: cat datorezi furnizorilor
- **421**: cat datorezi salariatilor
- **4423 / 4424**: TVA de plata sau de recuperat
- **121**: profitul/pierderea anului

Acestea sunt **fundamentele situatiei firmei**. Cu ele in cap, ai 80% din ce iti trebuie.

### Pasul 3: Verifica conturile suspecte

Cateva semnale de alarma in balanta:

- **Cont activ cu sold creditor** (sau invers) — anomalie. De obicei eroare de inregistrare.
- **Conturi tranzitorii cu sold mare** — gen 581 (Viramente interne) sau 461 (Debitori diversi). Acestea ar trebui sa fie zero la sfarsitul lunii.
- **Conturi neutilizate cu sold** — cont care nu apare in operatiuni dar are sold inceputul. Posibil sold ramas din ani anteriori.
- **Diferente la TVA** — daca rulajul 4427 nu corespunde cu rulajul corespunzator pe 4111, ai erori la TVA.

### Pasul 4: Compara cu luna precedenta

Balanta este si mai utila in **comparatie**. Schimbari brute intre luni indica fie operatiuni mari (vanzari/achizitii importante), fie erori. Cateva exemple:

- **5121 a scazut brutal** — fie ai platit datorii mari, fie ai fost furat.
- **4111 a crescut brutal** — clientii nu mai platesc la timp.
- **401 a crescut brutal** — nu mai platesti furnizorii la timp.
- **121 are sold creditor mai mare** — profitul creste.

In Costify, comparatia intre luni se face manual deocamdata (deschizi doua tab-uri). In iteratii viitoare, vom adauga o functie de comparatie side-by-side.

## Tipuri de balanta

Exista mai multe tipuri de balanta, in functie de detaliul si periodicitatea afisarii:

### Balanta sintetica
Afiseaza doar conturile sintetice (ex: 401, fara analiticele 401.00001, 401.00002...). Mai compacta, dar pierzi detaliul.

### Balanta analitica
Afiseaza si analiticele (401.00001, 401.00002, ...). Mai detaliata, dar mai lunga (zeci de mii de randuri pentru firme mari).

### Balanta lunara / anuala
- **Lunara**: rulajele acopera doar luna selectata.
- **Anuala**: rulajele acopera tot anul, cumulativ pana in luna selectata.

In Costify:
- **Toggle "Analitice / Toate"** — comuta intre vedere doar copii (analitica) sau cu parinti (sintetica + analitica).
- **Selector de perioada** — alegi anul si luna. Algoritmul face cumul automat de la 1 ianuarie pana la finalul lunii alese.

## Verificari pe care le face Costify automat

Atunci cand calculezi balanta in Costify, mai multe verificari ruleaza in spate:

1. **Egalitatea D = C** — verifica ca totalurile sunt egale. Daca nu, afiseaza warning.
2. **Detectia conturilor nemapate** — conturile fara cod exact in catalog OMFP 1802 sunt marcate cu triunghi galben.
3. **Detectia parintilor si copiilor** — algoritmul identifica automat conturile sintetice care au analitice.
4. **Solduri zero filtrare** — conturile cu sold zero peste tot pot fi ascunse cu un toggle in viitor (deocamdata sunt afisate).
5. **Calcul leaf-only** — pentru CPP si KPI, doar conturile frunza sunt folosite, ca sa nu se dubleze sumele.

Vezi [Calculul balantei](./calcul-balanta.md) pentru detaliile algoritmice.

## Cand nu se egaleaza balanta

Daca total D ≠ total C, problema este in jurnal. Cauzele frecvente:

1. **Nota contabila orfana** — un rand cu cont D fara cont C, sau invers. In jurnalul Saga, asta nu ar trebui sa se intample (Saga forteaza pereche), dar la importurile manuale poate aparea.

2. **Probleme la import** — daca XLSX-ul este corupt, unele randuri pot fi parsate gresit.

3. **Suma rotunjita gresit** — diferentele de bani (1 ban diferenta) apar din rotunjiri. In Costify, folosim Decimal pe 18 cifre, asa ca acest tip de eroare nu apare.

4. **Cont % (compus)** — in Saga, exista note compuse cu cont D `%` care indica "mai multe conturi". Daca astfel de note nu sunt dezvoltate corect, balanta ar parea sa nu se egala. Costify recunoaste pattern-ul si il prelucreaza corect.

## Importanta legala

Balanta de verificare este un document **obligatoriu** in Romania. Trebuie:
- **Tiparita lunar** (sau cel putin la sfarsitul fiecarui trimestru pentru firme mici)
- **Pastrata 10 ani**
- **Disponibila pentru inspectii**

In plus, balanta este **baza** pentru:
- **Bilantul anual** — bilantul se construieste din balanta de la 31 decembrie.
- **Cont profit si pierdere** — CPP-ul anual se calculeaza din rulajele anului, citite din balanta.
- **Declaratiile fiscale** (D101, D300, D394) — bazate pe rulajele si soldurile din balanta.

In Costify, balanta este recalculata live din jurnal de fiecare data, deci este mereu actuala. Pentru tiparire, in plan este export PDF format oficial.

## Urmatori pasi

- [Citeste balanta de verificare](./citeste-balanta.md) — ghid practic pentru Costify
- [Calculul balantei](./calcul-balanta.md) — algoritmul tehnic
- [Cont profit si pierdere](./cont-profit-si-pierdere.md) — derivatul direct al balantei
- [Bilantul contabil](./bilantul.md) — alt derivat important
