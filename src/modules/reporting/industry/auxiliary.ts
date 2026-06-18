/**
 * Auxiliary (operational) inputs — data the journal does NOT contain but that
 * the accountant could collect cheaply, alongside each monthly upload, to
 * unlock KPIs that are otherwise stuck on "Date operationale".
 *
 * Each KPI that cannot be computed from the journal alone declares the
 * auxiliary inputs it needs (`requiresAux`). A KPI becomes computable once
 * ALL of its required auxiliary inputs are collected AND all of its journal
 * inputs already exist (they do, by construction, for every placeholder KPI
 * here — the journal half is the part we already have).
 *
 * This drives two things in the coverage report:
 *  1. the "missing attributes" shown per uncomputable KPI;
 *  2. the what-if: how many KPIs a given set of auxiliary inputs unlocks.
 */

export type AuxiliaryInputId =
  | "numberOfEmployees"
  | "billableHours"
  | "totalWorkedHours"
  | "activeClientsCurrent"
  | "activeClientsPrevious"
  | "salesAreaSqm"
  | "transactionCount"
  | "activeSubscribers"
  | "churnedSubscribers"
  | "subscriptionRevenue"
  | "loanPortfolio"
  | "nonPerformingLoans"
  | "interestEarningAssets"
  | "occupiedUnits"
  | "totalUnits";

export interface AuxiliaryInput {
  id: AuxiliaryInputId;
  /** Accountant-facing label. */
  label: string;
  /** How often it would be captured. */
  cadence: "lunar" | "trimestrial" | "o singura data";
  /** Where the accountant gets it. */
  source: string;
}

export const AUXILIARY_INPUTS: Record<AuxiliaryInputId, AuxiliaryInput> = {
  numberOfEmployees: {
    id: "numberOfEmployees",
    label: "Numar mediu de angajati",
    cadence: "lunar",
    source: "Din statul de plata / Revisal. O singura cifra pe luna.",
  },
  billableHours: {
    id: "billableHours",
    label: "Ore facturabile",
    cadence: "lunar",
    source: "Din pontajul pe proiecte (timesheet).",
  },
  totalWorkedHours: {
    id: "totalWorkedHours",
    label: "Total ore lucrate",
    cadence: "lunar",
    source: "Din pontaj.",
  },
  activeClientsCurrent: {
    id: "activeClientsCurrent",
    label: "Clienti activi luna curenta",
    cadence: "lunar",
    source: "Numar de clienti facturati in luna.",
  },
  activeClientsPrevious: {
    id: "activeClientsPrevious",
    label: "Clienti activi luna anterioara",
    cadence: "lunar",
    source: "Se reia din valoarea lunii precedente.",
  },
  salesAreaSqm: {
    id: "salesAreaSqm",
    label: "Suprafata de vanzare (mp)",
    cadence: "o singura data",
    source: "Suprafata comerciala. Se schimba rar.",
  },
  transactionCount: {
    id: "transactionCount",
    label: "Numar de tranzactii (bonuri)",
    cadence: "lunar",
    source: "Din casa de marcat / POS.",
  },
  activeSubscribers: {
    id: "activeSubscribers",
    label: "Numar abonati activi",
    cadence: "lunar",
    source: "Din sistemul de facturare recurenta.",
  },
  churnedSubscribers: {
    id: "churnedSubscribers",
    label: "Abonati pierduti in luna",
    cadence: "lunar",
    source: "Din sistemul de facturare recurenta.",
  },
  subscriptionRevenue: {
    id: "subscriptionRevenue",
    label: "Venit recurent lunar",
    cadence: "lunar",
    source: "Partea recurenta a veniturilor (abonamente).",
  },
  loanPortfolio: {
    id: "loanPortfolio",
    label: "Portofoliu de credite",
    cadence: "lunar",
    source: "Soldul total al creditelor acordate (date de portofoliu).",
  },
  nonPerformingLoans: {
    id: "nonPerformingLoans",
    label: "Credite neperformante",
    cadence: "lunar",
    source: "Soldul creditelor clasificate neperformante.",
  },
  interestEarningAssets: {
    id: "interestEarningAssets",
    label: "Active productive medii",
    cadence: "lunar",
    source: "Media activelor purtatoare de dobanda.",
  },
  occupiedUnits: {
    id: "occupiedUnits",
    label: "Unitati ocupate",
    cadence: "lunar",
    source: "Numar de spatii/unitati inchiriate.",
  },
  totalUnits: {
    id: "totalUnits",
    label: "Total unitati disponibile",
    cadence: "o singura data",
    source: "Numar total de spatii/unitati. Se schimba rar.",
  },
};

/**
 * For each registry/spec KPI that the journal alone cannot compute, the set
 * of auxiliary inputs that (together with the journal data we already have)
 * make it computable. Keyed by registryId when one exists, otherwise by the
 * exact spec name for omitted KPIs.
 */
export const KPI_AUX_REQUIREMENTS: Record<string, AuxiliaryInputId[]> = {
  // --- unlocked by employee count alone (journal already has venituri/EBITDA) ---
  venitPerAngajat: ["numberOfEmployees"],
  profitPerAngajat: ["numberOfEmployees"],

  // --- professional services utilization ---
  oreFacturabile: ["billableHours", "totalWorkedHours"],

  // --- client retention ---
  retentieClienti: ["activeClientsCurrent", "activeClientsPrevious"],

  // --- retail ---
  vanzariPerMp: ["salesAreaSqm"],
  bonMediu: ["transactionCount"],

  // --- subscriptions / telecom ---
  mrr: ["activeSubscribers", "subscriptionRevenue"],
  arpu: ["activeSubscribers", "subscriptionRevenue"],
  churn: ["activeSubscribers", "churnedSubscribers"],
  "MRR Churn %": ["subscriptionRevenue", "churnedSubscribers"],
  "Net Revenue Retention": ["subscriptionRevenue", "activeClientsCurrent"],
  ARR: ["activeSubscribers", "subscriptionRevenue"],

  // --- banking ---
  nim: ["interestEarningAssets"],
  npl: ["loanPortfolio", "nonPerformingLoans"],

  // --- real estate occupancy ---
  gradOcupare: ["occupiedUnits", "totalUnits"],
};

export function auxInputsFor(key: string | null | undefined): AuxiliaryInput[] {
  if (!key) return [];
  const ids = KPI_AUX_REQUIREMENTS[key];
  if (!ids) return [];
  return ids.map((id) => AUXILIARY_INPUTS[id]);
}

export interface AuxiliaryUnlock {
  input: AuxiliaryInput;
  /** KPIs this single input fully unlocks (no other aux input needed). */
  unlocksAlone: string[];
  /** KPIs this input contributes to but which still need other aux inputs. */
  contributesTo: string[];
}

/**
 * Given the set of auxiliary inputs already collected, returns the keys of
 * KPIs that become fully computable (every required aux input present).
 */
export function unlockedBy(collected: ReadonlySet<AuxiliaryInputId>): string[] {
  const out: string[] = [];
  for (const [key, required] of Object.entries(KPI_AUX_REQUIREMENTS)) {
    if (required.every((id) => collected.has(id))) out.push(key);
  }
  return out;
}

/** Per-input breakdown: what each auxiliary input unlocks alone vs partially. */
export function auxiliaryUnlockReport(): AuxiliaryUnlock[] {
  return Object.values(AUXILIARY_INPUTS).map((input) => {
    const unlocksAlone: string[] = [];
    const contributesTo: string[] = [];
    for (const [key, required] of Object.entries(KPI_AUX_REQUIREMENTS)) {
      if (!required.includes(input.id)) continue;
      if (required.length === 1) unlocksAlone.push(key);
      else contributesTo.push(key);
    }
    return { input, unlocksAlone, contributesTo };
  });
}
