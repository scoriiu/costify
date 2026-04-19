# Tab-ul Setari

Fiecare client are un tab **Setari** (al cincilea, dupa Plan de Conturi). Aici tii configuratia care nu se schimba la fiecare deschidere a aplicatiei: datele de identificare ale firmei, regimul fiscal de-a lungul timpului, si operatiile destructive (zona periculoasa).

Filozofia: ce e configurat o data si ramane stabil sta in Setari. Ce se schimba la fiecare raport (perioada, mod de afisare) sta pe pagina raportului. Asta inseamna ca nu mai ai dropdown-uri de regim fiscal pe tab-ul CPP — acolo regimul e doar afisat ca eticheta read-only, cu un link care te aduce inapoi aici.

## Structura tab-ului

Trei sectiuni separate vizual, fiecare cu rolul ei:

| Sectiune | Ce contine | Actiune principala |
|----------|------------|-------------------|
| **Informatii generale** | Denumire, CUI, CAEN, data adaugarii | Modifica |
| **Regim fiscal** | Timeline cu tranzitiile fiscale ale firmei | Adauga tranzitie |
| **Zona periculoasa** | Operatii destructive (border rosu) | Sterge date istorice |

## Sectiunea 1: Informatii generale

Datele care identifica firma in platforma:

| Camp | Descriere |
|------|-----------|
| **Denumire** | Numele firmei asa cum apare in toata platforma (lista clienti, header, rapoarte). |
| **CUI** | Codul de identificare fiscala. Optional in platforma, dar util pentru rapoarte oficiale si pentru ca contabilul sa-l identifice rapid. |
| **CAEN** | Codul CAEN principal al activitatii. Pentru moment afisare — in viitor il vom folosi ca semnal contextual (ex: HoReCa → sugereaza regim profit_specific). |
| **Adaugat la** | Data crearii inregistrarii in Costify. Read-only. |
| **Intrari in jurnal** | Numarul de linii active din jurnal. Read-only, derivat. |

### Cum modifici

Sectiunea se deschide in modul **read-only**. Cand vrei sa schimbi ceva:

1. Apasa **Modifica** in coltul din dreapta sus.
2. Toate campurile editabile (Denumire, CUI, CAEN) devin inputuri.
3. Modifici ce ai de modificat.
4. Apasa **Salveaza** (sau **Anuleaza** ca sa abandonezi schimbarile).

Nu exista inline-edit-pe-click. Modificarea identitatii firmei e o actiune deliberata, nu un click accidental pe text.

## Sectiunea 2: Regim fiscal

Aici e schimbarea de fond fata de versiunea veche a platformei.

### De ce timeline si nu un singur regim

Inainte, fiecare client avea un singur camp `taxRegime`. Asta inseamna ca daca selectai "profit standard", toata istoria firmei era raportata ca profit standard — chiar si lunile in care firma fusese microintreprindere. **Asta era contabil incorect.**

In realitate, o firma poate trece intre regimuri **in cursul aceluiasi an fiscal**:

- **Depasire prag micro** → trecere la profit standard de la luna urmatoare. Ex: firma depaseste 500.000 EUR cifra de afaceri in mai → de la 1 iunie devine platitor de impozit pe profit 16%.
- **Optiune voluntara** la inceput de an fiscal nou.
- **IMCA** (Impozit Minim pe Cifra de Afaceri) pentru firmele mari — introdus din 2024 cu reguli specifice.

Costify modeleaza asta ca un **timeline**. Fiecare schimbare e o **tranzitie** cu data exacta de start. Pentru orice raport CPP pe luna X, sistemul rezolva automat regimul valabil — nu trebuie sa schimbi nimic manual la fiecare deschidere de raport.

### Cum arata timeline-ul

Tranzitia curenta (cea mai recenta) apare in top, marcata cu badge **Curent**. Sub ea, in ordine descrescatoare cronologica, apare **Istoric**-ul.

Exemplu pentru o firma care a trecut de la micro la profit standard in aprilie 2025:

- **Curent** — Profit standard 16%, de la 01 aprilie 2025. Motiv: depasire prag 500.000 EUR.
- Microintreprindere 1%, de la 01 ianuarie 2024. Motiv: optiune fiscala 2024.
- Microintreprindere 1%, de la inceput (tranzitia initiala — nu poate fi stearsa cat e singura).

Fiecare rand are butoane **Modifica** si **Sterge** in dreapta.

### Cum adaugi o tranzitie

1. Apasa **+ Adauga tranzitie** in coltul din dreapta sus.
2. Modal-ul cere:
   - **Data de start** — ziua de la care noul regim e valabil. Trebuie sa fie unica per client (nu poti avea doua tranzitii in aceeasi zi).
   - **Regim fiscal** — alegi din lista regimurilor disponibile (vezi mai jos).
   - **Motiv** (optional) — text liber, util pentru istoricul tau ("depasire prag", "optiune voluntara 2025", etc.).
3. Apasa **Salveaza**.

Dupa salvare, toate rapoartele CPP pentru perioadele >= data de start vor folosi noul regim. Cele anterioare raman pe regimurile lor istorice.

### Regimurile disponibile

| Cod intern | Eticheta in UI | Cont impozit | Rata |
|------------|----------------|--------------|------|
| `profit_standard` | Profit standard 16% | 691 | 16% |
| `profit_micro_1` | Microintreprindere 1% | 698 | 1% (sub 60k EUR) |
| `profit_micro_3` | Microintreprindere 3% | 698 | 3% (intre 60k si pragul superior) |
| `imca` | IMCA | 697 | impozit minim cifra de afaceri |
| `profit_specific` | HoReCa (impozit specific) | 695 | tarif specific |
| `deferred` | Impozit amanat | 698 | special |

### Tranzitia initiala ("De la inceput")

Pentru clientii creati inainte de a introduce timeline-ul, sistemul a seed-uit automat o tranzitie initiala cu data `1970-01-01`. In UI o vezi ca **"De la inceput"**, nu ca data calendaristica. Nu poti sterge aceasta tranzitie cat timp e singura — daca o stergi, nu mai ai niciun regim valabil pe perioadele istorice. Daca adaugi alte tranzitii deasupra ei, atunci o poti sterge si ea.

### Cum stergi sau modifici

Fiecare rand din timeline are butoanele **Modifica** si **Sterge** (dreapta sus).

- **Modifica** — schimba data de start, regimul, sau motivul.
- **Sterge** — scoate tranzitia. Atentie: dupa stergere, perioadele care erau acoperite de ea vor cadea pe tranzitia precedenta din istoric. Verifica ce s-a schimbat in CPP imediat dupa.

### Cum se reflecta pe pagina CPP

Pe tab-ul **Cont Profit si Pierdere**, in header-ul paginii (langa selectorul de perioada), vezi:

```
Regim fiscal:  Profit standard 16% · Cont 691     [Gestioneaza →]
```

E o eticheta read-only, nu un dropdown. Linkul **Gestioneaza** te aduce inapoi in Setari, direct la sectiunea Regim fiscal (deep-link cu ancora `#regim-fiscal`).

Daca schimbi perioada selectata pe CPP la o luna acoperita de o alta tranzitie, eticheta se actualizeaza automat. De exemplu, daca firma a trecut de la micro la profit standard pe 1 aprilie 2025:

- Selectezi **martie 2025** → eticheta arata "Microintreprindere 1% · Cont 698", impozitul pe rd. 34 vine din 698.
- Selectezi **iunie 2025** → eticheta arata "Profit standard 16% · Cont 691", impozitul vine din 691.

Acelasi raport, doua perioade, doua regimuri — fiecare corect.

## Sectiunea 3: Zona periculoasa

Operatiile care nu pot fi anulate prin click. Sunt grupate intr-o sectiune cu **border rosu si titlu rosu** ca sa nu fie executate accidental.

### Sterge date istorice

Pana acum, butonul de stergere date era ascuns intr-un meniu `⋮` din header-ul paginii. L-am mutat aici pentru ca:

1. Nu e o actiune frecventa — sta mai bine in Setari, nu in calea utilizatorului care vrea sa vada un raport.
2. E destructiva — merita o sectiune dedicata, nu un meniu drop-down.

Cand apesi **Sterge date**, modal-ul cere:

- Data de la care vrei sa stergi (toate liniile cu `data >= acea zi` sunt marcate pentru stergere).
- Sa scrii cuvantul **STERGE** manual in input-ul de confirmare. Copy-paste e blocat — trebuie sa-l scrii.

Stergerea e un **soft-delete**: liniile raman in baza de date cu un timestamp `deletedAt`, nu sunt sterse fizic. Auditul retine snapshot-ul complet al liniilor sterse. Daca ai sters din greseala, ne contactezi si recuperam.

Pentru detalii despre flow, vezi [Corecteaza date istorice](corecteaza-date-istorice).

## Cum intreaba Costi despre Setari

Costi are acces la regimul fiscal prin doua tool-uri:

1. **`get_tax_regime_timeline(client_name)`** — istoricul complet al tranzitiilor pentru o firma. Cand intrebi *"ce regim are 4Walls Studio in iunie 2025?"* sau *"cand a trecut firma X de la micro la profit standard?"*, Costi cheama acest tool.
2. **`get_cpp(client_name, year, month)`** — rezolva automat regimul valabil pe acea perioada si il include in raspuns ca `taxRegime`. Asta inseamna ca atunci cand intrebi *"care e impozitul pe luna iunie 2025?"*, Costi stie deja care e regimul corect, fara sa intrebe.

Pentru identitatea firmei (denumire, CUI, CAEN), foloseste tool-ul `list_clients` care le returneaza pe toate.

## De retinut

- **Setari = configuratie stabila.** Nu se schimba la fiecare deschidere a aplicatiei.
- **Regim fiscal = timeline.** Fiecare schimbare e o tranzitie cu data de start. Nu mai exista "regimul firmei" ca un singur valoare.
- **CPP afiseaza regimul, nu il schimba.** Schimbarea regimului se face exclusiv din Setari.
- **Zona periculoasa = soft-delete + audit.** Nimic nu e pierdut definitiv; tot e recuperabil din backup + audit.
