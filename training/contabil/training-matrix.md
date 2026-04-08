# Matricea de Antrenare — Training Matrix

Matrice completă pentru antrenarea agentului contabil expert pe drept românesc.

**Task-type legend:**
- `eligibility` — are voie expertul contabil / contabilul autorizat să facă lucrarea?
- `bookkeeping` — cum se înregistrează în contabilitate?
- `financial_reporting` — cum se prezintă în situații financiare?
- `tax_determination` — ce tratament fiscal are?
- `tax_procedure` — cum se declară / probează / contestă?
- `aml_risk` — există obligație KYC, beneficiar real, raportare?
- `corporate_action` — ce act societar trebuie verificat?
- `payroll` — impact salarial și de contribuții?
- `digital_reporting` — apare în e-Factura / D112 / D406?

**Priority legend:** MUST = fără el agentul este incomplet; SHOULD = necesar pentru practică completă; OPTIONAL = sectorial/specializat.

---

## Nivel 1 — Identitate Profesională

### 1. OG nr. 65/1994 — Organizarea activității de expertiză contabilă

| Capitol / Articol | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Cap. I — Dispoziții generale (art. 1-5) | eligibility | MUST | "Cine are dreptul să exercite profesia de expert contabil?" |
| Cap. II — Accesul la profesie (art. 6-14) | eligibility | MUST | "Ce condiții trebuie îndeplinite pentru a deveni expert contabil?" |
| Cap. III — Exercitarea profesiei (art. 15-24) | eligibility | MUST | "Ce lucrări poate executa un expert contabil și ce nu poate?" |
| Cap. IV — Organizarea CECCAR (art. 25-38) | eligibility | SHOULD | "Ce rol are CECCAR și cum este organizat?" |
| Cap. V — Stagiu și examen (art. 39-44) | eligibility | MUST | "Cum se desfășoară stagiul de expert contabil?" |
| Cap. VI — Disciplină și răspundere (art. 45-55) | eligibility | MUST | "Ce sancțiuni disciplinare poate primi un expert contabil?" |
| Cap. VII — Contabilul autorizat (art. 56-60) | eligibility | MUST | "Care este diferența între expert contabil și contabil autorizat?" |
| Cap. VIII — Interdicții (art. 61-65) | eligibility | MUST | "Ce se întâmplă dacă cineva exercită profesia fără drept?" |

**Fișier:** `training/contabil/profesie-og65.md`

### 2. ROF CECCAR + Regulament acces/stagiu/examen + Standarde 21/22/35

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| ROF — Organizarea filialelor | eligibility | SHOULD | "Cum funcționează filiala CECCAR?" |
| ROF — Înscrierea în Tablou | eligibility | MUST | "Ce trebuie să faci ca să fii înscris în Tabloul CECCAR?" |
| ROF — Disciplina profesională | eligibility | MUST | "Cum funcționează procedura disciplinară CECCAR?" |
| Regulament stagiu — Durata și conținutul | eligibility | MUST | "Cât durează stagiul și ce presupune?" |
| Regulament examen — Probe și cerințe | eligibility | MUST | "Din ce constă examenul de aptitudini?" |
| Standard 21 — Ținerea contabilității | eligibility, bookkeeping | MUST | "Ce standarde se aplică la ținerea contabilității pentru terți?" |
| Standard 22 — Examinarea contabilității | eligibility, financial_reporting | MUST | "Ce presupune o misiune de examinare a contabilității?" |
| Standard 35 — Expertize contabile | eligibility | MUST | "Cum se desfășoară o expertiză contabilă judiciară?" |

**Fișier:** `training/contabil/profesie-ceccar.md`

### 3. Codul etic CECCAR-IESBA

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Principii fundamentale | eligibility | MUST | "Care sunt cele 5 principii fundamentale ale eticii profesionale?" |
| Independență | eligibility | MUST | "Când există conflict de interese pentru un contabil?" |
| Obiectivitate | eligibility | MUST | "Ce înseamnă obiectivitate în practică contabilă?" |
| Confidențialitate | eligibility | MUST | "Când poate un contabil divulga informații despre client?" |
| Competență profesională | eligibility | MUST | "Ce obligație de formare continuă are expertul contabil?" |
| Conflicte de interese | eligibility | MUST | "Cum se gestionează un conflict de interese?" |
| Amenințări și măsuri de protecție | eligibility | MUST | "Ce tipuri de amenințări la adresa independenței există?" |
| Onorarii și plăți | eligibility | SHOULD | "Onorariul poate fi condiționat de rezultat?" |

**Fișier:** `training/contabil/etica-profesionala.md`

---

## Nivel 2 — Motorul Contabil

### 4. Legea nr. 82/1991 — Legea contabilității

| Capitol / Articol | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Cap. I — Dispoziții generale (art. 1-4) | bookkeeping | MUST | "Cine are obligația de a organiza contabilitatea?" |
| Cap. II — Organizarea contabilității (art. 5-12) | bookkeeping | MUST | "Contabilitatea se ține în limba română și în moneda națională?" |
| Cap. III — Registrele de contabilitate (art. 13-16) | bookkeeping | MUST | "Care sunt registrele obligatorii de contabilitate?" |
| Cap. IV — Situații financiare (art. 27-34) | financial_reporting | MUST | "Cine depune situații financiare anuale și până când?" |
| Cap. V — Contabilitatea Trezoreriei Statului (art. 35-40) | bookkeeping | OPTIONAL | "Cum funcționează contabilitatea sectorului public?" |
| Cap. VI — Contravenții și sancțiuni (art. 41-42) | bookkeeping, eligibility | MUST | "Ce amenzi se aplică pentru neorganizarea contabilității?" |
| Documente justificative (art. 6) | bookkeeping | MUST | "Ce este un document justificativ și ce trebuie să conțină?" |
| Inventarierea (art. 7-8) | bookkeeping | MUST | "Când și cum se face inventarierea patrimoniului?" |
| Moneda de ținere a contabilității (art. 5, 19-20) | bookkeeping | MUST | "Cum se contabilizează operațiunile în valută?" |

**Fișier:** `training/contabil/legea-contabilitatii.md`

### 5. OMFP nr. 1802/2014 — Reglementări contabile

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Titlul I — Dispoziții generale | bookkeeping | MUST | "Ce entități aplică OMFP 1802/2014?" |
| Titlul II — Principii contabile generale | bookkeeping | MUST | "Care sunt principiile contabile din OMFP 1802?" |
| Titlul III — Formatul situațiilor financiare | financial_reporting | MUST | "Ce format de bilanț trebuie folosit?" |
| Cap. 4 — Reguli de recunoaștere | bookkeeping | MUST | "Când se recunoaște un activ imobilizat?" |
| Cap. 5 — Reguli de evaluare | bookkeeping | MUST | "Cum se evaluează stocurile la ieșire (FIFO, CMP)?" |
| Cap. 6 — Active imobilizate | bookkeeping | MUST | "Care este pragul de imobilizare?" |
| Cap. 7 — Active circulante | bookkeeping | MUST | "Cum se contabilizează ajustările de valoare la creanțe?" |
| Cap. 8 — Datorii | bookkeeping | MUST | "Cum se clasifică datoriile pe termen scurt vs. lung?" |
| Cap. 9 — Capitaluri proprii | bookkeeping, corporate_action | MUST | "Cum se contabilizează majorarea capitalului social?" |
| Cap. 10 — Venituri și cheltuieli | bookkeeping | MUST | "Când se recunosc veniturile conform OMFP 1802?" |
| Cap. 11 — Provizioane | bookkeeping | MUST | "Când se constituie un provizion și cum se contabilizează?" |
| Cap. 12 — Subvenții | bookkeeping | SHOULD | "Cum se contabilizează o subvenție guvernamentală?" |
| Planul de conturi | bookkeeping | MUST | "Care este structura planului de conturi general?" |
| Formatul bilanțului | financial_reporting | MUST | "Ce structură are bilanțul conform OMFP 1802?" |
| Formatul contului de profit și pierdere | financial_reporting | MUST | "Cum se structurează contul de profit și pierdere?" |
| Note explicative | financial_reporting | MUST | "Ce trebuie să conțină notele explicative?" |

**Fișier:** `training/contabil/omfp-1802.md`

### 6. OMFP nr. 2844/2016 — IFRS

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Sfera de aplicare | financial_reporting | MUST (pt. IFRS) | "Ce entități aplică IFRS în România?" |
| Diferențe față de OMFP 1802/2014 | bookkeeping, financial_reporting | MUST (pt. IFRS) | "Care sunt diferențele principale între OMFP 1802 și IFRS?" |
| IAS 1 — Prezentarea situațiilor financiare | financial_reporting | MUST (pt. IFRS) | "Ce situații financiare prevede IAS 1?" |
| IAS 16 — Imobilizări corporale | bookkeeping | MUST (pt. IFRS) | "Cum se evaluează imobilizările corporale sub IFRS?" |
| IAS 36 — Deprecierea activelor | bookkeeping | SHOULD | "Cum funcționează testul de depreciere sub IFRS?" |
| IAS 37 — Provizioane | bookkeeping | SHOULD | "Cum diferă provizioanele sub IFRS vs. OMFP 1802?" |
| IFRS 15 — Venituri | bookkeeping | MUST (pt. IFRS) | "Cum se recunosc veniturile sub IFRS 15?" |
| IFRS 16 — Contracte de leasing | bookkeeping | MUST (pt. IFRS) | "Cum se contabilizează leasingul sub IFRS 16?" |
| Tratament fiscal al diferențelor IFRS | tax_determination | MUST (pt. IFRS) | "Diferențele IFRS au impact fiscal în România?" |

**Fișier:** `training/contabil/ifrs-omfp2844.md`

---

## Nivel 3 — Motorul Fiscal

### 7. Legea nr. 227/2015 — Codul Fiscal

| Titlu / Capitol | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Titlul I — Dispoziții generale (art. 1-12) | tax_determination | MUST | "Ce principii generale guvernează fiscalitatea în România?" |
| Titlul II — Impozitul pe profit (art. 13-46) | tax_determination | MUST | "Cum se calculează impozitul pe profit? Ce cheltuieli sunt nedeductibile?" |
| Art. 25 — Cheltuieli deductibile | tax_determination | MUST | "Ce cheltuieli sunt deductibile integral?" |
| Art. 25^1 — Cheltuieli cu deductibilitate limitată | tax_determination | MUST | "Care sunt limitele pentru cheltuieli de protocol, sponsorizare, auto?" |
| Art. 26 — Cheltuieli nedeductibile | tax_determination | MUST | "Ce cheltuieli sunt integral nedeductibile?" |
| Art. 28 — Amortizare fiscală | tax_determination | MUST | "Cum diferă amortizarea fiscală de cea contabilă?" |
| Art. 28 alin. (14) — Amortizare autoturisme M1 | tax_determination | MUST | "Care este amortizarea deductibilă pentru autoturisme? Ce excepții există?" |
| Titlul III — Impozitul pe veniturile microîntreprinderilor (art. 47-57) | tax_determination | MUST | "Ce condiții trebuie îndeplinite pentru regimul micro?" |
| Art. 52 — Baza de impozitare micro | tax_determination | MUST | "Ce se include și ce se exclude din baza impozabilă micro?" |
| Titlul IV — Impozitul pe venit (art. 58-134) | tax_determination, payroll | MUST | "Cum se calculează impozitul pe venitul din salarii?" |
| Art. 76 — Venituri din salarii | tax_determination, payroll | MUST | "Ce constituie venit salarial impozabil?" |
| Art. 76 alin. (4^1) — Venituri neimpozabile limitat (33%) | tax_determination, payroll | MUST | "Ce prestații suplimentare de mobilitate sunt neimpozabile și în ce limite?" |
| Art. 76 alin. (2) lit. k^1) — Depășiri mobilitate | tax_determination, payroll | MUST | "Cum se tratează fiscal depășirile de la clauza de mobilitate?" |
| Art. 78 — Deducerea personală | tax_determination, payroll | MUST | "Cum funcționează deducerea personală la salarii?" |
| Titlul V — Contribuții sociale obligatorii (art. 135-228) | tax_determination, payroll | MUST | "Care sunt cotele CAS, CASS și CAM?" |
| Art. 137-138 — Baza de calcul CAS | payroll | MUST | "Care este baza de calcul pentru CAS?" |
| Art. 154-155 — Baza de calcul CASS | payroll | MUST | "Care este baza de calcul pentru CASS?" |
| Art. 220^1 — CAM | payroll | MUST | "Cum se calculează contribuția asiguratorie pentru muncă?" |
| Titlul VII — TVA (art. 265-331) | tax_determination | MUST | "Care sunt cotele de TVA și când se aplică fiecare?" |
| Art. 266 — Definiții TVA | tax_determination | MUST | "Ce este o persoană impozabilă în sensul TVA?" |
| Art. 268-270 — Operațiuni impozabile | tax_determination | MUST | "Ce operațiuni sunt în sfera TVA?" |
| Art. 286 — Baza de impozitare TVA | tax_determination | MUST | "Ce se include în baza de impozitare TVA?" |
| Art. 291 — Cotele de TVA | tax_determination | MUST | "Care sunt cotele de TVA (21%, 11%, 0%)?" |
| Art. 292 — Scutiri | tax_determination | MUST | "Ce operațiuni sunt scutite de TVA cu/fără drept de deducere?" |
| Art. 297-300 — Dreptul de deducere | tax_determination | MUST | "Cum funcționează dreptul de deducere TVA?" |
| Art. 310 — Regimul special de scutire (plafonul) | tax_determination | MUST | "Care este plafonul de scutire TVA și cum funcționează?" |
| Art. 316 — Înregistrarea în scopuri de TVA | tax_determination | MUST | "Când este obligatorie înregistrarea în scopuri de TVA?" |
| Art. 321-325 — Obligații declarative TVA | tax_determination, digital_reporting | MUST | "Ce declarații TVA trebuie depuse și când?" |
| Titlul VIII — Accize (art. 332-453) | tax_determination | SHOULD | "Ce produse sunt accizabile?" |
| Titlul IX — Impozite și taxe locale (art. 454-500) | tax_determination | SHOULD | "Cum se calculează impozitul pe clădiri?" |
| Titlul X — Impozitul pe construcții (art. 501-505) | tax_determination | SHOULD | "Ce este impozitul pe construcții speciale?" |
| Art. 67 — Impozit pe dividende | tax_determination, corporate_action | MUST | "Care este cota de impozit pe dividende și cum se declară?" |
| Art. 223-229 — Impozitarea nerezidenților | tax_determination | SHOULD | "Cum se impozitează veniturile nerezidenților?" |

**Fișier:** `training/contabil/codul-fiscal.md` (rescrie `legislatie-fiscala.md`)

### 8. Legea nr. 207/2015 — Codul de Procedură Fiscală

| Titlu / Capitol | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Titlul I — Dispoziții generale (art. 1-15) | tax_procedure | MUST | "Ce principii guvernează procedura fiscală?" |
| Titlul II — Raportul juridic fiscal (art. 16-27) | tax_procedure | MUST | "Cine este subiect al raportului juridic fiscal?" |
| Titlul III — Dispoziții procedurale generale (art. 28-55) | tax_procedure | MUST | "Ce este actul administrativ fiscal și cum se comunică?" |
| Art. 41-44 — Termenele | tax_procedure | MUST | "Cum se calculează termenele în procedura fiscală?" |
| Titlul IV — Înregistrarea fiscală (art. 56-74) | tax_procedure | MUST | "Cum funcționează înregistrarea fiscală?" |
| Titlul V — Stabilirea creanțelor fiscale (art. 75-113) | tax_procedure | MUST | "Ce este decizia de impunere și cum se emite?" |
| Art. 93-100 — Declarațiile fiscale | tax_procedure, digital_reporting | MUST | "Ce declarații fiscale trebuie depuse?" |
| Art. 107-112 — Inspecția fiscală | tax_procedure | MUST | "Cum se desfășoară o inspecție fiscală?" |
| Art. 109 — Durata inspecției | tax_procedure | MUST | "Cât poate dura o inspecție fiscală?" |
| Titlul VI — Controlul fiscal (art. 113-148) | tax_procedure | MUST | "Ce diferență este între inspecție fiscală și control antifraudă?" |
| Art. 130-135 — Mijloace de probă | tax_procedure | MUST | "Ce mijloace de probă poate folosi organul fiscal?" |
| Titlul VII — Colectarea creanțelor fiscale (art. 149-264) | tax_procedure | MUST | "Cum funcționează executarea silită fiscală?" |
| Art. 156-160 — Dobânzi și penalități de întârziere | tax_procedure | MUST | "Care sunt dobânzile și penalitățile de întârziere?" |
| Art. 161-163 — Eșalonarea la plată | tax_procedure | SHOULD | "Cum se obține eșalonarea la plată?" |
| Art. 165-168 — Prescripția dreptului de a stabili creanțe | tax_procedure | MUST | "Care este termenul de prescripție fiscală?" |
| Art. 174-176 — Poprirea | tax_procedure | MUST | "Cum funcționează poprirea conturilor bancare?" |
| Titlul VIII — Soluționarea contestațiilor (art. 265-281) | tax_procedure | MUST | "Cum se contestă un act administrativ fiscal?" |
| Art. 268-270 — Termenul de contestare | tax_procedure | MUST | "În cât timp trebuie depusă contestația?" |
| Art. 276-278 — Soluțiile organului de soluționare | tax_procedure | MUST | "Ce soluții poate da organul de soluționare?" |
| Titlul IX — Sancțiuni (art. 325-345) | tax_procedure | MUST | "Ce contravenții prevede Codul de procedură fiscală?" |

**Fișier:** `training/contabil/procedura-fiscala.md`

---

## Nivel 4 — Compliance și Risc

### 9. Legea nr. 129/2019 — Prevenirea și combaterea spălării banilor (AML/CFT)

| Capitol / Articol | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Cap. I — Dispoziții generale (art. 1-4) | aml_risk | MUST | "Ce acoperă Legea 129/2019 și cui se aplică?" |
| Art. 5 — Entități raportoare | aml_risk | MUST | "Sunt contabilii entități raportoare AML?" |
| Cap. II — Măsuri de cunoaștere a clientelei (art. 6-18) | aml_risk | MUST | "Ce verificări KYC trebuie făcute la acceptarea unui client?" |
| Art. 9-11 — Cunoaștere standard vs. simplificată vs. suplimentară | aml_risk | MUST | "Când se aplică măsuri suplimentare de cunoaștere a clientelei?" |
| Art. 12-14 — Persoane expuse politic (PEP) | aml_risk | MUST | "Ce obligații suplimentare există pentru PEP?" |
| Art. 19-22 — Beneficiarul real | aml_risk | MUST | "Cum se identifică beneficiarul real al unei societăți?" |
| Cap. III — Evaluarea riscului (art. 23-26) | aml_risk | MUST | "Cum se face evaluarea riscului de spălare de bani?" |
| Cap. IV — Raportarea tranzacțiilor suspecte (art. 27-33) | aml_risk | MUST | "Când și cum se raportează o tranzacție suspectă la ONPCSB?" |
| Art. 28 — Tranzacții suspecte | aml_risk | MUST | "Ce indicatori de suspiciune trebuie urmăriți?" |
| Art. 29 — Raportări pentru tranzacții cash >= 10.000 EUR | aml_risk | MUST | "Ce tranzacții cash trebuie raportate automat?" |
| Cap. V — Păstrarea evidențelor (art. 34-37) | aml_risk | MUST | "Cât timp trebuie păstrate evidențele KYC?" |
| Cap. VI — Proceduri interne (art. 38-42) | aml_risk | MUST | "Ce proceduri interne AML trebuie implementate?" |
| Cap. VII — Sancțiuni (art. 43-51) | aml_risk | MUST | "Ce amenzi se aplică pentru nerespectarea AML?" |
| Legea 86/2025 — Modificări (transpunere AMLD 6 + AMLA) | aml_risk | MUST | "Ce modificări a adus Legea 86/2025 la cadrul AML?" |

**Fișier:** `training/contabil/aml-kyc.md`

---

## Nivel 5 — Corporate și Payroll

### 10. Legea nr. 31/1990 — Legea societăților

| Capitol / Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Titlul I — Dispoziții generale (art. 1-6) | corporate_action | MUST | "Ce forme juridice de societăți comerciale există?" |
| Titlul II — Constituirea societăților (art. 7-45) | corporate_action | MUST | "Ce acte constitutive sunt necesare pentru un SRL?" |
| Art. 11-14 — Capital social SRL | corporate_action | MUST | "Care este capitalul social minim pentru SRL?" |
| Titlul III — Funcționarea societăților | corporate_action | MUST | |
| Art. 69-82 — AGA (adunări generale) | corporate_action | MUST | "Când se convoacă AGA și cu ce majoritate se decid?" |
| Art. 142-152 — Administratori | corporate_action | MUST | "Ce răspundere are administratorul unui SRL?" |
| Art. 153-171 — Directorat și consiliul de supraveghere (SA) | corporate_action | SHOULD | "Cum funcționează sistemul dualist de administrare?" |
| Art. 177-185 — Situații financiare și repartizarea profitului | corporate_action, financial_reporting | MUST | "Cum se repartizează profitul într-un SRL?" |
| Art. 67 — Dividende | corporate_action, tax_determination | MUST | "Care sunt condițiile pentru distribuirea de dividende?" |
| Titlul IV — Modificarea actului constitutiv | corporate_action | MUST | |
| Art. 202-214 — Majorarea capitalului social | corporate_action, bookkeeping | MUST | "Cum se majorează capitalul social?" |
| Art. 215-220 — Reducerea capitalului social | corporate_action, bookkeeping | MUST | "În ce condiții se reduce capitalul social?" |
| Titlul V — Fuziune și divizare (art. 238-251) | corporate_action, bookkeeping | SHOULD | "Cum se contabilizează o fuziune prin absorbție?" |
| Titlul VI — Dizolvare și lichidare (art. 227-237, 252-270) | corporate_action, bookkeeping | MUST | "Care sunt cazurile de dizolvare a unui SRL?" |
| Art. 237^1 — Dizolvare de drept | corporate_action | MUST | "Când se dizolvă o societate de drept?" |

**Fișier:** `training/contabil/legea-societatilor.md`

### 11. Codul Muncii (Legea 53/2003) + HG 905/2017 (Revisal) + D112

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Titlul II — CIM (art. 10-79) | payroll | MUST | "Ce elemente obligatorii conține un CIM?" |
| Art. 25 — Clauza de mobilitate | payroll, tax_determination | MUST | "Ce este clauza de mobilitate? Ce prestații sunt neimpozabile și în ce limite?" |
| Art. 16 — Forma scrisă a CIM | payroll | MUST | "Este obligatorie forma scrisă a CIM?" |
| Art. 17 — Informarea salariatului | payroll | MUST | "Ce informații trebuie comunicate salariatului?" |
| Art. 31-33 — Perioada de probă | payroll | MUST | "Cât durează perioada de probă?" |
| Titlul III — Timpul de muncă (art. 111-131) | payroll | MUST | "Care este programul normal de lucru și cum se plătesc orele suplimentare?" |
| Art. 118-122 — Munca suplimentară | payroll | MUST | "Cum se compensează munca suplimentară?" |
| Art. 123-125 — Munca de noapte | payroll | MUST | "Ce spor se acordă pentru munca de noapte?" |
| Titlul IV — Concedii (art. 139-153) | payroll | MUST | "Câte zile de concediu de odihnă are un salariat?" |
| Art. 145-146 — Concedii fără plată | payroll | SHOULD | "Cum se acordă concediul fără plată?" |
| Titlul V — Salarizare (art. 159-172) | payroll | MUST | "Care este salariul minim brut pe economie?" |
| Art. 164 — Deduceri din salariu | payroll | MUST | "Ce se poate reține din salariu?" |
| Art. 166 — Plata salariului | payroll | MUST | "Când și cum se plătește salariul?" |
| Titlul VII — Încetarea CIM (art. 55-79) | payroll | MUST | "Care sunt modalitățile de încetare a CIM?" |
| Art. 55 — Încetarea de drept | payroll | MUST | "Când încetează CIM de drept?" |
| Art. 58 — Concedierea pentru motive disciplinare | payroll | MUST | "Ce procedură trebuie urmată la concediere disciplinară?" |
| Art. 65-67 — Concedierea pentru motive economice | payroll | MUST | "Ce este concedierea colectivă și ce obligații are angajatorul?" |
| Art. 79-81 — Demisia | payroll | MUST | "Care este termenul de preaviz la demisie?" |
| HG 905/2017 — Revisal | payroll, digital_reporting | MUST | "Ce date se transmit în Revisal și în ce termen?" |
| Art. 3-4 HG 905 — Conținutul Revisal | payroll | MUST | "Ce elemente conține fișa din Revisal?" |
| Art. 6 HG 905 — Termene de transmitere | payroll | MUST | "În cât timp trebuie transmise modificările în Revisal?" |
| D112 — Declarația privind obligațiile de plată | payroll, tax_procedure, digital_reporting | MUST | "Cum se completează și depune D112?" |
| D112 — Calcul contribuții | payroll, tax_determination | MUST | "Cum se calculează CAS, CASS, impozit salariu în D112?" |
| D112 — Termen depunere | tax_procedure | MUST | "Până când se depune D112?" |
| D112 — Rectificări | tax_procedure | SHOULD | "Cum se rectifică o D112 depusă greșit?" |

**Fișier:** `training/contabil/salarizare-payroll.md`

---

## Nivel 6 — Raportare Digitală ANAF

### 12. OUG nr. 120/2021 — RO e-Factura

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Sfera de aplicare (art. 1-3) | digital_reporting | MUST | "Cine are obligația de e-Factura?" |
| Definiții (art. 4) | digital_reporting | MUST | "Ce este o factură electronică în sensul OUG 120?" |
| Sistemul RO e-Factura (art. 5-8) | digital_reporting | MUST | "Cum funcționează sistemul RO e-Factura?" |
| Obligații emitent (art. 9-12) | digital_reporting | MUST | "În cât timp trebuie transmisă factura în SPV?" |
| Obligații destinatar | digital_reporting | MUST | "Cum primește cumpărătorul factura?" |
| Format XML — CIUS-RO / UBL 2.1 | digital_reporting | MUST | "Ce standard tehnic se folosește pentru e-Factura?" |
| Sancțiuni | digital_reporting | MUST | "Ce amenzi se aplică pentru netransmiterea e-Factura?" |
| B2B obligativitate (2024-2025) | digital_reporting | MUST | "Din când este obligatorie e-Factura B2B?" |
| B2G | digital_reporting | MUST | "E-Factura B2G este obligatorie?" |
| Modificări OG 13/2024 + extindere B2C 2025 | digital_reporting | MUST | "Ce modificări a adus OG 13/2024 la e-Factura? E obligatorie și B2C?" |

### 13. OPANAF nr. 1783/2021 — SAF-T / D406

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Sfera de aplicare | digital_reporting | MUST | "Cine trebuie să depună D406 (SAF-T)?" |
| Structura XML SAF-T | digital_reporting | MUST | "Ce secțiuni conține fișierul SAF-T?" |
| Categorii de date | digital_reporting | MUST | "Ce categorii de date se raportează în SAF-T?" |
| Termen depunere contribuabili mari | digital_reporting | MUST | "Contribuabilii mari de când depun SAF-T?" |
| Termen contribuabili mijlocii | digital_reporting | MUST | "Contribuabilii mijlocii de când depun SAF-T?" |
| Termen contribuabili mici (2025) | digital_reporting | MUST | "Din 2025 toți contribuabilii depun SAF-T?" |
| Periodicitate | digital_reporting | MUST | "Cu ce periodicitate se depune SAF-T?" |
| General Ledger Entries | digital_reporting, bookkeeping | MUST | "Ce date din contabilitate intră în secțiunea GL?" |
| Accounts Receivable / Payable | digital_reporting | MUST | "Ce date intră în secțiunile AR/AP?" |
| Inventory / Fixed Assets | digital_reporting | SHOULD | "Ce date despre stocuri și imobilizări intră în SAF-T?" |
| Sancțiuni | digital_reporting | MUST | "Ce amenzi se aplică pentru nedepunerea SAF-T?" |

**Fișier:** `training/contabil/e-factura-saft.md` (actualizat)

### 14. RO e-Transport (OUG 41/2022)

| Secțiune | Task-type | Prioritate | Exemple de întrebări |
|---|---|---|---|
| Sfera de aplicare | digital_reporting | OPTIONAL | "Ce bunuri intră sub incidența e-Transport?" |
| Obligații | digital_reporting | OPTIONAL | "Cine are obligația de a declara în e-Transport?" |
| UIT — codul unic | digital_reporting | OPTIONAL | "Ce este codul UIT?" |

**Fișier:** `training/contabil/e-factura-saft.md` (secțiune dedicată)

---

## Legăturile Inter-Nivel (Cross-References)

Agentul trebuie să gestioneze corect interacțiunile între niveluri. Exemple esențiale:

| Legătură | Exemplu concret | Fișiere implicate |
|---|---|---|
| Contabil → Fiscal | Cheltuielile contabile (6xx) vs. cheltuieli deductibile fiscal (art. 25-26 CF) | omfp-1802.md + codul-fiscal.md |
| Corporate → Contabil | Distribuirea dividendelor (Legea 31 art. 67) → nota contabilă (457/5121) | legea-societatilor.md + note-contabile.md |
| Corporate → Fiscal | Dividendele (Legea 31) → impozit pe dividende 16% (art. 97 CF, din 2026) | legea-societatilor.md + codul-fiscal.md |
| Payroll → Fiscal | Salariul brut (Codul muncii) → CAS/CASS/impozit (Titlul V CF) → D112 | salarizare-payroll.md + codul-fiscal.md |
| Payroll → Fiscal (mobilitate) | Clauza de mobilitate (art. 25 CM) → neimpozitare limitată (art. 76 alin. (4^1) lit. a) CF) → raportare D112 (8.5.1 / 8.2.5) | salarizare-payroll.md + codul-fiscal.md |
| Fiscal → Amortizare auto | Amortizare autoturism M1 (art. 28 alin. (14)) → plafon 1.500 lei/lună + excepții activități specifice | codul-fiscal.md + constante-fiscale-2026.md |
| Payroll → Contabil | Înregistrarea salariilor (641, 421, 431x, 444) | salarizare-payroll.md + note-contabile.md |
| Contabil → Digital | Note contabile → SAF-T General Ledger | note-contabile.md + e-factura-saft.md |
| Fiscal → Procedural | TVA de plată (CF) → D300 (CPF) → e-Factura (OUG 120) | codul-fiscal.md + procedura-fiscala.md |
| AML → Profesie | Contabilul ca entitate raportoare (L129) → obligații CECCAR | aml-kyc.md + profesie-og65.md |
| Corporate → AML | Beneficiarul real (L129 art. 19) → structura acționariat (L31) | aml-kyc.md + legea-societatilor.md |

---

## Etichete de validare pentru agent

La finalul fiecărui răspuns, agentul trebuie să poată eticheta ce task-types a atins:

```
[eligibility] [bookkeeping] [financial_reporting] [tax_determination]
[tax_procedure] [aml_risk] [corporate_action] [payroll] [digital_reporting]
```

Un răspuns complex (ex: "clientul vrea să distribuie dividende") ar trebui să atingă: `corporate_action` + `tax_determination` + `bookkeeping` + `digital_reporting` (dacă e cazul D100/D205).
