const HEADER_ALIASES: Record<string, string[]> = {
  data: ["data", "date", "data_doc", "data_document", "data_inregistrare", "data_inreg"],
  ndp: ["ndp", "nr_doc", "document", "tip_document", "fel_document", "numar_document", "nr_document"],
  cont_d: ["cont_d", "cont_debit", "cont_debitor", "debit_cont", "simbol_debit", "simbol_d"],
  cont_c: ["cont_c", "cont_credit", "cont_creditor", "credit_cont", "simbol_credit", "simbol_c"],
  suma: ["suma", "valoare", "amount", "value", "suma_ron", "valoare_ron"],
  explicatie: ["explicatie", "explicatia", "descriere", "description", "observatii", "detalii"],
  fel_d: ["fel_d", "fel", "tip_operatie", "tip_tranzactie", "categorie_op"],
  categorie: ["categorie", "cat", "category"],
  cod: ["cod", "cod_partener", "cod_tert", "cod_furnizor", "cod_client"],
  validat: ["validat", "validare", "valid"],
  tva: ["tva", "vat"],
  denumire_d: [
    "denumire_d", "denumire_cont_d", "denumire_cont_debit", "denumire_cont_debitor",
    "denumire_debit", "den_cont_d", "den_debit", "nume_cont_d", "nume_cont_debit",
  ],
  denumire_c: [
    "denumire_c", "denumire_cont_c", "denumire_cont_credit", "denumire_cont_creditor",
    "denumire_credit", "den_cont_c", "den_credit", "nume_cont_c", "nume_cont_credit",
  ],
  denumire: ["denumire", "denumire_cont", "den_cont", "nume_cont"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[.\-()\/\\]/g, "").replace(/\s+/g, "_");
}

export function resolveHeaders(
  rawHeaders: string[]
): { resolved: Record<string, string>; unmatched: string[] } {
  const normalized = new Map<string, string>();
  for (const h of rawHeaders) {
    normalized.set(normalizeHeader(h), h);
  }

  const resolved: Record<string, string> = {};
  const matchedNorm = new Set<string>();

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (normalized.has(canonical)) {
      resolved[canonical] = normalized.get(canonical)!;
      matchedNorm.add(canonical);
      continue;
    }
    for (const alias of aliases) {
      if (normalized.has(alias)) {
        resolved[canonical] = normalized.get(alias)!;
        matchedNorm.add(alias);
        break;
      }
    }
  }

  const unmatched = rawHeaders.filter((h) => !matchedNorm.has(normalizeHeader(h)));
  return { resolved, unmatched };
}
