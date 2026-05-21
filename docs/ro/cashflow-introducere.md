# Modulul Cashflow — documentatie

Modulul **Cashflow** este partea din Costify care traduce datele contabile (jurnal, balanta, plan de conturi OMFP) intr-o vedere clara pentru antreprenor: cat are firma in cont, cat datoreaza, cat castiga, unde merg banii.

Acelasi jurnal genereaza doua vederi paralele:

:::mockup two-languages
:::

Aceleasi cifre, doua limbaje. **Nimic nu se inventeaza, doar se traduce.**

---

## De unde incep, in functie de cine esti

### Esti **contabil**

Citeste **[Ghid pentru contabil](/docs/cashflow-pentru-contabil)** — setup pas-cu-pas in mai putin de 60 de secunde pentru o firma noua, plus workflow lunar.

### Esti **antreprenor**

Citeste **[Ghid pentru antreprenor](/docs/cashflow-pentru-antreprenor)** — ce vezi pe pagina ta `/firma` si cum citesti fiecare numar.

### Vrei un exemplu real

Citeste **[Exemplu QHM21](/docs/cashflow-exemplu-qhm21)** — walkthrough complet pe firma QHM21 NETWORK SRL, cu cele 3 verticale ale lor (Outsourcing, Recruitment, Coworking) si maparile reale.

---

## Concepte fundamentale

Modulul Cashflow se construieste pe doua axe independente.

### Axa A — Categorii ("natura cheltuielii")

**Generic, partajabil intre firme.** Categoriile sunt etichetele pe care le vede antreprenorul: Salarii, Servicii externe, Electricitate, Marfa.

Orice firma — fie ca face outsourcing IT, fie ca vinde paine, fie ca administreaza un coworking — are aceste categorii. Sunt aliniate la OMFP (planul de conturi standard) si vin precompletate la prima vizita.

Citeste **[Categorii (axa A)](/docs/cashflow-categorii)**.

### Axa B — Verticale ("linii de business")

**Specific firmei, OPTIONAL.** Verticalele sunt liniile de business pe care vrea sa le urmareasca DOAR aceasta firma:
- QHM21 NETWORK SRL → Outsourcing, Recruitment, Coworking
- O firma de constructii → Proiect Bucuresti, Proiect Cluj, Service
- Un restaurant → Sala, Catering, Delivery

Majoritatea firmelor NU au nevoie de verticale — au o singura linie. Verticalele se activeaza explicit per firma.

Citeste **[Verticale (axa B)](/docs/cashflow-verticale)**.

### Cele doua axe sunt INDEPENDENTE

Aceeasi cheltuiala (de exemplu Electricitate pe sediu) poate sa fie:
- Categoria: **Electricitate** (axa A)
- Verticala: **60% Outsourcing + 40% Coworking** (axa B)

:::mockup axes-diagram
:::

NU se incorporeaza una in alta. "Electricitate Outsourcing" ca nume de categorie e o gresala — colapseaza modelul.

---

## Glosar

| Termen | Inseamna |
|--------|----------|
| **Categorie** (CostCategory) | O eticheta patron-friendly: "Salarii", "Electricitate". Axa A. |
| **Verticala** (Vertical) | O linie de business: "Outsourcing", "Recruitment". Axa B. Optional. |
| **Mapare** (AccountCategoryMapping) | Legatura "contul 628 -> categoria Servicii externe". Per firma. |
| **Alocare** (VerticalAllocation) | Legatura "contul 605 -> 60% Outsourcing + 40% Coworking". Per firma. |
| **Snapshot publicat** (PublishedPeriod) | Inghet la data X a tot ce vede patronul pe /firma pentru luna Y. Ferit de modificari accidentale. |
| **OMFP** | Planul de conturi standard romanesc (Ordinul Ministrului Finantelor Publice 1802/2014). |
| **contBase** | Codul 3-cifre al unui cont (de exemplu "628" din "628.01.NOLICH"). |
| **analitic** | Codul complet al unui cont, inclusiv subdiviziile partener/proiect (de exemplu "628.01.NOLICH"). |
| **rulaj** | Suma de miscari pe un cont intr-o luna (debit sau credit). |
| **OWNER** / **antreprenor** / **patron** | Cele 3 cuvinte sunt sinonime in documentatia asta. Persoana care detine firma. |
| **ACCOUNTANT** / **contabil** | Persoana care administreaza datele firmei in Costify. |

---

## Mai jos in documentatie

- **[Ghid pentru contabil](/docs/cashflow-pentru-contabil)** — task guide pentru contabil
- **[Ghid pentru antreprenor](/docs/cashflow-pentru-antreprenor)** — task guide pentru antreprenor
- **[Exemplu QHM21](/docs/cashflow-exemplu-qhm21)** — walkthrough complet pe un caz real
- **[Categorii (axa A)](/docs/cashflow-categorii)** — axa A in detaliu
- **[Verticale (axa B)](/docs/cashflow-verticale)** — axa B in detaliu

---

*Cand modifici functionalitatea modulului Cashflow, actualizeaza si documentatia in acelasi PR.*
