# Cashflow pentru contabil

Ghid practic. Daca esti contabil, citesti documentul asta de la cap la coada o singura data, apoi te intorci pentru sectiunile care te intereseaza in workflow lunar.

---

## In 60 de secunde — setup pentru o firma noua

1. **Upload jurnal Saga C** (tab Registru Jurnal → Incarca XLSX). Sistemul parseaza, dedupliceaza si scrie in baza de date.
2. **Verifica balanta** (tab Balanta de Verificare) — daca este balansata si nu ai conturi nemapate suspecte, esti pe drumul cel bun.
3. **Mergi pe tab Mapari Cashflow** — la prima vizita, sistemul creeaza automat 10 categorii cheltuieli + 6 categorii venituri OMFP standard, plus maparile lor catre conturile 6x/7x.
4. **Publica luna** (Balanta → bara de sus → Publica). Antreprenorul vede `/firma` cu cifrele cum sunt acum.

**Atat. Firma e configurata.** Pentru majoritatea cazurilor (firma cu o singura linie de business), nu ai mai mult de facut.

---

## Workflow lunar

La final de luna, dupa ce ai introdus toate documentele in Saga si ai exportat jurnalul actualizat:

1. Tab Registru Jurnal → Incarca XLSX. Vezi cate intrari noi se adauga.
2. Tab Mapari Cashflow → daca exista conturi noi neclasificate, ele apar ca "Nemapate" (badge rosu). Aloca-le rapid la categoriile potrivite.
3. Tab Balanta de Verificare → selecteaza luna pe care vrei sa o publici → click "Publica luna".

Antreprenorul primeste imediat noul snapshot pe `/firma`. Tu vezi ce data si ce versiune a publicat (audit).

---

## Cele 3 pasi din tab-ul Mapari Cashflow

Tab-ul Mapari Cashflow este structurat ca un flow ghidat de sus in jos: **Etichete patron** → **Verticale** → **Mapeaza conturile**. Fiecare pas are un rol clar.

### Pasul 1 — Etichete patron (optional, colapsat default)

Aici stabilesti **cum se numesc** pe pagina `/firma` grupurile de cheltuieli si venituri.

**Defaults OMFP** vin precompletate la prima vizita:
- Cheltuieli: *Salarii si contributii*, *Servicii externe*, *Electricitate, apa, intretinere*, *Marfa*, *Taxe si impozite*, ...
- Venituri: *Vanzari (cifra de afaceri)*, *Subventii*, *Venituri financiare*, ...

Pentru 95% din firme **nu trebuie sa modifici nimic aici**. Pasul este colapsat default si arata un sumar.

**Cand iti deschizi pasul 1:**
- Patronul te suna si zice "vreau sa vad Marketing online separat de Servicii externe" → adaugi categoria *Marketing online*, apoi in Pasul 3 mapezi conturile potrivite acolo.
- Patronul nu intelege "diferente curs" → redenumesti categoria 65 in *Comisioane si curs valutar* sau ce suna mai natural.
- Vrei sa decompui o categorie mare: sub *Salarii*, creezi sub-categorii *Salarii brut* + *Bonus* + *Contributii*. Acestea apar indentate pe `/firma`.

Citeste [Categorii (axa A)](/docs/cashflow-categorii) pentru detalii.

### Pasul 2 — Verticale (optional)

Daca firma are **mai multe linii de business** pe care patronul vrea sa le vada separat, activezi verticalele.

**Cand activezi:**
- QHM21 NETWORK SRL face outsourcing IT + recruitment + coworking → 3 verticale.
- O firma de constructii lucreaza simultan pe Proiect Bucuresti si Proiect Cluj → 2 verticale.
- Un restaurant are Sala + Catering + Delivery → 3 verticale.

**Cand NU activezi:**
- Firma are o singura linie de business (cea mai comuna situatie). Lasa pasul 2 dezactivat.
- Firma are 2 linii dar patronul nu cere sa vada cifrele separat. Lasa dezactivat — il poti activa oricand fara consecinte.

La activare, completezi numele celor 1-3 verticale initiale intr-un modal. Sistemul creeaza automat si o verticala implicita "Toata firma" ca fallback pentru conturi nealocate.

Citeste [Verticale (axa B)](/docs/cashflow-verticale) pentru detalii.

### Pasul 3 — Mapeaza conturile (obligatoriu)

Aici e treaba reala. Lista conturilor 6x/7x din jurnalul firmei, sortata descrescator dupa rulaj. Pentru fiecare cont, ai doua dropdown-uri:

- **Categorie** (axa A): la ce eticheta patron-friendly merge contul.
- **Verticala** (axa B, doar daca ai activat la pasul 2): la ce linie de business merge.

Defaults OMFP sunt deja aplicate (de exemplu *641 Salarii* este mapat automat la categoria *Salarii si contributii*). Treaba ta este sa:

- **Verifici conturile mari** (cele cu rulaj > 5.000 lei). Sunt corect mapate la categoria patron asteapta?
- **Aloci verticalele** daca ai activat (vezi mai jos).
- **Curati conturile nemapate** (badge rosu) — pot fi conturi noi adaugate de tine in Saga sau coduri rare nepriza in defaults.

#### Mapping pe analitic vs contBase

Default toate conturile cu acelasi cont de baza (de exemplu 628.01, 628.02, 628.03) primesc aceeasi mapare. Daca vrei ca *628.01 NOLICH* sa fie *Outsourcing IT* iar restul 628.xx sa ramana *Servicii externe*, comuta butonul "din baza / individual" pe analitic.

#### Split-uri pe verticale

Daca un cont (de exemplu Electricitate pe sediu comun) acopera mai multe linii de business in proportii diferite:

1. Click pe dropdown-ul verticalei → "Impartit intre mai multe verticale..."
2. Modal: alege 2-5 verticale + procente. Total = 100.
3. Save. Sistemul calculeaza fiecare split automat la publish.

---

## Cum se vede pe `/firma`

Dupa ce ai mapat conturile si publici luna, antreprenorul vede:

```
/firma  (ce vede patronul)
┌──────────────────────────────────────────────────────────────────┐
│ QHM21 NETWORK SRL — aprilie 2026                                 │
│ Date publicate: aprilie 2026 · de tine, pe 20 mai                │
├──────────────────────────────────────────────────────────────────┤
│ KPI cards: Bani in cont · De primit · De platit · Profit         │
│                                                                  │
│ Unde s-au dus banii (luna aprilie)                              │
│   Salarii si contributii      45.000 lei  ████████████          │
│   Servicii externe            23.000 lei  ███████              │
│   Electricitate, apa           8.000 lei  ███                   │
│   ...                                                            │
│                                                                  │
│ Top cheltuieli ale lunii                                         │
│   1. NOLICH SRL              23.451 lei                          │
│   ...                                                            │
│                                                                  │
│ Pe linii de business    ← (doar daca ai verticale activate)     │
│   Outsourcing:  venituri 320k · chelt. 250k · profit  70k        │
│   Recruitment:  venituri  80k · chelt.  60k · profit  20k        │
│   Coworking:    venituri  40k · chelt.  35k · profit   5k        │
└──────────────────────────────────────────────────────────────────┘
```

Limbajul este de antreprenor, **nu apar coduri OMFP nicaieri** (D7).

---

## Cazuri speciale

### Corectie istorica (greseala intr-o luna trecuta)

Tab Setari → Pericol → Sterge intrari de la {data}. Confirmare "STERGE" manual. Apoi upload jurnal corectat.

Conturile mapate raman intacte. Republicii lunile afectate.

### Cont nou care apare in jurnal

La urmatorul import, daca exista un cont 6x/7x nou (de exemplu 6588 Despagubiri), apare automat in Pasul 3 ca "Nemapat". Tu il aloci la o categorie existenta sau creezi una noua.

Conturile ne-clasa-6/7 (de exemplu 4xx parteneri, 5xx trezorerie) NU apar aici. Ele se gestioneaza in tab-ul Plan de Conturi.

### Vrei sa testezi cum vede patronul

Buton "Vezi ca firma" sus in pagina clientului. Deschide tab nou `/firma?as={clientId}`. Tu vezi EXACT ce vede el. Aceasta vizualizare este audit-uita ca preview de contabil.

### Override pe partener (de exemplu NOLICH la verticala specifica)

NU exista mapping direct pe partener in MVP-ul curent. Solutie: creezi cont analitic dedicat (de exemplu 628.NOLICH in Saga), apoi in Pasul 3 setezi mapping individual pe acel analitic.

---

## Best practices

- **Nu confunda Categorii cu Verticale.** Categoria = NATURA cheltuielii (electricitate, salarii). Verticala = LINIA de business (outsourcing, recruitment).
- **Lasa OMFP defaults daca nu ai motiv specific sa le schimbi.** Personalizeaza doar daca patronul cere ceva concret.
- **Verifica conturile mari intai.** Daca rulajul lunii are 80% in top 10 conturi, asigura-te ca acelea sunt perfect mapate. Restul sunt zgomot.
- **Publica regulat.** Un patron care vede luna trecuta acum o saptamana se simte la curent. Un patron care vede luna trecuta acum 3 saptamani se intreaba "ce face contabilul meu".

---

*Vezi si: [Ghid pentru antreprenor](/docs/cashflow-pentru-antreprenor), [Exemplu QHM21](/docs/cashflow-exemplu-qhm21)*
