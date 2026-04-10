# Clasele de conturi (1-9)

Planul de conturi OMFP 1802 imparte toate conturile in **9 clase**, dupa **prima cifra** a codului. Acest articol descrie ce reprezinta fiecare clasa, cu exemple concrete si situatii in care le folosesti.

## Clasa 1 — Conturi de capital, provizioane, imprumuturi

Aceasta clasa contine **sursele de finantare pe termen lung** ale firmei: ce a pus asociatul cand a infiintat firma, ce a castigat firma in timp, ce datoreaza la banci pentru credite mari.

| Cod | Denumire | Folosire |
|---|---|---|
| **101** | Capital social | Banii cu care s-a infiintat firma |
| **104** | Prime de capital | Banii primiti peste valoarea nominala |
| **106** | Rezerve | Profit care a fost retinut, nu distribuit |
| **117** | Rezultatul reportat | Profit din anii anteriori care nu a fost folosit |
| **121** | Profit sau pierdere | Rezultatul **anului curent** |
| **129** | Repartizarea profitului | Cum se distribuie profitul (dividende, rezerve) |
| **151** | Provizioane | Bani pusi deoparte pentru riscuri viitoare |
| **162** | Credite bancare pe termen lung | Imprumuturi de la banca, peste 1 an |

**Ce verifici aici**: capitalul social trebuie sa fie cel din actul constitutiv. Profitul reportat creste in timp pentru o firma profitabila. Daca vezi un sold mare pe 162, firma are credit mare la banca.

## Clasa 2 — Conturi de imobilizari

Aceasta clasa contine **bunurile pe termen lung** ale firmei: cladiri, masini, utilaje, software, drepturi.

| Cod | Denumire | Folosire |
|---|---|---|
| **211** | Terenuri | Pamant detinut |
| **212** | Constructii | Cladiri, hale, magazii |
| **2131** | Echipamente tehnologice | Utilaje, masini de productie |
| **2132** | Aparate si instalatii | Aparate de masura |
| **2133** | Mijloace de transport | Masini, camioane |
| **214** | Mobilier, aparatura birotica | Birouri, scaune, calculatoare |
| **205** | Concesiuni, brevete, marci | Drepturi de proprietate intelectuala |
| **2081** | Programe informatice | Licente software |
| **261** | Actiuni detinute la entitati afiliate | Investitii pe termen lung |
| **281x** | Amortizari | Cumulul de amortizari (A, dar invers) |

**Subtilitate cheie — amortizarea**: o cladire cumparata cu 500.000 RON nu este "consumata" instant. Se amortizeaza pe 25-50 ani — adica **se pune in cheltuieli treptat**. Conturile 281x retin cumulul amortizarilor, iar valoarea ramasa de amortizat (sold 212 - sold 2812) reprezinta valoarea de bilant.

**Ce verifici aici**: imobilizarile noi achizitionate apar pe debitul 211-214. Daca vezi un sold mare pe 281x, firma are imobilizari vechi care s-au amortizat aproape complet.

## Clasa 3 — Conturi de stocuri si productie in curs

Aceasta clasa contine **bunurile pe care le tii pentru vanzare sau folosire imediata**: marfa de pe rafturi, materii prime in depozit, produse finite gata de livrat.

| Cod | Denumire | Folosire |
|---|---|---|
| **301** | Materii prime | Ce intra in productie |
| **302** | Materiale consumabile | Combustibil, ambalaje, piese de schimb |
| **303** | Materiale de natura obiectelor de inventar | Unelte de mica valoare |
| **331** | Produse in curs de executie | Productie inceputa, neterminata |
| **345** | Produse finite | Productie terminata, gata de vanzare |
| **371** | Marfuri | Produse cumparate pentru revanzare (magazine, comert) |
| **381** | Ambalaje | Cutii, pungi, etichete |
| **397** | Ajustari pentru deprecierea marfurilor | Stoc invechit |

**Diferenta cheie**: 301 (materii prime) si 345 (produse finite) sunt pentru **productie**. 371 (marfuri) este pentru **comert** — magazine care cumpara si revand fara sa transforme nimic.

**Ce verifici aici**: stocul de marfa (371) trebuie sa corespunda cu inventarul fizic. Diferentele necesita ajustari (lipsuri sau plusuri).

## Clasa 4 — Conturi de terti

Aceasta este **cea mai aglomerata clasa** — contine toti banii care se misca intre firma ta si "altii": furnizori, clienti, salariati, stat, alte firme.

| Cod | Denumire | Folosire |
|---|---|---|
| **401** | Furnizori | Datorii catre furnizori de marfa/servicii |
| **404** | Furnizori de imobilizari | Datorii catre furnizori de utilaje, cladiri |
| **408** | Furnizori facturi nesosite | Servicii prestate dar nefacturate inca |
| **409** | Furnizori-debitori | Avansuri date furnizorilor |
| **4111** | Clienti | Creante de la clienti |
| **4118** | Clienti incerti sau in litigiu | Creante problematice |
| **419** | Clienti-creditori | Avansuri primite de la clienti |
| **421** | Personal — salarii datorate | Salarii nete neplatite |
| **425** | Avansuri acordate personalului | Avansuri salariale |
| **431** | Asigurari sociale | CAS, pensii |
| **4315** | CASS | Asigurari de sanatate |
| **4317** | CAS angajator | Contributia firmei la pensii |
| **437** | Ajutor de somaj | Contributia la somaj |
| **4423** | TVA de plata | TVA datorata catre stat |
| **4424** | TVA de recuperat | TVA pe care statul o datoreaza tie |
| **4426** | TVA deductibila | TVA pe facturile de cumparare |
| **4427** | TVA colectata | TVA pe facturile de vanzare |
| **444** | Impozit pe venituri din salarii | Impozitul retinut din salarii |
| **446** | Alte impozite, taxe | Impozit pe cladiri, alte taxe |
| **447** | Impozite si taxe locale | Taxe la primarie |
| **461** | Debitori diversi | Alti debitori (gen recuperari de la angajati) |
| **462** | Creditori diversi | Alti creditori |

**Conturile critice**:
- **401 + 404 + 408** = total datorii catre furnizori. Daca creste prea mult, firma nu plateste la timp.
- **4111 + 4118** = total creante de la clienti. Daca creste prea mult, clientii nu platesc.
- **4423** = TVA pe care o datorezi statului luna asta. Daca e mare, ai vandut bine.
- **421** = salariile neplatite. Trebuie zero la sfarsitul fiecarei luni (dupa plata).
- **431x + 437 + 4315 + 4317 + 444** = contributii salariale neplatite. Trebuie zero dupa plata D112.

**Ce verifici aici**: practic toti KPI-urile firmei se calculeaza din clasa 4. Vezi [Intelege KPI-urile](./intelege-kpi.md).

## Clasa 5 — Conturi de trezorerie

Aceasta clasa contine **banii lichizi** ai firmei: ce e in banca, ce e in casa.

| Cod | Denumire | Folosire |
|---|---|---|
| **5121** | Conturi la banci in lei | Banca curenta in RON |
| **5124** | Conturi la banci in valuta | Banca in EUR, USD, etc. |
| **5125** | Sume in curs de decontare | Tranzactii in tranzit |
| **5311** | Casa in lei | Numerar in casierie RON |
| **5314** | Casa in valuta | Numerar in valuta |
| **532** | Alte valori | Timbre, bilete |
| **541** | Acreditive | Acreditive deschise la banca |
| **542** | Avansuri spre decontare | Avansuri date angajatilor pentru deplasari |
| **581** | Viramente interne | Transferuri intre conturi proprii (intermediar) |
| **5191** | Credite bancare pe termen scurt | Credite pe sub 1 an, descoperit de cont |

**Sub-conturi analitice frecvente**: 5121 are de obicei mai multe analitice — cate unul per banca: `5121.BT`, `5121.ING`, `5121.CEC`, etc.

**Ce verifici aici**: soldurile pe 5121 si 5311 trebuie sa corespunda cu extrasele bancare si casa fizica. **Asta este verificarea cea mai elementara** in contabilitate. Daca nu corespund, ai erori de inregistrare.

## Clasa 6 — Conturi de cheltuieli

Aceasta clasa contine **toate cheltuielile firmei**, organizate pe natura.

| Cod | Denumire | Folosire |
|---|---|---|
| **601** | Cheltuieli cu materiile prime | Materii consumate in productie |
| **603** | Cheltuieli privind materialele de natura obiectelor de inventar | Unelte mici |
| **605** | Cheltuieli privind energia si apa | Utilitati |
| **607** | Cheltuieli privind marfurile | Cost de achizitie pentru marfa vanduta |
| **611** | Cheltuieli intretineri si reparatii | Service, mentenanta |
| **612** | Cheltuieli cu redevente, locatii, chirii | Chirie sediu/spatiu |
| **613** | Cheltuieli cu primele de asigurare | Asigurari |
| **614** | Cheltuieli cu studii si cercetari | Studii de piata, cercetare |
| **621** | Cheltuieli cu colaboratorii | Plati persoane fizice/juridice externe |
| **622** | Cheltuieli privind comisioanele | Comisioane catre intermediari |
| **623** | Cheltuieli protocol, reclama, publicitate | Marketing |
| **624** | Cheltuieli cu transportul de bunuri si personal | Transport |
| **625** | Cheltuieli cu deplasari, detasari | Deplasari ale angajatilor |
| **626** | Cheltuieli posta si telecomunicatii | Telefon, internet, post |
| **627** | Cheltuieli servicii bancare si asimilate | Comisioane bancare |
| **628** | Alte cheltuieli cu serviciile | Diverse servicii |
| **641** | Cheltuieli cu salariile personalului | Salariile brute |
| **6451** | Cheltuieli cu CAS angajator | Contributii sociale |
| **6452** | Cheltuieli somaj angajator | |
| **6453** | Cheltuieli CASS angajator | |
| **658** | Alte cheltuieli de exploatare | Penalizari, despagubiri |
| **665** | Cheltuieli din diferente de curs valutar | Pierderi din curs |
| **666** | Cheltuieli privind dobanzile | Dobanzi platite la credite |
| **6811** | Cheltuieli amortizari imobilizari | Amortizarea anuala |
| **691** | Cheltuieli cu impozitul pe profit | Impozit 16% |
| **698** | Cheltuieli cu impozitul pe venit microintreprinderi | Impozit 1% sau 3% |

**Subtilitate**: TOATE conturile clasei 6 sunt de tip A (Activ). Cresc pe debit. Cand cumperi servicii, debitezi 6xx si crediteazi 401.

**Ce verifici aici**: toate cheltuielile firmei sunt aici. Daca o cheltuiala apare unde nu trebuie (ex: cumperi un laptop si pui pe 626 in loc de 214), iti distorsionezi atat profitul cat si bilantul.

## Clasa 7 — Conturi de venituri

Aceasta clasa contine **toate veniturile firmei**.

| Cod | Denumire | Folosire |
|---|---|---|
| **701** | Venituri din vanzarea produselor finite | Productie vanduta |
| **702** | Venituri din vanzarea semifabricatelor | |
| **704** | Venituri din lucrari executate si servicii prestate | Servicii vandute |
| **707** | Venituri din vanzarea marfurilor | Magazine, comert |
| **708** | Venituri din activitati diverse | |
| **711** | Variatia stocurilor | Modificari de stoc valorice |
| **722** | Venituri din productia de imobilizari corporale | Cand iti construiesti propriul birou |
| **758** | Alte venituri din exploatare | Venituri ocazionale |
| **761** | Venituri din imobilizari financiare | Dividende incasate |
| **766** | Venituri din dobanzi | Dobanzi de la banca |
| **765** | Venituri din diferente de curs valutar | Castiguri din curs |

**Subtilitate**: TOATE conturile clasei 7 sunt de tip P (Pasiv). Cresc pe credit. Cand vinzi marfa, debitezi 4111 (clienti) si crediteazi 707 (venituri).

**Ce verifici aici**: cifra de afaceri (rulajul total credit) pe clasa 7 trebuie sa corespunda cu jurnalul de vanzari si cu D394 raportata la ANAF.

## Clasa 8 — Conturi speciale (regularizari)

Aceasta clasa este folosita rareori si **doar in situatii specifice**:

- **801** — Angajamente acordate (garantii, fidejusiuni)
- **802** — Angajamente primite
- **891** — Bilant de inchidere
- **892** — Bilant de deschidere

In majoritatea firmelor, clasa 8 are foarte putine inregistrari sau deloc. Costify nu o include in CPP.

## Clasa 9 — Contabilitatea de gestiune (optionala)

Aceasta clasa este pentru **contabilitatea de gestiune interna** — calcul de costuri, alocari pe departamente, analiza de rentabilitate. Este complet **optionala** si se foloseste doar la firme medii/mari cu nevoi de control intern.

- **921** — Cheltuieli ale activitatii de baza (pe departamente)
- **922** — Cheltuieli ale activitatilor auxiliare
- **931** — Costul productiei
- **933** — Costul productiei in curs

In Costify, clasa 9 nu este inca suportata explicit. Pentru clientii care o folosesc, datele trec prin pipeline ca orice alte conturi, dar nu sunt grupate in rapoarte speciale.

## Sumarul

Pentru a memora rapid:

| Clasa | Continut |
|---|---|
| 1 | Capital |
| 2 | Imobilizari |
| 3 | Stocuri |
| 4 | Terti (creante + datorii + stat + salarii) |
| 5 | Bani (banca + casa) |
| 6 | Cheltuieli |
| 7 | Venituri |
| 8 | Speciale |
| 9 | Gestiune (optional) |

Daca tii minte aceasta lista, poti citi orice cod contabil dupa prima cifra: vezi `4423` → "ah, e in clasa 4, deci e cont de terti, probabil ceva legat de stat" → confirmi: "TVA de plata".

## Urmatori pasi

- [Tipuri de conturi: A, P, B](./tipuri-conturi-apb.md) — cum se comporta fiecare cont la D si C
- [Conturi sintetice vs analitice](./conturi-sintetice-analitice.md) — sub-conturile specifice firmei
- [Planul de conturi OMFP 1802](./plan-de-conturi.md) — vedere de ansamblu
