# Principiul jurnal-centric

Costify este construit pe un principiu fundamental: **registrul jurnal este unica sursa de adevar**. Tot ce afisam — balanta, CPP, KPI-uri, rapoarte — este calculat in timp real din jurnal. Nu exista rapoarte "inghetate" sau date pre-calculate care sa poata sa nu mai fie actuale.

## 1. Ce inseamna "jurnal-centric"

In contabilitatea traditionala si in majoritatea softurilor, datele curg asa:

```
Documente → Jurnal → Balanta (stocata) → CPP (stocat) → Rapoarte (stocate)
```

Fiecare etapa **stocheaza** rezultatul, iar cand ai nevoie de un raport il iei din stocare. Problema: daca jurnalul se schimba (corectie, stergere, adaugare), rapoartele **devin depasite** pana la o "recalculare" explicita.

In Costify, datele curg asa:

```
Documente → Jurnal (stocat)
                ↓
          In timp real, la fiecare cerere:
                ↓
           Balanta / CPP / KPI-uri
           (calculate din jurnal, nu stocate)
```

Cheia: **doar jurnalul este stocat**. Rapoartele sunt calculate **la fiecare cerere** cu functii pure — nu exista "cache" sau "snapshot" stocat.

## 2. De ce asa

### Consistenta garantata

Intr-un sistem cu date pre-calculate, ai risc de **inconsistente**:

- Balanta afiseaza sold 100.000 dar CPP arata venituri de 150.000 — datorita unei recalculari care nu a prins toate datele
- Raportul lunar din PDF arata cifre diferite decat ecranul app-ului pentru aceeasi perioada
- KPI-urile nu se actualizeaza dupa un import

Cu un sistem jurnal-centric, **ambele** rapoarte vin din acelasi calcul si acelasi set de date. Nu exista posibilitatea sa fie diferite.

### Debugging trivial

Intrebi: "de ce in Costify cifra e 247.318 si nu 245.000?"

Raspuns direct: "pentru ca aceste **N intrari concrete** din jurnal aduna asta". Poti merge de la raport la intrare fara bariere. Nu exista "magie" sau "reconciliere".

Intr-un sistem cu date pre-calculate, raspunsul ar fi "pentru ca asa a fost calculat ieri cand s-a rulat job-ul", iar pentru a verifica ar trebui sa re-rulezi calculul manual.

### Corectare istorica simpla

Daca descoperi o eroare in luna februarie 2024 si contabilul corecteaza in Saga:

**In sistem pre-calculat**:
1. Correcteaza in Saga
2. Trigger recalculare pentru februarie
3. Propagare la martie, aprilie, mai... pana la zi
4. Regenerare toate rapoartele pentru intreg intervalul
5. Invalida toate cache-urile
6. Deploy modificari
7. Verificare ca totul s-a actualizat

**In Costify**:
1. Contabilul corecteaza in Saga
2. Exporti jurnalul actualizat
3. "Sterge date istorice" de la februarie 2024
4. Reimport fisier
5. **Gata**. Orice raport deschis ulterior reflecta corectiile.

Niciun job, niciun cache, nicio invalidare manuala.

### Audit trail natural

Cand tot ce afisezi e calculat din jurnal, auditorii au o sarcina simpla:

- Iau un numar din raport (ex: "venituri exploatare 390.000 RON")
- Cer sa vada `WHERE year=2025 AND month<=12 AND contDBase='704' OR contCBase='704'`
- Vad fiecare intrare care a contribuit
- Pot verifica documentele justificative pentru fiecare

Fara pasi intermediari, fara "calcule care nu stim de unde vin".

### Scaling si refactoring usor

Daca decidem sa calculam CPP diferit (ex: dupa noua formulare OMFP), **schimbam doar functia de calcul**. Datele din jurnal sunt intacte. Nu trebuie sa re-rulam migratii, re-stocam snapshoturi, etc.

## 3. Cum functioneaza tehnic

### Stocare: doar jurnalul

In baza de date, avem tabela `JournalLine` care stocheaza toate intrarile. Fiecare linie contine:

- **Identitate**: `clientId`, `importEventId`
- **Momentul**: `data`, `year`, `month`
- **Operatia**: `contD` + `contDBase`, `contC` + `contCBase`, `suma`
- **Metadata**: `explicatie`, `ndp`, `felD`, `categorie`, `cod`, `validat`, `tva`
- **Control**: `dedupHash`, `deletedAt`

**Nicio alta tabela nu stocheaza calcule**. Fara `BalanceSnapshot`, fara `CppCache`, fara `KpiHistory`. Totul se calculeaza la fiecare cerere.

### Calcul la cerere

Cand userul deschide tab-ul Balanta:

```typescript
// Pseudo-cod
async function getBalanceForPeriod(clientId: string, year: number, month: number) {
  // 1. Fetch toate intrarile active (nu soft-deleted) pentru client
  const entries = await prisma.journalLine.findMany({
    where: { clientId, deletedAt: null },
  });

  // 2. Calcul balanta — pure function, niciun acces la DB
  const rows = computeBalanceFromJournal(entries, year, month);

  // 3. Calcul KPI-uri din balanta
  const kpis = computeKpis(rows);

  return { rows, kpis };
}
```

**Pasul 2 este o functie pura**: primeste intrarile si returneaza randurile. Nu are efecte secundare, nu acceseaza DB, nu foloseste retea.

Pentru un client tipic cu 10.000 intrari, intreg procesul dureaza **~100ms**.

### De ce e rapid

Fara cache, ar trebui sa fie lent, nu?

**Nu** — pentru ca:

1. **PostgreSQL e foarte rapid** la query-uri pe tabele indexate. `SELECT * FROM journal_line WHERE clientId = ? AND deletedAt IS NULL` cu index pe `[clientId, deletedAt]` returneaza in sub 50ms chiar pentru milioane de randuri.

2. **Pure functions sunt optimizate de JS engine** — calculul balantei e doar iteratii si sume, extrem de rapid in V8.

3. **Query-uri eficiente** — denormalizam `year` si `month` in tabela ca sa putem filtra rapid fara sa calculam din `data`.

4. **Nu exista overhead de recalculare** — fiecare calcul e nou, nu are "invalidare de cache" sau "refresh" sincron.

### Scaling

Pentru clienti cu volume foarte mari (>100.000 intrari), optimizari viitoare:

1. **Streaming query** — nu inacarcam tot in memorie, iteram cu cursors
2. **Partial cache** — cache-uim doar balanta pe ani incheiati (anul 2020 nu se schimba niciodata daca nu sterge cineva istoricul)
3. **Materialized views** — PostgreSQL poate calcula balanta ca view materializat, refreshed on demand
4. **Worker threads** — calculul in Node.js worker threads pentru a nu bloca event loop

Dar pentru clienti pana la ~50.000 intrari (majoritatea cazurilor), **nu e nevoie de nimic din toate astea**. Algoritmul naive este suficient de rapid.

## 4. Consecinte si trade-offs

### Avantaje

✅ **Consistenta 100%** intre rapoarte
✅ **Corectii instante** — un soft-delete + reimport si totul e la zi
✅ **Audit trail natural** — jurnalul este auditul
✅ **Debugging transparent** — niciun calcul "ascuns"
✅ **Refactoring usor** — schimbam calcul fara sa afectam date
✅ **Recuperare usoara** dupa erori — reimport si calcule se regenereaza

### Dezavantaje

❌ **Calcule repetate** — daca 100 useri deschid balanta, calculam de 100 ori. Vs: cu cache, calculam o data.
❌ **Sensibilitate la performanta** — daca calculul incetineste (client foarte mare), toti user-ii simt
❌ **Limitari naturale** — pentru agregari pe perioade foarte lungi (ex: 10 ani), calculul devine greu
❌ **Fara snapshot istoric** — nu poti spune "arata-mi balanta **asa cum era pe 15 martie 2023**" (in sens audit)

Aceste trade-offs sunt **acceptabile** pentru clientul nostru tinta (contabili cu firme de marime mica-medie). Daca ar deveni problematice, am adauga cache selectiv pe ani incheiati.

## 5. Exceptie: JournalPartner

Exista o singura exceptie de la principiul "doar jurnal in DB": tabela `JournalPartner`.

Ea stocheaza mapari intre conturi analitice si denumiri de parteneri (ex: `401.00023 → "Orange Romania"`). Este o forma de "cache" pentru ca:

1. Extragerea denumirii din explicatie este costisitoare (regex, parsing)
2. Rezultatul e stabil in timp (un cont nu isi schimba partenerul des)
3. Este util pentru afisare si pentru Costi AI

`JournalPartner` este **derivata** din jurnal, dar e pre-calculata la import pentru a fi rapida la afisare. Este singurul "cache" din sistem momentan.

In viitor, cand implementam **planul de conturi configurabil** (vezi [Maparea conturilor](./maparea-conturilor.md)), `JournalPartner` va fi consolidata intr-un model mai cuprinzator `ClientAccount`.

## 6. Compararea cu alte abordari

### Abordare: Event Sourcing + CQRS

Event sourcing stocheaza fiecare schimbare ca un eveniment imutabil, iar rapoartele sunt construite prin "rejucarea" evenimentelor.

**Costify folosind event sourcing?** Da, partial. `JournalLine` sunt efectiv evenimente imutabile (append-only + soft-delete). Diferenta e ca nu avem "projections" pre-calculate — calculam la cerere.

**De ce nu CQRS complet?** Pentru ca:
- Simplicitatea — nu avem nevoie de latenta foarte mica (< 10ms)
- Overhead-ul de mentinere a projections
- Numarul mic de "view-uri" (doar 3-4)

Daca scale-ul ar cere-o, am adauga projections pentru view-urile hot (ex: balanta anuala pre-calculata).

### Abordare: OLAP + data warehouse

Altii folosesc sisteme OLAP (data warehouse-uri) cu cube-uri multidimensionale pre-agregate.

**Costify nu are nevoie de asta** pentru ca:
- Volumul de date e mic (max cateva milioane de randuri per client)
- Rapoartele sunt simple (nu avem cube-uri N-dimensionale)
- Flexibilitatea e mai importanta decat performanta peak

### Abordare: traditional snapshot-based

Cei mai multi softuri de contabilitate fac snapshoturi lunare/anuale.

**Dezavantajele**:
- Inconsistente intre snapshot si jurnal
- Recalculari manuale la corectii
- Ambiguitate "cand a fost actualizat ultimul raport?"

**Costify evita asta** — nu exista snapshoturi, totul e calculat live.

## 7. Garantii

Principiul jurnal-centric ne permite sa oferim aceste garantii:

1. **Orice raport reflecta jurnalul curent** — nu e posibil sa vezi date depasite
2. **Consistenta intre rapoarte** — balanta, CPP si KPI sunt intotdeauna in acord
3. **Audit trail complet** — orice numar din orice raport poate fi trasat la documente sursa
4. **Corectare fara pierdere** — intrarile sterse raman in DB, auditul e pastrat
5. **Deduplicare matematica** — acelasi fisier importat de N ori = efect identic cu 1 import

Aceste garantii sunt **fundamentale pentru software financiar** si sunt foarte greu de obtinut cu arhitecturi alternative.

## Urmatori pasi

- [Calculul balantei](./calcul-balanta.md) — algoritmul pure function
- [Calculul CPP](./calcul-cpp.md) — structura OMFP 1802
- [Audit si trasabilitate](./audit-si-trasabilitate.md) — audit log-ul
