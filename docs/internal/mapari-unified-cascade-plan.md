# Mapari — Design unificat: cascada liniilor de business

> **Stare**: 🚧 **IN LUCRU** — branch `feat/pr-2c-6-mapari-coverage`.
> **Plan creat**: mai 2026, dupa discutia cu Corii pe unificarea taburilor
> "Categorii" si "Linii de business".
> **Acest document e contractul de referinta** pentru lucrarea curenta. La
> orice resume de sesiune, citeste-l intai. Continua direct dupa
> `mapari-cashflow-ux-rewrite-plan.md` (care e ✅ TERMINAT pentru lucrarea
> anterioara de coverage si listeaza "per-vertical partner splits" ca
> candidat de viitor — exact ce construim aici).

---

## 1. Problema

Azi avem doua suprafete separate in Mapari:
- **Categorii** — mapezi fiecare cont 6/7 la o categorie de cost (coloana
  vertebrala, se schimba rar).
- **Linii de business** (verticale, axa B) — aloci rulajul unui cont catre una
  sau mai multe linii de business prin `VerticalAllocation`.

Sunt percepute ca doua lucruri de configurat separat, desi descriu acelasi
jurnal. Antreprenorul gandeste in "cat castig pe Outsourcing vs Recruiting", iar
contabilul gandeste in categorii + conturi. Vrem **o singura suprafata**, unde
categoriile raman backbone-ul vizibil, iar impartirea pe linii de business e un
control care **cade in cascada** de sus in jos.

## 2. Conceptul-cheie: split-ul pe CATEGORIE cade in cascada

Unitatea principala pe care o editeaza contabilul este **categoria**. Cand pui
pe categoria "Marfa, materii prime si materiale" un split de
**40% Outsourcing / 60% Recruiting**, acel split se aplica automat:
- la **toate conturile** din acea categorie (si subcategoriile ei),
- la **toti partenerii** din acele conturi,

fara sa-l mai stampilezi nicaieri. E o **regula**, nu un snapshot lunar: se
aplica live, in fiecare luna, pana cand cineva pune o regula mai specifica.

### Reguli de produs

- **Doar procente.** Fara chei dinamice de alocare (m², ore, headcount). Un
  procent setat se aplica automat in fiecare luna. (Superseda partial
  `temp/mapare-conturi-reguli.md`, care propunea chei dinamice.)
- **Categoriile sunt backbone-ul.** Se schimba rar; raman vederea principala.
- **Mostenire live, nu re-stampilare.** Firm-top e o singura regula pe care
  conturile/partenerii o mostenesc live. Doar override-urile manuale sunt
  "pinned". Nu re-stampilam la re-split.
- **"Urmeaza linia de business"** = mosteneste nivelul de deasupra (nu mai
  "urmeaza contul" pe categorie, ci urmeaza split-ul de LOB din nivelul
  superior).

## 3. Cascada (cel mai specific castiga)

Pentru orice linie de jurnal (cont `C` in categoria `Cat`, partener `P`):

| # | Nivel | Sursa de date | Stare |
|---|-------|---------------|-------|
| 1 | **Partener** override pe `(C, P)` | `PartnerVerticalAllocation` | ⏳ Faza 2 (NEW) |
| 2 | **Cont** override pe `C` (analytic > contBase > prefix) | `VerticalAllocation` | ✅ exista |
| 3 | **Categorie** split pe `Cat` (sau orice **stramos** al ei) | `CategoryVerticalAllocation` | ✅ exista |
| 4 | **Firm-top** default | `FirmVerticalDefault` | ✅ NEW (push facut) |
| 5 | **Legacy** default vertical 100% (`Vertical.isDefault`) | `Vertical` | ✅ exista |

Important: split-ul pe categorie e **parent-aware**. Daca "Marfa" e o categorie
parinte si conturile cad pe subcategorii, split-ul de pe parinte se aplica la
toti copiii. Se cauta de la frunza in sus pe lant; cel mai specific castiga.

## 4. Model de date

Reutilizam masiv ce exista. Doua singure adaugiri fata de modelul vechi:

```
FirmVerticalDefault {           // NEW — top-ul cascadei
  id        String @id
  clientId  String @unique      // o singura regula per firma
  splits    Json                // [{ verticalId, percent }], suma = 100
  createdAt, updatedAt
}

CategoryVerticalAllocation {    // EXISTA — devine unitatea principala editata
  clientId, categoryId @unique, splits Json, primaryVerticalId
}

VerticalAllocation {            // EXISTA — override pe cont
  clientId, cont, scope (analytic|contBase), splits Json
}

PartnerVerticalAllocation {     // ⏳ Faza 2 — override pe partener
  clientId, cont, partnerKey, splits Json
}
```

`FirmVerticalDefault` a fost adaugat in `prisma/schema.prisma` si pus pe DB
(`prisma db push`) atat pe DB-ul local (`.env`, :5432) cat si pe DB-ul
**clusterului** (`.env.local`, :55432) — pe cel din cluster citeste aplicatia
si va citi prod (deploy-ul nu ruleaza migrari, doar `prisma generate`).

## 5. Resolver

`src/modules/verticals/resolver.ts`:
- `VerticalResolverState` are acum si `firmDefaultSplits: AllocationSplit[] | null`.
- `resolveAllocationForCont(cont, state, categoryPath)` — `categoryPath` e
  lantul de categorii ordonat frunza→radacina; primul cu split castiga.
  Cascada: cont (analytic/base/prefix) → categorie (lant) → firm-top → legacy.
- `matchedScope` poate fi acum si `"firm"` (pe langa `analytic`/`contBase`/
  `category`/`default`), ca UI-ul sa eticheteze onest randul.

## 6. Serviciu + actiuni

`src/modules/verticals/service.ts`:
- `getFirmDefaultSplits`, `setFirmDefaultSplits`, `clearFirmDefaultSplits`.
- `deleteVertical` curata si firm-top (drop + renormalizare ca la celelalte).

`src/modules/verticals/actions.ts`:
- `setFirmDefaultAction`, `clearFirmDefaultAction` — auth + audit
  (`entityType: "firm_vertical_default"`) + `bumpClientDataVersion`.

## 7. Loader

`src/modules/categories/loader.ts` (`loadMapariCashflow` / `MapariCashflowData`):
- expune `firmDefaultSplits`;
- pentru fiecare cont, `effectiveAllocation: { splits, source }` unde `source`
  ∈ `own | category | firm | default`, ca UI-ul sa arate "Regula proprie" vs
  "Urmeaza categoria" vs "Urmeaza firma" fara recalcul pe client.

## 8. UI (plan)

`src/components/clients/mapari-cashflow/` (entry `mapari-cashflow-tab.tsx`):
- **Banda de sus**: chips cu liniile de business + setter pentru firm-top split
  + "Aplica" cu confirmare de impact ("Se aplica 40/60 la N conturi.
  M conturi au reguli proprii si raman neatinse.").
- **Pe fiecare CATEGORIE** (header): control de split — unitatea principala.
  Aici pui "Marfa → 40/60".
- **Pe fiecare CONT**: arata starea mostenita ("Urmeaza categoria X/Y" /
  "Urmeaza firma X/Y") vs regula proprie (dot custom); permite override.
  Schimbarea categoriei contului devine o actiune discreta
  `⋯ → Muta in alta categorie`.

## 9. Owner / reporting

`computeVerticalBreakdown` (`src/modules/reporting/owner/compute.ts`) primeste
acum `categoryResolver` si rezolva `categoryPath` per cont, ca treemap-ul de pe
`/firma` sa onoreze split-urile pe categorie. `snapshot.ts` incarca
`firmDefaultSplits` si paseaza `resolverState`.

## 10. Stare: facut vs ramas

**Facut**
- [x] `FirmVerticalDefault` in schema + `db push` (local + cluster).
- [x] Resolver: cascada cont → categorie (parent-aware) → firm-top → legacy.
- [x] Serviciu + actiuni firm-top; cleanup in `deleteVertical`.
- [x] Owner snapshot/compute pe cascada noua.
- [x] Teste unit resolver (mostenire categorie, parent-cascade, firm-top).

**Ramas**
- [ ] Loader: `effectiveAllocation` per cont + `firmDefaultSplits` in payload.
- [ ] UI: split pe header de categorie (principal) + setter firm-top pe banda.
- [ ] UI per-cont: stare mostenita vs proprie + override.
- [ ] Typecheck + full unit (baseline 3237 pass) + smoke local.
- [ ] **Faza 2**: `PartnerVerticalAllocation` (override pe partener).
- [ ] Costi: tools + `costify-app.json` + teste (feature nu e shipped pana
  Costi nu o poate explica/interoga).
- [ ] Docs RO user-facing (`cashflow-*`) — dupa ce feature-ul merge.

## 11. Context critic

- Test client: `qhm21-network-srl` (id `...-seed`), 16.802 linii jurnal.
- `/api/mapari-cashflow` ~450ms warm; render full Mapari ~3-5s in dev.
- Nu deploy fara OK explicit (faza de test local). Branch:
  `feat/pr-2c-6-mapari-coverage`.
</content>
</invoke>
