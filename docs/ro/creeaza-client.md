# Creeaza un client nou

Fiecare firma pe care o gestionezi in Costify este un **client**. Acest articol explica cum creezi un client nou, ce informatii sunt necesare si ce se intampla in spate.

## Cand ai nevoie

Creezi un client nou cand:

- **Incepi sa folosesti Costify** si adaugi prima firma din portofoliu
- **Primesti un client nou** la cabinetul tau de contabilitate
- **Iti deschizi o firma noua** pe care vrei sa o monitorizezi

Nu ai nevoie sa creezi un client pentru fiecare luna sau perioada — un client reprezinta **o firma**, iar datele lunare/anuale ale firmei se acumuleaza in timp in acelasi client.

## Pasii

### 1. Deschide pagina Clienti

Din meniul principal sus, apasa **Clients**. Vei vedea lista tuturor firmelor pe care le gestionezi (initial, lista este goala).

### 2. Apasa "Creeaza client"

Butonul este in coltul dreapta sus al listei. Se va deschide un modal cu un formular.

### 3. Completeaza formularul

- **Nume firma** (obligatoriu) — asa cum vrei sa apara in platforma. Exemple: `Digital Nomads SRL`, `4Walls Kronis`, `QHM21 Network`. Poate contine spatii, litere mari, cifre, caractere speciale.
- **CUI** (optional) — codul unic de inregistrare al firmei (ex: `RO12345678`). Util pentru rapoarte viitoare si pentru identificare rapida in lista.
- **CAEN** (optional) — codul de activitate (ex: `6201` pentru IT, `4711` pentru comert). Folosit pentru filtrare si pentru intrebari specifice in Costi AI.

### 4. Apasa "Creeaza"

Clientul va fi creat instant. Vei fi redirectat automat la pagina sa, cu trei tab-uri goale:

- **Registru Jurnal** — aici vor aparea intrarile dupa primul import
- **Balanta de Verificare** — calculata automat dupa primul import
- **Cont Profit si Pierdere** — calculat automat dupa primul import

## Ce se intampla in spate

Cand apesi "Creeaza", Costify:

1. **Valideaza** numele (nu poate fi gol, maxim 100 caractere)
2. **Genereaza un slug** pentru URL — `Digital Nomads SRL` devine `digital-nomads-srl`. Slug-ul este folosit in link-uri si trebuie sa fie unic pe contul tau.
3. **Creeaza un record** in baza de date cu `userId` = tu, `name`, `cui`, `caen`, `active = true`
4. **Creeaza un audit event** cu `action: create`, `entityType: client` pentru trasabilitate
5. **Iti returneaza** pagina noului client

Din acest moment, clientul este **izolat** — nimeni altcineva (niciun alt user pe platforma) nu-l poate vedea. Numai tu.

## Cum sunt organizati clientii

Costify este construit pentru contabili care gestioneaza **sute de firme**. Fiecare user are propriul portofoliu de clienti, complet izolat de alti useri. Nu exista functie de "share" intre useri (inca — vezi [Intrebari contabil](./intrebari-contabil-plan-conturi.md) pentru discutia despre acest subiect).

Pentru fiecare client ai:

- **Un jurnal contabil** care creste in timp prin importuri succesive
- **Un istoric de importuri** (ImportEvent) pentru trasabilitate
- **Rapoarte calculate live** din jurnal (balanta, CPP, KPI-uri)
- **Un audit trail** complet cu toate operatiile efectuate

## Cum dezactivezi un client

Momentan (aprilie 2026) **nu exista functie de stergere/dezactivare** client din UI. Daca ai nevoie sa arhivezi un client care a devenit inactiv:

1. Contactaza echipa Costify — vom sterge clientul si datele asociate la cerere
2. Sau pur si simplu ignora-l in lista (nu deranjeaza nimic daca ramane)

Functia de "arhivare" client (care pastreaza datele dar il ascunde din lista principala) este planificata.

## Limitari actuale

- **Numarul de clienti** — fara limita, dar UI-ul nu este optimizat pentru mai mult de ~500 clienti in lista. Peste aceasta valoare, vom adauga filtrare si pagination.
- **Fara import bulk** — creezi clientii unul cate unul momentan. Import CSV cu lista de clienti este planificat.
- **Fara template de cont** — nu poti avea un "sablon" de client cu setari predefinite. Fiecare client incepe de la zero.
- **Fara status** — clientii nu au "status" (activ/inactiv/arhivat/suspendat). Toti clientii creati sunt activi.

## Urmatori pasi

Odata ce ai creat clientul, urmatorul pas este sa importi jurnalul din Saga C:

- [Importa jurnalul din Saga C](./importa-jurnal.md) — cum se incarca un XLSX si ce se intampla la import
