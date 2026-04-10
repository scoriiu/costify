# Calculul CPP

Acest articol descrie algoritmul prin care Costify construieste **Contul Profit si Pierdere** (CPP) pornind de la balanta de verificare. Spre deosebire de balanta — care este o sinteza orientata pe **conturi** — CPP-ul este o sinteza orientata pe **rezultat**: cat ai castigat, cat ai cheltuit, ce profit/pierdere a iesit la final.

## Contextul

CPP-ul este unul dintre cele doua rapoarte financiare obligatorii in Romania (al doilea fiind bilantul). Structura lui este standardizata prin OMFP 1802 si arata, in mare:

```
VENITURI DIN EXPLOATARE
  - vanzari de marfuri
  - vanzari de produse
  - prestari servicii
  - alte venituri din exploatare

CHELTUIELI DIN EXPLOATARE
  - costul marfurilor
  - cheltuieli cu salariile
  - cheltuieli cu utilitatile
  - amortizari
  - alte cheltuieli

REZULTAT DIN EXPLOATARE = venituri - cheltuieli

VENITURI FINANCIARE
  - dobanzi incasate
  - diferente de curs valutar pozitive

CHELTUIELI FINANCIARE
  - dobanzi platite
  - diferente de curs valutar negative

REZULTAT FINANCIAR = venituri - cheltuieli

REZULTAT BRUT = rezultat exploatare + rezultat financiar

IMPOZIT PE PROFIT (sau impozit micro)

REZULTAT NET = rezultat brut - impozit
```

In Costify, CPP-ul este calculat **pe baza balantei**, nu direct din jurnal. Asta inseamna:
1. Mai intai calculam balanta pentru perioada
2. Apoi grupam randurile balantei pe sectiunile CPP

Calculul este pure (fara DB calls la rulare) si deterministic.

## Semnatura functiei

```typescript
function computeCpp(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>
): CppData
```

**Input**:
- `rows` — randurile balantei deja calculate
- `catalog` — catalogul OMFP 1802 (optional; daca nu e dat, e incarcat sincron din `seeds/omfp-1802.json`)

**Output**:
```typescript
interface CppData {
  lines: CppLine[];           // toate liniile pentru afisare
  venituriExploatare: number;
  cheltuieliExploatare: number;
  rezultatExploatare: number;
  venituriFinanciare: number;
  cheltuieliFinanciare: number;
  rezultatFinanciar: number;
  rezultatBrut: number;
  rezultatNet: number;
}
```

## Algoritmul pas cu pas

### Pas 1: Filtrare leaf-only

```typescript
const leafRows = rows.filter((r) => r.isLeaf);
```

CPP-ul se construieste **doar din conturile frunza**. Daca am inlcude si conturile parinte, am dubla sumele (parintele e suma copiilor). De aceea filtram strict pe `isLeaf=true`.

### Pas 2: Grupare pe sectiuni CPP

Pentru fiecare rand din balanta, ne uitam in `AccountCatalog` la `cppGroup`. Catalogul are 4 valori posibile:

- `VENITURI_EXPLOATARE`
- `CHELTUIELI_EXPLOATARE`
- `VENITURI_FINANCIARE`
- `CHELTUIELI_FINANCIARE`

Daca un cont are `cppGroup` setat, il punem in bucket-ul corespunzator. Daca nu (ex: contul 5121 — conturi de banca), il ignoram pentru CPP.

```typescript
for (const row of leafRows) {
  if (row.contBase === "121") continue; // pl_closing — exclus
  const meta = resolveCatalogForRow(row, catalog);
  if (!meta || !meta.cppGroup) continue;
  if (meta.special === "profit_tax" || meta.special === "micro_tax") continue;

  const side = DEBIT_SIDE_GROUPS.has(meta.cppGroup) ? row.rulajTD : row.rulajTC;
  if (side === 0) continue;

  buckets[meta.cppGroup].add({ code: meta.code, label: meta.cppLabel ?? meta.name, value: side });
}
```

### Pas 3: Alegerea coloanei (debit vs credit)

Aici e o subtilitate importanta:

- **Conturile de venituri (clasa 7)** sunt de tip **P** (pasiv): cresc pe credit. Citim `rulajTC` (rulajul total credit cumulat).
- **Conturile de cheltuieli (clasa 6)** sunt de tip **A** (activ): cresc pe debit. Citim `rulajTD`.

`DEBIT_SIDE_GROUPS = {CHELTUIELI_EXPLOATARE, CHELTUIELI_FINANCIARE}` ne spune ce side sa luam.

### Pas 4: Excluderea conturilor speciale

Cateva conturi necesita tratament aparte si sunt marcate cu `special` in catalog:

- **121 (pl_closing)** — contul de profit/pierdere. Nu intra in CPP, altfel am dubla calculul.
- **691 (profit_tax)** — impozit pe profit. Nu intra in cheltuieli operationale, apare separat dupa rezultatul brut.
- **698 (micro_tax)** — impozit microintreprindere. Acelasi tratament ca 691.
- **129 (profit_distribution)** — repartizarea profitului. Nu intra in CPP.

### Pas 5: Construirea sectiunilor

Pentru fiecare sectiune (4 in total), iteram prin bucket si construim linii:

```typescript
function buildSection(bucket, lines, group) {
  lines.push({ denumire: SECTION_HEADERS[group], isHeader: true, value: 0 });

  let total = 0;
  const sorted = [...bucket.values()].sort((a, b) => a.code.localeCompare(b.code));

  for (const item of sorted) {
    lines.push({ cont: item.code, denumire: item.label, value: round2(item.value), indent: 1 });
    total += item.value;
  }

  lines.push(totalLine(`Total ${SECTION_HEADERS[group].toLowerCase()}`, round2(total)));
  return total;
}
```

Rezultatul: pentru fiecare sectiune avem un header, lista randurilor sortate alfabetic pe cod, si un total la sfarsit.

### Pas 6: Calculul rezultatelor intermediare

```typescript
const rezultatExploatare = venituriExploatare - cheltuieliExploatare;
const rezultatFinanciar = venituriFinanciare - cheltuieliFinanciare;
const rezultatBrut = rezultatExploatare + rezultatFinanciar;
```

Daca `rezultatBrut > 0` → profit. Daca < 0 → pierdere.

### Pas 7: Impozitul pe profit

```typescript
function sumProfitTax(rows, catalog) {
  let total = 0;
  for (const row of rows) {
    const meta = catalog.get(row.contBase);
    if (!meta) continue;
    if (meta.special !== "profit_tax" && meta.special !== "micro_tax") continue;
    total += row.rulajTD;
  }
  return round2(total);
}
```

Iteram prin randuri, gasim conturile cu `special: profit_tax` sau `micro_tax`, si insumam debitul cumulat. Daca clientul e microintreprindere, va aparea 698 in loc de 691 — algoritmul le trateaza identic.

### Pas 8: Rezultatul net

```typescript
const rezultatNet = rezultatBrut - impozitProfit;
```

Acesta este profitul (sau pierderea) final, dupa impozit. Este cifra care se distribuie sau se reporteaza in anul urmator.

## De ce e abordarea catalog-driven mai buna decat hardcoded prefixes

Versiunea anterioara a algoritmului avea **liste hardcodate de prefixe** in cod:

```typescript
const VENITURI_EXPLOATARE_PREFIXES = ["701", "702", "703", "704", "707", "708", "711", "754", "758"];
const CHELTUIELI_EXPLOATARE_PREFIXES = ["601", "602", "603", "604", "605", "611", "612", "613", "614", "624", "625", "626", "627", "628", "641", "642", "645", "646", "647", "658", "681"];
// ...
```

Probleme cu aceasta abordare:
1. **Conturi noi cad silentios** — daca apare contul `6588` in jurnal, dar nu e in lista, e ignorat.
2. **Modificari OMFP** necesita deploy de cod, nu doar update de seed.
3. **Diferente intre clienti** — nu poti avea grupari custom per client.

Versiunea catalog-driven:
1. **Conturi noi sunt automate** — adaugi in `seeds/omfp-1802.json` cu `cppGroup` setat, si CPP-ul le include la urmatorul deploy.
2. **Sursa unica de adevar** — catalogul este in DB, accesibil si din UI si din Costi AI.
3. **Extensibil per client** in viitor — putem adauga override-uri in `ClientAccount` cu `cppGroup` custom.

## Performanta masurata

Pe Hetzner ARM (cax21):

| Conturi unice in balanta | Calcul CPP |
|---|---|
| 50 | <2ms |
| 200 | ~5ms |
| 500 | ~12ms |

Practic instant. Bottleneck-ul ramane calculul balantei, nu CPP-ul.

## Testarea

CPP-ul este testat in `tests/unit/modules/reporting/cpp.test.ts` cu 8 cazuri:
1. P&L de baza cu venituri si cheltuieli
2. Doar exploatare (fara financiar)
3. Doar financiar
4. Pierdere (cheltuieli > venituri)
5. Cu impozit pe profit
6. Cu impozit micro
7. Excluderea contului 121
8. CPP gol (fara venituri, fara cheltuieli)

Plus testele de regresie pe datele reale ale contabilei pentru 4Walls Kronis si QHM21 Network — 323 verificari per perioada, toate passing.

## Limitari curente

1. **Versiune simplificata** — afisam un cont per linie. CPP-ul oficial OMFP are sub-grupari (a, b, c) si referinte la randurile din formularul de bilant. Pentru declaratii ANAF, ar trebui un export separat care reconstituie formatul oficial.

2. **Fara comparativ an precedent** — CPP-ul oficial cere coloana cu valorile anului anterior pentru comparatie. Costify afiseaza doar perioada curenta. Easy fix in viitor.

3. **Fara gruparea pe sub-categorii** — toate cheltuielile de exploatare sunt intr-o singura lista. CPP-ul OMFP le grupeaza pe: cheltuieli materii prime, salarii, amortizari, alte cheltuieli. Catalogul are deja informatia necesara, ar fi nevoie doar de un nivel suplimentar de grupare.

## Urmatori pasi

- [Maparea conturilor](./maparea-conturilor.md) — sursa de adevar pentru CPP
- [Calculul balantei](./calcul-balanta.md) — input-ul direct al CPP
- [Intelege KPI-urile](./intelege-kpi.md) — KPI-urile complementare CPP-ului
