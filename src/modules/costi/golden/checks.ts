/**
 * Deterministic checks for the Costi golden set. Every check is a pure
 * function over the turn outcome (final text + tool-call transcript), so
 * grading is reproducible and free — no LLM judges.
 *
 * Levels: "must" fails the run; "warn" is reported but non-blocking.
 */
import type { ToolCallRecord } from "../chat";

export interface TurnOutcome {
  text: string;
  toolCalls: ToolCallRecord[];
}

export interface CheckResult {
  id: string;
  level: "must" | "warn";
  ok: boolean;
  detail: string;
}

export interface CaseExpectations {
  /** Case is asked in owner view: the patron jargon guard applies. */
  patronVoice?: boolean;
  /** Tools that must appear in the transcript (any round). */
  requiredTools?: string[];
  /** get_client_diagnostic must be among the first round's calls. */
  diagnosticFirst?: boolean;
  /** Tools that must NOT appear. */
  forbiddenTools?: string[];
  /** Case-insensitive substrings or regexes the answer must contain. */
  mustContain?: (string | RegExp)[];
  /** Case-insensitive substrings or regexes the answer must not contain. */
  mustNotContain?: (string | RegExp)[];
  /** Soft cap on answer length (chars); exceeding it is a warning. */
  maxChars?: number;
}

/* -------------------------------------------------------------------------- */
/*                              pattern libraries                              */
/* -------------------------------------------------------------------------- */

/** Transition narration the response contract bans from reaching the user. */
const NARRATION_PATTERNS: RegExp[] = [
  /^s[aă] v[aă]d\b/i,
  /^s[aă] verific\b/i,
  /^voi (verifica|analiza|ob[tț]ine)\b/i,
  /^[îi][tț]i (verific|ob[tț]in)\b/i,
  /^acum (pot|voi|s[aă])\b/i,
  /^perfect!/i,
  /^am g[aă]sit datele/i,
];

/** Closing option menus ("Doresti sa analizam: 1... 2... 3..."). */
const MENU_PATTERNS: RegExp[] = [
  /dore[sș]ti s[aă] (anali|vedem|[îi][tț]i (ar[aă]t|explic))/i,
  /pot s[aă] [îi][tț]i (ar[aă]t|explic|detaliez):\s*\n/i,
  /vrei s[aă]:\s*\n/i,
];

/**
 * Patron jargon guard. Bare "credit" stays allowed ("rate la credit" is
 * legitimate owner speech); the accounting sense is caught via "debit".
 * "sold" alone is everyday Romanian (the ATM screen says "sold disponibil",
 * owners say "sold negativ"); only the accounting collocations count as
 * jargon (sold creditor/debitor, sold + account code).
 */
const PATRON_JARGON: [label: string, re: RegExp][] = [
  ["cod de cont", /\b(?:cont(?:ul|uri)?(?: contabil[e]?)?\s+)\d{3,4}\b/i],
  ["cod de cont cunoscut", /\b(4111|4426|4427|5121|5311|6811|1171|401\.|641|628|691)\b/],
  ["rulaj", /\brulaj\w*\b/i],
  ["balanta", /\bbalan[tț][aă]\b/i],
  ["debit", /\bdebit\w*\b/i],
  ["analitic", /\banalitic\w*\b/i],
  ["sold contabil", /\bsold\w*\s+(creditor|debitor)\b|\bsold\w*\s+(al\s+)?cont(ului)?\s+\d/i],
  ["DSO", /\bDSO\b/],
  ["DPO", /\bDPO\b/],
  ["EBITDA", /\bEBITDA\b/],
  ["CPP", /\bCPP\b/],
];

/** Claims of remembering that require an actual remember_client_fact call. */
const MEMORY_CLAIM = /\bam (re[tț]inut|notat|salvat|memorat)\b|\bvoi [tț]ine minte\b|\bre[tț]in (asta|informa[tț])/i;

/* -------------------------------------------------------------------------- */
/*                                   checks                                   */
/* -------------------------------------------------------------------------- */

function match(text: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
  return pattern.test(text);
}

function describe(pattern: string | RegExp): string {
  return typeof pattern === "string" ? `"${pattern}"` : String(pattern);
}

export function runChecks(
  outcome: TurnOutcome,
  exp: CaseExpectations
): CheckResult[] {
  const { text, toolCalls } = outcome;
  const results: CheckResult[] = [];
  const called = toolCalls.map((c) => c.name);

  const narration = NARRATION_PATTERNS.find((re) => re.test(text.trimStart()));
  results.push({
    id: "no_narration",
    level: "must",
    ok: !narration,
    detail: narration ? `raspunsul incepe cu naratiune: ${narration}` : "curat",
  });

  const menu = MENU_PATTERNS.find((re) => re.test(text));
  results.push({
    id: "no_closing_menu",
    level: "must",
    ok: !menu,
    detail: menu ? `meniu de optiuni detectat: ${menu}` : "curat",
  });

  const claimsMemory = MEMORY_CLAIM.test(text);
  const savedFact = called.includes("remember_client_fact");
  // Recall is honest too: "am retinut ca..." is legitimate when the facts
  // demonstrably exist in memory (a read tool returned at least one fact).
  const readFacts = toolCalls.some(
    (c) =>
      (c.name === "get_client_facts" || c.name === "get_client_diagnostic") &&
      c.result.includes('"key":')
  );
  results.push({
    id: "memory_honesty",
    level: "must",
    ok: !claimsMemory || savedFact || readFacts,
    detail:
      claimsMemory && !savedFact && !readFacts
        ? "pretinde ca a retinut fara apel remember_client_fact"
        : "onest",
  });

  if (exp.patronVoice) {
    const hits = PATRON_JARGON.filter(([, re]) => re.test(text)).map(([l]) => l);
    results.push({
      id: "patron_jargon_guard",
      level: "must",
      ok: hits.length === 0,
      detail: hits.length > 0 ? `jargon in vocea de patron: ${hits.join(", ")}` : "curat",
    });
  }

  for (const tool of exp.requiredTools ?? []) {
    results.push({
      id: `required_tool:${tool}`,
      level: "must",
      ok: called.includes(tool),
      detail: called.includes(tool) ? "apelat" : `lipseste; apelate: ${called.join(", ") || "niciunul"}`,
    });
  }

  if (exp.diagnosticFirst) {
    const firstRound = toolCalls.filter((c) => c.round === 0).map((c) => c.name);
    const ok = firstRound.includes("get_client_diagnostic");
    results.push({
      id: "diagnostic_first",
      level: "must",
      ok,
      detail: ok
        ? "diagnosticul deschide"
        : `prima runda a apelat: ${firstRound.join(", ") || "nimic"}`,
    });
  }

  for (const tool of exp.forbiddenTools ?? []) {
    results.push({
      id: `forbidden_tool:${tool}`,
      level: "must",
      ok: !called.includes(tool),
      detail: called.includes(tool) ? "apelat desi interzis" : "curat",
    });
  }

  for (const pattern of exp.mustContain ?? []) {
    const ok = match(text, pattern);
    results.push({
      id: `must_contain:${describe(pattern)}`,
      level: "must",
      ok,
      detail: ok ? "prezent" : "absent din raspuns",
    });
  }

  for (const pattern of exp.mustNotContain ?? []) {
    const ok = !match(text, pattern);
    results.push({
      id: `must_not_contain:${describe(pattern)}`,
      level: "must",
      ok,
      detail: ok ? "curat" : "prezent desi interzis",
    });
  }

  if (exp.maxChars) {
    const ok = text.length <= exp.maxChars;
    results.push({
      id: "max_length",
      level: "warn",
      ok,
      detail: `${text.length} caractere (limita ${exp.maxChars})`,
    });
  }

  return results;
}
