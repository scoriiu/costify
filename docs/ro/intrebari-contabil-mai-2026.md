# Intrebari pentru contabil — mai 2026

Salut Claudia,

Am terminat alinierea catalogului de conturi din Costify la textul oficial OMFP 1802/2014 consolidat (l-am parsat direct de pe lege5.ro) si la exportul Saga 2026. Catalogul are acum **565 de conturi** fata de 324 cat era la inceput, cu denumiri, tipuri si grupari pe randuri F20 corecte.

Verificand fiecare raspuns pe care ni l-ai dat anterior impotriva textului OMFP oficial, majoritatea s-au confirmat. Au mai ramas **doua intrebari concrete** unde decizia ta schimba un calcul afisat in platforma, si una operationala despre un cont scos de OMFP.

Sub fiecare intrebare gasesti exact ce vrem sa stim, fara ambalaj. Restul documentului e FYI: decizii pe care le-am luat singuri (cu sursa OMFP/Saga), plus lista de roadmap.

Estimam 15 minute total pentru a raspunde.

---

## 1. TVA de plata — confirma formula pentru perioada in curs

### Context

Ne-ai trimis doua formule, in raspunsuri diferite, fara sa fie clar care e prioritara.

**In sectiunea 2.4** (mai veche):
```
TVA de plata = 4427.finC − 4426.finD − 4424.finD − 4428.finC
```

**In sectiunea "4 KPI-uri"** (mai recenta):
```
TVA de plata = sold 4423 − sold 4424
Pozitiv = datorie. Negativ = creanta.
```
Si adaugai: *"dupa inchiderea lunara corecta in Saga, 4426 si 4427 trebuie sa aiba sold 0 (au fost compensate)"*.

### Ce am implementat

Cele doua formule descriu **doua stari diferite** ale lunii in Saga. Algoritmul nostru detecteaza automat starea:

| Conditie | Stare | Formula folosita |
|---|---|---|
| 4423 sau 4424 au sold nenul | POST-CLOSE (luna inchisa lunar in Saga) | `sold 4423 − sold 4424` |
| 4423 si 4424 zero, dar 4426/4427/4428 au sold | PRE-CLOSE (luna in curs sau neinchisa) | `4427.finC − 4426.finD − 4428(net)` |

In starea PRE-CLOSE am **scos** `4424` din formula. Motivul: daca 4424 are sold debitor, inseamna ca acel sold provine **dintr-o luna anterioara** (regularizare pe care contabilul nu a inchis-o sau o reportare voita). El reduce TVA de plata curent, dar e deja acoperit de logica POST-CLOSE pentru lunile inchise. A-l scadea si in pre-close ar contoriza dublu.

### Intrebarea exacta

**In starea PRE-CLOSE (luna in curs, 4423/4424 sunt zero, 4426/4427/4428 au sold), formula corecta este:**

- **(a)** `4427.finC − 4426.finD − 4428(net)` (cum avem azi — 4424 exclus pentru ca e zero in starea asta)
- **(b)** `4427.finC − 4426.finD − 4424.finD − 4428.finC` (cum ai scris in 2.4 — incluzand 4424)
- **(c)** Alt raspuns — descrie tu

Daca raspunsul e (b), care e scenariul concret in care 4424 are sold nenul intr-o luna pre-close? (Vreau sa-l reproduc in test ca sa ma asigur ca-l acoperim.)

---

## 2. Contul 4373 (Fondul de garantare a creantelor salariale) — il pastram sau il scoatem?

### Context

OMFP 1802/2014 in versiunea consolidata actuala de pe lege5.ro **nu mai contine** contul 4373. Am parsat textul complet — nu apare nicaieri.

Dar in **raspunsul tau "1. Catalogul OMFP — conturi lipsa"** ai scris explicit:

> 4373 — Fondul de garantare a creantelor salariale (P). Cont introdus prin OMFP 4291/2022.

Si in jurnalul QHM21 sunt 26 de inregistrari pe 4373 (in 2022–2023), cu explicatii ca *"Fd. garantare creante salariale"*.

Tu il vezi ca un cont curent. OMFP consolidat la mai 2026 il scoate. Aici nu avem cum sa decidem singuri.

### Intrebarea exacta

**Contul 4373 azi (mai 2026), dupa toate modificarile OMFP la zi, este:**

- **(a) Cont curent valid** — il pastram in catalog ca atare. Daca tu il vezi corect inregistrat, inseamna ca exportul lege5.ro pe care l-am parsat e incomplet/desincronizat. (In acest caz da-ne te rog OMFP-ul concret care il (re)introduce dupa OMFP 4291/2022.)
- **(b) Cont reintegrat in 436** — FGCS a fost reintegrat in contributia asiguratorie de munca (CAM). In acest caz scoatem 4373 din catalog si lasam doar 436. Inregistrarile istorice QHM21 vor aparea ca "nemapate" la istoric — semnaland corect ca acel cont nu mai e valid.
- **(c) Cont istoric** — a existat o perioada, acum nu mai e folosit. Il marcam in catalog cu flag `deprecated: true`. Pe ecran apare cu badge "Istoric — nu mai e valid" si Costi avertizeaza cand cineva il foloseste in jurnal nou.

Recomandarea noastra e **(c)** daca contul chiar a iesit din OMFP — pastreaza retro-compatibilitatea, da semnal clar pe inregistrari noi. Dar daca tu zici (a), trimite-ne actul normativ ca sa-l pastram in catalog cu sursa corecta.

---

# FYI — decizii pe care le-am luat noi, fara sa-ti cerem aprobarea

Aici e ce am decis singuri pe baza textului OMFP oficial + Saga + practica. **Nu trebuie sa raspunzi** — doar ca sa stii ce vede contabilul azi in platforma. Daca esti in dezacord cu vreuna, scrie-ne.

### Tipurile 5121, 5124 → B (nu A cum zice OMFP HTML)

Conturile bancare. OMFP HTML le pune tip A. Saga si practica le pun B (banca poate avea descoperit de cont — sold creditor). Am pastrat B pentru ca acopera ambele scenarii: clientii fara descoperit vad mereu sold debitor, cei cu descoperit vad sold creditor cand e cazul. Daca am avea A, descoperitele ar fi anomalii vizuale in balanta.

### Tipurile 609, 709, 711 — pastrate dupa Saga, nu dupa clasa

- **609** "Reduceri comerciale primite" (clasa 6 → ar fi A) — pastrat **P**, pentru ca se inregistreaza pe credit ca reducere de cheltuieli
- **709** "Reduceri comerciale acordate" (clasa 7 → ar fi P) — pastrat **A**, pentru ca se inregistreaza pe debit ca reducere de venituri
- **711** "Venituri aferente costurilor stocurilor de produse" — pastrat **B**, pentru ca variatia stocurilor poate fi pozitiva sau negativa

Acestea sunt counter-balance accounts. Saga le trateaza la fel. OMFP HTML deduce tipul din clasa, dar pentru aceste 3 conturi clasa nu reflecta semnul economic.

### Denumirile 643 / 644 — corectate dupa OMFP

In raspunsul 1.5 ai scris ca **643 = "Cheltuieli cu primele reprezentand participarea personalului la profit"**. OMFP 1802 oficial spune:

- **643 = Cheltuieli cu remunerarea in instrumente de capitaluri proprii** (ESOP / stock options)
- **644 = Cheltuieli cu primele reprezentand participarea personalului la profit** (numele pe care l-ai dat tu pentru 643)

Probabil le-ai inversat in graba. Am ales numele oficiale OMFP. **cppLine 14a pentru ambele** — exact cum ai indicat tu. Daca ai inregistrat operatii pe 643 cu sensul "prime participare", ele apar in continuare pe rd. 14a — nimic nu se schimba pe ecran in afara de denumire.

### Contul 581 in Cash KPI — exclus

In 2.4 ai zis "include cu warning daca sold ≠ 0". In "4 KPI-uri" ai zis "exclude — sold normal 0, daca are sold e eroare de operare". Am ales raspunsul mai recent: 581 este complet exclus din Cash. Daca un client are sold pe 581 (eroare de operare), apare oricum in Balanta cu badge de atentie — nu mai trebuie inca un canal de avertizare in KPI.

### Denumiri corectate dupa OMFP

| Cod | Inainte | Acum |
|---|---|---|
| 615 | "Cheltuieli cu transferul" (cum ai zis tu in 2.1) | "Cheltuieli cu pregatirea personalului" |
| 8038 ↔ 8039 | inversate in seed-ul vechi | 8038 = "Bunuri primite in administrare", 8039 = "Alte valori in afara bilantului" |
| 8032 ↔ 8033 | inversate | 8032 = "primite spre prelucrare", 8033 = "primite in pastrare/custodie" |
| 223 ↔ 224 | inversate | 223 = "Instalatii in curs de aprovizionare", 224 = "Mobilier in curs de aprovizionare" |
| 605 | "Cheltuieli privind energia si apa" | "Cheltuieli privind utilitatile" |
| 704 | "Venituri din lucrari si servicii" | "Venituri din servicii prestate" |
| 642 | scurt | "Cheltuieli cu avantajele in natura si tichetele acordate" |
| 361, 356, 396 | "Animale si pasari" | "Active biologice de natura stocurilor" |

### Conturi adaugate ca standard OMFP

Le-ai mentionat ca lipsa din catalog si erau intr-adevar standard OMFP — le-am adaugat: **6816, 7816, 794, 467, 235, 463, 6053, 6058**, plus inca 193 conturi din clasele 1–9 pe care le-am gasit in textul oficial dar nu erau in seed-ul nostru (ex: 1081, 1411, 2071, 2075, 6351, 6456, 6587, 4282, 5187).

---

# Pe roadmap — nu sunt intrebari

Ai mentionat lucrurile astea si am zis "implementam mai incolo". Sunt in lista, **nu trebuie sa le repeti**.

| Item | Origine |
|---|---|
| Warning "impozit micro inregistrat in 635" | 5.1 |
| Warning "rezultat brut pozitiv fara impozit" doar pentru luna 12 | 5.2 |
| Tranzitia micro → profit standard cu nota explicativa pe rd. 34 | 5.3 |
| Camp "impozit estimat" simplificat (V1: rezultat × cota nominala) | 6.3 |
| F20 in varianta extinsa 62 randuri pentru CA > 1 mil EUR | 6.1 |
| Coloana "exercitiul precedent" in F20 | 6.2 |
| Semnul negativ pe rd. 34 pentru 794 (reduce impozitul grup fiscal) | 2.2 |
| Sub-rand informational "din care: subventii pentru investitii (7584)" | 2.2 |
| Generare XML F20 pentru depunere ANAF | 8.2 |
| Verificare post-migratie pentru clientii existenti | 6.2 |

---

# Astept de la tine: fisierul F20 OMF 107/2025

In raspunsuri 1.3, 2.1 si 2.2 ai facut referire la **OMF 107/2025** ca avand o structura F20 noua, cu randuri dedicate pentru:

- **725** (Venituri din productia de investitii imobiliare) — rand dedicat, nu rd. 09
- **755, 756, 757** — randuri dedicate
- **7412–7419** (subventii) — mutate de pe rd. 11 pe rd. 12
- **6351** (impozit suplimentar) — rand dedicat sau rd. 34
- **6051–6058** (utilitati split) — eventual sub-randuri 13c/13d

Azi, in platforma, toate mapeaza dupa F20 din Anexa 3 (varianta 35 randuri) pentru ca nu avem fisierul OMF 107/2025 oficial. F20 detaliat este corect per Anexa 3.

**Daca ai fisierul OMF 107/2025 oficial** (XLS sau PDF), trimite-l si actualizam structura F20 in 1-2 ore. Pana atunci nu schimbam nimic — F20-ul afisat azi este conform reglementarii precedente, valid pentru toate situatiile financiare 2024 si anterioare.

---

**Multumim. Cele 2 intrebari de sus sunt singurele care ne blocheaza acum.**

— Cori
