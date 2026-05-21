# Verticale (axa B) — referinta in profunzime

## Ce este o verticala

O **verticala** este o **linie de business** pe care patronul vrea sa o urmareasca SEPARAT de restul firmei.

Exemple:
- **QHM21 NETWORK SRL** → *Outsourcing*, *Recruitment*, *Coworking*
- **Restaurant cu 3 canale** → *Sala*, *Catering*, *Delivery*
- **Constructii cu mai multe proiecte** → *Proiect Bucuresti*, *Proiect Cluj*, *Service*
- **SaaS cu 2 produse** → *Produs A*, *Produs B*, *Consultanta*

Verticala raspunde la intrebarea: **"cati bani aduce si cati bani cheltuieste FIECARE linie de business?"**

---

## Ce NU este o verticala

Verticala NU este:

- ✗ **O categorie de cheltuiala** (acelea sunt pe axa A — *Salarii*, *Electricitate*, etc.). Vezi [Categorii (axa A)](/docs/cashflow-categorii).
- ✗ **Un client mare** (acelea apar automat in "Top cheltuieli / Top clienti", nu necesita verticala).
- ✗ **O perioada de timp** (luni, trimestre — sunt deja in pagina, nu necesita verticale).
- ✗ **Un departament intern** (HR, IT, Vanzari) — daca patronul vrea sa vada cat costa HR-ul, e o sub-categorie de Salarii, nu o verticala. Verticala = **sursa de venit**, nu cost center.

---

## Cele doua axe sunt independente

Verticalele si categoriile sunt **ortogonale**. Aceeasi cheltuiala poate exista pe ambele simultan:

:::mockup axes-diagram
:::

**De ce e important**: poti raspunde la doua intrebari diferite cu acelasi numar:
- "Cat platim pe electricitate in total?" → 12.000 lei (axa A — categorie)
- "Cat costa coworking-ul lunar?" → contributia din electricitate (60% × 12k = 7.200) + chirie + parte din salarii etc. (axa B — verticala)

Fara verticale, raspunsul la a doua intrebare nu exista. Tot ce vezi sunt totale globale.

---

## Cand activezi verticalele

### Activeaza daca:

1. **Firma are mai multe linii distincte de business** care concureaza intern pentru resurse (oameni, spatiu, atentie).
2. **Patronul a intrebat explicit** "vreau sa stiu cati bani aduce X versus Y".
3. **Vor exista decizii operationale concrete** bazate pe profitabilitatea fiecarei linii. Ex: "Outsourcing-ul subventioneaza Coworking-ul, gandeste-te daca inchidem Coworking-ul".

### NU activa daca:

1. **Firma are o singura linie de business** (cea mai comuna situatie). Tot ce face firma e sub aceeasi umbrela. Verticalele nu adauga valoare.
2. **Patronul nu intelege diferenta** dintre "venituri pe linii" si "venituri pe categorii". Lasa-l prima data sa vada pagina globala. Dupa 1-2 luni de utilizare, va sti exact ce vrea.
3. **Toate cheltuielile sunt deja in categorii separate**. Daca esti restaurant si Sala vs Delivery au conturi complet diferite (Sala = doar 605/641 sediu fizic, Delivery = doar 624 transport), poti vedea defalcarea fara verticale, doar prin categorii.

---

## Activarea (pasul 2 in Mapari Cashflow)

Click pe **Activeaza verticale**. Apare modalul de bootstrap unde scrii numele initiale ale liniilor de business:

:::mockup activate-modal
:::

Save → sistemul creeaza N row-uri vizibile + 1 "Toata firma" (implicita, nu poate fi stearsa). Toate conturile devin alocate la "Toata firma" pana le mutam. Sectiunea Verticalele firmei arata acum:

:::mockup verticals-list
:::

---

## Verticala implicita "Toata firma"

Cand activezi, sistemul creeaza automat o verticala speciala numita **Toata firma** (sau ce nume vrei tu — poate fi redenumita).

Aceasta verticala:

- **Nu poate fi stearsa**. Este intotdeauna ultima optiune.
- **Este default pentru conturile fara alocare explicita**. Daca nu te atingi de un cont, el ramane aici.
- **Apare ultima pe `/firma`** in sectiunea "Pe linii de business".
- **Acopera situatia reala**: in orice firma exista cheltuieli partajate (contabilitate, software comun, comisioane bancare, taxe locale) care nu se pot atribui clar unei linii. Acelea raman pe "Toata firma" si patronul vede "ce face firma in general".

Acest design **garanteaza** ca suma verticalelor = totalul firmei. Nu poti avea cheltuieli "pierdute" intre verticale.

---

## Alocarea: simpla vs split

Fiecare cont (la Pasul 3 in Mapari Cashflow) poate fi alocat la verticale in 2 moduri:

### 1. Alocare simpla (100% intr-o verticala)

Tot rulajul contului merge intr-o singura verticala. Cel mai comun pattern pentru conturi analitice specifice unei linii — de exemplu cont 704.REC (rulaj 80.000 lei) → 100% Recruitment.

:::mockup account-row
:::

### 2. Alocare cu split (procente intre 2-5 verticale)

Pentru un cont partajat (ex. 641 Salarii cu rulaj 50.000 lei distribuit 70/30 intre Outsourcing si Recruitment), click pe dropdown-ul Verticala → "Impartit intre mai multe verticale...". Apare popover-ul:

:::mockup split-popover
:::

Sistemul aplica automat split-ul pe fiecare rulaj:

:::mockup split-math
:::

### Reguli pentru split

- Minim 2 verticale, maxim 5 (peste devine ilizibil).
- Total = 100% (sistemul forteaza).
- Procentele sunt intregi (70, nu 70.5).
- La calcul, **ultimul slice primeste remainder-ul** pentru a evita pierderi de banuti din rotunjire. Ex: 100 lei × 33% × 3 verticale = 33 + 33 + 34 = 100.
- Modificarile la split sunt audit-uite.

---

## Cum se vede pe `/firma`

### Sectiunea "Pe linii de business"

:::mockup vertical-breakdown
:::

Verticalele sunt sortate descrescator dupa venituri. Verticala implicita "Toata firma" apare intotdeauna ultima.

### "Top cheltuieli ale lunii" arata verticala

:::mockup top-expenses
:::

Patronul vede instantaneu pe ce linie de business merge fiecare plata mare, inclusiv ce procente sunt din ce verticala atunci cand contul are split.

---

## Workflow tipic de configurare

Pas cu pas, dupa ce activezi verticalele:

1. Sistemul creeaza N verticale vizibile + "Toata firma" implicita. Toate conturile sunt initial alocate la "Toata firma".
2. Identifici **conturile mari** (rulaj > 5.000 lei/luna) — pe astea le aloci explicit.
3. Pentru fiecare cont mare iti pui o singura intrebare: este pentru o singura linie de business sau pentru mai multe?
   - **O singura linie** (ex. cont 704.REC pentru Recruitment) → alocare simpla 100%.
   - **Mai multe linii** (ex. cont 641 Salarii impartit 70/30 Outsourcing/Recruitment) → split popover cu procente.
4. Conturile mici (sub 5.000 lei/luna) raman pe "Toata firma". Nu pierde timp pe ele.
5. Publici luna. Patronul vede defalcarea pe linii de business pe `/firma`.

**Best practice**: aloca doar conturile cu rulaj mare. Configurarea pe fiecare cont mic e munca inutila — nu schimba decizii operationale.

---

## Schimbari, dezactivare, re-activare

### Adaugi o verticala noua

Sectiunea "Verticalele firmei" → buton "+ Adauga verticala". Apare in lista, nu are inca alocari. Tu o aloci la conturile relevante in Pasul 3.

### Redenumesti o verticala

Hover pe nume → buton edit. Schimbi numele. Toate alocarile existente raman intacte (legatura e prin ID, nu prin nume).

### Stergi o verticala

Hover pe nume → buton delete. Confirmare. Sistemul:
1. Sterge verticala.
2. Reseteaza alocarile pe conturile care o foloseau la "Toata firma" implicit.
3. Audit eveniment.

**Exceptie**: verticala "Toata firma" nu poate fi stearsa (e implicita).

### Dezactivezi modulul verticalelor

Buton "Dezactiveaza" la baza sectiunii. Sistemul:
1. **Nu sterge** datele (verticale, alocari, splituri raman in DB).
2. Ascunde coloana "Verticala" din Pasul 3.
3. Ascunde sectiunea "Pe linii de business" pe `/firma`.

Daca reactivezi mai tarziu, totul revine exact cum era. Datele sunt prezervate.

---

## Reguli pe care le impune sistemul

| Regula | Mecanism |
|--------|----------|
| Numele verticalei trebuie sa fie unic in cadrul firmei | Constraint unique pe `(clientId, name)` in `Vertical` |
| Verticala "Toata firma" (implicit=true) nu poate fi stearsa | Flag `isDefault=true`, buton Delete disabled |
| Split-urile au minim 2 si maxim 5 entrii | Validare in `setAllocation` action |
| Suma procentelor = 100 | Forced de UI + validat in service |
| Verticalele sunt strict per firma (per Client) | Constraint `clientId` direct pe `Vertical` |
| Modificarile sunt audit-uite | Fiecare create/update/delete pe `Vertical` si `VerticalAllocation` |

---

## Cum se aplica matematic la calcul

Cand sistemul calculeaza "Pe linii de business" pentru o luna, pentru fiecare cont contabilizat:

1. Calculeaza **rulajul net** al lunii (debit minus credit, in absolut).
2. Cauta **alocarea** — intai pe analitic, apoi pe contBase, fallback la "Toata firma".
3. Daca alocarea este split, suma se imparte proportional pe verticalele din split (ultimul slice primeste remainder-ul rotunjirii).
4. Daca alocarea este simpla, toata suma merge la o singura verticala.

In final, pentru fiecare verticala se calculeaza:

- **venituri** = suma rulaje clasa 7 alocate
- **cheltuieli** = suma rulaje clasa 6 alocate
- **profit** = venituri − cheltuieli
- **marja** = profit ÷ venituri × 100

Functia: `computeVerticalBreakdown` in `src/modules/reporting/owner/compute.ts`.

---

## Cazuri tipice (referinta rapida)

### Restaurant cu 3 canale

Verticale: **Sala**, **Catering**, **Delivery**, *Toata firma*.

| Cont | Strategie |
|------|-----------|
| 641 Salarii bucatari | Split 60/30/10 (Sala/Catering/Delivery) |
| 605 Electricitate | Split 70/20/10 |
| 624 Transport | 100% Delivery |
| 628 Software POS | Split 70/20/10 (proportional cu volumul) |

### Constructii cu 2 proiecte mari

Verticale: **Proiect Bucuresti**, **Proiect Cluj**, **Service**, *Toata firma*.

| Cont | Strategie |
|------|-----------|
| 605 Materiale (cu analitic pe proiect) | 100% per proiect |
| 641 Manopera | Split lunar pe pondere ore pontate |
| Echipa management | Ramane pe Toata firma |

### SaaS cu 2 produse

Verticale: **Produs A**, **Produs B**, **Consultanta**, *Toata firma*.

| Cont | Strategie |
|------|-----------|
| 628.AWS-A si 628.AWS-B | 100% per produs (conturi analitice dedicate) |
| 641.PRODA si 641.PRODB | 100% per produs (salarii dev specifice) |
| 641 echipa core | Ramane pe Toata firma |
| 623 Marketing global | Split aproximativ 60/30/10 in functie de prioritate |

### Coworking cu 2 locatii

Verticale: **Eminescu 1**, **Eminescu 2**, *Toata firma*.

| Cont | Strategie |
|------|-----------|
| Chirie + utilitati (analitic per locatie) | 100% per locatie |
| 641 Salarii receptie | Split lunar pe pontaj |
| Marketing comun | Toata firma sau split 50/50 |

---

## Capcane comune

1. **Splituri pe prea multe conturi mici.** Pierdere de timp, nu schimba decizii. Aloca doar conturile mari.
2. **Nume verticale prea lungi sau confuze.** "Outsourcing IT pentru clienti enterprise" e prea lung. "Outsourcing" + tooltip e mai bine.
3. **Verticale care nu se exclud.** "Outsourcing" si "IT" se suprapun — patronul nu va sti unde sa se uite. Trebuie sa fie linii distincte, nu adjective.
4. **Folosirea verticalelor pentru cost centers**. "HR", "Vanzari", "IT" nu sunt verticale — sunt departamente. Verticala trebuie sa fie sursa de venit, nu locul unde se cheltuie.
5. **Refuzul de a folosi "Toata firma"**. Patronul nu trebuie sa vada 100% alocat la verticale specifice. Cheltuielile cu adevarat comune raman pe "Toata firma" si e in regula.

---

## Implementare tehnica (referinta dezvoltator)

- Modele:
  - `Vertical { id, clientId, name, isDefault, sortOrder, deletedAt }`
  - `VerticalAllocation { id, clientId, scope: contBase|analitic, code, splits: JSON[{ verticalId, percent }] }`
  - `Client.verticalsEnabled: Boolean`
- Resolver: `src/modules/verticals/resolver.ts` cu `applySplit()` care imparte sumele si gestioneaza remainder-ul rotunjirii in ultimul slice.
- Compute: `computeVerticalBreakdown` in `src/modules/reporting/owner/compute.ts`.
- Snapshot field: `OwnerSnapshot.verticalBreakdown: VerticalBreakdownItem[]`.
- Tests: `tests/unit/modules/verticals/`.

---

*Vezi si: [Categorii (axa A)](/docs/cashflow-categorii) (axa A, ortogonala) si [Exemplu QHM21](./docs/cashflow-exemplu-qhm21) (configurare reala pe firma cu 3 verticale)*
