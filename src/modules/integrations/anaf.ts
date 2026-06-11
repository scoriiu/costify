/**
 * ANAF public web service client (PlatitorTvaRest v9).
 *
 * Free, official, no auth. Returns registry data for a CUI: denumire,
 * cod CAEN preponderent (Rev. 3), nr. Reg. Com., adresa, stare fiscala,
 * TVA + e-Factura status. Rate limit: 1 request/second, max 100 CUIs
 * per call. We only ever query one CUI at a time from the UI.
 *
 * Endpoint verified 2026-06: POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
 * with body [{ cui: number, data: "YYYY-MM-DD" }].
 */

import { ok, err, type Result } from "@/shared/errors";

const ANAF_ENDPOINT = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const REQUEST_TIMEOUT_MS = 10_000;

export interface AnafCompanyData {
  cui: number;
  denumire: string;
  caen: string | null;
  nrRegCom: string | null;
  adresa: string | null;
  telefon: string | null;
  codPostal: string | null;
  stareInregistrare: string | null;
  formaJuridica: string | null;
  /** True when the company is flagged inactive by ANAF. */
  inactiv: boolean;
  platitorTva: boolean;
  eFactura: boolean;
  dataInterogare: string;
}

interface AnafDateGenerale {
  cui?: number;
  denumire?: string;
  cod_CAEN?: string;
  nrRegCom?: string;
  adresa?: string;
  telefon?: string;
  codPostal?: string;
  stare_inregistrare?: string;
  forma_juridica?: string;
  statusRO_e_Factura?: boolean;
}

interface AnafEntry {
  date_generale?: AnafDateGenerale;
  inregistrare_scop_Tva?: { scpTVA?: boolean };
  stare_inactiv?: { statusInactivi?: boolean };
}

interface AnafResponse {
  found?: AnafEntry[];
  notFound?: unknown[];
}

/**
 * Normalizes a user-entered CUI: strips the optional "RO" prefix, spaces
 * and punctuation. Returns null when the result is not a plausible CUI
 * (2-10 digits).
 */
export function normalizeCui(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/^\s*ro/i, "").replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 10) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Maps the raw ANAF entry to our shape. Exported for unit tests. */
export function parseAnafEntry(entry: AnafEntry, dataInterogare: string): AnafCompanyData | null {
  const g = entry.date_generale;
  if (!g || !g.denumire || !g.cui) return null;
  return {
    cui: g.cui,
    denumire: g.denumire.trim(),
    caen: g.cod_CAEN?.trim() || null,
    nrRegCom: g.nrRegCom?.trim() || null,
    adresa: g.adresa?.trim() || null,
    telefon: g.telefon?.trim() || null,
    codPostal: g.codPostal?.trim() || null,
    stareInregistrare: g.stare_inregistrare?.trim() || null,
    formaJuridica: g.forma_juridica?.trim() || null,
    inactiv: entry.stare_inactiv?.statusInactivi === true,
    platitorTva: entry.inregistrare_scop_Tva?.scpTVA === true,
    eFactura: g.statusRO_e_Factura === true,
    dataInterogare,
  };
}

export async function lookupCompanyByCui(
  rawCui: string
): Promise<Result<AnafCompanyData>> {
  const cui = normalizeCui(rawCui);
  if (cui === null) {
    return err({
      code: "VALIDATION",
      message: "CUI invalid. Introdu un CUI numeric, cu sau fara prefixul RO.",
      context: { rawCui },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  let response: Response;
  try {
    response = await fetch(ANAF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ cui, data: today }]),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return err({
      code: "INTERNAL",
      message: "Serviciul ANAF nu raspunde. Incearca din nou in cateva momente.",
      context: { cui },
    });
  }

  if (!response.ok) {
    return err({
      code: "INTERNAL",
      message: "Serviciul ANAF a raspuns cu eroare. Incearca din nou mai tarziu.",
      context: { cui, status: response.status },
    });
  }

  let payload: AnafResponse;
  try {
    payload = (await response.json()) as AnafResponse;
  } catch {
    return err({
      code: "INTERNAL",
      message: "Raspuns neasteptat de la ANAF.",
      context: { cui },
    });
  }

  const entry = payload.found?.[0];
  const parsed = entry ? parseAnafEntry(entry, today) : null;
  if (!parsed) {
    return err({
      code: "NOT_FOUND",
      message: `CUI ${cui} nu a fost gasit in registrul ANAF.`,
      context: { cui },
    });
  }

  return ok(parsed);
}
