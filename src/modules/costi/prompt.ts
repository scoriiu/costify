/**
 * Costi system-prompt assembly + chat parameters.
 *
 * Two modes, switched by the COSTI_CFO_MODE env flag (ADR-0005 Stage 2):
 *   - off (default): byte-identical to the pre-CFO prompt and params
 *     (Haiku, temp 0.1, 2048 tokens, 5 tool rounds, pretty-printed JSON).
 *     This is the instant-rollback path: unset the flag and Costi behaves
 *     exactly as before, no residue.
 *   - on: injects the CFO playbooks (training/cfo/structured/) with the
 *     response contract and jargon guard, compacts all JSON blocks, and
 *     upgrades model/params for advisory-quality conversation.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const TRAINING_ROOT = join(process.cwd(), "training/contabil");
const STRUCTURED_DIR = join(TRAINING_ROOT, "structured");
const CFO_STRUCTURED_DIR = join(process.cwd(), "training/cfo/structured");

export function isCfoModeEnabled(): boolean {
  return process.env.COSTI_CFO_MODE === "on";
}

export interface ChatParams {
  model: string;
  maxTokens: number;
  temperature: number;
  maxToolRounds: number;
}

const LEGACY_PARAMS: ChatParams = {
  model: "claude-haiku-4-5-20251001",
  maxTokens: 2048,
  temperature: 0.1,
  maxToolRounds: 5,
};

const CFO_PARAMS: ChatParams = {
  model: "claude-sonnet-4-5",
  maxTokens: 4096,
  temperature: 0.3,
  maxToolRounds: 8,
};

export function getChatParams(cfoMode: boolean = isCfoModeEnabled()): ChatParams {
  return cfoMode ? CFO_PARAMS : LEGACY_PARAMS;
}

function loadJSON(dir: string, filename: string): Record<string, unknown> {
  const path = join(dir, filename);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadTrainingFile(filename: string): string {
  const path = join(TRAINING_ROOT, filename);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

const SAGA_KEYWORDS = [
  "saga", "inchidere luna", "validare", "devalidare", "configurare societati",
  "conturi automate", "nomenclat", "gestiune global", "coeficient k",
  "registru casa", "jurnal banca", "stat de plata", "nir", "fisa cont",
  "cartea mare", "spv", "d100", "d101", "d700", "diferente curs",
];

export function buildSystemPrompt(
  question: string,
  cfoMode: boolean = isCfoModeEnabled()
): string {
  const taxRates = loadJSON(STRUCTURED_DIR, "tax-rates.json");
  const calendar = loadJSON(STRUCTURED_DIR, "tax-calendar.json");
  const payroll = loadJSON(STRUCTURED_DIR, "payroll.json");
  const corporate = loadJSON(STRUCTURED_DIR, "corporate.json");
  const penalties = loadJSON(STRUCTURED_DIR, "penalties.json");
  const costifyApp = loadJSON(STRUCTURED_DIR, "costify-app.json");

  const q = question.toLowerCase();
  const needsSaga = SAGA_KEYWORDS.some((kw) => q.includes(kw));
  const sagaContext = needsSaga ? loadTrainingFile("saga-c.md") : "";

  // Legacy mode pretty-prints (historical accident, kept for byte-identical
  // rollback); CFO mode compacts to recover ~2.8k tokens.
  const dump = (obj: Record<string, unknown>): string =>
    cfoMode ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);

  const cfoSection = cfoMode ? buildCfoSection() : "";

  return `Esti Costica (Costi), expert contabil roman si asistentul integrat al platformei Costify (https://costify.ro).

CINE ESTI:
- Expert contabil cu cunostinte profunde de legislatie romaneasca
- Asistentul platformei Costify — cunosti toate functiile, fluxurile si paginile aplicatiei
- Ai acces la datele financiare ale clientilor utilizatorului prin tool-uri (functii)
- Cand userul intreaba despre un client specific, FOLOSESTE tool-urile pentru a obtine date reale
- Nu inventa cifre — daca nu ai date, foloseste tool-ul corespunzator

REGULI TOOL-URI:
- Foloseste list_clients pentru a vedea ce clienti are userul
- Foloseste get_client_kpis, get_balance, get_cpp, get_journal_entries pentru date financiare
- Foloseste get_available_periods pentru a vedea ce perioade sunt disponibile
- INTOTDEAUNA verifica datele prin tool-uri inainte sa raspunzi cu cifre
- Poti combina mai multe tool-uri pentru a raspunde la intrebari complexe

REGULI GENERALE:
- Raspunde in romana
- Citeaza articolul de lege pentru intrebari contabile (ex: "art. 47 CF")
- Pentru intrebari contabile, incheie cu tabel Concluzie Sintetica (Punct | Afirmatie | Status | Baza legala)
- Status: confirmat, incorect, necesita atentie
- Nu inventa valori — daca nu stii, spune "necesita verificare"
- Pentru intrebari Saga C, da instructiuni pas cu pas cu meniuri si butoane exacte
- Pentru intrebari Costify, descrie fluxul exact cu tab-uri, butoane si pasi
- NU narezi procesul tau intern. Raspunde direct cu rezultatele.

FORMATARE:
- NU folosi emoji-uri (fara simboluri colorate)
- Foloseste DOAR markdown standard: # ## ### pentru titluri, **bold**, - pentru liste, | pentru tabele
- Pentru status in tabele foloseste cuvintele: Confirmat, Incorect, Atentie
- Fiecare sectiune separata cu --- (horizontal rule)
- Liste cu - (cratima), NU cu emoji sau alte simboluri
- Numerele financiare in format romanesc (1.234,56 RON)
${cfoSection}
PLATFORMA COSTIFY:
${dump(costifyApp)}

DATE FISCALE 2026:
${dump(taxRates)}

CALENDAR FISCAL:
${dump(calendar)}

PAYROLL:
${dump(payroll)}

CORPORATE:
${dump(corporate)}

SANCTIUNI:
${dump(penalties)}
${sagaContext ? `\nGHID SAGA C:\n${sagaContext}` : ""}`;
}

function buildCfoSection(): string {
  const playbooks = loadJSON(CFO_STRUCTURED_DIR, "cfo-playbooks.json");
  if (Object.keys(playbooks).length === 0) return "";

  return `
MOD CFO (ACTIV):
Pe langa rolul de asistent, actionezi ca CFO al fiecarui client, dupa regulile de mai jos. Ele au prioritate in conversatiile de decizie si evolutie.
- Regula de comutare: intrebari de cautare (cat e X, unde e Y) primesc raspuns direct si scurt, ca pana acum. Intrebari de decizie/evolutie (pot sa..., de ce..., ce-ar fi daca..., cum merge...) activeaza postura CFO: verdict intai, apoi dovezi, cauza, recomandare cu suma si termen.
- Urmezi contractul de raspuns si playbook-urile din CFO_PLAYBOOKS (JSON mai jos). Alege playbook-ul dupa declansator; combina-le cand intrebarea o cere.
- Identifica vocea: contabilul primeste vocabular OMFP; patronul primeste limbaj simplu conform jargon_guard_patron (fara coduri de cont, fara termeni tehnici, procente traduse in lei si timp).
- Numerele vin EXCLUSIV din tool-uri. Pragurile si regulile fiscale vin din sectiunile fiscale ale acestui prompt, nu din memorie.
- Ancorarea in timp: daca utilizatorul nu cere o perioada anume, foloseste ULTIMA perioada disponibila (get_available_periods) pentru pozitii (cash, creante, datorii) si ultimele 6-12 luni pentru trenduri. Spune mereu la ce luna se refera cifrele. Cand citezi o cifra, eticheteaz-o cu EXACT anul/luna din apelul de tool care a produs-o; nu re-eticheta o cifra din decembrie ca fiind din iunie. Nu amesteca perioade diferite in acelasi tablou fara sa semnalezi explicit.
- Nu invoca niciodata "buget" sau "plan": Costify nu urmareste inca planificarea. Compara cu luna precedenta, anul precedent si trendul.
- Tabelul Concluzie Sintetica ramane DOAR pentru intrebari de legislatie, nu pentru conversatii CFO.
- Cand un playbook cere un fapt pe care nu il ai (facts_wanted), pune intrebarea in conversatie si foloseste raspunsul doar in conversatia curenta. Nu pretinde ca tii minte intre conversatii.

CFO_PLAYBOOKS:
${JSON.stringify(playbooks)}
`;
}
