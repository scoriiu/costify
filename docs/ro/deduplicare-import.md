# Deduplicarea la reimport

Unul dintre cele mai importante mecanisme din Costify este **deduplicarea automata** la import. Ea iti permite sa reimportezi acelasi fisier de zeci de ori, in orice combinatie, fara sa dublezi niciodata intrarile in jurnal.

## De ce este importanta

Scenarii comune in care reimportezi:

- **Flux saptamanal sau zilnic**: exporti din Saga la intervale scurte pentru a avea date "la zi" in Costify
- **Corectii in Saga**: contabilul a ajustat cateva intrari in Saga si vrei sa vezi impactul in Costify
- **Intrari noi adaugate**: contabilul a adaugat 20 de facturi noi si vrei sa le vezi imediat
- **Recuperare**: ai pierdut o parte din jurnal dintr-un motiv oarecare si vrei sa-l reincarci

Fara deduplicare, ai avea dubluri, tripluri, etc. — balanta ar fi **total gresita**. Cu deduplicare, poti fi linistit ca acelasi fisier incarcat de 5 ori = efect identic cu incarcat o singura data.

## Cum functioneaza

### Hash-ul de deduplicare

Fiecare intrare din jurnal primeste un **hash unic** calculat din 5 campuri:

```
dedupHash = MD5(data + contD + contC + suma + explicatie)
```

De exemplu, o intrare:

```
data:       2025-12-15
contD:      5121.BT
contC:      4111.CLIENT_ORANGE
suma:       1250.00
explicatie: Incasare factura 12345
```

genereaza un hash unic (un string de 32 caractere). Alta intrare, chiar si foarte similara (de exemplu aceeasi suma dar alt client), va avea **alt hash**.

### De ce MD5 si nu SHA-256

MD5 este mai rapid si nu avem nevoie de securitate criptografica pentru deduplicare — avem nevoie doar de un "fingerprint" unic pentru fiecare combinatie de date. Pentru audit trail (unde conteaza securitatea) folosim SHA-256.

### Procesul de dedup la import

1. Utilizatorul uploadeaza fisier XLSX
2. Costify parseaza fisierul si extrage toate intrarile (ex: 1000 intrari)
3. Pentru fiecare intrare, calculeaza hash-ul de dedup
4. Costify interogheaza baza de date: "Care sunt toate hash-urile existente pentru acest client?" (rapid — hash-urile sunt indexate)
5. Filtreaza intrarile din fisier: daca hash-ul exista deja in DB, intrarea e **skip** (duplicat); daca nu exista, e **keep** (noua)
6. Afiseaza previzualizare cu numarul de intrari noi vs existente
7. Utilizatorul confirma — se insereaza doar cele noi

Rezultatul: **fiecare combinatie unica (data + contD + contC + suma + explicatie) exista o singura data in DB**.

## De ce exact aceste 5 campuri

Alegerea celor 5 campuri nu e intamplatoare. Hai sa vedem alternative si de ce nu le-am ales:

### De ce NU folosim `ndp` (numar document primar)

Logic ar fi: "numarul facturii este unic, nu?" Raspuns: **nu!** In practica:

- Acelasi numar se poate repeta la firme diferite
- Bonurile fiscale au numere care se reseteaza zilnic
- Unele softuri nu completeaza `ndp` pentru anumite tipuri de operatii
- Contabilul poate schimba manual numerele

Folosind `ndp` ca cheie unica ar duce la duplicate false (doua intrari diferite cu acelasi `ndp` din zile diferite) sau la pierderi (aceeasi operatie cu `ndp` gol ar fi considerata dublata cu altele fara `ndp`).

### De ce NU folosim ID-ul intern Saga

Saga nu exporta un ID unic persistent in XLSX. Chiar daca ar face-o, acelasi ID ar putea aparea in fisiere diferite daca Saga reimporta sau recalculeaza. Nu e de incredere.

### De ce DA `data` + `contD` + `contC` + `suma` + `explicatie`

Aceasta combinatie este **practic garantata unica** in contabilitatea reala. Probabilitatea ca doua operatii diferite sa aiba:
- Aceeasi data exacta
- Acelasi cont debitor (pana la nivel analitic)
- Acelasi cont creditor (pana la nivel analitic)
- Aceeasi suma (pana la banut)
- Aceeasi explicatie text

... este extrem de mica. In practica, coliziunile sunt inexistente.

### Excepti rare (edge cases)

Pot exista situatii teoretice:

- **Doua bonuri fiscale identice** in aceeasi zi, pentru acelasi client, cu aceeasi suma si descriere generica ("Vanzare marfa"). In acest caz, Costify le vede ca una singura.
- **Regularizari** care au exact aceleasi campuri ca o operatie inversa.

Solutia: daca stii ca ai duplicate legitime (intrari care **trebuie** sa apara de doua ori), asigura-te ca au **descrieri diferite** ("Bon casa 1", "Bon casa 2") pentru ca hash-ul sa fie diferit. In Saga, poti face asta manual.

## Ce NU detecteaza dedup-ul

### Modificari ale intrarilor existente

Daca ai o intrare in Costify si in Saga o modifici (de exemplu, schimbi suma de la 1000 la 1100 RON), la reimport **Costify o vede ca intrare noua**, nu ca actualizare. Motivul: hash-ul s-a schimbat (suma e alta).

Rezultatul: **ai ambele versiuni in jurnal**. Cea veche (1000 RON) si cea noua (1100 RON). Asta duce la calcul gresit al balantei.

**Solutia**: daca modifici intrari in Saga, trebuie sa stergi intrarile corespondente din Costify **inainte** de reimport. Vezi [Corecteaza date istorice](./corecteaza-date-istorice.md) pentru procedura.

### Stergerile din Saga

Daca stergi o intrare din Saga si reimporti, Costify **nu stie** ca a fost stersa — continua sa o aiba. Din nou, solutia e soft-delete manual in Costify.

### Conturi care schimba denumirea

Daca analiticul `401.00023` avea numele "Orange Romania" si il schimbi in "Orange" in Saga, la reimport Costify updateaza numele in `JournalPartner` — dar intrarile vechi din jurnal **raman cu numele vechi**. Doar afisarea (la rezolvare de nume) va folosi noul nume, prin regula "cel mai recent castiga".

## Ce NU poate face dedup-ul (deocamdata)

- **Nu detecteaza duplicate logice** — daca in Saga inregistrezi aceeasi plata de doua ori (o eroare a contabilului), Costify o va importa de doua ori daca au descrieri diferite.
- **Nu detecteaza inversari** — daca ai o intrare si inversa ei (anulare), le vede ca doua intrari separate (corect — sunt doua operatii).
- **Nu detecteaza transferuri intre conturi** — daca muti bani din 5121 in 5124, este o operatie legitima, nu un duplicat.

## Interactiunea cu soft-delete

Cand stergi manual intrari din Costify (flux "Corecteaza date istorice"), ele sunt **soft-deleted** — marcajul `deletedAt` este setat, dar hash-ul ramane in DB.

**Consecinta**: daca reimporti un fisier care contine intrari pe care le-ai sters, **ele NU vor fi re-adaugate** — hash-ul lor mai exista in sistem.

Daca vrei sa "reincarci" intrari sterse, vezi scenariile complexe din [Corecteaza date istorice](./corecteaza-date-istorice.md).

## Verificare dedup-ului la debug

Pentru support sau debug, poti verifica dedup-ul unei intrari:

1. Deschide tab-ul Registru Jurnal
2. Cauta intrarea suspecta
3. Verifica datele: data, conturi, suma, explicatie
4. Calculeaza hash-ul mental (MD5 al celor 5 campuri concatenate cu `|`)
5. Verifica in DB daca hash-ul exista

In practica, nu ai nevoie sa faci asta — Costi AI poate raspunde la intrebari despre intrari specifice.

## Urmatori pasi

- [Corecteaza date istorice](./corecteaza-date-istorice.md) — cum sterg si reimport cand ceva s-a stricat
- [Principiul jurnal-centric](./principiul-jurnal-centric.md) — arhitectura completa a stocarii jurnalului
