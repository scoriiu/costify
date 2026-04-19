# Intrebari pentru contabil — Plan de conturi si mapari

Costify are acum un plan de conturi complet in baza de date: **324 de conturi sintetice OMFP 1802** (catalogul global) si **conturi analitice per client** populate automat la import din Saga. Tab-ul "Plan de Conturi" de pe pagina fiecarui client arata toate conturile, cu tip (A/P/B), solduri si status (standard / analitic / de revizuit).

Majoritatea intrebarilor din versiunea initiala a acestui document au fost rezolvate prin implementare. Mai jos raman doar punctele **deschise** care necesita confirmarea ta.

---

## Ce s-a rezolvat deja

Aceste puncte sunt implementate si functionale — le listam pe scurt ca sa stii ce e in platforma:

- **Catalogul OMFP 1802** — 324 conturi sintetice din seeds/omfp-1802.json, cu tip A/P/B, grup CPP, mapping F20, flaguri speciale (inchidere, impozit, extra-bilantier). Read-only la nivel de platforma.
- **Conturi analitice per client** — populate automat la import din Saga (din coloanele `denumire_d` / `denumire_c`). Editabile manual din tab-ul Plan de Conturi. Editarile manuale sunt **sticky** — reimportul nu le suprascrie.
- **CPP cu 4 sectiuni + F20 detaliat** (35 randuri OMFP 1802 Anexa 3) — implementat si functional, cu toggle Simplificat / F20 detaliat.
- **Conturi nemapate** — marcate cu triunghi galben in Balanta, sectiune expandabila, tab "De revizuit" in Plan de Conturi.
- **KPI-urile** — calculate din roluri in catalog (cashRole, arRole, apRole, vatRole), nu din coduri hardcoded. Cash include 5121, 5124, 5311, 5314, 542. Creante include 4111, 4118, 418, minus 419. Datorii include 401, 404, 408, minus 409. TVA = 4427 - 4426 - 4428 - 4424.
- **Tipuri conturi (A/P/B)** — stocate in catalog per cont, nu calculate din reguli pe clasa. Exceptiile (129 = A in clasa 1, 28x/29x = P in clasa 2, 519 = P in clasa 5, etc.) sunt toate reflectate.
- **Regim fiscal per perioada** — timeline cu tranzitii (nu un singur flag). Gestionat in tab-ul Setari.
- **Export CSV** al planului de conturi — functional din tab-ul Plan de Conturi.
- **Audit** — fiecare modificare la conturi sau jurnal genereaza un AuditEvent cu checksum.

---

## Ce ramane deschis

### 1. Catalogul OMFP — conturi lipsa

Am pornit de la planul standard OMFP 1802/2014 cu modificarile pana in 2025. Avem 324 de conturi, dar e posibil sa lipseasca unele introduse prin OMFP 85/2022 sau OMFP 2048/2022.

Cazuri concrete gasite in jurnalele clientilor (detaliate in [Intrebari conturi nemapate](intrebari-contabil-conturi-nemapate)):
- **235** — posibil "Investitii imobiliare in curs de executie"
- **999** — contra-partida Saga pentru clasa 8
- **463** — cod necunoscut, folosit o data cu explicatie "DIVIDENDE INTERIMARE"

**Intrebare**: Ai o lista cu conturile pe care le folosesti des si pe care le vezi lipsa din catalogul nostru? Vrem sa le adaugam in batch.

### 2. Tipuri de conturi — exceptii neacoperite

Regulile pe clasa (clasa 1 = P, clasa 2 = A, etc.) au exceptii cunoscute pe care le-am acoperit. Dar nu suntem 100% siguri ca le-am prins pe toate.

**Intrebare**: Cunosti conturi care sfideaza regula clasei lor si pe care nu le-am mentionat in lista de mai sus? In special:
- Conturi din clasa 4 care nu sunt bifunctionale?
- Conturi din clasa 5 care sunt P (in afara de 519)?

### 3. Contul 121 — inchiderea de exercitiu

Avem un edge case pe clientul QHM21 Network unde contul `121 — Profit si pierdere` are o mica diferenta fata de datele contabilului. Am exclus 121 (si 1211, 1212) din CPP ca sa evitam dublul calcul, dar nu suntem siguri ca tratamentul in balanta e 100% corect.

**Intrebare**: Cum se calculeaza corect inchiderea pe 121 — prin rulaje sau prin solduri? Daca ai o documentatie oficiala despre procedura, ne ajuta sa verificam.

### 4. KPI-uri — conturi incluse

Formulele actuale:

| KPI | Conturi incluse |
|-----|----------------|
| Cash si Banca | 5121, 5124, 5311, 5314, 542 (avansuri trezorerie) |
| Creante clienti | 4111 + 4118 + 418, minus 419 |
| Datorii furnizori | 401 + 404 + 408, minus 409 |
| TVA de plata | 4427 - 4426 - 4428 - 4424 |

**Intrebari**:
1. **Cash** — includem si `5125 "Sume in curs de decontare"`? Dar `581 "Viramente interne"` (ar trebui sa fie 0)?
2. **Creante** — includem si `413 "Efecte de primit"` sau `461 "Debitori diversi"`? Sau doar 4111 + 4118 + 418?
3. **Datorii** — includem si `462 "Creditori diversi"` sau `403 "Efecte de platit"`?
4. **TVA** — formula actuala (`4427 - 4426 - 4428 - 4424`) e corecta? Sau trebuie sa folosim direct soldul contului `4423 "TVA de plata"`?

### 5. Conturi analitice — separator si conventii

Am observat ca in Saga, conturile analitice folosesc mereu punctul ca separator (`401.00023`, `5121.BT`). Dar nu suntem siguri daca e universal.

**Intrebari**:
1. Separatorul este mereu punct? Sau unii contabili folosesc cratima, underscore, sau spatiu?
2. Partea dupa punct poate fi si text (`5121.BT`, `411.ORANGE`) sau e mereu numerica?
3. Exista conturi cu mai mult de un nivel de punct (`401.SUPPLIER.BRANCH`)?

### 6. Functionalitati viitoare — prioritati

Din lista initiala, nu am implementat inca:

- **Import CSV** al conturilor analitice in bulk (avem doar export)
- **Template global** de plan analitic pe care contabilul il aplica la clienti noi
- **Export SAF-T / D394** cu planul de conturi inclus

**Intrebare**: Care dintre astea ti se pare prioritara? Sau exista ceva urgent pe care nu l-am listat?

---

## Multumim

Raspunsurile se salveaza direct sub fiecare sectiune. Daca nu esti sigur pe un punct, scrie "verific si revin" — asta ne ajuta sa stim ca l-ai vazut dar n-ai raspuns inca.
