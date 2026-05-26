# Limbajul maparii — orizontal, vertical, linie de business

> Aceasta pagina te invata cele 4 cuvinte de baza din modulul Mapari Cashflow.
> Citeste-o o data si nu te mai pierzi in dicussion. Foloseste ASCII-uri si
> exemple concrete pe contul real **6022 Combustibil** al unei firme.

---

## De ce e nevoie de o pagina pentru limbaj

Cand vorbim despre mapare avem PATRU concepte distincte care s-au amestecat in
trecut, pentru ca se folosea acelasi cuvant ("verticala") pentru doua lucruri
diferite. Hai sa le separam o data:

| Cuvant | Ce este | Categorie |
|---|---|---|
| **cont** | un cont contabil (`6022`, `704`, `401.x`) | obiect din contabilitate |
| **partener** | un furnizor (pe cheltuieli) sau client (pe venituri) — apare pe un cont concret | obiect din contabilitate |
| **categorie** | un grup de business pentru patron — `"Combustibil"`, `"Salarii"`, `"Marketing"` | eticheta pe care o vede antreprenorul |
| **linie de business** | o unitate operationala strategica a firmei — `"Outsourcing"`, `"Recruitment"`, `"Coworking"` | impartirea firmei pe activitati |

Apoi mai sunt doua **directii de lucru** pe acelasi cont — nu obiecte, ci
**actiuni**:

| Directie | Ce raspunde |
|---|---|
| **maparea ORIZONTALA** | "Cat din totalul contului merge in fiecare linie de business?" |
| **maparea VERTICALA** | "Ce categorie are fiecare partener care apare pe contul ăsta?" |

> **Regula simpla**: `linie de business` e un **lucru** (Outsourcing). `vertical/orizontal`
> sunt **adjective** care descriu cum lucrezi cu un cont. Nu confunda "linia de
> business" cu "maparea verticala".

---

## De unde vine numele "orizontal" si "vertical"

Imagineaza-ti contul `6022 Combustibil` deschis intr-un Excel:

```
                          ┌────────────── ORIZONTALA ──────────────►
                          │      coloane = linii de business
                          │
                          │     Outsourcing  Recruitment  Coworking
   ┌──────────────────────┼─────────────────────────────────────────┐
   │ % alocare cont       │       10%         20%          70%      │
   ├──────────────────────┼─────────────────────────────────────────┤
   │ Partener     Suma    │                                         │
   ├──────────────────────┤                                         │
   │ OMV         12.300   │                                         │
   │ Petrom       8.100   │                                         │
   │ Rompetrol    4.500   │      ▼  VERTICALA                       │
   │ SC Logistic    900   │      randuri = parteneri                │
   │ Mol          7.200   │                                         │
   │ ...                  │                                         │
   └──────────────────────┴─────────────────────────────────────────┘
```

- Te uiti **la coloane** = orizontal. Iei totalul contului si il imparti pe
  liniile de business (procente).
- Te uiti **la randuri** = vertical. Treci prin partenerii contului si pui o
  categorie pentru fiecare.

Sunt doua **directii diferite** de a "imparti" acelasi cont. Nu sunt
incompatibile — pot exista simultan.

---

## Cele 4 obiecte explicate vizual

### `cont`

Un cont contabil este o "etichetă" pe care o foloseste contabilitatea. Are
codul OMFP (3 cifre minimum) si o denumire. Toate tranzactiile firmei trec
prin conturi:

```
    cont 6022                         cont 704
    ─────────────                     ─────────────
    Combustibil                       Venituri din servicii
    cheltuiala (debitor)              venit (creditor)
```

Pe `6022` apar facturile de la benzinarii. Pe `704` apar facturile pe care
firma le-a emis catre clienti.

### `partener`

Un partener este **cine** apare pe o linie de jurnal:
- pe `6022` (cheltuiala) → **furnizorul** (OMV, Petrom, ...)
- pe `704` (venit) → **clientul** (NOLICH, Anduvel, ...)

Acelasi partener poate sa apara pe mai multe conturi. Numele lui se ia din
explicatia liniei de jurnal — nu avem CUI, deci recunoasterea e pe denumire
(vezi `cashflow-pentru-contabil` pentru normalizare).

### `categorie`

O categorie este o **eticheta patron-friendly** pe care o vede antreprenorul
pe pagina lui `/firma`. Exemple:

| Cod cont | Categorie pentru patron |
|---|---|
| `6022` | `Combustibil` |
| `641, 645` | `Salarii si contributii` |
| `605` | `Energie, apa, intretinere` |
| `7011` | `Vanzari` |

Categoriile sunt **comune intre toate firmele** (vin pre-completate din OMFP)
si pot fi rafinate per firma. **NU spun cine a primit banii sau de la cine
au venit** — spun doar "ce natură are cheltuiala / venitul".

### `linie de business`

O linie de business este o **unitate operationala strategica** a firmei —
ceva ce ar putea trai independent daca firma ar fi sparta.

Exemple reale:
- **QHM21 NETWORK SRL** → 3 linii: `Outsourcing`, `Recruitment`, `Coworking`
- **Un restaurant** → 3 linii: `Sala`, `Catering`, `Delivery`
- **O firma de constructii** → linii pe proiecte: `Bucuresti Centru`, `Cluj A1`
- **Un SaaS cu 2 produse** → linii: `Produs A`, `Produs B`, `Consultanta`

Liniile sunt **specifice fiecarei firme** — se activeaza si se denumesc
manual. **Majoritatea firmelor NU au linii** (au o singura activitate).

> Inainte foloseam cuvantul "verticala" pentru "linie de business". L-am
> abandonat pentru ca se ciocnea cu "maparea verticala" (alt sens). De aici
> incolo: linia e **`linie de business`**, niciodata "verticala".

---

## Cum recunoastem un partener (fara CUI)

Datele de contabilitate nu au CUI-ul partenerului — vine doar **denumirea**
asa cum apare in jurnalul de tranzactii. Asta inseamna ca un partener poate
fi scris in mai multe feluri pe luni diferite:

```
   In jurnal apare ca:                Sistemul vede:
   ──────────────────────             ───────────────
   "FAN COURIER SRL"            ─►    fan courier
   "Fan Courier"                ─►    fan courier         ✓ acelasi
   "FANCOURIER"                 ─►    fancourier          ✗ alt partener!
   "Fan Courier S.R.L."         ─►    fan courier         ✓ acelasi
   "FAN COURIER  EXPRESS SRL"   ─►    fan courier express ✗ alt partener
```

**Normalizarea** se face inainte de matching:

- Toate caracterele in minuscule.
- Eliminam punctuatia (`.`, `,`, `-`).
- Eliminam forma juridica (`SRL`, `SA`, `PFA`, `SCS`, `II`, etc.).
- Eliminam spatiile duble.

Rezultatul = "numele normalizat" pe care il folosim pentru memorie si
sugestii (vezi sectiunea Stari de mapare mai jos).

**Consecinta importanta de design**: pentru ca matching-ul ramane
probabilistic (nu avem CUI), tot ce vine din memorie sau din matching pe
nume apare ca **sugestie de confirmat**, niciodata aplicata automat.
Te protejam de cazul "nume similar, dar alt partener".

---

## Cele 2 mapări explicate vizual

### Mapare ORIZONTALA — `cont → procente pe linii de business`

Iei totalul unui cont si il spargi pe coloane. Suma procentelor = 100%.

```
   Cont 6022 — Combustibil
   Total: 32.500 lei
   
   ┌──── 100% ────┬─── 100% ────┬─── 100% ────┐
   │              │             │             │
   │  10%         │  20%        │  70%        │
   │  Outsourcing │  Recruitment│  Coworking  │
   │              │             │             │
   │  3.250 lei   │  6.500 lei  │  22.750 lei │
   └──────────────┴─────────────┴─────────────┘
   
   Verificare:  3.250 + 6.500 + 22.750 = 32.500 ✓
```

**Raspunde la intrebari de tipul**:
- "Cat a cheltuit Outsourcing-ul pe combustibil luna asta?" → 3.250 lei
- "Care linie consuma cei mai multi bani pe utilitati?" → cea cu procentul cel mai mare

**E nevoie cand**:
- Firma are **mai multe linii de business**, si
- Un cont se foloseste **pentru toate liniile** (chirie sediu comun, electricitate
  comuna, contabilitate comuna).

**NU e nevoie cand**:
- Firma are o singura linie, sau
- Conturile sunt deja separate pe linii (`6022.OUTSOURCING` vs
  `6022.COWORKING` ca conturi analitice).

**Tipuri de chei de alocare** — cum stabilesti procentele:

| Cheie | Cum functioneaza | Recalcul | In Costify |
|---|---|---|---|
| **Procent manual fix** | Tu pui 10/20/70 si raman asa. Cel mai simplu. | Static | ✓ Disponibil |
| **Proportional cu CA proiect** | Cheltuiala "urmeaza" venitul fiecarei linii. | Lunar, automat | ⏳ Pe roadmap |
| **Proportional cu costuri directe** | Dupa ponderea costurilor directe. | Lunar, automat | ⏳ Pe roadmap |
| **Proportional cu m²** | Pentru chirie/utilitati impartite. | Static / la schimbare | ⏳ Pe roadmap |
| **Proportional cu nr. documente** | Dupa volumul de operatiuni pe linie. | Lunar, automat | ⏳ Pe roadmap |

> Initial Costify suporta doar **procente manual fixe**. Acopera 95% din
> cazurile reale. Daca ai un caz unde o cheie dinamica iti economiseste timp
> regulat, spune-ne — prioritizam.

### Mapare VERTICALA — `(cont, partener) → categorie`

Iei lista de parteneri de pe un cont si pui o categorie pentru fiecare.

```
   Cont 6022 — Combustibil
   
   Partener          Suma     Categorie
   ─────────────     ──────   ─────────────────
   OMV               12.300   Combustibil       (default cont)
   Petrom             8.100   Combustibil       (default cont)
   Rompetrol          4.500   Combustibil       (default cont)
   SC Logistic SRL      900   Servicii curierat (EXCEPTIE!)
   Mol                7.200   Combustibil       (default cont)
   ...               ...      ...
   
   Verificare suma partener: 32.500 ✓
```

**Raspunde la intrebari de tipul**:
- "Pe contul 6022 sunt doar benzinari?" → nu, e si o curieratie de 900 lei
- "Ce categorie are tranzactia cu SC Logistic SRL?" → Servicii curierat

**E nevoie cand**:
- Un cont aduna parteneri de **categorii diferite** in mod nepotrivit (clasica
  greseala de inregistrare contabila — un cont "general" peste mai multe naturi
  de cheltuiala).
- Vrei sa **vezi un partener specific pe categoria potrivita** in rapoartele
  pentru antreprenor.

---

## Tehnica de lucru pe mapare verticala (modul Claudiei)

Maparea verticala pe un cont cu zeci sau sute de parteneri NU se face "rand
cu rand". Asta ar fi un cosmar. **Modul corect** combina trei principii: bulk
la regula, exceptii la mana, **materialitate** (efortul urmeaza banii).

### Principiul materialitatii

Pe orice cont, **2-3 parteneri fac de obicei 70-90% din valoare**. Restul e
"coada lunga" — parteneri mici, irelevanti individual.

```
   Cont 6022 — Combustibil — 32.500 lei
   ─────────────────────────────────────
   
   OMV               12.300    ████████████████████████  ▲
   Petrom             8.100    ████████████████          │
   Mol                7.200    ██████████████            │  82% din valoare
   Rompetrol          4.500    █████████                 │  in primii 4
   SC Logistic SRL      900    █▌                        ▼
   ─── coada lunga ───
   Lukoil               280    ▌
   OMV Bucuresti        180    ▌                            18% din valoare,
   Petrom Ploiesti      150    ▌                            44 parteneri
   ... (41 alti)        890    ▌
```

**Concluzia**: contabilul nu trebuie sa mapeze egal toti partenerii. Trebuie
sa **dedice atentie celor mari** si sa **lase coada lunga pe default**.

### Fluxul in 4 pasi (cum o face Claudia)

**Pas 1 — Deschide contul, sorteaza descrescator dupa suma**

Sistemul afiseaza partenerii cu cel mai mare rulaj primii. Asta e
non-negociabil — nu te uiti la nimic alfabetic. Sortarea dupa bani te focalizeaza.

```
   Partener          Suma     Categorie
   OMV               12.300   — nemapat —
   Petrom             8.100   — nemapat —
   Mol                7.200   — nemapat —
   Rompetrol          4.500   — nemapat —
   SC Logistic SRL      900   — nemapat —
   ... (mai jos)
```

**Pas 2 — Bulk apply pe tot contul la categoria de baza**

Decide care e categoria "de regula" pe contul asta. Pe `6022 Combustibil`
raspunsul evident e `Combustibil`. Apesi un singur buton:

```
   [Atribuie toti partenerii la categoria:  Combustibil  ▾  ][Aplica]
   
   Preview inainte de confirmare:
   ─ Se vor mapa 48 parteneri
   ─ Valoarea afectata: 32.500 lei
   ─ Excepții manuale existente: 0 (nimic suprascris)
```

Asta a rezolvat **95% din munca pe contul asta** intr-un click.

**Pas 3 — Cauta excepții, ataca-le de sus in jos**

Te uiti la lista, oprita la primii 5-10 parteneri (cei care fac majoritatea
valorii). Pentru fiecare te intrebi: **"e ce zice categoria de baza?"**.

Daca **OMV, Petrom, Mol, Rompetrol** sunt toate benzinarii → categoria
"Combustibil" e corecta, treci mai departe.

Daca **SC Logistic SRL** suna a curieratie → suprascri doar pe acel rand:

```
   Partener          Suma     Categorie
   OMV               12.300   Combustibil          ✓ (din bulk)
   Petrom             8.100   Combustibil          ✓ (din bulk)
   Mol                7.200   Combustibil          ✓ (din bulk)
   Rompetrol          4.500   Combustibil          ✓ (din bulk)
   SC Logistic SRL      900   Servicii curierat    ◀── EXCEPTIE manuala
   ... (mai jos)
```

**Pas 4 — Te oprești cand valoarea ramasa e nesemnificativa**

Cand ajungi la parteneri sub 500 lei (sau orice prag iti pare ok pentru
firma asta), **te oprești**. Coada lunga ramane pe categoria default
("Combustibil") din bulk. **Asa trebuie**.

```
   ─── coada lunga (44 parteneri, sub 500 lei fiecare) ───
   Toti raman pe "Combustibil" — corect statistic, nu merita timp individual.
```

### De ce functioneaza

| Daca ai face | Ar dura | Ai gresi mai mult? |
|---|---|---|
| Bulk + 5 exceptii (modul Claudiei) | **3-5 minute** pe cont | **Nu** — 95% acoperit corect |
| Partener cu partener, manual | 45-60 minute pe cont | Da, oboseala creste rata de greseli |
| Doar bulk, fara exceptii | 30 secunde | Da — SC Logistic SRL ramane gresit pe Combustibil |

**Bulk + exceptii materiale** e singurul echilibru rezonabil. Dureaza
proportional cu cat de "murdara" e contabilitatea, nu cu cati parteneri sunt.

### Filtre pentru bulk mai inteligent

Cand contul e mare (peste 20 parteneri), poti aplica bulk **pe subseturi**
in loc de tot contul. Filtre tipice:

| Filtru | Cand e util |
|---|---|
| "Parteneri ce contin 'coworking' in denumire" | Pe un 704 mixt, ataci toti clientii care au "coworking" in nume → categoria Coworking |
| "Peste 1.000 lei" | Ignori coada lunga si vezi doar partenerii mari pentru decizie atenta |
| "Doar nemapati" | A doua oara cand intri pe acelasi cont (luna urmatoare) — vezi doar partenerii noi |
| "Top 10 dupa valoare" | Pe un cont cu 200 parteneri — focalizezi atentia pe ce conteaza |

In loc de "deciziile sa fie 200", devin **3-5 decizii pe subseturi**, plus
3-5 exceptii individuale.

### Memorie: luna urmatoare e gratuita

Odata ce ai mapat un partener, sistemul tine minte. Luna urmatoare:

- **OMV** vine pre-completat pe Combustibil (vine din April).
- **SC Logistic SRL** vine pre-completat pe Servicii curierat (vine din April).
- **Doar partenerii noi** (un Lukoil care n-a aparut niciodata) sunt
  nemapati — vezi *Filtru: "Doar nemapati"*.

Maparea verticala e munca grea **o singura data**. Apoi e doar mentenanta
pe partenerii noi.

### Stari de mapare

Fiecare mapare (orizontala sau verticala) are una din 3 stari. Asta iti
permite sa vezi pe ce poti avea incredere si pe ce nu.

| Stare | Inseamna | Cand apare |
|---|---|---|
| 🟡 **Auto-sugerata** | Vine din memorie sau matching pe nume — neconfirmata. | Pre-fill la luna noua, sau primul matching pe partener cunoscut. |
| ✅ **Confirmata** | Validata manual de contabil ("pastreaza" / "schimba"). | Dupa orice editare explicita. |
| 🔒 **Blocata** | Pe o perioada inchisa (raportata) — nu se mai modifica. | La inchiderea lunii (vezi mai jos). |

Workflow-ul tipic al contabilului:

```
   Luna noua (mai 2026)
   ─────────────────────
   
   ┌─ Mapari ─────────────────────────────────────────────────┐
   │  📊 Toate conturile                                       │
   │                                                          │
   │  ⚠️  Coada de revizuire (8 sugestii noi)                  │
   │     ────────────────────────────────────────             │
   │     Aprilie: OMV   → Combustibil    🟡  [pastreaza/schimb]│
   │     Aprilie: Mol   → Combustibil    🟡  [pastreaza/schimb]│
   │     Aprilie: LIDL  → Combustibil    🟡  [pastreaza/schimb]│
   │     ... (5 mai)                                          │
   │                                                          │
   │  ✅ 247 mapari confirmate (perioada deschisa)             │
   │  🔒 1.420 mapari blocate (perioade inchise 2024-2025)     │
   └──────────────────────────────────────────────────────────┘
```

Contabilul intra **doar in coada de revizuire** (cele 8 sugestii noi).
Trateaza in 5 minute si apoi se opreste — restul ramane stabil.

**Blocarea pe luna inchisa** previne modificarea cifrelor dintr-o perioada
deja raportata catre patron. Daca trebuie sa corectezi istoric, contabilul
"redeschide" explicit luna respectiva (cu audit log).

---

## Cele 2 mapări coexistă — regula reziduului

Pe acelasi cont poti avea SI mapare orizontala (procente pe linii) SI mapare
verticala (categorii pe parteneri). **Nu se exclud — sunt straturi**.

Cand le combini, **procentele orizontale se aplica pe REZIDUU** (ce ramane
dupa ce maparea verticala si-a luat partea), nu pe valoarea bruta a contului.

### Exemplu pas cu pas — pe contul `6022`

**Setup**:
- Total cont: `32.500 lei`
- **Orizontala** (default cont): `10% Outsourcing + 20% Recruitment + 70% Coworking`
- **Verticala**: 1 excepție — `SC Logistic SRL` (900 lei) → categoria `Servicii curierat`
- Restul partenerilor (47 parteneri) → categoria default a contului `Combustibil`

**Calcul**:

```
   PAS 1 — Aplica verticala intai
   ─────────────────────────────────
   SC Logistic SRL ───► 900 lei      pe categoria "Servicii curierat"
                        └────────► nu intra in restul calculului
   
   PAS 2 — Calculeaza reziduul
   ─────────────────────────────────
   Reziduu = 32.500 − 900 = 31.600 lei
            └─ aceasta este suma care va fi spartă pe linii
   
   PAS 3 — Aplica orizontala pe reziduu
   ─────────────────────────────────
   31.600 lei (Combustibil)
       ├─ 10% Outsourcing    ─► 3.160 lei pe "Combustibil"
       ├─ 20% Recruitment    ─► 6.320 lei pe "Combustibil"
       └─ 70% Coworking      ─► 22.120 lei pe "Combustibil"
   
   PAS 4 — Adauga back ce a luat verticala
   ─────────────────────────────────
   SC Logistic SRL  ─► 900 lei pe "Servicii curierat"
                       (poate sa primeasca propria orizontala, sau
                        merge pe "Toata firma" daca nu e definit)
```

**Verificare finala**:

```
   Combustibil:        3.160 + 6.320 + 22.120 = 31.600
   Servicii curierat:                              900
                                                ────────
   TOTAL:                                       32.500 ✓
```

> Daca **nu** respecti regula reziduului si aplici 10/20/70 pe `32.500` brut,
> cei 900 lei ai partenerului SC Logistic intra **de doua ori** — o data ca
> Servicii curierat (verticala), si inca o data ca parte din 32.500
> impărțit pe linii. Acelasi ban numarat de doua ori. **De asta exista regula
> reziduului.**

---

## Precedența — câștigă întotdeauna cel mai specific

Cele doua mapari sunt straturi de reguli. Sistemul intreabă, pentru fiecare
tranzactie individuala, **"ce categorie ti se aplica?"** in ordinea asta:

```
                          ╔═══════════════════════════╗
                          ║                           ║
       Nivel 2:           ║   EXCEPTIE PE TRANZACTIE  ║   "Aceasta factura specifica
       (cel mai           ║                           ║    e impartita anume" — rar.
        specific)         ║              ▲            ║         │
                          ║              │            ║         │ Daca exista → folosesc
       Nivel 1:           ║   REGULA PE PARTENER      ║         │ aceasta.
                          ║   (mapare verticala)      ║    "Partenerul X are categoria
                          ║              ▲            ║     Y pe contul Z"
                          ║              │            ║         │ Altfel daca exista → folosesc.
       Nivel 0:           ║   DEFAULT PE CONT         ║   "Restul partenerilor iau
       (cel mai           ║   (categorie + orizontala)║    categoria contului si
        general)          ║                           ║    se distribuie pe linii"
                          ║                           ║         │ Altfel — folosesc.
                          ╚═══════════════════════════╝         ▼
                                                          Categoria finala
                                                          + (linia, daca exista
                                                             orizontala)
```

**Câștigă întotdeauna ultimul/cel mai specific**. Daca nu exista nivel 2 sau 1,
se foloseste nivel 0 (default-ul contului). Daca nici nivel 0 nu e setat,
contul cade pe categoria OMFP standard (vezi `cashflow-pentru-contabil`).

---

## 3 exemple complete

### Exemplu A — cont simplu (doar default cont)

> Contul `6022 Combustibil`, 32.500 lei. Firma e tip A (un singur business,
> fara linii). Toti partenerii sunt benzinarii.

```
   Setari:
   ─ Categoria cont:     Combustibil   (default)
   ─ Linii de business:  NICIUNA       (firma nu a activat)
   ─ Excepții partener:  NICIUNA
   
   Rezultat:
   ─ 32.500 lei merg integral pe categoria "Combustibil"
   ─ Pe /firma apare:  Cheltuieli cu combustibilul: 32.500 lei
```

Nicio mapare orizontala sau verticala nu e necesara. Cazul cel mai simplu.

### Exemplu B — cont cu linii de business (doar orizontala)

> Contul `612 Chirii sediu`, 50.000 lei. Firma are 3 linii. Sediul e folosit
> de toate trei.

```
   Setari:
   ─ Categoria cont:     Chirii
   ─ Orizontala (linii): 30% Outsourcing + 30% Recruitment + 40% Coworking
   ─ Verticala (excepții partener): NICIUNA
   
   Calcul:
   ─ 30% × 50.000 = 15.000 lei pe Outsourcing (Chirii)
   ─ 30% × 50.000 = 15.000 lei pe Recruitment (Chirii)
   ─ 40% × 50.000 = 20.000 lei pe Coworking (Chirii)
   ─ TOTAL: 50.000 ✓
   
   Rezultat:
   ─ Pe /firma — sectia "Pe linii de business":
       Outsourcing → Chirii: 15.000
       Recruitment → Chirii: 15.000
       Coworking   → Chirii: 20.000
```

### Exemplu C — cont mixt (orizontala + verticala) — caz dificil

> Contul `6022 Combustibil`, 32.500 lei. Firma cu 3 linii, dar contul include
> si o factura de curieratie inregistrata gresit pe combustibil.

```
   Setari:
   ─ Categoria cont:     Combustibil   (default)
   ─ Orizontala (linii): 10% Outsourcing + 20% Recruitment + 70% Coworking
   ─ Verticala (excepție): SC Logistic SRL (900 lei) → "Servicii curierat"
   
   Pas 1: verticala
   ─ SC Logistic SRL → 900 lei pe "Servicii curierat"
   
   Pas 2: reziduu
   ─ 32.500 − 900 = 31.600 lei
   
   Pas 3: orizontala pe reziduu
   ─ 10% × 31.600 = 3.160 lei pe Outsourcing (Combustibil)
   ─ 20% × 31.600 = 6.320 lei pe Recruitment (Combustibil)
   ─ 70% × 31.600 = 22.120 lei pe Coworking   (Combustibil)
   
   Total verificat:  3.160 + 6.320 + 22.120 + 900 = 32.500 ✓
   
   Rezultat:
   ─ Pe /firma — sectia "Categorii":
       Combustibil:        31.600 lei
       Servicii curierat:     900 lei
   ─ Pe /firma — sectia "Pe linii de business":
       Outsourcing → Combustibil:  3.160 lei
       Recruitment → Combustibil:  6.320 lei
       Coworking   → Combustibil: 22.120 lei
       (cei 900 lei de la SC Logistic nu apar inca pe linii — vezi
        urmatoarea sectiune)
```

> **De gandit**: cei 900 lei de la SC Logistic — pe ce linie de business
> merg? Daca categoria "Servicii curierat" are ea insasi o orizontala
> definita (sa zicem 100% Outsourcing), 900 lei merg toti acolo. Daca nu,
> merg pe "Toata firma" (linia implicita catchall).

---

## Acoperirea contului — cat e mapat, cat lasi pe default

Pentru fiecare cont sistemul calculeaza **procentul de valoare mapat
explicit** versus ce ramane pe default-ul contului. E un semafor vizual
pentru "cat de mult mi-am dedicat atentia acestui cont".

```
   Cont 6022 — Combustibil — 32.500 lei

   Acoperire mapare verticala:
   ████████████████████████████████░░░░░░░░░░░░░░░░░    65% mapat explicit
                                       35% pe default cont

   Detaliu:
   ─ 21.125 lei in 4 parteneri mapati: OMV, Petrom, Mol, Rompetrol
   ─    900 lei in 1 exceptie:         SC Logistic SRL → Curieratie
   ─ 10.475 lei in 43 parteneri pe default: "Combustibil"
```

**Cum citesti**:

- **0% mapat** → contul ruleaza intreg pe default (categoria contului).
  Ok pentru conturi simple (`612 Chirii`). Suspect pe conturi tip "general"
  cu multi parteneri eterogeni.
- **60-90% mapat** → cazul normal, sanatos. Ai mapat banii mari, restul e
  coada lunga pe default.
- **100% mapat** → ti-ai dedicat atentie completa. Rar necesar — semn ca
  ai pierdut timp pe parteneri irelevanti.

**Validare pe mapare orizontala**: suma procentelor pe un cont trebuie sa
dea exact 100%. Daca pui 30 + 40 + 20 = 90%, sistemul afiseaza un
avertisment: *"Lipseste 10% — unde merg banii astia?"*.

**Trasabilitate**: pentru orice suma vazuta in raportul antreprenorului,
poti intreba "**de ce e in categoria X?**" si sistemul iti raspunde cu
regula care a decis incadrarea — nivel 0 (default cont), nivel 1
(partener), sau nivel 2 (exceptie tranzactie).

---

## Cheatsheet — pune-l pe perete

```
╔══════════════════════════════════════════════════════════════════╗
║  OBIECTE                                                         ║
║                                                                  ║
║  cont                ─ cont contabil (6022, 704, 401.x)          ║
║  partener            ─ furnizor (pe cheltuieli) sau              ║
║                       client (pe venituri)                       ║
║  categorie           ─ eticheta patron: "Combustibil", "Salarii" ║
║  linie de business   ─ unitate operationala: "Outsourcing",      ║
║                       "Coworking", "Recruitment"                 ║
║                                                                  ║
║  ACTIUNI / DIRECTII DE LUCRU                                     ║
║                                                                  ║
║  mapare ORIZONTALA   ─ cont → procente pe linii (sumă 100%)      ║
║                        raspunde: "cat din cont pe fiecare linie" ║
║                                                                  ║
║  mapare VERTICALA    ─ (cont, partener) → categorie              ║
║                        raspunde: "ce categorie are partenerul X" ║
║                                                                  ║
║  COEXISTENTA         ─ pot exista AMBELE pe acelasi cont         ║
║                                                                  ║
║  REGULA REZIDUULUI                                               ║
║                                                                  ║
║    1. Verticala isi ia partea (sume pe parteneri exceptii)       ║
║    2. Reziduu = total cont − sume verticala                      ║
║    3. Orizontala se aplica pe REZIDUU, nu pe total               ║
║                                                                  ║
║  PRECEDENTA (castiga cel mai specific)                           ║
║                                                                  ║
║    Nivel 0: default pe cont                                      ║
║    Nivel 1: regula pe partener  (mapare verticala)               ║
║    Nivel 2: exceptie pe tranzactie                               ║
║                                                                  ║
║  REGULI DE NUME                                                  ║
║                                                                  ║
║    ✓ "linia de business Outsourcing"                             ║
║    ✗ "verticala Outsourcing"                  (cuvant interzis)  ║
║    ✓ "mapare verticala pe contul 6022"                           ║
║    ✓ "mapare orizontala 10/20/70"                                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Greșeli frecvente de limbaj (si cum sa le eviti)

| Gresit | Corect |
|---|---|
| "verticala Outsourcing" | "linia de business Outsourcing" |
| "am alocat contul 612 pe verticale" | "am facut mapare orizontala pe contul 612" |
| "partenerul X are verticala Coworking" | combina doua concepte; descompune-l: "partenerul X (pe contul 6022) are categoria Y" (verticala) — si separat "linia Coworking primeste 70% din cont" (orizontala) |
| "axa verticala" / "axa orizontala" | foloseste "mapare verticala" / "mapare orizontala" — *axa* e cuvant ambiguu |
| "categorie de business" pentru Outsourcing | "linie de business" — categoria e doar pentru eticheta patron (Combustibil, Salarii) |

---

## Regula UX universala: orice agregat este clickable + filtreaza contextul

Aceasta nu este o regula doar pentru tab-ul Mapari Cashflow — este regula
generala a produsului Costify. **Orice numar, badge, KPI, coloana sau
breakdown row pe care utilizatorul il vede in interfata trebuie sa
filtreze contextul atunci cand e clicked.**

Nu exista "read-only aggregates". Daca aratam un numar pe ecran,
contabilul vrea sa drillaze in el — sa vada **componentele** ale acelui
numar — fara sa fie nevoit sa traduca manual cifra intr-un filtru pe
alta suprafata.

### Cum se manifesta in tab-ul Mapari Cashflow

| Suprafata | Click action |
|---|---|
| Coloana verticalei (`Outsourcing`, `Toata firma`, etc.) in orizontal accordion | Expandeaza coloana **si** filtreaza lista de conturi de mai jos la conturile alocate pe acea verticala. Banner deasupra listei + visual ring pe coloana activa. |
| Badge `↙ X lei reziduu` pe coloana verticalei implicite | Expandeaza Toata firma **si** filtreaza lista doar la conturile sursa care contribuie cu reziduu (conturi cu exceptii partener pe categorii fara orizontala). Re-click = toggle off. |
| Rand cont in interiorul coloanei verticale | Expandeaza un drawer inline care raspunde direct la "cat din rulajul contului ajunge pe verticala asta", plus distributia contului intre parteneri, plus reziduul absorbit (cand aplicabil). |
| KPI card "X conturi nemapate" in PageHeader | Switch la tab-ul Categorii **si** pre-apply filtrul "Nemapate". |
| KPI card "X parteneri sugerati" | Deschide ReviewQueueDialog (coada de revizuire). |
| KPI card "X exceptii individuale" | Deschide AllExceptionsDialog (toate exceptiile). |
| Coloana cont in AllExceptionsDialog | Inchide dialogul, switch tab Categorii, deschide slide-panel pentru contul respectiv. |
| Eyebrow "Pe contul X" in ReviewQueueDialog | Acelasi flow ca mai sus — drill-in la slide-panel pentru cont. |
| Marker `↗ X lei` pe rand cont in workspace | (cont marker — informativ; orizontala se aplica pe reziduu) |
| Marker `↙ X lei` pe rand categorie in workspace | Deschide dialog orizontala categorie pentru editare. |

### Reguli vizuale obligatorii

1. **Toate elementele clickable au cursor pointer** (enforced global in `globals.css`).
2. **Toate elementele clickable au visual feedback la hover** — minim un bg-tint, ideal si un border / ring primary.
3. **Cand un filtru e activ, exista *intotdeauna* o cale clara de a-l elimina** — fie banner cu "Sterge filtru", fie inline cu "Anuleaza filtrul", fie re-click pe acelasi element (toggle).
4. **Cand filtrul se elimina, contextul de navigare (expandedId, tab) ramane intact.** Contabilul a drillat in deliberat; sa-i resetam tot e enervant.
5. **Elementele active poarta `data-` attributes** (`data-filtered`, `data-active`, `data-residue-mode`, etc.) pentru testabilitate si accesibilitate.
6. **Drill-in cross-suprafata curata starea sursei.** Cand click pe cont in AllExceptionsDialog deschide slide-panel-ul, AllExceptionsDialog se inchide (nu lasam dialog suprapus peste slide-panel).

### Pentru orice PR nou pe Mapari Cashflow

Inainte de merge, raspunde la intrebarea: **"Adaug vreun numar / badge /
agregat nou? Daca da, ce face click pe el?"** Daca raspunsul e "nimic",
fie nu e cu adevarat un agregat util, fie e o promisiune neonorata.

---

## Stare implementare (mai 2026)

Aceasta pagina descrie **contractul de limbaj si comportament** asteptat
de la modulul Mapari Cashflow. Mai jos, **harta exacta** intre ce promite
pagina si ce este implementat azi in cod. Este actualizata la fiecare PR
care atinge modulul; daca vezi ceva care nu se potriveste cu realitatea
din UI, **acea promisiune este buggy si trebuie ridicata**.

### Ce functioneaza azi (livrat si testat)

| Promisiunea paginii | Stare | Detalii / referinte |
|---|---|---|
| Cele 4 obiecte: cont / partener / categorie / linie de business | ✅ | Modele Prisma: `JournalLine`, `JournalPartner`, `CostCategory`, `Vertical`. |
| Maparea orizontala (cont → procente pe linii) | ✅ | `AccountVerticalAllocation` + UI in `edit-allocation-dialog.tsx`. Sum=100% validat la save. |
| Maparea verticala (cont, partener) → categorie | ✅ | `PartnerCategoryOverride` + slide-panel in `partner-panel.tsx`. |
| Bulk apply pe contul intreg | ✅ | Bara mereu vizibila in slide-panel, pre-selectata cu categoria contului. |
| Bulk apply pe **subset filtrat** (search + Top10 + nemapati) | ✅ | Mai 2026 — Modul Claudiei item #1. Helperul `computeBulkTargets` driveaza si lista, si scope-ul bulk. |
| Filtru materialitate "Peste X lei" + chips preset | ✅ | Mai 2026 — Modul Claudiei item #2. Input numeric + 1.000 / 5.000 / 10.000. |
| Bare orizontale rulaj pe fiecare rand partener | ✅ | Mai 2026 — Modul Claudiei item #4. Reanchoreaza la maxim VIZIBIL cand schimbi filtrul. |
| Indicator Pareto "Top N parteneri = X%" + separator "coada lunga" | ✅ | Mai 2026 — Modul Claudiei item #5. Ascuns pe liste mici (≤3 parteneri — no signal). |
| Preview modal cu **breakdown explicit** (parteneri noi + exceptii existente) | ✅ | Mai 2026 — Modul Claudiei item #6. Toggle optional "Suprascrie cele M exceptii existente". |
| Memorie cross-perioada (luna urmatoare partenerii vin pre-completati) | ✅ | Sprint 4 — coada de revizuire + lazy suggestions. |
| Coada de revizuire ("sugestii noi cu impact mare prima") | ✅ | Sprint 5 — dialog card-by-card sortat DESC dupa rulaj. |
| Acoperirea contului (% rulaj mapat explicit) | ✅ | Sprint 1 — bar tonal + cifre + truth-line in panel header. |
| Trasabilitate partener override → KPI categorii pe `/firma` | ✅ | Sprint 6 — `computePartnerCategoryAdjustments` threadat in `computeBreakdownByCategory`. **Axa A corecta.** |
| Vizualizare centralizata "Toate exceptiile pe parteneri" | ✅ | Post-Sprint-7 polish — `<AllExceptionsDialog>` cu search, edit inline, delete. |
| Audit log pentru fiecare modificare de override | ✅ | `recordClientMutation` cu metadata enrich (contBase, partnerName, categoryName). |
| **Regula reziduului pe axa B (linii de business)** | ✅ | Mai 2026 — PR "Integritate cifre". `computeVerticalBreakdown` primeste `partnerAdjustments` si aplica orizontala contului doar pe **reziduu** (brut − sumele redirectate). Reconciliere completa pe ambele axe — vezi `tests/unit/modules/verticals/compute-vertical-breakdown-residue.test.ts` (Exemplul C byte-for-byte). |
| **Orizontala pe categorie** (refolosesc acelasi UI ca pe cont) | ✅ | Mai 2026 — model nou `CategoryVerticalAllocation`. Cand un partener override duce bani la categoria X, banii urmeaza orizontala X (sau verticala default daca X n-are orizontala). UI: dialog `EditCategoryAllocationDialog` cu **exact aceleasi controale** ca `EditAllocationDialog` (split editor, validare sum=100, "imparte egal", "inapoi la implicit"). |
| Marker `↗` pe cont cand are reziduu redirectionat la alte categorii | ✅ | Mai 2026 — `ContResidueMarker` pe rand cont in workspace-ul Mapari Cashflow. Tooltip explica "X lei redirectati; orizontala se aplica pe reziduul de Y lei". |
| Marker `↙` pe categorie cand primeste reziduu din exceptii partener | ✅ | Mai 2026 — `CategoryResidueMarker` pe rand categorie. Click pe marker deschide dialogul de orizontala categorie. Tooltip listeaza top 3 conturi sursa + cum se distribuie (split categorie sau verticala default). |
| Badge `↙ X lei reziduu` pe coloana verticalei implicite in tab "Linii de business" | ✅ | Mai 2026 — apare cand verticala default absoarbe reziduu (categorii fara orizontala proprie). Tooltip invita la setarea orizontalei pe categoriile primitoare. |
| **Click-to-filter pe orice agregat vizual** (regula generala UX) | ✅ | Mai 2026 — orice numar / coloana / KPI / badge e clickable + drillable. Aplicat pe: coloanele verticale (click → expand + filter), badge reziduu (click → filter la conturi sursa), conturi din liste (click → expand inline cu breakdown), KPI cards (click → tab + filter), randuri din dialoguri centralizate (click cont → slide-panel). |
| Click pe coloana verticalei → filtreaza lista de conturi la verticala respectiva | ✅ | Mai 2026 — banner cu "Sterge filtru", subtitle "Anuleaza filtrul" in header. Stergerea filtrului PASTREAZA expandedId (context preserved). |
| Click pe `↙ X lei reziduu` → drill-in la conturile sursa care contribuie | ✅ | Mai 2026 — badge devine button cu `data-active='true'` cand activ. Banner schimba copy in mod reziduu. Lista intern din coloana se narrows si ea ("X conturi sursa reziduu"). |
| Conturi expandabile inline in coloana verticala cu breakdown vertical-aware | ✅ | Mai 2026 — chevron pe fiecare rand, drawer cu (a) headline-card primary care raspunde direct "cat din rulajul contului ajunge pe verticala", (b) distributia contului intre parteneri (3-segment bar), (c) reziduu absorbit cu target categories, (d) buton "Vezi parteneri ↗" la slide-panel. Zero round-trips (foloseste `partnerSummariesByCont` deja loaded). |
| Search box in interiorul coloanei verticale expandate | ✅ | Mai 2026 — `<SearchInput>` h-8 filtreaza diacritic-insensitive prin lista de conturi din coloana. Counter "<N> din <M> conturi" + empty-state copy. |
| KPI cards din PageHeader (nemapate / sugestii / exceptii) integral clickable | ✅ | Mai 2026 — intregul cartonas e button (nu doar link-ul colt). "Nemapate" face si filter pre-apply pe categorii tab (era doar switch tab). |
| Click pe cont in AllExceptionsDialog / ReviewQueueDialog → slide-panel | ✅ | Mai 2026 — coloana cont in AllExceptions e button cu hover ring primary. Eyebrow "Pe contul X" in ReviewQueueDialog e button cu sageata →. Click → inchide dialog + switch categorii tab + deschide slide-panel via `initialPanelContBase`. |

### Ce e partial / poate insela

| Promisiunea paginii | Stare | Ce lipseste |
|---|---|---|
| Stari de mapare: 🟡 Auto-sugerata · ✅ Confirmata · 🔒 **Blocata** | ⚠️ Partial | Doua starile dintai exista. **Blocata pe perioade publicate NU se respecta inca** in `partner-mappings/actions.ts` — modelul `PublishedPeriod` exista in DB dar mutatiile pe override-uri nu verifica daca perioada e inchisa. Vezi roadmap mai jos. |
| Trasabilitate per linie de jurnal ("de ce e in categoria X?") | ⚠️ Partial | La nivel de **cont** stim de ce e in categoria X (regula `AccountCategoryMapping`). La nivel de **partener** stim ce override l-a mutat (`PartnerCategoryOverride`). La nivel de **linie individuala de jurnal**, nu expunem inca un tooltip "aceasta suma provine din regula Y" in UI-ul antreprenorului. Resolver-ul are info; doar nu o afisam. |

### Ce **NU** functioneaza (roadmap, prioritizat)

| Promisiunea paginii | Stare | Impact | Effort |
|---|---|---|---|
| **Nivelul 2: exceptie pe tranzactie individuala** (precedenta sectiune) | ❌ | Sistemul respecta Nivel 0 (default cont) + Nivel 1 (regula partener), dar **NU exista** Nivel 2. Nu poti spune "factura asta specifica e in alta categorie decat ce zice regula partenerului". In docs e descris ca "rar" si nu blocheaza pe nimeni in real-life, dar tehnic e o promisiune neonorata. | ~6-8h (model nou `JournalLineCategoryOverride` + UI per-linie in tabul Balanta) |
| **Blocarea modificarilor pe perioade publicate** | ❌ | Modelul `PublishedPeriod` exista. Hookul anti-modificare in `partner-mappings/actions.ts` si `verticals/actions.ts` lipseste — contabilul poate edita ininteruct un override pe martie chiar daca martie a fost raportat la patron in aprilie. Audit log inregistreaza modificarea, dar nu o opreste. | ~4-5h |
| Tooltip "de ce e in categoria X?" pe sume in raportul antreprenorului | ❌ | Vezi sectiunea de mai sus "trasabilitate". Resolver-ul are info; trebuie expus prin hover + dialog explicativ. | ~2h |
| Validare live "Lipseste 10% — unde merg banii astia?" pentru orizontala incompleta | ⚠️ Posibil partial | Schema permite sum != 100; mecanismul de validare la save trebuie auditat. Daca e doar la save, nu in timpul edit, nu e cu adevarat "live". | ~30 min (audit) + ~1h (live validation daca lipseste) |

### Workflow recomandat de prioritizare (urmatorul PR mare)

Dupa PR-ul "Integritate cifre" (mai 2026) care a rezolvat regula reziduului,
urmatoarea bucata logica este **"Inghet & trasabilitate"**:

1. **Lock perioade publicate** — opreste editarile post-raport.
2. **Tooltip "de ce e in categoria X?"** pe raportul antreprenorului.
3. Teste de integrare care simuleaza scenariul "raportez aprilie, accountantul
   incearca sa modifice o exceptie pe martie" si confirma blocarea.

Cumulat ~6-7h. Beneficiu: completeaza promisiunea de transparenta — fiecare
suma poate fi explicata, fiecare cifra publicata e congelata.

### Surse de adevar — daca te indoiesti

- **Codul** este sursa de adevar finala. Aceasta pagina o descrie.
- **`docs/internal/mapari-cashflow-ux-rewrite-plan.md`** — plan internal cu
  istoria sprinturilor 1-7 + Post-Sprint-7 polish + Modul Claudiei.
- **`training/contabil/structured/costify-app.json`** — ce stie Costi
  despre modul; actualizat in lockstep cu fiecare PR.
- **`tests/unit/modules/partner-mappings/filters.test.ts`** — comportamentul
  exact al filtrelor + threshold + Pareto + bulk targets, in 124 cases.
- **`tests/unit/modules/verticals/compute-vertical-breakdown-residue.test.ts`** —
  regula reziduului, reconciliere completa pe axa B (Exemplul C), category
  allocations, 9 scenarii edge-case.
- **`tests/ui/mapari-cashflow-partner-overrides.spec.ts`** — 38+ teste
  Playwright care verifica end-to-end ce vede contabilul in UI (inclusiv
  markerii `↗` cont, `↙` categorie, `↙` reziduu pe verticala default,
  click-to-filter pe coloane verticale, badge reziduu, drawer-ul de
  cont expandabil cu headline vertical-aware, search box intern,
  precum si flow-urile dialog → slide-panel pentru AllExceptionsDialog
  + ReviewQueueDialog).

---

*Cand modifici terminologia in produs sau in alte documente, actualizeaza si aceasta pagina in acelasi PR. Limbajul comun e contractul cu utilizatorul — nu il rupe. La fel pentru sectiunea "Stare implementare" — orice item mutat din ❌ in ✅ ridica calitatea contractului si trebuie facut intr-un singur commit, in acelasi PR cu codul.*
