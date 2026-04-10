# Importa jurnalul din Saga C

Importul jurnalului contabil din Saga C este **operatiunea centrala** in Costify. Fara jurnal, nu exista balanta, CPP sau KPI-uri. Acest articol explica pas cu pas cum sa faci importul corect si ce se intampla in spate.

## Pregatire

Inainte sa incepi importul, asigura-te ca ai:

1. **Un client creat** in Costify. Daca nu, vezi [Creeaza un client nou](./creeaza-client.md).
2. **Acces la Saga C** pentru firma respectiva
3. **Jurnalul exportat** ca fisier XLSX

## Exportul din Saga C

In Saga, exportul jurnalului se face astfel:

1. Deschide firma in Saga C
2. Mergi la **Rapoarte → Registru Jurnal** (sau Registre → Jurnal)
3. Selecteaza **intervalul de date** dorit
4. Apasa **Export → Excel (XLSX)**
5. Salveaza fisierul local

### Ce perioada sa exporti

Regula generala: **exporta cat mai mult istoric posibil**. Costify calculeaza soldurile initiale bazandu-se pe **tot ce exista in jurnal**, deci cu cat ai mai multe date, cu atat rapoartele sunt mai precise.

Recomandari:
- **Pentru primul import**: tot istoricul firmei (sau minim ultimii 2-3 ani)
- **Pentru actualizari lunare**: toata luna curenta + luna precedenta (pentru siguranta)
- **Pentru corectii**: re-exporta din momentul in care incep corectiile pana la zi

### Cerinte pentru fisier

Fisierul trebuie sa respecte formatul standard Saga C:

- **Format**: `.xlsx` (Excel modern, nu `.xls` vechi)
- **Dimensiune**: maxim ~50 MB (limita de upload)
- **Coloane**: Saga le genereaza automat — nu le redenumi manual
- **Header**: pe primul rand (nu sterge randul de titluri)

Coloanele tipice:
- `Data` — data operatiei
- `Nr doc` — numar document primar
- `Cont D` — cont debitor
- `Denumire D` — numele contului debitor (inclusiv analitic)
- `Cont C` — cont creditor
- `Denumire C` — numele contului creditor
- `Suma` — valoarea
- `Explicatie` — descrierea operatiei
- `Fel D` — tipul documentului (F, C, B, E, etc.)

Daca fisierul are coloane in plus (categorie, cod, TVA, validat), Costify le suporta — le va extrage si stoca.

## Importul in Costify

### 1. Deschide pagina clientului

Apasa **Clients** in meniul principal si selecteaza firma pentru care vrei sa importi.

### 2. Apasa "Upload Jurnal"

Butonul este in coltul dreapta sus, langa numele firmei. Se deschide un modal cu zona de drag & drop.

### 3. Trage sau selecteaza fisierul

Trage fisierul XLSX direct peste modal, sau apasa zona pentru a-l selecta din file picker. Costify incepe imediat parsarea — de obicei in 1-10 secunde pentru fisiere sub 10.000 randuri.

### 4. Verifica previzualizarea

Dupa parsare, Costify iti arata:

- **Fisier**: numele fisierului incarcat
- **Total intrari**: cate randuri sunt in XLSX (toate, inclusiv cele pe care deja le ai)
- **Intrari noi**: cate sunt *noi* pentru acest client (cele care vor fi adaugate)
- **Intrari existente**: cate sunt deja in sistem (vor fi ignorate)
- **Interval date**: de la - pana la (pentru noile intrari)

**Cand toate sunt noi**: primul import, este normal sa vezi `Total = Noi`.

**Cand majoritatea sunt existente**: reimport — este normal ca majoritatea sa fie duplicate si doar noutatile sa fie adaugate.

**Cand nimic nu e nou**: importul nu va adauga nimic. Fie ai gresit fisierul, fie deja ai importat totul. Apasa "Anuleaza".

### 5. Confirma importul

Apasa **Confirma import**. Costify adauga intrarile noi in baza de date in ~1-5 secunde.

### 6. Vezi rezultatul

Modalul se inchide si pagina se reincarca. Acum:

- Tab-ul **Registru Jurnal** contine toate intrarile importate
- Tab-ul **Balanta** poate fi deschis pentru orice luna — calculul se face live
- Tab-ul **CPP** arata rezultatul pentru perioada selectata
- KPI-urile sunt actualizate automat

## Ce se intampla tehnic

Pentru cei curiosi, pasii interni:

1. **Upload fisier** → server primeste binarul XLSX
2. **Verificare auth** → ca ai acces la acest client
3. **Calcul file hash** (SHA-256) pentru audit
4. **Parsare** fisierul cu libraria `xlsx` → extragere randuri
5. **Normalizare** sume (format romanesc `1.234,56` → `1234.56`) si date
6. **Gestionare compound entries** (randuri cu `%`) — note contabile compuse
7. **Extragere denumiri de conturi** din coloanele `denumire_d`/`denumire_c`
8. **Calcul hash de dedup** pentru fiecare intrare: `MD5(data|contD|contC|suma|explicatie)`
9. **Comparare** cu intrarile existente — identificare cele noi
10. **Creare ImportEvent** in DB (pentru audit trail)
11. **Insert batch** (5000 intrari pe lot) in tabela `JournalLine`
12. **Actualizare `JournalPartner`** cu denumirile de parteneri extrase
13. **Creare audit event** cu snapshot-ul importului
14. **Return** rezultat la browser

Pentru detalii algoritmice, vezi [Principiul jurnal-centric](./principiul-jurnal-centric.md).

## Erori comune si solutii

### "Fisierul a fost citit dar nicio intrare valida nu a fost extrasa"

Cauza: fisierul nu respecta formatul Saga standard. Coloanele nu au fost recunoscute.

**Solutie**:
- Verifica daca e un export **Registru Jurnal** (nu alt raport)
- Asigura-te ca prima linie contine **header-ul** (nume coloane)
- Deschide fisierul in Excel si verifica sa nu fie gol sau corupt
- Exporta din nou din Saga

### "Intrari noi: 0" (desi ar trebui sa fie noi)

Cauza: toate intrarile din fisier exista deja in baza de date (dedup hash match).

**Solutie**:
- Verifica daca ai **re-exportat dupa adaugari** in Saga, nu versiunea veche
- Daca ai sters manual intrari din Costify, ele sunt `soft-deleted` — dar **hash-ul lor ramane**. Vezi [Corecteaza date istorice](./corecteaza-date-istorice.md) pentru scenarii complexe.

### Upload foarte lent sau timeout

Cauza: fisier foarte mare (> 30.000 randuri) sau conexiune slaba.

**Solutie**:
- Imparte exportul pe **ani fiscali** — exporta 2024 separat, 2025 separat
- Asigura-te ca ai conexiune stabila
- Pentru fisiere peste 50 MB, contacteaza echipa (momentan nu suportam)

### "Erori la parsare: X randuri ignorate"

Cauza: unele randuri au date invalide (data gresita, suma nenumeric, conturi goale).

**Solutie**:
- Deschide preview-ul si apasa "Vezi detalii" pentru lista erorilor
- De obicei sunt randuri de header repetate sau randuri totalizatoare
- Daca numarul e mic (sub 1%), ignora-le si importeaza ce s-a parsat corect
- Daca numarul e mare, repara fisierul in Excel inainte de reimport

## Importuri multiple (reimport)

Costify suporta **reimporturi nelimitate** — poti incarca acelasi fisier de zeci de ori fara sa dublezi date. Mecanismul de deduplicare (bazat pe hash) garanteaza ca o intrare exista o singura data.

Scenariul tipic de **flux continuu**:

```
Luna noua → Contabilul inregistreaza in Saga
         → La sfarsitul lunii exporta XLSX
         → Tu incarci in Costify (append automat)
         → Rapoarte actualizate imediat
```

Daca la mijlocul lunii vrei sa vezi situatia "la zi", exporta din Saga **pana la data curenta**, incarca — noile intrari se vor adauga.

## Limitari

- **Doar format Saga C** — alte softuri (Ciel, WinMentor, FreERP) nu sunt inca suportate. Arhitectura permite adaugarea, dar adapters nu sunt scrise.
- **Maxim ~50 MB per fisier** — limita Next.js API route
- **Fara upload paralel** — daca incarci 2 fisiere in acelasi timp, al doilea asteapta
- **Fara validari contabile** — daca XLSX contine intrari cu `contD = contC` sau sume negative, Costify le accepta fara sa-ti spuna. Responsabilitatea datelor corecte e a Saga-ului.

## Urmatori pasi

- [Deduplicarea la reimport](./deduplicare-import.md) — cum gestioneaza Costify importurile repetate
- [Corecteaza date istorice](./corecteaza-date-istorice.md) — cand trebuie sa stergi si sa reimporti
- [Citeste balanta de verificare](./citeste-balanta.md) — ce sa faci dupa primul import
