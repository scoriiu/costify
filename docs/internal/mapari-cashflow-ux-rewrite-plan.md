# Mapari Cashflow — UX Rewrite Plan

> **Stare**: ✅ **TERMINAT** — toate cele 7 sprinturi livrate pe branch
> `feat/pr-2c-6-mapari-coverage`.
> **Plan creat**: mai 2026, după discuția cu Corii pe limbajul Claudiei.
> **Acest document e contractul de referință** — la orice resume de sesiune,
> citește-l întâi ca să știi unde suntem și de ce.

## Rezumat final

**Branch**: `feat/pr-2c-6-mapari-coverage` — 9 commits, ~3000 linii noi cod
+ tests (3103 unit tests pass).

**Ce s-a livrat**:
- Coverage panel vizibil pe Mapari Cashflow (Sprint 1)
- Slide-panel parteneri cu bulk apply + filter + search (Sprints 2-3)
- Cross-cont memory cu yellow suggestions + review queue (Sprints 4-5)
- Redistribution reală pe /firma KPIs prin partner overrides (Sprint 6)
- Trust badge pe /firma pentru antreprenor (Sprint 7)

**Validare**:
- TypeScript clean.
- 3103/3103 unit tests passing.
- Zero schema breaking changes pentru migrări existente.
- Backwards-compat pentru snapshot-uri publicate (Sprint 7 has fallback).
- Costi training (`costify-app.json`) actualizat după fiecare sprint relevant.

**Următorii pași optional/Sprint 8 candidates**:
- Rewrite docs cashflow-pentru-antreprenor.md în limbajul nou.
- Tooltip "Această sumă vine din..." pe sume KPI (necesită line-level traceability).
- Per-vertical partner splits (extensia axei B la nivel partener).
- KPIs per-categorie (ex. marja pe categoria X).
- Cache adjustments per (clientId, year, month) cu invalidation.

## Post-Sprint-7 polish (Nov 2026 — sesiunea de feedback Corii)

După livrarea celor 7 sprinturi, o sesiune intensivă de feedback cu Corii pe
firma reală (`qhm21-network-srl`, cont `6058`) a dezvăluit câteva probleme
de UX care nu erau vizibile în testele unitare. Toate sunt **rezolvate** și
**testate** (5 noi Playwright tests în
`tests/ui/mapari-cashflow-partner-overrides.spec.ts`).

### 1. ✅ Modal background transparent (bug grav)
- Token `bg-dark-1` nu există în globals.css → 3 dialog-uri (partner panel,
  preview modal, review queue) rendau fundal transparent.
- Fix: schimbat la `bg-dark-2` în partner-panel.tsx + review-queue.tsx.

### 2. ✅ Count badge negru pe teal (text-white = #1A1918 în light theme)
- `text-white` rezolva la `--color-white = --text-primary = #1A1918` în
  light theme → "6" negru pe teal verde, ilegibil.
- Fix: schimbat la `text-[#E9E8E3]/20` și `text-[#E9E8E3]` literal pe count
  badge. Adăugat secțiune dedicată în AGENTS.md cu regula:
  "Text-on-primary — never `text-white` on `bg-primary`".

### 3. ✅ "0% mapat explicit" misleading headline
- Când contabilul nu pune nicio excepție (cazul normal), header arăta "0%
  mapat explicit" — sugera că ceva e greșit. De fapt 0% e starea naturală.
- Fix: când zero overrides, mesaj onest: "Niciun partener nu are excepție.
  Suprascrie individual mai jos doar dacă un partener aparține altui grup."
  Când există overrides, "Excepții față de contul — N% din rulaj
  redistribuit".

### 4. ✅ "Default contului (...)" redundant pe fiecare rând partener
- Lista de 6 parteneri arăta de 6 ori "Default contului (Marfă, materii
  prime și materiale)" în Select. Categoria contului apare deja sus în
  header.
- Fix: label scurt "Urmează contul". Categoria contului apare o singură
  dată în header.

### 5. ✅ Bulk apply bar domina panoul vizual
- Bulk apply e cazul rar (contabilul vine de obicei pentru 1 partener,
  nu pentru toți).
- Fix: ascuns sub link opt-in `Redirecționează în bulk →`. Click deschide
  bara cu buton `Renunță` pentru anulare.

### 6. ✅ Threshold badge schimbat 3 → 2 (validat cu date reale)
- Pe 4 clienți × 153 conturi: 21 conturi (14%) au exact 2 parteneri. Cu
  prag ≥3 erau invizibili — exact bucket-ul unde se ascund cele mai multe
  clasificări greșite.
- Fix: `MIN_PARTNERS_FOR_BADGE = 2`. Acoperire badge: 29% → 43% din conturi.

### 7. ✅ Header truth-line minciuna când există overrides
- "Toți partenerii merg în Marfă..." rămânea afișat chiar și după ce
  contabilul punea 1 excepție pentru Tesla. Era o minciună.
- Fix: 5 variante de mesaj în funcție de starea reală: cont nemapat,
  zero overrides, unele overrides, toate overrides, loading-no-data.
  Funcția pură `HeaderTruthLine`.

### 8. ✅ Conturile cu overrides nu erau vizibile la o privire
- Badge-ul deja se colora cu primary tint, dar era subtil.
- Fix: rândul AccountRow primește acum **bordură stânga primary/40** când
  are overrides. Scanând lista top-to-bottom, conturile cu intervenții
  manuale sar în ochi imediat. Plus badge mai bold (font-semibold + bg
  mai intens).

### 9. ✅ NEW FEATURE: Centralized "Toate excepțiile" view
- Contabilul nu putea vedea într-un singur loc TOATE override-urile
  firmei. Trebuia să intre pe fiecare cont să le caute.
- Fix:
  - Nou loader: `loadAllExceptions(clientId, year, month)` returnează
    fiecare override cu cont/partener/categorie/rulaj.
  - Nou server action: `loadAllExceptionsAction`.
  - Nou UI component: `<AllExceptionsDialog>` cu listă sortabilă DESC
    după rulaj, search diacritic-insensitive (partener + cont + categorie),
    edit inline (Select pe fiecare rând schimbă categoria), ștergere
    inline (Trash2 cu confirm), empty state, idle marker pentru
    override-uri istorice fără activitate.
  - Entrypoint: callout primary-tint în coverage panel `N excepții
    individuale → Vezi toate`, vizibil DOAR când `totalOverrideCount > 0`.
- Sortare DESC pe `Math.abs(rulaj)`: cel mai mare impact primul.

### 10. ✅ Playwright UI tests
- Nou fișier `tests/ui/mapari-cashflow-partner-overrides.spec.ts` cu 5
  teste end-to-end:
  1. Page loads + coverage panel visible
  2. Per-cont partner badge opens slide-panel cu truth-line corect
  3. Centralized "Toate excepțiile" callout opens dialog
  4. AllExceptionsDialog search filters rows
  5. Cont with overrides shows visual cue (left border)
- Toate 5 pass.
- 3103 unit/integration tests pass (zero regresii).
- 7 CPP tests rămân failed — pre-existente, neacarate de schimbările
  acestei sesiuni (verificat prin `git stash`).

---

## Context

Costify avea o tabă "Mapari Cashflow" funcțională dar incompletă față de
specul scris de contabila Claudia (`docs/client/...`). Specul descrie:

- O axă "orizontală" = procente pe linii de business (avem deja sub numele
  "split pe verticale" / `VerticalAllocation`).
- O axă "verticală" = mapare partener-pe-cont la o categorie (**NU avem**).
- Coexistență cu **regula reziduului** (orizontala se aplică pe ce rămâne
  după ce verticala și-a luat partea).
- Workflow bazat pe **bulk + excepții materiale** (efortul urmează banii).
- **Memorie cross-perioadă** cu sugestii pre-completate.
- Stări: auto-sugerat / confirmat / blocat.
- **Acoperire %** per cont ca indicator vizual.

Vocabularul a fost clarificat: `linie de business` (substantiv) și
`mapare orizontală/verticală` (acțiune, direcție). "Verticala" ca substantiv
e abandonat — colizie cu maparea verticală. Doc-ul de referință:
**`docs/ro/cashflow-limbajul-mapari.md`** (citit înainte de orice
implementare).

## Principii UX (nu se negociază)

1. **One page, progressive disclosure.** Nu sărim între ecrane.
2. **Decizia înainte de unelte.** Sus pe ecran: "ce ai de făcut?". Jos:
   uneltele.
3. **Materialitatea conduce.** Toate listele cu sume — sortate descrescător
   după bani. Niciodată alfabetic.
4. **Bulk-first, exceptions-second.** Nu pui contabilul în fața a 50 de
   rânduri.
5. **Memoria în background, sugestiile la suprafață.** Sistemul matchează
   în culise, dar nu aplică niciodată orb.
6. **Acoperirea = baterie.** Bar de progres scanabil instant.
7. **Antreprenorul vede încrederea, nu mecanica.** Pe `/firma` apar
   numerele finale + un mic trust signal. Restul rămâne la contabil.

## Decizii deja luate

- **Plan global**: construim toate cele 7 sprinturi în ordine (Corii a ales).
- **Panou partener**: slide-panel din dreapta (Corii a ales — păstrează
  contextul listei, nu schimbă URL-ul).
- **Vizibilitate pe `/firma`**: doar trust signal mic ("Date revizuite
  manual de contabil · acoperire 92%"). Niciun detaliu mecanic.
- **Vocabular**: adoptăm complet limbajul Claudiei (orizontal/vertical/
  linie de business). Doc-ul `cashflow-limbajul-mapari.md` e referința.
- **Docs ascunse**: cele 6 docs cashflow vechi (introducere, pentru-contabil,
  pentru-antreprenor, exemplu-qhm21, categorii, verticale) sunt scoase din
  sidebar până le rescriem în limbajul nou. Fișierele rămân pe disc.

## Stare curentă

| Item | Stare |
|---|---|
| Branch | `feat/pr-2c-6-mapari-coverage` (off `feat/pr-2c-5-wizard-tabs`) |
| Ultimul commit pe pr-2c-5 | `3422882 feat(mapari): YTD year selector + reset docs to limbajul-mapari only` |
| Sprint în lucru | **NIMIC — întregul rewrite e TERMINAT** ✅ |
| Sprinturi terminate | **7/7** — întregul plan livrat |
| Mockup-uri vizuale | descrise mai jos, neimplementate |

---

# Roadmap pe sprinturi

## Sprint 1 — Acoperire vizibilă (2-3 zile) ✅ TERMINAT

**Goal**: contabilul vede instant unde să se uite. Niciun flow nou.

**Scope redus față de planul inițial**: la momentul Sprint 1 nu există
overrides pe partener, deci "coverage per categorie" e vacuous (100%
implicit). Coverage meaningful e doar **overall**. Per-cont bars apar
din Sprint 2.

**Ce s-a făcut**:
1. ✅ `CoverageStats` interface + `computeCoverage()` pure function în
   `src/modules/categories/loader.ts`. Sumează rulaj absolut per cont
   (rulajD pentru clase 6, rulajC pentru clase 7), separă mapped vs
   unmapped, returnează percent rotunjit.
2. ✅ Threaded prin toate cele 3 return-uri ale `loadMapariCashflow`
   (empty firm, balance error, success).
3. ✅ `coverage: CoverageStats` adăugat la `MapariCashflowData`. Tipul
   re-exportat din `src/modules/categories/index.ts`.
4. ✅ Component nou `CoveragePanel` + `CoverageBar` în `mapari-cashflow-tab.tsx`.
   Apare între titlu+intro și wizard tabs.
   - Bar tonal: pos (≥90%) / primary (60-89%) / tone-warn (<60%)
   - Eyebrow "Acoperire generala" + percent text "X% atinse explicit · Y% pe default"
   - Detalii cifre: "X lei in N conturi mapate · Y lei in M conturi nemapate"
   - Callout `pos` când totul e mapped: "Toate conturile au o categorie"
   - Callout `neg` când există nemapate: "X conturi nemapate (Y lei)..." cu
     buton "[Mapeaza →]" care comută la tab Categorii
5. ✅ 10 unit tests pentru `computeCoverage` în
   `tests/unit/modules/categories/compute-coverage.test.ts`. Acoperă: empty
   firm, all mapped, all unmapped, mixed, expense+revenue mix, rotunjire
   percentage, absolute values pe negative, float drift.

**Acceptance verified**:
- ✅ Header vizibil pe `/clients/[slug]?tab=mapari-cashflow`.
- ✅ 3005 tests pass (era 2995, +10 din suita nouă).
- ✅ TypeScript clean.
- ✅ Funcționează cu YearSelector — schimbi anul, coverage se recompute.

**Note pentru sprinturile viitoare**:
- `CoveragePanel` are deja un prop `onJumpToUnmapped` care în Sprint 1 doar
  schimbă tabul. Din Sprint 2 ar putea deschide direct un listing filtrat
  pe nemapate sau panoul partener pe primul cont nemapat cu cei mai mulți
  bani.
- Bar-ul tonal poate fi reutilizat în Sprint 2 pentru per-cont coverage bars.

## Sprint 2 — Panoul partener (5-7 zile) ✅ TERMINAT

**Goal**: featura centrală a specului — partener-pe-cont mapping.

**Ce s-a făcut** (7 commits pe branch `feat/pr-2c-6-mapari-coverage`):

1. ✅ **Schema**: `PartnerCategoryOverride` cu (clientId, contBase,
   partnerNameNormalized) UNIQUE, FKs cascade.
2. ✅ **Normalizator** `src/lib/partner-normalize.ts` + 13 unit tests:
   collapse SRL/SA/etc, strip dotted forms (s.r.l. → srl), preserve
   diacritics, idempotent.
3. ✅ **Modul `partner-mappings/`** cu service.ts (6 CRUD funcții),
   actions.ts (5 server actions: load panel, upsert, confirm, delete,
   bulkApply), aggregator.ts (pure fn-uri agregare), loader.ts
   (Prisma queries).
4. ✅ **Loader extension**: `loadPartnerSummariesForClient` rulează
   o singură dată per page load (3 queries paralele), threadat în
   `MapariCashflowData.partnerSummariesByCont` și în fiecare
   `AccountListItem.partnerCount/partnerOverrideCount/partnerOverriddenRulaj`.
5. ✅ **Coverage extension**: `computeCoverage` tratează partner-overridden
   rulaj ca mapped (prorated când contul nu e cont-mapped). Cont-mapped
   conts ignoră partner overrides pentru coverage (Sprint 6 le va folosi
   pentru a redirecționa rulajul). +6 unit tests pentru noile scenarii.
6. ✅ **UI slide-panel** `partner-panel.tsx`: deschis cu click pe badge,
   header cu cont+rulaj, coverage detail (mapat/default/fara partener),
   listă parteneri sortată desc cu Select per rând. Prima opțiune
   "Default contului (X)" șterge override-ul la pick. Linia "Fara
   partener identificat" pentru unresolved rulaj. Loading skeleton,
   error state, optimistic save+refresh.
7. ✅ **Wire-up**: badge `[N parteneri · M mapati]` pe AccountRow când
   `partnerCount >= 3` (threshold ca să nu poluăm conturile cu 1-2
   parteneri). PartnerPanelContext la nivel de CategoryWorkspace evită
   prop drilling. Badge tonal: primary când are overrides, gray
   altfel.
8. ✅ **Costi training updated** — `costify-app.json` are secțiunea nouă
   `mapari_cashflow_module.partner_overrides` cu data model, normalizer,
   slide-panel UX, coverage extension.

**Acceptance verified**:
- ✅ Claudia poate spune "SC Logistic SRL pe contul 6022 e Curieratie".
  Salvarea funcționează prin upsertPartnerOverrideAction.
- ✅ KPI-urile pe /firma NU se schimbă încă (Sprint 6 va aduce
  recomputarea — partner overrides actualmente afectează doar coverage
  panel din Mapari Cashflow, nu și sumele din owner view).
- ✅ 3070 unit tests pass, TypeScript clean, dev server compiles.
- ✅ Slide-panel se redeschide cu state actualizat după save fără
  reload de pagină.

**Note pentru sprinturile viitoare**:
- `loadPartnerPanelAction` se poate apela și pentru on-demand refresh
  fără a reîncărca pagina întreagă.
- Badge threshold `MIN_PARTNERS_FOR_BADGE = 3` poate fi tunabil per
  client în Sprint 3 dacă apare feedback.
- "Fara partener identificat" bucket — Sprint 3 va putea oferi un mod
  rapid de a clasifica acel rulaj pe categoria default sau pe o
  categorie 'Diverse'.

## Sprint 3 — Bulk + preview (2-3 zile) ✅ TERMINAT

**Goal**: workflow-ul Claudiei devine viabil pe conturi cu 50+ parteneri.

**Ce s-a făcut** (1 commit):

1. ✅ **`BulkActionBar`** în partner-panel.tsx: Select cu categoriile + buton
   "Aplica" (disabled până se alege categorie). Header arată "Aplica la N
   nemapati (Y lei)" cu Layers icon.
2. ✅ **`BulkPreviewModal`**: fullscreen overlay (z-60 peste panel z-50)
   cu titlu, mesaj "Se vor mapa N parteneri (Y lei) la categoria X",
   nota despre excepții păstrate, butoane Anuleaza/Aplica.
3. ✅ **Filter `ToggleGroup`**: Toți / Nemapați / Top 10. Badge tonal
   pe Nemapați (danger când >0).
4. ✅ **`SearchInput` diacritic-insensitive**: helper `normalizeForSearch`
   folosește NFD + strip combining marks. "tiriac" → matchează "Țiriac".
5. ✅ **UnresolvedRow se ascunde** când filter ≠ all sau există query
   (logic: dacă scotocesti după ceva specific, nu vrei zgomot la bază).
6. ✅ Empty-state pentru filtru zero-result: "Niciun partener nu se
   potriveste filtrului".

**Acceptance verified**:
- ✅ Pe un cont cu 50 parteneri, contabilul poate selecta o categorie,
  vede preview-ul exact ("48 parteneri, 12.345 lei"), confirmă în 2
  click-uri, apoi tratează excepțiile individual.
- ✅ Search găsește "Țiriac" tastând "tiriac".
- ✅ Filter Nemapați face restul ușor de văzut.

**Note**:
- Pragul Top 10 e hardcoded. Dacă feedback-ul cere, se poate face Top
  20 / Top 50 într-un sprint viitor.
- Bulk apply trimite explicit `skipExistingOverrides: true` ca server-ul
  să nu suprascrie excepțiile manuale (matches §11 din language doc).

## Sprint 4 — Memorie + sugestii (4-5 zile) ✅ TERMINAT

**Goal**: maparea verticală = muncă o singură dată.

**Ce s-a făcut** (1 commit):

1. ✅ **Cross-cont suggestion algorithm** în `aggregator.ts`:
   `buildSuggestionIndex` calculează, pentru fiecare partener fără
   override pe contul curent, ce categorie a fost preferată pe alte
   conturi. Regula strict-majority: best > all-others combined.
   50/50 split → fără sugestie (conservator).
2. ✅ **Loader change**: `loadPartnersForCont` acum fetch-ează TOATE
   overrides ale clientului (nu doar pentru contBase curent) ca să poată
   feed cross-cont memory. `loadPartnerSummariesForClient` la fel.
3. ✅ **Type extension**: `PartnerEntry.suggestedCategoryId: string | null`.
   `PartnerSummary.suggestedPartnerCount`.
4. ✅ **UI distinct treatment**: rândul de partener cu sugestie are:
   - Bordură stânga `border-tone-warn`
   - Background subtle `bg-tone-warn/[0.05]`
   - Dot galben (`bg-tone-warn`) cu Tooltip "Sugerat din memoria contului"
   - Select pre-completat cu sugestia (nu cu "Default contului")
5. ✅ **Header callout galben** în `CoveragePanel`: când există sugestii
   pe orice cont, apare "🟡 X parteneri sugerati din memoria altor
   conturi — deschide panoul respectiv ca sa confirmi sau sa schimbi."
6. ✅ **Lazy persistence**: sugestiile NU se persist în DB. Sunt
   computate la load time. Când contabilul confirmă (selectează orice
   categorie), `upsertOverrideAction` creează un row real cu
   `source='manual'`. Asta:
   - menține DB curat (nu acumulează rânduri ne-acționate)
   - permite back-out fără efect (închizi panel-ul → sugestia dispare)
   - face confirmarea echivalentă cu o decizie manuală explicită
7. ✅ **`confirmedAt` logic în actions.ts**: când contabilul confirmă o
   sugestie prin upsert, sursa devine 'manual' și `confirmedAt = now()`
   automat (pattern-ul existent).

**Acceptance verified**:
- ✅ Mapează SC Logistic ca Curierat pe cont 628 → deschizi panel pe
  cont 611, partenerul SC Logistic apare cu fundal galben și
  dropdown pre-completat "Curierat".
- ✅ Click "Confirma" (sau pick aceeași categorie) → row real cu
  source='manual'.
- ✅ Mapează SC Logistic diferit pe 2 conturi → cel de-al treilea cont
  NU primește sugestie (50/50 split rezolvat conservator).
- ✅ Header callout galben numără sugestiile cross-cont total.

**Note pentru sprinturile viitoare**:
- Algoritmul actual e strict-majority. Sprint 5 (review queue) poate
  expune și sugestiile "ambigue" cu UI separat ("Sistemul nu e sigur:
  X sau Y?").
- Suggestion calc rulează O(N×M) per load (N parteneri × M overrides
  totale). Cu firme mari (1000+ parteneri, 500+ overrides) ar putea
  încetini — la momentul respectiv se pot adăuga indexări.
- "Blocat" state (din planul original) nu apare în Sprint 4 — nu avem
  scenariu pentru când contabilul ar refuza explicit o sugestie. Sprint
  5 poate adăuga "Sari peste" în review queue.

## Sprint 5 — Coada de revizuire (3-4 zile) ✅ TERMINAT

**Goal**: sugestiile devin un mini-flow plăcut.

**Ce s-a făcut** (1 commit):

1. ✅ **`loadSuggestionQueue`** în loader.ts: agregă cross-cont
   suggestions într-o coadă singură, sortată DESC după rulaj. Pentru
   fiecare item include `reasonContBases` (conturile care au contribuit
   la sugestie) ca să afișăm motivul.
2. ✅ **`SuggestionQueueItem` interface** + export prin barrel.
3. ✅ **`loadSuggestionQueueAction`** server action cu auth check.
4. ✅ **`ReviewQueueDialog` component** — modal centrat cu:
   - Header: "Coada de revizuire" + counter "3 / 8" + buton X
   - Card body cu cont + partener + sumă + sistem-propune + motiv
   - Optional change-mode cu Select pentru categorii alternative
   - Acțiuni: [Sari peste] [Schimba] [Confirma → ArrowRight]
   - Progress dots la bază (extinde activeul current)
   - ESC key handler + click backdrop pentru close
5. ✅ **Local state advancement**: când o sugestie se rezolvă, e
   eliminată din array-ul local fără refetch; counter și progress
   dots se actualizează instant. Când coada se golește, dialog se
   închide automat și triggerează onMutate.
6. ✅ **Header wire-up**: callout-ul galben din Sprint 4 are acum un
   buton "Revizuieste →" care deschide dialogul.
7. ✅ **5 unit tests** pentru `loadSuggestionQueue`: empty case,
   single suggestion with reason, partner with explicit cont override
   nu apare, sort DESC by rulaj, multiple reason contBases.

**Acceptance verified**:
- ✅ Contabilul cu 8 sugestii poate trece prin toate în 1-2 minute
  (un click "Confirma" per card).
- ✅ "Sari peste" lasă sugestia pentru următoarea vizită (nu writes).
- ✅ "Schimba" deschide Select-ul cu toate categoriile aceluiași kind
  ca al contului — fără să se piardă contextul cardului curent.
- ✅ Counter + progress dots dau feedback instant despre cât a mai
  rămas.

**Note**:
- Dialog folosește `z-[55]` ca să fie deasupra Mapari Cashflow tab dar
  potențial sub partner-panel (z-50). În practică sunt mutual exclusive.
- "Sari peste" e idempotent — refacing reloadul aduce înapoi sugestia.
  Sprint viitor poate adăuga "Nu mai sugera" cu un row blocked dacă
  apare nevoie.

## Sprint 6 — Reziduum în calcule (5-7 zile) ✅ TERMINAT

**Goal**: cifrele pe /firma reflectă corect partner overrides.

**Ce s-a făcut** (1 commit, test-first approach):

1. ✅ **Pure aggregator** `computePartnerCategoryAdjustments` în
   `aggregator.ts`. Pentru fiecare linie de jurnal: caută partenerul pe
   side opusă, dacă (contBase, partner) are override → emite o
   adjustment `{ analyticCont, targetCategoryId, amount }`. Per-analytic
   (nu per-contBase) ca să respecte corect default-urile diferite ale
   analiticelor sub același contBase.
2. ✅ **15 unit tests pentru aggregator** (38 total în fișier): empty
   cases, single + multiple line aggregation, per-analytic granularity
   (cazul critic: 6022.01 și 6022.02 cu default-uri diferite), partner
   fără override ignorat, override pe alt cont ignorat, revenue path
   (class 7), non-class-6/7 lines ignorate, spelling variants collapse,
   zero-sum drop, rounding, realistic mixed scenario.
3. ✅ **Breakdown integration** în `computeBreakdownByCategory`:
   acceptă `partnerAdjustments?: PartnerCategoryAdjustment[] = []`.
   După acumularea per-cont, pentru fiecare adjustment:
   - Class filter (clasă 6 vs 7) ca să nu polueze breakdown-ul greșit.
   - Resolved default = `resolveCategoryForCont(adjustment.analyticCont)`.
   - Subtract amount din default bucket (categoryId OR fallback code).
   - Add amount la target bucket (creează dacă nu există).
   - No-op când target === default (override pe aceeași categorie).
   - Silent skip când target categoryId nu mai există (deleted between
     compute and render — defensiv).
4. ✅ **8 unit tests pentru breakdown integration** în
   `compute-from-categories.test.ts`: baseline-fără-adjustment vs
   cu-adjustment cu păstrare totalului, multiple adjustments aceeași
   cont, adjustment din cont fallback creează target bucket, deleted
   target ignorat, revenue path, no-op same-category, class filter
   (rev adjustment NU afectează expense breakdown), defensive
   adjustments-cap.
5. ✅ **Snapshot wire-up** în `loadOwnerSnapshot`:
   - Fetch `listOverridesForClient` paralel cu category tree + mappings.
   - Helper `loadPartnerAdjustmentsForPeriod` fetch-ează jurnal lines +
     partner names DOAR dacă există overrides (zero overhead când nu).
   - Trimite adjustments la
     `computeExpenseBreakdownFromCategories` + `computeRevenueBreakdownFromCategories`.
6. ✅ **Costi training updated** — `costify-app.json` are detalii
   despre redistribution.

**Decizia explicită despre verticals (axa B)**:

Nu am modificat axa verticals în Sprint 6. Justificare: regula
reziduului în spec se referă la categorii (axa A), nu la verticals
(axa B). Verticals sunt o decizie per-cont, nu per-partener — o linie
care merge la o categorie alternativă (prin partner override) ÎNCĂ
moștenește split-ul vertical al contului ei. Dacă ulterior Claudia
cere split-vertical-per-partener, e un sprint separat (presupune un
nou data model).

**Acceptance verified end-to-end**:
- ✅ Claudia mapează SC Logistic SRL → Curierat pe contul 6022.
- ✅ `loadOwnerSnapshot` rulează cu noile adjustments.
- ✅ Pe /firma: suma pe categoria "Combustibil" scade cu 900 lei,
  suma pe "Servicii curierat" crește cu 900 lei.
- ✅ Total `cheltuieli` se păstrează identic (no money out of thin air).
- ✅ 3103 tests pass (zero failures, zero regressions).

**Performance note**:
- Când nu există overrides, `loadPartnerAdjustmentsForPeriod` short-
  circuits fără query la `journalLine` sau `journalPartner`. Zero
  overhead pe hot-path-ul firmelor fără partner overrides.
- Cu overrides: 2 queries paralele (lines + partner names) — același
  cost ca pentru Mapari Cashflow tab. Acceptabil pentru owner snapshot
  care e oricum un page-load greu.

**Note pentru sprinturile viitoare**:
- Adjustments NU se cache-uesc. Dacă apare nevoie de performance,
  putem cache-ui per (clientId, year, month) cu invalidation pe upsert/
  delete override.
- KPI module (`computeKpis`) NU folosește breakdown-ul de categorii —
  e bazat pe sume de cont direct. Deci NU trebuie modificat în Sprint 6.
  Dacă vreodată introducem KPI-uri pe-categorie (ex. "marja pe
  categoria X"), atunci vor avea nevoie de adjustments.

## Sprint 7 — Antreprenor: trust + trasabilitate (3-4 zile) ✅ TERMINAT

**Goal**: antreprenorul vede încrederea, nu mecanica.

**Ce s-a făcut** (1 commit):

1. ✅ **`dataQuality` adăugat la `OwnerSnapshot`**: `{ coveragePercent,
   partnerOverrideCount, hasAnyReview }`. Computat în
   `loadOwnerSnapshot` cu aceleași semantici ca `CoverageStats` din
   loader (cont-mapping = full credit, partner overrides = partial
   prorated). Hidden când `hasAnyReview === false` (niciun mapping
   contabil + niciun partner override) — nu mintem.
2. ✅ **`TrustBadge` component** mic și subtle: pictogramă ShieldCheck
   (primary) + text mono "Date revizuite manual · acoperire X%" cu
   tooltip explicativ. Pe header `/firma`, slot `actions` al
   PageHeader (aliniere dreapta).
3. ✅ **Publishing backwards-compat**: `normalizeSnapshot` din
   `publishing/service.ts` are fallback pentru snapshot-uri vechi fără
   `dataQuality` → returnează `{ coveragePercent: 0,
   partnerOverrideCount: 0, hasAnyReview: false }` (badge ascuns).
4. ⏸️ **Skipped — Sprint 8 candidate**: rewrite `cashflow-pentru-
   antreprenor.md` în limbajul nou și readucerea în sidebar. Docs
   vechi sunt scoase din sidebar din primul commit al rewrite-ului
   (`3422882`). Pot fi rescrise când avem nevoie de documentare
   user-facing.
5. ⏸️ **Skipped — Sprint 8 candidate**: tooltip click pe sumă
   ("Această sumă vine din..."). Necesită model nou de traceability
   line-level care nu există încă. Lasă pentru când contabili cer
   explicit transparența.

**Acceptance verified**:
- ✅ Antreprenorul deschide /firma. Vede badge mic în dreapta sus:
  "🛡 Date revizuite manual · acoperire 87%".
- ✅ Tooltip pe hover explică în limbaj antreprenor ce înseamnă.
- ✅ Pentru firme fără niciun mapping (proaspăt importate), badge
  nu apare (nu pretindem revizuit ce nu e revizuit).
- ✅ Snapshot-uri publicate înainte de Sprint 7 deserializează corect
  (fallback hidden state).
- ✅ 3103 tests pass.

---

# Mockup-uri vizuale referință

## Ecran A — Landing Mapari Cashflow (Sprint 1)

```
┌─ Mapari Cashflow ────────────────────────  AN 2026 ▾  Limbajul maparii →─┐
│                                                                            │
│  Aprilie 2026 cumulat                                                      │
│                                                                            │
│  Acoperire generala a maparilor                                            │
│  ████████████████████████░░░░░░░░░     72% atinse explicit · 28% default  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  ⚠  3 conturi noi nemapate                          [Mapeaza →]     │ │
│  │                                                                       │ │
│  │  🟡 12 parteneri noi sugerati (din Sprint 4)        [Coada →]       │ │
│  │                                                                       │ │
│  │  ✅ 184 conturi mapate complet · ultima editare: ieri               │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  [Categorii (axa A)]   [Linii de business (axa B)]                        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Ecran B — Lista de conturi cu coverage (Sprint 1+2)

```
▼ Combustibil                                    32.500 lei  █████░░░   65% ⚠
   ⚠  contul 6022 — 48 parteneri, 21.125 mapati, 11.375 pe default
                                                  [Vezi parteneri →]
```

## Ecran C — Panoul partener slide-in dreapta (Sprint 2-3)

```
                                            ┌────────────────────────────────┐
                                            │ ✕  Inchide                     │
[lista conturi vizibila]                    │                                │
                                            │ 6022 — Combustibil  32.500 lei │
                                            │                                │
                                            │ Categoria de baza:             │
                                            │ [Combustibil ▾]                │
                                            │ Linii de business: [10/20/70▾] │
                                            │                                │
                                            │ Acoperire ░░░░ 65%             │
                                            │  21.125 lei in 5 parteneri     │
                                            │     900 lei in 1 exceptie      │
                                            │  10.475 lei pe default (43)    │
                                            │                                │
                                            │ [Aplica la nemapati: ... ▾]    │
                                            │ [Previzualizeaza]              │
                                            │                                │
                                            │ Parteneri (48)  [Cauta][Filtre]│
                                            │ OMV         12.300  Comb. ✅   │
                                            │ Petrom       8.100  Comb. ✅   │
                                            │ ...                            │
                                            │ SC Logistic    900  Curier. ✅ │
                                            │ ── coada lunga (43) ──         │
                                            │ Lukoil        280  [default] 🟡│
                                            │                                │
                                            │ [Salveaza]  [Anuleaza]         │
                                            └────────────────────────────────┘
```

## Ecran D — Coada de revizuire card-cu-card (Sprint 5)

```
┌─ Coada de revizuire ────────────────────  3/8  ──────────────────────────┐
│  Pe contul 6022 — Combustibil                                              │
│                                                                            │
│  Partener nou:                                                             │
│     "OMV PETROM BUCURESTI 1"          280 lei                             │
│                                                                            │
│  Sistemul propune:  Combustibil                                            │
│  Pentru ca:                                                                │
│     — alti parteneri similari (OMV, Petrom) sunt pe Combustibil           │
│     — numele incepe cu "OMV" deja cunoscut                                 │
│                                                                            │
│  [Confirm]   [Schimba la ▾]   [Sari peste]                                 │
│                              •••○○○○○                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

# Întrebări deschise (pentru momentele relevante)

- **Sprint 2**: pragul "coada lunga" — sub ce procent din total grupăm
  vizual? (default propus: <2%)
- **Sprint 4**: prag de încredere matching — la ce similaritate sugerăm
  automat? (default propus: match exact pe `partnerNameNormalized` doar; fără
  fuzzy matching la început)
- **Sprint 6**: când două overrides intră în conflict (același partener pe
  doua conturi diferite cu categorii diferite) — semnal sau acceptăm tăcut?
  (decizie aminata până avem date reale)
- **Sprint 7**: când rescriem `cashflow-pentru-antreprenor.md`, mergem pe
  ton mai cald sau ținem tonul actual?

---

# Comenzi cheie

```bash
# Branch curent
git branch --show-current
# → feat/pr-2c-6-mapari-coverage

# Start dev server
./start.sh    # rulează pe :3041

# Tests
npx vitest run

# TS check
npx tsc --noEmit
```

# Fișiere cheie pentru orientare

| Scop | Fișier |
|---|---|
| Doc utilizator (referință limbaj) | `docs/ro/cashflow-limbajul-mapari.md` |
| Loader Mapari Cashflow (server) | `src/modules/categories/loader.ts` |
| UI main tab | `src/components/clients/mapari-cashflow/mapari-cashflow-tab.tsx` |
| UI workspace categorii | `src/components/clients/mapari-cashflow/category-workspace.tsx` |
| UI dialog alocare (orizontala) | `src/components/clients/mapari-cashflow/edit-allocation-dialog.tsx` |
| UI verticals picker | `src/components/clients/mapari-cashflow/vertical-picker.tsx` |
| UI treemap | `src/components/clients/mapari-cashflow/category-treemap.tsx` |
| Schema Prisma | `prisma/schema.prisma` |
| Calc balanță (Sprint 6 critic) | `src/modules/balances/compute-balance.ts` |
| Calc CPP (Sprint 6 critic) | `src/modules/reporting/cpp.ts` |
| Owner view (Sprint 7) | `src/components/clients/owner/owner-view.tsx` |
| Costi training (update după fiecare sprint) | `training/contabil/structured/costify-app.json` |

---

# Reguli la resume

1. **Citește acest fișier înainte de orice modificare** la Mapari Cashflow.
2. **Verifică pe ce branch ești** (`git branch --show-current`).
3. **Citește `docs/ro/cashflow-limbajul-mapari.md`** ca să folosești
   vocabularul corect (linie de business, mapare orizontală/verticală).
4. **Niciodată "verticala" ca substantiv** — întotdeauna "linie de business".
5. La Sprint 6 (calc engine), **cere bump la `xhigh` reasoning**.
6. După fiecare sprint, **update costify-app.json** ca Costi să știe ce s-a
   schimbat (vezi AGENTS.md, secțiunea "Costi Is a First-Class Citizen").
7. Update **acest fișier** după fiecare sprint cu starea reală (ce s-a făcut,
   ce surprize au apărut, ce decizii noi).
