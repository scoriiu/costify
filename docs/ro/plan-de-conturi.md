# Planul de conturi OMFP 1802

In Romania, fiecare firma care tine contabilitate in partida dubla foloseste **acelasi catalog standard de conturi**, definit prin **OMFP 1802/2014** (Ordinul Ministrului Finantelor nr. 1802 din 2014). Asta inseamna ca, indiferent ca esti SRL de IT, magazin de cartier sau firma de constructii, codurile contabile pe care le folosesti sunt aceleasi: 401 = Furnizori, 5121 = Conturi la banci in lei, 707 = Venituri din vanzarea marfurilor, etc.

Acest articol explica de unde vine acest plan, cum este organizat, si cum il foloseste Costify.

## De ce avem un plan unificat

Inainte sa existe un plan standard, fiecare firma isi alegea propriile coduri pentru conturi. Asta crea probleme:

- **Inspectorii ANAF** trebuiau sa invete codurile fiecarei firme separat — imposibil practic.
- **Comparatii intre firme** erau imposibile (cum compari rentabilitatea a doua restaurante daca au coduri diferite pentru "venituri din mancare"?)
- **Software-ul contabil** trebuia configurat individual pentru fiecare client.

In 1980, Romania a introdus primul plan unificat. De atunci, planul a fost actualizat de mai multe ori, iar versiunea actuala este cea din **OMFP 1802/2014**, cu modificari ulterioare pana in 2025.

## Structura: clase de la 1 la 9

Planul este organizat pe **clase** (cifra de la 1 la 9):

| Clasa | Denumire | Continut general |
|---|---|---|
| **1** | Capital | Capital social, rezerve, profit reportat, credite pe termen lung |
| **2** | Imobilizari | Cladiri, utilaje, masini, software, terenuri, fond comercial |
| **3** | Stocuri | Materii prime, marfuri, produse finite, ambalaje |
| **4** | Terti | Furnizori, clienti, salarii, contributii, TVA, debitori, creditori |
| **5** | Trezorerie | Banca, casa in lei si valuta, credite pe termen scurt |
| **6** | Cheltuieli | Toate cheltuielile firmei (materii prime, servicii, salarii, amortizari) |
| **7** | Venituri | Toate veniturile firmei (vanzari, prestari, dobanzi, alte venituri) |
| **8** | Speciale | Conturi de regularizare, comisioane, gestiune |
| **9** | Gestiune | Conturi pentru contabilitatea de gestiune (optionala, intern) |

In practica, **clasele 1-7** sunt cele care apar in toate firmele. Clasa 8 este folosita pentru ajustari si regularizari speciale. Clasa 9 este pentru contabilitatea de gestiune (calcul de costuri, analiza pe departamente) si este optionala.

## Sintetic vs analitic

Conturile au **3 cifre** in versiunea sintetica (ex: 401, 5121, 707). Asta este nivelul oficial al planului OMFP.

Pentru detalii mai fine, fiecare firma poate adauga **sub-conturi analitice** dupa un punct: 401.00023 (un furnizor anume), 5121.BT (un cont anume la BT), 707.MARFA (vanzari de marfa, separat de 707.SERVICII).

Vezi [Conturi sintetice vs analitice](./conturi-sintetice-analitice.md) pentru detalii.

## Citirea unui cod de cont

Cum interpretezi un cod precum **6041**?

- **Cifra 1** (`6`) — clasa: cheltuieli
- **Cifrele 1-2** (`60`) — grupa: cheltuieli cu materiile prime si materialele
- **Cifrele 1-3** (`604`) — sub-grupa: cheltuieli privind materialele nestocate
- **Cifrele 1-4** (`6041`) — cont: cheltuieli cu carbomburanti

Cu cat e mai lung codul, cu atat e mai specific. Conturile cele mai detaliate au de obicei 4 cifre.

## Conturi des intalnite

Daca esti la inceput, iata 20 de coduri pe care le vei vedea cel mai des:

### Capital si rezerve (clasa 1)
- **101** — Capital social
- **121** — Profit sau pierdere (cont special, vezi mai jos)
- **129** — Repartizarea profitului
- **162** — Credite bancare pe termen lung

### Imobilizari (clasa 2)
- **2131** — Echipamente tehnologice (utilaje)
- **214** — Mobilier, aparatura birotica
- **281x** — Amortizari (cumulative ale 2xx)

### Stocuri (clasa 3)
- **301** — Materii prime
- **371** — Marfuri
- **381** — Ambalaje

### Terti (clasa 4)
- **401** — Furnizori
- **404** — Furnizori de imobilizari
- **4111** — Clienti
- **4118** — Clienti incerti sau in litigiu
- **421** — Personal — salarii datorate
- **431x** — Asigurari sociale (CAS, CASS, somaj)
- **4423** — TVA de plata
- **4424** — TVA de recuperat
- **4426** — TVA deductibila
- **4427** — TVA colectata
- **444** — Impozit pe venit din salarii
- **461** — Debitori diversi
- **462** — Creditori diversi

### Trezorerie (clasa 5)
- **5121** — Conturi la banci in lei
- **5124** — Conturi la banci in valuta
- **5311** — Casa in lei
- **5314** — Casa in valuta
- **5311** — Avansuri spre decontare

### Cheltuieli (clasa 6)
- **601** — Cheltuieli cu materiile prime
- **605** — Cheltuieli privind energia si apa
- **611** — Cheltuieli intretineri si reparatii
- **612** — Cheltuieli cu chiriile
- **621** — Cheltuieli cu colaboratorii
- **623** — Cheltuieli protocol, reclama
- **624** — Cheltuieli cu transportul
- **625** — Cheltuieli cu deplasari, detasari
- **626** — Cheltuieli posta si telecomunicatii
- **627** — Cheltuieli servicii bancare
- **628** — Alte cheltuieli cu serviciile
- **641** — Cheltuieli cu salariile
- **6451** — Cheltuieli cu CAS angajator
- **6452** — Cheltuieli cu somaj angajator
- **6453** — Cheltuieli cu CASS angajator
- **6811** — Cheltuieli amortizari imobilizari
- **691** — Impozit pe profit
- **698** — Impozit pe venit microintreprinderi

### Venituri (clasa 7)
- **701** — Venituri din vanzarea produselor finite
- **704** — Venituri din lucrari executate si servicii prestate
- **707** — Venituri din vanzarea marfurilor
- **758** — Alte venituri din exploatare
- **766** — Venituri din dobanzi (incasate)
- **765** — Venituri din diferente de curs valutar pozitive

Cu aceste 50 de coduri acoperi peste 95% din operatiunile unei firme tipice.

## Conturi speciale care merita atentie

### 121 — Profit sau pierdere

Acest cont este "mortuara" tuturor cheltuielilor si veniturilor anului. La sfarsitul fiecarui an:
- Toate veniturile (clasa 7) se transfera in 121 pe credit.
- Toate cheltuielile (clasa 6) se transfera in 121 pe debit.
- Soldul final al 121 = profitul sau pierderea anului.

Daca soldul e pe credit → ai profit. Daca e pe debit → ai pierdere.

In Costify, conturile clasei 6 si 7 incep mereu fiecare an cu sold zero, exact pentru ca s-au inchis in 121 anul anterior.

### 4111 vs 4118

- **4111** = Clienti normali (cei care platesc la timp).
- **4118** = Clienti incerti sau in litigiu (cei care intarzie sau cu care esti in proces).

E important sa transferi clientii din 4111 in 4118 cand devin "rai", pentru ca asta afecteaza KPI-urile si previziunile.

### 4426 vs 4427 vs 4423

- **4426** = TVA deductibila (TVA-ul de pe facturile tale de cumparare — il poti deduce).
- **4427** = TVA colectata (TVA-ul de pe facturile tale de vanzare — il datorezi statului).
- **4423** = TVA de plata (diferenta intre cele doua, cand ai mai mult colectat decat dedus).

La sfarsitul fiecarei luni, contabilul soldeaza 4426 cu 4427 si stabileste 4423 (sau 4424 daca e invers — TVA de recuperat).

### 691 vs 698

- **691** = Impozit pe profit (16% pentru firme normale)
- **698** = Impozit pe venit microintreprindere (1% sau 3% in functie de criterii)

In functie de regimul fiscal al firmei, vei vedea unul sau altul. O firma care face >500.000 EUR cifra de afaceri trebuie sa treaca de la microintreprindere la profit, deci de la 698 la 691.

## Cum stocheaza Costify planul

Costify are un **catalog OMFP 1802** in baza de date, populat dintr-un fisier seed (`seeds/omfp-1802.json`). Acest catalog contine ~321 de conturi standard, fiecare cu:

- **Cod** (`401`)
- **Denumire** (`Furnizori`)
- **Tip** (A, P sau B)
- **Clasa** (cifra 1-9)
- **Grupa CPP** (optional — pentru gruparea in Cont Profit si Pierdere)
- **Flag special** (optional — `pl_closing` pentru 121, `profit_tax` pentru 691, etc.)

Pentru fiecare client in parte, Costify adauga si **conturile analitice** (gen 401.00023) intr-un tabel separat (`ClientAccount`). Numele lor vine din importul Saga C, dar pot fi editate manual de contabil.

Vezi [Maparea conturilor](./maparea-conturilor.md) pentru detalii arhitecturale.

## Cand un cont nu e standard

Daca un client foloseste un cod care nu e in OMFP standard (ex: `6052` care e sub-cont al `605`), Costify il afiseaza cu numele preluat din Saga (sau din contul parinte prin fallback prefix), dar adauga un **triunghi galben** ca avertisment ca nu e cod oficial.

Asta este util pentru ca:
1. Te avertizeaza ca poate ai gresit codul.
2. Te incurajeaza sa standardizezi si sa folosesti coduri OMFP unde este posibil.
3. Garanteaza ca nu pierzi din vedere conturi care s-ar putea sa nu apara corect in CPP.

Vezi [Citeste balanta de verificare](./citeste-balanta.md) pentru cum apar in UI.

## Modificari OMFP

Planul OMFP nu este static — Ministerul Finantelor il actualizeaza periodic. Modificarile recente notabile:

- **OMFP 56/2018** — clarificari pentru active intangibile.
- **OMFP 3781/2019** — modificari pentru IFRS si situatii consolidate.
- **OMFP 85/2022** — actualizari la conturile de salarii si contributii.
- **OMFP 2048/2024** — pregatiri pentru SAF-T si e-Factura.

In Costify, mentinem catalogul actualizat in fisierul seed. Cand apar modificari, e suficient un PR cu update la `seeds/omfp-1802.json` si un re-seed in productie (idempotent).

## Resurse oficiale

Daca vrei sa citesti OMFP 1802 in original:

- [OMFP 1802/2014 — Monitorul Oficial](https://lege5.ro/) — versiunea oficiala publicata
- [Versiunea consolidata 2024](https://www.mfinante.gov.ro/) — site-ul Ministerului Finantelor
- [CECCAR — ghiduri](https://ceccarbusinessmagazine.ro/) — explicatii practice

## Urmatori pasi

- [Clasele de conturi (1-9)](./clase-de-conturi.md) — detalii pe fiecare clasa
- [Tipuri de conturi: A, P, B](./tipuri-conturi-apb.md) — explicatie pentru tipuri
- [Conturi sintetice vs analitice](./conturi-sintetice-analitice.md) — diferenta dintre `401` si `401.00023`
- [Maparea conturilor](./maparea-conturilor.md) — cum stocheaza Costify catalogul si analiticele
