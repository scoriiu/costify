# Debit si credit

Daca ai sa intelegi UN singur lucru din contabilitate, sa fie acesta. **Debit** si **credit** sunt cele doua coloane ale oricarei note contabile, si toate cifrele dintr-o balanta sau dintr-un bilant pleaca de la ele.

Vestea buna: nu e mistic. Vestea proasta: limbajul comun ne pacaleste. "Card de credit" sau "credit la banca" inseamna ca **datorezi bani** — dar in contabilitate, "credit" nu inseamna asta. Hai sa lamurim.

## Definitia tehnica (plictisitoare dar exacta)

> **Debit** = partea **stanga** a unei note contabile.
> **Credit** = partea **dreapta** a unei note contabile.

Atat. Nu inseamna nimic mai mult. Sunt doar doua etichete pentru cele doua coloane. Originea istorica vine din latina si italiana din secolul XV, cand registrele contabilitatii erau scrise pe doua coloane, iar prima coloana se numea "debet" (de la latina "trebuie sa dea"), iar a doua "credit" (de la "are de incasat").

Din punct de vedere logic insa, "debit" si "credit" **nu au sens propriu** — capata sens doar in contextul **tipului de cont**.

## Tipurile de conturi: A, P, B

Toate conturile din planul de conturi OMFP 1802 sunt impartite in trei categorii:

| Tip | Nume | Exemple | Cum cresc | Cum scad |
|---|---|---|---|---|
| **A** | Activ | Banca, Casa, Stocuri, Clienti | Pe **debit** | Pe **credit** |
| **P** | Pasiv | Furnizori, Salarii datorate, Capital | Pe **credit** | Pe **debit** |
| **B** | Bifunctional | TVA, Profit/Pierdere | Variabil | Variabil |

Asta e regula fundamentala:

> **Conturile de Activ (A) cresc pe debit.**
> **Conturile de Pasiv (P) cresc pe credit.**

De ce? Pentru ca asa s-au stabilit conventiile in secolul XV. Nu exista o motivatie matematica adanca — e o conventie, si toata lumea contabila lucreaza la fel.

## Exemple practice

### Exemplu 1: Cumperi marfa cu plata pe loc

Cumperi laptopuri de la furnizor, valoare 5.000 RON, platesti din banca pe loc.

Doua conturi sunt afectate:
- **Stocuri (371)** — cont de **Activ**. Stocul tau **creste** cu 5.000.
- **Banca (5121)** — cont de **Activ**. Banca ta **scade** cu 5.000.

Acum aplicam regulile:
- Activul `371` creste → debit
- Activul `5121` scade → credit

Nota contabila:
```
D: 371 (Stocuri)            5.000 RON
C: 5121 (Banca)             5.000 RON
```

### Exemplu 2: Primesti factura de la furnizor (fara plata)

Furnizorul iti trimite o factura de 3.000 RON pentru servicii, cu termen de plata 30 zile. Inca nu ai platit.

Conturi afectate:
- **Cheltuieli cu serviciile (628)** — cont de **Activ**. Cheltuielile tale **cresc** cu 3.000.
- **Furnizori (401)** — cont de **Pasiv**. Datoriile tale fata de furnizor **cresc** cu 3.000.

Aplicam regulile:
- Activul `628` creste → debit
- Pasivul `401` creste → credit

Nota contabila:
```
D: 628 (Cheltuieli servicii)   3.000 RON
C: 401 (Furnizori)             3.000 RON
```

Atentie la subtilitate: **cheltuielile sunt conturi de Activ** in contabilitate, chiar daca par "ceva ce iese din firma". Logica e ca cheltuiala "consuma" o resursa, iar consumul se acumuleaza pe debit.

### Exemplu 3: Vinzi un produs si incasezi

Vinzi marfa pentru 1.000 RON, clientul plateste pe loc in numerar.

Conturi afectate:
- **Casa in lei (5311)** — cont de **Activ**. Numerarul **creste** cu 1.000.
- **Venituri din vanzarea marfurilor (707)** — cont de **Pasiv**. Veniturile tale **cresc** cu 1.000.

Aplicam regulile:
- Activul `5311` creste → debit
- Pasivul `707` creste → credit

Nota contabila:
```
D: 5311 (Casa)                 1.000 RON
C: 707 (Venituri)              1.000 RON
```

Aceeasi subtilitate: **veniturile sunt conturi de Pasiv** in contabilitate. Pare contraintuitiv ("intra bani la mine, deci e activ?"), dar logica e ca venitul "creeaza" o sursa de finantare a firmei, iar sursele de finantare sunt pe credit.

### Exemplu 4: Iti scade soldul de furnizori (platesti)

Furnizorul de la exemplul 2 iti cere banii dupa 30 zile. Platesti din banca.

Conturi afectate:
- **Furnizori (401)** — cont de **Pasiv**. Datoria **scade** cu 3.000.
- **Banca (5121)** — cont de **Activ**. Banca **scade** cu 3.000.

Aplicam regulile:
- Pasivul `401` scade → debit (opusul cresterii!)
- Activul `5121` scade → credit

Nota contabila:
```
D: 401 (Furnizori)             3.000 RON
C: 5121 (Banca)                3.000 RON
```

## Tabelul rezumativ

Memoreaza acest tabel si esti deja la 80% din ce trebuie sa intelegi despre debit/credit:

|  | Cresc pe... | Scad pe... |
|---|---|---|
| **Activ** | Debit | Credit |
| **Pasiv** | Credit | Debit |

## Conturi bifunctionale (B)

Cele bifunctionale (B) — gen 121 (Profit si pierdere), 4423 (TVA de plata), 4424 (TVA de recuperat) — pot avea sold fie debitor, fie creditor, in functie de situatie:

- Daca firma a inregistrat profit anul trecut → 121 are sold creditor (cum este normal pentru un cont care reprezinta capital propriu).
- Daca firma a inregistrat pierdere → 121 are sold debitor (pierderea se "scade" din capital).

In balanta, contul 121 va aparea fie pe coloana "Sold final D", fie pe coloana "Sold final C", in functie de rezultat. Algoritmul Costify trateaza corect aceasta situatie.

## "Total debit = Total credit" — regula de aur

In orice nota contabila, **suma debitelor trebuie sa egaleze suma creditelor**. Asta este principiul **dublei inregistrari**.

In intregul jurnal, dupa ce aduni toate notele, **total debit = total credit** mereu. Daca nu, ai o eroare undeva.

Balanta de verificare se cheama "de verificare" exact pentru ca verifica acest lucru. Daca total debit ≠ total credit, ceva e gresit si trebuie cautat.

## De ce nu folosim "+" si "-" in contabilitate

O intrebare legitima: "de ce nu folosim semne + si - in loc de debit si credit, ar fi mai simplu". Raspunsul e ca **debit si credit sunt mai bogate semantic**:

- Cu + si - ai avea ambiguitate: "+1000 pe contul 5121, ce inseamna?" Inseamna venit? Inseamna intrare in banca? Trebuie context.
- Cu D si C, contextul este intrinsec: "1000 pe debit la 5121" = banii au intrat in banca. Niciodata altceva.

In plus, sistemul cu D/C permite **dubla inregistrare automata**: orice nota are exact doua parti, ceea ce face verificarile mecanice (suma D = suma C) extrem de puternice.

## Asocieri vizuale care ajuta

Daca te confundi, foloseste asocierea: **debit = stanga = activ care creste**.

In Saga C si in Costify, coloanele sunt asezate intotdeauna in ordinea: data, document, cont D, cont C, suma. Asta inseamna ca pe ecran vezi mereu **D inainte de C**, ceea ce reflecta conventia istorica "stanga inainte de dreapta".

## Urmatori pasi

- [Tipuri de conturi: A, P, B](./tipuri-conturi-apb.md) — explicatie mai detaliata a celor 3 tipuri
- [Nota contabila](./nota-contabila.md) — cum se foloseste D si C in practica
- [Planul de conturi OMFP 1802](./plan-de-conturi.md) — lista tuturor conturilor si tipurilor lor
- [Balanta de verificare](./balanta-de-verificare.md) — cum se verifica ca debit = credit la nivel global
