# Intrebari pentru contabil — conturi nemapate

In Costify, pe tab-ul **Balanta**, conturile care nu apar in catalogul standard OMFP 1802 sunt marcate cu un triunghi galben si listate intr-o sectiune separata "Conturi nemapate". Pe clientii 4Walls am intalnit trei cazuri concrete pe care vrem sa le clarificam cu tine inainte sa decidem cum le tratam.

Raspunsurile tale ne ajuta sa decidem daca le adaugam in catalogul platformei sau le lasam in lista de "verifica".

---

## Contul 235 — apare cu 1.053.530 RON pe dezvoltare imobiliara

Pe firma 4Walls Studio SRL, in 2025, contul `235` apare in 291 de intrari, mereu pereche cu `725` "Venituri din productia de imobilizari" sau cu `401` "Furnizori".

Exemplu de operatie:

```
2025-12-30  D:235  C:725  1.053.530,73  "Prod. in curs DEZVOLTARE IMOBILIARA"
2025-12-02  D:235  C:401  15.288,43     "Intrare HOLZ-ARTIKEL SRL"
```

Contul nu este in catalogul nostru OMFP 1802. Avem impresia ca ar putea fi `235 "Investitii imobiliare in curs de executie"` introdus prin modificarile OMFP 85/2022 sau OMFP 2048/2022, dar nu suntem siguri.

### Intrebari despre contul 235

1. Este `235` un cont valid in planul OMFP 1802 actualizat?
2. Daca da, care e denumirea exacta oficiala?
3. Tipul contului: A (activ), P (pasiv), B (bifunctional)?
4. Ce alte conturi noi din OMFP 85/2022 / OMFP 2048/2022 ai vazut in practica si crezi ca ar trebui sa fie in catalogul nostru? (ex: `215`, `2151–2158`, alte coduri din clasa 2 pe care le vezi des?)

---

## Contul 999 — apare doar pereche cu conturile clasa 8

Pe toate firmele 4Walls + Digital Nomads, contul `999` apare in 166 de intrari, **mereu** impreuna cu un cont din clasa 8 (`8035`, `8033`, etc.). Niciodata cu conturi din clasele 1–7.

Exemplu:

```
2025-12-13  D:8035  C:999  743,79    "Dare in folosinta ACT BRAD VERDE PVC"
2025-12-11  D:8035  C:999  2.202,47  "Dare in folosinta NANOCELL TV CLASA F"
```

Stim din documentatia Saga ca `8035 = 999` este o operatie generata **automat** de Saga pentru obiectele de inventar date in folosinta. Banuim ca `999` este pur si simplu contra-partida tehnica pe care o foloseste Saga pentru clasa 8 (extra-bilantier).

In Costify, conturile clasa 9 sunt deja excluse automat din F20, CPP si Bilant — deci `999` nu strica nimic. Doar ca apare in lista "nemapate" si te face sa-ti pui intrebari.

### Intrebari despre contul 999

1. Confirmi ca `999` este conventie Saga pentru contra-partida claselor 8/9, nu un cont OMFP "real"?
2. Vrei sa-l adaugam in catalog cu numele "Contabilitate in afara bilantului (Saga)" ca sa nu mai apara ca "nemapat"? Sau il lasam acolo cu o explicatie?
3. Ai vazut alte coduri Saga similare in practica (ex: `998`, `997`, contra-partide pentru `8031`, `8032`, `8036`, `8037`, `8038`)?

---

## Contul 463 — apare o singura data, cu DIVIDENDE INTERIMARE

Pe 4Walls Studio si 4Walls Kronis, contul `463` apare exact **o data** pe firma, in octombrie 2025:

```
2025-10-19  D:463  C:456.3  134.243,51  "Intrare LUNGU PETRU_DIVIDENDE INTERIMARE"
```

134.243 RON, un singur partener (Lungu Petru), explicatia "DIVIDENDE INTERIMARE". Contul nu este in catalogul nostru.

Din ce stim din OMFP 1802, grupa 46 contine `461` (Debitori diversi) si `462` (Creditori diversi). `463` nu ne este familiar — banuim ca e fie eroare de inregistrare (poate `461` sau `457` "Dividende de plata"), fie un cont analitic intern. Dar nu vrem sa decidem singuri.

### Intrebari despre contul 463

1. Este `463` un cod valid in OMFP 1802 pe care noi nu-l cunoastem? Daca da, ce reprezinta?
2. In practica ta, ai vazut pattern-ul `463` cu DIVIDENDE INTERIMARE? Este eroare frecventa, cont analitic legitim, sau altceva?
3. Daca e eroare, vrei sa afisam in Costify un avertisment specific ("contul 463 — verifica daca nu era 461 sau 457"), sau ramane in lista generica de "nemapate"?

---

## Pe ce vrem parerea ta in general

Pe langa cele trei conturi specifice de mai sus, ne-ar fi utila parerea ta despre:

### Cum sa prezentam conturile nemapate

Pentru fiecare cont nemapat, vrem sa adaugam in app un buton "Investigheaza" care iti arata:

- prima si ultima utilizare a contului
- numarul de tranzactii
- soldul final D si C (deja vizibil)
- un link "Vezi in jurnal" care deschide tab-ul Registru Jurnal cu filtrul pe acest cont

**Intrebare**: Sunt aceste 4 informatii suficiente ca sa-ti dai seama rapid ce e contul, sau ai vrea sa adaugam si:

- top 3 contrapartide pe debit + top 3 pe credit (ex: pentru `999` ar arata mereu `8035` — semnal ca e tehnic Saga)
- top 5 explicatii distincte (ex: pentru `463` ar arata "DIVIDENDE INTERIMARE")
- evolutia soldului lunar (sa vezi daca e cont de tranzit sau permanent)

### Conturi noi pe care sa le adaugam in catalog

Daca ai o lista de conturi pe care le folosesti des si care lipsesc din OMFP 1802 standard (sau sunt sub-conturi specifice unei industrii), trimite-ne-o. Le adaugam in batch in catalogul platformei, cu denumirile oficiale.

---

## Multumim

Pentru fiecare punct de mai sus, raspunsul tau (chiar si "nu stiu" sau "nu am intalnit") ne ajuta sa decidem ce facem mai departe. Toate raspunsurile se salveaza direct sub fiecare intrebare — nu trebuie sa scrii email separat.
