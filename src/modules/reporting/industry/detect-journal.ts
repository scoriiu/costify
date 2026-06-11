/**
 * Industry detection from the registru jurnal itself.
 *
 * The OMFP revenue account structure is a confession of the business
 * model: 707+607+371 = comert, 704/705 = servicii, 701+711+345 =
 * productie, 706 = inchirieri, 766 as primary revenue = financiar.
 * We read the YTD revenue mix from the balance rows and classify.
 *
 * What the journal CANNOT tell apart: the flavor of services (IT,
 * contabilitate, marketing, telecom all look like 704/705). For those,
 * CAEN remains the only signal, which is why journal detection is a
 * FALLBACK (no CAEN, no manual pick) and a VALIDATOR (mismatch hint),
 * never an override.
 */

import type { BalanceRowView } from "@/modules/balances";
import type { IndustryId } from "./types";

export type JournalActivity =
  | "comert"
  | "servicii"
  | "productie"
  | "inchirieri"
  | "financiar";

export interface JournalIndustrySignal {
  activity: JournalActivity;
  /** Closest industry profile. Null when no profile fits yet
   *  (productie, inchirieri) and the caller stays on "general". */
  industry: IndustryId | null;
  /** Dominant revenue share (0-100) supporting the detection. */
  sharePercent: number;
  /** Plain-Romanian evidence, e.g. "62% din venituri provin din vanzarea
   *  de marfuri (cont 707), cu rulaj pe stocuri de marfa (371)". */
  evidence: string;
}

const ACTIVITY_LABEL: Record<JournalActivity, string> = {
  comert: "comert",
  servicii: "servicii",
  productie: "productie",
  inchirieri: "inchirieri",
  financiar: "activitate financiara",
};

export function journalActivityLabel(a: JournalActivity): string {
  return ACTIVITY_LABEL[a];
}

/** Minimum YTD revenue before we trust the mix. Below this the journal
 *  is too thin to say anything (new firm, single invoice). */
const MIN_REVENUE = 5_000;
const DOMINANT_SHARE = 50;
const TRADE_WITH_STOCK_SHARE = 30;
const SERVICES_SHARE = 60;

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function fmtPct(share: number): string {
  return share.toLocaleString("ro-RO", { maximumFractionDigits: 1 });
}

export function detectIndustryFromJournal(
  rows: BalanceRowView[]
): JournalIndustrySignal | null {
  let rev701_703 = 0;
  let rev704_705_708 = 0;
  let rev706 = 0;
  let rev707 = 0;
  let reduceri709 = 0;
  let rev766 = 0;
  let rulaj371 = 0;
  let rulaj711 = 0;

  for (const row of rows) {
    if (!row.isLeaf) continue;
    const b = row.contBase;
    if (b.startsWith("701") || b.startsWith("702") || b.startsWith("703")) {
      rev701_703 += row.totalCred;
    } else if (b.startsWith("704") || b.startsWith("705") || b.startsWith("708")) {
      rev704_705_708 += row.totalCred;
    } else if (b.startsWith("706")) {
      rev706 += row.totalCred;
    } else if (b.startsWith("707")) {
      rev707 += row.totalCred;
    } else if (b.startsWith("709")) {
      reduceri709 += row.totalDeb;
    } else if (b.startsWith("766")) {
      rev766 += row.totalCred;
    } else if (b.startsWith("371")) {
      rulaj371 += row.totalDeb + row.totalCred;
    } else if (b.startsWith("711") || b.startsWith("712")) {
      rulaj711 += row.totalCred;
    }
  }

  const operating = rev701_703 + rev704_705_708 + rev706 + rev707 - reduceri709;
  const total = operating + rev766;
  if (total < MIN_REVENUE) return null;

  // Financial businesses earn their living from interest: 766 outweighs
  // the entire operating revenue.
  if (rev766 > operating) {
    const share = pct(rev766, total);
    return {
      activity: "financiar",
      industry: "banking",
      sharePercent: share,
      evidence: `${fmtPct(share)}% din venituri provin din dobanzi (cont 766).`,
    };
  }

  if (operating <= 0) return null;

  const share707 = pct(rev707, operating);
  const share706 = pct(rev706, operating);
  const shareProd = pct(rev701_703, operating);
  const shareServ = pct(rev704_705_708, operating);
  const hasStockActivity = rulaj371 > 0;

  if (
    share707 >= DOMINANT_SHARE ||
    (share707 >= TRADE_WITH_STOCK_SHARE && hasStockActivity)
  ) {
    return {
      activity: "comert",
      industry: "retail",
      sharePercent: share707,
      evidence: hasStockActivity
        ? `${fmtPct(share707)}% din veniturile operationale provin din vanzarea de marfuri (cont 707), cu rulaj pe stocuri de marfa (cont 371).`
        : `${fmtPct(share707)}% din veniturile operationale provin din vanzarea de marfuri (cont 707).`,
    };
  }

  if (share706 >= DOMINANT_SHARE) {
    return {
      activity: "inchirieri",
      industry: "inchirieri",
      sharePercent: share706,
      evidence: `${fmtPct(share706)}% din veniturile operationale provin din chirii si redevente (cont 706).`,
    };
  }

  if (shareProd >= DOMINANT_SHARE || (shareProd >= TRADE_WITH_STOCK_SHARE && rulaj711 > 0)) {
    return {
      activity: "productie",
      industry: null,
      sharePercent: shareProd,
      evidence: `${fmtPct(shareProd)}% din veniturile operationale provin din vanzarea productiei proprii (conturi 701-703).`,
    };
  }

  if (shareServ >= SERVICES_SHARE) {
    return {
      activity: "servicii",
      industry: "consultanta",
      sharePercent: shareServ,
      evidence: `${fmtPct(shareServ)}% din veniturile operationale provin din prestari de servicii (conturi 704, 705, 708).`,
    };
  }

  return null;
}

/** Activities each profile is consistent with. "general" accepts anything. */
const PROFILE_ACTIVITIES: Record<IndustryId, JournalActivity[] | null> = {
  general: null,
  retail: ["comert"],
  consultanta: ["servicii"],
  servicii_contabile: ["servicii"],
  telecom: ["servicii"],
  banking: ["financiar"],
  inchirieri: ["inchirieri"],
};

/**
 * Returns true when the journal signal contradicts the resolved industry
 * profile. "general" never mismatches; signals without a profile mapping
 * (productie, inchirieri) mismatch any specific profile.
 */
export function isJournalMismatch(
  industry: IndustryId,
  signal: JournalIndustrySignal
): boolean {
  const accepted = PROFILE_ACTIVITIES[industry];
  if (accepted === null) return false;
  return !accepted.includes(signal.activity);
}
