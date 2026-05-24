/**
 * Partner name normalization for memory + matching across periods.
 *
 * The journal arrives with the partner spelled however Saga / the contabil
 * typed it on a given invoice: "FAN COURIER SRL", "Fan Courier", "FANCOURIER",
 * "Fan Courier S.R.L.". For the partner-mapping memory feature
 * (cashflow-limbajul-mapari.md §5.1) we need a canonical key so the same
 * underlying company collapses to one row across months.
 *
 * Rules — kept conservative because we have no CUI:
 *   - Lowercase.
 *   - Strip all punctuation (., ',', '-', '·', etc.).
 *   - Strip Romanian legal forms anywhere they appear as a standalone token:
 *     SRL, SRL-D, SA, SCA, SCS, SNC, PFA, II, IF, INC, LTD, GMBH.
 *   - Collapse runs of whitespace into one space.
 *   - Trim.
 *
 * We do NOT remove diacritics — "Țiriac" and "Tiriac" are not necessarily the
 * same partner and we'd rather have the user resolve it once than silently
 * merge. We do lower-case so "ȚIRIAC" and "Țiriac" do match.
 *
 * What this is NOT:
 *   - Not a fuzzy matcher. Two names that differ in spelling beyond punctuation
 *     and legal form remain distinct. The Sprint 4 review queue can later
 *     introduce probabilistic matching, but it must stay strictly suggestive
 *     (never auto-apply) per §5.2 of the language doc.
 */

const LEGAL_FORMS = new Set([
  "srl",
  "srld", // microintreprindere SRL-D
  "sa",
  "sca",
  "scs",
  "snc",
  "pfa",
  "ii",
  "if",
  "sc", // "S.C." prefix (Societate Comerciala) — universally a noise marker
  "inc",
  "ltd",
  "gmbh",
]);

const PUNCTUATION_RX = /[\p{P}\p{S}]+/gu;
const WHITESPACE_RX = /\s+/g;
// Dots that sit BETWEEN two letters — these belong to dotted legal forms like
// "s.r.l.", "s.c.", "p.f.a.". We strip them with empty string so the dotted
// form collapses to one token (s.r.l. → srl.) that the LEGAL_FORMS filter
// then catches. Distinct from a sentence-ending dot which has whitespace or
// EOL after it — we leave those for the general punctuation pass.
const DOT_BETWEEN_LETTERS_RX = /(?<=[\p{L}])\.(?=[\p{L}])/gu;

export function normalizePartnerName(input: string | null | undefined): string {
  if (!input) return "";

  let s = input.toLowerCase();

  // Compound legal forms with a dash ("srl-d" for microintreprindere) collapse
  // to the canonical key BEFORE general dash-to-space punctuation handling,
  // otherwise "SRL-D Eta" becomes ["srl", "d", "eta"] and the bare "d" survives.
  s = s.replace(/\bsrl-d\b/g, "srld");

  // Dotted legal forms: collapse "s.r.l." → "srl.", "s.c." → "sc.", etc.
  // The trailing dot is then removed by the general punctuation pass.
  s = s.replace(DOT_BETWEEN_LETTERS_RX, "");

  // Strip remaining punctuation (commas, sentence-ending dots, dashes, ·, …)
  // replacing with a space so adjacent words stay separate.
  s = s.replace(PUNCTUATION_RX, " ");

  const tokens = s.split(WHITESPACE_RX).filter(Boolean);
  const filtered = tokens.filter((tok) => !LEGAL_FORMS.has(tok));

  return filtered.join(" ").trim();
}
