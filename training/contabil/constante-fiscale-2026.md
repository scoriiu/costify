# Constante Fiscale 2026 — Sursa Unică de Adevăr

**Exercițiu fiscal**: 2026 (1 ianuarie — 31 decembrie 2026)
**Ultima actualizare**: aprilie 2026
**Mod de utilizare**: Toate celelalte fișiere din `training/contabil/` fac referire la acest fișier pentru orice cotă, prag sau termen care se poate modifica de la un an fiscal la altul. NU hardcodați valori fiscale în alte fișiere — citiți din acest fișier.

---

## 1. COTE DE IMPOZITARE

### Impozite directe

| Impozit | Cotă | Baza | Articol Cod Fiscal |
|---|---|---|---|
| Impozit pe profit | **16%** | Profit impozabil | Art. 17 |
| Impozit pe dividende (persoane fizice rezidente) | **16%** (majorat din 2026 prin Legea 141/2025; verificați textul consolidat art. 97) | Dividend brut | Art. 97 |
| Impozit pe dividende (nerezidenți, fără CEDI) | **16%** | Dividend brut | Art. 223-229 |
| Impozit pe dividende (între PJ române) | **0%** (scutit) | — | Art. 23 |
| Impozit pe venit din salarii | **10%** | Venit net – deducere personală | Art. 78 |
| Impozit pe venit PFA (sistem real) | **10%** | Venit net | Art. 68 |
| Impozit pe câștig de capital (cesiune părți sociale) | **10%** | Câștig | Art. 97 |

### Impozit microîntreprinderi

| Situație | Cotă | Baza |
|---|---|---|
| Cu minimum 1 salariat (regula generală) | **1%** | Venituri (conform art. 53) |
| Cazuri specifice (în funcție de situație) | **3%** | Venituri |

Existența a cel puțin unui salariat cu normă întreagă este condiție obligatorie. Plafonul se cumulează cu veniturile întreprinderilor legate.

### Contribuții sociale (salariale)

| Contribuție | Cotă | Plătitor | Cont |
|---|---|---|---|
| CAS (pensie) | **25%** | Angajat (reținut din brut) | 4312 |
| CASS (sănătate) | **10%** | Angajat (reținut din brut) | 4314 |
| CAM (contribuție asiguratorie muncă) | **2,25%** | Angajator (peste brut) | 4311 |
| Impozit pe venit salarial | **10%** | Angajat (reținut din brut) | 444 |

### TVA

| Cotă | Aplicare |
|---|---|
| **21%** | Cota standard (din 1 iulie 2025) |
| **11%** | Cota redusă (din 1 iulie 2025) — alimente, apă, medicamente, hoteluri, restaurante (fără alcool), cărți, ziare, energie termică, acces muzee. Cotele de 5% și 9% au fost abrogate. |
| **9%** | Excepție tranzitorie — anumite livrări de locuințe care îndeplinesc condițiile legale, până la **31 iulie 2026** |
| **0%** | Exporturi, livrări intracomunitare către persoane înregistrate TVA |

### Impozitare nerezidenți (fără CEDI)

| Tip venit | Cotă reținere la sursă |
|---|---|
| Dividende | **16%** |
| Dobânzi | **16%** |
| Redevențe | **16%** |
| Servicii management / consultanță | **16%** |
| Comisioane | **16%** |

### Dobânzi și penalități de întârziere (CPF)

| Tip | Cotă |
|---|---|
| Dobândă de întârziere | **0,02% / zi** |
| Penalitate de întârziere | **0,01% / zi** |
| Penalitate de nedeclarare | **0,08% / zi** (plafon: 100% din obligația fiscală principală; art. 181 CPF) |

### Deductibilitate limitată

| Cheltuială | Limita |
|---|---|
| Protocol (reprezentare) | **2%** din (profit contabil ajustat) |
| Sponsorizare | **0,75%** din CA sau **20%** din impozit pe profit |
| Diurna | **2,5×** nivelul legal |
| Auto (neexclusiv business) | **50%** |
| Asigurare privată sănătate | **400 EUR/an/salariat** |
| Pensie facultativă | **400 EUR/an/salariat** |

---

## 2. PRAGURI MONETARE

### Regimuri fiscale

| Prag | Valoare | Referință |
|---|---|---|
| Plafon microîntreprindere | **100.000 EUR** venituri an precedent (din 1 ian 2026; 509.850 RON la cursul 31.12.2025 de 5,0985). Anterior: 250k EUR (2025), 500k EUR (2023). Se cumulează cu veniturile întreprinderilor legate. | Art. 47 CF |
| Plafon scutire TVA (înregistrare obligatorie) | **395.000 RON** CA anuală (din 1 sept 2025; doar livrări/prestări cu locul în RO, fără active imobilizate) | Art. 310 CF |
| Plafon TVA la încasare | **5.000.000 RON** CA (mar–dec 2026, conform OUG 8/2026; devine 5.500.000 RON din 1 ian 2027) | Art. 282^2 CF |

### Capitalizare și amortizare

| Prag | Valoare |
|---|---|
| Prag imobilizare (activ fix) | **2.500 RON** + durată > 1 an (verificați forma actuală art. 28 CF) |

### Capital social minim

| Formă juridică | Capital minim |
|---|---|
| SRL | **1 RON** |
| SA / SCA | **90.000 RON** |

### Categorii de entități (OMFP 1802/2014)

| Categorie | Total active | CA netă | Nr. salariați |
|---|---|---|---|
| Microentitate | ≤ **1.500.000 RON** | ≤ **3.000.000 RON** | ≤ **10** |
| Entitate mică | ≤ **17.500.000 RON** | ≤ **35.000.000 RON** | ≤ **50** |
| Mijlocie/mare | peste pragurile de mai sus | — | — |

### Consolidare

| Criteriu | Prag |
|---|---|
| Total active | **24.000.000 RON** |
| CA netă | **48.000.000 RON** |
| Nr. salariați | **250** |

### Salariul minim brut pe economie

| Perioadă | Valoare |
|---|---|
| Ianuarie – Iunie 2026 | **4.050 RON/lună** |
| Iulie – Decembrie 2026 | **4.325 RON/lună** |

### Plafoane CAS

| Context | Regulă |
|---|---|
| Salariați (CIM) | **Fără plafon maxim** — CAS 25% se calculează la venitul brut realizat |
| PFA / activități independente (venit net 12-24 salarii minime) | Baza CAS = **12 salarii minime brute** |
| PFA / activități independente (venit net ≥ 24 salarii minime) | Baza CAS = **24 salarii minime brute** |

### Deducerea personală

| Venit brut lunar | Deducere |
|---|---|
| ≤ 2.000 RON | Integrală (funcție de persoane în întreținere) |
| 2.001 – 4.000 RON | Parțială (degresivă) |
| > 4.000 RON | **0 RON** |

### Numerar

| Regulă | Prag |
|---|---|
| Plăți cash între PJ / zi / furnizor | **1.000 RON** |
| Plăți cash între PJ / zi / total | **5.000 RON** |

### AML

| Regulă | Prag |
|---|---|
| Raportare automată tranzacții cash | ≥ **10.000 EUR** |
| KYC obligatoriu tranzacție ocazională | ≥ **15.000 EUR** |
| Prag beneficiar real (control) | > **25%** capital social |

### Creanțe neperformante (deductibilitate)

| Regulă | Prag |
|---|---|
| Creanță mică (deductibilă cu condiții simplificate) | ≤ **1.000 RON**, vechime > **270 zile** |

---

## 3. TERMENE DE DEPUNERE

### Lunare

| Declarație | Termen | Conținut |
|---|---|---|
| D300 (Decont TVA) | **25 ale lunii următoare** | TVA colectată, deductibilă, de plată/recuperat |
| D112 (Contribuții salariale) | **25 ale lunii următoare** | CAS, CASS, impozit salariu, CAM |
| D390 (Recapitulativ intra-UE) | **25 ale lunii următoare** | Livrări/achiziții intracomunitare |
| D406 / SAF-T | **25 ale lunii următoare** (lunar sau trimestrial) | Export complet contabilitate |

### Trimestriale

| Declarație | Termene | Conținut |
|---|---|---|
| D100 (Impozit micro / trimestrial) | **25 apr / 25 iul / 25 oct / 25 ian** | Impozit microîntreprindere |
| Plata impozit pe profit (trimestrial) | **25 apr / 25 iul / 25 oct / 25 ian** | Avans impozit profit |
| Plata impozit dividende | **25 ale lunii următoare trimestrului** | Impozit reținut la sursă |

### Anuale

| Declarație / Obligație | Termen |
|---|---|
| D101 (Impozit profit anual) | **25 martie** |
| Situații financiare anuale | **31 mai** (150 zile de la 31 decembrie) |
| AGA ordinară | în primele **5 luni** de la închiderea exercițiului |

### La eveniment

| Eveniment | Termen |
|---|---|
| Înregistrare TVA la depășire plafon | **10 zile** de la depășire |
| Upload e-Factura în SPV | **5 zile lucrătoare** de la emitere |
| Transmitere Revisal — angajare nouă | cu cel puțin **1 zi lucrătoare** înainte de începerea activității |
| Transmitere Revisal — încetare CIM | cel târziu **la data încetării** |
| Raportare tranzacție suspectă (STR) | **24 ore** de la luarea la cunoștință |
| Contestație act administrativ fiscal | **45 zile** de la comunicare |

---

## 4. DURATE LEGALE

### Prescripție și arhivare

| Regulă | Durată |
|---|---|
| Prescripție drept stabilire creanțe fiscale | **5 ani** |
| Prescripție în caz de evaziune fiscală | **10 ani** |
| Prescripție drept executare silită | **5 ani** |
| Arhivare situații financiare | **10 ani** |
| Arhivare registre contabile | **10 ani** |
| Arhivare documente justificative | **10 ani** |
| Arhivare state de plată | **50 ani** |
| Păstrare evidențe AML/KYC | **5 ani** de la încetarea relației |
| Reportare pierdere fiscală | **7 ani** (cu limitare procentuală anuală — verificați forma actuală a art. 31 CF) |

### Inspecție fiscală

| Categorie contribuabil | Durată maximă |
|---|---|
| Contribuabili mari | **180 zile** calendaristice |
| Contribuabili mijlocii | **90 zile** calendaristice |
| Alți contribuabili | **45 zile** calendaristice |

### Ajustare TVA bunuri de capital

| Tip bun | Perioadă ajustare |
|---|---|
| Bunuri mobile | **5 ani** |
| Bunuri imobile | **20 ani** |

### Reevaluare clădiri

| Regulă | Durată |
|---|---|
| Interval maxim fără suprataxare | **5 ani** |

### Muncă

| Regulă | Durată |
|---|---|
| Program normal | **8 ore/zi**, **40 ore/săptămână** |
| Ore suplimentare maxim | **8 ore/săptămână** (total max 48) |
| Contract determinat maxim | **36 luni** |
| Probă (execuție) | max **90 zile** calendaristice |
| Probă (conducere) | max **120 zile** calendaristice |
| Concediu odihnă minim | **20 zile lucrătoare/an** |
| Concediu maternitate | **126 zile** (63+63) |
| Concediu medical maxim | **183 zile/an** |
| Concediu creștere copil | până la **2 ani** (3 ani pt. handicap) |
| Preaviz demisie (execuție) | **20 zile lucrătoare** |
| Preaviz demisie (conducere) | **45 zile lucrătoare** |
| Preaviz concediere | **20 zile lucrătoare** |
| Concediu medical plătit de angajator | primele **5 zile** |

### Profesie

| Regulă | Durată |
|---|---|
| Stagiu expert contabil | **3 ani** |
| Formare profesională continuă | min. **40 ore/an** |
| Experiență tutore de stagiu | min. **5 ani** |

---

## 5. SANCȚIUNI

### Amenzi contabilitate (Legea 82/1991)

| Contravenție | Amendă |
|---|---|
| Neorganizarea contabilității | **1.000 – 10.000 RON** |
| Neîntocmirea/nedepunerea situațiilor financiare | **300 – 5.000 RON** |
| Neefectuarea inventarierii | **400 – 5.000 RON** |
| Prezentarea de date necorespunzătoare realității | **400 – 5.000 RON** |
| Nerespectarea regulilor privind registrele | **300 – 4.000 RON** |
| Nerespectarea regulilor de arhivare | **300 – 4.000 RON** |

### Amenzi fiscale (CPF)

| Contravenție | Amendă |
|---|---|
| Nedepunerea declarațiilor la termen | **1.000 – 5.000 RON** |
| Nedepunerea declarațiilor informative | **500 – 1.000 RON** |
| Nerespectarea obligației de informare | **2.000 – 5.000 RON** |
| Obstrucționarea inspecției | **2.000 – 5.000 RON** |
| Neinstalarea casei de marcat | **8.000 – 10.000 RON** |

### Amenzi e-Factura / e-Transport

| Contravenție | Amendă |
|---|---|
| Netransmiterea e-Factura (PJ) | **5.000 – 10.000 RON** |
| Transport fără UIT | **10.000 – 50.000 RON** + risc confiscare |

### Amenzi Revisal

| Contravenție | Amendă |
|---|---|
| Netransmiterea la termen | **5.000 – 8.000 RON / salariat** |
| Completare eronată | **5.000 – 8.000 RON** |
| Refuz prezentare la control | **10.000 – 20.000 RON** |

### Amenzi AML

| Contravenție | PF | PJ |
|---|---|---|
| Neaplicare KYC | 5.000 – 30.000 | 25.000 – 150.000 |
| Neraportare tranzacții suspecte | 15.000 – 50.000 | 50.000 – 500.000 |
| Neraportare cash ≥ 10.000 EUR | 10.000 – 30.000 | 25.000 – 150.000 |

---

## 6. ISTORIC COTE (pentru referință)

| Element | Pre-2023 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|
| Impozit pe profit | 16% | 16% | 16% | 16% | **16%** |
| Impozit dividende | 5% (pre-2023) | 8% | 10% | 10% | **16%** |
| TVA standard | 19% | 19% | 19% | 19%→21% (1 iul) | **21%** |
| TVA redus (alimente etc.) | 9% | 9% | 9% | 9%→11% (1 iul) | **11%** |
| TVA redus (cărți etc.) | 5% | 5% | 5% | 5%→11% (1 iul) | **11%** |
| Prag scutire TVA | 300k RON | 300k RON | 300k RON | 300k→395k (1 sept) | **395k RON** |
| CAS | 25% | 25% | 25% | 25% | **25%** |
| CASS | 10% | 10% | 10% | 10% | **10%** |
| CAM | 2,25% | 2,25% | 2,25% | 2,25% | **2,25%** |
| Impozit salariu | 10% | 10% | 10% | 10% | **10%** |
| Prag micro | 500k EUR | 500k EUR | 250k EUR | 250k EUR | **100k EUR** |
| Prag TVA | 300k RON | 300k RON | 300k RON | 300k→395k (sept) | **395k RON** |
| Salariu minim brut | 2.550-3.000 | 3.000 | 3.300 | 3.700 | **4.050** (ian-iun) / **4.325** (iul-dec) |

---

## REGULA DE ACTUALIZARE

La începutul fiecărui an fiscal (ianuarie):
1. Verifică OUG-urile și legile publicate în Monitorul Oficial în decembrie
2. Actualizează cotele, pragurile și termenele din acest fișier
3. Actualizează secțiunea 6 (istoric) cu coloana anului precedent
4. Verifică dacă `[VERIFY]` tags din alte fișiere se referă la valori care s-au schimbat
5. Actualizează numele fișierului: `constante-fiscale-{AN}.md`
