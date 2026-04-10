# Intrebari pentru contabil — Plan de conturi si mapari

Document de lucru pentru refactorizarea sistemului de mapare a conturilor contabile in Costify. Raspunsurile vor modela arhitectura finala (tabele in baza de date, UI, comportament la import, etc).

**Context scurt**: Acum avem planul de conturi (~100 conturi OMFP 1802) si regulile CPP (grupari 6xx/7xx pe sectiuni de profit si pierdere) **scrise direct in cod** (fisiere TypeScript). Asta creaza doua probleme:

1. Cand un client foloseste un cont pe care noi nu l-am inclus, el apare ca "Cont 6588" cu triunghi galben si **NU apare in CPP** — picard silentios din calcul.
2. Conturile analitice specifice clientului (ex: `401.00023 — Orange Romania`) nu au un loc in care sa fie editate si stocate permanent — se extrag doar din XLSX-ul Saga la import.

Vrem sa mutam totul in baza de date, sa avem un "plan de conturi standard" (OMFP 1802, read-only) si un "plan analitic per client" (editabil). Dar inainte sa construim, am nevoie de clarificari.

---

## 1. Planul de conturi standard (OMFP 1802)

### 1.1 Ce surse oficiale folosim?
Vrem sa avem un fisier JSON cu **toate conturile sintetice** din OMFP 1802 (nu doar cele ~100 pe care le avem azi). Care este cea mai actuala si completa sursa pe care o recomanzi?
- **Variante**:
  - OMFP 1802/2014 cu toate modificarile ulterioare pana in 2025?
  - O anexa oficiala din OMFP?
  - Un export dintr-un soft de contabilitate (Saga, Ciel, WinMentor)?
  - Un document al CECCAR?
- **Intrebare**: Exista o versiune PDF / Excel oficiala la care sa ma uit ca sa extrag toate codurile + denumirile in limba romana standard?

### 1.2 Granularitatea codurilor — cand ne oprim?
OMFP defineste conturi pana la 4 cifre (`5121`, `4111`, `2131`) dar unele pana la 5 (`46711`, `40111`?) si altele au subdiviziuni oficiale (`4311`, `4312`, `4313`, `4315`, `4316`, `4318`).
- **Intrebare**: Sub ce nivel de granularitate **NU mai consideram "standard"** si consideram analitic (specific clientului)?
  - Ex: `4311 — Contributia unitatii la asigurari sociale` este standard?
  - Dar `4315 — Contributia angajatorului pentru asigurarile sociale de sanatate`?
  - Dar `44271 — TVA colectata 19%` vs `44272 — TVA colectata 9%`?
- **Regula propusa**: Totul **fara punct** = standard OMFP. Tot ce are punct (`401.00023`, `5121.BT`) = analitic client.
- **Confirmare**: Suna bine?

### 1.3 Tipurile de conturi (A / P / B)
Avem o functie `getAccountType()` care returneaza:
- **A** = activ (debitor, ex: 211, 301, 5121, 6xx)
- **P** = pasiv (creditor, ex: 101, 121, 401 uneori, 519, 7xx)
- **B** = bifunctional (poate avea sold si pe D si pe C, ex: 401, 411, 4426)

Regulile actuale sunt:
- Clasa 1: **P** (dar `129` = A)
- Clasa 2: **A** (dar `28x` si `29x` = P — amortizari si ajustari)
- Clasa 3: **A** (dar `39x` = P)
- Clasa 4: **B** (toate bifunctionale)
- Clasa 5: **A** (dar `519` = P — credite bancare pe termen scurt)
- Clasa 6: **A** (toate)
- Clasa 7: **P** (toate)
- Clasa 8: **A** (conturi speciale, extra-bilantiere)

- **Intrebarea 1**: Lista de **exceptii** este completa? Exista conturi care sfideaza regula clasei lor pe care le-am ratat?
- **Intrebarea 2**: Conturile `121 — Profit si pierdere` si `129 — Repartizarea profitului` — cum sunt tratate in balanta de verificare? (Avem un mic conflict in calcule pentru clientul QHM21 pe 121.)
- **Intrebarea 3**: Conturile de regularizare / inchidere (clasa 8?) trebuie sa apara in balanta?

### 1.4 Conturi "speciale" care trebuie sa fie flag-uite
Sunt cateva conturi cu comportament aparte care ar trebui sa aiba o proprietate speciala in DB:
- **121** — Profit si pierdere (folosit la inchidere, se exclude din CPP ca sa evitam dublul calcul)
- **129** — Repartizarea profitului (sold debitor intr-un cont de pasiv)
- **691** — Impozit pe profit (apare separat in CPP, nu in "cheltuieli exploatare")
- **411 vs 4111** — cum tratam `4118 — Clienti incerti`?
- **401 vs 408** — `408 — Furnizori facturi nesosite` e tot "datorie furnizor" pentru KPI?

- **Intrebare**: Exista alte conturi "speciale" care necesita reguli custom? (De ex pe salarizare — `421`, `425`, `427`, `431x`, `444`, `447`?)

### 1.5 Numirea conturilor — stil si abrevieri
In codul actual folosim denumiri scurte fara diacritice:
- `"5121" → "Conturi curente la banci in lei"`
- `"4426" → "TVA deductibila"`
- `"641" → "Cheltuieli cu salariile personalului"`

- **Intrebarea 1**: Vrei denumirile **cu diacritice** sau **fara** in tabele? (Problema e ca lumea cauta "banci" nu "bănci", dar denumirea oficiala are diacritice.)
- **Intrebarea 2**: Vrei denumirile **oficiale complete** din OMFP sau **prescurtate** ca sa incapa in tabele?
  - Ex oficial: `"Cheltuieli privind materiile prime"`
  - Ex prescurtat: `"Cheltuieli materii prime"`
- **Propunerea mea**: Stocam **denumirea oficiala completa fara diacritice** (pentru cautare) si afisam in UI exact asa. Diacriticele pot veni mai tarziu daca conteaza.

---

## 2. Cont Profit si Pierdere (CPP) — gruparile pe sectiuni

CPP-ul actual grupeaza conturile in 4 sectiuni:
1. **Venituri din exploatare** (701, 704, 706, 707, 708, 711, 721, 722, 725, 741, 758)
2. **Cheltuieli din exploatare** (601, 602, 603, 604, 605, 607, 611-613, 621-628, 635, 641, 645, 646, 654, 658, 6811, 6812)
3. **Venituri financiare** (765, 766, 767, 768)
4. **Cheltuieli financiare** (665, 666, 668)

Apoi: Rezultat brut → `691` (Impozit profit) → Rezultat net.

### 2.1 Conturi lipsa sau gresit grupate
- **Intrebarea 1**: Lista de mai sus este completa? Exista conturi de venituri/cheltuieli **care NU apar** si ar trebui sa apara in CPP?
  - De exemplu: `606`, `608`, `609` (reduceri comerciale primite)?
  - `629` (alte cheltuieli cu servicii terti)?
  - `642` (cheltuieli cu avantaje in natura)?
  - `643`, `644` (participarea la profit, remuneratii administratori)?
  - `647` (cheltuieli cu indemnizatii de somaj)?
  - `649` (alte cheltuieli privind asigurarile sociale)?
  - `651`, `652`, `653`, `655`, `656`, `657` (amenzi, donatii, etc)?
  - `659` (alte cheltuieli)?
  - `661`, `662`, `663`, `664`, `667` (clasa 66 — financiare nealocate?)
  - `671`, `674`, `677`, `678` (cheltuieli exceptionale / extraordinare?)
  - `681` vs `6811` vs `6812` vs `6813` vs `6814` (amortizari, provizioane, ajustari)
  - `702`, `703`, `705`, `708`, `709` (variante de venituri)
  - `712`, `721`, `722`, `725`, `726`, `728` (venituri din productia de imobilizari)
  - `733`, `734`, `735` (daca exista)
  - `742`, `743`, `744`, `745`, `746`, `747`, `748`, `749` (subventii si transferuri)
  - `751`, `752`, `753`, `754`, `755`, `756`, `757` (alte venituri exploatare)
  - `761`, `762`, `763`, `764` (venituri financiare nealocate)
  - `771`, `772`, `776`, `777`, `778` (venituri exceptionale / extraordinare?)
  - `781`, `786` (venituri din provizioane, ajustari)
- **Intrebare**: Poti sa completezi lista cu toate conturile care trebuie sa apara in CPP si in ce sectiune?

### 2.2 Formatul oficial al CPP conform OMFP 1802
CPP-ul nostru actual arata asa:
```
VENITURI DIN EXPLOATARE
  701  Vanzari de produse finite
  704  Venituri din servicii prestate
  ...
  Total venituri din exploatare

CHELTUIELI DIN EXPLOATARE
  601  Cheltuieli materii prime
  ...
  Total cheltuieli din exploatare

REZULTAT DIN EXPLOATARE

VENITURI FINANCIARE
  ...

CHELTUIELI FINANCIARE
  ...

REZULTAT FINANCIAR

REZULTAT BRUT
  691  Impozit pe profit

REZULTAT NET
```

- **Intrebarea 1**: Formatul oficial al declaratiei CPP (anexa din OMFP 1802) are o structura mai detaliata. Exemple de **linii oficiale** pe care ar trebui sa le avem:
  - `A. Venituri din exploatare — total` (divizat in: cifra de afaceri, variatia stocurilor, productia realizata de entitate pentru scopurile sale proprii, alte venituri din exploatare)
  - `1. Cifra de afaceri neta` (ce conturi intra exact?)
  - `2. Variatia stocurilor de produse finite si a productiei in curs de executie` (711 + 712?)
  - `3. Productia realizata de entitate pentru scopurile sale proprii si capitalizata` (721 + 722?)
  - `4. Alte venituri din exploatare` (restul 7xx de exploatare)
  - `B. Cheltuieli din exploatare — total`
  - `5. a) Cheltuieli cu materiile prime si materialele consumabile` (601 + 602 + 603 + 604)
  - `b) Alte cheltuieli materiale` (605?)
  - `c) Alte cheltuieli externe` (607 + 608?)
  - `d) Cheltuieli cu personalul` (641 + 642 + 643 + 644 + 645 + 646 + 647 + 648 + 649?)
  - `e) Ajustari de valoare privind imobilizarile corporale si necorporale` (681x?)
  - `f) Ajustari de valoare privind activele circulante` (691x?)
  - `g) Alte cheltuieli de exploatare` (611-628 + 635 + 654 + 658?)
- **Intrebare**: Vrei sa reproducem **exact formatul oficial** al CPP sau versiunea curenta "simplificata" cu un cont per linie este ok?
- **Propunerea mea**: Reproducem formatul oficial (cu gruparile a/b/c/d etc) pentru ca asa apare in declaratiile anuale oficiale. Confirmi?

### 2.3 Impozitul pe profit — unde si cum
Acum facem asa: dupa "Rezultat brut", scoatem `691` separat, apoi calculam rezultatul net. Dar in CPP-ul oficial mai sunt:
- `698` — Cheltuieli cu impozitul pe profit amanat?
- Diferentierea intre impozitul curent si cel amanat?
- Daca clientul e **microintreprindere**, impozitul e pe venituri (3% sau 1%) si merge in alta linie — `698` sau `635`?
- **Intrebare**: Cum tratam clientii micro vs plafon platitori de impozit pe profit? Trebuie sa stim per client ce regim fiscal au?

### 2.4 Sumarul pe clase pentru KPI-uri
Acum calculam 8 KPI-uri din balanta:
1. **Cash & Banca** = `5121 + 5124 + 5311 + 5314`
2. **Creante clienti** = `4111` (sold debitor)
3. **Datorii furnizori** = `401 + 404` (sold creditor)
4. **TVA de plata** = `4427` (finC) − `4426` (finD)
5. **Venituri totale** = suma rulaj credit clasa 7
6. **Cheltuieli totale** = suma rulaj debit clasa 6
7. **Rezultat** = Venituri − Cheltuieli
8. **Marja operationala** = Rezultat / Venituri × 100

- **Intrebarea 1**: Formulele sunt corecte? Exista conturi pe care le ratam sau le includem gresit?
- **Intrebarea 2**: **Cash & Banca** — includem si `542 — Avansuri de trezorerie`? Dar `581 — Viramente interne` (ar trebui sa fie 0 de obicei)? Dar `5125 — Sume in curs de decontare`?
- **Intrebarea 3**: **Creante clienti** — trebuie sa includem si `418 — Clienti facturi de intocmit`? Si `4118 — Clienti incerti`?
- **Intrebarea 4**: **Datorii furnizori** — `408 — Furnizori facturi nesosite` trebuie inclus? Dar `409 — Furnizori debitori` (de scazut)?
- **Intrebarea 5**: **TVA de plata** — formula corecta pentru TVA de plata finala? Trebuie sa folosim `4423 — TVA de plata` sau sa calculam diferenta `4427 − 4426 − 4424 − 4428`?

---

## 3. Conturile analitice per client

### 3.1 Conventia de nume pentru conturi analitice
In Saga, conturile analitice au formatul `401.00023`, `5121.BT`, `411.CLIENT_XYZ`, `641.A01`, etc.
- **Intrebarea 1**: Exista o **conventie stricta** pe care clientii o urmeaza? Sau fiecare face cum vrea?
- **Intrebarea 2**: Separatorul este intotdeauna punctul `.`? Sau unii folosesc `-`, `_`, spatiu?
- **Intrebarea 3**: Partea dupa punct este intotdeauna **numerica** (ex: `401.00023`) sau poate fi si text (ex: `5121.BT`, `411.ORANGE`)?
- **Intrebarea 4**: Adancime maxima? Putem avea `401.SUPPLIER.BRANCH.01`?
- **Propunerea mea**: Stocam exact ce vine de la Saga. La display, baza = partea inainte de primul punct (`401.00023.01 → 401`). Sub-nivelurile sunt informative.
- **Confirmare**: Suna bine?

### 3.2 Extragerea automata din XLSX
La import, Saga exporta `denumire_d` si `denumire_c` cu numele contului asa cum il vede in sistemul lor. Noi capturam aceste nume si le stocam.
- **Intrebarea 1**: Numele din Saga este **intotdeauna corect si complet**? Sau contine uneori prescurtari sau erori?
- **Intrebarea 2**: Cum procedam cand un cont analitic apare cu **doua nume diferite** in perioade diferite? (Ex: `401.00023` = "Orange Romania SA" in ianuarie, apoi "Orange Romania" in februarie.)
  - Pastram ultimul?
  - Pastram primul?
  - Punem un warning ca "numele s-a schimbat"?
- **Intrebarea 3**: Putem **sterge** un cont analitic din DB daca nu mai apare in niciun jurnal? Sau il pastram pe viata clientului?

### 3.3 Editarea manuala
Daca contabilul vrea sa editeze numele unui cont analitic (ex: `5121.BT` sa fie "BT Principal" in loc de "BT_SRL_CT1"), ce comportament vrem?
- **Intrebarea 1**: Cand clientul **reimporta** un jurnal cu un nume diferit in `denumire_d`, suprascriem editarea manuala sau o pastram?
- **Propunerea mea**: Editarea manuala este **sticky** — odata ce utilizatorul a editat un cont analitic, importurile viitoare NU suprascriu numele. Exista un buton "Reseteaza la nume din Saga" pentru a reverti manual.
- **Intrebarea 2**: E ok?

### 3.4 Conturi analitice fara nume
Uneori apar conturi analitice in jurnal care NU au `denumire_d` setata (Saga le-a exportat gol). Ce facem?
- **Optiuni**:
  - Le afisam ca "Cont 401.00023" cu triunghi galben (asa cum facem acum)
  - Le afisam cu denumirea contului de baza ("Furnizori" pentru `401.00023`)
  - Le cerem utilizatorului sa le numeasca manual (workflow obligatoriu?)
- **Intrebare**: Ce preferi?

### 3.5 Relatia cu `JournalPartner`
Avem deja un tabel `JournalPartner` care stocheaza maparea `analyticAccount → partnerName` (extras din explicatia jurnalului, nu din denumiri de coloana). E folosit doar pentru afisare in jurnal.
- **Intrebare**: Vrei sa **unificam** `JournalPartner` cu noul `ClientAccount` (un singur tabel), sau le lasam separate? (JournalPartner are si `cod` partener care poate fi utila.)
- **Propunerea mea**: Unificam. Un singur tabel `ClientAccount` cu campuri optionale pentru `partnerCode`, `partnerName`, `customName`, `source` (saga_denumire / saga_explicatie / user_edit). Mai curat.

---

## 4. Comportament la import (deduplicare + nume)

### 4.1 Conflictele de nume la reimport
Scenariu: accountantul a editat manual numele `401.00023` = "Orange Romania". Apoi face reimport. In noul XLSX, Saga a exportat `401.00023 → "Telekom Romania"` (o eroare la Saga sau o realocare a codului).
- **Intrebarea 1**: Cum procedam?
  - Pastram editarea manuala (utilizatorul stie mai bine)?
  - Suprascriem cu valoarea noua din Saga (sursa primara e Saga)?
  - Afisam un **conflict** si cerem confirmare?
- **Propunerea mea**: Pastram editarea manuala, dar afisam un mic warning in UI "Saga raporteaza `Telekom Romania` pentru acest cont — ai editat manual `Orange Romania`" cu un buton pentru sincronizare daca vrea.

### 4.2 Conturi noi aparute la reimport
Daca reimportul aduce conturi noi (ex: `6588` — un cont pe care clientul nu l-a mai folosit inainte), ce facem?
- **Intrebarea 1**: Il adaugam automat in `ClientAccount`?
- **Intrebarea 2**: Daca `6588` nu e in catalogul OMFP standard, il marcam ca "nemapat"? Sau il lasam ca atare?
- **Intrebarea 3**: E responsabilitatea clientului sa-l mapeze, sau e un semnal ca noi trebuie sa-l adaugam in OMFP standard?

---

## 5. UI si workflow

### 5.1 Unde apare managementul planului de conturi?
Avem doua optiuni:
- **A) Tab pe pagina clientului** — "Plan de Conturi" langa "Registru Jurnal", "Balanta", "CPP". Editare per client.
- **B) Pagina de setari globale** — un template de plan analitic pe care contabilul il aplica la clienti noi. Mai rapid pentru contabili cu 100+ clienti.
- **C) Ambele** — tab per client pentru editare efectiva + setari globale pentru template-uri.
- **Intrebare**: Care varianta ti se pare mai utila?
- **Propunerea mea**: **A)** pentru inceput (mai simplu, contextual). **B)** + **C)** mai tarziu daca e nevoie.

### 5.2 Ce informatii afisam in tabelul plan de conturi?
Coloanele propuse:
- **Cod** (ex: `401`, `401.00023`)
- **Denumire** (ex: "Furnizori", "Orange Romania")
- **Tip** (A / P / B)
- **Sursa** (OMFP 1802 / Import Saga / Editat manual)
- **Sold curent** (din balanta curenta — read-only)
- **Ultima utilizare** (data ultimei intrari in jurnal)
- **Editare** (pencil icon, doar pentru analitice)
- **Intrebare**: Mai vrei alte coloane? Lipsesc informatii critice?

### 5.3 Filtre pe tabel
Propunerile mele pentru filtre:
- **Toate** / **Standard** / **Analitice** / **Nemapate**
- **Folosite** / **Neutilizate** (conturi din catalog care nu apar in jurnalul clientului)
- **Cu sold** / **Fara sold** (pe perioada curenta)
- **Intrebare**: Alte filtre necesare?

### 5.4 Operatii bulk
Nevoia de operatii pe mai multe conturi deodata:
- Export CSV cu toate conturile clientului
- Import CSV pentru a popula denumirile analitice in bulk
- "Mapeaza automat" toate conturile nemapate pe baza codului de baza
- **Intrebare**: Care dintre astea e important de la inceput?

---

## 6. Migratie si backward compatibility

### 6.1 Cum migram clientii actuali
Avem 3 clienti cu date istorice: **4Walls Kronis**, **QHM21 Network**, **Digital Nomads**.
- **Intrebarea 1**: La migratie, vrei sa rulam un script care:
  - Creaza `AccountCatalog` din JSON-ul OMFP standard
  - Pentru fiecare client, parcurge toate `JournalLine`-urile si extrage conturile unice
  - Pentru fiecare cont analitic, creeaza un `ClientAccount` cu denumirea extrasa din `JournalPartner` sau din explicatie daca exista
  - Pentru conturile care nu au denumire, le marcam ca "nemapate" si le afisam in UI
- **Intrebarea 2**: Vrei ca migratia sa fie **reversibila** (sa putem reveni la sistemul vechi daca ceva merge prost)?
- **Propunerea mea**: Da, facem un script care poate rula si in sens invers. In plus, rulam mai intai pe o copie a bazei de date ca sa verificam ca totul functioneaza.

### 6.2 Verificare dupa migratie
Dupa migratie, rulam toate cele 425 de teste + testele de verificare cu datele reale de la contabil:
- **4Walls Kronis** — 79 checks vs XLSX real
- **QHM21 Network** — 244 checks vs XLSX real
- **Intrebare**: Exista alte validari pe care sa le adaugam specific pentru aceasta refactorizare? (Ex: suma totala din balanta trebuie sa ramana identica inainte si dupa migratie?)

---

## 7. Probleme cunoscute / diferente nerezolvate

Avem deja cateva diferente cunoscute fata de datele contabilului:
- **QHM21** — contul `121 — Profit si pierdere` are o mica diferenta (edge case la inchiderea de exercitiu)
- **QHM21** — contul `421 — Personal salarii datorate` are o diferenta (probabil legata de modul in care calculam contributiile)
- **Intrebarea 1**: Cand vom avea planul de conturi in DB, vrei sa re-verificam aceste diferente? Poate sa fie cauza tocmai un cont analitic care era clasificat gresit?
- **Intrebarea 2**: Ai acces la o **documentatie oficiala** despre cum se calculeaza inchiderea pe 121 (rulaje vs solduri)?

---

## 8. Termeni si cerinte legale

### 8.1 Retentie si audit
- **Intrebarea 1**: Planul de conturi trebuie pastrat **pe viata** clientului sau retentia de 10 ani (ca jurnalul) e suficienta?
- **Intrebarea 2**: Modificarile la conturi analitice trebuie sa creeze evenimente de audit (cine, cand, ce a schimbat)?
- **Propunerea mea**: Da la ambele — fiecare modificare → `AuditEvent` cu before/after. Retentie 10 ani minim.

### 8.2 Export pentru ANAF
Cand clientul trimite declaratii la ANAF (SAF-T, D394, Bilant), trebuie sa exportam planul de conturi intr-un format specific?
- **Intrebarea 1**: Exista o structura XML / XSD oficiala pentru planul de conturi in SAF-T?
- **Intrebarea 2**: Trebuie sa pastram o "versiune snapshot" a planului de conturi la momentul depunerii declaratiei?

---

## 9. Prioritati

Daca facem implementarea in etape, care e ordinea prioritara pentru tine?

1. **Muta planul OMFP in DB** (nu mai schimbam nimic functional, doar mutam datele din `.ts` in `.json` + DB)
2. **Muta CPP-ul in DB** (idem, dar pentru gruparile CPP)
3. **Populeaza `ClientAccount` cu datele analitice din import Saga**
4. **UI: tab Plan de Conturi pe pagina clientului** (doar afisare, filtrare, cautare)
5. **UI: editare nume conturi analitice**
6. **UI: rezolvare conturi nemapate** (flag pentru review + mapare manuala)
7. **UI: operatii bulk** (export CSV, import CSV)
8. **UI: setari globale** (template pentru clienti noi)
9. **Integrare CPP oficial** (structura completa OMFP 1802 cu sub-linii a/b/c/d)
10. **Export SAF-T / D394** cu plan de conturi inclus

- **Intrebare**: Care e ordinea pe care o preferi? Propunerea mea e de la 1 → 10.

---

## Cum sa raspunzi

Poti raspunde direct in acest fisier adaugand raspunsurile tale sub fiecare intrebare (eu le marchez cu `> R:`), sau intr-un document separat pe care il pun apoi aici.

Pentru intrebarile unde nu esti sigur sau ai nevoie sa verifici ceva in OMFP, spune "verific si revin". Fara presiune — ideea e sa nu construim ceva gresit.

Multumesc!
