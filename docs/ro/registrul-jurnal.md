# Registrul jurnal

Registrul jurnal este **inima oricarui sistem contabil**. Este lista cronologica a tuturor operatiunilor economice ale firmei, in ordinea in care s-au intamplat. Toate celelalte rapoarte (balanta, CPP, bilant) sunt **derivate din jurnal**.

Acest articol explica ce este jurnalul, ce contine, si de ce Costify il considera **sursa unica de adevar**.

## Definitie

> Registrul jurnal este documentul contabil obligatoriu in care se inregistreaza, in ordine cronologica, toate operatiunile economico-financiare ale firmei.

Cuvintele cheie:
- **Cronologic** — operatiunile sunt notate in ordinea in care s-au petrecut, nu in ordinea introducerii in software.
- **Toate** — fara exceptii. Daca o operatiune nu e in jurnal, ea **nu exista** din punct de vedere contabil.
- **Obligatoriu** — Codul Fiscal si OMFP 1802 obliga toate firmele sa-l tina.

## Continutul unei intrari

Fiecare rand din jurnal reprezinta o **nota contabila** si contine:

| Camp | Exemplu | Obligatoriu? |
|---|---|---|
| Data | 15.12.2025 | Da |
| Numar document (NDP) | F-2025-1247 | Da |
| Cont debit | 5121 | Da |
| Cont credit | 4111 | Da |
| Suma | 1.190 RON | Da |
| Explicatie | "Incasare Beta SRL" | Da |
| Felul documentului | F (factura) | Recomandat |
| TVA | 19% | Daca este aplicabil |

In Saga C, jurnalul are exact aceasta structura, plus cateva campuri tehnice (tip operatiune, categorie, validat, etc.). Costify pastreaza toate campurile la import.

## Exemplu de jurnal pentru o luna

Iata cum arata jurnalul unei firme mici pentru o saptamana:

```
Data        NDP         Cont D    Cont C    Suma         Explicatie
01.12.2025  IN-001      5121      117       50.000,00    Aport asociat
03.12.2025  F-001       628       401       1.500,00     Factura servicii contabile
03.12.2025  F-001       4426      401       285,00       TVA aferenta serviciilor
05.12.2025  CHIT-001    5311      4111      450,00       Incasare numerar Alpha SRL
05.12.2025  CHIT-001    4111      707       450,00       Vanzare marfa Alpha SRL (cost 280)
05.12.2025  CHIT-001    607       371       280,00       Cost marfa vanduta
07.12.2025  F-002       614       401       2.000,00     Factura abonament Microsoft
07.12.2025  F-002       4426      401       380,00       TVA aferent abonament
10.12.2025  EX-001      401       5121      1.785,00     Plata factura contabilitate
12.12.2025  CHIT-002    5311      4111      890,00       Incasare numerar Beta SRL
12.12.2025  CHIT-002    4111      707       890,00       Vanzare marfa Beta SRL
```

11 randuri pentru 7 operatiuni distincte. Unele operatiuni (vanzarile cu TVA, sau cumpararea marfii vandute) genereaza 2-3 note, dar fiecare nota e independenta — are propriul rand, propria pereche D/C, propria suma.

## Cronologic — de ce conteaza ordinea

Jurnalul **trebuie** sa fie in ordine cronologica. Daca introduci o operatiune din 5 decembrie in jurnal **dupa** o operatiune din 10 decembrie, contabilitatea ramane corecta numeric — dar **rapoartele de control** (gen jurnalul fizic tiparit, depus la control) vor arata ca ai facut "salturi inapoi" in timp, ceea ce este suspect pentru un inspector.

In Saga C si in Costify, intrarile sunt **sortate dupa data** la afisare, indiferent de ordinea introducerii. Asta inseamna ca poti introduce o factura din 5 decembrie pe 12 decembrie — software-ul o pune corect in ordine cronologica.

## Numarul document (NDP)

Numarul document (NDP — "numar de pagina" din jargonul vechi sau "numar document principal") este identificatorul unic al unui document justificativ in jurnal. De obicei:

- **Pentru facturi**: numarul facturii (ex: `F-2025-001`)
- **Pentru chitante**: numarul chitantei (ex: `CHIT-001`)
- **Pentru extrase bancare**: numarul extrasului (ex: `EX-001`)
- **Pentru note proprii**: o numerotare interna (ex: `NC-001`)

Doua sau mai multe randuri din jurnal pot avea **acelasi NDP** daca provin din acelasi document. De exemplu, o factura cu TVA va genera doua note (una pentru valoarea fara TVA, alta pentru TVA), dar ambele cu acelasi NDP.

Asta permite **cautari rapide**: daca cineva intreaba "ce contine factura F-2025-001?", deschizi jurnalul, filtrezi pe NDP `F-2025-001`, si vezi toate notele asociate.

## Explicatia — cel mai subevaluat camp

Multi contabili scriu explicatii prea generice: "Factura", "Plata", "Incasare". Asta este **o greseala** care iti va costa timp si nervi peste 6 luni cand vei vrea sa intelegi ce s-a intamplat.

**Reguli pentru explicatii bune**:

1. **Include partenerul**: "Plata factura Orange" e mult mai bun decat "Plata factura".
2. **Include tipul de cheltuiala/venit**: "Cumparare laptopuri pentru echipa" e mult mai bun decat "Cumparare marfa".
3. **Fii concis**: 5-10 cuvinte sunt suficiente. Nu e roman, e contabilitate.
4. **Foloseste termeni cautabili**: daca vei avea peste 1.000 intrari, vei cauta dupa cuvinte cheie. "ORANGE" este cautabil, "Plata" nu.

In Costify, cautarea in jurnal este case-insensitive si suporta sub-string match. Asa ca explicatii bune fac diferenta intre 5 secunde si 5 minute la cautare.

## Volume tipice

Cate intrari are un jurnal? Depinde de marimea firmei si de natura operatiunilor:

| Tipul firmei | Intrari/luna | Intrari/an |
|---|---|---|
| **Micro - solopreneur freelance** | 10-30 | 100-300 |
| **Mica - SRL cu 2-3 angajati** | 50-150 | 600-1.800 |
| **Mica/mijlocie - SRL cu 5-15 angajati** | 200-500 | 2.500-6.000 |
| **Mijlocie - SRL cu 20-50 angajati** | 500-2.000 | 6.000-25.000 |
| **Mare - companii cu 100+ angajati** | 2.000-10.000 | 25.000-120.000 |

Costify este testat cu jurnale de pana la **45.000 intrari** (clienti de marime mijlocie). Pentru jurnale mai mari, performanta ramane buna pentru ca:
- Algoritmii sunt O(n) — liniari in numar de intrari.
- Tabelul este virtualizat (afisam doar randurile vizibile).
- Calculele de balanta si CPP folosesc indexuri DB.

## De ce e jurnalul "sursa de adevar"

Asta este o decizie arhitecturala importanta pentru Costify. Multe sisteme contabile stocheaza **rapoarte pre-calculate** (balante zilnice, CPP-uri lunare) pentru viteza. Costify nu — calculam totul **la cerere** din jurnal.

Avantaje:
1. **Consistenta** — nu putem avea o balanta diferita de jurnal. Daca nu se egala, e o problema in jurnal, nu in calcul.
2. **Corectie usoara** — daca apare o eroare in jurnal (intrare gresita, lipsa), corectezi jurnalul si toate rapoartele se actualizeaza automat.
3. **Audit** — orice cifra dintr-un raport poate fi urmarita pana la intrarile concrete din jurnal.
4. **Modificari OMFP** — daca se schimba modul de calcul al CPP-ului, schimbam doar functia de calcul, nu re-procesam tot.

Dezavantaje:
1. **Performanta** — pentru jurnale uriase, fiecare cerere face calcule. Asta poate fi optimizat prin **cache** in viitor (calculele anilor incheiati nu se schimba niciodata).
2. **Complexitate** — codul de calcul e mai complex decat "citeste din tabel".

Pentru detalii despre arhitectura, vezi [Principiul jurnal-centric](./principiul-jurnal-centric.md).

## Cum este afisat jurnalul in Costify

Tabul **Registru Jurnal** in Costify afiseaza intrarile cu:

- **Scroll virtualizat** — chiar si pentru 50.000 randuri, scroll-ul e instant. Browser-ul afiseaza doar randurile vizibile.
- **Coloane configurabile** — poti redimensiona coloanele prin drag.
- **Filtre** — pe cont, NDP, explicatie, perioada.
- **Cautare globala** — sub-string match in toate campurile text.
- **Format romanesc al datei** — DD.MM.YYYY.

Pentru editare, abordarea recomandata este: **NU edita direct in Costify**. Editeaza in Saga C, exporta din nou, [importa cu deduplicare](./importa-jurnal.md).

## Modificari si stergeri

Conform legii contabilitatii, **jurnalul nu se sterge si nu se modifica**. O data ce o intrare a fost facuta, ramane in jurnal pentru totdeauna. Daca ai gresit, faci o **nota de stornare** (corectie) — adaugi inca o intrare care anuleaza prima.

In Costify, abordam asta cu un pas intermediar: **soft-delete + reimport**. Daca trebuie sa corectezi date istorice:

1. Sterezi intrarile gresite (sunt soft-deleted, nu sterse fizic; raman in audit).
2. Reimporti jurnalul corectat din Saga C.
3. Costify combina noile intrari cu cele ramase si recalculeaza totul.

In audit ramane snapshot-ul intrarilor sterse — nimic nu se pierde definitiv. Vezi [Corecteaza date istorice](./corecteaza-date-istorice.md) pentru detalii.

## Tiparirea jurnalului

Conform legii, jurnalul trebuie **tiparit** lunar sau anual si pastrat pentru control. Chiar daca tot lucrezi digital, hartia ramane obligatorie pentru anumite firme.

Costify nu are inca functie de tiparire (in plan). In schimb, poti:
1. Sa exporti jurnalul ca XLSX (in plan).
2. Sa folosesti tipparirea direct din Saga C, care produce formatul oficial.

## Urmatori pasi

- [Nota contabila](./nota-contabila.md) — anatomia unei intrari din jurnal
- [Documentul justificativ](./document-justificativ.md) — sursa fiecarei intrari
- [Importa jurnalul din Saga C](./importa-jurnal.md) — fluxul tehnic
- [Principiul jurnal-centric](./principiul-jurnal-centric.md) — de ce e sursa de adevar
