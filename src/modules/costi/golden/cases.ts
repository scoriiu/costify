/**
 * The Costi golden set: canonical questions with deterministic expectations,
 * run against the real QHM21 journal in the local database.
 *
 * Expected values are pinned to the LOCAL DEV dataset as of the June 2026
 * import (cash -28.072,58; creante 702.530,56; Roche ~88% YTD concentration;
 * employee counts 13 feb / 15 apr / 12 iun 2026; profit regime since 2023).
 * A new QHM21 import shifts these anchors: update them deliberately, never
 * blindly. Prod data differs (e.g. employee counts) — the golden set always
 * grades against the local journal.
 *
 * `ownerReview: true` marks cases whose Q&A go into the validation doc for
 * the firm's owner (docs/ro/costi-validare-patron.md).
 */
import type { CaseExpectations } from "./checks";

export interface GoldenCase {
  id: string;
  title: string;
  question: string;
  /** App page the question is asked from (drives client + voice context). */
  page: string;
  expect: CaseExpectations;
  /** Facts that must exist in memory before the case runs. */
  seedFacts?: { key: string; value: string }[];
  ownerReview?: boolean;
}

const CLIENT_PAGE = "/clients/qhm21-network-srl";
const OWNER_PAGE = `${CLIENT_PAGE}?view=owner`;
const NEUTRAL_PAGE = "/costi";

const SALARY_FACT = {
  key: "cost_behavior.641",
  value: "Salariile sunt fixe, nu depind de volumul de activitate",
};
const ROCHE_FACT = {
  key: "contract_end.roche",
  value: "Contract pe termen lung cu Roche, renegociere programata martie 2027",
};

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: "overview_patron",
    title: "P00 - prezentare generala, vocea patron",
    question: "Spune-mi despre firma mea",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      diagnosticFirst: true,
      mustContain: [/Roche/i, /28\.0\d\d/],
      mustNotContain: ["RO31679778", /\bCAEN\b/],
    },
  },
  {
    id: "overview_contabil",
    title: "P00 - diagnostic client, vocea contabil",
    question: "Ce parere ai despre clientul asta? Fa-mi un diagnostic.",
    page: CLIENT_PAGE,
    expect: {
      diagnosticFirst: true,
      mustContain: [/Roche/i, /iunie/i],
    },
  },
  {
    id: "cash_runway",
    title: "P02 - cash si rezistenta",
    question: "Cati bani avem si cat rezistam daca nu mai intra nimic?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      diagnosticFirst: true,
      mustContain: [/28\.0\d\d/, /iunie/i],
    },
  },
  {
    id: "profit_vs_cash",
    title: "P03 - am profit, unde sunt banii",
    question: "Pe hartie am profit, dar in cont nu-i vad. Unde sunt banii?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      diagnosticFirst: true,
      // Anchor the bridge mechanism, not one phrasing: receivables can be
      // cited as stock (702k) or YTD delta (+343k), Roche as name or "un
      // singur client mare"; a second bridge piece must also appear.
      mustContain: [/neincasat|nepl[aă]tit|factur/i, /credit|rate|dividend|echipament|masin/i],
    },
  },
  {
    id: "dividends_150k",
    title: "P04 - dividende 150k (regresie benzi CASS)",
    question: "Pot sa scot 150.000 lei dividende anul asta? Cat ma costa?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/9\.720/, /16\s?%/],
    },
  },
  {
    id: "margin_why",
    title: "P05 - de ce variaza marja",
    question: "De ce a variat marja asa mult in ultimele luni?",
    page: CLIENT_PAGE,
    expect: {
      requiredTools: ["get_trends"],
      mustContain: [/Roche|factur[aă]?re|concentr/i],
    },
  },
  {
    id: "concentration",
    title: "P06 - dependenta de un client",
    question: "Cat de dependenti suntem de un singur client?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      // "88 din (fiecare) 100 de lei" is the preferred patron form of 88%.
      mustContain: [/Roche/i, /%|din (fiecare )?100/i],
    },
  },
  {
    id: "receivables",
    title: "P07 - cine ne datoreaza bani",
    question: "Cine ne datoreaza bani si cat de grava e situatia?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/702\.53|Roche/i],
    },
  },
  {
    id: "micro_adversarial",
    title: "P08 - plafonul micro (firma e pe profit din 2023)",
    question: "Mai incapem in plafonul de microintreprindere anul asta?",
    page: CLIENT_PAGE,
    expect: {
      requiredTools: ["get_tax_regime_timeline"],
      mustContain: [/impozit pe profit|profit standard/i, /2023/],
    },
  },
  {
    id: "hiring",
    title: "P09 - imi permit un angajat nou",
    question: "Imi permit sa mai angajez un om la 5.000 lei net?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/8\.\d{3}|8\.7/],
    },
  },
  {
    id: "breakeven_memory",
    title: "P10 - prag de rentabilitate cu memoria salariilor",
    question: "De la ce incasari lunare suntem pe plus?",
    page: OWNER_PAGE,
    seedFacts: [SALARY_FACT],
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/fix/i, /lei/],
      // With the fact in memory he must not re-ask the salary question.
      mustNotContain: [/salariile.*(sunt|le ave[tț]i).*(fixe sau|sau variabile)\?/i],
    },
  },
  {
    id: "lines_honesty",
    title: "P11 - linii de business, verificarea de onestitate",
    question: "Cum merg liniile de business?",
    page: CLIENT_PAGE,
    expect: {
      diagnosticFirst: true,
      mustContain: [/nealoc|Toat[aă] firma|cosmetiz/i],
    },
  },
  {
    id: "bank",
    title: "P13 - bancabilitate, doar ancore oficiale",
    question: "Ma imprumuta banca daca cer un credit?",
    page: CLIENT_PAGE,
    expect: {
      mustContain: [/lichidit|activ net|dob[aâ]nz/i],
      mustNotContain: [/banca cere (minim|un prag)/i],
    },
  },
  {
    id: "taxes_due",
    title: "P14 - cat am de platit la stat",
    question: "Cat avem de platit la stat luna asta?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/TVA/i, /25/],
    },
  },
  {
    id: "alarm_scan",
    title: "P15 - scanare semnale de alarma",
    question: "Vezi semnale de alarma la firma asta?",
    page: CLIENT_PAGE,
    expect: {
      diagnosticFirst: true,
      mustContain: [/cash|concentr/i],
    },
  },
  {
    id: "memory_write",
    title: "Memorie - salvarea unui fapt nou",
    question:
      "Retine te rog: avem 3 echipe a cate 8 oameni, iar bonusurile se platesc doar in decembrie.",
    page: CLIENT_PAGE,
    expect: {
      requiredTools: ["remember_client_fact"],
    },
  },
  {
    id: "memory_recall",
    title: "Memorie - ce stie deja despre firma",
    question: "Ce stii deja despre firma mea din discutiile trecute?",
    page: OWNER_PAGE,
    seedFacts: [SALARY_FACT, ROCHE_FACT],
    expect: {
      patronVoice: true,
      mustContain: [/martie 2027/i, /fix/i],
    },
  },
  {
    id: "lookup_fast",
    title: "Regula de comutare - lookup ramane scurt",
    question: "Cat cash are QHM21 in iunie 2026?",
    page: NEUTRAL_PAGE,
    expect: {
      mustContain: [/28\.0\d\d/],
      maxChars: 1600,
    },
  },
  {
    id: "page_context",
    title: "Context pagina - fara list_clients",
    question: "Cati bani am in banca?",
    page: OWNER_PAGE,
    expect: {
      patronVoice: true,
      forbiddenTools: ["list_clients"],
      mustContain: [/28\.0\d\d/],
    },
  },
  {
    id: "no_budget",
    title: "Regula fara buget - nu inventa planuri",
    question: "Cum stam fata de buget anul asta?",
    page: CLIENT_PAGE,
    expect: {
      mustContain: [/buget/i, /trend|an(ul)? (precedent|trecut)/i],
    },
  },
  {
    id: "employees_carry",
    title: "Numar de angajati citit corect din date (12 in iunie)",
    question: "Cat profit pe angajat facem?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/\b12\b/],
      mustNotContain: [/Set[aă]ri/],
    },
  },
  {
    id: "jargon_translate",
    title: "Garda de jargon - traducerea marjei",
    question: "Ce inseamna ca avem marja de 18%?",
    page: OWNER_PAGE,
    ownerReview: true,
    expect: {
      patronVoice: true,
      mustContain: [/100 (de )?lei/],
    },
  },
  {
    id: "legislation_table",
    title: "Legislatie - tabelul Concluzie Sintetica ramane",
    question: "E corect ca TVA standard e 21% in 2026?",
    page: NEUTRAL_PAGE,
    expect: {
      forbiddenTools: ["get_client_diagnostic"],
      mustContain: [/21\s?%/, /Concluzie Sintetic/i],
    },
  },
  {
    id: "saga_flow",
    title: "Saga - fluxul de inchidere ramane intact",
    question: "Cum fac inchiderea de luna in Saga?",
    page: NEUTRAL_PAGE,
    expect: {
      forbiddenTools: ["get_client_diagnostic"],
      mustContain: [/Saga/i, /valid|opera[tț]i/i],
    },
  },
];
