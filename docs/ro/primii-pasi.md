# Primii pasi

Acest ghid te duce de la primul login pana la primul raport complet, in aproximativ 5 minute.

## 1. Autentificare

Costify este momentan **in beta privat**. Conturile se creeaza manual de catre echipa. Daca ai primit credentialele, mergi la [costify.ro](https://costify.ro) si apasa **"Intra in platforma"**.

Introdu email-ul si parola primite. Dupa autentificare, vei fi redirectat la pagina **Clients**.

## 2. Creeaza primul client

Pagina Clients afiseaza toate firmele pe care le gestionezi. Initial e goala. Apasa **"Creeaza client"** in dreapta sus.

Completeaza:

- **Nume firma** — asa cum vrei sa apara in platforma (ex: `Digital Nomads SRL`)
- **CUI** — codul unic de inregistrare (optional momentan, dar util pentru raportari viitoare)
- **CAEN** — codul de activitate (optional)

Apasa **"Creeaza"**. Vei fi redirectat la pagina clientului, care va avea trei tab-uri goale: **Registru Jurnal**, **Balanta de Verificare**, **Cont Profit si Pierdere**.

## 3. Exporta jurnalul din Saga C

Deschide Saga C si selecteaza firma corespunzatoare. Apoi:

1. Mergi la **Rapoarte → Registru Jurnal**
2. Selecteaza perioada dorita (de obicei un an intreg sau mai multi)
3. Apasa **"Export → Excel (XLSX)"**
4. Salveaza fisierul intr-un loc usor accesibil

Fisierul rezultat este de obicei `jurnal_anul_XX.xlsx` sau similar. Poate avea intre cateva sute si cateva zeci de mii de randuri, in functie de volumul de operatiuni.

**Note importante**:

- Exporta **intregul jurnal**, nu doar o luna. Costify va folosi toate datele pentru calculul soldurilor initiale corecte.
- Asigura-te ca exportul contine **coloanele de denumiri** (`denumire_d`, `denumire_c`) daca vrei ca conturile analitice sa apara cu numele corect.
- Daca ai **mai multe conturi bancare** sau puncte de lucru, exporta totul intr-un singur fisier — Costify grupeaza corect pe conturi analitice.

## 4. Incarca jurnalul in Costify

Inapoi in Costify, pe pagina clientului, apasa butonul **"Upload Jurnal"** (dreapta sus, langa numele firmei).

Se va deschide un modal cu o zona de drag & drop. Trage fisierul XLSX sau apasa pentru a-l selecta.

Costify va:

1. **Parsa fisierul** in cateva secunde (1-10 secunde pentru majoritatea fisierelor)
2. **Afisa o previzualizare** cu:
   - Numarul total de intrari gasite
   - Numarul de intrari **noi** (care nu exista deja)
   - Numarul de intrari **duplicate** (deja in sistem, vor fi ignorate)
   - Intervalul de date al noilor intrari

Verifica ca numerele sunt ceea ce te astepti. Daca e primul import, numarul de "intrari noi" trebuie sa fie egal cu totalul. Daca reimporti, ar trebui sa vezi un numar mic de noutati (intrarile adaugate dupa exportul anterior).

Apasa **"Confirma import"**.

## 5. Vezi rezultatele

Dupa cateva secunde, modalul se inchide si pagina se reincarca. Acum:

### Tab "Registru Jurnal"

Vei vedea toate intrarile din jurnal intr-un tabel virtualizat care suporta scrolluri rapide prin zeci de mii de randuri. Poti:

- **Cauta** dupa cont, explicatie sau numar document (bara de cautare sus)
- **Sorta** apasand pe orice coloana
- **Redimensiona** coloanele cu mouse-ul

### Tab "Balanta de Verificare"

Aici e magia. Selecteaza in dreapta sus anul si luna dorita (ex: Decembrie 2025). Costify va calcula in timp real:

- **Solduri initiale** (rulaj precedent cumulat)
- **Rulaje ale lunii** (debit si credit ale lunii selectate)
- **Solduri finale** (debit sau credit, dupa tipul contului)
- **KPI-urile** (cele 8 indicatori in partea de sus)

Daca vezi un triunghi galben pe unele randuri, acela e **cont nemapat** — un cont pe care platforma nu il recunoaste. Nu afecteaza calculul, dar va fi mapat ulterior. Vezi [Maparea conturilor](./maparea-conturilor.md) pentru detalii.

### Tab "Cont Profit si Pierdere"

Afiseaza structura CPP conform OMFP 1802:

- Venituri din exploatare (clasa 7xx)
- Cheltuieli din exploatare (clasa 6xx)
- Rezultat din exploatare
- Venituri financiare
- Cheltuieli financiare
- Rezultat financiar
- Rezultat brut
- Impozit pe profit
- Rezultat net

Fiecare linie este calculata din conturile corespunzatoare din balanta.

## 6. Intreaba-l pe Costi

In dreapta jos, pe orice pagina, apare o bula cu mascota Costi. Apasa pe ea pentru a deschide chat-ul cu asistentul AI.

Costi **cunoaste datele firmei tale** si poate raspunde la intrebari precum:

- "Care sunt cei mai mari 5 clienti ai firmei X in decembrie?"
- "Cate facturi neincasate are Digital Nomads la sfarsitul lunii?"
- "Cum compar profitul din Q3 cu Q2?"
- "Ce reprezinta contul 4315 si de ce apare in balanta?"
- "Cum se calculeaza TVA de plata conform legii?"

Costi cunoaste atat legislatia romaneasca (OMFP 1802, Codul fiscal, procedura Saga) cat si datele tale specifice. Foloseste-l ca pe un contabil expert disponibil 24/7.

## Pasii urmatori

Acum stii tot ce trebuie ca sa folosesti platforma pentru un client.

Daca ai **mai multi clienti**, repeta pasii 2-5 pentru fiecare. Costify e construit pentru contabili care gestioneaza sute de firme — nu exista limita la numarul de clienti pe care ii poti adauga.

Daca vrei sa intelegi mai profund **cum functioneaza** platforma pe dinauntru, citeste [Arhitectura platformei](./arhitectura-platformei.md).

Daca vrei sa intelegi mai bine **conceptele contabile** folosite (balanta, CPP, KPI-uri), incepe cu [Bazele contabilitatii](./de-ce-exista-contabilitatea.md).

Pentru ghiduri detaliate pe fiecare operatiune, vezi sectiunea [Ghiduri](./importa-jurnal.md).
