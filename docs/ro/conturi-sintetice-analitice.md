# Conturi sintetice vs analitice

Cand contabilul iti vorbeste despre "contul 401", el se refera la **un cont sintetic** — o categorie larga, definita oficial de OMFP 1802. Dar in practica, fiecare firma are zeci sau sute de furnizori diferiti. Cum ii gestionezi separat fara sa pierzi din vedere ca toti sunt "furnizori"?

Raspunsul: **conturi analitice**. Acest articol explica diferenta si cum sunt folosite in Costify.

## Definitii

**Cont sintetic** (sau "cont de baza") = un cod oficial OMFP 1802 cu **3-4 cifre**, fara puncte. Exemple:
- `401` — Furnizori (in general, toti)
- `5121` — Conturi la banci in lei (in general, toate bancile)
- `4111` — Clienti (in general, toti)

**Cont analitic** (sau "sub-cont") = un cod care **extinde** un cont sintetic cu detalii specifice firmei, separat printr-un punct. Exemple:
- `401.00023` — Furnizorul nr. 23 (de exemplu, Orange Romania)
- `5121.BT` — Cont curent in lei la Banca Transilvania
- `4111.BETA` — Clientul Beta SRL

## De ce avem nevoie de analitice

Imagineaza-ti ca firma ta are 50 de furnizori. Daca ai folosi doar contul sintetic `401`, balanta ta ar arata asa:

```
401  Furnizori    Sold final C: 47.500 RON
```

Dar **47.500 RON pentru CINE**? Nu poti sti din balanta. Ar trebui sa cauti in jurnal pentru fiecare furnizor in parte.

Cu analitice, balanta arata asa:

```
401          Furnizori (parinte)              Sold final C: 47.500 RON
401.00001    Orange Romania                   Sold final C:  1.500 RON
401.00002    EnergoBit                        Sold final C:  3.200 RON
401.00003    Vodafone                         Sold final C:    800 RON
401.00004    Romstal                          Sold final C: 12.000 RON
...
```

Acum stii **exact cui datorezi cat**. Aceasta detaliere este pretioasa pentru:
1. **Plati** — stii exact cat sa platesti fiecaruia.
2. **Reconcilieri** — daca furnizorul te suna si zice "imi datorezi 1.500 RON", verifici instant in 401.00001.
3. **Analiza** — vezi care furnizori reprezinta procentul cel mai mare din datorii.
4. **Audit** — inspectorii pot urmari de la balanta la nivel de furnizor individual.

## Cum se creeaza analiticele

Analiticele NU sunt definite la nivel central (OMFP). Fiecare firma le **isi creeaza singura**, in software-ul de contabilitate (Saga C, Ciel, etc.). Conventiile difera de la firma la firma, dar cele mai frecvente sunt:

1. **Numerotare secventiala**: `401.00001`, `401.00002`, `401.00003`, etc. Cea mai folosita in Saga C, generata automat la creare de furnizor nou.

2. **Cod abreviat**: `5121.BT` (Banca Transilvania), `5121.ING`, `5121.CEC`. Folosita pentru conturi de banca, unde nu sunt multe.

3. **Cod CUI sau CIF**: `401.RO12345678`. Permite identificare unica a furnizorului dupa codul fiscal.

4. **Cod intern**: `4111.SC001`, `4111.SC002`. Pentru sistemele care au coduri interne pentru clienti.

In practica, **conventia in Saga C este numerotare secventiala** (`401.00023`), iar denumirea reala (Orange Romania) este stocata separat in coloana `denumire`.

## Conturile parinte (sintetice agregate)

Cand ai analitice, contul sintetic devine un **cont parinte** care **agrega** toti copii lui. In balanta:

```
401          Furnizori (parinte)              Sold final C: 47.500 RON   ← suma tuturor copiilor
401.00001    Orange Romania                   Sold final C:  1.500 RON
401.00002    EnergoBit                        Sold final C:  3.200 RON
...
401.00050    Ultimul furnizor                 Sold final C:    100 RON
```

Suma tuturor sub-conturilor `401.xxxxx` trebuie sa egaleze soldul contului `401`. Daca nu se egala, ai o eroare in jurnal.

In Costify, algoritmul de balanta detecteaza automat parintii si copiii. Vezi [Calculul balantei](./calcul-balanta.md) pentru detalii tehnice. UI-ul afiseaza un toggle "Analitice / Toate" care permite filtrarea:

- **Toate** — afiseaza si parintii (`401`) si copiii (`401.00001`, `401.00002`...)
- **Analitice** — afiseaza doar copiii (`401.00001`, `401.00002`...) — fara parinte

## Conturi cu si fara analitice

Nu toate conturile au analitice. Conventia generala:

| Cont | Are analitice? | De ce |
|---|---|---|
| **101** Capital social | Nu | Un singur capital, nu trebuie detaliat |
| **121** Profit/pierdere | Nu | Un singur rezultat |
| **211** Terenuri | Da, pe locatie | `211.SEDIU`, `211.HALA` |
| **2131** Echipamente | Da, pe utilaj | `2131.UTILAJ_001`, etc. |
| **301** Materii prime | Da, pe articol | `301.A`, `301.B`, etc. |
| **371** Marfuri | Da, pe categorie sau articol | `371.LAPTOPURI`, `371.MOBILIER` |
| **401** Furnizori | Da, pe furnizor | `401.00001`, `401.00002`, etc. |
| **4111** Clienti | Da, pe client | `4111.00001`, etc. |
| **421** Salarii | Da, pe angajat | `421.ION`, `421.MARIA` |
| **5121** Banca lei | Da, pe banca | `5121.BT`, `5121.ING` |
| **5311** Casa lei | Nu (de obicei) | O singura casa |
| **6xx** Cheltuieli | Optional, pe centru de cost | `601.PROD`, `601.MARKETING` |
| **7xx** Venituri | Optional, pe linie de business | `707.LAPTOPURI`, `707.MOBILIER` |

In practica, **conturile clasei 4 (terti)** sunt cele care au cel mai des analitice. Conturile clasei 5 (banci) au de asemenea analitice — cate unul per banca. Conturile clasei 6 si 7 pot avea analitice optionale pentru raportare interna pe centre de cost sau linii de business, dar nu este obligatoriu.

## Cum stocheaza Costify analiticele

In baza de date Costify, exista doua tabele relevante:

1. **AccountCatalog** — conturile **sintetice** OMFP (~321 de coduri). Read-only, comune tuturor clientilor.

2. **ClientAccount** — conturile **analitice** specifice unui client. Populat automat din importul Saga C (denumirile vin din coloanele `denumire_d` si `denumire_c` din XLSX), dar editabil manual de contabil.

Cand Costify afiseaza un rand de balanta, algoritmul de **rezolvare a numelui** este:

```
Pentru contul "401.00023":
  1. Verifica ClientAccount pentru ("client X", "401.00023")
     → daca exista, foloseste numele (ex: "Orange Romania SA")
  2. Daca nu, verifica AccountCatalog pentru "401.00023"
     → de obicei nu exista (analiticele nu sunt in catalog)
  3. Cauta in AccountCatalog dupa codul de baza "401" (fara punct)
     → exista, foloseste numele "Furnizori"
  4. Daca nici asta nu exista, fallback: "Cont 401.00023" cu warning
```

Pentru detalii arhitecturale, vezi [Maparea conturilor](./maparea-conturilor.md).

## Avantaje practice

### Pentru contabil
- **Reconciliere rapida**: cand un client te suna, deschizi contul lui analitic si vezi instant ce datoreaza.
- **Plati optimizate**: stii exact cui sa platesti primul (cele mai mari datorii, cele cu termen apropiat).
- **Detectie erori**: daca un sub-cont are sold gresit, vezi imediat ca nu se egala cu parintele.

### Pentru antreprenor
- **Vizibilitate**: stii pe cine te bazezi pentru venituri si cui esti dependent.
- **Riscul de concentrare**: daca un singur client (4111.X) reprezinta 60% din creante, ai risc de concentrare.
- **Negociere**: poti avea conversatii informate cu furnizori ("am datorii de 12.000 RON cu voi, putem sa intarziem 30 zile?").

## Limita: cand sunt prea multe analitice

In firme foarte mari, poti ajunge la **mii de analitice** doar pe 401. In acest caz:
- Balanta devine ilizibila (mii de randuri).
- Performanta scade.
- Modificarile manuale devin nepracticabile.

Solutia: foloseste **toggle-ul "Analitice / Toate"** in Costify pentru a comuta intre vedere agregata (parinti) si vedere detaliata (copii). Pentru analize specifice, foloseste cautarea (ex: "Orange") in loc sa scrolezi prin lista intreaga.

## De ce e dificila standardizarea

Daca toate firmele folosesc OMFP 1802 ca plan sintetic, de ce nu standardizeaza si analiticele? Cateva motive:

1. **Furnizorii sunt diferiti pentru fiecare firma** — nu poti avea un cod OMFP standard pentru "Orange Romania", pentru ca nu fiecare firma lucreaza cu Orange.

2. **Conventiile difera** — unele firme folosesc CUI ca analitic, altele numere secventiale, altele coduri interne. Standardizarea ar forta toata lumea sa schimbe.

3. **Software-ul contabil are limitari** — Saga C foloseste anumite formate, Ciel altele. Forta unica conventie ar rupe compatibilitatea.

In Costify, am ales sa **acceptam orice format de analitic** pe care il primim din XLSX. Algoritmul de detectie este: "tot ce e dupa primul punct este analitic". Asta functioneaza pentru toate conventiile vazute pana acum.

## Urmatori pasi

- [Planul de conturi OMFP 1802](./plan-de-conturi.md) — vedere de ansamblu
- [Clasele de conturi (1-9)](./clase-de-conturi.md) — detalii pe clase
- [Maparea conturilor](./maparea-conturilor.md) — arhitectura tehnica in Costify
- [Citeste balanta de verificare](./citeste-balanta.md) — cum apar parinti si copii in UI
