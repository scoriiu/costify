import { getContBase } from "@/lib/accounts";
import type { JournalEntry } from "./types";

const PARTNER_PREFIXES = ["401", "404", "411"];

function isPartnerAccount(cont: string): boolean {
  if (!cont.includes(".")) return false;
  const base = getContBase(cont);
  return PARTNER_PREFIXES.some((p) => base.startsWith(p));
}

export function extractPartnerName(explicatie: string): string | null {
  const raw = (explicatie ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return null;

  let rest = raw
    .replace(/^\s*(?:ACHIT\.?|ACHITARE\.?|PLATA\.?|[IÎ]NCASARE\.?|INTRARE\.?|VAL\.?\s*INTR\.?|DISCOUNT\.?|TVA)\s+/i, "")
    .trim()
    .replace(/^[\s.:\-–—]+/, "")
    .trim();

  if (!rest) return null;

  rest = rest
    .split(/\b(?:NR\.?\s*:|NR\.?\b|CUI\b|CIF\b|CF\b|IBAN\b|FACT\.?\b|FACTURA\b)\b/i)[0]
    .trim()
    .replace(/[\s,;:\-–—]+$/, "")
    .trim();

  if (!rest) return null;

  const upper = rest.toUpperCase();
  const suffixMatch = upper.match(
    /\b([A-Z0-9][A-Z0-9&.'\/\-]*(?:\s+[A-Z0-9][A-Z0-9&.'\/\-]*){0,8}\s+(?:S\.?R\.?L\.?-?D?|S\.?A\.?|PFA|I\.?I\.?|I\.?F\.?|SNC|SCS))\b/
  );
  if (suffixMatch?.[1]) return suffixMatch[1].replace(/\s+/g, " ").trim();

  const tokens = upper.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const excluded = new Set(["INCHIDERE", "CAPITAL", "SOLD", "RULAJ", "TOTAL", "DIFERENTA"]);
  if (excluded.has(tokens[0] ?? "")) return null;

  const stop = new Set(["NR", "NR.", "NR:", "CUI", "CIF", "CF", "IBAN", "FACT", "FACT.", "FACTURA"]);
  const collected: string[] = [];
  for (const tok of tokens) {
    if (stop.has(tok) || /^\d+$/.test(tok)) break;
    collected.push(tok);
    if (collected.length >= 6) break;
  }

  const candidate = collected.join(" ").trim();
  return candidate.length >= 4 ? candidate : null;
}

function pickMostFrequent(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of map.entries()) {
    if (count > bestCount || (count === bestCount && best && value.length > best.length)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function buildPartnerMappings(entries: JournalEntry[]): Array<{
  analyticAccount: string;
  contBase: string;
  partnerName: string;
  cod: string | null;
}> {
  const perAccount = new Map<string, { names: Map<string, number>; cods: Map<string, number> }>();

  const bump = (account: string, name: string | null, cod: string | null) => {
    if (!name) return;
    const key = account.trim();
    const rec = perAccount.get(key) ?? (() => {
      const init = { names: new Map<string, number>(), cods: new Map<string, number>() };
      perAccount.set(key, init);
      return init;
    })();
    rec.names.set(name, (rec.names.get(name) || 0) + 1);
    if (cod) rec.cods.set(cod, (rec.cods.get(cod) || 0) + 1);
  };

  for (const e of entries) {
    const name = extractPartnerName(e.explicatie);
    const cod = e.cod ? String(e.cod).trim() : null;
    if (isPartnerAccount(e.contD)) bump(e.contD, name, cod);
    if (isPartnerAccount(e.contC)) bump(e.contC, name, cod);
  }

  const result: Array<{ analyticAccount: string; contBase: string; partnerName: string; cod: string | null }> = [];
  for (const [analyticAccount, { names, cods }] of perAccount) {
    const partnerName = pickMostFrequent(names);
    if (!partnerName) continue;
    result.push({ analyticAccount, contBase: getContBase(analyticAccount), partnerName, cod: pickMostFrequent(cods) });
  }

  return result.sort((a, b) => a.analyticAccount.localeCompare(b.analyticAccount, undefined, { numeric: true }));
}
