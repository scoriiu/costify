# Foloseste asistentul Costi

Costi este **asistentul AI** integrat in platforma. Combina cunostintele expert de contabilitate romaneasca cu acces direct la datele firmelor tale. Il poti intreba despre legislatie, despre cifrele unei firme specifice, sau despre cum sa folosesti platforma.

## Ce este Costi

Costi este alimentat de modelele Claude de la Anthropic, unul dintre cele mai avansate modele AI disponibile. Pe langa capacitatile generale ale modelului, noi am **specializat** Costi prin:

1. **Training pe legislatia romaneasca** — OMFP 1802, Codul Fiscal, Procedura Fiscala, Legea contabilitatii, Legea societatilor, AML/KYC, coduri CAEN, e-Factura, SAF-T, Saga C
2. **Acces la datele tale** — via "tools" (functii) care interogheaza baza de date
3. **Izolare stricta** — Costi vede doar firmele tale, nu ale altor useri
4. **Filosofia si functionalitatile Costify** — stie cum functioneaza platforma

## Cum acceseze Costi

### Din bula de chat (quick)

In coltul **dreapta jos** pe orice pagina, apare o bula cu mascota Costi. Apasa pe ea. Se deschide un chat mic suprapus pe pagina curenta.

Util pentru intrebari rapide fara sa pierzi contextul paginii.

### Din tab-ul Costi (full)

In meniul principal sus, apasa **Costi**. Se deschide pagina completa de chat cu:
- Istoric de conversatii (daca ai avut conversatii anterioare)
- Sugestii de intrebari
- Spatiu generos pentru raspunsuri lungi
- Suport pentru tabele, liste, formule

Util pentru conversatii lungi, analize complexe, sau sesiuni de invatare.

## Ce poate face Costi

### 1. Raspunde la intrebari de contabilitate

Exemple:

- *"Ce inseamna conturile din clasa 28xx?"*
- *"Cum se calculeaza TVA de plata conform legii?"*
- *"Cand se face inchiderea de luna in Saga?"*
- *"Care e diferenta intre contul 401 si 404?"*
- *"Ce e un cont bifunctional?"*
- *"Cum se calculeaza impozitul pe profit pentru o microintreprindere?"*

Costi raspunde **bazandu-se pe OMFP 1802 si legislatia curenta**, cu citate si explicatii clare.

### 2. Acceseaza datele firmelor tale

Exemple:

- *"Care sunt cei mai mari 5 furnizori ai Digital Nomads SRL in decembrie 2025?"*
- *"Cat a incasat QHM21 de la clienti in Q4 2025?"*
- *"Arata-mi evolutia Rezultatului Net pe ultimele 6 luni pentru 4Walls Kronis"*
- *"Ce conturi nemapate are Digital Nomads?"*
- *"Care e soldul contului 5121 pentru fiecare client in ultima luna?"*

Pentru aceste intrebari, Costi foloseste **tools** (functii de acces la DB) care returneaza datele reale ale firmelor tale.

### 3. Explica platforma Costify

Exemple:

- *"Cum import un jurnal din Saga?"*
- *"Cum functioneaza deduplicarea?"*
- *"Ce inseamna triunghiul galben din balanta?"*
- *"Unde vad CPP-ul pentru un client?"*

Costi cunoaste fluxul platformei si poate explica orice functionalitate.

### 4. Ofera recomandari si analize

Exemple:

- *"Care firma din portofoliul meu are cea mai proasta situatie de cash flow?"*
- *"Sunt probleme cu TVA-ul la Digital Nomads?"*
- *"Cum se compara marja operationala a celor 3 clienti pentru 2025?"*
- *"Care e cea mai rentabila firma din portofoliul meu in acest an?"*

Costi poate combina date din mai multe firme (care iti apartin) pentru analize comparative.

## Cele 9 tools ale lui Costi

Sub capota, Costi are acces la urmatoarele functii. Toate filtreaza dupa user — nu poate vedea date care nu-ti apartin.

### 1. `list_clients`

Listeaza firmele pe care le ai in portofoliu, cu numarul de intrari in jurnal pentru fiecare.

**Cand foloseste**: cand intrebi despre "toate firmele mele", "portofoliul meu", "lista clientilor".

### 2. `get_client_kpis`

Returneaza cele 8 KPI-uri pentru o firma si o perioada (cash, creante, datorii, TVA, venituri, cheltuieli, rezultat, marja).

**Parametri**: `client_name`, `year`, `month`

**Cand foloseste**: cand intrebi despre cash, datorii, profit, marja etc. pentru o firma specifica.

### 3. `get_balance`

Returneaza balanta de verificare completa pentru o firma si o perioada — toate conturile cu solduri si rulaje.

**Parametri**: `client_name`, `year`, `month`, optional `account_prefix` pentru filtrare (ex: "401" pentru furnizori, "5" pentru trezorerie).

**Cand foloseste**: cand intrebi despre conturi specifice, solduri, rulaje.

### 4. `get_cpp`

Returneaza Contul de Profit si Pierdere pentru o firma si o perioada. Doua moduri: **simplificat** (default) sau **F20 detaliat** (formatul oficial ANAF cu 35 de randuri si sub-randuri 13a-e, 14a-b, 15a-b, 16a-b, 17a-d, 18a-b).

**Parametri**: `client_name`, `year`, `month`, optional `mode: "simplified" | "f20"`.

**Cand foloseste**: cand intrebi despre venituri, cheltuieli, rezultat, structura profitului si pierderii. Pentru *"cum arata F20-ul lunii decembrie?"* foloseste modul `f20`.

**De stiut**: `get_cpp` rezolva automat regimul fiscal valabil pe perioada ceruta — daca firma a trecut de la micro la profit standard in iunie, intrebarea pe martie returneaza impozit calculat din 698, iar pe decembrie din 691.

### 5. `get_journal_entries`

Cauta intrari specifice in registrul jurnal.

**Parametri**: `client_name`, `search` (text in explicatie), optional `account` (cont D sau C), `year`, `month`, `limit` (default 20, max 50).

**Cand foloseste**: cand intrebi despre tranzactii specifice ("cand s-a platit Orange?", "cate facturi neincasate are clientul X?").

### 6. `get_available_periods`

Returneaza perioadele disponibile pentru o firma (anii si lunile in care exista date).

**Cand foloseste**: cand intrebi despre istoric, cand vrei sa stii ce perioade sunt in sistem.

### 7. `get_unmapped_accounts`

Listeaza conturile dintr-o firma care nu sunt in catalogul OMFP 1802 (cele marcate cu triunghi galben in tab-ul Balanta).

**Parametri**: `client_name`, `year`, `month`

**Cand foloseste**: cand intrebi *"ce conturi am nemapate la firma X?"* sau *"de ce apare warning la contul Y?"*.

### 8. `get_tax_regime_timeline`

Istoricul tranzitiilor fiscale ale firmei: cand a fost micro, cand a trecut la profit standard, motivul fiecarei schimbari.

**Parametri**: `client_name`

**Cand foloseste**: cand intrebi *"ce regim fiscal are firma X?"*, *"cand a trecut firma de la micro la profit standard?"*, sau *"care era regimul in iunie 2025?"*.

### 9. `get_account_catalog`

Cauta in catalogul standard OMFP 1802 (~321 conturi platforma-wide).

**Parametri**: optional `code` (cod exact), `prefix` (prefix), `cpp_group` (VENITURI_EXPLOATARE, CHELTUIELI_EXPLOATARE, etc.).

**Cand foloseste**: cand intrebi *"exista contul 463 in OMFP?"*, *"care e denumirea oficiala a contului 605?"*, sau *"ce conturi sunt in clasa 7?"*.

## Securitate

Securitatea cu Costi este **la fel de stricta ca restul platformei**:

1. **Autentificare obligatorie** — Costi nu raspunde la intrebari fara user logat
2. **Ownership check** — fiecare tool verifica ca user-ul detine firma despre care intreaba. Daca intrebi despre o firma care nu e a ta, Costi spune "nu am acces"
3. **Fara acces cross-tenant** — nu poti intreba "care e soldul firmei X" daca X apartine altui contabil
4. **Maxim 5 rounds de tool use** — pentru a preveni loops infinite, Costi are limitat 5 cicluri de apelari la tools intr-o singura conversatie
5. **Audit log** — fiecare conversatie si tool call este logat

## Limbile

Costi raspunde **in romana** (default), dar poate raspunde si in alte limbi daca intrebi in acea limba. Pentru cei mai multi useri, romana este optiunea potrivita.

## Exemple de intrebari bune

### Intrebari specifice si clare

**Bun**:
> Care e soldul contului 5121 pentru Digital Nomads in decembrie 2025?

**Mai putin bun**:
> Zi-mi despre banca.

Al doilea e ambiguu — despre ce firma? Ce perioada? Ce despre banca? Costi poate cere clarificari, dar e mai rapid daca esti specific de la inceput.

### Intrebari cu context

**Bun**:
> Vad ca Digital Nomads are TVA de plata 15.000 RON in noiembrie. Este aceasta suma conform cu valorile din balanta (4427 vs 4426)?

**Mai putin bun**:
> De ce TVA-ul e mare?

### Intrebari combinate

**Bun**:
> Pentru fiecare din cei 3 clienti din portofoliul meu, arata-mi profitul net pe Q4 2025 intr-un tabel comparativ.

Costi poate face asta — apeleaza `list_clients`, apoi `get_cpp` pentru fiecare, apoi formateaza tabelul.

### Intrebari despre regim fiscal

**Bun**:
> Cand a trecut 4Walls Studio de la microintreprindere la profit standard?

> Care e regimul fiscal valabil pentru Digital Nomads in iunie 2025?

Costi apeleaza `get_tax_regime_timeline` si raspunde cu istoricul si data exacta a tranzitiei.

## Cand Costi NU poate ajuta

- **Legislatie in afara Romaniei** — Costi e specializat pe Romania
- **Date din afara platformei** — Costi nu stie despre fisiere pe disk-ul tau, email-uri, alte softuri
- **Operatii modificatoare** — Costi **nu poate sa stearga**, **sa modifice** sau **sa adauge** date. Doar citire.
- **Advice legal/fiscal specific** — Costi iti poate explica legea, dar pentru decizii importante, consulta un avocat/contabil autorizat
- **Predictii** — Costi nu iti poate spune "ce va face firma in viitor". Poate spune doar despre trenduri din datele existente.

## Troubleshooting

### "Nu am gasit firma X"

Cauza: Costi a cautat numele exact si nu l-a gasit.

**Solutie**: verifica scrierea. Numele trebuie sa fie cum l-ai creat in Costify (case insensitive, dar aproximativ corect).

### Raspunsuri lungi sau lente

Cauza: intrebarile complexe care cer mai multe tool calls dureaza mai mult.

**Solutie**: fii rabdator — de obicei raspunsurile sunt in 3-15 secunde. Pentru analize foarte complexe, poate dura pana la 30 secunde.

### "Raspunsul nu e complet"

Daca Costi se opreste brusc, probabil a atins limita de 5 tool calls per conversatie.

**Solutie**: intreaba din nou intr-un mesaj nou cu mai putine cerinte.

### Scroll automat deranjant

In chat, pagina auto-scroll-eaza cu mesajele noi. Daca vrei sa citesti ceva mai sus, **da scroll manual** — scroll-ul automat se opreste cand detecteaza ca nu esti la sfarsit.

## Urmatori pasi

- [Arhitectura Costi AI](./costi-ai.md) — cum functioneaza pe dinauntru (pentru curiosi)
- [Principiul jurnal-centric](./principiul-jurnal-centric.md) — cum sunt organizate datele pe care Costi le acceseaza
