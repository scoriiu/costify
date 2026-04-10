# Documentul justificativ

Documentul justificativ este **punctul de plecare** al oricarei inregistrari contabile. Fara document, nu exista inregistrare. Fara inregistrare, nu exista raport. Fara raport, nu ai control financiar.

## Ce este un document justificativ

**Definitie legala** (Legea contabilitatii 82/1991): orice act scris (hartie sau electronic) care dovedeste ca s-a intamplat o operatiune economica. Sau, mai simplu: **o hartie care zice "s-a intamplat X"**.

Cerintele legale pentru ca un document sa fie valid:

1. **Sa existe** — sa fie pe hartie, PDF, email, SMS etc.
2. **Sa fie identificabil** — numar, data, emitent, destinatar
3. **Sa descrie clar operatiunea** — ce s-a intamplat (produs/serviciu, cantitate, pret)
4. **Sa fie semnat sau aprobat** (daca legea o cere) — stampila, semnatura, cod QR, cod de validare electronica
5. **Sa fie pastrat 10 ani** — in original sau copie certificata

## Exemple concrete de documente justificative

Tipurile uzuale pe care le vei intalni:

### Facturi

Cel mai frecvent document. Dovedeste o vanzare sau cumparare de bunuri/servicii.

- **Factura emisa** (de catre firma ta) — catre un client. Creeaza o creanta (clientul iti datoreaza bani) sau incasare daca e platita pe loc.
- **Factura primita** (de la un furnizor) — Creeaza o datorie (tu datorezi bani) sau plata daca e platita pe loc.

Orice factura trebuie sa contina: **serie + numar**, **data**, **emitent** (cu CUI si adresa), **destinatar** (cu CUI si adresa), **descriere** (bunuri/servicii), **cantitate**, **pret unitar**, **valoare**, **TVA**, **total de plata**.

Din 2024, facturile B2B in Romania sunt **obligatoriu prin e-Factura** (RO e-Factura) — un sistem ANAF care valideaza si arhiveaza facturile electronic.

### Chitante

Dovada unei plati in numerar. Cand dai sau primesti bani cash, trebuie sa existe o chitanta.

- **Chitanta emisa** — de tine cand incasezi cash de la client
- **Chitanta primita** — de la furnizor cand platesti cash

Pentru sume mari (peste 5000 RON/zi intre firme, sau 10.000 RON zilnic pentru anumite categorii), plata cash e interzisa — trebuie facuta prin banca.

### Bonuri fiscale

Emise de casele de marcat (caseele fiscale electronice, CF). Sunt obligatorii pentru comert cu amanuntul (magazine, restaurante, servicii catre persoane fizice).

Un bon fiscal contine: **numarul bonului**, **data si ora**, **CUI-ul emitentului**, **descrierea produselor/serviciilor**, **TVA pe cote**, **total**. Bonurile sunt transmise in timp real la ANAF prin sistemul de monitorizare fiscala.

### Extrase de cont bancar

Documentul lunar de la banca cu toate miscarile contului. Dovedeste incasari si plati care au trecut prin banca.

Extrasul este baza pentru inregistrarea operatiunilor bancare in contabilitate. Contabilul il foloseste pentru:
- A inregistra incasarile de la clienti
- A inregistra platile catre furnizori
- A calcula comisioanele bancare (care sunt cheltuieli)
- A verifica ca soldul contabil = soldul real din banca

### Dispozitii de incasare / plata

Documente interne ale firmei pentru miscari in casa (numerar). Cine a luat bani din casa, cui i-a dat, cat si pentru ce motiv.

### Note de receptie (NIR)

Document care confirma primirea unei marfi. Daca un furnizor iti livreaza produse, trebuie sa faci NIR — confirmi ca ai primit ce e scris in factura, in cantitatea corecta si in starea corecta.

### State de plata

Document lunar cu salariile angajatilor. Cat i se cuvine fiecaruia, ce retineri i se fac (CAS, CASS, impozit), cat primeste net.

### Alte documente

- **Avize de insotire a marfii** — pentru transporturi
- **Foi de parcurs** — pentru transportatori
- **Procese verbale** — pentru receptii, casari, inventare
- **Contracte** — nu sunt documente justificative propriu-zise, dar sprijina alte documente (ex: un contract de chirie sustine facturile lunare)

## Ciclul de viata al unui document in contabilitate

```
1. Generare sau primire
   ├── Creat de firma (factura emisa, chitanta, bon fiscal)
   └── Primit de la terti (factura primita, extras, etc.)
         │
         ▼
2. Verificare
   ├── Validitate legala (date corecte, CUI, TVA, etc.)
   ├── Corectitudine numerica (sume, totale, TVA)
   └── Autenticitate (e de la cine zice ca e?)
         │
         ▼
3. Transmitere catre contabil
   ├── In original (hartie sau scanat)
   └── Sau via sistem electronic (e-Factura, email)
         │
         ▼
4. Inregistrare in Saga C (sau alt soft)
   └── Se creeaza o NOTA CONTABILA din document
         │
         ▼
5. Arhivare
   ├── Hartie: in dosar, pastrat 10 ani
   └── Electronic: in arhiva digitala
```

## De ce este critic

### Pentru ANAF

Fiecare cheltuiala pe care o deduci fiscal, fiecare TVA pe care il recuperezi, trebuie sa aiba un document justificativ la baza. La un control fiscal, inspectorul iti cere documentele — daca nu le ai, **cheltuiala e nedeductibila** si **TVA-ul e nedeductibil**.

### Pentru tine

Fara documente, nu poti verifica nimic. Cand vei vedea in Costify un rand de "Cheltuieli cu serviciile — 25.000 RON" si te intrebi "de ce atat?", ar trebui sa poti urmari pana la documentele sursa. Daca contabilul le-a pierdut sau le-a inregistrat gresit, n-ai de unde sti.

### Pentru auditari

La un audit financiar (obligatoriu pentru firmele mari sau cele cotate), auditorul verifica aleator inregistrari din jurnal si cere documentele. Daca lipsesc, auditul este negativ, iar asta afecteaza grav reputatia firmei.

## Cum functioneaza asta in Costify

Costify **nu stocheaza documentele justificative** — ele raman la tine sau in Saga C. Costify lucreaza cu **jurnalul contabil** exportat din Saga, care contine deja inregistrarile create din documente.

Dar pentru trasabilitate, jurnalul contine coloane care leaga fiecare inregistrare de documentul sursa:

- `NDP` — numarul de document primar (numarul facturii, chitantei, etc.)
- `felD` — tipul de document (F = factura, C = chitanta, B = bon fiscal, E = extras, etc.)
- `categorie` / `cod` — coduri auxiliare pentru clasificare (opționale, depind de Saga)

Cand vezi o intrare in tab-ul "Registru Jurnal" din Costify, ai de obicei suficiente informatii pentru a gasi documentul sursa daca ai nevoie.

## Urmatori pasi

- [Nota contabila](./nota-contabila.md) — cum se traduce un document in limbaj contabil
- [Registrul jurnal](./registrul-jurnal.md) — unde se inregistreaza notele contabile
