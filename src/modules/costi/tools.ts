import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const COSTI_TOOLS: Tool[] = [
  {
    name: "list_clients",
    description: "Listeaza toti clientii (firmele) utilizatorului curent cu numarul de intrari in jurnal",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_client_kpis",
    description: "Obtine indicatorii financiari (KPI) pentru un client: cash, creante, datorii, TVA, venituri, cheltuieli, rezultat, marja",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului (ex: 'Digital Nomads SRL')" },
        year: { type: "number", description: "Anul (ex: 2025)" },
        month: { type: "number", description: "Luna (1-12)" },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_balance",
    description: "Obtine balanta de verificare pentru un client: lista conturilor cu solduri initiale, rulaje, solduri finale",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul" },
        month: { type: "number", description: "Luna (1-12)" },
        account_prefix: { type: "string", description: "Filtru optional pe prefix cont (ex: '401' pentru furnizori, '7' pentru venituri)" },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_cpp",
    description: "Obtine Contul de Profit si Pierdere pentru un client. Default 'simplified' returneaza o linie per cont contribuabil, grupat pe cele 4 sectiuni CPP (venituri/cheltuieli exploatare/financiare). 'f20' returneaza randurile formularului oficial F20 (rd.01-35, cu sub-randuri 13a-e, 14a-b, 15a-b, 16a-b, 17a-d, 18a-b) conform OMFP 1802 Anexa 3 — util cand contabilul intreaba cum arata CPP-ul la depunere sau vrea sa verifice suma unui rand specific din declaratie.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul" },
        month: { type: "number", description: "Luna (1-12)" },
        mode: {
          type: "string",
          description: "Modul de afisare: 'simplified' (default) sau 'f20' pentru formatul detaliat ANAF",
          enum: ["simplified", "f20"],
        },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_journal_entries",
    description: "Cauta intrari in registrul jurnal pentru un client, cu filtre pe cont, explicatie, sau perioada",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        account: { type: "string", description: "Filtru pe cont debit sau credit (ex: '401.00010')" },
        search: { type: "string", description: "Cautare in explicatie (ex: 'ORANGE')" },
        year: { type: "number", description: "Filtru pe an" },
        month: { type: "number", description: "Filtru pe luna" },
        limit: { type: "number", description: "Numar maxim de rezultate (default 20, max 50)" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_available_periods",
    description: "Listeaza perioadele (an/luna) disponibile in jurnalul unui client",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_unmapped_accounts",
    description: "Listeaza conturile dintr-un client care nu sunt in planul standard OMFP 1802 (marcate cu triunghi galben in UI). Util cand contabilul intreaba 'ce conturi am nemapate?' sau 'de ce apare warning la contul X?'. Returneaza codul, denumirea curenta (din Saga sau prefix parinte), soldurile si numarul de intrari in jurnal.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul perioadei analizate" },
        month: { type: "number", description: "Luna perioadei (1-12)" },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_tax_regime_timeline",
    description: "Returneaza istoricul regimurilor fiscale detectate automat din registru jurnal — fiecare tranzitie (data start, regim, motiv, nivel de incredere, avertismente). Util cand contabilul intreaba 'ce regim are clientul X' sau 'cand a trecut firma de la micro la profit'. Regimul este dedus din contul de impozit folosit in jurnal: 691/4411 = profit standard 16%, 698/4418 = micro (1% daca exista salarii pe 421, altfel 3%), 697/4418 = IMCA, 695 = HoReCa. Tranzitiile se snap la 1 ianuarie (regim fiscal romanesc se schimba la inceput de an). Pentru un raport CPP pe luna X, regimul valabil este cea mai recenta tranzitie detectata cu startDate <= ultima zi a lunii X. Costify NU mai stocheaza regimul manual — sursa unica de adevar este jurnalul. Daca jurnalul nu are inca acumulare de impozit pe perioada respectiva (firma noua, primul trimestru), regimul cade pe fallback (profit_standard).",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_industry_kpis",
    description:
      "Obtine catalogul de KPI specifici industriei pentru un client (tab-ul KPI din UI si sectiunea 'Indicatorii afacerii tale' de pe /firma). Returneaza KPI esentiali (marje, lichiditate, DSO/DPO/DIO, indatorare, crestere) plus grupul specific industriei (consultanta/retail/telecom/banking/contabilitate/inchirieri), cu valoarea, formula, valorile de intrare folosite in calcul, pragurile (tinta/alarma, ajustate pe industrie) si starea semafor (good/warn/danger). Valorile sunt cumulate ianuarie -> luna selectata; indicatorii anuali sunt anualizati. Industria e detectata automat din CAEN, setata manual in Setari sau dedusa din mixul de venituri al jurnalului (fallback). Raspunsul include 'journalHint' cand jurnalul contrazice industria configurata (ex. profil consultanta dar venituri majoritare din 707 comert). Util cand contabilul intreaba 'cum sta clientul X la DSO', 'de ce e rosu indicatorul Y' sau 'ce inseamna KPI-ul Z'.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul" },
        month: { type: "number", description: "Luna (1-12)" },
        kpi_id: {
          type: "string",
          description:
            "Optional: returneaza doar acest KPI, cu trace complet de calcul (ex: 'dso', 'marjaBruta', 'costPersonal')",
        },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_account_catalog",
    description: "Cauta in catalogul standard OMFP 1802 (~568 conturi, versiunea omfp_1802_2025_v2). Util pentru a verifica daca un cod exista oficial, ce denumire oficiala are, ce tip (A/P/B) si ce grupa CPP. Poate cauta dupa cod exact sau dupa prefix (ex '60' pentru toate conturile de cheltuieli).",
    input_schema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Codul cautat (ex: '401', '6052'). Daca exista match exact returneaza un singur rand." },
        prefix: { type: "string", description: "Prefix pentru cautare multipla (ex: '401' returneaza 401, 4011, 4012 daca exista). Alternativ la `code`." },
        cpp_group: { type: "string", description: "Filtreaza pe grupa CPP: VENITURI_EXPLOATARE, CHELTUIELI_EXPLOATARE, VENITURI_FINANCIARE, CHELTUIELI_FINANCIARE" },
      },
      required: [],
    },
  },
  {
    name: "get_employee_counts",
    description:
      "Obtine numarul mediu de angajati pe luna, introdus manual de contabil in Setari (sectiunea 'Numar mediu de angajati'). E o sursa auxiliara: nu se deduce din jurnal, dar deblocheaza indicatorii Venituri per angajat si Profit per angajat. Returneaza lista (an, luna, numar) plus ultima valoare. Util cand contabilul intreaba 'cati angajati am setat pentru clientul X', 'de ce nu apare venitul per angajat' (raspuns: nu e introdus numarul de angajati pentru luna respectiva) sau cand vrea sa verifice evolutia echipei.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_business_lines",
    description:
      "Obtine defalcarea pe linii de business (axa B / verticale) pentru un client care are verticalsEnabled (ex: QHM21 cu Outsourcing/Recrutare/Coworking). Returneaza lista liniilor (inclusiv 'Toata firma' = verticala default care absoarbe regia nealocata) si, pentru perioada ceruta, venituri/cheltuieli/rezultat cumulate (YTD ianuarie -> luna) per linie, defalcate conform maparilor lunii selectate (ADR-0004), exact ca in coloanele din tab-ul CPP. Suma liniilor = totalul firmei, fara scurgeri. Daca se da parametrul 'cont', returneaza si cum se imparte ACEL cont pe linii in luna respectiva (procent per linie + de unde vine regula: analitic/contBase/categorie/firma/default). Util cand contabilul intreaba 'cum sta Outsourcing-ul', 'ce profit a facut Coworking-ul' sau 'ce procent din 6028 merge pe Recrutare'. Daca firma nu are linii de business activate, raspunde clar ca nu exista verticale.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul" },
        month: { type: "number", description: "Luna (1-12)" },
        cont: {
          type: "string",
          description:
            "Optional: un cont (ex '6028', '628.01' sau baza '62') pentru a vedea cum se imparte pe linii de business in luna respectiva",
        },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_partner_analysis",
    description:
      "Analiza partenerilor (clienti/furnizori) rezolvati din jurnal via JournalPartner, cumulat YTD ianuarie -> luna selectata. Fara parametrul 'cont': top parteneri pe venituri si pe cheltuieli la nivel de firma, cu rulaj, pondere din total si concentrarea (top1/top3/top5 la suta din total) — raspunde la 'cat la suta din venituri vine de la un singur client?' sau 'de cine depinde firma?'. Cu parametrul 'cont' (ex '704'): partenerii acelui cont, fiecare cu rulaj, pondere, exceptia de categorie (PartnerCategoryOverride, daca partenerul e mapat pe alta linie de cost decat contul), sugestia de categorie (dedusa din alte conturi) si pin-ul pe linii de business (PartnerVerticalAllocation, cand banii partenerului merg pe alta linie decat splitul contului). 'unresolvedRulaj' e rulajul fara partener identificat (TVA, dobanzi, transferuri interne) — inclus in numitor, deci ponderile sunt oneste.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul" },
        month: { type: "number", description: "Luna (1-12); analiza e cumulata ianuarie -> luna" },
        cont: {
          type: "string",
          description: "Optional: un cont 6xx/7xx (ex '704', '628.01') pentru analiza partenerilor acelui cont",
        },
        limit: { type: "number", description: "Numar maxim de parteneri per lista (default 15, max 30)" },
      },
      required: ["client_name", "year", "month"],
    },
  },
  {
    name: "get_mappings_overview",
    description:
      "Imaginea completa a maparilor din tab-ul Mapari Cashflow, intr-un singur apel: acoperirea (cat la suta din rulajul clasei 6+7 e mapat pe linii de cost), liniile de cost (axa A) cu conturile lor si rulajul YTD, splitul pe linii de business (axa B) acolo unde exista (propriu/categorie/firma/default), splitul default al firmei, conturile nemapate (cele mai mari primele), numarul de exceptii de partener per cont si redirectionarile de rulaj intre categorii cauzate de exceptii (categoryInflows). Util cand contabilul intreaba 'ce conturi am pe linia Marfa?', 'cat la suta din cashflow e mapat?', 'ce a mai ramas de mapat?' sau 'unde se duc banii din 628?'. Fara year/month foloseste ultima perioada disponibila.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Optional: anul perioadei (default ultima disponibila)" },
        month: { type: "number", description: "Optional: luna perioadei (1-12)" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_trends",
    description:
      "Serii lunare gata calculate pentru intrebari de evolutie: venituri, cheltuieli, rezultat brut si marja PE LUNA (fluxuri lunare, derivate din snapshot-urile YTD ale CPP: flux(luna) = YTD(luna) - YTD(luna precedenta), cu reset la inceput de an), plus pozitia de cash la finalul fiecarei luni (punctuala, nu flux). Optional defalcare pe linii de business per luna (include_business_lines). Acopera ultimele N luni cu date (default 12, max 24). 'monthsCovered' > 1 semnaleaza ca jurnalul sare peste luni si fluxul acopera intervalul. Foloseste acest tool pentru 'de ce scade marja de 3 luni?', 'cum au evoluat veniturile anul asta?', 'in ce luna am avut cel mai mare profit?' — NU inlantui apeluri get_cpp per luna. Prima apelare pe perioade nematerializate poate dura cateva secunde (se calculeaza si se salveaza snapshot-urile).",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        months: { type: "number", description: "Cate luni inapoi (default 12, max 24)" },
        to_year: { type: "number", description: "Optional: anul ultimei luni din serie (default ultima perioada cu date)" },
        to_month: { type: "number", description: "Optional: ultima luna din serie (1-12)" },
        include_business_lines: {
          type: "boolean",
          description: "Include defalcarea lunara pe linii de business (doar pentru firme cu verticale active)",
        },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_account_mapping_timeline",
    description:
      "Returneaza istoricul maparii unui cont pe linia de cost (axa A) in timp, pentru clientii care folosesc mapari pe perioade (ADR-0004). Fiecare versiune are o luna de inceput (effectiveFrom, format YYYYMM; 0 = de la inceput), o eventuala luna de sfarsit (effectiveTo, doar pentru exceptii pe o fereastra) si linia de cost activa (sau 'nemapat' pentru un tombstone). Rezolvarea: o exceptie marginita (cu effectiveTo) castiga doar in fereastra ei; altfel se ia versiunea deschisa cu cel mai mare effectiveFrom <= luna ceruta. Util cand contabilul intreaba 'pe ce linie a fost contul 6028 in martie fata de aprilie' sau 'cand am schimbat maparea contului X'. Daca se da year+month, intoarce si linia activa rezolvata pentru acea luna.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        cont: {
          type: "string",
          description: "Contul analizat (ex: '6028', '628.01' sau baza '62')",
        },
        year: { type: "number", description: "Optional: anul pentru rezolvarea liniei active" },
        month: { type: "number", description: "Optional: luna (1-12) pentru rezolvarea liniei active" },
      },
      required: ["client_name", "cont"],
    },
  },
];
