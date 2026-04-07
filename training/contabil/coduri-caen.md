# Coduri CAEN Rev. 3 -- Romanian Economic Activity Classification

CAEN (Clasificarea Activitatilor din Economia Nationala) is Romania's implementation of NACE Rev. 2.1 (EU statistical classification). Every Romanian company has one or more CAEN codes that determine:
- Tax obligations and eligibility
- Micro-enterprise eligibility (certain CAEN codes are excluded)
- VAT rate applicability
- Specific regulatory requirements
- Reporting obligations

Costify must map each tenant's CAEN code(s) to determine applicable tax regime and classification rules.

---

## Structure

CAEN codes follow a hierarchical structure:
```
Section  (1 letter)    -> A
Division (2 digits)    -> 01
Group    (3 digits)    -> 011
Class    (4 digits)    -> 0111
```

---

## Complete CAEN Sections

### Section A -- Agricultura, Silvicultura si Pescuit (Agriculture, Forestry & Fishing)

| Division | Description | EN |
|----------|-------------|-----|
| 01 | Agricultura, vanatoare si servicii anexe | Agriculture, hunting, related services |
| 02 | Silvicultura si exploatare forestiera | Forestry and logging |
| 03 | Pescuitul si acvacultura | Fishing and aquaculture |

**Key classes:**
- 0111 Cultivarea cerealelor (Cereal farming)
- 0113 Cultivarea legumelor, radacinoaselor si tuberculilor (Vegetable growing)
- 0121 Cultivarea strugurilor (Grape growing)
- 0141 Cresterea bovinelor (Cattle farming)
- 0150 Activitati in ferme mixte (Mixed farming)
- 0161 Activitati auxiliare pentru productia vegetala (Crop support activities)

**Tax implications:** Income norms (norme de venit) apply for certain agricultural activities. Reduced 11% TVA on agricultural inputs.

---

### Section B -- Industria Extractiva (Mining and Quarrying)

| Division | Description |
|----------|-------------|
| 05 | Extractia carbunelui si lignitului |
| 06 | Extractia petrolului brut si a gazelor naturale |
| 07 | Extractia minereurilor metalifere |
| 08 | Alte activitati extractive |
| 09 | Activitati de servicii anexe extractiei |

---

### Section C -- Industria Prelucratoare (Manufacturing)

| Division | Description | EN |
|----------|-------------|-----|
| 10 | Industria alimentara | Food products |
| 11 | Fabricarea bauturilor | Beverages |
| 12 | Fabricarea produselor din tutun | Tobacco products |
| 13 | Fabricarea produselor textile | Textiles |
| 14 | Fabricarea articolelor de imbracaminte | Wearing apparel |
| 15 | Tabacirea si finisarea pieilor | Leather |
| 16 | Prelucrarea lemnului | Wood products |
| 17 | Fabricarea hartiei si a produselor din hartie | Paper products |
| 18 | Tiparire si reproducere pe suport | Printing |
| 19 | Fabricarea produselor de cocserie si a produselor obtinute din prelucrarea titeiului | Coke and petroleum |
| 20 | Fabricarea substantelor si a produselor chimice | Chemicals |
| 21 | Fabricarea produselor farmaceutice | Pharmaceuticals |
| 22 | Fabricarea produselor din cauciuc si mase plastice | Rubber and plastics |
| 23 | Fabricarea altor produse din minerale nemetalice | Non-metallic minerals |
| 24 | Metalurgia | Basic metals |
| 25 | Industria constructiilor metalice | Fabricated metals |
| 26 | Fabricarea calculatoarelor si a produselor electronice si optice | Computers and electronics |
| 27 | Fabricarea echipamentelor electrice | Electrical equipment |
| 28 | Fabricarea de masini, utilaje si echipamente n.c.a. | Machinery |
| 29 | Fabricarea autovehiculelor | Motor vehicles |
| 30 | Fabricarea altor mijloace de transport | Other transport equipment |
| 31 | Fabricarea de mobila | Furniture |
| 32 | Alte activitati industriale n.c.a. | Other manufacturing |
| 33 | Repararea, intretinerea si instalarea masinilor si echipamentelor | Repair and installation |

**Key classes for Costify clients:**
- 1071 Fabricarea painii si a produselor de patiserie (Bakery)
- 1072 Fabricarea biscuitilor si a produselor de patiserie (Biscuits/pastry)
- 2511 Fabricarea de constructii metalice (Metal structures)
- 2562 Operatiuni de mecanica generala (General mechanical operations)

---

### Section D -- Productia si Furnizarea de Energie (Electricity, Gas, Steam)

| Division | Description |
|----------|-------------|
| 35 | Productia si furnizarea de energie electrica si termica, gaze, apa calda si aer conditionat |

---

### Section E -- Distributia Apei; Salubritate (Water Supply, Sewerage, Waste)

| Division | Description |
|----------|-------------|
| 36 | Captarea, tratarea si distributia apei |
| 37 | Colectarea si epurarea apelor uzate |
| 38 | Colectarea, tratarea si eliminarea deseurilor; activitati de recuperare |
| 39 | Activitati si servicii de decontaminare |

---

### Section F -- Constructii (Construction)

| Division | Description | EN |
|----------|-------------|-----|
| 41 | Constructii de cladiri | Building construction |
| 42 | Lucrari de geniu civil | Civil engineering |
| 43 | Lucrari speciale de constructii | Specialized construction |

**Key classes:**
- 4110 Dezvoltare (promovare) imobiliara (Real estate development)
- 4120 Constructii de cladiri rezidentiale si nerezidentiale (Building construction)
- 4211 Constructii de drumuri si autostrazi (Road construction)
- 4321 Lucrari de instalatii electrice (Electrical installation)
- 4322 Lucrari de instalatii sanitare, de incalzire si de aer conditionat (Plumbing, HVAC)
- 4331 Lucrari de ipsoserie (Plastering)
- 4332 Lucrari de tamplarie si dulgherie (Joinery)
- 4334 Lucrari de vopsitorie si montari de geamuri (Painting, glazing)
- 4391 Lucrari de invelitori, sarpante si terase (Roofing)
- 4399 Alte lucrari speciale de constructii n.c.a. (Other construction)

**Tax note:** Construction sector subject to reverse charge TVA (taxare inversa) for B2B transactions between VAT payers.

---

### Section G -- Comert cu Ridicata si cu Amanuntul (Wholesale & Retail Trade)

| Division | Description | EN |
|----------|-------------|-----|
| 45 | Comertul cu ridicata si cu amanuntul al autovehiculelor | Motor vehicle trade |
| 46 | Comertul cu ridicata, cu exceptia autovehiculelor | Wholesale trade |
| 47 | Comertul cu amanuntul, cu exceptia autovehiculelor | Retail trade |

**Key classes:**
- 4511 Comert cu autoturisme si autovehicule usoare (Car dealership)
- 4520 Intretinerea si repararea autovehiculelor (Car repair)
- 4611 Intermedieri in comertul cu materii prime agricole (Agricultural commodities brokerage)
- 4619 Intermedieri in comertul cu produse diverse (General brokerage)
- 4631 Comert cu ridicata al fructelor si legumelor (Fruit/vegetable wholesale)
- 4641 Comert cu ridicata al produselor textile (Textile wholesale)
- 4711 Comert cu amanuntul in magazine nespecializate, cu vanzare predominanta de produse alimentare (Supermarkets)
- 4719 Comert cu amanuntul in magazine nespecializate (General retail)
- 4741 Comert cu amanuntul al calculatoarelor (Computer retail)
- 4771 Comert cu amanuntul al imbracamintei (Clothing retail)
- 4791 Intermedieri in comertul cu amanuntul nespecializat (E-commerce, marketplace)

**Tax note:** Retail requires fiscal cash registers (casa de marcat). E-commerce (4791) has specific VAT obligations.

---

### Section H -- Transport si Depozitare (Transportation & Storage)

| Division | Description | EN |
|----------|-------------|-----|
| 49 | Transporturi terestre si transporturi prin conducte | Land transport |
| 50 | Transporturi pe apa | Water transport |
| 51 | Transporturi aeriene | Air transport |
| 52 | Depozitare si activitati auxiliare pentru transporturi | Warehousing |
| 53 | Activitati de posta si de curier | Postal and courier |

**Key classes:**
- 4932 Transporturi cu taxiuri (Taxi)
- 4933 Transporturi terestre de pasageri cu vehicule cu sofer (Ride-sharing/chauffeur)
- 4941 Transporturi rutiere de marfuri (Road freight)
- 5210 Depozitari (Warehousing)
- 5320 Alte activitati postale si de curier (Courier services)

---

### Section I -- Hoteluri si Restaurante (Accommodation & Food Service)

| Division | Description | EN |
|----------|-------------|-----|
| 55 | Hoteluri si alte facilitati de cazare | Accommodation |
| 56 | Restaurante si alte activitati de servicii de alimentatie | Food and beverage service |

**Key classes:**
- 5510 Hoteluri si alte facilitati de cazare similare (Hotels)
- 5520 Facilitati de cazare pentru vacante (Holiday accommodation)
- 5530 Parcuri pentru rulote, campinguri (Camping)
- 5590 Alte servicii de cazare (Other accommodation)
- 5611 Restaurante (Restaurants)
- 5621 Activitati de alimentatie (catering) pentru evenimente (Event catering)
- 5629 Alte servicii de alimentatie n.c.a. (Other food service)
- 5630 Baruri si alte activitati de servire a bauturilor (Bars)

**Tax note:** Restaurant/catering services have 11% reduced TVA rate (excl. alcoholic beverages). Hotel accommodation has 11% TVA.

---

### Section J -- Activitati de Editare si Productie Media (Publishing & Broadcasting)

| Division | Description |
|----------|-------------|
| 58 | Activitati de editare |
| 59 | Activitati de productie cinematografica, video si de programe TV |
| 60 | Activitati de difuzare si transmitere de programe |

---

### Section K -- Telecomunicatii si IT (Telecom & IT)

| Division | Description | EN |
|----------|-------------|-----|
| 61 | Telecomunicatii | Telecommunications |
| 62 | Activitati de servicii in tehnologia informatiei | IT services |
| 63 | Activitati de servicii informatice | Information services |

**Key classes:**
- 6110 Activitati de telecomunicatii prin retele cu cablu (Wired telecom)
- 6120 Activitati de telecomunicatii prin retele fara cablu (Wireless telecom)
- 6190 Alte activitati de telecomunicatii (Other telecom)
- 6201 Activitati de realizare a softului la comanda (Custom software development)
- 6202 Activitati de consultanta in tehnologia informatiei (IT consulting)
- 6203 Activitati de management al mijloacelor de calcul (IT management)
- 6209 Alte activitati de servicii privind tehnologia informatiei (Other IT services)
- 6311 Prelucrarea datelor, administrarea paginilor web (Data processing, hosting)
- 6312 Activitati ale portalurilor web (Web portals)
- 6399 Alte activitati de servicii informatice n.c.a. (Other info services)

**Tax note:** IT sector employees with qualifying degrees benefit from income tax exemption on salaries (OUG 79/2023 conditions). CAEN 6201, 6202, 6209 are most common for IT exemption.

---

### Section L -- Intermedieri Financiare si Asigurari (Financial & Insurance)

| Division | Description |
|----------|-------------|
| 64 | Intermedieri financiare, cu exceptia activitatilor de asigurari si ale fondurilor de pensii |
| 65 | Asigurari, reasigurari si activitati ale fondurilor de pensii |
| 66 | Activitati auxiliare intermedierilor financiare si de asigurari |

**Tax note:** CAEN 64xx, 65xx, 66xx are EXCLUDED from micro-enterprise tax regime. Companies with these codes must apply profit tax (16%).

---

### Section M -- Tranzactii Imobiliare (Real Estate)

| Division | Description |
|----------|-------------|
| 68 | Tranzactii imobiliare |

**Key classes:**
- 6810 Cumpararea si vanzarea de bunuri imobiliare proprii (Own real estate buying/selling)
- 6820 Inchirierea si subinchirierea bunurilor imobiliare proprii sau inchiriate (Renting/leasing own property)
- 6831 Agentii imobiliare (Real estate agencies)
- 6832 Administrarea imobilelor pe baza de comision sau contract (Property management)

---

### Section N -- Activitati Profesionale, Stiintifice si Tehnice (Professional, Scientific, Technical)

| Division | Description | EN |
|----------|-------------|-----|
| 69 | Activitati juridice si de contabilitate | Legal and accounting |
| 70 | Activitati ale directiilor (centralelor) si de consultanta in management | Head offices, management consulting |
| 71 | Activitati de arhitectura si inginerie | Architecture and engineering |
| 72 | Cercetare-dezvoltare | R&D |
| 73 | Publicitate si cercetare de piata | Advertising and market research |
| 74 | Alte activitati profesionale, stiintifice si tehnice | Other professional activities |
| 75 | Activitati veterinare | Veterinary activities |

**Key classes:**
- 6910 Activitati juridice (Legal services)
- 6920 Activitati de contabilitate si audit financiar; consultanta in domeniul fiscal (Accounting, audit, tax)
- 7010 Activitati ale directiilor (centralelor) (Head offices)
- 7020 Activitati de consultanta in afaceri si management (Business/management consulting)
- 7111 Activitati de arhitectura (Architecture)
- 7112 Activitati de inginerie (Engineering)
- 7120 Activitati de testari si analize tehnice (Technical testing)
- 7311 Activitati ale agentiilor de publicitate (Advertising agencies)
- 7320 Activitati de studiere a pietei si de sondare a opiniei publice (Market research)
- 7410 Activitati de design specializat (Specialized design)
- 7420 Activitati fotografice (Photography)
- 7430 Activitati de traducere scris si oral (interpreti) (Translation)
- 7490 Alte activitati profesionale, stiintifice si tehnice n.c.a. (Other professional)

---

### Section O -- Activitati de Servicii Administrative (Administrative & Support)

| Division | Description | EN |
|----------|-------------|-----|
| 77 | Activitati de inchiriere si leasing | Rental and leasing |
| 78 | Activitati de servicii privind forta de munca | Employment activities |
| 79 | Activitati ale agentiilor turistice | Travel agency |
| 80 | Activitati de investigatii si protectie | Security and investigation |
| 81 | Activitati de peisagistica si servicii pentru cladiri | Landscape/building services |
| 82 | Activitati de secretariat, servicii-suport | Office admin, business support |

---

### Section P -- Administratie Publica (Public Administration)

| Division | Description |
|----------|-------------|
| 84 | Administratie publica si aparare; asigurari sociale din sistemul public |

---

### Section Q -- Invatamant (Education)

| Division | Description |
|----------|-------------|
| 85 | Invatamant |

**Key classes:**
- 8510 Invatamant prescolar (Pre-primary)
- 8520 Invatamant primar (Primary)
- 8531 Invatamant secundar general (General secondary)
- 8541 Invatamant superior non-universitar (Post-secondary non-tertiary)
- 8542 Invatamant superior (Tertiary)
- 8551 Invatamant in domeniul sportiv si recreational (Sports education)
- 8552 Invatamant in domeniul cultural (Cultural education)
- 8553 Activitati ale scolilor de conducere (Driving schools)
- 8559 Alte forme de invatamant n.c.a. (Other education - training, tutoring)

**Tax note:** Education services are VAT exempt (scutit fara drept de deducere) per Art. 292 Cod Fiscal.

---

### Section R -- Sanatate si Asistenta Sociala (Health & Social Work)

| Division | Description |
|----------|-------------|
| 86 | Activitati referitoare la sanatatea umana |
| 87 | Activitati de asistenta sociala cu cazare |
| 88 | Activitati de asistenta sociala fara cazare |

**Tax note:** Medical services are VAT exempt. Pharmaceutical products at 11% TVA.

---

### Section S -- Activitati de Spectacole, Culturale, Sportive (Arts, Entertainment, Recreation)

| Division | Description |
|----------|-------------|
| 90 | Activitati de creatie si interpretare artistica |
| 91 | Activitati ale bibliotecilor, arhivelor, muzeelor |
| 92 | Activitati de jocuri de noroc si pariuri |
| 93 | Activitati sportive, recreative si distractive |

**Tax note:** CAEN 92xx (gambling) is EXCLUDED from micro-enterprise regime.

---

### Section T -- Alte Activitati de Servicii (Other Service Activities)

| Division | Description |
|----------|-------------|
| 94 | Activitati asociative diverse |
| 95 | Reparatii de calculatoare, de bunuri personale si de uz gospodaresc |
| 96 | Alte activitati de servicii |

**Key classes:**
- 9511 Repararea calculatoarelor si a echipamentelor periferice (Computer repair)
- 9521 Repararea aparatelor electronice de uz casnic (Consumer electronics repair)
- 9601 Spalarea si curatarea (uscata) a articolelor textile si a produselor din blana (Laundry)
- 9602 Coafura si alte activitati de infrumusetare (Hairdressing, beauty)
- 9604 Activitati de intretinere corporala (Spa, wellness)
- 9609 Alte activitati de servicii n.c.a. (Other services)
- 9699 Alte servicii personale n.c.a. (Other personal services)

---

### Section U -- Activitati ale Gospodariilor Private (Household Activities)

| Division | Description |
|----------|-------------|
| 97 | Activitati ale gospodariilor private in calitate de angajator |
| 98 | Activitati ale gospodariilor private de producere de bunuri si servicii |

---

### Section V -- Activitati ale Organizatiilor Extrateritoriale

| Division | Description |
|----------|-------------|
| 99 | Activitati ale organizatiilor si organismelor extrateritoriale |

---

## CAEN Codes Excluded from Micro-Enterprise Regime

Per Art. 47 Cod Fiscal, the following CAEN codes CANNOT apply micro-enterprise tax:

| CAEN | Activity | Reason |
|------|----------|--------|
| 6411 | Activitati ale bancilor centrale | Banking |
| 6419 | Alte activitati de intermedieri monetare | Banking |
| 6491 | Leasing financiar | Financial leasing |
| 6492 | Alte activitati de creditare | Credit activities |
| 6499 | Alte intermedieri financiare n.c.a. | Other financial |
| 6511 | Asigurari de viata | Life insurance |
| 6512 | Alte activitati de asigurare | Other insurance |
| 6520 | Reasigurari | Reinsurance |
| 6530 | Fonduri de pensii | Pension funds |
| 6611-6629 | Activitati auxiliare financiare | Financial auxiliary |
| 9200 | Activitati de jocuri de noroc si pariuri | Gambling |

Companies with these CAEN codes must apply the 16% profit tax regime regardless of revenue.

---

## CAEN and TVA Rate Mapping

| CAEN Sector | Default TVA | Notes |
|---|---|---|
| 01xx Agriculture | 11% on inputs | Reverse charge on cereals/industrial crops |
| 10xx-11xx Food/Beverage manufacturing | 11% on food products | Excl. alcoholic, sugary drinks |
| 41xx-43xx Construction | 21% standard / 11% social housing | Reverse charge B2B |
| 47xx Retail | Rate of product sold | Cash register required |
| 55xx Accommodation | 11% | |
| 56xx Food service/Restaurants | 11% | Excl. alcoholic beverages (21%) |
| 62xx IT services | 21% standard | Export of services = outside scope |
| 6920 Accounting | 21% standard | |
| 85xx Education | Exempt | No TVA charged |
| 86xx Healthcare | Exempt | No TVA charged |
| 64xx-65xx Financial/Insurance | Exempt | No TVA charged |

---

## Costify CAEN Integration

For each tenant (client organization), Costify stores:
```typescript
interface TenantCAEN {
  tenantId: string
  primaryCAEN: string        // Main activity code (e.g., "6201")
  secondaryCAEN: string[]    // Additional activity codes
  taxRegime: 'micro' | 'profit'  // Determined by CAEN + revenue
  vatRegistered: boolean
  vatRate: number            // Default TVA rate for main activity
  excludedFromMicro: boolean // Based on CAEN code
  specialRegimes: string[]   // E.g., "construction_reverse_charge", "it_tax_exempt"
}
```
