# Calculul balantei de verificare

Acest articol descrie **algoritmul** prin care Costify transforma jurnalul (date brute) in balanta (date agregate). Este o functie pura, deterministica, bazata pe principiile OMFP 1802.

## Contextul

Balanta de verificare este **sinteza** intregului jurnal contabil. Pentru fiecare cont din planul de conturi, ea arata:
- **Cat s-a debitat cumulativ** (rulaj total debit)
- **Cat s-a creditat cumulativ** (rulaj total credit)
- **Soldul initial** (la inceputul perioadei)
- **Soldul final** (la sfarsitul perioadei)

In Costify, balanta este **calculata la cerere** din jurnal — nu exista date pre-stocate. Vezi [Principiul jurnal-centric](./principiul-jurnal-centric.md) pentru motivatie.

## Semnatura functiei

```typescript
function computeBalanceFromJournal(
  entries: JournalEntry[],
  year: number,
  month: number,
  accountNames?: Map<string, string>
): BalanceRowView[]
```

**Input**:
- `entries` — toate intrarile din jurnalul clientului (cele active, `deletedAt = null`)
- `year`, `month` — perioada pentru care calculam (ex: decembrie 2025)
- `accountNames` — mapari optionale pentru conturile analitice extrase din XLSX

**Output**: lista de randuri, fiecare reprezentand un cont cu toate coloanele balantei.

**Pure function**: nu acceseaza DB, nu face network calls, nu modifica nimic. Ii dai input, returneaza output. Aceasta caracteristica face algoritmul usor de testat si reutilizat.

## Structura unui rand

```typescript
interface BalanceRowData {
  cont: string;              // "401.00023"
  contBase: string;          // "401"
  denumire: string;          // "Orange Romania" sau "Furnizori"
  tip: "A" | "P" | "B";      // tip cont

  debInit: number;           // debit cumulat la 1 ian an curent
  credInit: number;          // credit cumulat la 1 ian an curent

  soldInD: number;           // sold debitor la inceput de luna
  soldInC: number;           // sold creditor la inceput de luna

  debPrec: number;           // debit cumulat pe lunile anterioare
  credPrec: number;          // credit cumulat pe lunile anterioare

  rulajD: number;            // debit luna curenta
  rulajC: number;            // credit luna curenta

  rulajTD: number;           // debit cumulat anul curent
  rulajTC: number;           // credit cumulat anul curent

  totalDeb: number;          // debInit + rulajTD
  totalCred: number;         // credInit + rulajTC

  finD: number;              // sold final debitor
  finC: number;              // sold final creditor
}
```

14 coloane monetare per cont. Pare mult, dar fiecare are rol specific pentru citirea balantei.

## Algoritmul pas cu pas

### Pas 1: Calculul soldurilor initiale (1 ianuarie anul selectat)

**Obiectivul**: cate solduri au avut conturile la inceputul anului curent?

**Logica**: iteram prin toate intrarile **inainte de anul selectat**. Pentru fiecare:
- Debit pe contul D → adaugam la `debCumulativ[contD]`
- Credit pe contul C → adaugam la `credCumulativ[contC]`

La final, pentru fiecare cont stim suma totala debitata si creditata **inainte de 1 ianuarie al anului selectat**.

**Inchiderea de an (critica)**: la sfarsitul fiecarui an, conturile 6xx (cheltuieli) si 7xx (venituri) se inchid in contul 121 (profit si pierdere). Asta inseamna ca:

- Cheltuielile cumulate ale anului 2023 → devin parte din rezultatul 2023 → se transfera in 121
- Veniturile cumulate ale anului 2023 → devin parte din rezultatul 2023 → se transfera in 121
- Dupa inchidere, conturile 6xx si 7xx sunt ZERO pentru inceputul anului 2024

In algoritm, asta se traduce prin:

```typescript
function computeOpeningBalances(entries, targetYear) {
  const before = entries.filter(e => e.year < targetYear);

  // Agregam pe ani si conturi
  const perYearPerAccount = groupByYearAccount(before);

  // Pentru fiecare an incheiat, calculam rezultatul si inchidem 6xx/7xx
  const results = new Map();
  const yearsBefore = [...new Set(before.map(e => e.year))].sort();

  for (const year of yearsBefore) {
    const yearData = perYearPerAccount.get(year);

    // Inchidere 7xx in 121 (toate veniturile devin profit)
    // Inchidere 6xx in 121 (toate cheltuielile devin profit negativ)
    closeYear(yearData, results);
  }

  return results;  // { "401": { debit: X, credit: Y }, "5121": { ... } }
}
```

**Rezultatul**: un `Map<cont, {debit, credit}>` cu soldurile cumulate la 1 ianuarie `targetYear`.

### Pas 2: Calculul rulajelor pe anul curent

Dupa ce avem soldurile initiale, iteram prin intrarile **din anul selectat**. Pentru fiecare:

- Daca e **in luna selectata** → adaugam la `rulajD/C` (rulajul lunii curente)
- Daca e **inainte de luna selectata** (dar din anul curent) → adaugam la `rulajPrec D/C`
- **Intotdeauna**, adaugam la `rulajT D/C` (rulajul total al anului)

```typescript
for (const e of entries.filter(e => e.year === targetYear)) {
  const debAgg = aggregate[e.contD];
  const credAgg = aggregate[e.contC];

  // Rulaj total (mereu)
  debAgg.rulajtD += e.suma;
  credAgg.rulajtC += e.suma;

  // Rulaj lunii curente (doar daca e in luna selectata)
  if (e.month === targetMonth) {
    debAgg.rulajD += e.suma;
    credAgg.rulajC += e.suma;
  }
}
```

**Rezultatul**: pentru fiecare cont, 4 sume: `rulajD`, `rulajC`, `rulajTD`, `rulajTC`.

### Pas 3: Constructia randurilor de balanta

Cu soldurile initiale si rulajele calculate, construim randurile finale:

```typescript
for (const [cont, agg] of aggregates) {
  const debInit = Math.max(agg.cumDBefore - agg.cumCBefore, 0);
  const credInit = Math.max(agg.cumCBefore - agg.cumDBefore, 0);

  // Rulaj precedent = rulaj total - rulaj luna curenta
  const debPrec = agg.rulajtD - agg.rulajD;
  const credPrec = agg.rulajtC - agg.rulajC;

  // Sold la inceput de luna (inainte de rulajele lunii)
  const soldInD = Math.max(debInit + debPrec - (credInit + credPrec), 0);
  const soldInC = Math.max(credInit + credPrec - (debInit + debPrec), 0);

  // Totaluri
  const totalDeb = debInit + agg.rulajtD;
  const totalCred = credInit + agg.rulajtC;

  // Sold final
  const finD = Math.max(totalDeb - totalCred, 0);
  const finC = Math.max(totalCred - totalDeb, 0);

  rows.push({
    cont,
    contBase: getContBase(cont),
    denumire: accountNames?.get(cont) ?? getAccountName(getContBase(cont)),
    tip: getAccountType(getContBase(cont)),
    debInit, credInit, soldInD, soldInC,
    debPrec, credPrec, rulajD, rulajC,
    rulajTD, rulajTC, totalDeb, totalCred, finD, finC,
  });
}
```

### Pas 4: Excluderea P&L pentru balanta curenta

Exista o subtilitate: in balanta curenta (pentru anul curent), **conturile 6xx si 7xx NU au solduri initiale** — pentru ca au fost inchise la sfarsitul anului anterior.

Algoritmul verifica: daca este cont din clasa 6 sau 7, sarim peste soldurile initiale. Restul anilor tot se pastreaza in 121 (ca sold initial).

```typescript
function computeOpeningBalances(entries, targetYear) {
  // ... cumulare pe ani ...

  for (const year of yearsBefore) {
    for (const cont of yearData.accounts) {
      if (!isPnlAccount(cont)) continue;  // clasa 6 sau 7

      // P&L: transfer in 121
      const netPnl = yearData.credits[cont] - yearData.debits[cont];
      results.set("121", { ... });  // adaugam in 121

      // NU adaugam in yearData.accounts (raman zero la inceput de an nou)
    }
  }
}
```

### Pas 5: Leaf vs parent accounts

Balanta afiseaza atat **conturi frunza** (leaf — fara sub-conturi) cat si **conturi parinte** (cu sub-conturi agregate).

Pentru a detecta asta, folosim o sortare alfabetica si cautare binara:

```typescript
function computeLeafFlags(rows) {
  const conts = rows.map(r => r.cont).sort();
  const parentSet = new Set();

  for (let i = 0; i < conts.length; i++) {
    const prefix = conts[i] + ".";
    // Cautare binara pentru primul cont care incepe cu prefix
    let lo = i + 1;
    let hi = conts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (conts[mid] < prefix) lo = mid + 1;
      else hi = mid - 1;
    }
    if (lo < conts.length && conts[lo].startsWith(prefix)) {
      parentSet.add(conts[i]);
    }
  }

  return rows.map(r => ({
    ...r,
    isLeaf: !parentSet.has(r.cont),
    hasChild: parentSet.has(r.cont),
  }));
}
```

**Rezultatul**: fiecare rand stie daca e leaf sau parent. UI-ul foloseste aceasta informatie pentru toggle-ul "Analitice / Toate".

## Optimizari

### Indexuri in DB

Query-ul initial `SELECT * FROM journal_line WHERE clientId = ? AND deletedAt IS NULL` beneficiaza de index `[clientId, deletedAt]`. Pentru 100.000 intrari, query-ul ia <50ms.

### Maps in loc de Objects

Folosim `Map<string, AccountAgg>` in loc de `{}` pentru agregate. Map-urile JS sunt mai rapide pentru insertii si iteratii repetate.

### Calcul single-pass

Iteram prin intrari **o singura data** per etapa. Nu avem loop-uri imbricate peste intrari — totul se face in O(n) unde n = numarul de intrari.

### Skip rulaje pentru luni irelevante

In etapa de agregare, comparam month cu targetMonth inainte de adaugare. Evitam calculul pentru luni care nu ne intereseaza.

## Testarea

Algoritmul este testat cu:

1. **Unit tests** — cazuri izolate pentru fiecare aspect (solduri initiale, rulaje, inchidere de an, leaf detection)
2. **Integration tests** — cazuri complete cu date sintetice
3. **Real-world verification** — comparam output-ul cu rapoartele reale de la contabil pentru clientii 4Walls Kronis si QHM21 Network

Rezultate curente:
- **4Walls Kronis**: 79 checks, 79 passed
- **QHM21 Network**: 244 checks, 242 passed (2 diferente cunoscute pe conturile 121 si 421)

Pentru diferentele cunoscute, vezi [Intrebari contabil](./intrebari-contabil-plan-conturi.md).

## Performanta masurata

Pe server Hetzner ARM (cax21, 4 core, 8GB RAM):

| Volum intrari | Query DB | Calcul balanta | Total |
|---|---|---|---|
| 1.000 | ~10ms | ~5ms | ~15ms |
| 10.000 | ~30ms | ~30ms | ~60ms |
| 50.000 | ~80ms | ~150ms | ~230ms |
| 100.000 | ~150ms | ~350ms | ~500ms |

Pentru clienti tipici (1.000-10.000 intrari/an), calculul e sub 100ms — simtit ca instant de user.

## Limitari

1. **In-memory calculation** — tot jurnalul trebuie sa incapa in memoria Node.js. Pentru clienti extrem de mari (>500.000 intrari), ar trebui streaming.

2. **Fara cache** — fiecare cerere recalculeaza. Daca 50 useri deschid balanta simultan pentru acelasi client, calculam de 50 ori. Pentru scale viitor, vom adauga cache pe an (anii incheiati nu se schimba niciodata).

3. **Nu suporta multi-currency** — deocamdata totul e in RON. Daca intrarile au valute, conversia trebuie facuta in Saga inainte de export.

## Urmatori pasi

- [Calculul CPP](./calcul-cpp.md) — cum construim CPP-ul din balanta
- [Maparea conturilor](./maparea-conturilor.md) — cum se rezolva numele conturilor (TBD)
- [Principiul jurnal-centric](./principiul-jurnal-centric.md) — contextul arhitectural
