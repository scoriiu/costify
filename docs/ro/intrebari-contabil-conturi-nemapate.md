# Intrebari pentru contabil — Investigarea conturilor nemapate

**Context**: In UI, sub-sectiunea "Conturi nemapate" din tab-ul Balanta afiseaza o lista a conturilor analitice al caror `contBase` nu exista in catalogul standard OMFP 1802. Exemplu concret vazut pe clientul **4Walls Kronis SRL**:

| Cont | Denumire | Sold final D | Sold final C |
|------|----------|-------------:|-------------:|
| 235  | Cont 235 | 15.288,43    | —           |
| 463  | Cont 463 | 134.243,51   | —           |
| 999  | Cont 999 | —            | 45.753,92   |

Aceste trei cazuri sunt **tipologic diferite**, si gestionarea lor ar trebui sa tina cont de asta.

---

## 1. Decizia arhitecturala: NU auto-mapam conturile nemapate

**Ce am decis**: Conturile care apar in jurnal, dar nu exista in `AccountCatalog`, raman vizibile ca "nemapate" (cu triunghi galben in UI). NU le adaugam automat in catalog. NU le mapam pe baza euristicilor.

**De ce**:
- Conform D16 din ADR-0001, `AccountCatalog` este mentinut la nivel de platforma, nu de tenant. Daca ar adauga fiecare contabil ce vrea, am fragmenta catalogul si am rupe consistenta cross-tenant.
- Unele conturi nemapate NU sunt OMFP 1802 valide (ex. `999` este conventie Saga, `463` este posibila eroare de inregistrare). A le adauga in catalog ar fi o minciuna: am pretinde ca sunt standard OMFP cand nu sunt.
- Alte conturi nemapate SUNT OMFP 1802 valide dar lipsesc din seed-ul nostru (ex. `235 "Investiții imobiliare în curs de execuție"` exista in OMFP 1802 modificat prin OMFP 85/2022). Acestea le adaugam **explicit la nivel de platforma**, in batch, dupa revizuire, nu pe masura ce apar in jurnal.

---

## 2. Cele trei tipologii observate

### 2.1 Cont care PAREA a fi OMFP 1802 valid dar lipsa din seed — caz: 235
**Date din jurnal** (4Walls Studio + 4Walls Kronis, 291 intrari fiecare, 2025):
```
2025-12-31  D:725    C:235     1.053.530,73   expl: "Prod. in curs DEZVOLTARE IMOBILIARA"
2025-12-30  D:235    C:725     1.053.530,73   expl: "Prod. in curs DEZVOLTARE IMOBILIARA"
2025-12-02  D:235    C:401...  15.288,43      expl: "Intrare HOLZ-ARTIKEL SRL"
```

**Ce stiu sigur (din datele observate)**:
- Contul `235` este folosit pereche cu `725` "Venituri din productia de imobilizari" si cu `401` "Furnizori" in clientii 4Walls 2025.
- Explicatia repetata pe toate intrarile este "Prod. in curs DEZVOLTARE IMOBILIARA".
- Exista 291 de intrari in 2025, nu este un cont one-off.
- Contul `235` NU exista in `seeds/omfp-1802.json` al nostru.

**Ce NU stiu sigur (speculatie, nu am citat)**:
- Daca `235` este un cont OMFP 1802 valid introdus prin OMFP 85/2022 sau OMFP 2048/2022 si numit "Investiții imobiliare în curs de execuție". Nu am confirmare textuala din fisierele noastre de training sau din legea oficiala. Am facut inferenta pe baza pattern-ului de utilizare (pereche cu 725, dezvoltare imobiliara), dar asta NU este suficient pentru a decide.

**Dubiu 2.1.a**: Este `235` un cod valid in planul OMFP 1802 modificat? Daca da:
- Care este denumirea exacta oficiala?
- Ce tip are (A / P / B)?
- Face parte din vreun grup CPP sau nu?
- Daca este valid, il adaugam in seed. Daca nu, trebuie sa stim ce reprezinta in planul firmei (probabil un sub-cont analitic al unui cont standard).

**Dubiu 2.1.b**: Exista alte conturi introduse prin OMFP 85/2022 sau OMFP 2048/2022 pe care le-am ratat in seed? Posibile candidate pe care le vad in datele reale sau pe care le stim din practica:
- 215 "Investiții imobiliare"
- 2151–2158 sub-conturi
- 235 (candidatul de mai sus)
- 7583 / 7584 diferentieri (deja in catalog)
- 7812 / 7813 / 7814 (deja notate la F20, vezi `intrebari-contabil-f20-detaliat.md` sectiunea 5.3)
- altele pe care le vezi in practica zilnica?

### 2.2 Cont conventie Saga (citat intern) — caz: 999
**Date din jurnal** (toate 3 clientii 4Walls + Digital Nomads, 166 intrari total):
```
2025-12-13  D:8035   C:999    743,79   expl: "Dare in folosinta ACT BRAD VERDE PVC"
2025-12-11  D:8035   C:999    2.202,47 expl: "Dare in folosinta NANOCELL TV CLASA F"
... etc, toate entries sunt 8035/999 sau 999/8035 ...
```

**Verificare programatica**: `999` apare in **100% din intrari impreuna cu un cont clasa 8**. Niciodata asociat cu conturi din clasele 1–7.

**Citat din propriile noastre fisiere de training**: In `training/contabil/saga-c.md` linia 202 scrie:
> Dare în folosință obiecte inventar (generează automat 8035=999)

Deci utilizarea `8035 = 999` este documentata ca **operatie automata Saga** (nu inventata de contabil, nu OMFP 1802 standard).

**Interpretare (sustinuta de citat + date)**: `999` este contra-partida generata de Saga pentru inregistrarile clasei 8. OMFP 1802 nu prescrie un cont specific pentru contra-partida claselor 8/9; Saga foloseste `999` ca default intern.

**Ce face app-ul acum**: `999` are prefixul "9" → `isExtraBilantier: true` automat via `flags.ts` (linia 97). Deci **este exclus corect** din F20, CPP, Bilant, KPI. Problema este cosmetica: il afisam in sectiunea "nemapate" pentru ca nu este in `AccountCatalog`, ceea ce creeaza confuzie — contabilul vede un triunghi galben si se intreaba de ce.

**Dubiu 2.2**: Solutii posibile, alege:
- **(a)** Adaugam `999` in `seeds/omfp-1802.json` cu numele "Contabilitate in afara bilantului (Saga)" si flag `isExtraBilantier: true` explicit. Este listat in catalog (nu mai apare ca "nemapat") dar numele clarifica ca este conventie Saga, nu OMFP pur.
- **(b)** Il lasam nemapat, dar in UI il mutam intr-o sub-sectiune separata "conturi extra-bilantiere nemapate" (in loc de lista principala nemapate). Pastram separarea intre "cod Saga cunoscut" si "cod necunoscut de investigat".
- **(c)** Il lasam exact cum este acum (nemapat, apare in lista galbena). Solutie minima, nu schimbam nimic.

**Dubiu 2.2.b**: Alte conturi conventie Saga similare pe care le-ai vazut in practica si ar trebui tratate la fel?
- `998`? `997`?
- Contrapartide pentru `8031`, `8032`, `8033`, `8035`, `8036`, `8037`, `8038` (angajamente acordate/primite)?
- Conturi pentru operatiuni de inchidere automata?
- Conturi utilizate de alte programe contabile (Ciel, WinMentor, FreERP) — daca trebuie sa le suportam cand extindem adaptoarele de import?

### 2.3 Cont necunoscut, folosit o singura data — caz: 463
**Date din jurnal** (4Walls Studio + 4Walls Kronis, 1 intrare fiecare, 2025):
```
2025-10-19  D:463    C:456.3   134.243,51   expl: "Intrare LUNGU PETRU_DIVIDENDE INTERIMARE"
```

**Ce stiu sigur (din datele observate)**:
- O singura intrare, cu valoare mare (134.243,51 RON), cu un singur partener (Lungu Petru).
- Contrapartida este `456.3` (analitic al `456`).
- Explicatia este "DIVIDENDE INTERIMARE".
- Contul `463` NU exista in `seeds/omfp-1802.json`.

**Ce NU stiu sigur (speculatie)**:
- Daca `463` este standard OMFP 1802. Din memoria mea, grupa 46 OMFP este "Debitori și creditori diverși" cu conturile `461` (Debitori diversi) si `462` (Creditori diversi), iar `463` nu-mi este familiar. **Dar nu am citat din training file sau din legea oficiala**, deci nu este confirmare solida.
- Daca este eroare de inregistrare (contabilul a scris gresit `463` in loc de `461`, `457`, sau alt cont).
- Daca este cont analitic atipic specific acestei firme pentru o categorie interna de clasificare.
- Daca exista in vreo versiune a planului de conturi pe care nu o cunosc.

**Ce face app-ul acum**: Contul apare in lista "nemapate", contabilul trebuie sa verifice manual.

**Nu implementam nimic specific pentru cazul 2.3 deocamdata** — este exact scopul workflow-ului de investigare (sectiunea 3): a-i da contabilului evidenta ca sa decida singur.

**Dubiu 2.3**: 
- (a) Este `463` cont standard OMFP 1802 pe care eu nu-l cunosc? Daca da, care este denumirea exacta?
- (b) In practica ta zilnica, recunosti pattern-ul "`463` cu explicatie DIVIDENDE INTERIMARE"? Este eroare de inregistrare frecventa, cont analitic legitim, sau altceva?
- (c) Daca este eroare, merita un warning specific in UI ("contul 463 folosit — verifica daca nu era 461 sau 457") sau ramane doar flag-ul generic de "nemapat"?

---

## 3. Workflow-ul de investigare propus (ce construim in app)

### 3.1 Panoul "Investigheaza cont" — evidenta, nu interpretare

Pentru fiecare cont din sectiunea "Conturi nemapate", adaugam un buton "Investigheaza" care deschide un side-panel cu:

**Evidente factuale (NU interpretari)**:
- **Prima utilizare** — data primei intrari din jurnal care atinge acest cont
- **Ultima utilizare** — data ultimei intrari
- **Numar de intrari** — cate tranzactii folosesc contul (debit sau credit)
- **Soldul final D si C** — deja in balanta (afisat)
- **Link catre Registru Jurnal filtrat** — "Vezi in jurnal" deschide tab-ul Jurnal cu filtru automat pe acest cont

**Ce NU includem initial**:
- Nu sugeram cod OMFP echivalent
- Nu propunem mapping
- Nu cerem confirmare in UI
- Nu clasificam contul (transit / permanent / etc.)

**Argument**: Scopul panoului este sa reduca **timpul de investigare** de la "4 pasi manuali" la "2 pasi cu informatia sub ochi". Interpretarea ramane 100% decizia contabilului.

### 3.2 De ce NU hook la Costi (deocamdata)

**Am luat in considerare** sa adaug un buton "Intreaba Costi" care ar pre-completa un prompt cu evidenta colectata. Am decis sa **NU** il livram deocamdata. Rationament:

1. **Modelul folosit este Haiku (Claude Haiku)**. Haiku este rapid si ieftin, dar:
   - **Puncte slabe**: rationament pe domeniu specific, recuperarea faptelor niche, lanturi lungi de inferenta.
   - **Puncte tari**: pattern matching pe informatie furnizata explicit, output in romana, urmarea unui prompt template strans.
2. **Intrebarile despre conturi nemapate necesita rationament domeniu**: pentru `999`, ruta corecta este:
   - pas 1: vad ca 999 apare doar cu 8xx → pattern matching (Haiku OK)
   - pas 2: stiu ca 8xx sunt conturi memorandum care cer contra-partida → cunostinta OMFP 1802 (necesita training file explicit incarcat)
   - pas 3: stiu ca Saga foloseste 999 ca default pentru asta → cunostinta practica Saga
   - pas 4: concluzia "este plumbing Saga, ignora-l" → sinteza

   Haiku poate gresi la pasii 2–3 daca training file-ul nu este citat verbatim. Risc de raspuns **confident dar gresit**.

3. **Cost mare al unui raspuns gresit**: daca Costi zice "contul 463 este probabil OMFP 411 Clienți" si contabilul il crede, am degradat munca lui. Efect negativ asupra increderii in produs, greu de recuperat.

4. **Nu avem inca masuratori de calitate pe Haiku pentru aceasta clasa de intrebari**. Testele pe care ar trebui sa le facem inainte de a livra un hook:
   - Baterie de 20–30 conturi nemapate reale (incluzand 235, 463, 999)
   - Pentru fiecare, rularea Costi pe Haiku si evaluare manuala: raspunsul este corect, neutru sau daunator?
   - Prag de trecere: cel putin 80% raspunsuri corecte sau neutre, 0% raspunsuri confident-gresite.

5. **Alternative dupa revizuire**: dupa ce avem masuratori de calitate, optiuni:
   - (a) Hook cu pre-fill al promptului — user apasa manual Trimite (da timp de inspectie).
   - (b) Hook fara pre-fill — doar deschide chat-ul, user scrie intrebarea. Costi are deja tool-urile `get_journal_entries`, `get_account_catalog`, `get_unmapped_accounts` si poate investiga singur.
   - (c) Alt model mai capabil (Sonnet) numai pentru aceasta clasa de intrebari, cu upsell / cost separat.
   - (d) Panoul inline cu explicatie scurta generata la click, cu disclaimer vizibil "raspuns generat AI, verifica in OMFP".
6. **Decizia curenta**: optiunea (e) — nu livram hook-ul deloc, livram doar panoul de evidenta si link-ul la jurnal. Contabilul poate deschide Costi oricand manual din nav daca vrea; doar nu forţăm integrarea in workflow-ul de investigare pana stim ca aduce valoare pozitiva.

### 3.3 Dubii pentru contabil despre workflow

**Dubiu 3.3.a — evidenta suficienta?** Am ales sa afisam doar 4 campuri de evidenta (prima/ultima utilizare, numar intrari, sold final D/C). In timpul discutiei, am considerat si:
- Top 3 contrapartide pe debit + top 3 pe credit (ex: `999` e mereu cu `8035` — semnal clar)
- Top 5 explicatii distincte (ex: `463` e mereu "DIVIDENDE INTERIMARE" — semnal clar)
- Grafic lunar de activitate (sparkline)
- Evolutia soldului lunar (transit vs permanent)

Concluzia initiala: ramanem la scope minim. Dubiu: dupa ce folosesti panoul pe cazuri reale, care dintre evidentele suplimentare ai vrea sa apara? Nu adaugam la intamplare, ci doar pe baza utilizarii efective.

**Dubiu 3.3.b — placement:** Am ales sa plasam butonul "Investigheaza" in `UnmappedBanner` (sectiunea galbena deja existenta deasupra balantei). Alternativa era un meniu 3-puncte pe fiecare rand al tabelului de balanta. Confirmi ca banner-ul e locul corect?

**Dubiu 3.3.c — link la jurnal:** "Vezi in jurnal" va deschide tab-ul Jurnal cu filtrul pre-completat pe codul respectiv. Filtrul existent face match pe substring in coloanele cont debit, cont credit, explicatie si ndp. Asta inseamna ca filtrul pe "463" va prinde si eventuale analiticele `463.XX` si explicatiile care contin "463" (rar, dar posibil). E acceptabil sau vrei filtru exact-match doar pe cont?

---

## 4. Ce adaugam in catalog dupa revizuirea acestor dubii

In functie de raspunsurile tale:
- Daca **235** este OMFP 1802 valid: adaugam in `seeds/omfp-1802.json` cu `type: "A"`, fara `cppGroup` (nu e P&L), cu denumirea oficiala exacta pe care o confirmi.
- Daca **999** este recunoscut ca "conventie Saga acceptata": adaugam cu `isExtraBilantier: true` si o denumire care sa spuna asta clar.
- Daca **463** este eroare frecventa: nu adaugam nimic in catalog; eventual notam in documentatia interna ca "463 folosit = probabil 461/457, verifica manual".
- Pentru orice alt cont pe care il semnalezi, il includem in batch-ul urmator de actualizare a catalogului.

**Procedura**: dupa revizuire, modific direct `seeds/omfp-1802.json` + rulez `node prisma/seed.mjs`. Testele de integritate (`f20-structure-integrity.test.ts`) valideaza automat ca mapping-ul ramane consistent.

---

## 5. Lucruri care raman sub supraveghere (nu implementez deocamdata)

- **Auto-clasificarea conturilor nemapate** (transit vs permanent vs extra-bilantier) — depinde de rationament pe care nu-l incredintez unei euristici simple.
- **Masuratori de calitate Costi/Haiku pe aceasta clasa de intrebari** — test harness dedicat, 20+ cazuri, evaluare manuala, inainte sa activam orice hook AI.
- **Notificari pe conturi nemapate nou aparute** — util pe termen lung, dar necesita decizie despre ce UX (email? in-app? digest saptamanal?).
- **Bulk review page** pentru toate conturile nemapate + `needsReview` dintr-un client — premature pana nu avem volume mari de tenants.
