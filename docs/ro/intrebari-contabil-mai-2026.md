# Intrebari pentru contabil — mai 2026

Salut Claudia,

Am terminat alinierea catalogului de conturi al platformei la textul oficial OMFP 1802/2014 consolidat (am parsat documentul de pe lege5.ro direct) si la exportul Saga 2026. Catalogul are acum **565 de conturi** fata de 324 cum era la inceput.

Inainte sa-ti scriu, am verificat fiecare raspuns pe care ni l-ai dat impotriva OMFP oficial. Majoritatea s-au confirmat sau s-au rezolvat singure. Mai sunt **3 intrebari reale** la care raspunsul tau schimba ce vede contabilul in platforma — pe acelea le punem aici. Restul (decizii pe care le-am luat deja cu temei OMFP + Saga, plus features de roadmap) sunt la final ca FYI, fara nevoie de raspuns.

Cele 3 intrebari sunt scurte. Ar trebui sa-ti ia 15 minute total.

---

## 1. Formula TVA de plata — care raspuns al tau il aplicam?

Ne-ai dat doua formule diferite in raspunsuri diferite, fara sa fie clar care o anuleaza pe cealalta. Vreau sa stabilim definitiv.

### Ce ne-ai zis tu

In **intrebari-contabil-plan-conturi.md sectiunea 2.4** (raspuns mai vechi):

> TVA de plata = `4427 finC − 4426 finD − 4424 finD − 4428 finC`

In **intrebari-contabil-plan-conturi.md sectiunea "4 KPI-uri"** (raspuns mai recent):

> Corect: TVA net de plată = sold 4423 − sold 4424. Dacă pozitiv → datorie. Dacă negativ → creanță.
> Problema cu 4427 - 4426 - 4428 - 4424: după închiderea lunară corectă în SAGA, 4426 și 4427 trebuie să aibă sold 0 (au fost compensate).

### Ce am implementat (fallback automat)

Codul detecteaza in ce stare e luna si alege formula corecta:

| Starea conturilor | Formula folosita | Cand se aplica |
|---|---|---|
| **Post-close** (4423/4424 au sold, 4426/4427/4428 sunt 0) | `sold 4423 − sold 4424` | Lunile inchise corect lunar in Saga |
| **Pre-close** (4426/4427/4428 au sold, 4423/4424 sunt 0) | `4427 finC − 4426 finD − 4428(net)` | Lunile in curs / neinchise inca |

Am scos 4424 din formula pre-close ca sa nu se dubleze (4424 reprezinta TVA de recuperat dintr-o perioada anterioara, deja factorul in 4423 post-close).

### Intrebare

**Aceasta interpretare este corecta?** Vreau sa fiu sigur ca nu am inteles gresit lucrul cu `4424` in formula pre-close. Specific:

1. Cand luna e in stare pre-close (4427, 4426, 4428 inca au sold > 0), **excludem complet 4424 din formula**? Sau il scadem in continuare?
2. Pentru un client care nu face inchiderea lunara (lasa toate pe 4426/4427/4428 si nu trece prin 4423), care e formula corecta? Apare la unii clienti cu reguli speciale (ex: TVA la incasare).

---

## 2. Conflictul contului 121 la QHM21

In **intrebari-contabil-plan-conturi.md sectiunea 1.3** ai scris explicit:

> Despre conflictul de la QHM as vrea sa discutam, sa inteleg care e situatia.

Niciodata nu am ajuns sa-l discutam. Acum, ca platforma e in productie cu catalog corect, ar fi bine sa-l clarificam ca sa nu mai stam cu el deschis.

### Ce vad eu in jurnalul QHM21

Daca deschid balanta QHM21 NETWORK SRL la decembrie 2024 (ultima luna completa), contul 121 are:

- Sold initial: X RON (debit sau credit, depinde de ce a venit din 2023)
- Rulaj debit: cumulul cheltuielilor clasa 6 inchise pe parcurs
- Rulaj credit: cumulul veniturilor clasa 7 inchise pe parcurs  
- Sold final: rezultatul exercitiului 2024

Pana aici totul e standard.

**Suspiciunea mea**: la trecerea 2023 → 2024 (sau 2022 → 2023), s-a facut o inregistrare neasteptata pe 121 — ori soldul de la finalul anului anterior n-a fost reportat in 117 (sau 1171), ori s-a inregistrat o operatie de inchidere multipla.

### Intrebare

**Putem deschide impreuna balanta QHM21 (sau te uiti tu pe ea in Costify si imi scrii) sa vedem ce gasim pe 121?** Specific:

- (a) Soldul curent pe 121 corespunde rezultatului 2024 real? Sau e umflat cu solduri vechi?
- (b) Cand inchiderea 121 → 117 se face efectiv in jurnalul QHM (data calendaristica)?
- (c) Daca soldul e gresit, ce nota contabila ar trebui sa apara pentru a-l corecta? (asta ma intereseaza si pentru viitor — daca alti contabili au aceeasi problema, sa stim ce sa le aratam in Costi)

Acces la QHM21 ai prin contul tau (esti adminul firmei in platforma). Link direct: https://costify.ro/clients/qhm21-network-srl?tab=balanta&year=2024&month=12

---

## 3. Contul 4373 — il pastram sau il scoatem din catalog?

OMFP 1802 oficial actualizat **nu mai contine** contul 4373. Am verificat parsarea textului consolidat de pe lege5.ro — nu apare nicaieri.

Dar QHM21 are 26 de inregistrari istorice pe 4373 (in 2022 si inceput de 2023, dupa explicatiile din jurnal: "Fd. garantare creante salariale"). Probabil tu sau predecesorul ai inregistrat acolo contributia la FGCS (0.25% pe salariul brut, plafonata).

In raspunsul tau din **intrebari-contabil-plan-conturi.md sectiunea "1. Catalogul OMFP — conturi lipsa"** ai scris:

> 4373 — Fondul de garantare a creantelor salariale (P). Cont introdus prin OMFP 4291/2022.

OMFP 4291/2022 chiar exista si modifica planul de conturi. Dar in textul OMFP 1802 consolidat la mai 2026 (cel oficial actual de pe lege5.ro), 4373 **nu mai apare**. Probabil a fost reintegrat in 436 (CAM — contributia asiguratorie de munca) sau intr-un alt cont 437x.

### Ce am facut momentan

L-am pastrat in catalog (cu tipul P), cu rolul `social_contrib` pentru KPI-uri. QHM21 il vede cu denumirea corecta, nu mai apare ca "nemapat".

### Intrebare

**Ce facem mai departe?** Vad 3 optiuni:

- **(a) Il scoatem complet din catalog.** Curat fata de OMFP actual, dar QHM21 va vedea 26 de inregistrari ca "nemapate" la istoric.
- **(b) Il pastram cu un flag `deprecated: true`.** Apare in catalog cu o eticheta "Cont istoric — nu mai e valid in OMFP curent". Pentru jurnale istorice e ok, dar contabilul stie ca nu mai are voie sa-l foloseasca azi.
- **(c) Il pastram fara nicio mentiune** (cum e azi). Simplu, dar contabilul nu primeste niciun semnal ca contul nu mai e valid.

Recomandarea mea e **(b)** — onest fata de OMFP actual, dar pastreaza retro-compatibilitatea. Si poate apare la mai multi clienti decat QHM21 daca au jurnale vechi din 2022-2023.

**Esti de acord cu (b), sau preferi alta varianta?**

---

# FYI — decizii deja luate, fara nevoie de raspuns

Aici sunt lucrurile la care raspunsurile tale **erau ambigue sau contraziceau Saga/OMFP**, si pentru care am decis singur pe baza textului oficial OMFP 1802/2014 consolidat. Le listez ca sa stii ce s-a intamplat. Daca esti in dezacord cu vreuna, scrie-mi si o revizuim.

### Tipurile 5121 / 5124 — pastrate ca B (bifunctional)

OMFP HTML zice tip A pentru conturile bancare. Tu n-ai zis explicit, dar Saga si practica spun B (banca poate avea descoperit de cont). Am pastrat B pentru ca acopera ambele scenarii. Daca un client n-are niciodata descoperit, soldul ramane mereu pe debit — comportament identic cu A.

### Tipurile 609 / 709 / 711 — pastrate per Saga

OMFP HTML zice A pentru 609/711 (sunt in clasa 6) si P pentru 709 (in clasa 7). Practica zice opusul:
- **609** "Reduceri comerciale primite" se inregistreaza in credit ca reducere de cheltuieli → tip P
- **709** "Reduceri comerciale acordate" se inregistreaza in debit ca reducere de venituri → tip A
- **711** "Variatia stocurilor" poate fi sold C (crestere) sau sold D (descrestere) → tip B

Saga aplica aceeasi logica. Am pastrat valorile noastre.

### Denumirile 643 / 644 — confirmate definitiv

In raspunsul tau 1.5 ai scris ca 643 = "Cheltuieli cu primele reprezentand participarea personalului la profit". OMFP oficial spune ca **643 = "Cheltuieli cu remunerarea in instrumente de capitaluri proprii"** (ESOP / stock options), si **644 = "Cheltuieli cu primele reprezentand participarea personalului la profit"**. Probabil ai inversat in graba. Avem denumirile corecte conform OMFP. cppLine ramane 14a pentru ambele (cum ai indicat tu).

### Contul 581 in KPI Cash — exclus

Tu in 2.4 spuneai "include cu warning", dar in "4 KPI-uri" spuneai "exclude — sold normal 0". Am ales raspunsul mai recent. Daca 581 are sold ≠ 0, contabilul vede o problema in balanta direct, nu trebuie sa apara in KPI Cash.

### Conturi 615 / 8038 / 8039 / 8032 / 8033 / 223 / 224 — denumiri corectate dupa OMFP

Aveai cateva confuzii pe care le-am rezolvat din textul oficial:

- **615** = "Cheltuieli cu pregatirea personalului" (nu "transferul" cum ai zis tu in 2.1)
- **8038 / 8039** erau inversate in seed-ul nostru. OMFP confirma: 8038 = "Bunuri primite in administrare", 8039 = "Alte valori in afara bilantului"
- **8032 / 8033** la fel: 8032 = "primite spre prelucrare", 8033 = "primite in pastrare/custodie"
- **223 / 224** la fel: 223 = "Instalatii tehnice in curs de aprovizionare", 224 = "Mobilier in curs de aprovizionare"

### Conturile 6816, 7816, 794 — adaugate ca standard OMFP

Le-ai mentionat ca "lipsa din lista voastra" si am adaugat. Textul OMFP oficial le contine. ✓

---

# Pe roadmap (nu sunt intrebari)

Astea sunt lucruri pe care le-ai mentionat si la care am zis "implementam mai incolo" — toate sunt in lista mea, nu trebuie sa le repeti:

| Item | Status |
|---|---|
| Warning "impozit micro inregistrat in 635" (5.1) | Roadmap |
| Warning "rezultat brut pozitiv fara impozit" pe luna 12 (5.2) | Roadmap |
| Tranzitia micro → profit standard cu nota explicativa (5.3) | Roadmap |
| Calcul efectiv impozit estimat (6.3) | Roadmap |
| F20 in varianta extinsa 62 randuri pentru clienti > 1 mil EUR (6.1) | Roadmap |
| Coloana "exercitiul precedent" in F20 (6.2) | Roadmap |
| Implementarea semnului negativ pe rd. 34 pentru 794 | Roadmap |
| Rand informational "din care: subventii pentru investitii (7584)" | Roadmap |
| Generare XML pentru depunere F20 la ANAF (8.2) | Roadmap |
| Verificare post-migratie clientilor existenti (6.2) | Roadmap |

# Astept fisierul F20 OMF 107/2025

In raspunsuri 1.3, 2.1 si 2.2 ai facut referire de mai multe ori la **OMF 107/2025** ca avand o structura F20 noua, cu randuri dedicate pentru:

- **725** (Venituri din productia de investitii imobiliare) — rand dedicat, nu rd. 09
- **755, 756, 757** — randuri dedicate
- **7412–7419** (subventii) — eventual mutate de pe rd. 11 pe rd. 12
- **6351** (impozit suplimentar) — rand dedicat sau rd. 34
- **6051–6058** (utilitati split) — eventual sub-randuri 13c-13d-13e

In momentul de fata, in platforma toate sunt mapate dupa F20 din Anexa 3 (varianta 35 randuri) pentru ca **nu avem fisierul OMF 107/2025 oficial**. Daca-l ai, trimite-l (XLS sau PDF) si actualizam structura F20 in 1-2 ore. Pana atunci, raportul F20 detaliat este corect per Anexa 3 si va fi update-uit cand primim fisierul.

---

**Multumesc. Cele 3 intrebari de sus sunt singurele care ne blocheaza acum. Restul e fie deja rezolvat, fie pe roadmap.**

— Costi (via Cori)
