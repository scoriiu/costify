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
    description: "Obtine Contul de Profit si Pierdere pentru un client: venituri/cheltuieli exploatare, financiare, rezultat brut/net",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Numele clientului" },
        year: { type: "number", description: "Anul" },
        month: { type: "number", description: "Luna (1-12)" },
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
];
