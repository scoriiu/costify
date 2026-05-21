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

```
Tab Mapari Cashflow → la prima vizita
─────────────────────────────────────────

Pasul 1 (Etichete patron, colapsat)
  ✓ 10 categorii cheltuieli OMFP
  ✓ 6 categorii venituri OMFP
  ✓ Toate sunt defaults, niciuna personalizata

Pasul 2 (Verticale, dezactivat)
  Aici trebuie sa intervenim.

Pasul 3 (Mapeaza conturile)
  77 conturi 6x/7x.
  77 deja mapate la defaults OMFP (la prima vizita s-au creat maparile cont-de-baza).
  0 nemapate.
```

Daca firma ar fi avut o singura linie de business, Coriiu ar fi terminat aici. Publica luna si Sorin vede pagina lui. Pentru QHM21, mai are de facut Pasul 2 + ajustari la Pasul 3.

---

## Pasul 1 — Personalizare etichete (optional)

Sorin ii spune lui Coriiu: "vreau sa vad clar **Recrutarea** ca venit separat, nu in masa de Servicii".

Coriiu deschide Pasul 1 (click *Personalizeaza*), apoi adauga o categorie noua sub Venituri:

```
Cheltuieli                          Venituri
──────────                          ────────
• Marfa                             • Vanzari (cifra de afaceri)
• Electricitate, apa                • Servicii de recrutare        ← NOU
• Servicii externe                  • Subventii din exploatare
• Salarii si contributii            • Venituri financiare
• ...                               • ...
```

Aceasta este o categorie ne-default (fara badge OMFP). In Pasul 3, Coriiu va muta contul corespunzator (704.REC) la aceasta noua categorie.

**Important:** "Servicii de recrutare" este o CATEGORIE (axa A) — natura venitului. Recruitment ca VERTICALA (axa B, linie de business) o adaugam la Pasul 2.

Cele doua sunt diferite si ortogonale. Acelasi venit "704.REC = 15.000 lei" merge la:
- Categoria: *Servicii de recrutare*
- Verticala: *Recruitment*

---

## Pasul 2 — Activare verticale

Coriiu click *Activeaza verticale*. Apare modalul de bootstrap:

```
Configureaza verticalele firmei
─────────────────────────────────
Scrie numele liniilor de business pe care vrei sa le urmaresti.

1. [Outsourcing                     ]
2. [Recruitment                     ]
3. [Coworking                       ]
+ adauga inca una

Verticala "Toata firma" se creeaza automat ca fallback.

                    [Renunta]  [Salveaza si continua]
```

Coriiu completeaza cele 3 verticale → Save. Sistemul:
- Creeaza 4 row-uri in DB (3 vizibile + 1 implicita "Toata firma").
- Redirect automat la Pasul 3.

Acum tabul arata:

```
PASUL 2 — Verticale de business
  Outsourcing       0 conturi alocate
  Recruitment       0 conturi alocate
  Coworking         0 conturi alocate
  Toata firma       implicit · 0 conturi

  [+ Adauga verticala]   [Dezactiveaza]
```

---

## Pasul 3 — Mapeaza conturile cu split-uri

Acum coloana "Verticala" a aparut pe fiecare cont in Pasul 3. Toate conturile au inca "Toata firma" (default).

Coriiu cunoaste afacerea. Stie ca:

### Salarii (cont 641, ~50k/luna)

3 angajati lucreaza ~70% pentru Outsourcing si 30% pentru Recruitment. Coworking-ul are propriul administrator (alta firma) si nu primeste salarii din QHM21.

Click pe dropdown verticala in randul *641* → "Impartit intre mai multe verticale..." → popover:

```
Imparte intre verticale
─────────────────────────
Cont: 641 (Salarii)

  Outsourcing       [▬▬▬▬▬▬▬▬▬░] 70 %
  Recruitment       [▬▬▬░░░░░░░] 30 %
  + adauga verticala

Total: 100%                  [Salveaza]
```

Save. De acum incolo, fiecare leu cheltuit pe 641 va aparea 70% pe Outsourcing si 30% pe Recruitment.

### Electricitate (cont 605, ~12k/luna)

Sediul Eminescu 1 este 60% folosit de Coworking (sala cu birouri inchiriate), 40% folosit ca birou propriu (Outsourcing + Recruitment, dar Coriiu trateaza Outsourcing ca dominant).

```
Imparte intre verticale
─────────────────────────
Cont: 605 (Electricitate)

  Coworking         60 %
  Outsourcing       40 %

Total: 100%
```

### Chirie sediu (628.CHIRIE, ~6k/luna)

Aceeasi logica ca Electricitate — split 60/40 Coworking/Outsourcing.

### Contractul cu NOLICH SRL (628.01 NOLICH, ~25k/luna)

NOLICH este 100% un subcontractor Outsourcing. Aici Coriiu vrea sa OVERRIDE-uiasca maparea bazei (628 → Servicii) cu o mapare individuala pe 628.01 → Outsourcing.

```
Cont 628.01 NOLICH SRL              rulaj 23.451 lei
  Scope: [individual] ←-- comutat de la 'din baza'
  Categorie: Servicii externe
  Verticala: Outsourcing            ← 100%, no split
```

### Venituri din recrutare (704.REC, ~80k/luna)

```
Cont 704.REC                        rulaj 80.000 lei
  Scope: din baza
  Categorie: Servicii de recrutare  ← categoria noua de la Pasul 1
  Verticala: Recruitment            ← 100%
```

### Venituri din coworking (704.CWK, ~40k/luna)

```
Cont 704.CWK                        rulaj 40.000 lei
  Categorie: Vanzari (cifra de afaceri)
  Verticala: Coworking
```

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

```
QHM21 NETWORK SRL — aprilie 2026
Date publicate: aprilie 2026 · de Coriiu Solomon, pe 20 mai

┌──────────────────────────────────────────────────────────────────────┐
│ KPI                                                                  │
│ ──                                                                   │
│ Bani in cont       │ De primit       │ De platit      │ Profit YTD   │
│ 84.500 lei         │ 121.000 lei     │ 90.069 lei     │ +120.000 lei │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Comparat cu aprilie 2025                                             │
│ ── ── ── ──                                                          │
│ Vanzari   +12%   │  Cheltuieli  +8%  │  Profit  +18%  │  Cash  +5%   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Unde s-au dus banii (aprilie 2026)                                   │
│ ──────────────────                                                   │
│   Salarii si contributii      45.000 lei  ████████████              │
│   Servicii externe            23.000 lei  ███████                   │
│     › NOLICH (cont 628.01)    23.451 lei                            │
│   Electricitate, apa           8.000 lei  ███                       │
│   Chirie sediu                 6.000 lei  ██                        │
│   Marfa, materii prime         5.000 lei  ██                        │
│   ...                                                                │
│                                                                      │
│ De unde au venit banii                                               │
│ ────────────────────                                                 │
│   Vanzari (Outsourcing+Cwk)  360.000 lei  ████████████████          │
│   Servicii de recrutare       80.000 lei  ███                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Pe linii de business — aprilie 2026                                  │
│ ────────────────────                                                 │
│   Outsourcing                                                        │
│     venituri    320.000 lei                                          │
│     cheltuieli  250.000 lei                                          │
│     profit       70.000 lei  +22% marja                              │
│                                                                      │
│   Recruitment                                                        │
│     venituri     80.000 lei                                          │
│     cheltuieli   60.000 lei                                          │
│     profit       20.000 lei  +25% marja                              │
│                                                                      │
│   Coworking                                                          │
│     venituri     40.000 lei                                          │
│     cheltuieli   35.000 lei                                          │
│     profit        5.000 lei  +12% marja                              │
│                                                                      │
│   Toata firma                                                        │
│     venituri     20.000 lei  (alte venituri necategorisite)          │
│     cheltuieli   18.000 lei  (comisioane, taxe, software comun)      │
│     profit        2.000 lei                                          │
└──────────────────────────────────────────────────────────────────────┘

Top cheltuieli ale lunii
  1. NOLICH SRL                      23.451 lei  (Outsourcing)
  2. Salarii decembrie               18.000 lei  (Outsourcing 70%, Recr. 30%)
  3. MONT BLANC INDUSTRI              5.300 lei  (Outsourcing)
  4. Chirie Eminescu 1                6.000 lei  (Coworking 60%, Outs. 40%)
  ...
```

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

```
Verticale:
  • Sala (in-house dining)
  • Catering (livrari corporate)
  • Delivery (online retail)
  • Toata firma (implicit)

Splituri tipice:
  • 641 Salarii bucatari       → 60% Sala, 30% Catering, 10% Delivery
  • 605 Electricitate           → 70% Sala, 20% Catering, 10% Delivery
  • 624 Transport               → 100% Delivery
```

### Firma de constructii cu 2 proiecte mari

```
Verticale:
  • Proiect Bucuresti
  • Proiect Cluj
  • Service (mentenanta)
  • Toata firma (implicit)

Strategia:
  • Materiale (cont 3xx via 605) → cont analitic pe proiect, alocare 100%
  • Manopera (641) → split lunar pe ponderea timpilor pontati
  • Echipa de management (645) → ramane pe "Toata firma"
```

### SaaS cu 2 produse

```
Verticale:
  • Produs A
  • Produs B
  • Consultanta
  • Toata firma (implicit)

Strategia:
  • Servere AWS (628.AWS-A si 628.AWS-B) → mapping individual 100% pe fiecare produs
  • Salarii echipa core (641 fara analitic dedicat) → ramane pe "Toata firma"
  • Salarii dev specifice → conturi analitice dedicate (641.PRODA, 641.PRODB) cu mapping 100%
```

---

*Vezi si: [Categorii (axa A)](/docs/cashflow-categorii), [Verticale (axa B)](/docs/cashflow-verticale)*
