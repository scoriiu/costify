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
    description: "Returneaza istoricul regimurilor fiscale ale unei firme — fiecare tranzitie (data start, regim, motiv). Util cand contabilul intreaba 'ce regim are clientul X' sau 'cand a trecut firma de la micro la profit'. Costify foloseste un timeline (TaxRegimePeriod), nu un singur flag, pentru ca o firma poate trece intre regimuri in cursul anului. Pentru un raport CPP pe luna X, regimul valabil este cea mai recenta tranzitie cu startDate <= ultima zi a lunii X.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_account_catalog",
    description: "Cauta in catalogul standard OMFP 1802 (~321 conturi). Util pentru a verifica daca un cod exista oficial, ce denumire oficiala are, ce tip (A/P/B) si ce grupa CPP. Poate cauta dupa cod exact sau dupa prefix (ex '60' pentru toate conturile de cheltuieli).",
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
];
