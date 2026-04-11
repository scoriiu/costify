# Finlight.ro

**Finlight** este cel mai apropiat competitor al Costify din piata romaneasca. Amandoua platformele pornesc de la aceeasi premisa fundamentala — raportarea financiara relevanta are nevoie de date la nivel de nota contabila, nu doar de solduri agregate — dar se adreseaza unor utilizatori complet diferiti si rezolva probleme diferite.

Acest document explica ce face Finlight, cum proceseaza datele, cum se pozitioneaza si unde sunt diferentele reale fata de Costify. Este o analiza interna pentru echipa, nu un atac si nu o reclama. Finlight este o platforma serioasa, construita de oameni care inteleg contabilitatea romaneasca.

## 1. Ce este Finlight

Finlight este o platforma SaaS romaneasca de **raportare financiara pentru management**. Construita pentru antreprenori si manageri de IMM-uri care vor sa inteleaga situatia financiara a firmei lor fara sa aiba pregatire contabila.

Pitch-ul lor central — *"cifrele sunt calculate, nu estimate"* — este aceeasi teza pe care o are si Costify: rapoartele financiare generice care se bazeaza doar pe extrase bancare sau pe balanta de verificare sunt aproximative. Ca sa oferi informatii utile pentru decizii reale, ai nevoie de nota contabila: datele cele mai granulare, de la nivelul tranzactiei individuale.

> *"Raportarea financiara relevanta necesita preluarea datelor contabile la nivel de nota contabila. Spre deosebire de alte platforme, Finlight preia aceste date contabile din Registrul jurnal sau din fisierul SAF-T si le transformea in informatii utilizabile."*
>
> — Finlight, pagina Raportare Financiara

Este exact filosofia jurnal-centrica pe care o are si Costify. Diferenta incepe mai jos, la utilizatorul tintit, la modelul de date si la modelul de business.

## 2. Cine este utilizatorul

### Utilizatorul Finlight
- **Antreprenorul** care vrea sa-si vada firma printr-un dashboard
- **Managerul** de IMM care ia decizii operationale si strategice
- Ocazional, contabilul — dar mentionat in marketing ca "utilizator secundar"

Finlight presupune **un utilizator, o firma**. Interfata, preturile si fluxurile sunt toate construite pe acest model. Contabilul care gestioneaza 50 de clienti nu are un flux natural in Finlight: ar trebui sa plateasca abonament per firma, sa comute manual intre firme si sa refaca mapari de coloane pentru fiecare.

### Utilizatorul Costify
- **Contabilul** care gestioneaza portofolii de clienti (zeci sau sute de firme)
- **Managerul financiar intern** al unui grup de companii

Costify este construita de la zero cu arhitectura multi-tenant pentru un singur utilizator cu 1000+ de clienti. Contabilul este cetateanul de gradul intai. Tot ce vede in produs — lista de clienti, import-ul in doi pasi, Costi AI, balanta, CPP — este optimizat pentru cineva care lucreaza cu multe firme in aceeasi zi.

Aceasta este **cea mai importanta diferenta** intre cele doua platforme. Nu este o alegere de nuanta, este o alegere structurala care determina modelul de date, pretul, UX-ul si strategia.

## 3. Cum functioneaza produsul Finlight

### Doua linii de produs

**A. Raportare Financiara** — componenta principala care include:
- **Dashboard** — sinteza informatiilor financiare intr-un singur ecran
- **Rapoarte standard** — cont de profit si pierdere, bilant contabil, flux de numerar
- **Indicatori financiari** — valori curente, tendinte pe 6 luni, comparatii cu perioade anterioare
- **Index Financiar** — sistem propriu de evaluare pe o scara de la 0 la 100, pe patru arii: rezultat operational, lichiditate, solvabilitate, dinamica activitatii
- **Alerte** — notificari cand apar evolutii negative in indicatorii-cheie
- **Sistem de ajustare a datelor** — permite modificarea cifrelor contabile pentru a reflecta realitatea operationala (exemplu: ajustarea creantelor de la clienti rau platnici care nu sunt inca legal in insolventa)
- **Export** — tabele si grafice in Excel sau PNG

**B. Verificare SAF-T** — linie separata, cu pret separat, care valideaza fisierul XML D406 SAF-T inainte de depunerea la ANAF. Ruleaza testele oficiale ANAF plus teste proprii Finlight de consistenta: structura fisierului, identificare contribuabil, solduri conturi, balanta contabila orizontal si vertical, detalii parteneri, coduri de taxe, consistenta TVA, unitati de masura, produse, denominare in valuta.

### Index Financiar si Ghidul Financiar

Doua elemente interesante ale Finlight care merita evidentiate:

**Index Financiar** este un sistem de scoring numeric. In loc sa-i arate antreprenorului "current ratio = 1.8", ii arata "Lichiditate: 72/100, verde". Este un strat de interpretare care traduce indicatorii financiari tehnici in limbaj pe care il intelege un non-contabil. Este inteligent si util pentru utilizatorii lor tinta.

**Ghidul Financiar Finlight** este o resursa de educatie financiara integrata in produs — peste 40 de articole care explica concepte ca "cont de profit si pierdere", "flux de numerar", "bilant contabil", "evaluarea performantei operationale", "lichiditatea firmei". Fiecare element din interfata are un link contextual catre articolul relevant din Ghid. Este echivalentul sectiunii "Bazele contabilitatii" din docs-ul Costify, construit insa mai devreme si pentru o alta audienta — antreprenorul, nu contabilul.

## 4. Cum intra datele in Finlight

Aceasta este partea cea mai importanta din analiza pentru ca aici se vede diferenta arhitecturala reala. Finlight ofera trei cai de ingestie a datelor.

### Calea 1: Fisier SAF-T (XML)

Este metoda preferata de Finlight pentru firmele medii si mari care sunt deja obligate sa depuna SAF-T.

- Utilizatorul incarca fisierul XML D406 direct in platforma
- Un fisier SAF-T = o luna calendaristica (formatul ANAF este lunar)
- Mai multe fisiere lunare pot fi urcate simultan daca sunt arhivate intr-un ZIP
- Dupa procesare, o verificare gratuita de consistenta SAF-T ruleaza automat ca valoare adaugata
- Firma din Finlight trebuie configurata explicit ca "de tip SAF-T" ca sa accepte fisiere XML

SAF-T este o sursa de date **mult mai bogata** decat un export de registru jurnal: pe langa debit, credit si suma, contine detalii despre documente (facturi), parteneri, plati, incasari, taxe per tranzactie, unitati de masura, produse. Finlight foloseste aceste detalii ca sa ofere rapoarte la nivel de partener si la nivel de tranzactie, nu doar agregate.

### Calea 2: Excel sau CSV (pentru firmele mici fara SAF-T)

Acesta este fluxul manual pentru firme care nu au inca obligatie SAF-T sau pentru microintreprinderi. Este un proces in trei etape.

**Etapa A — Import balanta contabila (solduri initiale, o singura data)**

Balanta se urca **o singura data**, la construirea primului pachet de raportare, ca sa stabileasca soldurile initiale ale conturilor. Pentru firmele nou infiintate nu este necesara — soldurile initiale sunt toate zero.

Fluxul:

1. Utilizatorul apasa "Incarca balanta contabila", alege fisierul si apasa "Incarca"
2. Platforma afiseaza o pre-vizualizare a documentului
3. Utilizatorul **mapeaza manual** coloanele din antet:
   - selecteaza data (luna si anul) balantei
   - marcheaza coloana cu codul de cont contabil (de obicei coloana A)
   - marcheaza coloana cu soldul initial debitor (de obicei coloana C)
   - marcheaza coloana cu soldul initial creditor (de obicei coloana D)
   - celelalte coloane le marcheaza ca "Nimic"
4. Apasa "Confirma coloane", apoi "Proceseaza"
5. Sistemul analizeaza fisierul si evenimentul trece in status **"Asteapta confirmare"**
6. Utilizatorul verifica rezultatul prin "Detalii", apoi apasa explicit "Confirma" sau "Anuleaza"

**Etapa B — Import registru jurnal (note contabile, lunar)**

Spre deosebire de balanta, registrul jurnal se urca pentru **fiecare luna calendaristica** din perioada de raportare.

- Utilizatorul poate urca **pana la 12 fisiere simultan** pentru ca unele softuri contabile exporta un singur fisier per luna
- Dupa incarcare, platforma afiseaza pre-vizualizarea si cere mapare manuala:
  - data tranzactiei (separat: formatul datei — DD/MM/YYYY, MM-DD-YYYY etc.)
  - contul debitor
  - contul creditor
  - rulajul debitor
  - rulajul creditor
- Daca softul contabil pune cont debit si cont credit pe aceeasi coloana, exista optiunea "Cont Debit/Credit"
- Similar, daca rulajele sunt pe aceeasi coloana, exista "Rulaj Debit/Credit"
- Celelalte coloane se marcheaza "Nimic"
- "Confirma coloane" → "Proceseaza" → status "Asteapta confirmare" → utilizatorul confirma sau anuleaza

**Etapa C — Calcul indicatori**

Dupa ce soldurile initiale si toate notele contabile lunare sunt in platforma, utilizatorul apasa **manual** butonul "Calculeaza indicatori". Acesta este pasul care ruleaza calculele grele: dashboard, index financiar, alerte, rapoarte. Nu se intampla automat la fiecare upload — utilizatorul declanseaza explicit recalcularea.

### Calea 3: API (doar pentru enterprise)

Mentionata ca a treia optiune dar fara documentatie publica. Disponibila doar pentru Finlight Business (tier custom) — birouri de contabilitate, institutii financiare, administratori judiciari. Probabil construita custom pentru fiecare client mare.

### Observatii importante despre ingestie

Cateva concluzii care conteaza:

- **Finlight NU are adaptoare per soft contabil.** Nu stie sa recunoasca automat Saga C, SmartBill, Ciel sau WinMentor. In schimb, are un singur mapper de coloane generic pe care utilizatorul il configureaza manual la fiecare import. Este flexibil dar cere ca utilizatorul sa inteleaga ce contine fiecare coloana. Pentru un contabil experimentat este ok. Pentru un antreprenor non-tehnic este o bariera.

- **Recalcularea este manuala.** Butonul "Calculeaza indicatori" inseamna ca agregarile lor sunt scumpe — probabil sunt stocate in tabele pre-calculate, invalidate explicit la fiecare upload, si utilizatorul trebuie sa astepte ca sistemul sa reconstruiasca totul. Arhitectura Costify face calculul din jurnal la fiecare cerere, cu functii pure, fara cache de invalidat.

- **Sistemul de "Evenimente" cu pre-vizualizare si confirmare explicita este o patern UX bun.** Fiecare import este un eveniment care trece prin statusuri (Asteapta confirmare → Finalizat → Arhivat), cu posibilitate de revizuire si anulare inainte de a ajunge in baza de date. Este o paradigma auditabila si reversibila care se potriveste foarte bine cu modelul `ImportEvent` pe care il avem si noi in backend.

- **Balanta si registrul jurnal sunt intrarile canonice** pentru firmele fara SAF-T. Exact ca la noi. Vocabularul este acelasi: "Registru Jurnal", "Balanta Contabila", "Note contabile", "Rulaj debit", "Rulaj credit".

## 5. Preturi

Finlight are doua serii de abonamente, separate.

### Seria raportare financiara (lunar, fara TVA)

| Abonament | Pret lunar | Pentru cine |
|---|---|---|
| Finlight Free | 0 € | Acces limitat, functionalitati reduse |
| Business in Motion by Iancu Guda | 99 € (950 €/an) | Tier de intrare co-branduit cu Iancu Guda |
| Finlight Start | 149 € | Afaceri la inceput |
| Finlight Standard | 299 € | Afaceri mici in dezvoltare |
| Finlight Complet | 499 € | Afaceri mature, toate marimile |
| Finlight Business | custom | B2B — birouri de contabilitate, institutii financiare, portofolii |

### Seria SAF-T (lunar, fara TVA, separat de seria de raportare)

| Abonament | Pret lunar |
|---|---|
| SAF-T Start | de la 200 € |
| SAF-T PRO | nedisponibil public |

Abonamentele SAF-T includ si Finlight Free ca bundle — deci platesti pentru verificare dar primesti dashboard-ul de baza pe deasupra.

### Observatii despre modelul de pret

- **Toate preturile sunt per firma.** Un birou de contabilitate cu 50 de clienti ar plati 50 × 99-499 € = intre 5000 € si 25000 € pe luna la tarifele publice. Evident irealizabil, motiv pentru care exista tier-ul custom "Finlight Business".

- **Tarif orar pentru overage:** 50 €/ora pentru personalizare si suport tehnic peste limita inclusa in abonament. Modelul are componenta de servicii, nu doar software.

- **Parteneriatul Iancu Guda** este o miscare inteligenta de distributie. Iancu Guda este un nume cunoscut in educatia financiara romaneasca — autor, comentator TV, consultant. Finlight a licentiat numele si metodologia lui pentru tier-ul cel mai ieftin ca sa aiba un anchor de brand si un funnel de leaduri "cititorii lui Iancu descopera dashboard-ul".

## 6. Unde sunt diferentele reale fata de Costify

Finlight si Costify au aceeasi teza filosofica — jurnal-centric, nu agregat — dar rezolva probleme diferite pentru utilizatori diferiti. Nu suntem competitori directi in sensul clasic. Suntem "siblings" filosofici care opereaza in categorii invecinate.

### Ce face Finlight si Costify nu face (inca)

1. **SAF-T XML ca sursa de date** — Finlight citeste D406 direct. Costify accepta deocamdata doar Saga C XLSX si Excel-uri generice. SAF-T este o sursa mai bogata (parteneri, documente, taxe, produse) si devine obligatorie pentru toate firmele romanesti in anii urmatori.
2. **Verificare SAF-T** — produs separat la Finlight, compliance wedge valoros. Costify nu face asta.
3. **Index Financiar** — scoring 0-100 per arie de interes. Costify arata KPI-uri brute fara strat interpretativ numeric.
4. **Sistem de ajustare a datelor** — permite sa suprascrii cifre contabile pentru a reflecta realitatea operationala (creante rau platnice, deprecieri de stoc etc.). Costify nu ofera asta — consideram jurnalul imuabil si calculam mereu din el.
5. **Alerte automate** — notificari proactive cand KPI-urile evolueaza negativ. Costify afiseaza KPI-uri dar nu le monitorizeaza activ.
6. **Pre-vizualizare si confirmare explicita a importurilor** — fluxul "Asteapta confirmare" → "Finalizat" expus ca model UX de prima clasa. Costify are primitivele in backend (`ImportEvent`) dar nu le expune inca la fel de explicit.
7. **Iancu Guda ca brand ambassador** — Costify nu are un brand partner de acest gen.
8. **Ghidul Financiar cu 40+ articole** — mai multe articole de educatie financiara decat avem noi in sectiunea "Bazele contabilitatii". Suntem aproape, dar ei au inceput mai devreme.

### Ce face Costify si Finlight nu face

1. **Multi-tenant de la zero.** Un singur utilizator cu 1000+ clienti izolati, fiecare cu propriul jurnal. Finlight poate gestiona portofolii dar doar prin tier-ul custom si cu un model de date adaptat ulterior.
2. **Adaptoare per soft contabil.** Saga C ca standard intern, format-adapters pentru SmartBill, Ciel, WinMentor. Utilizatorul urca fisierul si functioneaza. Finlight cere mapare manuala a coloanelor la fiecare import.
3. **Costi AI.** Finlight nu are AI, chat sau natural language. Asistentul Costi — cu tool use, access scoped la datele clientului curent si cunostinte complete despre contabilitatea romaneasca — este diferentiatorul nostru principal. Pentru contabili care gestioneaza zeci de clienti, a avea un asistent care poate raspunde "care clienti au TVA de plata peste 10k in decembrie?" schimba complet viteza de lucru.
4. **Arhitectura jurnal-centrica cu functii pure.** Fara cache, fara recalculare manuala. Balanta, CPP si KPI-urile sunt calculate la fiecare cerere, in timp real, din jurnal. Finlight are un buton "Calculeaza indicatori" pe care utilizatorul trebuie sa-l apese explicit — indiciu ca agregarile lor sunt stocate si invalidate.
5. **Preturi potrivite pentru contabili.** Costify este gandit ca un produs pe care un contabil il plateste o data pentru intregul portofoliu, nu per firma. Economia de scala a multi-tenantului se transfera in pretul utilizatorului final.
6. **Marketing si design modern.** Costify arata ca un produs 2026. Finlight are inca lorem ipsum in testimoniale si ilustratii stock — sunt un produs condus de contabili, nu de designeri. Pentru un contabil care vede ambele platforme, prima impresie conteaza.
7. **Sectiunea de docs expusa ca parte din produs.** Citesti articole despre balanta, CPP, plan de conturi, chiar in interiorul aplicatiei, gata sa fie linkate de Costi. Finlight are Ghidul Financiar ca parte dintr-un site WordPress separat.
8. **Audit si trasabilitate built-in.** Costify are `audit_event` ca pilon fundamental — fiecare operatie lasa o urma imuabila. Finlight mentioneaza audit in marketing dar nu documenteaza arhitectura.

## 7. Ce ar putea sa invete Costify de la Finlight

Cateva lucruri concrete pe care le-am putea adopta:

1. **Citirea fisierelor SAF-T ca sursa de ingestie.** Este o sursa mai bogata decat XLSX-ul Saga si devine obligatorie in piata. Pasul urmator ar fi un format-adapter pentru SAF-T in modulul de ingestie, care sa mapeze XML-ul in modelul nostru canonic de nota contabila + sa extraga metadate suplimentare (parteneri, facturi, taxe).

2. **Produs de verificare SAF-T.** O pagina separata in /reports sau /internal care ruleaza testele ANAF + teste proprii pe fisierul D406 inainte de depunere. Valoros ca sanity check pentru contabili si ca wedge de compliance.

3. **Expunerea fluxului de import ca "Evenimente" cu pre-vizualizare si confirmare explicita.** Avem deja `ImportEvent` in backend. Ar trebui sa fie prima clasa in UI: lista de evenimente cu statusuri (In curs, Asteapta confirmare, Finalizat, Arhivat), pre-vizualizare inainte de commit, buton explicit de confirmare sau anulare. Este o paradigma auditabila si reversibila care se potriveste cu modul in care contabilii se asteapta sa lucreze cu date.

4. **Index Financiar — strat de scoring numeric.** In plus fata de KPI-urile brute, un scoring 0-100 per arie de interes (lichiditate, profitabilitate, solvabilitate, activitate). Util mai ales pentru cand contabilul vrea sa genereze un raport pentru clientul sau care nu citeste cifre brute.

5. **Sistem de ajustari.** Mecanism prin care contabilul (sau antreprenorul) poate suprascrie cifre pentru a reflecta realitatea operationala — creante rau platnice, deprecieri, venituri angajate dar nefacturate. Ajustarile trebuie sa fie separate de jurnalul imuabil, auditabile, si reversibile.

6. **Alerte proactive pentru KPI-uri.** Nu doar afisare pasiva. Notificari cand se depaseste un prag, cand o tendinta devine negativa, cand apare o anomalie.

7. **Parteneriate de brand cu figuri cunoscute din finante romanesti.** Un echivalent Iancu Guda pentru noi — un autor, consultant sau educator contabil cu audienta, care sa co-brand-uieasca o sectiune din docs sau un tier. Cheap, high-trust, accelereaza distributia.

## 8. Ce NU ar trebui sa copiem de la Finlight

1. **Pretul per firma.** Este gresit pentru ICP-ul nostru (contabil cu portofoliu). Costify trebuie sa stea pe modelul per-portofoliu sau per-contabil, nu per-client.
2. **Maparea manuala a coloanelor la fiecare import.** Arhitectura cu adaptoare per soft este mai buna structural. Maparea manuala ramane doar ca fallback pentru formate necunoscute.
3. **Recalcularea manuala.** Arhitectura noastra jurnal-centrica calculeaza instant si ar trebui sa ramana asa.
4. **Separarea raportarii si SAF-T ca produse distincte.** Bundle-uiesc tot ca o singura experienta — SAF-T este o sursa de date, nu un produs separat.

## 9. Concluzie strategica

Finlight este o platforma solida, bine construita, cu o teza corecta si cu un parteneriat de distributie inteligent. Exista in piata de cativa ani, au clienti reali (CITR, F64, Dimmer, Fair Value) si au construit o baza de continut educational respectabila. Nu sunt un competitor pe care sa-l subestimam.

Dar ei rezolva **o problema diferita**: dashboard-ul antreprenorului. Costify rezolva **scaunul contabilului care gestioneaza 100+ clienti**. Sunt doua meserii diferite, doua ICP-uri diferite, doua modele de pret diferite. Cele doua platforme ar putea chiar coexista in piata cu un contabil care foloseste Costify pentru munca lui zilnica si recomanda Finlight clientilor sai care vor propriul dashboard managerial.

Pozitionarea noastra trebuie sa fie explicita: **Costify este cockpit-ul contabilului modern, nu dashboard-ul antreprenorului**. Aceasta claritate ne protejeaza de comparatii pret-per-firma si ne aseaza intr-o categorie pe care o definim noi, cu preturi si UX proprii.

Pe termen scurt Finlight nu este o amenintare directa. Pe termen mediu, daca adauga tier portfolio cu preturi sensibile pentru contabili, pot deveni competitor direct — au deja SEO, continut si un brand cunoscut. Raspunsul nostru ar trebui sa fie: miscare rapida pe SAF-T (atat ca sursa de date cat si ca verificare), expunere mai agresiva a Costi AI ca diferentiator, si stabilirea unui brand accountant-first inainte ca ei sa se orienteze intr-acolo.

---

*Analiza facuta in aprilie 2026 pe baza paginilor publice ale finlight.ro: homepage, raportare-financiara, preturi-si-servicii, automatizare, documentatie/ghidul-de-utilizare-finlight, docs/ghidul-de-utilizare-finlight/preluarea-datelor-in-platforma. Nu am avut acces la platforma live si nu am testat produsul. Observatiile despre arhitectura interna sunt deduse din comportamentul documentat, nu din cod.*
