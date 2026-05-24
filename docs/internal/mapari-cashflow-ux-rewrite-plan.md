# Mapari Cashflow — UX Rewrite Plan

> **Stare**: în execuție pe branch `feat/pr-2c-6-mapari-coverage`.
> **Plan creat**: mai 2026, după discuția cu Corii pe limbajul Claudiei.
> **Acest document e contractul de referință** — la orice resume de sesiune,
> citește-l întâi ca să știi unde suntem și de ce.

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
| Sprint în lucru | **Sprint 4** — memorie + sugestii |
| Sprinturi terminate | 3 (Acoperire vizibilă, Panoul partener, Bulk+preview) |
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

## Sprint 4 — Memorie + sugestii (4-5 zile)

**Goal**: maparea verticală = muncă o singură dată.

**Subtasks**:
1. La load, pentru fiecare partener pe cont, dacă există un override
   anterior pentru același (contBase, partnerNameNormalized), pre-fill cu
   acel categoryId și source='suggested'
2. Stare vizibilă în UI: 🟡 sugerat / ✅ confirmat / 🔒 blocat
3. Detectare parteneri noi luna asta — au apărut acum, n-au mai avut
   override
4. Header callout: "🟡 X parteneri noi sugerati"
5. Click pe "păstrează" / "schimbă" → confirmedAt set

**Acceptance**: luna 2 după Sprint 2, contabilul vede 10 sugestii noi
și le tratează în 5 minute, nu reia de la zero.

## Sprint 5 — Coada de revizuire (3-4 zile)

**Goal**: sugestiile devin un mini-flow plăcut.

**Subtasks**:
1. Agregare sugestiilor în coadă (toate auto-suggested cross-firma)
2. Mini-flow UI card-cu-card:
   - "Sugestie 3/8"
   - "Pe contul X, partener Y, propunem categoria Z"
   - "Pentru că: ..." (de ce sugerăm — alți parteneri similari etc.)
   - Acțiuni: [Confirm] [Schimbă] [Sari peste]
3. Progress dots, ieșire oricând fără pierdere de date

**Acceptance**: 8 sugestii = 5 minute de click-uri plăcute, nu o listă
obositoare.

## Sprint 6 — Reziduum în calcule (5-7 zile) 🔴 CRITIC

**Goal**: cifrele pe /firma reflectă corect partner overrides.

**ATENȚIE**: aici se schimbă calculul KPI/CPP. Greșeli silențioase pot
da numere false antreprenorului. **Cere bump la `xhigh` reasoning aici.**

**Subtasks**:
1. Update `computeBalanceFromJournal` să țină cont de PartnerCategoryOverride:
   - Pentru fiecare jurnal line, dacă există override pe (contBase, partner),
     atribuie la categoria override
   - Altfel, fallback la categoria default a contului
2. Regula reziduului pentru orizontala:
   - Suma alocată via partner overrides nu intră în calcul orizontal
   - Orizontala se aplică pe reziduu = total cont − sume verticale
3. Update CPP module să respecte noile reguli
4. Update KPI computation
5. Update owner-view (sumele pe /firma)
6. **Tests extensiv** — acoperă toate combinațiile (doar default, doar
   orizontal, doar partener, ambele, multi-luni, multi-an)

**Acceptance**: pe /firma, după ce Claudia mapează SC Logistic ca
Curieratie, suma pe categoria Combustibil scade cu 900 lei, suma pe
Servicii curierat crește cu 900 lei. Totalurile se păstrează.

## Sprint 7 — Antreprenor: trust + trasabilitate (3-4 zile)

**Goal**: antreprenorul vede încrederea, nu mecanica.

**Subtasks**:
1. Trust badge mic pe header `/firma`:
   `Date revizuite manual de [contabil] · acoperire 92%`
2. (Opțional dacă timp) tooltip click pe sumă: "Această sumă vine din..."
3. Rewrite scurt al pages `cashflow-pentru-antreprenor.md` în limbajul nou
   și readucere în sidebar

**Acceptance**: antreprenorul deschide /firma și are senzația că datele
sunt îngrijite, fără să vadă mecanica.

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
