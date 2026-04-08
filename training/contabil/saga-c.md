# Saga C — Ghid Complet de Utilizare

## Ce este Saga C

SAGA C este cel mai popular program de contabilitate din România — gratuit, fără limitări, destinat societăților comerciale, ONG-urilor, cabinetelor de contabilitate și contabililor independenți. Acoperă contabilitate în partidă dublă, gestiune stocuri, salarii și declarații fiscale.

Sursă: https://manual.sagasoft.ro/sagac/

---

## 1. Configurare Inițială

### 1.1 Configurare Societăți

La prima intrare se creează firma. Câmpuri obligatorii:

| Câmp | Detalii |
|------|---------|
| Cod | Automat de la 0001, dă numele folderului BD |
| Denumire | Doar „X SRL/SA", NU „S.C. X S.R.L." |
| Cod fiscal | Fără atribut fiscal (ex: 1234, nu RO1234) |
| Nr. Reg. Com. | Format standard J__/____/____ |
| Tip contabilitate | Determină planul de conturi încărcat |
| Cod CAEN | Din lista derulantă |
| Capital social | Suma din actul constitutiv |

**Opțiuni TVA**: lunar / trimestrial / neplătitor. Bifarea „TVA colectată la încasare" pentru sistemul TVA la încasare.

**Modul descărcare gestiuni cantitativ-valorice**: FIFO, LIFO, CMP, manual sau inventar intermitent.

**D700, impozit și TVA**: ecran dedicat pentru modificări în vectorul fiscal (ex: trecere de la micro la profit, de la trimestrial la lunar TVA). Generează și Declarația 700.

### 1.2 Conturi Automate

Configurare conturi utilizate automat de program. Câmpurile Banca 1/2/3 și Deconturi 1/2/3 controlează conturile disponibile în jurnale.

Exemplu compensare terți: se setează contul 5125 sau 581 ca Bancă 2/3 → contul se comportă ca trezorerie → permite descompunere 401=4111 în 401=5125 + 5125=4111.

### 1.3 Setări Diverse & Preluare Date

- **Preluare date contabile**: importul soldurilor inițiale din alt program sau din anul precedent. Meniurile devin active DUPĂ această operațiune.
- **Preluare stocuri inițiale**: pentru gestiuni cantitativ-valorice.

### 1.4 Configurare Salarii

Definire sporuri permanente, prime, tipuri ore suplimentare, conturi contabile pentru salarii, CAS, CASS, impozit. Ore lucru: programul și procentele utilizate la calcul.

### 1.5 Configurare Utilizatori

Drepturi de acces pe module și ecrane.

---

## 2. Nomenclatoare

### 2.1 Terți (Furnizori / Clienți)

- Cod, denumire, cod fiscal, nr. reg. com., adresă
- Cont analitic automat la creare (401.xxxx pentru furnizori, 4111.xxxx pentru clienți)
- Zile scadență → automat calculată la documente
- TVA la încasare → verificare ANAF automată dacă este conectat la internet
- Adrese de livrare (pentru e-Factura BT-70..BT-80)
- Preluare automată date ANAF la introducerea codului fiscal

### 2.2 Plan de Conturi

Vine preîncărcat conform legislației. Utilizatorul poate crea conturi analitice.

**Reguli creare analitice:**
- Cont sintetic grad 1 = 3 caractere (ex: 121)
- Cont sintetic grad 2 = 4 caractere (ex: 4423)
- Analiticele se creează cu punct separator (ex: 121.1, 5121.1)
- Simbolul analitic: numeric, alfabetic sau alfanumeric

**Funcțiunea conturilor**: Activ (sold debitor), Pasiv (sold creditor), Bifuncțional (ambele). Funcțiunea setată la creare; pentru conturile standard e predefinită.

**Conturi blocate** nu apar la selecție (excepție: Articole contabile).

Dacă se configurează analitice la 121 → apare coloana „Cont închidere c/v" pentru asocierea selectivă a conturilor de cheltuieli/venituri cu un analitic 121 specific.

### 2.3 Gestiuni

Definire gestiuni cantitativ-valorice sau global-valorice. Fiecărei gestiuni i se asociază un cont analitic din clasa 3.

### 2.4 Articole

Definire produse/servicii cu: cod, denumire, UM, cotă TVA, tip articol, preț vânzare, cod NC/CPV (necesar e-Factura), cod de bare.

### 2.5 Tipuri de Articole-Servicii

Categorii predefinite care determină contul de cheltuială/venit la operare.

### 2.6 Salariați

Date complete: CNP, funcție, salariu brut, sporuri, deduceri personale, tip contract, punct de lucru, cont bancar (pentru plată pe card), nr. contract, dată angajare.

### 2.7 REGES (Revisal)

Generare și transmitere Revisal electronic.

---

## 3. Operații Contabile

### 3.1 Articole Contabile

Ecranul central pentru note contabile manuale. Suportă:

**Articol simplu**: o linie — cont debit, cont credit, sumă.

**Articol compus**: prima linie cu un cont + „%" la contul corespondent → CTRL+ENTER adaugă linii sub %. Buton „Egalizare" însumează automat valorile sub %.

Conturi extrabilanțiere (clasele 8-9): se creează cont fictiv (ex: 899) pentru corespondență.

### 3.2 Intrări - Lei

Ecran principal pentru achiziții domestice. Două tabele: antet (document) + detalii (articole).

**Tipuri document intrare:**

| Tip | Semnificație |
|-----|-------------|
| (gol) | Factură standard |
| B | Bon de casă |
| A | Aviz de însoțire |
| C | Bon de casă cu cod fiscal |
| T | Taxare inversă |
| e | Exceptate AMEF |
| U | Art. 311 — agenții turism (TVA la marjă) |
| H | Art. 312 — second-hand (TVA la marjă) |
| n | Neimpozabile (nu apar în jurnale) |
| O | Borderou achiziții |
| L | Factură emisă în numele furnizorului (autofactură) |
| P | Fără drept deducere parțial (pro-rată) |
| I | Fără drept deducere integral (pro-rată) |
| M | Factură simplificată |

**Fluxul operării**:
1. Adaugă antet: tip, nr.doc, furnizor (preluare automată ANAF), dată
2. Adaugă detalii: denumire/articol, cantitate, preț unitar, cotă TVA, cont
3. **Validare** → generează nota contabilă, blochează modificarea
4. **Plată** (după validare) → înregistrare automată în Registru casă / Jurnal bancă
5. **Devalidare** → șterge nota contabilă, permite modificări

**Nedeductibil**: coloana permite marcarea deducerii parțiale (50%) sau integrale. TVA aferent se înregistrează și pe credit.

**Stornare**: generează document negativ cu „s" la număr.

**Asociere aviz**: la facturarea unui aviz anterior validat.

**Import**: facturi PDF (Uber, Bolt), CSV (UberEats, Autonet), XLS, fișiere e-Factura.

### 3.3 Intrări - Valută

Identic cu Intrări lei, dar cu coloane suplimentare: monedă, curs valutar, sumă valută. Cursul se preia automat de la BNR dacă există conexiune internet.

### 3.4 Ieșiri - Lei

Ecran pentru vânzări domestice. Tipuri suplimentare față de intrări:

| Tip | Semnificație |
|-----|-------------|
| f | Factură cu bon fiscal |
| S | Scutit cu drept de deducere |
| D | Scutit art. 294(5) lit. a, b → rând 14.1 D300 |
| d | Scutit art. 294(5) lit. c, d → rând 14.2 D300 |

**Flux**: identic cu intrările, dar „Plată" devine „Încasare".

**Factura cu bon fiscal** (tip „f"): se transmite în e-Factura cu cod 751 (informativă).

**Tipărire factură**: formulare configurabile, export XML, PDF. Link plată online (euPlătesc/Netopia).

**Import**: platforme eCommerce (Emag, MerchantPro, PrestaShop, WooCommerce), PDF (Uber, Bolt, Lime).

### 3.5 Ieșiri - Valută

Similar cu ieșiri lei + coloane valută/curs.

### 3.6 Imobilizări

Gestionare mijloace fixe corporale și necorporale. Trei pagini:

**Lista imobilizărilor**: nr.inventar (unic), denumire, cod clasă (din clasificare), data intrare, valoare intrare, durata (luni), tip amortizare (liniară/accelerată), cont, cont amortizare, cont cheltuială.

Amortizarea începe din luna următoare datei de intrare.

**Modernizări / Reevaluări / Suspendări**: tipuri operație — modernizare, reevaluare brut/net, vânzare, casare, suspendare, reactivare.

**Plan amortizare**: afișează evoluția amortizării până la terminare.

**Autoturisme clasa 2.3.2.1.1**: programul limitează automat cheltuiala deductibilă la 1.500 lei/lună la calculul impozitului pe profit.

Amortizare lunară generată automat din „Închidere lună" → note contabile 6811 = 280x / 281x.

### 3.7 Operații cu Stocuri

- **Transferuri** între gestiuni
- **Bonuri de consum** (materii prime, materiale)
- **Producție** (pentru ciclu de fabricație)
- **Inventariere** (stocuri faptice vs. scriptic)
- **Dare în folosință obiecte inventar** (generează automat 8035=999)
- **Dezmembrări** (dezmembrare lot în componente)
- **Operații speciale** (ajustări, regularizări)
- **Schimbare preț vânzare mărfuri** (gestiuni global-valorice)

### 3.8 Casă - Bancă - Deconturi

Trei ecrane separate: Registru casă, Jurnal bancă, Deconturi — fiecare în lei și valută.

**Principiu**: un cont din articolul contabil este ÎNTOTDEAUNA contul de trezorerie (5311/5121/542).

**Analitice recomandate**:
- 5311.x — câte un analitic per punct de lucru / monedă
- 5121.x — câte un analitic per cont bancar
- 542.x — câte un analitic per persoană (avansuri spre decontare)

**Plăți/încasări**: din panoul „Detalii" se selectează terțul și se distribuie suma pe facturi (integral sau parțial). „Suma rămasă" trebuie să ajungă la 0.

**Import extrase bancare**: fișiere homebank, XML, integrare online (Libra Bank, DPD).

**Documente generabile**: registru casă, jurnal bancă, chitanțe, ordine de plată (cu/fără cod bare), dispoziții plată/încasare, note transfer numerar, deconturi cheltuieli, contracte creditare.

### 3.9 Cecuri, Bilete la Ordin

Evidență cecuri și bilete la ordin emise/primite, cu urmărire scadență și stare.

### 3.10 State Salarii

Calcul automat salarii pe baza datelor din nomenclatorul Salariați.

**Componente**:
- Salariu brut = salariu bază + sporuri permanente + ore suplimentare + prime
- CAS angajat, CASS angajat, Impozit pe venit → rețineri din brut
- CAM → contribuție angajator
- Tichete de masă → doar impozit reținut
- Rețineri diverse (rate, pensii facultative, popriri) — pe perioadă/procent/sumă fixă
- Concedii medicale — cu calcul automat bază 6 luni
- Concedii odihnă, fără plată, creștere copil, suspendări

**Flux**:
1. Se alege luna/anul + data plată
2. Programul încarcă automat salariații cu veniturile calculate
3. Se operează concedii, tichete, rețineri, ore suplimentare
4. **Validare** → generează note contabile
5. **D112** → generare PDF sau XML, validare, semnare, depunere

**Tipăriri**: stat de plată, fluturași, liste avansuri, recapitulație, centralizator sporuri/rețineri. Trimitere automată fluturași pe email.

**Generare fișiere bancă** pentru plata pe card.

---

## 4. Închidere Lună

Procedura lunară obligatorie, în ordine:

### 4.1 Înregistrare Operații Contabile Stocuri
Generează notele contabile pentru mișcări de stocuri din gestiuni cantitativ-valorice.

### 4.2 Descărcare Mărfuri Gestiune Global-Valorică
Calcul coeficient K și descărcare gestiune. Soldul 371 nu poate fi negativ.

### 4.3 Închidere TVA
Regularizare TVA: compensare automată TVA de plată cu TVA de recuperat. Reglare diferențe între jurnale și solduri 4428.TP / 4428.TI.

### 4.4 Cheltuieli/Venituri în Avans
Transfer lunar automat din avans pe cheltuieli/venituri curente.

### 4.5 Amortizare Imobilizări
Generare note contabile amortizare: 6811 = 280x (corporale), 6811 = 281x (necorporale).

### 4.6 Închidere Conturi Venituri și Cheltuieli
Transfer solduri conturi clasele 6-7 prin contul 121 (profit și pierdere).

### 4.7 Impozit pe Profit (trimestrial)
Activ doar în ultima lună de trimestru. Ecran cu cheltuieli nedeductibile, venituri neimpozabile, pierdere reportată, rezervă legală, sponsorizări deductibile, bonificație OUG 153/2020.

Generează: nota contabilă, registru evidență fiscală.

### 4.8 Impozit pe Venit — Micro (trimestrial)
Procentul impozit completat automat (1% sau 3%) în funcție de nr. salariați. Venituri neimpozitate, sumă deductibilă, sponsorizări, bonificație.

Generează: D107, D177.

### 4.9 Declarația 100
Obligații fiscale lunare. Buton „Actualizare date" preia automat sumele. Generează D100, D710, ordine de plată.

### 4.10 Declarația 101 (decembrie)
Declarație anuală impozit profit. Date preluate din balanță + calcul profit + D100 existente.

### 4.11 Declarația 392/700 (decembrie)
Declarație informativă. D700 se generează și din Configurare societăți.

### 4.12 Calcul Diferențe de Curs
Reevaluare solduri valutare la cursul BNR din ultima zi a lunii. Cursul preluat automat (bnr.ro sau infovalutar.ro). Facturile reevaluate nu mai pot fi devalidate.

### 4.13 Validare Închidere Lună
Blochează luna curentă, trece la luna următoare. Revenire: devalidare în ordine inversă (de jos în sus).

---

## 5. Situații Contabile

### 5.1 Fișa Contului
Vizualizare detaliată a mișcărilor pe un cont, cu sold inițial, rulaje, sold final.

### 5.2 Balanțe de Verificare
Două tipuri:
- **Sintetică**: conturi grad 1 și/sau grad 2
- **Analitică**: cu toate analiticele (bifare „Analitică")

Filtre: sumare sintetice grad 2 la grad 1, conturi din afara bilanțului, filtrare pe monedă, defalcare pe activități/centre profit.

### 5.3 Cartea Mare
Centralizator mișcări pe conturi corespondente.

### 5.4 Jurnale TVA
Jurnal cumpărări și jurnal vânzări, generate automat din documente validate.

### 5.5 Registrul Jurnal
Toate articolele contabile în ordine cronologică.

### 5.6 Registrul Inventar
Lista tuturor elementelor patrimoniale.

### 5.7 Bilanț
Generare situații financiare anuale.

### 5.8 Declarația 406 — SAF-T
Export SAF-T XML conform cerințelor ANAF.

---

## 6. Situații Comerciale

- **Situații clienți / furnizori**: solduri, facturi neachitate, scadențe, neachitat la zi vs. neachitat final
- **Fișe articole**: mișcări pe articol per gestiune
- **Situație aprovizionări / vânzări / consumuri**: centralizatoare pe perioadă
- **Situație stocuri**: stoc curent per gestiune/articol
- **Raport de gestiune**: situație completă per gestiune
- **Situație obiecte inventar**: evidență OI date în folosință
- **Situație ambalaje SGR**: conform legislației garanție-returnare

---

## 7. e-Factura

### 7.1 Pași Premergători
1. Date complete societate în Configurare societăți
2. Verificare clienți (buton „Verificare" în Clienți) → identificare înscriși în RO e-Factura + completare automată adresă
3. Asociere coduri NC/CPV la articole (necesită modul stocuri)

### 7.2 Asociere Cod SPV
La prima accesare ecranului e-Facturi se solicită codul de acces SPV. Se generează cu certificat digital (semnătură electronică). Codul poate fi folosit și pe alte calculatoare.

### 7.3 Generare și Transmitere
1. Înregistrare și validare factură în Ieșiri
2. Din ecranul e-Facturi → bifare „Preluat" → „Accept"
3. Verificare status în panoul „Detalii"
4. Fără cod SPV: se generează doar XML pentru încărcare manuală în SPV

### 7.4 Import e-Facturi Primite
Descărcare automată din SPV → bifare „Preluat" → „Accept". Identificare automată facturi deja operate (după nr. document). Sistem memorare asocieri articole importate.

### 7.5 Import e-Facturi Emise
Pentru facturi emise din alte aplicații. Activare din Configurare.

### 7.6 Coduri Tip Factură e-Factura

| Cod | Tip factură |
|-----|------------|
| 380 | Factură standard |
| 389 | Autofactură (tip „L") |
| 751 | Factură informativă (cu bon fiscal) |

### 7.7 Indici TVA în e-Factura

| Indice | Semnificație |
|--------|-------------|
| S | Orice cotă TVA diferită de 0 |
| Z | TVA 0 pentru plătitori, fără excepție |
| 0 | Neplătitori TVA |
| AE | Taxare inversă (tip „T") |
| E | Scutiri (tip „S", „D", „d", „U", „H") |

### 7.8 Configurare e-Factura
- Interval preluare mesaje SPV (implicit 30 zile)
- Validare online vs. DUKIntegrator
- Formular tipărire pentru preluare date suplimentare
- Setări import: cont implicit, tip articol, gestiune, grupă
- Transmitere automată din Saga WEB (ultimele 10 zile)

---

## 8. e-Transport

Declarare electronică transport bunuri. Accesibil din Diverse → e-Transport sau direct din ecranele Intrări/Ieșiri prin butonul dedicat.

---

## 9. Diverse

### 9.1 Comenzi și Contracte
Emitere comenzi de aprovizionare/livrare, generare facturi din comenzi. Contracte cu facturare periodică automată.

### 9.2 Cheltuieli/Venituri în Avans
Înregistrare sume în avans cu perioadă de transfer lunar. La închidere de lună se generează automat notele de transfer.

### 9.3 Import Date
Import din XLS, CSV, TXT, XML, DBF — pentru articole contabile, intrări, ieșiri, nomenclatoare.

### 9.4 Diurne
Calcul și evidență diurne deplasări.

### 9.5 Situații Manageriale
Rapoarte personalizate: venituri vs. cheltuieli pe perioade, comparații, analize.

### 9.6 Mașini
Evidență auto: consum carburant, km parcurși, cheltuieli per autoturism.

### 9.7 Acționari
Evidență acționari, distribuire dividende.

### 9.8 Declarația Intrastat
Declarare operațiuni intracomunitare.

### 9.9 Declarația 205
Declarație informativă privind impozitul reținut și plătit pe veniturile obținute de nerezidenți și pe alte venituri.

---

## 10. Administrare

### 10.1 Întreținere Baze de Date
- Backup/restore
- Configurare server email
- Preluare curs valutar (bnr.ro sau infovalutar.ro)
- Verificare/reparare baza de date

### 10.2 Numere și Serii
Configurare numerotare automată documente (facturi, NIR-uri, etc.), prefixe, serii.

---

## 11. Utile

### 11.1 Operare Rapidă din Ieșiri
Facturare rapidă cu cititor cod de bare.

### 11.2 Preluare Solduri Terților
Import solduri furnizori/clienți din alt program.

### 11.3 FGO (Facturare de la Guvern Online)
Integrare cu platforma FGO.ro pentru facturare.

### 11.4 Conectare Casă de Marcat
Casele suportate: DATECS, ACTIVA, PARTNER, INCOTEX SUCCES M7, CUSTOM, DAISY, OLIVETTI, SAMSUNG.

Interfețe: FiscalNet, FiscalWire, KFprint, Fisco, DxPrint, FprWin, ServerTremol, SuccesM7DRV, QFiscal.

### 11.5 Raport Fiscal Z
Introducere raport Z de la casa de marcat în program.

### 11.6 Ambalaje SGR
Evidențiere ambalaje cu garanție-returnare conform legislației SGR.

---

## 12. Principii Generale de Operare

### Validare / Devalidare
- **Validarea** = generare articol contabil + blocare document
- **Devalidarea** = ștergere articol contabil + deblocare
- Un document este sau validat, sau devalidat — niciodată ambele
- Documentele validate nu pot fi șterse/modificate fără devalidare prealabilă
- La devalidare cu plăți/încasări asociate → programul atenționează și propune ștergerea

### Shortcut-uri Operare
- **Enter / Tab / Săgeată-jos**: navigare între câmpuri
- **Alt + litera subliniată**: acțiune buton
- **CTRL + ENTER**: adăugare linie în articol compus
- **CTRL + ENTER** în liste: filtrare rapidă
- **Săgeată-sus/jos** în cantitate: +1/-1

### Export
Din orice ecran: XLS, CSV, TXT, XML. Se pot selecta coloanele exportate.

### Tipărire
Vizualizare pe ecran sau direct la imprimantă. Formulare personalizabile.

### Atașare Documente
Butonul link permite asocierea unui fișier oricărei înregistrări (drag & drop).

---

## 13. Sfaturi Practice pentru Contabili

### Pornirea unei Firme Noi
1. Configurare societate (date, tip contabilitate, TVA, CAEN)
2. Configurare conturi automate (bancă, deconturi)
3. Preluare date contabile (solduri inițiale) → activează meniurile
4. Configurare salarii (dacă sunt angajați)
5. Introducere nomenclatoare: terți, articole, gestiuni
6. Operare curentă

### Închidere Lunară — Ordine Strictă
1. Verificare documente validate
2. Operații stocuri (dacă e cazul)
3. Descărcare gestiune global-valorică (dacă e cazul)
4. Închidere TVA
5. Cheltuieli/venituri în avans
6. Amortizare imobilizări
7. Închidere conturi venituri-cheltuieli
8. Impozit profit/micro (doar ultima lună trimestru)
9. D100 (obligații lunare)
10. Diferențe de curs (dacă sunt operații valutare)
11. Validare închidere lună

### Verificări Uzuale
- Balanța să prezinte egalitate (dacă nu: cont lipsă din plan conturi sau conturi extrabilanțiere neinclude)
- Jurnale TVA să corespundă cu soldurile conturilor 4426/4427/4428
- Registru casă: sold 5311 să nu fie negativ
- Situație clienți/furnizori: neachitat la zi = neachitat final (altfel, plăți neasociate corect)
