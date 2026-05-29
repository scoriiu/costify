# Limbajul maparii — o singura pagina pentru tot

> Aceasta pagina te invata tot ce ai nevoie ca sa lucrezi cu modulul Mapari.
> Citeste-o o data si nu te mai pierzi. Foloseste exemple concrete pe conturi
> reale (`6022 Combustibil`, `371 Marfa`) si pe o firma reala cu trei linii de
> business: **QHM21 NETWORK SRL** — `Outsourcing`, `Recruitment`, `Coworking`.
>
> Tot ce vezi aici se configureaza cu **procente fixe**. Nu exista chei
> dinamice (procent dupa cifra de afaceri, dupa m², dupa numar de documente) —
> un procent setat se aplica automat in fiecare luna, ca o regula, pana cand
> il schimbi tu.

---

## Cele 4 cuvinte de baza

Tot modulul se construieste din patru obiecte. Separa-le o data si nu le mai
confunzi niciodata:

| Cuvant | Ce este | Cine il vede |
|---|---|---|
| **cont** | un cont contabil (`6022`, `371`, `704`, `401.x`) | contabilul |
| **partener** | furnizorul (pe cheltuieli) sau clientul (pe venituri) care apare pe un cont | contabilul |
| **categorie** | eticheta de business — *ce fel* de cheltuiala/venit e: `Combustibil`, `Salarii`, `Marfa` | antreprenorul |
| **linie de business** | o activitate strategica a firmei — *pe ce* se imparte: `Outsourcing`, `Recruitment`, `Coworking` | antreprenorul |

> **Regula de nume**: spunem **`linie de business`**, niciodata "verticala".
> Cuvantul "verticala" a fost abandonat pentru ca se ciocnea cu alte sensuri.

`categorie` raspunde la **"ce fel de bani sunt?"**. `linie de business`
raspunde la **"pe ce activitate a firmei merg?"**. Sunt doua intrebari
ortogonale, complet diferite — un leu are intotdeauna si o categorie, si
(daca firma are linii) o linie de business.

```
    cont 6022                         cont 704
    ─────────────                     ─────────────
    Combustibil                       Venituri din servicii
    cheltuiala (debitor)              venit (creditor)
```

Pe `6022` apar facturile de la benzinarii. Pe `704` apar facturile pe care
firma le-a emis catre clienti. Pe fiecare cont apar **parteneri** — pe `6022`
furnizori (OMV, Petrom), pe `704` clienti (NOLICH, Anduvel).

---

## Categoria — coloana vertebrala

Categoria spune *ce natura* are un cont. Vine pre-completata din planul OMFP
si o poti rafina per firma:

| Cod cont | Categorie pentru patron |
|---|---|
| `6022` | `Combustibil` |
| `371` | `Marfa, materii prime si materiale` |
| `641, 645` | `Salarii si contributii` |
| `7011` | `Vanzari` |

Categoriile sunt **backbone-ul** — se schimba rar. Vederea principala in modul
e organizata pe categorii: vezi conturile grupate sub categoria lor.

- **Maparea de baza**: fiecare cont apartine unei categorii (`6022 → Combustibil`).
- **Exceptie pe partener**: cand un cont aduna parteneri de naturi diferite
  (clasica greseala de inregistrare — o factura de curieratie pe contul de
  combustibil), pui o categorie diferita doar pe acel partener.

```
   Cont 6022 — Combustibil
   Partener          Suma     Categorie
   ─────────────     ──────   ─────────────────
   OMV               12.300   Combustibil          (default cont)
   Petrom             8.100   Combustibil          (default cont)
   SC Logistic SRL      900   Servicii curierat    (EXCEPTIE partener!)
   Mol                7.200   Combustibil          (default cont)
```

---

## Linia de business — split-ul care cade in cascada

Aici e ideea centrala a modulului. **Impartirea pe linii de business o setezi
pe CATEGORIE, si ea cade automat in jos** — la toate conturile din categorie si
la toti partenerii din acele conturi.

Exemplu: pui pe categoria **`Marfa, materii prime si materiale`** un split de

```
   Marfa, materii prime si materiale
   ┌──────────────┬──────────────────┐
   │  40%         │  60%             │
   │  Outsourcing │  Recruitment     │
   └──────────────┴──────────────────┘
```

Din acel moment, **fiecare leu** care intra pe orice cont din categoria Marfa
(si pe orice partener al lor) se imparte automat 40% Outsourcing / 60%
Recruitment — fara sa mai atingi nimic. E o **regula live**, nu un snapshot:
luna viitoare se aplica la fel, pe sumele noi.

### Cascada — cine mosteneste de la cine

Split-ul nu traieste doar pe categorie. E o cascada pe patru niveluri. Setezi
o data, sus, si totul de dedesubt mosteneste. Pui o exceptie doar acolo unde
chiar difera:

```
   ┌─ FIRMA ────────────────────────────────────────────────┐
   │  Split implicit pe toata firma (optional)               │
   │  ex: 50% Outsourcing / 50% Recruitment                  │
   │     │                                                   │
   │     ▼ mosteneste daca nu e setat mai jos               │
   │  ┌─ CATEGORIE ──────────────────────────────────────┐  │
   │  │  Marfa → 40% Outsourcing / 60% Recruitment        │  │
   │  │     │  (← unitatea principala pe care o editezi)  │  │
   │  │     ▼ mosteneste                                  │  │
   │  │  ┌─ CONT ─────────────────────────────────────┐  │  │
   │  │  │  6022 → poate avea regula proprie           │  │  │
   │  │  │     │                                       │  │  │
   │  │  │     ▼ mosteneste                            │  │  │
   │  │  │  ┌─ PARTENER ──────────────────────────┐    │  │  │
   │  │  │  │  un partener anume → regula proprie  │    │  │  │
   │  │  │  └──────────────────────────────────────┘    │  │  │
   │  │  └─────────────────────────────────────────────┘  │  │
   │  └───────────────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────────────┘
```

**Cel mai specific castiga.** Daca un cont nu are regula proprie, urmeaza
categoria. Daca nici categoria nu are, urmeaza firma. Daca nici firma, totul
merge pe linia implicita `Toata firma`.

> Cand schimbi split-ul pe categoria Marfa, **tot ce mostenea de la ea se
> actualizeaza singur**. Doar conturile/partenerii cu regula proprie raman
> neatinsi. Asta inseamna "regula live, nu re-stampilare".

### Cand ai nevoie de linii de business

- **Da**: firma are mai multe activitati (Outsourcing + Coworking) si conturi
  comune (chirie sediu, electricitate, contabilitate) folosite de toate.
- **Nu**: firma are o singura activitate, sau conturile sunt deja separate pe
  analitice (`6022.OUTSOURCING` vs `6022.COWORKING`). Majoritatea firmelor
  **NU au linii** — au un singur business.

---

## Cum recunoastem un partener (fara CUI)

Datele de contabilitate nu au CUI-ul partenerului — vine doar **denumirea** din
jurnal. Acelasi partener poate fi scris diferit de la luna la luna:

```
   In jurnal apare ca:                Sistemul vede:
   ──────────────────────             ───────────────
   "FAN COURIER SRL"            ─►    fan courier
   "Fan Courier"                ─►    fan courier         ✓ acelasi
   "Fan Courier S.R.L."         ─►    fan courier         ✓ acelasi
   "FANCOURIER"                 ─►    fancourier          ✗ alt partener!
```

**Normalizarea** (minuscule, fara punctuatie, fara forma juridica SRL/SA/PFA,
fara spatii duble) produce numele dupa care tinem minte si sugeram.

**Consecinta de design**: matching-ul ramane probabilistic (nu avem CUI), deci
tot ce vine din memorie apare ca **sugestie de confirmat**, niciodata aplicat
automat. Te protejam de "nume similar, dar alt partener".

---

## Modul corect de lucru — materialitatea

Pe un cont cu zeci de parteneri NU mapezi rand cu rand. **Efortul urmeaza
banii.** Pe orice cont, 2-3 parteneri fac de obicei 70-90% din valoare; restul
e coada lunga.

```
   Cont 6022 — Combustibil — 32.500 lei
   ─────────────────────────────────────
   OMV               12.300    ████████████████████████  ▲
   Petrom             8.100    ████████████████          │  82% din valoare
   Mol                7.200    ██████████████            │  in primii 4
   Rompetrol          4.500    █████████                 ▼
   ─── coada lunga (44 parteneri sub 500 lei) ───  18%, nu merita timp
```

**Fluxul in 3 pasi:**

1. **Bulk** pe tot contul la categoria de baza (`6022 → Combustibil`). Rezolva
   95% din munca intr-un click.
2. **Exceptii de sus in jos**: te uiti la primii 5-10 parteneri si suprascrii
   doar ce nu e ca regula (`SC Logistic SRL → Servicii curierat`).
3. **Te opresti** cand valoarea ramasa e nesemnificativa. Coada lunga ramane pe
   default — corect statistic.

Poti aplica bulk si pe **subseturi filtrate** ("peste 1.000 lei", "doar
nemapati", "contin 'coworking' in denumire") ca sa transformi 200 de decizii in
3-5 decizii pe grupuri + cateva exceptii.

**Memoria face luna urmatoare gratuita**: partenerii deja mapati vin
pre-completati; doar partenerii noi apar nemapati.

---

## Starile unei mapari

Fiecare mapare are una din 3 stari, ca sa stii pe ce poti avea incredere:

| Stare | Inseamna | Cand apare |
|---|---|---|
| 🟡 **Auto-sugerata** | Vine din memorie / matching pe nume — neconfirmata. | Pre-fill la luna noua. |
| ✅ **Confirmata** | Validata manual de contabil. | Dupa orice editare explicita. |
| 🔒 **Blocata** | Pe o perioada inchisa (raportata) — nu se mai modifica. | La inchiderea lunii. |

Contabilul intra **doar in coada de revizuire** (sugestiile noi), le trateaza
in cateva minute, restul ramane stabil.

---

## Precedenta — castiga cel mai specific

Pentru fiecare leu, sistemul raspunde la doua intrebari separate.

**1. Ce categorie?** (ce fel de bani)

```
   Cel mai specific  ─►  EXCEPTIE pe partener   (partenerul X are categoria Y)
                          │ altfel
   Cel mai general   ─►  DEFAULT pe cont        (categoria contului)
                          │ altfel
                         categoria OMFP standard
```

**2. Ce linie de business?** (pe ce activitate) — cascada split-ului:

```
   Cel mai specific  ─►  regula pe PARTENER
                          │ altfel
                         regula pe CONT
                          │ altfel
                         split pe CATEGORIE          (← unde lucrezi de obicei)
                          │ altfel
                         split pe FIRMA
                          │ altfel
                         linia implicita "Toata firma" (100%)
```

**Trasabilitate**: pentru orice suma din raportul antreprenorului poti intreba
"**de ce e aici?**" si sistemul iti arata regula care a decis — categoria
(default cont sau exceptie partener) si linia (de pe ce nivel al cascadei a
mostenit).

---

## Cand cele doua coexista — regula reziduului

Pe acelasi cont poti avea SI un split pe linii, SI o exceptie de categorie pe un
partener. Cand le combini, **split-ul pe linii se aplica pe REZIDUU** (ce ramane
dupa ce exceptia de categorie si-a luat partea), nu pe brut.

### Exemplu — cont `6022`, 32.500 lei

- Categoria contului: `Combustibil`, cu split `10% Outsourcing / 20% Recruitment / 70% Coworking`
- Exceptie: `SC Logistic SRL` (900 lei) → categoria `Servicii curierat`

```
   PAS 1 — exceptia de categorie isi ia partea
   SC Logistic SRL ──► 900 lei pe "Servicii curierat"

   PAS 2 — reziduu = 32.500 − 900 = 31.600 lei  (raman pe Combustibil)

   PAS 3 — split pe linii, aplicat pe reziduu
   31.600 × 10% =  3.160  Outsourcing  (Combustibil)
   31.600 × 20% =  6.320  Recruitment  (Combustibil)
   31.600 × 70% = 22.120  Coworking    (Combustibil)

   PAS 4 — cei 900 lei urmeaza split-ul categoriei "Servicii curierat"
            (sau "Toata firma" daca acea categorie n-are split)

   Verificare:  3.160 + 6.320 + 22.120 + 900 = 32.500 ✓
```

> Daca **nu** respecti regula reziduului si aplici 10/20/70 pe 32.500 brut, cei
> 900 lei intra de doua ori. **De asta exista regula reziduului.**

---

## 3 exemple complete

### A — cont simplu (firma fara linii)

> `6022 Combustibil`, 32.500 lei. Un singur business, toti partenerii benzinarii.

```
   Categorie cont:    Combustibil
   Linii de business: NICIUNA
   Rezultat: 32.500 lei integral pe "Combustibil".
```

### B — split pe categorie, mostenit de conturi

> Categoria `Marfa` cu split `40% Outsourcing / 60% Recruitment`. Sub ea,
> conturile `371` (300.000 lei) si `607` (120.000 lei), niciunul cu regula proprie.

```
   371 → mosteneste Marfa:  120.000 Outsourcing + 180.000 Recruitment
   607 → mosteneste Marfa:   48.000 Outsourcing +  72.000 Recruitment

   Pe /firma — "Pe linii de business":
       Outsourcing → Marfa: 168.000
       Recruitment → Marfa: 252.000
```

Un singur split, setat pe categorie, a impartit doua conturi. Adaugi maine un
cont nou pe Marfa → mosteneste automat 40/60.

### C — cont mixt (split + exceptie partener)

> `6022 Combustibil`, 32.500 lei. Split categorie `10/20/70`, plus o exceptie
> `SC Logistic SRL` (900 lei) → `Servicii curierat`. Vezi calculul complet la
> *regula reziduului* de mai sus.

```
   Pe /firma — "Categorii":            Pe /firma — "Pe linii de business":
       Combustibil:        31.600          Outsourcing → Combustibil:  3.160
       Servicii curierat:     900          Recruitment → Combustibil:  6.320
                                           Coworking   → Combustibil: 22.120
```

---

## Cheatsheet — pune-l pe perete

```
╔══════════════════════════════════════════════════════════════════╗
║  OBIECTE                                                         ║
║    cont              ─ cont contabil (6022, 371, 704)            ║
║    partener          ─ furnizor (cheltuieli) / client (venituri) ║
║    categorie         ─ CE FEL de bani: "Combustibil", "Marfa"    ║
║    linie de business ─ PE CE activitate: "Outsourcing"           ║
║                                                                  ║
║  DOUA INTREBARI PE FIECARE LEU                                  ║
║    1. Ce categorie?       (default cont, sau exceptie partener)  ║
║    2. Ce linie de business? (split-ul, in cascada)               ║
║                                                                  ║
║  CASCADA SPLIT-ULUI (castiga cel mai specific)                  ║
║    partener  →  cont  →  CATEGORIE  →  firma  →  Toata firma     ║
║                          (aici lucrezi de obicei)                ║
║                                                                  ║
║  DOAR PROCENTE FIXE — fara chei dinamice. Regula live.          ║
║                                                                  ║
║  REGULA REZIDUULUI                                              ║
║    1. Exceptia de categorie isi ia partea (sume pe parteneri)   ║
║    2. Reziduu = total cont − sume exceptii                       ║
║    3. Split-ul pe linii se aplica pe REZIDUU, nu pe brut         ║
║                                                                  ║
║  NUME                                                           ║
║    ✓ "linia de business Outsourcing"                            ║
║    ✗ "verticala Outsourcing"                  (cuvant interzis) ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Greseli frecvente de limbaj

| Gresit | Corect |
|---|---|
| "verticala Outsourcing" | "linia de business Outsourcing" |
| "categorie de business" pentru Outsourcing | "linie de business" — categoria e doar eticheta (Combustibil, Marfa) |
| "aloc procente dupa cifra de afaceri" | nu exista chei dinamice — doar procente fixe, in cascada |
| "stampilez split-ul pe fiecare cont" | setezi split-ul pe categorie; conturile il mostenesc live |

---

## Regula UX universala: orice agregat e clickable si filtreaza

Orice numar, badge, KPI, coloana sau rand pe care utilizatorul il vede trebuie
sa **filtreze contextul** cand e clicked. Nu exista "agregate read-only" — daca
aratam un numar, contabilul vrea sa drillaze in componentele lui.

Reguli vizuale obligatorii:

1. Toate elementele clickable au **cursor pointer** (enforced in `globals.css`).
2. Toate au **feedback la hover** (minim bg-tint, ideal ring primary).
3. Cand un filtru e activ, exista **intotdeauna** o cale clara de a-l elimina
   (banner "Sterge filtru" sau re-click pe acelasi element).
4. Cand filtrul se elimina, **contextul de navigare ramane intact**.

Pentru orice PR nou pe Mapari: *"Adaug vreun agregat nou? Ce face click pe el?"*
Daca raspunsul e "nimic", fie nu e util, fie e o promisiune neonorata.

---

## Stare implementare

Modelul unificat (cascada firma → categorie → cont → partener, doar procente
fixe) este in lucru pe branch `feat/pr-2c-6-mapari-coverage`. Contractul tehnic
detaliat — model de date, resolver, plan UI, ce e facut vs ramas — este in
**`docs/internal/mapari-unified-cascade-plan.md`**. Cand muti un item din ramas
in facut, actualizeaza si acel plan si aceasta pagina, in acelasi PR.

Surse de adevar:
- **Codul** — sursa finala. Aceasta pagina o descrie.
- **`docs/internal/mapari-unified-cascade-plan.md`** — contractul tehnic curent.
- **`training/contabil/structured/costify-app.json`** — ce stie Costi; lockstep.
- **`tests/unit/modules/verticals/`** — resolver, cascada, regula reziduului.

---

*Cand modifici terminologia in produs sau in alte documente, actualizeaza si
aceasta pagina in acelasi PR. Limbajul comun e contractul cu utilizatorul — nu
il rupe.*
</content>
