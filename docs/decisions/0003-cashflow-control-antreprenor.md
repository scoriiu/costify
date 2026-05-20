# ADR-0003 — Cashflow control pentru antreprenor (modul antreprenor)

**Status**: Proposed
**Date**: 2026-05-20
**Authors**: coriiu
**Context owners**: coriiu (internal)
**Builds on**: ADR-0001 (catalog de conturi cu roluri), ADR-0002 (timeline regim fiscal)
**Reference**: `reference/tb-report/` (prototip scris de contabilul-însuși, file-centric, deja în producție pe un client)

## Summary

Adăugăm un **mod antreprenor** la pagina clientului care răspunde, fără jargon contabil, la cele cinci întrebări canon ale unui antreprenor român:

1. Cât am în bancă și casă acum?
2. Cât îmi datorează clienții și cât datorez furnizorilor?
3. Cât am câștigat sau pierdut?
4. Pot să plătesc obligațiile pe luna asta (salarii, TVA, furnizori)?
5. Cât am scos eu din firmă și cât mai pot scoate?

Modul antreprenor:

- Trăiește pe aceeași pagină de client (`/clients/[slug]?view=owner`), comutabil cu un toggle "Vedere contabil / Vedere antreprenor".
- Nu inventează date — totul se calculează din jurnalul existent, pe baza catalogului de conturi (roluri din ADR-0001).
- Nu folosește niciodată cod numeric de cont, nici "rulaj", "debit", "credit", "balanță", "F20" — vocabularul OMFP rămâne strict în Vederea contabil.
- Este surface-ul oferit antreprenorului invitat de contabil (rol `OWNER_GUEST`, forțat în Vederea antreprenor, read-only).

Construim primul, în paralel, **patru funcții pure de raportare** (Financial Summary, Cash Position, Owner Withdrawals, Evolution Trends) portate din `reference/tb-report/src/lib/balance/kpis.ts` și `lib/journal/trends.ts`, adaptate la modelul jurnal-centric și la catalogul de conturi cu roluri. Apoi adăugăm două funcții utilitare (Business Insights, Year Comparison), apoi UI-ul, apoi invitația antreprenorului, apoi tools-urile Costi.

## Context

### De ce acum

Costify rezolvă deja problema contabilului (balanță live, CPP, F20 detaliat, plan de conturi, regim fiscal pe timeline, asistent Costi). Antreprenorul însă **nu poate folosi produsul** — fiecare ecran vorbește limba contabilului. Cele cinci întrebări de mai sus nu au răspuns într-un singur loc, în limba lui.

Distribuția produsului trece prin contabil (vezi AGENTS.md, secțiunea "Distribution model"). Fiecare contabil mulțumit aduce N antreprenori. Dar antreprenorul vine pe platformă doar dacă, când deschide pagina firmei lui, vede imediat ce-l interesează, în limba lui. Altfel pleacă și nu se mai întoarce, iar contabilul renunță să mai invite.

### De ce tb-report este o resursă, nu un model de produs

`reference/tb-report` este prototipul pe care contabilul l-a scris singur pentru un client al lui. Are 1.300 de linii de logică financiară foarte bună (`lib/balance/kpis.ts`, `lib/journal/trends.ts`) care **rezolvă deja 70% din problema antreprenorului**. Le-am citit, le luăm.

Ce **nu** copiem:

- **Modelul file-centric** (`datasetId`) — Costify este jurnal-centric (`clientId`), deja stabilit în ADR-0001 D1.
- **Hardcoded prefixe de cont** (`base.startsWith("512") && !base.startsWith("5125")`) — la noi totul trece prin catalogul cu roluri (`cashRole`, `arRole`, `apRole`, `vatRole`, `payrollRole`). Asta e singurul efort serios de adaptare.
- **i18n cu chei și fișiere `locales/`** — la noi textele utilizator sunt direct în română, fix (regulă AGENTS.md).
- **UI alb cu gradiente** — reskinat la paleta crem-teal warm a Costify (regulă AGENTS.md, "Light theme first").

## Întrebările canon și răspunsul produsului

Fiecare întrebare are un singur surface, calculat din jurnal, în limba antreprenorului. Tabelul leagă explicit întrebarea de funcția pură care o rezolvă.

| Întrebare antreprenor | Funcție pură | Provine din | Format UI |
|---|---|---|---|
| Cât am în bancă și casă? | `computeFinancialSummary` → `soldRegistruCasa`, `soldConturiBancare` | tb-report `kpis.ts:906` | Card cu suma + sparkline 6 luni |
| Cât îmi datorează clienții? | `computeFinancialSummary` → `clientiNeincasati` + `getOutstandingClients` | tb-report `kpis.ts:135` | Card + tabel "cine îmi datorează", sortat descrescător |
| Cât datorez furnizorilor? | `computeFinancialSummary` → `furnizoriNeachitati` + `getOutstandingSuppliers` | tb-report `kpis.ts:156` | Card + tabel "cui îi datorez" |
| Cât am câștigat luna asta / anul ăsta? | `computeFinancialSummary` → `cifraAfaceriLuna/Total − cheltuieliLuna/Total` | tb-report `kpis.ts:906` | Două carduri (luna + anul) cu verde/roșu pe semn |
| Pot să plătesc luna asta? | `computeCashPosition` → `disponibil − obligații` | tb-report `kpis.ts:1357` | Card cu două coloane (Disponibil / Obligații) și Net colorat |
| Cât am scos / cât mai pot scoate? | `computeOwnerWithdrawals` | tb-report `kpis.ts:1416` | Card cu 8 linii: dividende plătite/neridicate, avansuri trezorerie, asociați conturi curente |
| Cum am evoluat? | `computeEvolutionTrends` | tb-report `trends.ts` | Bar chart venituri/cheltuieli + line cash 12 luni + narrative ro |
| Unde se duc banii? | `computeEvolutionTrends.cashflow` | tb-report `trends.ts:426` | Stacked area cu ieșiri pe categorii (60..69/401/421/44/...) |
| Ce ar trebui să fac? | `generateInsights` | tb-report `kpis.ts:177` | Listă de propoziții în română, colorate semantic |

**Niciun KPI sau card din modul antreprenor nu apare fără ca funcția lui sursă să fie testată cu date reale.** Nimic mocked, nimic "aproximativ".

## Decizii

### D1 — Modul antreprenor este o vedere a aceleiași pagini de client, nu o pagină nouă

**Decision**: Pagina `/clients/[slug]` capătă un parametru `?view=owner|accountant` (default `accountant` pentru utilizatorii actuali, forțat `owner` pentru `OWNER_GUEST`). Toggle-ul stă la dreapta titlului firmei, lângă selectorul de perioadă.

**Why**: Un antreprenor invitat ajunge tot la `/clients/[slug]` (URL-ul firmei lui). Nu vrem să întreținem două ierarhii de rute. Toggle-ul face de asemenea cel mai natural review pentru contabil: poate sări într-o secundă în "ce vede clientul meu" fără să se delogheze.

**Alternativa respinsă**: pagină separată `/clients/[slug]/owner`. Dublează rutele, fragmentează datele, contabilul nu poate verifica rapid ce arată în fața clientului.

### D2 — Totul se calculează din jurnal, prin funcții pure peste `BalanceRowView[]` + catalog

**Decision**: Patru funcții pure noi sub `src/modules/reporting/`, fiecare cu semnătura `(rows: BalanceRowView[], catalog: Map<string, CatalogAccount>) → Snapshot` și fără I/O:

- `computeFinancialSummary` → `src/modules/reporting/summary.ts`
- `computeCashPosition` → `src/modules/reporting/cash-position.ts`
- `computeOwnerWithdrawals` → `src/modules/reporting/owner-withdrawals.ts`
- `computeBusinessInsights` → `src/modules/reporting/insights.ts`

Plus o a cincea care pleacă direct din `JournalLine[]` (vezi D4):

- `computeMonthlyTrends` → `src/modules/reporting/trends.ts`

Și o a șasea pentru aging simplu de tip DSO/DPO (nu pe partener, vezi D5):

- `computeFinancialRatios` → `src/modules/reporting/ratios.ts`

**Why**: Aceeași filosofie ca `computeKpis`, `computeCpp`, `computeCppF20` — pure, testabile cu fixtures, fără side-effects. Serviciul `reporting/service.ts` orchestrează apelurile și expune `Result<T>` la stratul de API.

### D3 — Folosim catalogul cu roluri, NU prefixele de cont

**Decision**: Orice condiție de tipul `base.startsWith("512")` din tb-report se rescrie în `meta.cashRole === "cash_direct"` (sau echivalent pe `arRole`, `apRole`, `vatRole`, `payrollRole`). Lookup-ul se face prin `lookupByBase` (același helper ca în `kpi.ts` actual).

**Why**: ADR-0001 a stabilit catalogul ca singura sursă de adevăr pentru "ce înseamnă un cont". Prefixe hardcodate în 5 funcții noi ar fi o regresie. În plus, un cont pe care contabilul l-a clasificat altfel decât OMFP (override în `ClientAccount`) trebuie să influențeze KPI-ul antreprenorului — asta funcționează doar prin catalog.

**Mapare explicită**:

| tb-report (prefix) | Costify (rol din catalog) |
|---|---|
| `512x` (exclus `5125`) | `cashRole = "cash_direct"` |
| `531x` | `cashRole = "cash_direct"` |
| `5125` | `cashRole = "cash_transit"` (exclus din KPI cash, vezi D8 din ADR-0001) |
| `411x` | `arRole = "ar_primary"` |
| `401x` | `apRole = "ap_primary"` |
| `404x` | `apRole = "ap_primary"` (furnizori imobilizări) |
| `4423` | `vatRole = "vat_payable"` |
| `4424` | `vatRole = "vat_receivable"` |
| `421x` | `payrollRole = "wages_payable"` |
| `431x` | `payrollRole = "social_insurance"` |
| `1621x` | `cppGroup = "credite_termen_lung"` |
| `519x` | `cppGroup = "credite_termen_scurt"` |
| Class 6 (exclus `609`) | `cppGroup.startsWith("cheltuieli_")` |
| Class 7 (exclus `709`, `71`, `72`) | `cppGroup.startsWith("venituri_")` |

Conturile pentru Owner Withdrawals (`457`, `463`, `4551`, `542`, `473`, `461`) primesc un câmp nou în catalog: **`ownerRole`** cu valorile `dividend_payable`, `dividend_interim`, `shareholder_loan`, `cash_advance`, `clearing`, `misc_debtor`. Asta se adaugă în seed-ul OMFP (read-only platform) — nu schimbă semantica conturilor, doar le marchează ca relevante pentru cardul Owner Withdrawals.

### D4 — Cashflow real (inflows/outflows pe categorii) se calculează din `JournalLine`, nu din balanță

**Decision**: `computeMonthlyTrends` cere `JournalLine[]` direct (cu `contDBase`, `contCBase`, `suma`, `month`), nu `BalanceRowView[]`. Funcția repetă logica `tb-report/trends.ts:426-518` adaptată la rolurile din catalog.

**Why**: Pentru a ști *pe ce categorie* iese banul, trebuie să cunoști *contrapartida* — adică contul de care provine cealaltă parte a notei contabile. `BalanceRowView` nu păstrează această informație; ea agregă pe `contBase`. Doar `JournalLine` o are.

**Atenție**: pentru clienții cu 50K+ linii pe an, asta poate dura. Adăugăm un index Prisma compus pe `(clientId, year, month, deletedAt)` dacă nu există deja, și planificăm cache Redis invalidate pe `ImportEvent` în PR-uri ulterioare (nu blocker pentru v1).

**Excluziuni necesare** (lecții din tb-report):

- Linii cash → cash (transfer între bănci/casă) — exclus din inflow/outflow.
- Linii care implică contul de transit (`cashRole = "cash_transit"`, ex. `581`, `5125`) — exclus.
- Note contabile compuse ("%") — verificare obligatorie înainte de implementare (vezi "Risks").

### D5 — Aging-ul pe partener NU se face în v1. Folosim DSO/DPO ca proxy de "vârstă medie"

**Decision**: `computeFinancialRatios` întoarce DSO și DPO la nivel de firmă, exact ca tb-report (`kpis.ts:1292-1305`):

```
DSO = (clientiNeincasati / cifraAfaceriTotal) × 365
DPO = (furnizoriNeachitati / cheltuieli_60_61_62_total) × 365
```

Tabelele "Cine îmi datorează" / "Cui îi datorez" arată **soldul curent per partener**, sortat descrescător, fără buckets (0-30/31-60/...).

**Why**: Aging-ul corect cere matching FIFO între linii de jurnal (factură emisă vs încasare parțială pe analiticul `4111.XXXX`). Asta e fragil dacă jurnalul nu are referințe explicite la documentul stins (Saga nu le impune), și produce rezultate confuze când contabilul face stornări sau compensări. DSO/DPO la nivel de firmă răspund **aceeași întrebare** ("durează mult?") cu un număr robust care nu minte niciodată. Aging pe partener rămâne pe roadmap, după ce avem rezolvat matching-ul de documente (PR separat, post-v1).

**Mesaj UI**: "În medie iți iei banii de la clienți la ~47 zile după ce facturezi." — propoziție generată din DSO, fără jargon.

### D6 — Insights sunt deterministe, calculate la fiecare cerere, nu AI

**Decision**: `computeBusinessInsights(kpis, summary, ratios, rows, catalog) → Insight[]` este o funcție pură care întoarce o listă de propoziții în română, categorizate pe `profitabilitate | cash_flow | datorii | operatiuni`. Portate aproape mecanic din `tb-report/kpis.ts:177-900`, cu următoarele modificări:

- Cheile i18n (`"insights.cashFlow.cashThin.title"`) devin string-uri ro fixe.
- Formatarea valorilor folosește utilitarele Costify (`formatRON`, `formatPercent`).
- Pragurile rămân ca în tb-report (testat în producție).

**Why**: Insights sunt 100% deterministe (vezi reguli ca "dacă cash < 30% din furnizori → warning"). Nu există motiv să trecem prin LLM. Câștigăm: viteză (<10ms), zero cost per request, reproductibilitate perfectă, testabilitate completă. Costi rămâne pentru întrebări libere; insights-ul automat e un layer determinist sub el.

### D7 — Modul antreprenor nu menționează niciodată conturi numerice

**Decision**: Niciun string în UI sau în răspunsurile tools-urilor Costi (atunci când invocate în context owner) nu conține cod de cont. Vocabular permis:

| Permis | Interzis |
|---|---|
| bani, cash, casă, bancă | 512, 531, sold debitor, finD |
| clienți, ce-mi datorează | 4111, creanță, ar_primary |
| furnizori, datorii | 401, sold creditor |
| TVA de plată / TVA de recuperat | 4423, 4424 |
| salarii de plată | 421, 431 |
| profit, pierdere, marjă | rezultat 121, rulaj cumulativ |
| credit bancar | 1621, 519 |
| dividende, asociați | 457, 4551, 463 |
| avans de cheltuit | 542 |

**Why**: AGENTS.md insistă pe asta. Dacă un cuvânt necesită Google pentru un antreprenor, e greșit. Un cont numeric este definitia "necesită Google".

**Cum verificăm**: orice text antreprenor-facing este review-ed de un non-contabil înainte de merge. Test E2E rulează un grep pe DOM-ul randat (`role="main"` în `view=owner`) și eșuează dacă găsește pattern `\b[1-9]\d{2,3}\b` (cod de cont 3-4 cifre).

### D8 — Antreprenorul invitat este `OWNER_GUEST`, legat de un singur client, read-only

**Decision**: Schemă nouă:

```prisma
model ClientGuestAccess {
  id          String   @id @default(cuid())
  clientId    String
  email       String
  role        String   // "owner_guest" | future: "auditor" | "investor"
  invitedAt   DateTime @default(now())
  acceptedAt  DateTime?
  userId      String?  // null until accepted
  inviteToken String   @unique
  expiresAt   DateTime

  client      Client   @relation(...)
  user        User?    @relation(...)

  @@unique([clientId, email])
}
```

Flux:

1. Contabil deschide tab "Setări" → secțiune "Acces antreprenor" → input email → click "Trimite invitație".
2. Backend creează `ClientGuestAccess` + trimite email cu `/accept/:token`.
3. Antreprenor face click → dacă n-are cont, formularul cere doar nume + parolă (email pre-completat); dacă are cont, doar confirmare.
4. La accept, `acceptedAt` și `userId` sunt setate.
5. `getSessionUser` returnează userul cu lista de `clientId`-uri accesibile. Pentru `OWNER_GUEST`, accesul e restrâns la `ClientGuestAccess.clientId` și forțează `view=owner` în query params.
6. Nicio rută de mutație (`POST /api/import`, `POST /api/journal/delete`, etc.) nu acceptă request-uri de la `OWNER_GUEST` — guard la middleware.

**Why**: Doi clicks pentru contabil să invite (regula din AGENTS.md "Inviting an entrepreneur must take two clicks"). Zero configurare de roluri/permisii. Read-only înseamnă read-only, nu o matrice complicată.

### D9 — Costi capătă tools noi și o regulă fermă pentru contextul owner

**Decision**: Adăugăm în `src/modules/costi/tools.ts`:

- `get_owner_summary(client_name, year?, month?)` → `FinancialSummary` în payload de antreprenor (fără finD/finC, doar campurile umane).
- `get_cash_position(client_name, year?, month?)` → `CashPosition`.
- `get_owner_withdrawals(client_name, year?, month?)` → `OwnerWithdrawals`.
- `get_monthly_trends(client_name, months?)` → `EvolutionTrendsReport` (12 luni default).
- `get_business_insights(client_name, year?, month?)` → `Insight[]`.
- `get_outstanding(client_name, side: "ar"|"ap", year?, month?)` → tabel partener+sold.

În `costify-app.json` (training Costi), adăugăm:

- Descrierea modulului antreprenor (ce întrebări răspunde, ce surface-uri are).
- Regulă: când contextul curent este `view=owner` sau utilizatorul este `OWNER_GUEST`, Costi NU pomenește conturi numerice. Folosește vocabularul din D7.

**Why**: AGENTS.md, secțiunea "Costi Is a First-Class Citizen — Never Let Him Fall Behind". Dacă livrăm modul antreprenor fără ca Costi să-l înțeleagă, contabilul va întreba "ce vede clientul meu?" și Costi va răspunde din lumea contabilă. Inacceptabil.

### D10 — Ordinea PR-urilor

PR-urile sunt ortogonale și livrabile independent. Fiecare lasă produsul într-o stare bună.

| PR | Conținut | Dependențe |
|---|---|---|
| **PR-A** | `summary.ts` + `cash-position.ts` + `owner-withdrawals.ts` + teste unit + endpoint `/api/clients/:id/owner-summary` | — |
| **PR-B** | `trends.ts` + index Prisma compus + endpoint `/api/clients/:id/trends?months=12` | PR-A (folosește `summary`) |
| **PR-C** | `insights.ts` + `ratios.ts` (DSO/DPO) + endpoint `/api/clients/:id/insights` | PR-A |
| **PR-D** | UI "Vedere antreprenor": toggle + 7 secțiuni (Summary cards, Cash position, Owner withdrawals, Trends chart, Cashflow categorii, Outstanding tables, Insights panel). Reskinat la design system Costify. | PR-A, PR-B, PR-C |
| **PR-E** | `ClientGuestAccess` + flux invitație + email + `/accept/:token` + guard `OWNER_GUEST` | PR-D |
| **PR-F** | 6 tools Costi + update `costify-app.json` + teste tools | PR-A, PR-B, PR-C |

PR-A și PR-B pot merge în paralel cu PR-C. PR-D așteaptă A+B+C. PR-E și PR-F pot merge în paralel cu PR-D.

**Estimare totală**: ~2-3 săptămâni la o persoană, dacă portul din tb-report merge curat (vezi Risks).

### D11 — Model "Persoană", nu "Vedere"

**Decision**: Identitatea utilizatorului determină UI-ul. Nu există toggle care comută între două universuri pe aceeași pagină.

- Un utilizator cu rol `ACCOUNTANT` (contabilul) vede întotdeauna UI-ul de contabil: navigare `Clienti / Rapoarte / Costi / Documente`, pagina clientului cu tab-uri `Panou / Registru Jurnal / Balanta / CPP / Plan Conturi / Setari`.
- Un utilizator cu rol `OWNER` (antreprenorul invitat) vede întotdeauna UI-ul de antreprenor: navigare cu numele firmei la stânga (sau dropdown dacă are mai multe), `Costi` în centru, user dropdown la dreapta. Pagina firmei e o singură pagină verticală, fără tab-uri.
- Pentru cazul rar când contabilul vrea să vadă ce vede clientul lui: buton `Vezi ca firma` în pagina clientului → deschide tab nou la `/clients/[slug]?preview=owner` → conține un banner sus `Previzualizare client · Inchide` pentru a reveni.

**Why**: AGENTS.md regula `Simplicity is the product`. Un toggle creează întrebarea "în ce mod sunt acum?", care e exact tipul de friction interzis. Antreprenorul nu trebuie să afle că *există* o altă vedere — dacă o vede, va întreba contabilul, distribuția se sparge. Identitatea unică, vedere unică.

**Alternative respinse**:
- "Vedere" (toggle pe aceeași pagină): confuzie constantă, contabilul comută din greșeală.
- "Produs" (subdomain separat pentru antreprenor): dublă mentenanță fără câștig real.

### D12 — Vocabular: "Contabil" și "Firma", copy vorbește despre obiect nu persoană

**Decision**: În cod și DB, rolurile sunt `ACCOUNTANT` și `OWNER`. În UI, niciun copy nu numește persoana — fiecare vorbește despre obiectul ei de interes:

- Antreprenorul vede "firma ta" sau direct numele firmei. Nicăieri "antreprenor", "patron", "manager", "owner", "vedere", "mod".
- Contabilul vede "clientul tău" sau direct numele clientului. Nicăieri "vedere contabil".

**Vocabular intern (cod, DB, logs, audit)**:

| Concept | Termen |
|---|---|
| Rol DB | `ACCOUNTANT` / `OWNER` |
| Context UI | `view: "accountant" \| "owner"` (apare doar în URL în modul preview) |
| Tabel acces | `ClientGuestAccess` (păstrat) — dar role e `OWNER` simplu |
| Tool Costi | `get_owner_summary` etc. — numele tool-ului OK, dar payload-ul nu folosește cuvântul în textele expuse |

**Vocabular UI antreprenor — permis / interzis**:

| Permis (firma) | Interzis (contabil) |
|---|---|
| bani, cash, casa, banca | 512, 531, sold debitor, finD |
| clienti, ce-mi datoreaza | 4111, creanta, ar_primary |
| furnizori, datorii | 401, sold creditor |
| TVA de plata / TVA de recuperat | 4423, 4424 |
| salarii de platit | 421, 431 |
| profit, pierdere, marja | rezultat 121, rulaj cumulativ |
| credit bancar | 1621, 519 |
| dividende, asociati | 457, 4551, 463 |
| avans de cheltuit | 542 |

**Why**: "Antreprenor" exclude PFA și freelanceri. "Patron" sună învechit. "Owner" e englezism. "Firma" e cuvântul pe care toți românii din lumea SRL-urilor îl folosesc nativ despre afacerea lor — "cum sta firma", "am o firma", "scot din firma". Copy-ul produsului trebuie să fie identic cu vocabularul utilizatorului.

### D13 — Tab nou `Panou` la contabil, primul, default

**Decision**: Pagina clientului are 6 tab-uri în loc de 5:

```
Panou · Registru Jurnal · Balanta · CPP · Plan Conturi · Setari
```

`Panou` este primul, default la deschiderea paginii clientului. Conține:

- Status import (când a fost ultima dată, dacă lipsește o lună).
- 4-6 KPI-uri cheie (Trezorerie, Creante, Datorii furnizori, TVA de plata, Rezultat, Marja) în limba contabilului.
- Bannerul de conturi nemapate (refolosește `UnmappedBanner` existent).
- Insights deterministe în limba contabilă ("Lichiditatea curenta este 0.8 — sub pragul de 1.0 recomandat OMFP").
- Buton `Vezi ca firma` pentru preview.

**Why**: Tab-urile actuale sunt artefact-centric ("Jurnal", "Balanta") — un contabil cu 100 de clienți nu deschide fiecare ca să citească 5K linii de jurnal, ci ca să vadă **dacă ceva nu e în regulă**. Panoul răspunde în 5 secunde: "import facut? balanta se inchide? conturi nemapate? rezultatul e ce ma asteptam?". Apoi sapă în tab-urile detaliate dacă vrea.

Bonus: refolosește 100% funcțiile pure construite pentru antreprenor (FinancialSummary, CashPosition, Insights). Zero cod nou. Doar copy diferit. Exact "același adevăr, două limbi".

**Pe mobile**: tab-urile devin 6, prea multe pentru 360px. Scurtăm label-urile: `Panou · Jurnal · Balanta · CPP · Conturi · Setari` (intră în lățime).

### D15 — Showcase-ul vizual traieste in `/internal/firma`, peste date reale ale QHM21

**Decision**: Spec-urile vizuale ale modulului antreprenor nu sunt markdown sau Figma. Sunt **pagini React live** sub `/internal/firma/*`, accesibile doar utilizatorilor din `INTERNAL_WHITELIST` (echipa Costify).

Pagina foloseste **date reale** din DB pentru QHM21 NETWORK SRL (CUI `RO31679778`, slug `qhm21-network-srl`), inghetat la perioada **aprilie 2026** (ultima luna completa). Calculele provin din aceleasi functii pure folosite in productie (`computeKpis`, `computeFinancialSummary`, `computeCashPosition`, etc.) — deci showcase-ul reflecta mereu logica curenta.

**De ce nu mock data**:
- Mock data invata partenerul valori plauzibile dar false. Cu QHM21 reala vede pattern-uri reale ale unei firme romanesti.
- Mock data devine stale cand logica de calcul se schimba. Live data se update-eaza automat.
- Mock data trebuie intretinut separat. Refolosirea API-urilor existente = zero overhead.

**De ce QHM21 specific**:
- Are 16.799 linii de jurnal, 30+ luni de istoric (din 2023).
- Apartine utilizatorului `solomon.coriiu@costify.ro` (acces deja configurat).
- Are date pe regim `profit_standard`, plan de conturi standard OMFP.

**Structura**:

```
src/app/(dashboard)/internal/
├── page.tsx                           ← index (existent) — adaugam card "Firma"
└── firma/                             ← NOU
    ├── page.tsx                       ← hub cu carduri catre toate ecranele
    ├── _data/
    │   └── snapshot.ts                ← incarca snapshot inghetat QHM21 aprilie 2026
    ├── _components/
    │   ├── kpi-card-owner.tsx         ← C1
    │   ├── cash-position-card.tsx     ← C2
    │   ├── owner-withdrawals-card.tsx ← C3
    │   ├── evolution-chart.tsx        ← C4
    │   ├── cashflow-categories.tsx    ← C5
    │   ├── outstanding-table.tsx      ← C6
    │   ├── insights-list.tsx          ← C7
    │   ├── preview-banner.tsx         ← C8
    │   └── invite-owner-form.tsx      ← C9
    ├── pagina/page.tsx                ← Ecran 1: pagina firmei (vedere antreprenor)
    ├── panou/page.tsx                 ← Ecran 2: tab Panou contabil
    ├── preview/page.tsx               ← Ecran 3: preview contabil cu banner
    ├── invitatie/page.tsx             ← Ecran 4: Setari → Acces clientului
    ├── acceptare/page.tsx             ← Ecran 5: landing /accept/:token
    ├── selector/page.tsx              ← Ecran 6: dropdown firme antreprenor
    └── stari/page.tsx                 ← Ecran 7: empty / loading / error
```

**Componentele din `_components/`** sunt scrise direct in forma finala de productie. Cand ajungem la PR-D (UI antreprenor in productie), le mutam la `src/components/clients/owner/` si schimbam sursa de date din `snapshot.ts` (inghetat) in API call (dinamic). Zero rescriere, zero drift.

**Toate ecranele light theme only** (PR separat pentru dark, post-v1, conform deciziei utilizatorului).

### D16 — Comutare contabil ↔ firma: buton inline pe pagina clientului, tab nou, fara toggle global

**Decision**: Contabilul comuta in vederea firmei DOAR prin butonul `Vezi ca firma` din pagina clientului. Nu exista toggle global in user menu, nu exista preferinta de "mod de operare" in profil, nu exista comutare din lista de clienti.

**Comportament**:

- Butonul apare in header-ul paginii `/clients/[slug]`, langa "Upload Jurnal", ca `<Button variant="ghost">` cu icon `Eye`.
- Pe mobile, doar iconul (label-ul se ascunde sub `sm:`).
- Click → `target="_blank"`, URL nou `/clients/[slug]?view=owner`.
- In tab-ul nou:
  - UI-ul este identic cu ce vede antreprenorul real (acelasi cod sub `src/components/clients/owner/`).
  - Sus, banner sticky cu fundal `bg-primary/[0.08]`, text `Previzualizare client · ${client.name}` + buton `Inchide` care apeleaza `window.close()`.
  - URL-ul contine `?view=owner` ca semnatura clara pentru audit log si pentru cazul in care tab-ul e share-uit.

**Constraints**:

- Endpoint-urile (`/api/balance`, `/api/clients/:id/owner-summary`, etc.) NU se schimba in functie de `view`. Vederea owner este 100% derivata pe client din aceleasi date pe care le primeste vederea contabil.
- Pentru `OWNER` real, accesul la `?view=accountant` este blocat la middleware (guard la nivel de session+rol). `OWNER` vede mereu `view=owner`, fara optiune.
- Audit log inregistreaza fiecare `view=owner` deschis de un `ACCOUNTANT` ca eveniment de tip `client.preview_viewed` cu metadata `{ clientId, viewedAt }`. Asta permite raportare in viitor ("clientul X a fost previzualizat de 12 ori in ultimele 30 zile").

**Why nu toggle global in user menu**:
- Confuzie majora cand uiti toggle-ul pe "owner" si a doua zi deschizi Costify. Vezi UI-ul antreprenorului, intri in panica.
- Pe paginile globale (lista clienti, rapoarte) nu exista "view=owner" — toggle-ul devine ambiguu.
- Cuvantul "vedere antreprenor" intra in vocabularul contabilului, contrazicand D12 (copy vorbeste despre obiect, nu persoana).
- Comutarea adevarata e contextuala: "vreau sa vad ce vede ACEST client" nu "vreau sa fiu in modul X".

**Why nu setare in profil**:
- Complexitate de mentenanta pentru un caz de uz nedovedit.
- Setare ascunsa = utilizatori confuzi care nu-si amintesc de ce vad ce vad.
- Violeaza "Simplicity is the product".

**Why tab nou si nu in-place**:
- Contabilul poate compara cele doua vederi side-by-side (un monitor cu vederea lui, altul cu preview-ul).
- Permite screenshot pentru client fara sa pierzi locul in care erai.
- Inchiderea tab-ului = revenire automata, fara navigare back/forward.
- URL-ul cu `?view=owner` este shareable explicit (contabilul poate trimite link clientului pentru bug report: "uite ce vad eu cand fac asa").

### D17 — Modul firma este un sub-produs cu 12+ pagini, nu o pagina

**Decision**: Modul antreprenor este un site mic in site, cu navigare proprie. Are o pagina-acasa (rezumat) si 11+ pagini de detaliu, fiecare raspunzand la o intrebare-canon a antreprenorului.

**Lista de pagini**:

| URL | Intrebare | Continut principal |
|---|---|---|
| `/firma` | Cum sta firma? | KPI-uri + cash position + ce trebuie sa stii (rezumat, cum o avem azi) |
| `/firma/bani` | Cati bani am? | Conturi bancare + casa + cashflow + cash runway |
| `/firma/clienti` | Cine imi datoreaza? | Tabel complet, DSO, search, sortare |
| `/firma/clienti/[slug]` | Cum sta cu X? | Istoric facturi + plati + zile medii |
| `/firma/furnizori` | Cui datorez? | Simetric clienti |
| `/firma/furnizori/[slug]` | Cum sta cu Y? | Simetric client detail |
| `/firma/cheltuieli` | Unde se duc banii? | Categorii 60-69, top tranzactii, evolutie |
| `/firma/cheltuieli/[categoria]` | De ce cheltui pe X? | Drill-down pe o categorie |
| `/firma/venituri` | De unde vin banii? | Breakdown 70x, top clienti pe venit |
| `/firma/profit` | Cat castig real? | Profit lunar, marja, impozit estimat |
| `/firma/eu` | Cat am scos / pot scoate? | OwnerWithdrawals extins + istoric dividende |
| `/firma/stat` | Cat datorez statului? | TVA + contributii + impozit + calendar fiscal |
| `/firma/evolutie` | Sunt pe drumul bun? | YoY, sezonalitate, 24 luni |
| `/firma/sanatate` | E firma in regula? | Insights extinse + indicatori risc + actiuni |

Lista este vie. Adaugam/scoatem pe parcurs daca o pagina nu-si gaseste utilitatea.

### D18 — Doua cai de URL paralele, acelasi cod sub capota

**Decision**:

- **Antreprenor real** (rol OWNER, viitor): URL-uri scurte `/firma`, `/firma/bani`, `/firma/clienti`, etc. Slug-ul firmei NU apare in URL — se resolva din sesiune (un OWNER are exact un client).
- **Contabil in preview**: URL-uri lungi `/clients/[slug]?view=owner`, `/clients/[slug]?view=owner&page=bani`, etc. Slug-ul ramane explicit.

Ambele rute randeaza acelasi `<OwnerLayout>` cu acelasi context `{ clientId, slug, isPreview, baseHref }`. Componentele de pagina (`OwnerPageHome`, `OwnerPageBani`, ...) iau context-ul si compun URL-uri interne din `baseHref`. Zero branching in UI.

**De ce URL-uri scurte pentru antreprenor**: el are o singura firma in 99% din cazuri. `/firma/bani` se citeste si pronunta natural. `/firma/qhm21-network-srl/bani` redundant.

**De ce query params pentru preview contabil**: nu vrem rute paralele in cod (`/clients/[slug]/owner/bani` duplicat cu `/firma/bani`). `?view=owner&page=bani` semnaleaza clar ca esti in preview si pastreaza contextul de client.

### D19 — Layout cu side nav, pur tipografic, fara iconite in nav

**Decision**: Modul firma foloseste un side nav fix la stanga, latime `224px` desktop, colaps la `56px` sub `lg:` (mobile devine hamburger). Top bar minimal: logo Costify stanga, nume firma centru-stanga, Costi + user dropdown dreapta.

Side nav este **pur tipografic** — fara iconite, fara emoji. Respecta regula AGENTS.md "No icons in navigation — pure typographic, clean."

```
┌────────────────────┐
│ Acasa              │
│ Bani               │
│ Clienti            │
│ Furnizori          │
│ Cheltuieli         │
│ Venituri           │
│ Profit             │
│ Eu si firma        │
│ Stat               │
│ Evolutie           │
│ Sanatate           │
└────────────────────┘
```

Item activ are `bg-primary/[0.08] text-white` + bara verticala stanga `border-l-2 border-primary`. Items inactive sunt `text-gray-light hover:text-white`. Typography: `text-[14px] font-semibold tracking-[-0.04em]`. Padding: `px-5 py-2.5`.

**De ce side nav**: antreprenorul are 12+ pagini de navigat si nu intra zilnic. Are nevoie de harta vizibila permanent. Discoverability > eficienta spatiu.

**De ce derogarea de la "Top navigation (no sidebar)" din AGENTS.md**: regula AGENTS.md vizeaza pagini cu tabele dense de date pentru contabili. Antreprenorul nu are tabele dense; are carduri si grafice. Side nav nu fura latime relevanta. Regula se aplica strict in modul contabil.

### D20 — Acces tranzitoriu pentru testare (pre PR-E)

**Decision**: Pana cand `ClientGuestAccess` si rolul OWNER sunt implementate (PR-E), accesul la `/firma` este controlat astfel:

- Utilizator in `INTERNAL_WHITELIST` (echipa Costify) care **are exact 1 client**: poate accesa `/firma`, vede automat firma lui.
- Utilizator in `INTERNAL_WHITELIST` care **are mai multi clienti**: la `/firma` primeste un selector mic ("Pentru care firma vrei sa vezi vederea antreprenorului?") cu lista clientilor lui. Selectia ramane in cookie pana la logout. Asta permite testarea pe mai multe firme.
- Utilizator non-internal: redirect la `/clients`.

La PR-E, acest comportament este inlocuit cu: utilizator cu rol OWNER acceseaza `/firma`, restul primesc 404. Codul de mai sus dispare.

### D14 — Sectiune `Acces clientului` in tab Setari

**Decision**: Tab-ul `Setari` al clientului capătă o secțiune nouă, sub Informatii firma și Regim fiscal:

```
Setari client
├── Informatii firma (CUI, CAEN, denumire)        ← existent
├── Regim fiscal (timeline)                        ← existent
├── Acces clientului                               ← NOU
├── Date istorice (corectare, stergere)            ← existent
└── Audit log                                      ← existent partial
```

`Acces clientului` conține:
- Input email + buton `Trimite invitatie`.
- Lista celor invitați: email, status (`In asteptare` / `Activ`), data invitație, buton `Revoca acces`.
- Text explicativ scurt: "Clientul tau vede firma in limba lui, fara conturi sau termeni contabili. Acces read-only — nu poate modifica nimic."

**Why**: Două clickuri pentru invitație (regula AGENTS.md "Inviting an entrepreneur must take two clicks"). Locul natural pentru asta e `Setari` — nu un wizard separat, nu o pagină dedicată. Conform principiului `Progressive disclosure`, secțiunea e ascunsă până când contabilul are nevoie de ea.

## Implementation notes

### Tipuri noi (export din `src/modules/reporting`)

```typescript
export interface FinancialSummary {
  cifraAfaceriTotal: number;
  cifraAfaceriLuna: number;
  cheltuieliTotal: number;
  cheltuieliLuna: number;
  venituriLuna: number;
  soldRegistruCasa: number;
  soldConturiBancare: number;
  creditareSocietate: number;
  clientiNeincasati: number;
  furnizoriNeachitati: number;
}

export interface CashPosition {
  disponibil: CashPositionItem[];
  obligatii: CashPositionItem[];
  totalDisponibil: number;
  totalObligatii: number;
  net: number;
}

export interface OwnerWithdrawals {
  items: OwnerWithdrawalsItem[];
  total: number;
}

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  profit: number;
  profitMarginPct: number;
  cashEnd: number;
  cashNetMovement: number;
  receivables: number;
  payables: number;
  vatPayable: number;
  vatRecoverable: number;
}

export interface CashflowTrendRow {
  month: number;
  inflow: number;
  outflow: number;
  net: number;
  outflowByCategory: Record<string, number>;
}

export interface EvolutionTrendsReport {
  selectedYear: number;
  selectedMonth: number;
  months: number[];
  current: MonthlyTrendPoint[];
  previousYear?: MonthlyTrendPoint[];
  cashflow: { rows: CashflowTrendRow[]; categories: CashflowCategorySeries[] };
  narrative: string[];
}

export interface Insight {
  type: "info" | "warning" | "positive" | "negative";
  category: "profitabilitate" | "cash_flow" | "datorii" | "operatiuni";
  title: string;
  message: string;
  action?: string;
}

export interface FinancialRatios {
  marjaProfitabilitate: number;
  dso: number;
  dpo: number;
  lichiditateaCurenta: number;
  fondDeRulment: number;
}
```

### Adăugări în catalog (`AccountCatalog`)

Câmp nou: `ownerRole: OwnerRole | null` cu enum:

```
type OwnerRole =
  | "dividend_payable"      // 457
  | "dividend_interim"      // 463
  | "shareholder_loan"      // 4551
  | "cash_advance"          // 542
  | "clearing"              // 473
  | "misc_debtor";          // 461
```

Seed update în `seeds/omfp-1802.json`. Migrație Prisma. Nu schimbă semantica conturilor existente.

### UI antreprenor — layout

```
┌─ Header ──────────────────────────────────────────────────────────┐
│ [4Walls Studio SRL]              [Mai 2026 ▾]  [👁 Antreprenor ▾] │
├─ Cum stă firma în Mai 2026 ───────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Bani     │  │ De primit│  │ De plătit│  │ Profit   │           │
│  │ 142.300  │  │  87.430  │  │  95.120  │  │ +14.500  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
├─ Pot să-mi plătesc obligațiile? ──────────────────────────────────┤
│  Disponibil 230K  ─  Obligații 138K  =  Net +92K ✅               │
│  [două coloane Disponibil / Obligații cu progress bars]           │
├─ Cum am evoluat (ultimele 12 luni) ───────────────────────────────┤
│  [bar venituri/cheltuieli + line cash end-of-month]               │
│  În perioada Ian–Mai 2026, ai avut...                             │
├─ Unde se duc banii ───────────────────────────────────────────────┤
│  [stacked area: ieșiri pe categorii]                              │
├─ Cine îmi datorează / Cui îi datorez ─────────────────────────────┤
│  [două tabele paralele, partener + sold, top 10 + expand]         │
├─ Bani între firmă și mine ────────────────────────────────────────┤
│  [8 linii: dividende plătite, neridicate, avansuri, asociați...]  │
├─ Semnale ─────────────────────────────────────────────────────────┤
│  [propoziții colorate semantic, max 8]                            │
└───────────────────────────────────────────────────────────────────┘
```

Niciun cont numeric pe această pagină. Toggle-ul vederii e singura conexiune cu lumea contabilă.

## Risks

| Risc | Impact | Mitigare |
|---|---|---|
| Note compuse `%` în jurnal nu sunt explodate la import → `computeMonthlyTrends` greșește contrapartida | Cashflow pe categorii incorect | Verificare obligatorie înainte de PR-B. Dacă rămân compuse, fie le explodăm la import (preferabil), fie tratăm separat în trends (urât). Decizie după verificare, înainte de PR-B. |
| `JournalLine` query pe 50K+ linii pentru trends e lent | UX slab pe clienți mari | Index compus + cache Redis cu cheie `trends:{clientId}:{year}:{month}` invalidat pe ImportEvent. Adăugat în PR-B dacă măsurătorile cer. |
| Insights sunt prea generice / sună a robot | Antreprenorul ignoră textele | Le facem review cu un antreprenor real (non-contabil) înainte de PR-C merge. Pragurile sunt deja calibrate de contabil în tb-report producție, dar formulările pot fi îmbunătățite. |
| Test E2E "no account numbers in owner view" e fragil (poate da fals-pozitiv pe sume) | Build flaky | Regex restrâns la pattern-uri cu "cont", "5121", "411", etc., cu listă de excepții pe sume RON. Document în test. |
| Antreprenorul invitat are conturi pe mai mulți clienți (mai mulți contabili îl invită) | Conflict de identitate | `ClientGuestAccess` permite același `email` pe `clientId`-uri diferite. Userul vede o listă scurtă de clienți accesibili la login. Selectorul de client (UI) e ascuns sub un dropdown discret în navbar. |
| `tb-report` are bugs subtile pe care le copiem orbește | Date greșite în producție | Pe fiecare funcție portată: minim 5 unit tests cu fixtures realiste din `seeds/`. Diff de output între tb-report și implementarea Costify pe minim 3 clienți reali înainte de merge. |

## What we are NOT building in this ADR

- **Aging pe partener cu buckets** (0-30/31-60/61-90/90+) — vezi D5. Necesită matching FIFO de documente, fragil fără referințe explicite în jurnal. Rămâne în roadmap.
- **Forecast multi-metodă** (run-rate, sezonalitate, commitment) — `CashPosition.net` e suficient pentru întrebarea "pot plăti?". Forecast avansat e Phase 2 din `docs/plan.md`.
- **Buget vs realizat** — Phase 2 din `docs/plan.md`. Antreprenorul nu are buget formal în 99% din cazuri.
- **Notificări email/push** ("cash sub 50K!") — util, dar nu blocker pentru "pot vedea cum stă firma". Phase 2.
- **Multi-currency** — venituri/cheltuieli în EUR/USD. Aproape nimeni din baza noastră de clienți nu o cere. Phase 2.
- **PDF/Excel export pentru antreprenor** — antreprenorul vede pagina; dacă vrea PDF, contabilul i-l face din vederea lui (există deja). Phase 2 dacă cererea apare.

## Open questions

1. **Câte luni înapoi în Trends?** — 12 luni rolling pare standard, dar pentru un client cu istoric scurt (3-4 luni) graficul arată gol. Decizie: afișăm câte luni există, max 12, fără pad cu zerouri.
2. **Pe ce regim fiscal calculăm "profit" în cardul Profit din Summary?** — Folosim `rezultat = venituri − cheltuieli` brut, **fără impozit** (același ca KPI-ul actual). Pentru rezultatul net cu impozit, link discret către "vedere contabil → CPP". În UI antreprenor: "profit estimat înainte de impozit".
3. **Insights despre regimul fiscal** (ex: "depășești pragul de microîntreprindere") — interesant, dar cere date care nu sunt în jurnal (prag, plafon). Amânat post-v1.
4. **Cum vede antreprenorul mai mulți clienți?** — Cazul rar al unui antreprenor cu mai multe SRL-uri și un singur email. Dropdown în navbar cu lista de firme accesibile. Default: ultima firmă vizitată.

## References

- `docs/plan.md` — viziunea generală a produsului, secțiunile despre antreprenor.
- `docs/decisions/0001-plan-de-conturi-refactor.md` — catalogul cu roluri (D8 = cash KPI, D9 = VAT KPI).
- `docs/decisions/0002-tax-regime-timeline.md` — regimul fiscal pe perioade.
- `reference/tb-report/src/lib/balance/kpis.ts` — sursă pentru summary, cash position, owner withdrawals, insights, ratios.
- `reference/tb-report/src/lib/journal/trends.ts` — sursă pentru evolution trends + cashflow.
- `reference/tb-report/src/components/report/` — pattern UI (reskinat).
- `AGENTS.md` — secțiunile "Distribution model", "The bilingual product", "Costi Is a First-Class Citizen".
