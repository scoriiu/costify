# Exemplu complet: QHM21 NETWORK SRL

Walkthrough real al unei firme cu portofoliu complex. **Acesta este exemplul de referinta** — daca esti contabil si configurezi pentru prima data o firma cu verticale, copiaza tiparul de aici.

---

## Despre firma

**QHM21 NETWORK SRL** este o firma reala cu trei linii distincte de business:

- **Outsourcing** — contracte de IT outsourcing, echipa tehnica detasata la clienti.
- **Recruitment** — servicii de recrutare candidati tehnici pentru terti.
- **Coworking** — operatorul unui spatiu de coworking (Eminescu 1 si Eminescu 2).

Aceste 3 verticale au:

- Aceiasi angajati care lucreaza partial pentru fiecare → salarii partajate
- Acelasi sediu Eminescu 1 folosit si pentru Coworking, si pentru Outsourcing → chirie partajata
- Aceleasi facturi de electricitate, internet, contabilitate → partajate

Patronul (Sorin) vrea sa vada CAT ADUCE FIECARE LINIE separat — daca Outsourcing-ul subventioneaza Coworking-ul sau invers, daca Recruitment-ul merita continuat.

Asta este cazul tipic care justifica verticalele.

---

## Pasul 0 — Starting state

Coriiu (contabilul) a incarcat jurnalul de pe ianuarie 2025 pana in aprilie 2026 (15 luni). Toate import-urile au mers curat. Balanta este balansata.

Cand intra pe tab-ul **Mapari Cashflow** prima data, vede:

:::mockup mapari-flow
:::

La autoseed sistemul a creat 10 categorii cheltuieli OMFP + 6 categorii venituri OMFP, toate fiind defaults. Pasul 2 (Verticale) este inca dezactivat. Pasul 3 are 77 conturi 6x/7x, toate deja mapate la defaults OMFP, 0 nemapate.

Daca firma ar fi avut o singura linie de business, Coriiu ar fi terminat aici. Publica luna si Sorin vede pagina lui. Pentru QHM21, mai are de facut Pasul 2 + ajustari la Pasul 3.

---

## Pasul 1 — Personalizare etichete (optional)

Sorin ii spune lui Coriiu: "vreau sa vad clar **Recrutarea** ca venit separat, nu in masa de Servicii".

Coriiu deschide Pasul 1 (click *Personalizeaza*), apoi adauga o categorie noua sub Venituri: **Servicii de recrutare**. Aceasta este o categorie ne-default (fara badge OMFP). In Pasul 3, Coriiu va muta contul corespunzator (704.REC) la aceasta noua categorie.

**Important:** "Servicii de recrutare" este o CATEGORIE (axa A) — natura venitului. Recruitment ca VERTICALA (axa B, linie de business) o adaugam la Pasul 2. Cele doua sunt diferite si ortogonale. Acelasi venit "704.REC = 15.000 lei" merge la:

- Categoria: *Servicii de recrutare*
- Verticala: *Recruitment*

---

## Pasul 2 — Activare verticale

Coriiu click *Activeaza verticale*. Apare modalul de bootstrap:

:::mockup activate-modal
:::

Coriiu completeaza cele 3 verticale → Save. Sistemul creeaza 4 row-uri in DB (3 vizibile + 1 implicita "Toata firma") si face redirect automat la Pasul 3. Tab-ul arata acum:

:::mockup verticals-list
:::

---

## Pasul 3 — Mapeaza conturile cu split-uri

Acum coloana "Verticala" a aparut pe fiecare cont in Pasul 3. Toate conturile au inca "Toata firma" (default).

Coriiu cunoaste afacerea. Stie ca:

### Salarii (cont 641, ~50k/luna)

3 angajati lucreaza ~70% pentru Outsourcing si 30% pentru Recruitment. Coworking-ul are propriul administrator (alta firma) si nu primeste salarii din QHM21.

Click pe dropdown verticala in randul *641* → "Impartit intre mai multe verticale..." → popover:

:::mockup split-popover
:::

Save. De acum incolo, fiecare leu cheltuit pe 641 va aparea 70% pe Outsourcing si 30% pe Recruitment.

### Electricitate (cont 605, ~12k/luna)

Sediul Eminescu 1 este 60% folosit de Coworking (sala cu birouri inchiriate), 40% folosit ca birou propriu (Outsourcing + Recruitment, dar Coriiu trateaza Outsourcing ca dominant). Split 60% Coworking / 40% Outsourcing.

### Chirie sediu (628.CHIRIE, ~6k/luna)

Aceeasi logica ca Electricitate — split 60/40 Coworking/Outsourcing.

### Contractul cu NOLICH SRL (628.01 NOLICH, ~25k/luna)

NOLICH este 100% un subcontractor Outsourcing. Aici Coriiu vrea sa OVERRIDE-uiasca maparea bazei (628 → Servicii) cu o mapare individuala pe 628.01 → Outsourcing.

:::mockup account-row
:::

### Venituri din recrutare (704.REC, ~80k/luna)

Cont 704.REC, rulaj 80.000 lei → categoria *Servicii de recrutare* (cea noua de la Pasul 1) → verticala *Recruitment* 100%.

### Venituri din coworking (704.CWK, ~40k/luna)

Cont 704.CWK, rulaj 40.000 lei → categoria *Vanzari (cifra de afaceri)* → verticala *Coworking* 100%.

### Restul conturilor

Coriiu lasa restul conturilor pe "Toata firma" (default). Ele sunt fie mici (sub 1.000 lei), fie cu adevarat partajate fara o regula clara (de exemplu comisioane bancare, taxe locale, abonamente software comune). Acestea apar pe `/firma` sub "Toata firma".

---

## Pasul 4 — Publish aprilie 2026

Coriiu trece pe tab Balanta de Verificare → selecteaza aprilie 2026 → bara contextuala arata "luna nu este publicata".

Click "Publica luna" → modal de confirmare → save.

Sistemul:

1. Calculeaza snapshotul pentru luna aprilie 2026 (KPI, breakdown-uri, verticale).
2. Aplica split-urile pentru fiecare cont la rulajul lunii.
3. Salveaza JSON-ul ca `PublishedPeriod` cu hash SHA-256 (audit).
4. Inregistreaza evenimentul in audit.

Sorin primeste imediat noul snapshot. Daca este logat, refresh pagina si vede.

---

## Ce vede Sorin acum pe `/firma`

Aceasta este pagina completa pe care o vede patronul dupa publish:

:::mockup owner-home-full
:::

---

## Concluzii operationale pe care le vede Sorin

Sorin se uita la pagina si vede in 30 de secunde:

1. **Outsourcing genereaza 88% din profitul firmei** (70k din 95k total). Daca pierde un contract aici, e in alerta.
2. **Coworking este profitabil dar marginal** (5k profit). Daca apare orice cost suplimentar, ajunge pe minus.
3. **Recruitment este sanatos** ca marja (25%), dar mic ca volum. Merita scalat.
4. **Cifra de afaceri Outsourcing a crescut cu 18% YoY**. Tendinta buna.

Niciuna din concluziile astea nu ar fi fost evidente fara verticale — pe un breakdown global "Servicii externe 23k" nu ar fi spus nimic despre cine genereaza profitul.

---

## Recap configuratie QHM21

| Element | Valoare |
|---------|---------|
| Categorii Cheltuieli | 10 OMFP + 0 custom |
| Categorii Venituri | 6 OMFP + 1 custom (*Servicii de recrutare*) |
| Verticale | Outsourcing, Recruitment, Coworking, Toata firma (implicit) |
| Conturi cu alocare individuala | 6 conturi mari (641, 605, 628.CHIRIE, 628.01 NOLICH, 704.REC, 704.CWK) |
| Conturi cu split | 3 conturi (641 = 70/30, 605 = 60/40, 628.CHIRIE = 60/40) |
| Total munca de setup | ~15 minute o singura data |
| Workflow lunar | ~3 minute (upload + verify + publish) |

---

## Mini-cazuri ale altor firme (referinta scurta)

### Restaurant cu 3 canale

Verticale: **Sala** (in-house dining), **Catering** (livrari corporate), **Delivery** (online retail), *Toata firma*.

| Cont | Strategie |
|------|-----------|
| 641 Salarii bucatari | 60/30/10 (Sala/Catering/Delivery) |
| 605 Electricitate | 70/20/10 |
| 624 Transport | 100% Delivery |

### Firma de constructii cu 2 proiecte mari

Verticale: **Proiect Bucuresti**, **Proiect Cluj**, **Service** (mentenanta), *Toata firma*.

| Cont | Strategie |
|------|-----------|
| 605 Materiale (analitic pe proiect) | 100% per proiect |
| 641 Manopera | Split lunar pe ponderea timpilor pontati |
| 645 Echipa management | Toata firma |

### SaaS cu 2 produse

Verticale: **Produs A**, **Produs B**, **Consultanta**, *Toata firma*.

| Cont | Strategie |
|------|-----------|
| 628.AWS-A si 628.AWS-B | 100% pe fiecare produs |
| 641.PRODA si 641.PRODB | 100% pe dev specifici |
| 641 echipa core (fara analitic) | Toata firma |

---

*Vezi si: [Categorii (axa A)](/docs/cashflow-categorii), [Verticale (axa B)](/docs/cashflow-verticale)*
