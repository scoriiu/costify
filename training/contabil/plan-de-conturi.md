# Planul de Conturi General -- Romanian Chart of Accounts

Based on OMFP 1802/2014, Anexa -- Reglementari contabile privind situatiile financiare anuale individuale si situatiile financiare anuale consolidate.

This is the complete Romanian Chart of Accounts that Costify must implement for transaction classification.

---

## Clasa 1 -- Conturi de Capitaluri (Capital Accounts)

Functiune: Predominantly CREDIT (pasiv). Debited when capital decreases.

### Grupa 10 -- Capital si Rezerve

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 101 | Capital social | P (Credit) | Share capital |
| 1011 | Capital subscris nevarsat | P | Subscribed unpaid capital |
| 1012 | Capital subscris varsat | P | Subscribed paid capital |
| 104 | Prime de capital | P | Share premium |
| 1041 | Prime de emisiune | P | Issuance premium |
| 1042 | Prime de fuziune/divizare | P | Merger/division premium |
| 1043 | Prime de aport | P | Contribution premium |
| 1044 | Prime de conversie a obligatiunilor in actiuni | P | Bond conversion premium |
| 105 | Rezerve din reevaluare | P | Revaluation reserves |
| 106 | Rezerve | P | Reserves |
| 1061 | Rezerve legale | P | Legal reserves |
| 1063 | Rezerve statutare sau contractuale | P | Statutory reserves |
| 1068 | Alte rezerve | P | Other reserves |
| 107 | Rezerve din conversie | A/P (Bifunctional) | Translation reserves |
| 108 | Interese care nu controleaza | P | Non-controlling interests |
| 109 | Actiuni proprii | A (Debit) | Treasury shares |
| 1091 | Actiuni proprii detinute pe termen scurt | A | Short-term treasury shares |
| 1092 | Actiuni proprii detinute pe termen lung | A | Long-term treasury shares |

### Grupa 11 -- Rezultatul Reportat

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 117 | Rezultatul reportat | A/P | Retained earnings |
| 1171 | Rezultatul reportat reprezentand profitul nerepartizat sau pierderea neacoperita | A/P | Undistributed profit/uncovered loss |
| 1174 | Rezultatul reportat provenit din corectarea erorilor contabile | A/P | Retained earnings from error corrections |
| 1175 | Rezultatul reportat reprezentand surplusul realizat din rezerve din reevaluare | P | Realized revaluation surplus |
| 1176 | Rezultatul reportat provenit din trecerea la aplicarea reglementarilor contabile | A/P | IFRS transition adjustments |

### Grupa 12 -- Rezultatul Exercitiului

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 121 | Profit sau pierdere | A/P | Profit or loss |
| 129 | Repartizarea profitului | A | Profit distribution |

### Grupa 15 -- Provizioane

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 151 | Provizioane | P | Provisions |
| 1511 | Provizioane pentru litigii | P | Litigation provisions |
| 1512 | Provizioane pentru garantii acordate clientilor | P | Warranty provisions |
| 1513 | Provizioane pentru dezafectare imobilizari corporale | P | Decommissioning provisions |
| 1514 | Provizioane pentru restructurare | P | Restructuring provisions |
| 1515 | Provizioane pentru pensii si obligatii similare | P | Pension provisions |
| 1516 | Provizioane pentru impozite | P | Tax provisions |
| 1518 | Alte provizioane | P | Other provisions |

### Grupa 16 -- Imprumuturi si Datorii Asimilate

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 161 | Imprumuturi din emisiuni de obligatiuni | P | Bond loans |
| 162 | Credite bancare pe termen lung | P | Long-term bank loans |
| 166 | Datorii ce privesc imobilizarile financiare | P | Financial asset related debts |
| 167 | Alte imprumuturi si datorii asimilate | P | Other loans |
| 168 | Dobanzi aferente imprumuturilor si datoriilor asimilate | P | Interest on loans |
| 169 | Prime privind rambursarea obligatiunilor | A | Bond redemption premiums |

---

## Clasa 2 -- Conturi de Imobilizari (Fixed Asset Accounts)

Functiune: DEBIT (activ). Credited when assets are sold/disposed.

### Grupa 20 -- Imobilizari Necorporale

| Cont | Denumire | EN |
|------|----------|-----|
| 201 | Cheltuieli de constituire | Formation expenses |
| 203 | Cheltuieli de dezvoltare | Development costs |
| 205 | Concesiuni, brevete, licente, marci comerciale | Concessions, patents, licenses, trademarks |
| 2051 | Concesiuni, brevete, licente, marci comerciale si alte drepturi | Concessions, patents, licenses |
| 2052 | Programe informatice / Software | Software |
| 207 | Fond comercial | Goodwill |
| 208 | Alte imobilizari necorporale | Other intangible assets |

### Grupa 21 -- Imobilizari Corporale

| Cont | Denumire | EN |
|------|----------|-----|
| 211 | Terenuri si amenajari de terenuri | Land and land improvements |
| 2111 | Terenuri | Land |
| 2112 | Amenajari de terenuri | Land improvements |
| 212 | Constructii | Buildings |
| 213 | Instalatii tehnice si masini | Technical equipment and machinery |
| 2131 | Echipamente tehnologice | Technological equipment |
| 2132 | Aparate si instalatii de masurare | Measurement instruments |
| 2133 | Mijloace de transport | Vehicles |
| 214 | Mobilier, aparatura birotica | Furniture, office equipment |
| 215 | Investitii imobiliare | Investment property |
| 216 | Active biologice productive | Productive biological assets |
| 217 | Imobilizari corporale in curs de aprovizionare | Fixed assets in transit |
| 223 | Imobilizari in curs | Assets under construction |
| 224 | Avansuri acordate pentru imobilizari corporale | Advances for fixed assets |

### Grupa 26 -- Imobilizari Financiare

| Cont | Denumire | EN |
|------|----------|-----|
| 261 | Actiuni detinute la entitatile afiliate | Shares in affiliated entities |
| 263 | Actiuni detinute la entitatile asociate si entitatile controlate in comun | Associated/JV investments |
| 265 | Alte titluri imobilizate | Other long-term securities |
| 267 | Creante imobilizate | Long-term receivables |
| 269 | Varsaminte de efectuat pentru imobilizari financiare | Uncalled amounts on investments |

### Grupa 28 -- Amortizari privind Imobilizarile

| Cont | Denumire | EN |
|------|----------|-----|
| 280 | Amortizari privind imobilizarile necorporale | Intangible amortization |
| 2801 | Amortizarea cheltuielilor de constituire | Formation expenses amortization |
| 2803 | Amortizarea cheltuielilor de dezvoltare | Development costs amortization |
| 2805 | Amortizarea concesiunilor, brevetelor, licentelor | Patent/license amortization |
| 2807 | Amortizarea fondului comercial | Goodwill amortization |
| 2808 | Amortizarea altor imobilizari necorporale | Other intangibles amortization |
| 281 | Amortizari privind imobilizarile corporale | Tangible depreciation |
| 2811 | Amortizarea amenajarilor de terenuri | Land improvements depreciation |
| 2812 | Amortizarea constructiilor | Buildings depreciation |
| 2813 | Amortizarea instalatiilor si masinilor | Equipment depreciation |
| 2814 | Amortizarea altor imobilizari corporale | Other tangibles depreciation |

### Grupa 29 -- Ajustari pentru Depreciere

| Cont | Denumire | EN |
|------|----------|-----|
| 290 | Ajustari pentru deprecierea imobilizarilor necorporale | Intangible impairment |
| 291 | Ajustari pentru deprecierea imobilizarilor corporale | Tangible impairment |
| 293 | Ajustari pentru deprecierea imobilizarilor in curs | WIP impairment |
| 296 | Ajustari pentru pierderea de valoare a imobilizarilor financiare | Financial asset impairment |

---

## Clasa 3 -- Conturi de Stocuri si Productie in Curs (Inventory)

Functiune: DEBIT (activ).

### Grupa 30 -- Stocuri de Materii Prime si Materiale

| Cont | Denumire | EN |
|------|----------|-----|
| 301 | Materii prime | Raw materials |
| 302 | Materiale consumabile | Consumables |
| 3021 | Materiale auxiliare | Auxiliary materials |
| 3022 | Combustibili | Fuel |
| 3023 | Materiale pentru ambalat | Packing materials |
| 3024 | Piese de schimb | Spare parts |
| 3025 | Seminte si materiale de plantat | Seeds |
| 3028 | Alte materiale consumabile | Other consumables |
| 303 | Materiale de natura obiectelor de inventar | Small inventory items |
| 308 | Diferente de pret la materii prime si materiale | Price differences on materials |

### Grupa 33 -- Productie in Curs de Executie

| Cont | Denumire | EN |
|------|----------|-----|
| 331 | Produse in curs de executie | Work in progress |
| 332 | Lucrari si servicii in curs de executie | Services in progress |

### Grupa 34-35 -- Produse si Marfuri

| Cont | Denumire | EN |
|------|----------|-----|
| 341 | Semifabricate | Semi-finished goods |
| 345 | Produse finite | Finished goods |
| 346 | Produse reziduale | By-products |
| 348 | Diferente de pret la produse | Price differences on products |
| 351 | Materii prime si materiale aflate la terti | Materials at third parties |
| 354 | Produse aflate la terti | Products at third parties |
| 356 | Animale aflate la terti | Animals at third parties |
| 357 | Marfuri aflate la terti | Goods at third parties |
| 358 | Ambalaje aflate la terti | Packaging at third parties |
| 361 | Animale si pasari | Animals and birds |
| 371 | Marfuri | Merchandise/Goods for resale |
| 378 | Diferente de pret la marfuri | Price differences on merchandise |
| 381 | Ambalaje | Packaging |
| 388 | Diferente de pret la ambalaje | Price differences on packaging |

### Grupa 39 -- Ajustari pentru Deprecierea Stocurilor

| Cont | Denumire | EN |
|------|----------|-----|
| 391 | Ajustari pentru deprecierea materiilor prime | Raw materials impairment |
| 392 | Ajustari pentru deprecierea materialelor | Materials impairment |
| 393 | Ajustari pentru deprecierea productiei in curs | WIP impairment |
| 394 | Ajustari pentru deprecierea produselor | Products impairment |
| 395 | Ajustari pentru deprecierea stocurilor aflate la terti | Third-party stock impairment |
| 396 | Ajustari pentru deprecierea animalelor | Animals impairment |
| 397 | Ajustari pentru deprecierea marfurilor | Merchandise impairment |
| 398 | Ajustari pentru deprecierea ambalajelor | Packaging impairment |

---

## Clasa 4 -- Conturi de Terti (Third-Party / Receivables & Payables)

Functiune: BIFUNCTIONAL (A/P). Critical for Costify -- these track who owes what to whom.

### Grupa 40 -- Furnizori si Conturi Asimilate (Suppliers)

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 401 | Furnizori | P | Trade payables |
| 403 | Efecte de platit | P | Notes payable |
| 404 | Furnizori de imobilizari | P | Fixed asset suppliers |
| 405 | Efecte de platit pentru imobilizari | P | Notes payable for fixed assets |
| 408 | Furnizori - facturi nesosite | P | Accrued supplier invoices |
| 409 | Furnizori - debitori | A | Supplier advances / debit balances |
| 4091 | Furnizori - debitori pentru cumparari de bunuri si servicii | A | Advances to suppliers |
| 4092 | Furnizori - debitori pentru prestari de servicii | A | Service advance payments |

### Grupa 41 -- Clienti si Conturi Asimilate (Customers)

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 411 | Clienti | A | Trade receivables |
| 4111 | Clienti | A | Trade receivables |
| 4118 | Clienti incerti sau in litigiu | A | Doubtful receivables |
| 413 | Efecte de primit de la clienti | A | Notes receivable |
| 418 | Clienti - facturi de intocmit | A | Unbilled revenue |
| 419 | Clienti - creditori | P | Customer advances received |

### Grupa 42 -- Personal si Conturi Asimilate (Employees)

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 421 | Personal - salarii datorate | P | Salaries payable |
| 423 | Personal - ajutoare materiale datorate | P | Employee benefits payable |
| 424 | Prime reprezentand participarea personalului la profit | P | Profit-sharing payable |
| 425 | Avansuri acordate personalului | A | Salary advances |
| 426 | Drepturi de personal neridicate | P | Uncollected salaries |
| 427 | Retineri din salarii datorate tertilor | P | Salary deductions payable |
| 428 | Alte datorii si creante in legatura cu personalul | A/P | Other employee receivables/payables |

### Grupa 43 -- Asigurari Sociale, Protectia Sociala (Social Insurance)

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 431 | Asigurari sociale | P | Social security payable |
| 4311 | Contributia unitatii la asigurarile sociale (CAM) | P | Employer social contribution |
| 4312 | Contributia personalului la asigurarile sociale (CAS) | P | Employee pension contribution |
| 4313 | Contributia angajatorului pentru asigurari sociale de sanatate | P | Employer health contribution |
| 4314 | Contributia angajatilor pentru asigurari sociale de sanatate (CASS) | P | Employee health contribution |
| 437 | Ajutor de somaj | P | Unemployment fund |
| 438 | Alte datorii si creante sociale | A/P | Other social receivables/payables |

### Grupa 44 -- Bugetul Statului (State Budget / Taxes)

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 441 | Impozitul pe profit / venit | P | Income/profit tax payable |
| 4411 | Impozitul pe profit | P | Profit tax |
| 4418 | Impozitul pe venit microintreprinderi | P | Micro-enterprise tax |
| 442 | Taxa pe valoarea adaugata | A/P | VAT |
| 4423 | TVA de plata | P | VAT payable |
| 4424 | TVA de recuperat | A | VAT receivable |
| 4426 | TVA deductibila | A | Input VAT (deductible) |
| 4427 | TVA colectata | P | Output VAT (collected) |
| 4428 | TVA neexigibila | A/P | Non-due VAT |
| 444 | Impozitul pe venituri de natura salariilor | P | Payroll income tax |
| 445 | Subventii | A | Subsidies receivable |
| 446 | Alte impozite, taxe si varsaminte asimilate | P | Other taxes payable |
| 447 | Fonduri speciale - taxe si varsaminte asimilate | P | Special funds |
| 448 | Alte datorii si creante cu bugetul statului | A/P | Other state budget items |
| 4481 | Alte datorii fata de bugetul statului | P | Other state debts |
| 4482 | Alte creante privind bugetul statului | A | Other state receivables |

### Grupa 45 -- Grup si Asociati

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 451 | Decontari intre entitatile afiliate | A/P | Intercompany settlements |
| 453 | Decontari privind interesele de participare | A/P | Participation interests |
| 455 | Sume datorate asociatilor | P | Amounts owed to shareholders |
| 456 | Decontari cu asociatii privind capitalul | A/P | Capital settlements with shareholders |
| 457 | Dividende de plata | P | Dividends payable |
| 458 | Decontari din operatiuni in participatie | A/P | Joint operation settlements |

### Grupa 46-47 -- Debitori si Creditori Diversi

| Cont | Denumire | Functiune | EN |
|------|----------|-----------|-----|
| 461 | Debitori diversi | A | Sundry debtors |
| 462 | Creditori diversi | P | Sundry creditors |
| 471 | Cheltuieli inregistrate in avans | A | Prepaid expenses |
| 472 | Venituri inregistrate in avans | P | Deferred income |
| 473 | Decontari din operatii in curs de clarificare | A/P | Pending transactions |

### Grupa 49 -- Ajustari pentru Deprecierea Creantelor

| Cont | Denumire | EN |
|------|----------|-----|
| 491 | Ajustari pentru deprecierea creantelor - clienti | Customer receivable impairment |
| 495 | Ajustari pentru deprecierea creantelor - decontari in grup | Group receivable impairment |
| 496 | Ajustari pentru deprecierea creantelor - debitori diversi | Sundry debtor impairment |

---

## Clasa 5 -- Conturi de Trezorerie (Treasury / Cash & Bank)

Functiune: DEBIT (activ). These are the accounts Costify connects to bank feeds.

### Grupa 50 -- Investitii pe Termen Scurt

| Cont | Denumire | EN |
|------|----------|-----|
| 501 | Actiuni detinute la entitatile afiliate | Short-term shares in affiliates |
| 505 | Obligatiuni emise si rascumparate | Redeemed bonds |
| 506 | Obligatiuni | Bonds held |
| 508 | Alte investitii pe termen scurt si creante asimilate | Other short-term investments |
| 509 | Varsaminte de efectuat pentru investitii pe termen scurt | Uncalled short-term investments |

### Grupa 51 -- Conturi la Banci (Bank Accounts) -- CRITICAL FOR COSTIFY

| Cont | Denumire | EN |
|------|----------|-----|
| 511 | Valori de incasat | Values for collection |
| 5112 | Cecuri de incasat | Checks for collection |
| 5113 | Efecte de incasat | Notes for collection |
| 5114 | Efecte remise spre scontare | Notes sent for discount |
| **512** | **Conturi curente la banci** | **Current bank accounts** |
| **5121** | **Conturi la banci in lei** | **Bank accounts in RON** |
| **5124** | **Conturi la banci in valuta** | **Bank accounts in foreign currency** |
| 5125 | Sume in curs de decontare | Amounts in transit |
| 519 | Credite bancare pe termen scurt | Short-term bank loans |
| 5191 | Credite bancare pe termen scurt | Short-term bank credits |
| 5192 | Credite bancare pe termen scurt nerambursate la scadenta | Overdue short-term bank credits |
| 5198 | Dobanzi aferente creditelor bancare pe termen scurt | Interest on short-term bank credits |

### Grupa 53 -- Casa (Cash)

| Cont | Denumire | EN |
|------|----------|-----|
| **531** | **Casa** | **Petty cash** |
| **5311** | **Casa in lei** | **Cash in RON** |
| **5314** | **Casa in valuta** | **Cash in foreign currency** |
| 532 | Alte valori | Other valuables |
| 5321 | Timbre fiscale si postale | Fiscal/postal stamps |
| 5322 | Bilete de tratament si odihna | Treatment/vacation vouchers |
| 5323 | Tichete si bilete de calatorie | Travel tickets |
| 5328 | Alte valori | Other valuables |

### Grupa 54 -- Acreditive

| Cont | Denumire | EN |
|------|----------|-----|
| 541 | Acreditive | Letters of credit |
| 5411 | Acreditive in lei | Letters of credit in RON |
| 5414 | Acreditive in valuta | Letters of credit in foreign currency |

### Grupa 58 -- Viramente Interne

| Cont | Denumire | EN |
|------|----------|-----|
| 581 | Viramente interne | Internal transfers |

### Grupa 59 -- Ajustari pentru Pierderea de Valoare

| Cont | Denumire | EN |
|------|----------|-----|
| 591 | Ajustari pentru pierderea de valoare a actiunilor | Short-term share impairment |
| 595 | Ajustari pentru pierderea de valoare a obligatiunilor | Bond impairment |
| 596 | Ajustari pentru pierderea de valoare a altor investitii pe termen scurt | Other investment impairment |

---

## Clasa 6 -- Conturi de Cheltuieli (Expense Accounts)

Functiune: DEBIT. Closed to 121 (Profit/Loss) at year-end.

### Grupa 60 -- Cheltuieli cu Materiile Prime si Materialele

| Cont | Denumire | EN |
|------|----------|-----|
| 601 | Cheltuieli cu materiile prime | Raw materials expense |
| 602 | Cheltuieli cu materialele consumabile | Consumables expense |
| 6021 | Cheltuieli cu materialele auxiliare | Auxiliary materials expense |
| 6022 | Cheltuieli privind combustibilul | Fuel expense |
| 6023 | Cheltuieli privind materialele pentru ambalat | Packing materials expense |
| 6024 | Cheltuieli privind piesele de schimb | Spare parts expense |
| 6025 | Cheltuieli privind semintele | Seeds expense |
| 6028 | Cheltuieli privind alte materiale consumabile | Other consumables expense |
| 603 | Cheltuieli privind materialele de natura obiectelor de inventar | Small inventory items expense |
| 604 | Cheltuieli privind materialele nestocate | Non-stocked materials expense |
| 605 | Cheltuieli privind energia si apa | Energy and water expense |
| 606 | Cheltuieli privind animalele si pasarile | Animal expense |
| 607 | Cheltuieli privind marfurile | Cost of goods sold |
| 608 | Cheltuieli privind ambalajele | Packaging expense |

### Grupa 61 -- Cheltuieli cu Serviciile Externe

| Cont | Denumire | EN |
|------|----------|-----|
| 611 | Cheltuieli cu intretinerea si reparatiile | Maintenance and repair |
| 612 | Cheltuieli cu redeventele, locatiile de gestiune si chiriile | Royalties, rents |
| 613 | Cheltuieli cu primele de asigurare | Insurance premiums |
| 614 | Cheltuieli cu studiile si cercetarile | Research expenses |

### Grupa 62 -- Cheltuieli cu Alte Servicii Executate de Terti

| Cont | Denumire | EN |
|------|----------|-----|
| 621 | Cheltuieli cu colaboratorii | Collaborator/subcontractor expense |
| 622 | Cheltuieli privind comisioanele si onorariile | Commissions and fees |
| 623 | Cheltuieli de protocol, reclama si publicitate | Entertainment, advertising |
| 624 | Cheltuieli cu transportul de bunuri si personal | Transport expense |
| 625 | Cheltuieli cu deplasari, detasari si transferari | Travel expense |
| 626 | Cheltuieli postale si taxe de telecomunicatii | Postal and telecom |
| 627 | Cheltuieli cu serviciile bancare si asimilate | Banking service fees |
| 628 | Alte cheltuieli cu serviciile executate de terti | Other third-party services |

### Grupa 63 -- Cheltuieli cu Alte Impozite

| Cont | Denumire | EN |
|------|----------|-----|
| 635 | Cheltuieli cu alte impozite, taxe si varsaminte asimilate | Other taxes and duties |

### Grupa 64 -- Cheltuieli cu Personalul

| Cont | Denumire | EN |
|------|----------|-----|
| 641 | Cheltuieli cu salariile personalului | Salary expense |
| 642 | Cheltuieli cu tichetele de masa acordate salariatilor | Meal voucher expense |
| 643 | Cheltuieli cu primele datorate de angajator | Employer bonus expense |
| 644 | Cheltuieli cu remunerarea in instrumente de capitaluri proprii | Share-based payment expense |
| 645 | Cheltuieli privind asigurarile si protectia sociala | Social insurance expense |
| 6451 | Cheltuieli privind contributia unitatii la asigurarile sociale | Employer social contribution expense |
| 6452 | Cheltuieli privind contributia unitatii la ajutor de somaj | Employer unemployment expense |
| 6453 | Cheltuieli privind contributia angajatorului pentru asigurari sociale de sanatate | Employer health expense |
| 6458 | Alte cheltuieli privind asigurarile si protectia sociala | Other social expenses |
| 646 | Cheltuieli cu contributia asiguratorie pentru munca (CAM) | Work insurance contribution |

### Grupa 65 -- Alte Cheltuieli de Exploatare

| Cont | Denumire | EN |
|------|----------|-----|
| 652 | Cheltuieli cu protectia mediului inconjurator | Environmental expense |
| 654 | Pierderi din creante si debitori diversi | Bad debt losses |
| 658 | Alte cheltuieli de exploatare | Other operating expenses |
| 6581 | Despagubiri, amenzi si penalitati | Fines and penalties |
| 6582 | Donatii acordate | Donations given |
| 6583 | Cheltuieli privind activele cedate si alte operatii de capital | Asset disposal losses |
| 6588 | Alte cheltuieli de exploatare | Other operating expenses |

### Grupa 66 -- Cheltuieli Financiare

| Cont | Denumire | EN |
|------|----------|-----|
| 663 | Pierderi din creante legate de participatii | Participation losses |
| 664 | Cheltuieli privind investitiile financiare cedate | Investment disposal losses |
| 665 | Cheltuieli din diferente de curs valutar | Foreign exchange losses |
| 666 | Cheltuieli privind dobanzile | Interest expense |
| 667 | Cheltuieli privind sconturile acordate | Discounts granted |
| 668 | Alte cheltuieli financiare | Other financial expenses |

### Grupa 68 -- Cheltuieli cu Amortizarile, Provizioanele si Ajustarile

| Cont | Denumire | EN |
|------|----------|-----|
| 681 | Cheltuieli de exploatare privind amortizarile, provizioanele si ajustarile pentru depreciere | Depreciation and impairment |
| 6811 | Cheltuieli de exploatare privind amortizarea imobilizarilor | Depreciation expense |
| 6812 | Cheltuieli de exploatare privind provizioanele | Provision expense |
| 6813 | Cheltuieli de exploatare privind ajustarile pentru deprecierea imobilizarilor | Impairment expense |
| 6814 | Cheltuieli de exploatare privind ajustarile pentru deprecierea activelor circulante | Current asset impairment |
| 686 | Cheltuieli financiare privind amortizarile si ajustarile pentru pierderea de valoare | Financial amortization/impairment |

### Grupa 69 -- Cheltuieli cu Impozitul pe Profit si Alte Impozite

| Cont | Denumire | EN |
|------|----------|-----|
| 691 | Cheltuieli cu impozitul pe profit | Income tax expense |
| 698 | Cheltuieli cu impozitul pe venit al microintreprinderii | Micro-enterprise tax expense |

---

## Clasa 7 -- Conturi de Venituri (Revenue Accounts)

Functiune: CREDIT. Closed to 121 (Profit/Loss) at year-end.

### Grupa 70 -- Venituri din Vanzari (Sales Revenue)

| Cont | Denumire | EN |
|------|----------|-----|
| 701 | Venituri din vanzarea produselor finite | Finished goods sales |
| 702 | Venituri din vanzarea semifabricatelor | Semi-finished goods sales |
| 703 | Venituri din vanzarea produselor reziduale | By-product sales |
| 704 | Venituri din lucrari executate si servicii prestate | Service revenue |
| 705 | Venituri din studii si cercetari | Research revenue |
| 706 | Venituri din redevente, locatii de gestiune si chirii | Rental/royalty income |
| 707 | Venituri din vanzarea marfurilor | Merchandise sales |
| 708 | Venituri din activitati diverse | Other activity revenue |

### Grupa 71 -- Variatia Stocurilor

| Cont | Denumire | EN |
|------|----------|-----|
| 711 | Variatia stocurilor | Inventory changes |

### Grupa 72 -- Venituri din Productia de Imobilizari

| Cont | Denumire | EN |
|------|----------|-----|
| 721 | Venituri din productia de imobilizari necorporale | Capitalized intangible production |
| 722 | Venituri din productia de imobilizari corporale | Capitalized tangible production |

### Grupa 74 -- Venituri din Subventii de Exploatare

| Cont | Denumire | EN |
|------|----------|-----|
| 741 | Venituri din subventii de exploatare | Operating subsidy income |
| 7411 | Venituri din subventii de exploatare aferente cifrei de afaceri | Revenue-related subsidies |
| 7412 | Venituri din subventii de exploatare aferente materiilor prime si materialelor | Material-related subsidies |
| 7413 | Venituri din subventii de exploatare aferente altor cheltuieli externe | External cost subsidies |
| 7414 | Venituri din subventii de exploatare aferente cheltuielilor cu personalul | Personnel cost subsidies |
| 7415 | Venituri din subventii de exploatare aferente asigurarilor si protectiei sociale | Social insurance subsidies |
| 7416 | Venituri din subventii de exploatare aferente altor cheltuieli de exploatare | Other operating subsidies |
| 7417 | Venituri din subventii de exploatare in caz de calamitati | Calamity subsidies |
| 7418 | Venituri din subventii de exploatare pentru dobanda cuvenita | Interest subsidies |
| 7419 | Venituri din subventii de exploatare aferente altor venituri | Other revenue subsidies |

### Grupa 75 -- Alte Venituri din Exploatare

| Cont | Denumire | EN |
|------|----------|-----|
| 754 | Venituri din creante reactivate si debitori diversi | Recovered bad debts |
| 758 | Alte venituri din exploatare | Other operating income |
| 7581 | Venituri din despagubiri, amenzi si penalitati | Compensation/penalty income |
| 7582 | Venituri din donatii primite | Donations received |
| 7583 | Venituri din vanzarea activelor si alte operatii de capital | Asset disposal gains |
| 7584 | Venituri din subventii pentru investitii | Investment subsidy income |
| 7588 | Alte venituri din exploatare | Other operating income |

### Grupa 76 -- Venituri Financiare

| Cont | Denumire | EN |
|------|----------|-----|
| 761 | Venituri din imobilizari financiare | Financial asset income |
| 762 | Venituri din investitii financiare pe termen scurt | Short-term investment income |
| 763 | Venituri din creante imobilizate | Long-term receivable income |
| 764 | Venituri din investitii financiare cedate | Investment disposal gains |
| 765 | Venituri din diferente de curs valutar | Foreign exchange gains |
| 766 | Venituri din dobanzi | Interest income |
| 767 | Venituri din sconturi obtinute | Discounts received |
| 768 | Alte venituri financiare | Other financial income |

### Grupa 78 -- Venituri din Provizioane si Ajustari

| Cont | Denumire | EN |
|------|----------|-----|
| 781 | Venituri din provizioane si ajustari pentru depreciere privind activitatea de exploatare | Provision/impairment reversals |
| 786 | Venituri financiare din ajustari pentru pierderea de valoare | Financial impairment reversals |

---

## Clasa 8 -- Conturi Speciale (Off-Balance Sheet)

| Cont | Denumire | EN |
|------|----------|-----|
| 801 | Angajamente acordate | Commitments given |
| 802 | Angajamente primite | Commitments received |
| 8031 | Imobilizari corporale luate cu chirie | Leased tangible assets |
| 8032 | Valori materiale primite in custodie | Materials in custody |
| 8033 | Valori materiale primite in prelucrare | Materials for processing |
| 8034 | Debitori scosi din activ | Written-off debtors |
| 8035 | Stocuri de natura obiectelor de inventar date in folosinta | Inventory items in use |
| 8036 | Redevente, locatii de gestiune, chirii si alte datorii asimilate | Lease obligations |
| 8038 | Alte valori in afara bilantului | Other off-balance sheet items |
| 8039 | Credite restante | Overdue receivables |

---

## Clasa 9 -- Conturi de Gestiune Interna (Management Accounting)

These accounts are used for internal cost accounting (contabilitate de gestiune) and are not standardized -- each entity defines them based on their needs. Used for:
- Cost center tracking
- Activity-based costing
- Internal transfer pricing
- Budget vs actual analysis

Costify should model these as configurable per-tenant accounts.

---

## Account Function Quick Reference

| Class | Nature | Debit Increases | Credit Increases | Normal Balance |
|-------|--------|----------------|-----------------|----------------|
| 1 - Capital | Pasiv | Decrease | Increase | Credit |
| 2 - Fixed Assets | Activ | Increase | Decrease | Debit |
| 3 - Inventory | Activ | Increase | Decrease | Debit |
| 4 - Third Party | Bifunctional | Depends | Depends | Depends |
| 5 - Treasury | Activ | Increase | Decrease | Debit |
| 6 - Expenses | Activ | Increase | Decrease | Debit (zero at year-end) |
| 7 - Revenue | Pasiv | Decrease | Increase | Credit (zero at year-end) |
| 8 - Special | N/A | Record | Record | N/A |
| 9 - Management | N/A | Per entity | Per entity | N/A |
