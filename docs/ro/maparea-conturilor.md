# Maparea conturilor

Cum stocheaza Costify planul de conturi: un catalog standard OMFP 1802 (comun tuturor clientilor) + un plan analitic per client (editabil). Acest document descrie arhitectura tinta si este folosit ca referinta in implementare.

## De ce este nevoie de refactorizare

Pana la aceasta iteratie, planul de conturi (~100 conturi OMFP 1802) si gruparile CPP (6xx/7xx pe sectiuni de venituri si cheltuieli) erau **scrise direct in cod TypeScript**. Asta cauza doua probleme reale:

1. **Conturi lipsa** — cand un client folosea un cont pe care noi nu il aveam in lista (ex: `6588`, `677`), acesta aparea in balanta ca "Cont 6588" cu triunghi galben, dar **nu intra in CPP**. Pica silentios din calcul, iar rezultatul net era gresit.
2. **Fara loc pentru denumiri analitice** — conturile analitice specifice clientului (ex: `401.00023 — Orange Romania`) nu aveau un loc in care sa fie editate si stocate permanent. Se extrageau doar din XLSX-ul Saga la fiecare import, fara editare manuala posibila.

Solutia este mutarea acestor date din cod in baza de date, cu doua tabele noi.

## Arhitectura in trei nivele

| Nivel | Denumire | Sursa | Continut | Folosit de |
|-------|----------|-------|----------|------------|
| **1** | AccountCatalog (read-only, global) | seeds/omfp-1802.json | Toate conturile sintetice OMFP (101, 401, 5121, etc.) | Toti clientii, tot timpul |
| **2** | ClientAccount (per client, editabil) | Import XLSX + editari manuale | Conturi analitice ale clientului (401.00023, 5121.BT, 411.ORANGE, etc.) | Acel client anume |
| **3** | Nemapat (computed la afisare) | Calculat automat | Orice cod care nu are nume nici in ClientAccount nici in AccountCatalog — marcat cu triunghi galben | Invitatie la clarificare |

Rezolvarea numelui parcurge nivelele de sus in jos: prima data cauta in ClientAccount (nivel 2), apoi in AccountCatalog (nivel 1), si daca nu gaseste nicaieri il marcheaza ca nemapat (nivel 3).

## Algoritmul de rezolvare a numelui

Cand trebuie afisat numele unui cont (in balanta, in jurnal, in CPP), logica este:

```
resolveAccountName(clientId, cont) {
  // 1. Nume custom per client (inclusiv analitic)
  const clientAcc = ClientAccount.find(clientId, cont)
  if (clientAcc) return clientAcc.customName

  // 2. Nume standard OMFP pentru contul de baza
  const base = getContBase(cont)  // "401.00023" -> "401"
  const catalog = AccountCatalog.find(base)
  if (catalog) return catalog.name

  // 3. Nemapat — afisare cu warning
  return { name: `Cont ${cont}`, unmapped: true }
}
```

Aceasta ordine garanteaza ca:
- Editarile manuale ale contabilului au prioritate maxima.
- Denumirile oficiale OMFP servesc drept fallback robust.
- Conturile care nu apar in niciuna dintre surse sunt evidentiate, nu ascunse.

## Schema bazei de date

```
model AccountCatalog {
  code        String   @id      // "401", "5121", "6811"
  name        String            // "Furnizori", "Conturi curente la banci in lei"
  type        String            // "A" | "P" | "B"
  classDigit  Int               // 1-9 (clasa OMFP)
  cppGroup    String?           // "venituri_exploatare", "cheltuieli_financiare", null
  cppLabel    String?           // "Venituri din chirii" (suprascrie name in CPP daca exista)
  special     String?           // "pl_closing" (121), "profit_tax" (691), "vat_*" etc
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ClientAccount {
  id          String   @id @default(cuid())
  clientId    String
  code        String            // "401.00023" sau "401" pentru override
  customName  String
  source      String            // "saga_import" | "user_edit"
  partnerCode String?           // cod extern partener (daca e cazul)
  firstSeenAt DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, code])
  @@index([clientId])
}
```

`AccountCatalog` nu are `tenantId` — este un set global, read-only, partajat de toti clientii platformei.

`ClientAccount` pastreaza **toate** conturile observate in jurnalul clientului, inclusiv cele sintetice, ca sa stim cand au fost vazute prima data si cand ultima data (util pentru "plan de conturi activ" in UI).

## Seed-ul OMFP 1802

Sursa de adevar pentru `AccountCatalog` este un fisier JSON versionat in repo:

```
seeds/omfp-1802.json
```

Structura:

```json
{
  "version": "OMFP 1802/2014 cu modificari pana in 2025",
  "accounts": [
    {
      "code": "101",
      "name": "Capital social",
      "type": "P",
      "classDigit": 1
    },
    {
      "code": "121",
      "name": "Profit si pierdere",
      "type": "B",
      "classDigit": 1,
      "special": "pl_closing"
    },
    {
      "code": "401",
      "name": "Furnizori",
      "type": "P",
      "classDigit": 4
    },
    {
      "code": "5121",
      "name": "Conturi curente la banci in lei",
      "type": "A",
      "classDigit": 5
    },
    {
      "code": "701",
      "name": "Venituri din vanzarea produselor finite",
      "type": "P",
      "classDigit": 7,
      "cppGroup": "venituri_exploatare",
      "cppLabel": "Vanzari de produse finite"
    },
    {
      "code": "601",
      "name": "Cheltuieli cu materiile prime",
      "type": "A",
      "classDigit": 6,
      "cppGroup": "cheltuieli_exploatare",
      "cppLabel": "Cheltuieli materii prime"
    },
    {
      "code": "691",
      "name": "Impozit pe profit",
      "type": "A",
      "classDigit": 6,
      "special": "profit_tax"
    }
  ]
}
```

Actualizarea seed-ului (cand ANAF publica modificari la OMFP) se face printr-un PR care re-ruleaza scriptul de seed. `AccountCatalog` este re-sincronizat automat.

## Fluxul la import

Cand contabilul incarca un XLSX Saga, parserul extrage deja un `Map<cont, denumire>` din coloanele `denumire_d` si `denumire_c`. Noul flux:

```
1. Parseaza XLSX → lista intrari + map denumiri
2. Pentru fiecare (cont, denumire) din map:
   a. Daca exista deja ClientAccount(clientId, cont) cu source="user_edit" →
      NU suprascrie (contabilul a editat manual).
   b. Altfel → upsert ClientAccount cu source="saga_import",
      actualizeaza lastSeenAt.
3. Salveaza intrarile in JournalLine (ca azi)
```

Asta inseamna ca **editarile manuale sunt sticky**: odata ce contabilul a rescris numele unui cont analitic, importurile viitoare nu il vor suprascrie. Daca vrea sa revina la numele din Saga, foloseste un buton "Reseteaza la nume din Saga".

## Detectarea conturilor nemapate

Un cont este "nemapat" daca:

1. Codul sau de baza (fara punct) **nu** exista in `AccountCatalog`.
2. Codul complet **nu** exista in `ClientAccount`.

In balanta si in jurnal, aceste conturi apar cu triunghi galben si tooltip "Cont nemapat — clic pentru a adauga denumirea". UI-ul va avea o sectiune dedicata "Conturi nemapate" in tabul Plan de Conturi, pentru clarificare rapida.

## Impactul asupra CPP

CPP-ul nu mai are prefixe hardcodate. In locul lor:

```
computeCpp(balanceRows, accountCatalog):
  for row in balanceRows:
    base = getContBase(row.cont)
    catalog = accountCatalog[base]
    if not catalog or not catalog.cppGroup: continue

    section = catalog.cppGroup          // "venituri_exploatare", etc
    label   = catalog.cppLabel || catalog.name
    sections[section].add(label, row.rulajTD/rulajTC)

  buildResultLines(sections)
```

Conturile noi care apar in `AccountCatalog` cu `cppGroup` setat vor fi automat incluse in CPP. Nu mai trebuie sa modificam codul.

## Conturi speciale

Cateva conturi au comportament particular care nu se incadreaza in "o grupare CPP simpla". Le marcam cu flagul `special` in `AccountCatalog`:

| Cod | Special | Semnificatie |
|-----|---------|--------------|
| 121 | `pl_closing` | Profit si pierdere — se exclude din CPP (evita dublul calcul la inchidere) |
| 129 | `profit_distribution` | Repartizarea profitului — sold debitor intr-un cont de pasiv |
| 691 | `profit_tax` | Impozit pe profit — apare separat in CPP, intre rezultat brut si rezultat net |
| 698 | `deferred_tax` | Impozit amanat — tratament specific IFRS |

Logica speciala este aplicata in `computeCpp` pe baza acestui flag, nu prin cod hardcodat.

## Migratie pentru clienti existenti

Pentru clientii cu date istorice (4Walls Kronis, QHM21 Network, Digital Nomads), rulam un script de migratie:

```
1. Pentru fiecare JournalLine existent:
   a. Extrage contD si contC
   b. Daca nu exista ClientAccount pentru acest cod, creeaza unul:
      - customName = numele din JournalPartner daca exista
      - customName = getAccountName(contBase) fallback OMFP
      - source = "saga_import"
2. Verifica ca toate testele (425) trec identic: aceleasi sume,
   acelasi numar de linii in balanta, aceleasi cifre in CPP.
3. Daca ceva difera, oprim migratia si investigam.
```

Migratia este **reversibila**: daca stergem tabelele `AccountCatalog` si `ClientAccount` si readucem vechiul cod, sistemul functioneaza identic. Sursa de adevar ramane jurnalul, nu planul de conturi.

## Ce se schimba in UI (viitor)

Tabul "Plan de Conturi" pe pagina clientului va avea:

- **Lista tuturor conturilor folosite** (sintetice + analitice)
- **Filtre**: Toate / Standard / Analitice / Nemapate / Cu sold / Folosite recent
- **Cautare** dupa cod sau denumire
- **Editare inline** a denumirii pentru conturile analitice
- **Buton "Reseteaza la Saga"** pentru conturile editate manual
- **Coloane**: Cod, Denumire, Tip (A/P/B), Sursa (OMFP/Saga/Editat), Sold curent, Ultima utilizare

Acest tab se implementeaza dupa ce infrastructura (baza de date + seed + rezolvare nume) este stabila.

---

## Intrebari deschise pentru contabil

Urmatoarele intrebari sunt inca in discutie. Raspunsurile lor vor finaliza detaliile implementarii. Pana cand obtinem raspunsuri, ne bazam pe propunerile de mai jos si pe OMFP 1802 ca sursa.

### 1. Sursa oficiala pentru planul OMFP
- Care este cea mai completa si actuala versiune oficiala a OMFP 1802 (cu modificarile pana in 2025) pe care sa o folosim?
- Exista un export oficial (PDF/Excel) la ANAF / CECCAR / MFP pe care sa il parsam?

**Propunere interimara**: Construim seed-ul manual pornind de la OMFP 1802/2014 + modificari, cu cross-check intr-un soft de contabilitate (Saga/Ciel).

### 2. Granularitatea "standard"
- Unde se termina "standard OMFP" si incepe "analitic client"? Propunere: tot ce are punct (`401.00023`) este analitic; tot ce nu are punct si e definit in OMFP este standard.
- Confirmi ca subconturile oficiale gen `4311`, `4315`, `44271` sunt standard (fara punct)?

### 3. Exceptiile la tipul de cont (A/P/B)
Regulile curente:
- Clasa 1: P (exceptie 129 = A)
- Clasa 2: A (exceptie 28x, 29x = P)
- Clasa 3: A (exceptie 39x = P)
- Clasa 4: B (toate bifunctionale)
- Clasa 5: A (exceptie 519 = P)
- Clasa 6: A (toate)
- Clasa 7: P (toate)
- Clasa 8: A

Intrebari:
- Lista de exceptii este completa?
- Conturile 121 si 129 — cum sunt tratate in balanta? (avem o mica diferenta pe QHM21 la cont 121)
- Conturile de regularizare (clasa 8) trebuie sa apara in balanta?

### 4. Conturi speciale care necesita flag
Cele identificate: 121, 129, 691, 698. Mai sunt altele care au comportament aparte si trebuie marcate?
- 4118 (clienti incerti) — la fel ca 4111?
- 408 (furnizori facturi nesosite) — la fel ca 401 pentru KPI datorii?
- 421, 425, 427, 431x, 444, 447 — salarizare, vreo regula specifica?

### 5. Denumirile oficiale — cu sau fara diacritice?
- Oficial, OMFP foloseste diacritice. In codul actual NU folosim diacritice (pentru cautare facila).
- Propunere: stocam **fara diacritice** in `AccountCatalog.name`, cu denumirea oficiala completa (nu prescurtata).
- Confirmi?

### 6. Lista completa de conturi CPP
Lista actuala include ~40 de prefixe. Ne lipsesc probabil multe. Conturi suspecte pe care sa le adaugam:
- Venituri: 702, 703, 705, 709, 712, 726, 728, 742-749, 751-757, 761-764, 771, 772, 776-778, 781, 786
- Cheltuieli: 606, 608, 629, 642-644, 647, 649, 651-653, 655-657, 659, 661-664, 667, 671, 674, 677, 678, 6813, 6814

Poti sa completezi lista cu toate conturile de venituri/cheltuieli OMFP si pentru fiecare sa indici grupa CPP (exploatare/financiar)?

### 7. Formatul CPP oficial
CPP-ul actual este "simplificat" (un cont per linie). CPP-ul oficial OMFP are sub-linii grupate (5a, 5b, 5c...).
- Reproducem formatul oficial cu grupari (recomandat pentru declaratii ANAF)?
- Sau ramanem la versiunea simplificata mai lizibila in app?

**Propunere**: Pastram versiunea actuala simplificata in UI; construim un "export oficial" separat care reconstituie formatul ANAF din aceleasi date.

### 8. Impozit pe profit vs microintreprindere
- Cum tratam clientii microintreprindere (impozit pe venituri, nu pe profit)? Trebuie sa stim per client regimul fiscal?
- Exista un cont dedicat pentru impozitul pe venituri la micro?

### 9. Formulele pentru KPI
- **Cash & Banca** = 5121+5124+5311+5314. Includem si 542, 581, 5125?
- **Creante** = 4111. Includem si 418, 4118?
- **Datorii furnizori** = 401+404. Includem si 408? Scadem 409?
- **TVA de plata** = 4427-4426. Formula corecta este aceasta sau folosim 4423 direct?

### 10. Conventia conturilor analitice in Saga
- Exista o conventie stricta sau fiecare client face cum vrea?
- Separatorul este intotdeauna `.` sau apare si `-`, `_`?
- Partea de dupa punct poate fi text (`5121.BT`) sau doar numerica?
- Adancime maxima?

### 11. Conflicte la reimport
- Ce facem cand Saga schimba denumirea unui cont analitic intre doua importuri (ex: `401.00023` = "Orange" in ian, "Telekom" in feb)?
- Propunere: pastram editarea manuala cu prioritate, afisam warning in UI daca Saga raporteaza alt nume.

### 12. Export SAF-T / D394
- Planul de conturi trebuie exportat intr-un format specific pentru ANAF?
- Trebuie pastrate "snapshot-uri" ale planului la momentul depunerii declaratiei?

---

## Status implementare

Acest document descrie arhitectura tinta. Implementarea este in curs si se face in etape:

1. **Seed OMFP 1802** — fisier JSON cu toate conturile standard
2. **Schema DB** — modelele `AccountCatalog` si `ClientAccount`
3. **Modul `accounts`** — serviciu cu cache pentru rezolvarea numelor
4. **Script de seed** — incarca JSON-ul in `AccountCatalog`
5. **Rewire balanta si CPP** — folosesc noul modul in loc de `account-names.ts` si prefixele hardcodate
6. **Rewire import** — creeaza `ClientAccount` din denumirile Saga
7. **Migratie clienti existenti** — populeaza `ClientAccount` retroactiv
8. **Teste** — verificare cu datele reale de la contabil (4Walls, QHM21)

Etapele 9+ (UI plan de conturi, editare inline, bulk operations, export SAF-T) vin intr-o iteratie ulterioara, dupa ce infrastructura e stabila.

Pentru lista completa a intrebarilor deschise, vezi [Intrebari pentru contabil: plan de conturi](./intrebari-contabil-plan-conturi.md).
