# Intrebari pentru contabil — formularul F20 detaliat

Costify afiseaza Contul de Profit si Pierdere in doua moduri: **Simplificat** (gruparile clasice OMFP) si **F20 detaliat** (formatul oficial ANAF cu 35 de randuri si sub-randuri 13a-e, 14a-b, 15a-b, 16a-b, 17a-d, 18a-b).

Am facut mapping-ul cont → rand F20 pe baza formularului oficial OMFP 1802 Anexa 3, dar exista un set de cazuri concrete pe care vrem sa le clarificam cu tine. Raspunsurile tale ne ajuta sa fim siguri ca raportul e corect inainte sa-l iei tu si sa-l depui la ANAF.

Toate intrebarile au raspunsul concret asteptat (cont X pe randul Y, sau "da/nu"). Nu sunt teoretice, sunt despre cazuri reale gasite in jurnalul firmelor 4Walls Studio, Digital Nomads si QHM21.

---

## 1. Mapping-uri care raman incerte

### 1.1 Contul 654 "Pierderi din creante si debitori diversi"

L-am pus pe **rd. 16a "Cheltuieli cu ajustarile pentru deprecierea activelor circulante"**, alaturi de 6814.

Argumentul nostru: pierderile din creante sunt o forma de depreciere a activelor circulante (creante neincasabile), deci tin de aceeasi familie cu 6814.

Dar am vazut ca alti contabili il pun pe **rd. 17d "Alte cheltuieli de exploatare"** (impreuna cu despagubiri, donatii, active cedate).

**Intrebare**: Care este corect conform OMFP 1802 Anexa 3 — rd. 16a sau rd. 17d?

### 1.2 Contul 786 "Venituri din ajustari pentru pierderea de valoare"

L-am pus pe **rd. 24 "Alte venituri financiare"** ca varianta default.

Formularul oficial are si rd. 26b "Ajustari de valoare privind imobilizarile financiare — venituri", dar in practica majoritatea firmelor il lasa gol si pun totul pe rd. 24. In Saga la fel — totul ajunge pe 786 fara detaliere.

**Intrebare**: E ok sa-l lasam pe rd. 24, sau vrei sa-l splitam (partea aferenta imobilizarilor financiare → rd. 26b, restul → rd. 24)? Daca da, cum distingem in practica cele doua cazuri?

### 1.3 Contul 725 "Venituri din productia de investitii imobiliare"

L-am pus pe **rd. 09 "Productia realizata de entitate pentru scopurile sale proprii si capitalizata"**, impreuna cu 721 si 722.

OMFP 85/2022 trateaza separat investitiile imobiliare in unele contexte (clasa 215 activ).

**Intrebare**: Confirmi ca 725 merge pe rd. 09 ca productie proprie, sau ar trebui pe un rand distinct?

### 1.4 Contul 606 "Cheltuieli privind animalele si pasarile"

L-am pus pe **rd. 13b "Alte cheltuieli materiale"**.

**Intrebare**: E corect aici, sau ar trebui pe rd. 13a impreuna cu materiile prime (601, 602)? Relevant pentru firme agricole.

### 1.5 Contul 644 "Remunerare in instrumente de capitaluri proprii"

L-am pus pe **rd. 14a "Salarii si indemnizatii"**, impreuna cu 641, 642.

**Intrebare**: Apare explicit pe rd. 14a in practica voastra (in special pentru SRL-urile clasice care nu au scheme de stock options), sau ar trebui pe un sub-rand separat?

---

## 2. Verificarea mapping-ului complet pe clase

Am atasat doua tabele cu **mapping-ul integral** pentru clasele 6 (cheltuieli) si 7 (venituri). Te rugam sa le parcurgi si sa ne semnalezi orice cont pe care l-am rutat gresit.

### 2.1 Mapping clasa 6 — cheltuieli

| Cont | Denumire | Rand F20 |
|------|----------|----------|
| 601 | Materii prime | 13a |
| 602 | Materiale consumabile | 13a |
| 603 | Materiale obiecte de inventar | 13b |
| 604 | Materiale nestocate | 13b |
| 605 | Energia si apa | 13c |
| 606 | Animale si pasari | 13b |
| 607 | Marfuri | 13d |
| 608 | Ambalaje | 13b |
| 609 | Reduceri comerciale primite | 13e (semn −) |
| 611–628 | Prestatii externe | 17a |
| 635 | Alte impozite, taxe si varsaminte | 17b |
| 641, 642, 644 | Salarii si indemnizatii | 14a |
| 643, 645, 6451–6458, 646 | Asigurari sociale (inclusiv CAM) | 14b |
| 652 | Protectia mediului | 17c |
| 654 | Pierderi din creante | **16a sau 17d?** (vezi §1.1) |
| 658, 6581, 6582, 6583, 6588 | Alte cheltuieli de exploatare | 17d |
| 663, 664, 665, 667, 668 | Alte cheltuieli financiare | 28 |
| 666 | Cheltuieli cu dobanzile | 27 |
| 681, 6811, 6813 | Amortizari / ajustari imobilizari | 15a |
| 6812 | Cheltuieli cu provizioanele | 18a |
| 6814 | Ajustari active circulante | 16a |
| 686 | Ajustari financiare (cheltuieli) | 26a |
| 691, 694, 695, 697, 698 | Impozit | 34 (filtrat dupa regimul fiscal) |

**Intrebare**: Ai vreo corectie sau cont lipsa pe care il vezi des in practica?

### 2.2 Mapping clasa 7 — venituri

| Cont | Denumire | Rand F20 |
|------|----------|----------|
| 701–706, 708 | Vanzari productie/servicii | 02 |
| 707 | Vanzari marfuri | 03 |
| 709 | Reduceri comerciale acordate | 04 (semn −) |
| 711, 712 | Variatia stocurilor | 07 (crestere) sau 08 (reducere) |
| 721, 722, 725 | Productia de imobilizari | 09 |
| 7411 | Subventii aferente CA | 06 |
| 741, 7412–7419, 754, 758, 7581–7583, 7588, 781 | Alte venituri exploatare | 11 |
| 7584 | Subventii pentru investitii | 10 |
| 761 | Interese de participare | 21 |
| 762, 763 | Investitii / creante imobilizate | 22 |
| 764, 765, 767, 768 | Alte venituri financiare | 24 |
| 766 | Venituri din dobanzi | 23 |
| 786 | Venituri ajustari financiare | **24 sau split pe 26b?** (vezi §1.2) |
| 7812 | Venituri din provizioane | 18b |
| 7813 | Venituri ajustari imobilizari | 15b |
| 7814 | Venituri ajustari active circulante | 16b |

**Intrebare**: Ai vreo corectie sau cont lipsa?

---

## 3. Sub-conturile 7812, 7813, 7814 — confirmare denumiri

In catalogul OMFP avem `781` si `786` ca conturi sintetice, dar nu si sub-conturile 7812, 7813, 7814. Formularul F20 le foloseste explicit pe randurile 18b, 15b, 16b.

**Intrebari**:

1. Confirmi ca `7812`, `7813`, `7814` sunt sub-conturile canonice? Sau in practica se folosesc alte coduri (ex: `78121`, `78131`)?
2. Care sunt denumirile exacte conform OMFP 1802 pentru fiecare?
3. Tipul (P pentru toate)?
4. Confirmi rutarea: 7812 → rd. 18b, 7813 → rd. 15b, 7814 → rd. 16b?

Pana cand confirmi, randurile 15b/16b/18b apar cu valoare 0 in raportul F20 din Costify.

---

## 4. Reduceri comerciale (609 si 709) — directie inversa

Am observat o problema reala pe firma **QHM21 Network SRL** in 2025: contul `609 "Reduceri comerciale primite"` are rulaj pe credit (`rulajTC = 330,58`). Pe F20 il tratam corect (rd. 13e cu semn negativ, scade din total cheltuieli), dar pe CPP Simplificat il ignoram complet (heuristica veche se uita doar la rulajTD pentru cheltuieli).

Rezultatul: F20 si Simplificat dau **rezultate diferite cu 330,58 RON** pe toate lunile, exclusiv din cauza acestui cont.

Stim ca trebuie sa corectam Simplificat-ul, dar inainte vrem sa ne dai lista **exacta** a conturilor care functioneaza pe directie inversa. Asa evitam o regula generala care ar putea afecta gresit alte cazuri.

**Intrebari**:

1. Confirmi ca **609** (Reduceri comerciale primite) este de tip **P** si rulajul pe credit reduce cheltuiala?
2. Confirmi ca **709** (Reduceri comerciale acordate) este de tip **A** si rulajul pe debit reduce venitul?
3. Mai exista alte conturi din clasele 6 sau 7 care functioneaza pe directie inversa fata de natura grupei? (de ex. conturi de tip P in CHELTUIELI sau de tip A in VENITURI)
4. Pentru fiecare cont semnalat: numele exact OMFP, tipul (A/P/B), randul F20 si semnul (+/−).

---

## 5. Avertismente in interfata — chiar le vrei?

Sunt situatii pe care le-am putea detecta automat si afisa ca avertisment in interfata. Spune-ne care iti sunt utile si care ar fi doar zgomot.

### 5.1 Impozit micro inregistrat in 635

Am vazut cazuri unde impozitul micro a fost inregistrat in `635` "Cheltuieli cu alte impozite" in loc de `698` (eroare frecventa la firmele care tranziteaza de la micro la profit). In acele cazuri, impozitul apare in rd. 17b in loc de rd. 34.

**Intrebare**: Vrei un avertisment in UI cand detectam un client cu regim micro care are si rulaj nenul pe 635? Sau e suficient daca apare in raport asa cum a fost inregistrat?

### 5.2 Rezultat brut pozitiv fara impozit inregistrat

Daca firma are rezultat brut pozitiv (rd. 33 > 0) dar rd. 34 = 0 (niciun impozit inregistrat), e probabil o eroare — fie nu s-a facut inca inchiderea de an, fie contul de impozit a fost gresit.

**Intrebare**: Vrei un avertisment in UI in acest caz? Daca da, doar pentru luna decembrie sau pentru orice luna cumulata?

### 5.3 Tranzitia micro → profit standard in cursul anului

Daca o firma a fost micro in Q1 si profit standard in Q2-Q4 (am rezolvat cazul deschizand un timeline al regimurilor in tab-ul **Setari**), pe raportul cumulat ianuarie-decembrie avem doua conturi de impozit cu rulaj legitim — `698` pentru Q1 si `691` pentru restul. Acum F20 raporteaza doar contul corespunzator regimului afisat in eticheta din header (cel valabil la luna selectata).

**Intrebare**: Pe declaratia anuala F20, rd. 34 trebuie:
- (a) sa fie suma celor doua conturi (698_Q1 + 691_Q2-4) automat?
- (b) sa fie doar contul regimului curent si tu sa adaugi manual contributia perioadei anterioare?
- (c) sa afisam un avertisment in UI cand detectam o tranzitie pe perioada cumulativa, fara sa facem suma automat?

---

## 6. Limitari pe care le stim si vrem confirmate

### 6.1 Forma compacta cu 35 de randuri

Am implementat varianta cu 35 de randuri consolidate (cea care apare in situatiile financiare anuale standard pentru SRL-uri).

**Intrebare**: Mai exista entitati care depun varianta extinsa cu 62 de randuri (ex: firme pe IFRS sau microintreprinderi cu formulare specifice) si pe care vrei sa le acoperim?

### 6.2 Coloana "exercitiul precedent"

Formularul oficial F20 are doua coloane per rand: exercitiul curent si exercitiul precedent. Acum afisam doar exercitiul curent.

**Intrebare**: Cat de prioritar e sa adaugam si coloana anului precedent? E util pentru consultarea ta, sau o adaugam doar cand emitem efectiv declaratia spre ANAF?

### 6.3 Calculul efectiv al impozitului

Costify afiseaza in rd. 34 ce a inregistrat contabilul in conturile 691/698/697/695 in jurnal — **nu** calculeaza de la zero impozitul asteptat (cu praguri, deductibilitati, carry-forward de pierderi etc.).

**Intrebare**: E suficient sa afisam cifra inregistrata, sau te-ar ajuta un al doilea camp "impozit asteptat" care sa-l calculam noi pe baza profitului si a regimului, ca dublu-check?

---

## Multumim

Pentru fiecare sectiune, raspunsul tau direct (chiar si "ok asa", "schimba aici", sau "nu stiu") ne ajuta sa avansam. Raspunsurile se salveaza sub fiecare sectiune — nu trebuie sa trimiti email separat.
