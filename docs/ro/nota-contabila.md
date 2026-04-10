# Nota contabila

Daca [documentul justificativ](./document-justificativ.md) este "ce s-a intamplat in lumea reala" (factura, chitanta, extras bancar), atunci **nota contabila** este cum traducem acel eveniment in limbajul contabilitatii.

Fiecare operatiune economica devine o nota contabila. Si fiecare nota contabila are exact aceeasi structura: doua parti, debit si credit, care se compenseaza.

## Anatomia unei note contabile

O nota contabila contine **cel putin** urmatoarele informatii:

| Camp | Exemplu | Explicatie |
|---|---|---|
| Data | 15.12.2025 | Cand a avut loc operatiunea |
| Numar document (NDP) | F-2025-1247 | Identificatorul documentului justificativ |
| Cont debit | 5121 | Contul care se debiteaza |
| Cont credit | 7041 | Contul care se crediteaza |
| Suma | 1.190 RON | Valoarea operatiunii |
| Explicatie | "Vanzare laptop client X" | Descriere libera |
| TVA (optional) | 19% | Cota TVA aplicata |

In Saga C, dar si in Costify, fiecare rand din jurnal este o nota contabila.

## Exemplu concret

Imagineaza-ti ca firma ta vinde un laptop catre o firma client, pe factura cu plata pe loc, in numerar. Pretul: 1.190 RON cu TVA inclus (1.000 RON valoare + 190 RON TVA).

Aceasta operatiune **una singura** se traduce in **trei note contabile**:

### Nota 1: Inregistrarea vanzarii
```
Data: 15.12.2025
Cont D: 4111  (Clienti)
Cont C: 7041  (Venituri din vanzarea marfurilor)
Suma: 1.000 RON
Explicatie: "Vanzare laptop firma Beta SRL"
```

Asta spune: am o creanta de 1.000 RON pe contul Clienti (4111), in contrapartida cu un venit de 1.000 RON la 7041.

### Nota 2: Inregistrarea TVA-ului
```
Data: 15.12.2025
Cont D: 4111  (Clienti)
Cont C: 4427  (TVA colectata)
Suma: 190 RON
Explicatie: "TVA vanzare laptop firma Beta SRL"
```

Acum mai am inca 190 RON creanta pe Clienti, in contrapartida cu TVA colectata pe care o datorez statului.

**Total creanta pe 4111**: 1.190 RON. **Total venit pe 7041**: 1.000 RON. **Total TVA pe 4427**: 190 RON.

### Nota 3: Incasarea in numerar
```
Data: 15.12.2025
Cont D: 5311  (Casa in lei)
Cont C: 4111  (Clienti)
Suma: 1.190 RON
Explicatie: "Incasare numerar firma Beta SRL"
```

Clientul plateste, deci creanta dispare (4111 se crediteaza cu 1.190) si banii ajung in casa (5311 se debiteaza cu 1.190).

**Dupa cele trei note**:
- Cont 4111 (Clienti): debit 1.190, credit 1.190 → sold zero, asa cum trebuie (creanta s-a stins).
- Cont 7041 (Venituri): credit 1.000 → ai un venit de 1.000.
- Cont 4427 (TVA colectata): credit 190 → datorezi 190 statului.
- Cont 5311 (Casa): debit 1.190 → ai 1.190 in casa.

Toata operatiunea — vanzare + TVA + incasare — este descrisa cu trei note simple. Fiecare cu doua parti (D si C). Fiecare echilibrata.

## Reguli de baza

1. **Fiecare nota are exact un cont D si un cont C**. Daca operatiunea e mai complexa, faci mai multe note.
2. **Suma trebuie sa fie pozitiva**. Nu exista debituri negative — inversezi conturile in schimb.
3. **Suma D = Suma C** mereu, in fiecare nota. Asta se cheama dubla inregistrare.
4. **Data trebuie sa fie cea reala** a operatiunii, nu data introducerii in software.
5. **Explicatia trebuie sa fie clara** — peste 6 luni, cand revii la nota, trebuie sa stii instant despre ce era vorba.

## Note contabile compuse

In practica, o factura poate avea mai multe linii (3 produse diferite, fiecare cu cota proprie de TVA). Toate aceste detalii se reflecta in **mai multe note pentru aceeasi data si acelasi document**, sau intr-o **nota compusa** care are un cont D si mai multe conturi C (sau invers).

In Saga C, exemplul standard este o nota cu cont D `%` (asta inseamna "mai multe conturi") si cont C `5121`, urmata de detaliile pe sub-conturi. Costify recunoaste acest pattern si parseaza corect notele compuse.

## Note de inchidere

La sfarsitul fiecarei luni si al fiecarui an, contabilul face note **de inchidere** care nu provin din documente justificative, ci din reguli contabile:

- **Inchiderea TVA**: 4426 (TVA deductibila) se solda cu 4427 (TVA colectata). Diferenta merge la 4423 (TVA de plata) sau 4424 (TVA de recuperat).
- **Inchidere venituri/cheltuieli (anual)**: conturile 6xx si 7xx se inchid in 121 (Profit si pierdere). Acesta este pas standard de inchidere de exercitiu.

Aceste note nu necesita document justificativ — sunt cerute de OMFP 1802.

## Note de stornare (corectie)

Daca ai facut o nota gresita, NU o stergi. In schimb, faci o **nota de stornare** care anuleaza prima. Doua variante:

1. **Stornare in negru** — refaci aceeasi nota cu sumele inverse (D ↔ C).
2. **Stornare in rosu** — pastrezi conturile dar pui suma cu minus.

Ambele functioneaza, dar **stornarea in rosu** este preferata pentru ca pastreaza istoricul: poti vedea si ce ai gresit, si cum ai corectat. Saga C foloseste stornare in rosu in mod implicit.

In Costify, daca trebuie sa corectezi ceva istoric, abordarea recomandata este [stergerea + reimport](./corecteaza-date-istorice.md), nu nota de stornare. Nota de stornare e specifica software-ului contabil de unde vin datele (Saga, Ciel, etc.) — Costify primeste deja jurnalul cu stornarea inclusa.

## De ce sunt importante notele contabile pentru tine

Daca esti antreprenor, probabil nu vei scrie tu insuti note contabile (de obicei le face contabilul). Dar e important sa intelegi structura, pentru ca:

1. **Cand ceva pare gresit in raport**, poti urmari nota din spate: "venitul ala de 5.000 RON din decembrie de unde vine?" → contabilul iti arata nota contabila → vezi documentul justificativ → intelegi.

2. **Cand contabilul iti pune intrebari** ("am 1.500 RON pe 401 fara document, ce e?"), stii ce te intreaba si poti raspunde.

3. **Cand citesti un raport ANAF** sau un audit extern, te poti orienta. Toate rapoartele financiare sunt construite pe note contabile.

## Urmatori pasi

- [Debit si credit](./debit-credit.md) — regulile fundamentale ale celor doua parti
- [Planul de conturi OMFP 1802](./plan-de-conturi.md) — ce inseamna 5121, 7041, 4427
- [Registrul jurnal](./registrul-jurnal.md) — cum se aduna toate notele intr-un singur document
- [Documentul justificativ](./document-justificativ.md) — sursa fiecarei note
