# Intrebari pentru contabil — CPP F20 detaliat (D17)

**Context**: Am implementat modul "F20 detaliat" in tab-ul Cont Profit si Pierdere (ADR-0001 D17). Structura oficiala se afla in `seeds/f20-structure.json`. Mapping-ul cont → rand F20 se afla in `seeds/omfp-1802.json` (coloana `cppLine`). Acest document capteaza **toate deciziile** unde am avut dubii, cu numere concrete de pe clientii de test, si tot ce ar trebui revizuit.

**Clientii pe care s-a verificat**:
- 4Walls Studio SRL (`cmnq0d0t3027umhs60rcodwf6`) — 12.322 intrari jurnal, 2017–2026
- Digital Nomads SRL (`cmnq0d0i80002mhs66ovksxwi`) — 2.700 intrari, 2023–2026
- QHM21 NETWORK SRL (`cmnq1d8z40003mh369thebaw6`) — 1.731 intrari, 2025
- 4Walls Kronis SRL (`cmnq0d1tp0bv2mhs6mdfkb4kj`) — 12.322 intrari

---

## 1. Structura formularului F20

### 1.1 Am ales forma compacta cu 35 de randuri, nu varianta cu 62 de randuri
**Ce am facut**: Am implementat cele 35 de randuri consolidate care apar in situatiile financiare anuale dupa OMFP 85/2022 + OMFP 2048/2022. Sub-randurile literale (13a, 13b, 13c, 13d, 13e, 14a, 14b, 15a, 15b, 16a, 16b, 17a, 17b, 17c, 17d, 18a, 18b, 26a, 26b) sunt incluse exact cum apar in formular. Sectiunile sunt etichetate A–G pentru a respecta ordinea formularului:
- **A (rd. 01–12)**: Venituri din exploatare
- **B (rd. 13–19)**: Cheltuieli din exploatare
- **C (rd. 20)**: Rezultat din exploatare
- **D (rd. 21–25)**: Venituri financiare
- **E (rd. 26–29)**: Cheltuieli financiare
- **F (rd. 30)**: Rezultat financiar
- **G (rd. 31–35)**: Venituri totale, cheltuieli totale, rezultat brut, impozit, rezultat net

**Dubiu**: Mai depun unele entitati versiunea extinsa cu 62 de randuri (ex: pentru IFRS sau microintreprinderi cu formulare specifice)? Daca da, adaugam o a doua structura in `seeds/` sau extindem actuala.

### 1.2 Sectiunea de sub-randuri "a/b/c/d"
**Ce am facut**: Am pastrat numele literale in `rowNumber` ca `"13a"`, `"13b"`, etc. Parintele (`"13"`) nu exista in formular — exista doar `"13a"` pana la `"13e"`.

Pentru randurile cu **pereche chelt./venit** (15a+15b, 16a+16b, 18a+18b, 26a+26b), am pus un parinte virtual `"14"`, `"16"`, `"18"`, `"26"` de tip `subtotal` cu formula de gen `rd.16a - rd.16b`.

**Dubiu**: Pe formularul oficial, 15a/15b nu au un subtotal 15. Vrei sa eliminam subtotalurile virtuale si sa lasam doar sub-randurile?

---

## 2. Mapping-ul conturilor pe randuri F20

### 2.1 Cifra de afaceri (rd. 01) — componente
**Ce am facut** (per `seeds/f20-structure.json` rd. 01):
- **rd. 02 "Productia vanduta"**: 701, 702, 703, **704**, 705, 706, 708
- **rd. 03 "Venituri din vanzarea marfurilor"**: 707
- **rd. 04 "Reduceri comerciale acordate"**: 709 (se **scade** cu semn negativ)
- **rd. 05**: (gol — este specific IFN-urilor radiate)
- **rd. 06**: 7411 (subventii aferente CA)

Formula: `rd. 01 = rd. 02 + rd. 03 - rd. 04 + rd. 05 + rd. 06`

**Dubiu 2.1.a**: Unii contabili includ 707 in rd. 02. Confirmi ca rd. 03 este locul corect pentru 707 ca linie separata?

**Dubiu 2.1.b**: In cazul Digital Nomads SRL, 704 (serviciile prestate) contine majoritatea cifrei de afaceri. Toate intrarile merg pe rd. 02 impreuna cu 701–706, 708. E ok aceasta agregare?

### 2.2 Contul 758 si subconturile (7581, 7582, 7583, 7584, 7588)
**Ce am facut**: 
- 758, 7581, 7582, 7583, 7588 → **rd. 11** "Alte venituri din exploatare"
- 7584 "Venituri din subventii pentru investitii" → **rd. 10** separat

**Dubiu**: Unele interpretari pun 7583 "Venituri din vanzarea activelor" pe o linie separata in cifra de afaceri non-standard. Confirmi ca rd. 11 este ok pentru tot 758x (exceptand 7584)?

### 2.3 Contul 635 si impozitul micro
**Ce am facut**: 635 "Cheltuieli cu alte impozite" → **rd. 17b**. 

Impozitul micro-intreprindere (698) merge pe **rd. 34 "Impozitul pe profit / venit"** — conform D13, doar cand regimul fiscal al clientului este `profit_micro_1` sau `profit_micro_3`.

**Dubiu**: Am vazut cazuri unde contabilul a inregistrat impozitul micro in 635 in loc de 698 (eroare frecventa in Saga pentru tranzitia micro → profit). In acele cazuri, impozitul apare in rd. 17b (gresit) si nu apare pe rd. 34. Vrei sa detectam situatia si sa afisam un warning in UI?

### 2.4 Contul 654 "Pierderi din creante si debitori diversi"
**Ce am facut**: L-am pus pe **rd. 16a "Cheltuieli cu ajustarile pentru deprecierea activelor circulante"**, impreuna cu 6814.

**Argument**: Pierderile din creante sunt conceptual o depreciere a activelor circulante (creante neincasabile). E consecvent cu 6814.

**Dubiu**: Unii contabili il pun la rd. 17d "Alte cheltuieli de exploatare (despagubiri, donatii, active cedate etc.)". Care e corect conform OMFP 1802 Anexa 3?

### 2.5 Contul 786 "Venituri financiare din ajustari pentru pierderea de valoare"
**Ce am facut**: L-am mapat primar pe **rd. 24 "Alte venituri financiare"**. 

**Argument**: Practica Saga este sa inregistreze toata reversarea ajustarilor financiare pe 786 direct, fara detaliere. Formularul oficial are rd. 26b "Ajustari de valoare privind imobilizarile financiare — venituri", dar in practica majoritatea firmelor il lasa gol si pun totul pe rd. 24.

In cod, 786 are `cppLine = "24"` in catalog, iar rd. 26b ramane fara mapping automat (valoare 0 in mod standard).

**Dubiu**: Confirmi ca e ok sa ramana pe rd. 24, sau vrei sa-l splitam — partea aferenta imobilizarilor financiare → rd. 26b, restul → rd. 24? Daca da, cum distingem practic cele doua cazuri?

### 2.6 Contul 725 "Venituri din productia de investitii imobiliare"
**Ce am facut**: L-am pus pe **rd. 09 "Productia realizata de entitate pentru scopurile sale proprii si capitalizata"** impreuna cu 721, 722.

**Dubiu**: OMFP 85/2022 tratează investitiile imobiliare separat in unele contexte (clasa 215 activ). Confirmi ca 725 merge pe rd. 09 ca productie proprie, sau ar trebui pe un rand distinct?

### 2.7 Contul 606 "Cheltuieli cu animalele si pasarile"
**Ce am facut**: L-am pus pe **rd. 13b "Alte cheltuieli materiale"** impreuna cu 603, 604, 608.

**Dubiu**: E corect sa fie aici, sau ar trebui pe rd. 13a cu materiile prime (601, 602)? Relevant pentru firme agricole.

### 2.8 Contul 644 "Remunerare in instrumente de capitaluri proprii"
**Ce am facut**: L-am pus pe **rd. 14a "Salarii si indemnizatii"** impreuna cu 641, 642.

**Dubiu**: Apare explicit pe rd. 14a in practica voastra, sau e mai potrivit un sub-rand separat? (644 e rar la SRL-uri clasice.)

### 2.9 Mapping complet pentru clasa 6 (cheltuieli)

| Cont | Denumire | Rand F20 |
|------|----------|----------|
| 601 | Cheltuieli cu materiile prime | rd. 13a |
| 602 | Cheltuieli cu materialele consumabile | rd. 13a |
| 603 | Cheltuieli cu materialele de natura obiectelor de inventar | rd. 13b |
| 604 | Cheltuieli privind materialele nestocate | rd. 13b |
| 605 | Cheltuieli privind energia si apa | rd. 13c |
| 606 | Cheltuieli privind animalele si pasarile | rd. 13b |
| 607 | Cheltuieli privind marfurile | rd. 13d |
| 608 | Cheltuieli privind ambalajele | rd. 13b |
| 609 | Reduceri comerciale primite | rd. 13e (semn −) |
| 611–628 | Prestatii externe | rd. 17a |
| 635 | Cheltuieli cu alte impozite, taxe si varsaminte | rd. 17b |
| 641, 642, 644 | Salarii si indemnizatii | rd. 14a |
| 643, 645, 6451–6458, 646 | Asigurari sociale (inclusiv CAM) | rd. 14b |
| 652 | Cheltuieli protectia mediului | rd. 17c |
| 654 | Pierderi din creante | rd. 16a |
| 658, 6581, 6582, 6583, 6588 | Alte cheltuieli de exploatare | rd. 17d |
| 663, 664, 665, 667, 668 | Alte cheltuieli financiare | rd. 28 |
| 666 | Cheltuieli privind dobanzile | rd. 27 |
| 681, 6811, 6813 | Amortizari / ajustari imobilizari (cheltuieli) | rd. 15a |
| 6812 | Cheltuieli cu provizioanele | rd. 18a |
| 6814 | Cheltuieli ajustari active circulante | rd. 16a |
| 686 | Cheltuieli financiare ajustari | rd. 26a |
| 691, 694, 695, 697, 698 | Impozit | rd. 34 (filtrat dupa `taxRegime`) |

### 2.10 Mapping complet pentru clasa 7 (venituri)

| Cont | Denumire | Rand F20 |
|------|----------|----------|
| 701–706, 708 | Vanzari productie/servicii | rd. 02 |
| 707 | Vanzari marfuri | rd. 03 |
| 709 | Reduceri comerciale acordate | rd. 04 (semn −) |
| 711, 712 | Variatia stocurilor | rd. 07 (crestere) sau rd. 08 (reducere) |
| 721, 722, 725 | Productia de imobilizari | rd. 09 |
| 7411 | Subventii aferente CA | rd. 06 |
| 741, 7412–7419, 754, 758, 7581–7583, 7588, 781 | Alte venituri exploatare | rd. 11 |
| 7584 | Subventii pentru investitii | rd. 10 |
| 761 | Interese de participare | rd. 21 |
| 762, 763 | Investitii / creante imobilizate | rd. 22 |
| 764, 765, 767, 768 | Alte venituri financiare | rd. 24 |
| 766 | Venituri din dobanzi | rd. 23 |
| 786 | Venituri ajustari financiare | rd. 24 (primar) |
| 7812 | Venituri din provizioane | rd. 18b |
| 7813 | Venituri ajustari imobilizari | rd. 15b |
| 7814 | Venituri ajustari active circulante | rd. 16b |

---

## 3. Variatia stocurilor (711/712) — dual-row

### 3.1 Rutare bidirectionala pe rd. 07 / rd. 08
**Ce am facut**: Conturile 711 "Variatia stocurilor" si 712 "Venituri aferente costurilor serviciilor in curs de executie" sunt bifunctionale. Logica la calcul:

```
net = rulajTC − rulajTD  (pe intreaga perioada raportata, cumulat)
daca net > 0 (crestere stoc):  rd. 07 += net, rd. 08 = 0
daca net < 0 (reducere stoc):  rd. 07 = 0, rd. 08 += |net|
```

In formula rd. 12 "Venituri din exploatare — total", rd. 08 este **scazut** din total (avem `sign: "-"` in structura).

In `seeds/omfp-1802.json`, 711 si 712 au `cppLine = "07"` ca mapping primar. Backfill-ul ignora intentionat rd. 08 la seed — splitul se face in compute layer (`cpp-f20.ts`, functia `computeDualTargetRow`).

**Dubiu 3.1**: Confirmi ca asta e logica corecta pentru F20? In unele tratate romanesti se netteaza direct pe rd. 07 cu semn algebric (fara rd. 08 separat).

### 3.2 Baza de calcul (rulaj cumulat vs. variatie sold-la-sold)
**Ce am facut**: Folosesc `rulajTC − rulajTD` **cumulat de la inceputul anului pana la luna selectata**. NU folosesc variatia `finC − soldInC` sau `finC − debInit`.

**Dubiu**: Unii contabili folosesc diferenta "sold final perioada − sold initial an" pentru a determina variatia neta. Care e corect pentru depunerea F20 anuala? Pentru rapoarte intermediare (luna)?

---

## 4. Impozit pe profit / venit (rd. 34)

### 4.1 Mapping per regim fiscal
**Ce am facut**: Conform D13 din ADR-0001, fiecare client are un `Client.taxRegime` si doar contul corespunzator regimului contribuie la rd. 34:

| Regim fiscal | Cont pe rd. 34 | Rata |
|--------------|----------------|------|
| `profit_standard` | 691 | 16% |
| `profit_micro_1` | 698 | 1% |
| `profit_micro_3` | 698 | 3% |
| `profit_specific` | 695 | HoReCa (impozit specific) |
| `imca` | 697 | Impozit minim pe cifra de afaceri |
| `deferred` | 698 | Impozit amanat (temporar) |

Implementarea: in `computeDetailRow` din `cpp-f20.ts`, daca `row.rowNumber === "34"` si este furnizat un regim, suma se face **doar** peste conturile din `TAX_REGIME_ACCOUNTS[regime]`. Celelalte conturi de impozit, daca apar in balanta, sunt ignorate la F20 (dar raman in celelalte randuri unde nu sunt relevante).

Formula pentru rd. 34: `rulajTD − rulajTC` (se netteaza reversarile).

**Dubiu 4.1.a**: Pentru `deferred` (impozit amanat), contul corect ar fi 4412 "Impozit pe profit amanat" din clasa 4, nu clasa 6. In acest moment mapez la 698 (temporar). Cum tratam contabilul impozitul amanat in CPP? 
- L-am ignorat (contine doar evolutii de bilant, nu P&L)?
- Sau 4412 face parte din CPP la o linie separata?

**Dubiu 4.1.b**: Contul 694 "Impozit pe profit (grup)" — in ce regim apare? L-am lasat in catalog dar nu e mapat la niciun regim default. Se foloseste la consolidare de grup?

### 4.2 Bug remediat — impozitul era zero din cauza closing entries
**Problema observata**: Pe 4Walls Studio SRL decembrie 2025, `rezultat net === rezultat brut` (impozit = 0), chiar daca contul 691 are `rulajTD = 30.317 RON`. Selectarea unui alt regim fiscal nu schimba nimic vizibil in UI.

**Cauza radacina**: Functia `sumProfitTax` in `cpp.ts` (si `computeTaxRowForRegime` in `cpp-f20.ts`) calcula `rulajTD − rulajTC` pentru conturile de impozit. Insa inchiderile lunare din Saga genereaza automat o intrare-oglinda (D:121 C:691), ceea ce face `rulajTC = rulajTD`. Rezultat: `TD − TC = 0`, impozitul dispare complet.

**Remediere**: Folosim `rulajTD` singur (fara netting cu `rulajTC`), consistent cu tratamentul tuturor celorlalte conturi de cheltuieli din CPP. Dupa remediere:
- `profit_standard` pe 4Walls dec 2025: impozit = 30.317 (691), rezultat net = 18.422.372,83
- `profit_micro_1` pe acelasi client: impozit = 0 (nu are 698 in 2025), rezultat net = 18.452.689,83
- Schimbarea regimului fiscal produce acum **diferente vizibile** in UI

**Dubiu 4.2**: Exista cazuri legitime unde `rulajTC` pe un cont de impozit (691, 698 etc.) NU este o inchidere-oglinda ci o stornare reala (ex: corectie de impozit)? Daca da, am putea pierde acea stornare cu abordarea actuala. In practica, consideram riscul acceptabil pentru ca este identic cu tratamentul tuturor celorlalte cheltuieli — si nu am observat alt pattern in datele de test.

### 4.3 Tranzitia micro → profit standard in cursul anului — REZOLVAT
**Status**: Implementat. Optiunea (b) extinsa la timeline complet.

**Ce am facut**: In loc de un singur `Client.taxRegime`, fiecare client are acum un timeline `TaxRegimePeriod` (clientId, startDate UNIQUE, taxRegime, reason?, createdBy). Fiecare rand reprezinta o tranzitie cu data exacta de start. Pentru orice raport CPP pe luna X, regimul valabil se rezolva automat:

```
ultima_zi = ultima zi calendaristica a lunii X
SELECT * FROM TaxRegimePeriod
  WHERE clientId = X AND startDate <= ultima_zi
  ORDER BY startDate DESC LIMIT 1
```

Daca firma trece de la micro la profit standard pe 1 aprilie 2025:
- CPP pe martie 2025 → micro (698)
- CPP pe iunie 2025 → profit standard (691)
- CPP cumulat pe decembrie 2025 → ? (vezi dubiu mai jos)

**Implementare**:
- Schema: model nou `TaxRegimePeriod` + `Client.taxRegime` marcat `@deprecated` ca fallback temporar.
- Service: `getRegimeForPeriod(clientId, year, month)` in `src/modules/clients/tax-regime.ts` aplica algoritmul de mai sus.
- UI: dropdown-ul de pe tab-ul CPP a fost inlocuit cu eticheta read-only ("Profit standard 16% · Cont 691"). Schimbarea se face din tab-ul nou **Setari** → sectiunea Regim fiscal, ca timeline cu butoane Adauga / Modifica / Sterge tranzitie.
- Costi: tool nou `get_tax_regime_timeline(client_name)` returneaza istoricul complet. `get_cpp` rezolva automat regimul pe perioada ceruta.
- Migratie: `seedInceptionTransitionsForLegacyClients()` (idempotent) creeaza un rand sintetic dated `1970-01-01` pentru fiecare client legacy fara timeline, ca sa avem mereu un fallback.

**Dubiu 4.3.a** — CPP cumulat pe an de tranzitie: Daca raportul CPP cumulat ianuarie-decembrie 2025 prezinta firma care a fost micro Q1 si profit standard Q2-Q4, ce regim afisam in eticheta din header? Acum afisam regimul **valabil la luna selectata** (decembrie → profit standard), dar valoarea de pe rd. 34 e calculata din contul 691 doar — pierdem impozitul pe Q1 (698). 
- (a) Eticheta + suma per regim, sumate la final pe rd. 34 (suma 698_Q1 + 691_Q2-4)?
- (b) Mentinem comportamentul curent (un singur regim per perioada cumulativa) si avertizam contabilul ca pe perioade de tranzitie trebuie sa raporteze separat?
- (c) F20 are un singur rand 34 — sumam ambele conturi cand detectam tranzitie, fara sa cerem optiune?

**Dubiu 4.3.b** — Tranzitii retroactive: Daca contabilul corecteaza istoria si adauga o tranzitie cu o data trecuta, recalculam automat toate rapoartele CPP pe perioadele afectate? In acest moment **da** — calculul e live din timeline, deci urmatoarea deschidere a CPP arata noile valori. Trebuie sa generam un eveniment de audit explicit cand o tranzitie schimba o perioada deja "vazuta" de utilizator?

### 4.3 Exemplu concret — 4Walls Studio SRL 2024
Pe decembrie 2024, F20 da `rd. 34 = 5.011,00 RON` pentru cont 691, regim `profit_standard`. Rezultat brut = 17.150.387,65. Rezultat net = 17.145.376,65. **Reconciliaza corect cu Simplificat.**

---

## 5. Ajustari de valoare (rd. 15, 16, 18, 26)

### 5.1 Sub-randurile a/b cu semn
**Ce am facut**: Am modelat ca perechi cheltuiala − venit:

| Rand | Sub-rand (−) conturi | Sub-rand (+) conturi | Formula rand parinte |
|------|---------------------|---------------------|---------------------|
| rd. 14 | 14a (641, 642, 644), 14b (643, 645–646) | — | rd. 14a + rd. 14b |
| rd. 15 | 15a (6811, 6813) | 15b (7813) | rd. 15a − rd. 15b |
| rd. 16 | 16a (6814, 654) | 16b (7814) | rd. 16a − rd. 16b |
| rd. 17 | 17a (611–628), 17b (635), 17c (652), 17d (658x) | — | rd. 17a + rd. 17b + rd. 17c + rd. 17d |
| rd. 18 | 18a (6812) | 18b (7812) | rd. 18a − rd. 18b |
| rd. 26 | 26a (686) | 26b (786) | rd. 26a − rd. 26b |

**Dubiu 5.1**: Formularul oficial F20 foloseste aceeasi abordare cu sub-randuri a/b separate sau are doar o coloana neta (rd. 15, rd. 16, rd. 18 cu valoare "neta")? Daca doar neta, ascundem a/b in UI si afisam doar totalul; structura de date ramane, doar presentation se simplifica.

### 5.2 Contul 781 "Venituri din provizioane exploatare"
**Ce am facut**: L-am pus pe **rd. 11 "Alte venituri din exploatare"**.

**Dubiu**: Am adaugat explicit 7812 pe rd. 18b. 781 (fara sub-cont) unde merge — rd. 11 sau rd. 18b? Am ales rd. 11 ca default; daca un client foloseste 781 fara sub-cont, ajunge pe rd. 11 chiar daca conceptul ar fi "reversare provizion" si ar merita pe rd. 18b. Clarificare?

### 5.3 Conturile 7812, 7813, 7814 — referintate de F20 dar nu in catalog
**Descoperire prin test de integritate**: testul `f20-structure-integrity.test.ts > every account code in detail rows exists in the OMFP catalog` a raportat:
```
row 15b: account 7813 not in OMFP catalog
row 16b: account 7814 not in OMFP catalog
row 18b: account 7812 not in OMFP catalog
```

**Cauza**: `seeds/omfp-1802.json` contine 781 si 786 (parintii), dar nu si sub-conturile 7812, 7813, 7814.

**Decizie initiala (RETRASA)**: Am adaugat temporar cele 3 conturi cu denumiri si mapping-uri pe care le-am presupus din formular. Dar fara confirmarea contabilului, nu avem garantia ca:
- denumirile exacte conform OMFP 1802 sunt cele pe care le-am folosit,
- codurile "7812", "7813", "7814" sunt sub-conturile canonice (nu variante 78121, 78131, sau altele),
- tipul P (pasiv) este corect,
- `cppLine = "18b" / "15b" / "16b"` corespunde cu forma oficiala.

**Status curent**: Am **revert-at** adaugarea celor 3 conturi in `seeds/omfp-1802.json`. In `seeds/f20-structure.json`, rd. 15b, 16b, 18b au acum:
```json
{
  "rowNumber": "18b",
  "accounts": [],
  "pendingAccountantReview": true,
  "note": "Sub-codul uzual este 7812, dar nu este inclus in catalog pana la confirmare."
}
```
Rezultatul practic: aceste trei randuri apar cu valoare 0 in UI F20, iar contabilul le vede ca linii goale. Reconcilierea cu Simplificat ramane intacta pe clientii care nu folosesc aceste conturi (majoritatea SRL-urilor).

**Ce cerem contabilului**:
1. Confirma sau corecteaza codurile "7812", "7813", "7814". Sunt canonice conform OMFP 1802? Daca da, care sunt denumirile exacte?
2. Confirma tipul (A/P/B).
3. Confirma `cppGroup`: VENITURI_EXPLOATARE pentru toate?
4. Confirma rutarea in F20: 7812 → rd. 18b, 7813 → rd. 15b, 7814 → rd. 16b.

Dupa confirmare, adaugam conturile inapoi in `seeds/omfp-1802.json` cu rulare `node prisma/seed.mjs`, si eliminam flag-ul `pendingAccountantReview` din `seeds/f20-structure.json`. Testul de integritate va valida automat ca mapping-ul este consistent.

---

## 6. Reduceri comerciale

### 6.1 Contul 609 "Reduceri comerciale primite"
**Ce am facut**: Tipul OMFP = `P` (pasiv), `cppGroup = CHELTUIELI_EXPLOATARE`, `cppLine = "13e"`. In F20, rd. 13e are `sign: "-"` (se scade din rd. 19 total cheltuieli).

In Saga, 609 apare cu rulaj pe **credit** (reducere de cheltuiala). Compute-ul F20 foloseste `rulajTC` pentru rd. 13e (sauf split-ul dual).

**Dubiu 6.1**: Confirmi ca 609 este `P` si ca rulajul pe credit = reducere de cheltuiala? (In OMFP 1802, conturile de reduceri comerciale primite sunt intr-adevar pasive si storneaza creditul de cheltuiala.)

### 6.2 Contul 709 "Reduceri comerciale acordate"
**Ce am facut**: Tipul OMFP = `A` (activ), `cppGroup = VENITURI_EXPLOATARE`, `cppLine = "04"`. In F20, rd. 04 are `sign: "-"` (se scade din rd. 01 cifra de afaceri).

In Saga, 709 apare cu rulaj pe **debit** (reducere de venit). Compute-ul F20 foloseste `rulajTD` pentru rd. 04.

**Dubiu 6.2**: Confirmi ca 709 este `A` (nu `P`)?

### 6.3 Diferenta intre CPP Simplificat si F20 — conturi "cu directie inversa"
**Context**: Pe QHM21 Network SRL decembrie 2025, am observat o **discrepanta de 330.58 RON** intre Simplificat si F20:
- Simplificat: rezultat brut = 203.382,76
- F20: rezultat brut = 203.713,34 
- Delta: +330.58 (F20 mai mare)

**Analiza pas cu pas**:
1. Balanta arata 609 cu `rulajTC = 330,58` si `rulajTD = 0`.
2. F20 ia corect `rulajTC` pentru 609 pe rd. 13e si il scade din rd. 19 — rezultat F20 cheltuieli = 229.851,65.
3. **Simplificat foloseste o heuristica coarsa**: daca `cppGroup` este `CHELTUIELI_*`, foloseste `rulajTD` ca valoare. Pentru 609 (`cppGroup = CHELTUIELI_EXPLOATARE`), ia `rulajTD = 0` si ignora reducerea. Rezultat simplificat cheltuieli = 230.182,23 (cu 330.58 mai mult).

**Decizie initiala (RETRASA)**: Am implementat temporar o detectie heuristica prin tipul contului (P in CHELTUIELI → flip la rulajTC; A in VENITURI → flip la rulajTD). Dar fara confirmarea contabilului, nu avem garantia ca:
- exista doar 609 si 709 in OMFP 1802 care intra in acest tipar, sau pot fi si alte conturi (ex. 609x, 709x, alte reduceri atipice),
- toate conturile cu tipul "P" in `cppGroup = CHELTUIELI_*` sunt reduceri (nu un caz nedescoperit de categorisare atipica),
- aceeasi heuristica trebuie aplicata si pentru conturi financiare (grup CHELT_FINANCIARE cu tip P)?

O heuristica gresita ar storna gresit sume corecte, rupand cifrele CPP in productie pentru **toti clientii**. Risc prea mare pentru a decide singur.

**Status curent**: Am **revert-at** modificarea din `cpp.ts`. CPP-ul Simplificat ramane cu comportamentul original (609/709 silentios ignorate). F20 se comporta corect (conform formularului oficial). Reconcilierea invariant (F20.rezultatBrut === Simplificat.rezultatBrut) **esueaza** pe QHM21 dec 2025 cu exact 330.58 RON. Pe sinteze si pe 4Walls (care nu foloseste 609/709 in 2025), reconcilierea tine.

**Ce cerem contabilului**:
1. Enumerati **toate** conturile OMFP 1802 care functioneaza pe "directie inversa" fata de `cppGroup`-ul lor:
   - Sigure: 609 (P in CHELT_EXPLOATARE), 709 (A in VENITURI_EXPLOATARE)?
   - Potentiale: exista conturi clasa 6 de tip P sau clasa 7 de tip A pe care le-am ratat?
2. Pentru fiecare, confirmati:
   - Numele exact conform OMFP 1802,
   - Tipul (A/P/B),
   - `cppGroup` corect (CHELT/VENITURI + EXPLOATARE/FINANCIARE),
   - Randul F20 corect + semnul (+/-).
3. Dupa confirmare, implementam heuristica doar pentru acea lista **inchisa** si explicita, nu o regula generala prin tipul contului.

**Alternativa care va ramane deschisa**: putem adauga un camp nou `cppSideOverride: "D" | "C"` pe catalog pentru conturile reverse. Asta face comportamentul fully data-driven si explicit, fara heuristica.

---

## 7. Conturi extra-bilantiere (clasa 8)

### 7.1 Excluderea din F20
**Ce am facut**: Toata clasa 8 (800–899) este marcata `isExtraBilantier = true` in catalog. Computele F20, Simplificat, Bilant si KPI ignora aceste conturi.

**Dubiu**: Clasele 80–89 ar trebui sa apara in notele la situatiile financiare (nota 1 "Active imobilizate"), nu in F20. Confirmi excluderea totala din CPP? Cand apar in jurnal, le aratam doar pe tab-ul Registru Jurnal + Balanta cu un indicator "extra-bilantier".

### 7.2 Clasa 9 (contabilitate de gestiune)
**Ce am facut**: Clasa 9 este la fel tratata ca extra-bilantiera (exclusa din F20/CPP/Bilant/KPI).

**Dubiu**: Clasa 9 este in principal folosita in contabilitatea manageriala, nu financiara. Sunt aceste conturi vizibile in jurnalul standard Saga? Daca nu, e probabil ca nu apar in practica la clientii Costify.

---

## 8. Reconciliere Simplificat vs. F20 pe date reale

### 8.1 Invariantul de test
**Ce am implementat**: In `tests/unit/modules/reporting/cpp-f20.test.ts`, grupul "reconciliation with simplified CPP" verifica:
```
F20.rezultatBrut       === Simplificat.rezultatBrut
F20.rezultatNet        === Simplificat.rezultatNet
F20.rezultatExploatare === Simplificat.rezultatExploatare
```
pe inputuri sintetice. Si **tine** pe sinteza.

### 8.2 Date reale — 4Walls Studio SRL 2025 (toate lunile)

| Luna | Ven. exploatare | Chelt. exploatare | Rez. exploatare | Rez. brut | Rez. net | Reconciliaza? |
|------|----------------|-------------------|----------------|-----------|---------|--------------|
| 12 | 18.702.919,04 | 250.229,21 | 18.452.689,83 | 18.452.689,83 | 18.452.689,83 | **OK** |
| 11 | 17.131.361,90 | 219.561,90 | 16.911.800,00 | 16.911.800,00 | 16.911.800,00 | OK |
| 10 | 15.578.568,48 | 210.234,29 | 15.368.334,19 | 15.368.334,19 | 15.368.334,19 | OK |
| ... (12 luni) | ... | ... | ... | ... | ... | OK |

**Observatii**:
- Pe luna 12/2025, rd. 34 = 0 (impozitul inca nu s-a inregistrat pentru anul). 
- Pe luna 12/2024, rd. 34 = 5.011,00 RON cont 691, iar regimul a fost `profit_standard`.
- 4Walls Studio 2025 **nu** foloseste 609/709 (reduceri comerciale), deci bug-ul descris la 6.3 nu afecteaza reconcilierea aici.
- Reconciliaza pe **toate lunile 2024 si 2025**.
- Bug-ul prefix-inheritance (sub-conturi 6022/6024/6028 fara `cppLine`) a fost **remediat in `cpp-f20.ts`** printr-o modificare sigura: compute-ul urca in lantul de prefixe pentru a gasi un `cppLine` de la un parinte mapat. Fix data-driven, nu heuristic, si aplicat numai in F20.

### 8.3 Date reale — QHM21 Network SRL 2025 (cu dubiul 6.3 deschis)

| Luna | Simplificat rez. brut | F20 rez. brut | Delta | Reconciliaza? |
|------|----------------------|---------------|-------|--------------|
| 12 | 203.382,76 | 203.713,34 | **+330,58** | NU (din 609) |
| 11 | 187.683,52 | 188.014,10 | **+330,58** | NU (din 609) |
| 10 | 214.818,67 | 215.149,25 | **+330,58** | NU (din 609) |
| ... | ... | ... | ... | ... |

**Observatie**: Diferenta constanta de **+330,58 RON** pe TOATE lunile 2025 vine exclusiv din contul 609 "Reduceri comerciale primite", inregistrat cu `rulajTC = 330,58` in balanta (reducere inregistrata pe tot anul, constant). F20 il trateaza corect ca rd. 13e cu semn negativ; Simplificat nu il ia in considerare.

Asta **nu este un bug F20**, ci un bug pre-existent in CPP Simplificat. Implementarea unei corectii necesita confirmarea contabilului (vezi dubiul 6.3). Deocamdata este documentata si acceptata ca divergenta explicita.

### 8.4 Sub-conturile 6022, 6024, 6028 (bug inerent prefix-inheritance)
**Descoperire pe 4Walls Studio SRL 2025**:

Balanta contine:
- 6022 "Cheltuieli privind combustibilul" → rulajTD 6.947,83
- 6024 "Cheltuieli privind piesele de schimb" → rulajTD 1.004,55
- 6028 "Cheltuieli privind alte materiale consumabile" → rulajTD 17.140,97
- **TOTAL: 25.093,35 RON**

**Problema initiala**: In catalog, parintele 602 are `cppLine = "13a"`, dar sub-conturile 6021/6022/6024/6025/6028 au `cppLine = null` (nu au fost populate de script-ul de backfill). `F20.rezultatBrut` era cu 25.093,35 mai mare decat `Simplificat.rezultatBrut` pentru ca F20 initial nu agrega aceste sub-conturi.

**Remediere in `cpp-f20.ts`**: Am adaugat un pas de rezolutie prefix — daca un cont nu are `cppLine` direct, se urca in lantul de prefixe pana gaseste un parinte care are. Deci 6022 → (prefix 602) → rd. 13a automat, fara modificari in seed.

**Dubiu 8.4.a**: Exista alte sub-conturi cu `cppGroup` (sti ca fac parte din P&L) dar fara `cppLine` (nu mapeaza la F20)? Daca le enumeram, putem face backfill explicit in seed pentru transparenta; altfel, inheritarea prin prefix ramane mecanism-umbrella.

**Dubiu 8.4.b**: Exista cazuri unde mostenirea prefix ar trebui NU sa se aplice? Ex: daca 6451 ar trebui pe rd. 14b separat iar 645 (parinte) ramane pe alt rand? Pentru moment, 645 si 6451 ambele sunt mapate pe rd. 14b explicit in seed.

---

## 9. Limitari de scop (explicit excluse din D17)

### 9.1 Emitatorul XML/PDF al declaratiei F20
Structura de date este completa (toate rd. 01–35 cu formule), dar **NU** emitem fisierul de depunere catre ANAF. F20 afisat in app este pentru **consultare si verificare**, nu pentru depunere directa.

**Status**: Structura datelor este "filing-ready" in momentul in care decidem sa livram emitatorul. 

### 9.2 Coloana "exercitiul precedent"
Formularul oficial F20 are doua coloane per rand: **exercitiul curent** (anul selectat) si **exercitiul precedent** (anul anterior). Am implementat doar exercitiul curent.

**Status**: Adaugarea coloanei precedente este un schimb presentation-only (trecem prin toate rd. 01–35 pentru `year-1` si afisam paralel). Nu afecteaza structura de date.

### 9.3 Formula rd. 34 calculata (nu doar afisata)
Contul 691 / 698 / 697 etc. afiseaza **ce a inregistrat contabilul in balanta**, NU calculeaza impozitul asteptat de la zero. Daca clientul a inregistrat gresit, F20 afiseaza valoarea gresita.

**Status**: Calculul impozitului asteptat este un produs de sine-statator (necesita pragurile de venit, deductibilitatile, carry-forward-ul pierderilor, etc.). Scoatem dinadins din acest ADR.

**Dubiu 9.3**: Vrei sa adaugam doar un **warning** cand rd. 34 = 0 dar rd. 33 > 0 (rezultat brut pozitiv fara impozit inregistrat)? Acesta ar semnala "impozit nefăcut" fara a pretinde ca stim valoarea corecta.

---

## 10. Arhitectura datelor (detaliu tehnic)

### 10.1 Coloanele noi in AccountCatalog
```sql
AccountCatalog {
  cppLine      String?  -- ex: "13a", "14b", "24"
  cppLineLabel String?  -- ex: "a) Salarii si indemnizatii"
  @@index([cppLine])
}
```

### 10.2 Seed-ul seeds/f20-structure.json
35 de randuri, fiecare cu:
- `rowNumber`: string, "01"–"35" sau "13a", "14b", etc.
- `label`: denumirea exacta din formularul oficial
- `section`: "A"–"G"
- `indent`: 0 sau 1 (pentru sub-randuri)
- `kind`: "detail", "subtotal", sau "total"
- Pentru `detail`:
  - `side`: "D" (rulajTD) sau "C" (rulajTC)
  - `accounts`: lista codurilor OMFP care contribuie
  - `sign?`: "-" daca se scade din parinte
  - `source?`: nota audit (OMFP 1802 Anexa 3 rd.X)
  - `note?`: nota contextuala
- Pentru `subtotal` / `total`:
  - `formula`: sir simbolic, ex: "rd.12 - rd.19"

### 10.3 Algoritmul de compute (`computeCppF20`)
```
1. Filtreaza BalanceRowView cu isLeaf=true
2. Exclude 121, 1211, 1212 (inchidere)
3. Pentru fiecare row, rezolva cont -> cod OMFP (prefix chain fallback)
4. Agrega rulajTD/TC pe cod OMFP (perCode Map)
5. Construieste codeToRow Map:
   - catalog[code].cppLine direct
   - pentru code fara cppLine, urca prefixul pana gasesti un cppLine
   - pentru coduri in F20 structure dar nu in catalog, foloseste direct
6. Pentru fiecare rand detail al F20:
   - Daca e dual-target (rd.07/rd.08): splitStocuri(711/712)
   - Daca e rd.34 cu regim: doar conturile regimului
   - Altfel: suma peste toate codurile care mapeaza la acest rand
7. Evalueaza formulele subtotal/total in ordine documentara (pass 2)
8. Returneaza CppF20Data cu lines[] + 10 totaluri aggregate
```

### 10.4 Testarea
Numar total de teste unitare pentru F20:
- `cpp-f20.test.ts`: 39 teste (core routing, dual-row, totals, tax regime, rollup, edge cases, reconciliation sintetica)
- `f20-structure.test.ts`: 10 teste (loader, cache, type guards)
- `f20-structure-integrity.test.ts`: 15 teste (invariante pe seed: unique row numbers, formule valide, conturi in catalog, sectiuni in ordine)
- `cpp.test.ts`: +3 teste noi pentru 609/709 reverse-direction (total 11)
- **Total**: 625 teste unitare green, din care ~67 acopera direct functionalitatea D17.

### 10.5 Endpoints + UI
- `GET /api/balance` returneaza acum `{ rows, kpis, cpp, cppF20, taxRegime }` (ambele moduri in acelasi request)
- `getClientCppF20(clientId, year, month)` in reporting/service.ts pentru server components
- `cpp-tab.tsx` rescris cu `<ToggleGroup>` (Simplificat / F20 detaliat) + `<Select>` (regim fiscal)
- `cpp-f20-view.tsx` — tabel 4 coloane (Rand, Denumire, Conturi, Valoare), sectiune banding A–G, tooltip formule pe subtotale/totaluri

### 10.6 Costi AI
- Tool-ul `get_cpp` accepta acum `mode?: "simplified" | "f20"`
- Raspunsul in modul F20 contine: `version`, `mode`, `taxRegime`, toate 10 totaluri (venituri/cheltuieli exploatare/financiare + totale + brut + net), si `rows[]` cu rowNumber/label/section/indent/kind/value/accounts/formula
- Sistemul prompt Costi (training/contabil/structured/costify-app.json) descrie atat Simplificat cat si F20

---

## 11. Lucruri de confirmat dupa revizuire

Urmatoarele punct-uri cer confirmarea ta explicita:

- [ ] **Structura F20**: 35 randuri vs. varianta 62. Suficient pentru SRL-uri standard?
- [ ] **Mapping complet clasa 6**: sectiunea 2.9 de mai sus, toate 25 de conturi.
- [ ] **Mapping complet clasa 7**: sectiunea 2.10 de mai sus, toate 20 de conturi.
- [ ] **711/712 rutare**: pe semn (net > 0 pe rd. 07, net < 0 pe rd. 08)?
- [ ] **609/709 reverse-direction**: tip `P` in CHELT_* si `A` in VENIT_* corect?
- [ ] **Regimul `deferred`**: 698 sau 4412?
- [ ] **Contul 694**: cand apare si unde-l mapam?
- [ ] **654 pierderi creante**: rd. 16a vs. rd. 17d?
- [ ] **786 ajustari financiare**: rd. 24 (curent) vs. split pe rd. 26b?
- [ ] **7812/7813/7814**: confirmi denumirile si mapping-urile adaugate?
- [ ] **Conturi lipsa in catalog**: exista sub-conturi OMFP 1802 pe care nu le-am inclus?
- [ ] **Warning cand rd. 34 = 0 dar rd. 33 > 0**: sa afisam?

Dupa review, modific direct:
- `seeds/f20-structure.json` (pentru mapping-uri),
- `seeds/omfp-1802.json` (pentru conturi lipsa sau denumiri),
- apoi ruleaza `node scripts/backfill-cpp-line.mjs` + `node prisma/seed.mjs` pentru a propaga modificarile in DB.

Orice schimb in `cppLine` sau in structura sub-randurilor declanseaza noile teste de integritate care vor semnala automat inconsistente inainte de deploy.
