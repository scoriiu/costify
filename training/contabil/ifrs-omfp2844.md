# IFRS în România — OMFP nr. 2844/2016

Baza legală: **Ordinul Ministrului Finanțelor Publice nr. 2844/2016** pentru aprobarea Reglementărilor contabile conforme cu Standardele Internaționale de Raportare Financiară (IFRS), cu modificările și completările ulterioare.

---

## Cine aplică IFRS în România

### Entități obligate

1. **Entitățile ale căror valori mobiliare sunt admise la tranzacționare pe o piață reglementată** (societăți listate la BVB)
2. **Instituțiile de credit** (bănci) — conform reglementărilor BNR
3. **Societățile de asigurare / reasigurare** — conform reglementărilor ASF
4. **Entitățile de interes public** care depășesc anumite praguri

### Entități care pot opta

Entitățile care nu sunt obligate pot opta pentru aplicarea IFRS dacă:
- Fac parte din grupuri internaționale care raportează în IFRS
- Își doresc raportare aliniată cu standardele internaționale

### Relația cu OMFP 1802/2014

| Aspect | OMFP 1802/2014 | OMFP 2844/2016 (IFRS) |
|---|---|---|
| Baza | Directivele europene contabile | IFRS emise de IASB |
| Cine aplică | Majoritatea entităților | Entități listate + bănci + asigurări + opțiune |
| Plan de conturi | Plan de conturi general românesc | Același plan de conturi, dar cu reguli IFRS de recunoaștere/evaluare |
| Situații financiare | Format prescris de OMFP | Format prescris de IAS 1, dar cu plan de conturi RO |
| Tratament fiscal | Direct legat de contabilitate | Diferențe temporare/permanente → contabilitate de impozit amânat |

---

## Standarde IFRS esențiale pentru practică românească

### IAS 1 — Prezentarea situațiilor financiare

**Situații financiare complete conform IAS 1:**
1. Situația poziției financiare (bilanțul) la finalul perioadei
2. Situația profitului sau pierderii și a altor elemente ale rezultatului global
3. Situația modificărilor capitalurilor proprii
4. Situația fluxurilor de trezorerie
5. Note (politici contabile semnificative + alte informații)
6. Situația poziției financiare la începutul perioadei precedente (dacă se aplică retroactiv o politică sau se fac retratări)

**Diferențe față de OMFP 1802:**
- IAS 1 permite clasificarea cheltuielilor după natură SAU după funcție (OMFP 1802 impune natura)
- OCI (Other Comprehensive Income) — element separat, inexistent ca atare în OMFP 1802
- Mai multă flexibilitate în formatul bilanțului

### IAS 2 — Stocuri

- Evaluare la **cel mai mic dintre cost și valoarea realizabilă netă**
- Metode permise: FIFO, CMP (la fel ca OMFP 1802)
- LIFO interzisă (la fel ca OMFP 1802)
- Diferență: criteriile de capitalizare a costurilor indirecte sunt mai riguroase sub IFRS

### IAS 12 — Impozitul pe profit

**Acesta este standardul cu cel mai mare impact în practica românească.**

**Impozitul amânat** — concept inexistent în OMFP 1802/2014 dar obligatoriu sub IFRS:

- **Diferență temporară**: diferența dintre valoarea contabilă a unui activ/datorie și baza sa fiscală
- **Diferență temporară deductibilă** → generează **creanță de impozit amânat** (activ)
- **Diferență temporară impozabilă** → generează **datorie de impozit amânat** (pasiv)

**Exemple practice:**
- Amortizare contabilă ≠ amortizare fiscală → diferență temporară
- Provizioane constituite contabil dar nedeductibile fiscal → diferență temporară deductibilă (creanță de impozit amânat — se va deduce în viitor când se materializează pierderea)
- Reevaluare active care nu se impozitează la momentul reevaluării → diferență temporară impozabilă

**Calcul:**
```
Datorie/Creanță impozit amânat = Diferență temporară × Cota de impozit (16%)
```

**Conturi:**
- 4412 Impozit pe profit amânat (datorie)
- 4412 Impozit pe profit amânat (creanță) — sau cont separat 441x

### IAS 16 — Imobilizări corporale

- Recunoaștere la cost (la fel ca OMFP 1802)
- Evaluare ulterioară: **model cost** (cost – amortizare – depreciere) SAU **model reevaluare** (valoarea justă – amortizare – depreciere)
- Sub OMFP 1802, reevaluarea este permisă dar mai puțin frecventă. Sub IFRS, dacă se alege modelul reevaluare, trebuie aplicat cu regularitate.
- **Componentizare**: sub IFRS, componentele semnificative ale unui activ se amortizează separat. Sub OMFP 1802, componentizarea este permisă dar nu obligatorie.

**Diferență practică majoră**: Sub IFRS, la cumpărarea unei clădiri, acoperișul, instalațiile HVAC, structura pot avea durate de amortizare diferite. Sub OMFP 1802, de regulă se amortizează ca un singur activ.

### IAS 36 — Deprecierea activelor

- Test de depreciere: se face când există **indicii** de depreciere (nu automat anual, cu excepția fondului comercial)
- Dacă valoarea recuperabilă < valoarea contabilă netă → pierdere din depreciere
- Valoarea recuperabilă = max(valoarea justă – costuri de vânzare, valoarea de utilizare)
- Sub OMFP 1802, conceptul similar este **ajustarea pentru depreciere**, dar procedura este mai puțin formalizată

### IAS 37 — Provizioane, datorii contingente, active contingente

- Provizioane: obligație curentă + probabilă + estimabilă → recunoaștere
- Datorii contingente: posibilă dar nu probabilă → prezentare în note (nu recunoaștere)
- Active contingente: nu se recunosc, se prezintă doar dacă sunt probabile
- Diferență față de OMFP 1802: sub IFRS, actualizarea la valoarea prezentă (discounting) este obligatorie dacă efectul este semnificativ

### IAS 38 — Imobilizări necorporale

- Recunoaștere: identificabil + controlabil + beneficii economice viitoare
- Fond comercial generat intern: INTERZIS la recunoaștere (la fel ca OMFP 1802)
- Cheltuieli de cercetare: cheltuiala perioadei (nu se capitalizează)
- Cheltuieli de dezvoltare: capitalizabile dacă se îndeplinesc 6 criterii cumulative
- Durata de viață: determinată (se amortizează) sau nedeterminată (nu se amortizează, dar test anual de depreciere)

### IFRS 9 — Instrumente financiare

- Clasificare: cost amortizat, valoare justă prin OCI, valoare justă prin profit sau pierdere
- Model de depreciere bazat pe **pierderi de credit așteptate** (expected credit losses) — nu pe pierderi constatate
- Impact major pe ajustări creanțe: sub IFRS 9, ajustarea se constituie de la recunoașterea inițială a creanței, nu doar când apare un eveniment de default

### IFRS 15 — Venituri din contracte cu clienții

**Model în 5 pași:**
1. Identificarea contractului cu clientul
2. Identificarea obligațiilor de performanță din contract
3. Determinarea prețului tranzacției
4. Alocarea prețului la obligațiile de performanță
5. Recunoașterea venitului când (sau pe măsură ce) obligația de performanță este satisfăcută

**Diferență majoră**: Sub OMFP 1802, recunoașterea veniturilor este mai simplă (la transfer de proprietate sau prestare serviciu). Sub IFRS 15, analiza este granulară — un contract poate conține multiple obligații de performanță cu momente diferite de recunoaștere.

### IFRS 16 — Contracte de leasing

**Schimbare fundamentală față de IAS 17 / OMFP 1802:**

Sub IFRS 16, **leasingul operațional** dispare pentru locatar. Toate contractele de leasing (cu durata > 12 luni și peste pragul de valoare mică) generează:
- Un **activ cu drept de utilizare** (right-of-use asset) — în bilanț
- O **datorie de leasing** (lease liability) — în bilanț

**Impact practic**: O firmă cu contract de închiriere birou pe 5 ani, sub OMFP 1802, înregistrează chiria ca cheltuiala lunară (612). Sub IFRS 16, recunoaște activul și datoria în bilanț, amortizează activul și plătește dobândă + principal pe datorie.

**Excepții IFRS 16:**
- Contracte pe termen scurt (≤ 12 luni)
- Active de valoare mică (< ~5.000 USD echivalent, ca prag orientativ)

---

## Tratamentul fiscal al diferențelor IFRS

### Principiul general

Obligațiile fiscale din România se determină conform **Codului fiscal**, nu conform standardelor contabile. Însă baza de calcul a impozitului pe profit pornește de la **rezultatul contabil**.

Entitățile care aplică IFRS calculează impozitul pe profit astfel:
1. Determină rezultatul contabil conform IFRS
2. Aplică **ajustările fiscale** prevăzute de Codul fiscal (cheltuieli nedeductibile, venituri neimpozabile, amortizare fiscală vs. contabilă etc.)
3. Obțin profitul impozabil

### Diferențe cu impact fiscal frecvent

| Element IFRS | Tratament contabil | Tratament fiscal |
|---|---|---|
| Amortizare IFRS 16 (drept de utilizare) | Se amortizează activul | Fiscal: se deduce chiria (conform contract) |
| Pierderi de credit așteptate (IFRS 9) | Cheltuială la recunoaștere | Fiscal: deductibil doar la condiții art. 26 CF |
| Reevaluare active (IAS 16) | Surplus în OCI (105) | Fiscal: nu se impozitează până la realizare |
| Venituri IFRS 15 (multi-obligație) | Recunoaștere graduală | Fiscal: poate diferi momentul recunoașterii |
| Impozit amânat (IAS 12) | Cheltuială/venit contabil | Fiscal: nu afectează impozitul curent |

---

## Situații financiare IFRS în format românesc

OMFP 2844/2016 impune ca entitățile care aplică IFRS să folosească **planul de conturi general românesc** (același ca cel din OMFP 1802/2014) dar cu regulile de recunoaștere și evaluare din IFRS.

Aceasta este o particularitate românească — în alte țări, entitățile IFRS pot folosi orice plan de conturi.

### Conciliere obligatorie

Entitățile care aplică IFRS trebuie să prezinte o **conciliere** între rezultatul conform IFRS și rezultatul fiscal (profitul impozabil).

---

## Relevanță pentru Costify

### Când activează modulul IFRS

Agentul trebuie să recunoască indiciile că un tenant aplică IFRS:
- Societate listată la BVB
- Instituție de credit
- Societate de asigurare
- Entitate care declară explicit aplicarea IFRS

### Diferențe de clasificare

Dacă tenant-ul aplică IFRS:
- Contractele de leasing generează active și datorii (nu doar cheltuială de chirie)
- Creanțele au ajustări ECL (expected credit losses) de la zi 1
- Veniturile complexe trebuie descompuse pe obligații de performanță
- Impozitul amânat trebuie calculat

### Configurare per-tenant

Costify ar trebui să permită configurarea regimului contabil per tenant:
- `accounting_framework: 'OMFP_1802' | 'IFRS'`
- Aceasta afectează regulile de clasificare, generarea situațiilor financiare, și calculul fiscal
