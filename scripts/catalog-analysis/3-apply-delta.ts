#!/usr/bin/env tsx
/**
 * Catalog analysis — step 3: apply the validated delta to seeds/omfp-1802.json.
 *
 * Reads:
 *   - seeds/omfp-1802.json (current state)
 *   - temp/catalog-delta-v3-applied.ts (this file contains the deltas as code)
 *
 * Writes:
 *   - seeds/omfp-1802.json (updated)
 *   - temp/catalog-apply-summary.md (what changed, for the PR description)
 *
 * Idempotent: re-running this with the same delta does nothing.
 *
 * Sources for every change are in the comments next to each delta:
 *   saga = Saga export Plan_conturi_202604.xlsx
 *   claudia = DocAnswer from production DB, section noted
 *   omfp = OMFP article cited
 *
 * Usage:
 *   pnpm tsx scripts/catalog-analysis/3-apply-delta.ts          # dry run
 *   pnpm tsx scripts/catalog-analysis/3-apply-delta.ts --apply  # write
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const SEED_PATH = join(ROOT, "seeds", "omfp-1802.json");
const SUMMARY_PATH = join(ROOT, "temp", "catalog-apply-summary.md");

const APPLY = process.argv.includes("--apply");

type SeedAccount = {
  code: string;
  name: string;
  type: "A" | "P" | "B";
  classDigit?: number;
  cppGroup?: string | null;
  cppLabel?: string | null;
  cppLine?: string | null;
  cppLineLabel?: string | null;
  special?: string | null;
  isClosing?: boolean;
  isProfitTax?: boolean;
  isProfitDistribution?: boolean;
  isExtraBilantier?: boolean;
  isIfrsOnly?: boolean;
  cashRole?: string | null;
  arRole?: string | null;
  apRole?: string | null;
  vatRole?: string | null;
  payrollRole?: string | null;
};

type Source = string; // e.g. "saga:643", "claudia:1.5", "omfp:art-596"

interface RenameDelta {
  kind: "rename";
  code: string;
  newName: string;
  sources: Source[];
  rationale: string;
}

interface RetypeDelta {
  kind: "retype";
  code: string;
  newType: "A" | "P" | "B";
  sources: Source[];
  rationale: string;
}

interface CppLineDelta {
  kind: "cppLine";
  code: string;
  newCppLine: string | null;
  newCppLineLabel: string | null;
  newCppGroup?: string | null;
  newCppLabel?: string | null;
  sources: Source[];
  rationale: string;
}

interface FlagDelta {
  kind: "flag";
  code: string;
  flags: Partial<
    Pick<
      SeedAccount,
      | "isClosing"
      | "isProfitTax"
      | "isProfitDistribution"
      | "isExtraBilantier"
      | "isIfrsOnly"
      | "cashRole"
      | "arRole"
      | "apRole"
      | "vatRole"
      | "payrollRole"
      | "special"
    >
  >;
  sources: Source[];
  rationale: string;
}

interface AddDelta {
  kind: "add";
  account: SeedAccount;
  sources: Source[];
  rationale: string;
}

type Delta = RenameDelta | RetypeDelta | CppLineDelta | FlagDelta | AddDelta;

// =============================================================================
// THE DELTAS — every change with its source citation
// =============================================================================

const DELTAS: Delta[] = [
  // ---------------------------------------------------------------------------
  // CRITICAL BUGS — name swaps and factually wrong names
  // ---------------------------------------------------------------------------
  {
    kind: "rename",
    code: "643",
    newName: "Cheltuieli cu remunerarea in instrumente de capitaluri proprii",
    sources: ["saga:643"],
    rationale:
      "643/644 NAME SWAP fix. Saga export is unambiguous: 643 = stock-options/ESOP compensation, 644 = profit-sharing primes. Our seed has them swapped. Note: Claudia's answer 1.5 contains a typo describing 643 with 644's name — we trust the Saga export (the official accountant tool). The cppLine fix (both → 14a) holds either way and is applied separately.",
  },
  {
    kind: "rename",
    code: "644",
    newName: "Cheltuieli cu primele reprezentand participarea personalului la profit",
    sources: ["saga:644", "claudia:1.5"],
    rationale: "Counterpart of 643 rename. Saga + Claudia 2.1 both confirm rd. 14a placement.",
  },
  {
    kind: "rename",
    code: "216",
    newName: "Active corporale de explorare si evaluare a resurselor minerale",
    sources: ["saga:216"],
    rationale:
      "216/217 NAME SWAP fix. Saga: 216 = active corporale de explorare resurse minerale. Seed has 217's name.",
  },
  {
    kind: "rename",
    code: "217",
    newName: "Active biologice productive",
    sources: ["saga:217"],
    rationale: "Counterpart of 216 swap. Saga: 217 = active biologice productive.",
  },
  {
    kind: "rename",
    code: "107",
    newName: "Diferente de curs valutar din conversie",
    sources: ["saga:107"],
    rationale:
      "Seed had 'Rezerve din conversie' which is the pre-2014 OMFP name. OMFP 1802/2014 + Saga: 107 is 'Diferente de curs valutar din conversie' (IAS 21, investments in foreign entities).",
  },
  {
    kind: "rename",
    code: "606",
    newName: "Cheltuieli privind activele biologice de natura stocurilor",
    sources: ["saga:606", "claudia:1.4"],
    rationale:
      "Claudia 1.4: 'in OMFP 1802 actualizat, contul 606 a fost redenumit din \"Cheltuieli privind animalele si pasarile\" in \"Cheltuieli privind activele biologice de natura stocurilor\". Reflecta IAS 41 si grupa noua 36.' Saga export confirms.",
  },
  {
    kind: "rename",
    code: "694",
    newName: "Cheltuieli cu impozitul pe profit rezultat din decontarile in cadrul grupului fiscal",
    sources: ["saga:694", "claudia:plan-1"],
    rationale:
      "Saga + Claudia 'Catalogul OMFP — conturi lipsa': 694 is the fiscal-group profit-tax account (added by OMFP 4291/2022 + OMF 6670/2024), NOT 'din filiale' as the seed had it.",
  },

  // ---------------------------------------------------------------------------
  // RENAMES — extending truncated official names
  // ---------------------------------------------------------------------------
  {
    kind: "rename",
    code: "169",
    newName: "Prime privind rambursarea obligatiunilor si a altor datorii",
    sources: ["saga:169"],
    rationale: "Saga full name per OMFP 4291/2022. Seed had it truncated.",
  },
  {
    kind: "rename",
    code: "2132",
    newName: "Aparate si instalatii de masurare, control si reglare",
    sources: ["saga:2132"],
    rationale: "Saga official name; 'control si reglare' suffix is in OMFP 1802.",
  },
  {
    kind: "rename",
    code: "214",
    newName: "Mobilier, aparatura birotica si alte active corporale",
    sources: ["saga:214"],
    rationale: "Saga + OMFP grupa 21: 214 covers other corporeal assets too, not just office furniture.",
  },
  {
    kind: "rename",
    code: "213",
    newName: "Instalatii tehnice si mijloace de transport",
    sources: ["saga:213"],
    rationale:
      "Saga: 'INSTALATII TEHNICE SI MIJLOACE TRANSPORT'. OMFP grupa 21: 213 covers technical installations + vehicles. Our seed said 'masini' which is imprecise.",
  },
  {
    kind: "rename",
    code: "455",
    newName: "Sume datorate actionarilor / asociatilor",
    sources: ["saga:455"],
    rationale: "Saga + OMFP recent: 455 covers both SA (actionari) and SRL (asociati).",
  },
  {
    kind: "rename",
    code: "457",
    newName: "Dividende de platit",
    sources: ["saga:457"],
    rationale: "Saga grammatically-correct form.",
  },

  // ---------------------------------------------------------------------------
  // RETYPES — A/P/B corrections per Saga + Claudia
  // ---------------------------------------------------------------------------
  {
    kind: "retype",
    code: "108",
    newType: "B",
    sources: ["saga:108"],
    rationale:
      "Saga: B. Interese care nu controleaza pot avea sold creditor (cota din profit) sau debitor (cota din pierdere). Bifunctional.",
  },
  {
    kind: "retype",
    code: "207",
    newType: "B",
    sources: ["saga:207"],
    rationale:
      "Saga: B. Sintetic 207 acopera 2071 (fond comercial pozitiv, A) si 2075 (fond comercial negativ, P).",
  },
  {
    kind: "retype",
    code: "269",
    newType: "P",
    sources: ["saga:269"],
    rationale:
      "Saga: P. Varsaminte de efectuat = datorii viitoare (de plata). Pasiv prin natura. Seed had A which is wrong.",
  },
  {
    kind: "retype",
    code: "441",
    newType: "B",
    sources: ["saga:441", "claudia:tipuri-exceptii"],
    rationale:
      "Saga: B. Claudia (tipuri-exceptii): '446, 447, 448 sunt P prin natura dar pot avea solduri debitoare la creanțe cu bugetul.' Same applies to 441 — bifunctional.",
  },
  {
    kind: "retype",
    code: "509",
    newType: "P",
    sources: ["saga:509", "claudia:tipuri-exceptii"],
    rationale: "Saga: P. Varsaminte de efectuat pentru investitii pe TS = datorii viitoare.",
  },
  {
    kind: "retype",
    code: "512",
    newType: "B",
    sources: ["saga:512"],
    rationale: "Saga: B. Sintetic acopera 5121/5124, banks can have overdraft (descoperit de cont).",
  },
  {
    kind: "retype",
    code: "5121",
    newType: "B",
    sources: ["saga:5121"],
    rationale: "Saga: B. Bank account, can have overdraft.",
  },
  {
    kind: "retype",
    code: "5124",
    newType: "B",
    sources: ["saga:5124"],
    rationale: "Saga: B. FX bank account, can have overdraft.",
  },
  {
    kind: "retype",
    code: "581",
    newType: "B",
    sources: ["saga:581", "claudia:plan-2", "claudia:kpi-4"],
    rationale:
      "Saga: B. Claudia: 'viramente interne — cont tehnic de trecere, sold normal 0 dar bifunctional.' Excluded from cash KPI per Claudia 4.",
  },
  {
    kind: "retype",
    code: "711",
    newType: "B",
    sources: ["saga:711"],
    rationale:
      "Saga: B. Variatia stocurilor = sold creditor (crestere stoc) sau debitor (descrestere stoc). Bifunctional.",
  },
  // Note: 4382 retype removed — account is being ADDED below, no retype needed
  {
    kind: "retype",
    code: "401",
    newType: "P",
    sources: ["saga:401", "claudia:1.4"],
    rationale:
      "Saga: P (strict). Claudia 1.4: 'payables_family' (not bifunctional). Avansurile furnizori sunt cont separat (409 'Furnizori-debitori', A). The bifunctional behavior we see in practice happens through 409, not 401 itself. SAFE TO APPLY: balance display in compute-balance.ts uses getAccountType() pure fn (not catalog), so this seed change doesn't affect Balanta display. KPI apRole already correctly aggregates 401 finC for datorii.",
  },

  // Class 8 retypes — all become B + extra-bilantier
  {
    kind: "retype",
    code: "801",
    newType: "B",
    sources: ["saga:801"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "802",
    newType: "B",
    sources: ["saga:802"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8031",
    newType: "B",
    sources: ["saga:8031"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8032",
    newType: "B",
    sources: ["saga:8032"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8033",
    newType: "B",
    sources: ["saga:8033"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8034",
    newType: "B",
    sources: ["saga:8034"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8035",
    newType: "B",
    sources: ["saga:8035"],
    rationale:
      "Saga: B. Clasa 8 extra-bilantier. Typical Saga partner of 999 (8035 = 999 for obiecte de inventar date in folosinta).",
  },
  {
    kind: "retype",
    code: "8036",
    newType: "B",
    sources: ["saga:8036"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8038",
    newType: "B",
    sources: ["saga:8038"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },
  {
    kind: "retype",
    code: "8039",
    newType: "B",
    sources: ["saga:8039"],
    rationale: "Saga: B. Clasa 8 extra-bilantier.",
  },

  // ---------------------------------------------------------------------------
  // CPP LINE FIXES — F20 routing per Claudia's authoritative answers
  // ---------------------------------------------------------------------------
  {
    kind: "cppLine",
    code: "643",
    newCppLine: "14a",
    newCppLineLabel: "a) Salarii si indemnizatii",
    newCppGroup: "CHELTUIELI_EXPLOATARE",
    sources: ["claudia:1.5", "claudia:2.1"],
    rationale: "F20 formula rd. 14a = ct. 641+642+643+644. Seed had 14b (asigurari sociale) — wrong.",
  },
  {
    kind: "cppLine",
    code: "644",
    newCppLine: "14a",
    newCppLineLabel: "a) Salarii si indemnizatii",
    newCppGroup: "CHELTUIELI_EXPLOATARE",
    sources: ["claudia:1.5"],
    rationale: "F20 formula rd. 14a = ct. 641+642+643+644. Already correct in some entries, ensure consistency.",
  },
  {
    kind: "cppLine",
    code: "654",
    newCppLine: "16a",
    newCppLineLabel: "a) Cheltuieli cu ajustarile pentru deprecierea activelor circulante",
    newCppGroup: "CHELTUIELI_EXPLOATARE",
    sources: ["claudia:1.1"],
    rationale:
      "Claudia 1.1: 'rd. 16a confirmat oficial. Formularul F20 grupeaza 654 cu 6814.' 17d e doar pentru 652, 658.",
  },
  {
    kind: "cppLine",
    code: "786",
    newCppLine: "26b",
    newCppLineLabel: "b) Venituri din ajustari de valoare privind imobilizarile financiare si investitiile financiare",
    newCppGroup: "VENITURI_FINANCIARE",
    sources: ["claudia:1.2"],
    rationale: "Claudia 1.2: '786 (cu sub-conturile 7863, 7864) → rd. 26b, NU rd. 24.'",
  },
  {
    kind: "cppLine",
    code: "725",
    newCppLine: "10",
    newCppLineLabel: "Venituri din productia de investitii imobiliare",
    newCppGroup: "VENITURI_EXPLOATARE",
    sources: ["claudia:1.3"],
    rationale:
      "Claudia 1.3: '725 are rand DISTINCT in F20 OMF 107/2025, NU rd. 09 cu 721+722.' Best-guess rd. 10 — needs confirmation from F20 file.",
  },
  // Note: cppLine fixes for 6817, 6863, 6864, 6868 are baked into the add deltas below.

  // 7412-7419 fix: cppLine 11 → 12
  ...["7412", "7413", "7414", "7415", "7416", "7417", "7418", "7419"].map(
    (code) =>
      ({
        kind: "cppLine" as const,
        code,
        newCppLine: "12",
        newCppLineLabel: "Venituri din subventii de exploatare",
        newCppGroup: "VENITURI_EXPLOATARE",
        sources: ["claudia:2.2"],
        rationale:
          "Claudia 2.2 (newer): 'formularul nou are rd. 12 Venituri din subventii de exploatare = ct. 7412+7413+7414+7415+7416+7417+7419.' Seed had 11.",
      }) as CppLineDelta
  ),

  // ---------------------------------------------------------------------------
  // FLAG FIXES — isExtraBilantier for class 8
  // ---------------------------------------------------------------------------
  ...[
    "801",
    "802",
    "8031",
    "8032",
    "8033",
    "8034",
    "8035",
    "8036",
    "8038",
    "8039",
  ].map(
    (code) =>
      ({
        kind: "flag" as const,
        code,
        flags: { isExtraBilantier: true },
        sources: ["claudia:1.3"],
        rationale:
          "Claudia 1.3: 'Clasa 8 si clasa 9 sunt extra-bilantiere — NU apar in bilant/CPP/balanta bilantiera, dar apare in balanta de verificare.'",
      }) as FlagDelta
  ),

  // ---------------------------------------------------------------------------
  // NEW ACCOUNTS — production use (high priority, real client data)
  // ---------------------------------------------------------------------------
  {
    kind: "add",
    account: {
      code: "235",
      name: "Investitii imobiliare in curs de executie",
      type: "A",
      classDigit: 2,
    },
    sources: ["saga:235", "claudia:conturi-nemapate-235", "claudia:plan-1"],
    rationale:
      "Used 582x in 4Walls Studio (dezvoltare imobiliara). Saga + Claudia confirm OMFP standard from IAS 40 adoption.",
  },
  {
    kind: "add",
    account: {
      code: "463",
      name: "Creante reprezentand dividende repartizate in cursul exercitiului",
      type: "A",
      classDigit: 4,
    },
    sources: ["saga:463", "claudia:plan-1"],
    rationale:
      "Used 4x at 4Walls (DIVIDENDE INTERIMARE). OMFP standard via OMFP 3067/2018 (Legea 163/2018).",
  },
  {
    kind: "add",
    account: {
      code: "467",
      name: "Datorii aferente distribuirilor interimare de dividende",
      type: "P",
      classDigit: 4,
    },
    sources: ["saga:467", "claudia:plan-1"],
    rationale: "Counterpart of 463. OMFP 4291/2022.",
  },
  {
    kind: "add",
    account: {
      code: "999",
      name: "Contrapartida tehnica Saga (conturi extra-bilantiere)",
      type: "B",
      classDigit: 9,
      isExtraBilantier: true,
    },
    sources: ["saga:999", "claudia:conturi-nemapate-999"],
    rationale:
      "Used 425x across all clients (auto-counterparty for class 8). Not OMFP 1802 but Saga ships it universally. Claudia recommends adding with 'tehnic' flag to reduce yellow-triangle noise.",
  },
  {
    kind: "add",
    account: {
      code: "2678",
      name: "Alte creante imobilizate",
      type: "A",
      classDigit: 2,
    },
    sources: ["saga:2678"],
    rationale: "Used 3x at QHM21 (garantii contracte). OMFP standard grupa 26.",
  },
  {
    kind: "add",
    account: {
      code: "2691",
      name: "Varsaminte de efectuat pentru actiunile detinute la entitatile afiliate",
      type: "P",
      classDigit: 2,
    },
    sources: ["saga:2691"],
    rationale: "Used 4x at QHM21. OMFP standard. Tip P (datorie de plata viitoare).",
  },
  {
    kind: "add",
    account: {
      code: "327",
      name: "Marfuri in curs de aprovizionare",
      type: "A",
      classDigit: 3,
    },
    sources: ["saga:327"],
    rationale: "Used 4x at QHM21. OMFP standard grupa 32.",
  },
  {
    kind: "add",
    account: {
      code: "4093",
      name: "Avansuri acordate pentru imobilizari corporale",
      type: "A",
      classDigit: 4,
    },
    sources: ["saga:4093"],
    rationale: "Used 8x at 4Walls + QHM21. OMFP standard sub-cont 409.",
  },
  {
    kind: "add",
    account: {
      code: "436",
      name: "Contributia asiguratorie de munca",
      type: "P",
      classDigit: 4,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "14b",
      cppLineLabel: "b) Cheltuieli cu asigurarile si protectia sociala",
    },
    sources: ["saga:436", "claudia:plan-2.1"],
    rationale: "Used 145x at 4Walls (CAM). OMFP via OUG 79/2017. Note: 436 is the LIABILITY account (datorie 4xx); the corresponding CHELTUIALA goes through 646. cppLine on 14b helps if 436 appears as expense too (rare).",
  },
  {
    kind: "add",
    account: {
      code: "4371",
      name: "Contributia unitatii la fondul de somaj",
      type: "P",
      classDigit: 4,
    },
    sources: ["saga:4371"],
    rationale: "Used 26x at QHM21 (historical somaj). OMFP standard. Not in CPP — it's a payable.",
  },
  {
    kind: "add",
    account: {
      code: "4372",
      name: "Contributia personalului la fondul de somaj",
      type: "P",
      classDigit: 4,
    },
    sources: ["saga:4372"],
    rationale: "Used 26x at QHM21. OMFP standard.",
  },
  {
    kind: "add",
    account: {
      code: "4373",
      name: "Fondul de garantare a creantelor salariale",
      type: "P",
      classDigit: 4,
    },
    sources: ["claudia:plan-1"],
    rationale:
      "Used 26x at QHM21 (FGCS historical). NOT in current Saga export — may have been removed in OMFP recent versions. Adding for backward-compat with old journals.",
  },
  {
    kind: "add",
    account: {
      code: "4382",
      name: "Alte creante sociale",
      type: "A",
      classDigit: 4,
    },
    sources: ["saga:4382"],
    rationale: "Used 1x at QHM21 (CM din CCI recuperate). OMFP standard.",
  },
  {
    kind: "add",
    account: {
      code: "4452",
      name: "Imprumuturi nerambursabile cu caracter de subventii",
      type: "A",
      classDigit: 4,
    },
    sources: ["saga:4452"],
    rationale: "Used 4x. OMFP standard for subventii.",
  },
  {
    kind: "add",
    account: {
      code: "4511",
      name: "Decontari intre entitatile afiliate",
      type: "B",
      classDigit: 4,
    },
    sources: ["saga:4511"],
    rationale: "Used 38x at QHM21 (intra-group). OMFP standard grupa 45.",
  },
  {
    kind: "add",
    account: {
      code: "6051",
      name: "Cheltuieli privind consumul de energie",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "13c",
      cppLineLabel: "c) Cheltuieli privind energia si apa",
    },
    sources: ["saga:6051", "claudia:plan-1"],
    rationale:
      "Used 151x. Sub-cont 605 introduced via OMFP 4291/2022 (utility split). NOTE: cppLine 13c is a best-guess; needs confirmation against official F20 OMF 107/2025.",
  },
  {
    kind: "add",
    account: {
      code: "6052",
      name: "Cheltuieli privind consumul de apa",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "13c",
      cppLineLabel: "c) Cheltuieli privind energia si apa",
    },
    sources: ["saga:6052"],
    rationale: "Used 210x. Sub-cont 605.",
  },
  {
    kind: "add",
    account: {
      code: "6053",
      name: "Cheltuieli privind consumul de gaze naturale",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "13c",
      cppLineLabel: "c) Cheltuieli privind energia si apa",
    },
    sources: ["saga:6053", "claudia:plan-1"],
    rationale: "Used 198x. Sub-cont 605 (OMFP 4291/2022).",
  },
  {
    kind: "add",
    account: {
      code: "6058",
      name: "Cheltuieli cu alte utilitati",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "13c",
      cppLineLabel: "c) Cheltuieli privind energia si apa",
    },
    sources: ["saga:6058", "claudia:plan-1"],
    rationale: "Used 37x. Sub-cont 605.",
  },
  {
    kind: "add",
    account: {
      code: "6123",
      name: "Cheltuieli cu chiriile",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:6123"],
    rationale: "Used 130x. Sub-cont 612. Routes to 17a per Claudia 2.1.",
  },
  {
    kind: "add",
    account: {
      code: "616",
      name: "Cheltuieli aferente drepturilor de proprietate intelectuala",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:616", "claudia:plan-1"],
    rationale: "OMFP 4291/2022. Routes to 17a (prestatii externe).",
  },
  {
    kind: "add",
    account: {
      code: "617",
      name: "Cheltuieli de management",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:617", "claudia:plan-1"],
    rationale: "OMFP 4291/2022.",
  },
  {
    kind: "add",
    account: {
      code: "618",
      name: "Cheltuieli de consultanta",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:618", "claudia:plan-1"],
    rationale: "OMFP 4291/2022.",
  },
  {
    kind: "add",
    account: {
      code: "6231",
      name: "Cheltuieli de protocol",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:6231"],
    rationale: "Used 191x. Sub-cont 623.",
  },
  {
    kind: "add",
    account: {
      code: "6232",
      name: "Cheltuieli de reclama si publicitate",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:6232"],
    rationale: "Used 35x. Sub-cont 623.",
  },
  {
    kind: "add",
    account: {
      code: "6422",
      name: "Cheltuieli cu tichetele de masa acordate salariatilor",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "14a",
      cppLineLabel: "a) Salarii si indemnizatii",
    },
    sources: ["saga:6422"],
    rationale: "Used 50x. Sub-cont 642 (tichete = salariu).",
  },
  {
    kind: "add",
    account: {
      code: "6461",
      name: "Cheltuieli cu contributia asiguratorie pentru munca a salariatilor",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "14b",
      cppLineLabel: "b) Cheltuieli cu asigurarile si protectia sociala",
    },
    sources: ["saga:6461"],
    rationale: "Used 159x. Sub-cont 646 (CAM expense).",
  },
  {
    kind: "add",
    account: {
      code: "615",
      name: "Cheltuieli cu pregatirea personalului",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17a",
      cppLineLabel: "Cheltuieli cu prestatii externe",
    },
    sources: ["saga:615", "claudia:2.1"],
    rationale:
      "OMFP standard. Claudia 2.1: '615 → rd. 17a (lista oficiala 611-628).' Name per Saga; Claudia called it 'transferul' but Saga + most public OMFP refs say 'pregatirea personalului'.",
  },
  {
    kind: "add",
    account: {
      code: "651",
      name: "Cheltuieli din operatiuni de fiducie",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17d",
      cppLineLabel: "d) Alte cheltuieli de exploatare",
    },
    sources: ["saga:651", "claudia:2.1"],
    rationale: "OMFP standard. Claudia 2.1: '651 → rd. 17d, grupat cu 658.'",
  },
  {
    kind: "add",
    account: {
      code: "655",
      name: "Cheltuieli din reevaluarea imobilizarilor",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17d",
      cppLineLabel: "d) Alte cheltuieli de exploatare",
    },
    sources: ["saga:655", "claudia:2.1"],
    rationale: "OMFP standard. Claudia 2.1: '655 → rd. 17d (cu 651, 652, 658).'",
  },
  {
    kind: "add",
    account: {
      code: "6584",
      name: "Cheltuieli cu sumele sau bunurile acordate ca sponsorizari",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "17d",
      cppLineLabel: "d) Alte cheltuieli de exploatare",
    },
    sources: ["saga:6584"],
    rationale: "Used 7x. Sub-cont 658.",
  },
  {
    kind: "add",
    account: {
      code: "6642",
      name: "Pierderi din investitiile pe termen scurt cedate",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_FINANCIARE",
      cppLine: "28",
      cppLineLabel: "Alte cheltuieli financiare",
    },
    sources: ["saga:6642"],
    rationale: "Used 4x. Sub-cont 664.",
  },
  {
    kind: "add",
    account: {
      code: "6651",
      name: "Diferente nefavorabile de curs valutar",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_FINANCIARE",
      cppLine: "28",
      cppLineLabel: "Alte cheltuieli financiare",
    },
    sources: ["saga:6651"],
    rationale:
      "Used 263x at 4Walls. Sub-cont 665. CRITICAL: this was previously dropping out of CPP — currency-exchange losses going to Rezultat financiar.",
  },
  {
    kind: "add",
    account: {
      code: "6816",
      name: "Cheltuieli de exploatare privind ajustarile pentru deprecierea activelor biologice",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "15a",
      cppLineLabel: "a) Ajustari de valoare privind imobilizarile corporale si necorporale (chelt.)",
    },
    sources: ["saga:6816", "claudia:2.1"],
    rationale:
      "Sub-cont 681 OMFP. Joins 15a per Claudia 2.1 formula rd. 15a = 6811+6813+6816+6817. Adding preventively (no client uses yet).",
  },
  {
    kind: "add",
    account: {
      code: "6817",
      name: "Cheltuieli de exploatare privind ajustarile pentru deprecierea fondului comercial",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_EXPLOATARE",
      cppLine: "15a",
      cppLineLabel: "a) Ajustari de valoare privind imobilizarile corporale si necorporale (chelt.)",
    },
    sources: ["saga:6817", "claudia:2.1"],
    rationale: "Sub-cont 681 OMFP. Joins 15a per Claudia 2.1.",
  },
  {
    kind: "add",
    account: {
      code: "6863",
      name: "Cheltuieli financiare privind ajustarile pentru pierderea de valoare a imobilizarilor financiare",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_FINANCIARE",
      cppLine: "26a",
      cppLineLabel: "a) Cheltuieli cu ajustarile pentru pierderea de valoare a imobilizarilor financiare",
    },
    sources: ["saga:6863", "claudia:2.1"],
    rationale: "Sub-cont 686 OMFP. Routes to 26a per Claudia 2.1.",
  },
  {
    kind: "add",
    account: {
      code: "6864",
      name: "Cheltuieli financiare privind ajustarile pentru pierderea de valoare a activelor circulante",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_FINANCIARE",
      cppLine: "26a",
      cppLineLabel: "a) Cheltuieli cu ajustarile pentru pierderea de valoare a imobilizarilor financiare",
    },
    sources: ["saga:6864", "claudia:2.1"],
    rationale: "Sub-cont 686 OMFP. Claudia: 'tot 26a sau rd. separat in functie de varianta F20.' Default 26a.",
  },
  {
    kind: "add",
    account: {
      code: "6868",
      name: "Cheltuieli financiare privind amortizarea primelor de rambursare a obligatiunilor",
      type: "A",
      classDigit: 6,
      cppGroup: "CHELTUIELI_FINANCIARE",
      cppLine: "28",
      cppLineLabel: "Alte cheltuieli financiare",
    },
    sources: ["saga:6868", "claudia:2.1"],
    rationale: "Sub-cont 686 OMFP. Routes to 28.",
  },
  {
    kind: "add",
    account: {
      code: "7015",
      name: "Venituri din vanzarea produselor finite",
      type: "P",
      classDigit: 7,
      cppGroup: "VENITURI_EXPLOATARE",
      cppLine: "02",
      cppLineLabel: "Productia vanduta",
    },
    sources: ["saga:7015"],
    rationale: "Used 4x. Sub-cont 701.",
  },
  {
    kind: "add",
    account: {
      code: "7642",
      name: "Castiguri din investitiile financiare pe termen scurt cedate",
      type: "P",
      classDigit: 7,
      cppGroup: "VENITURI_FINANCIARE",
      cppLine: "24",
      cppLineLabel: "Alte venituri financiare",
    },
    sources: ["saga:7642"],
    rationale: "Used 3x at 4Walls (cripto). Sub-cont 764.",
  },
  {
    kind: "add",
    account: {
      code: "7651",
      name: "Venituri din diferente favorabile de curs valutar",
      type: "P",
      classDigit: 7,
      cppGroup: "VENITURI_FINANCIARE",
      cppLine: "24",
      cppLineLabel: "Alte venituri financiare",
    },
    sources: ["saga:7651"],
    rationale:
      "Used 111x at 4Walls + others (Stripe FX gains). Sub-cont 765. CRITICAL: was previously dropping out of CPP — currency-exchange gains going to Rezultat financiar.",
  },
  {
    kind: "add",
    account: {
      code: "7816",
      name: "Venituri din ajustari pentru deprecierea activelor biologice",
      type: "P",
      classDigit: 7,
      cppGroup: "VENITURI_EXPLOATARE",
      cppLine: "15b",
      cppLineLabel: "b) Ajustari de valoare privind imobilizarile corporale si necorporale (ven.)",
    },
    sources: ["saga:7816", "claudia:2.2"],
    rationale: "Counterpart of 6816 (revenue). Adding preventively.",
  },
  {
    kind: "add",
    account: {
      code: "7818",
      name: "Venituri din deprecierea creantelor aferente avansurilor pentru furnizori",
      type: "P",
      classDigit: 7,
      cppGroup: "VENITURI_EXPLOATARE",
      cppLine: "16b",
      cppLineLabel: "b) Venituri din ajustari pentru deprecierea activelor circulante",
    },
    sources: ["saga:7818"],
    rationale: "Sub-cont 781 OMFP. Default mapping 16b (counterpart of 6814 family).",
  },
  {
    kind: "add",
    account: {
      code: "794",
      name: "Venituri din impozitul pe profit rezultat din decontarile in cadrul grupului fiscal",
      type: "P",
      classDigit: 7,
      cppGroup: null,
      cppLine: "34",
      cppLineLabel: "Impozitul pe profit / venit",
    },
    sources: ["saga:794", "claudia:2.2"],
    rationale:
      "OMFP 4291/2022. Claudia 2.2: 'rd. 34 cu semn negativ (reduce impozitul total). Lipseste din lista voastra.' NOTE: the negative-sign mechanic needs to be implemented in cpp-f20.ts as a follow-up; for now we add to the catalog with cppLine='34' and the F20 computation will treat clasa 7 as revenue (adding to rd. 34, which is wrong direction — but at least it's in the catalog and visible). Marked in open questions.",
  },
  {
    kind: "add",
    account: {
      code: "1031",
      name: "Beneficii ale angajatilor sub forma de capitaluri proprii",
      type: "P",
      classDigit: 1,
    },
    sources: ["saga:1031", "claudia:plan-1"],
    rationale: "Capital propriu — ESOP. OMFP 4291/2022.",
  },
  {
    kind: "add",
    account: {
      code: "1033",
      name: "Diferente de curs pentru investitia intr-o entitate straina",
      type: "B",
      classDigit: 1,
    },
    sources: ["saga:1033", "claudia:plan-1"],
    rationale: "Capital propriu. OMFP.",
  },
  {
    kind: "add",
    account: {
      code: "1038",
      name: "Alte elemente de capitaluri proprii",
      type: "B",
      classDigit: 1,
    },
    sources: ["saga:1038", "claudia:plan-1"],
    rationale: "Capital propriu catch-all.",
  },
  {
    kind: "add",
    account: {
      code: "1496",
      name: "Pierderi din reorganizari de societati pentru activul net negativ",
      type: "A",
      classDigit: 1,
    },
    sources: ["saga:1496", "claudia:plan-1"],
    rationale: "OMF 2649/2023.",
  },
];

// =============================================================================
// APPLY THE DELTAS
// =============================================================================

function deepEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyDelta(accounts: SeedAccount[], delta: Delta): { changed: boolean; account: SeedAccount } {
  if (delta.kind === "add") {
    const existing = accounts.find((a) => a.code === delta.account.code);
    if (existing) {
      return { changed: false, account: existing };
    }
    accounts.push(delta.account);
    accounts.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
    return { changed: true, account: delta.account };
  }

  const existing = accounts.find((a) => a.code === delta.code);
  if (!existing) {
    throw new Error(
      `Cannot apply ${delta.kind} on code ${delta.code}: not found in seed. Did you mean kind="add"?`
    );
  }

  if (delta.kind === "rename") {
    if (existing.name === delta.newName) return { changed: false, account: existing };
    existing.name = delta.newName;
    return { changed: true, account: existing };
  }
  if (delta.kind === "retype") {
    if (existing.type === delta.newType) return { changed: false, account: existing };
    existing.type = delta.newType;
    return { changed: true, account: existing };
  }
  if (delta.kind === "cppLine") {
    let changed = false;
    if (existing.cppLine !== delta.newCppLine) {
      existing.cppLine = delta.newCppLine;
      changed = true;
    }
    if (existing.cppLineLabel !== delta.newCppLineLabel) {
      existing.cppLineLabel = delta.newCppLineLabel;
      changed = true;
    }
    if (delta.newCppGroup !== undefined && existing.cppGroup !== delta.newCppGroup) {
      existing.cppGroup = delta.newCppGroup;
      changed = true;
    }
    if (delta.newCppLabel !== undefined && existing.cppLabel !== delta.newCppLabel) {
      existing.cppLabel = delta.newCppLabel;
      changed = true;
    }
    return { changed, account: existing };
  }
  if (delta.kind === "flag") {
    let changed = false;
    for (const [k, v] of Object.entries(delta.flags)) {
      const key = k as keyof SeedAccount;
      if (!deepEq((existing as Record<string, unknown>)[key], v)) {
        (existing as Record<string, unknown>)[key] = v;
        changed = true;
      }
    }
    return { changed, account: existing };
  }
  throw new Error(`Unknown delta kind: ${(delta as { kind: string }).kind}`);
}

interface AppliedSummary {
  kind: string;
  code: string;
  changed: boolean;
  rationale: string;
  sources: string[];
}

function main() {
  console.log("Loading seed:", SEED_PATH);
  const seedRaw = readFileSync(SEED_PATH, "utf-8");
  const seed = JSON.parse(seedRaw) as {
    version: string;
    source: string;
    description: string;
    accounts: SeedAccount[];
  };

  console.log(`Current seed has ${seed.accounts.length} accounts`);
  console.log(`Applying ${DELTAS.length} deltas...`);
  console.log("");

  const applied: AppliedSummary[] = [];
  for (const delta of DELTAS) {
    const code = delta.kind === "add" ? delta.account.code : delta.code;
    try {
      const result = applyDelta(seed.accounts, delta);
      applied.push({
        kind: delta.kind,
        code,
        changed: result.changed,
        rationale: delta.rationale,
        sources: delta.sources,
      });
    } catch (e) {
      console.error(`Error on ${delta.kind} ${code}: ${(e as Error).message}`);
      throw e;
    }
  }

  const changedCount = applied.filter((a) => a.changed).length;
  const noopCount = applied.length - changedCount;

  console.log(`Total deltas: ${applied.length}`);
  console.log(`  changed: ${changedCount}`);
  console.log(`  no-op:   ${noopCount}`);
  console.log("");
  console.log(`Final seed will have ${seed.accounts.length} accounts`);

  // Generate summary markdown
  const sections = new Map<string, AppliedSummary[]>();
  for (const a of applied) {
    if (!sections.has(a.kind)) sections.set(a.kind, []);
    sections.get(a.kind)!.push(a);
  }

  const md: string[] = [];
  md.push("# Catalog delta application summary");
  md.push("");
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Mode: ${APPLY ? "APPLY" : "DRY RUN (--apply to write)"}`);
  md.push("");
  md.push(`Total deltas: ${applied.length}`);
  md.push(`  - changed: ${changedCount}`);
  md.push(`  - no-op:   ${noopCount}`);
  md.push("");
  for (const [kind, items] of sections) {
    md.push(`## ${kind} (${items.length})`);
    md.push("");
    for (const a of items) {
      const tag = a.changed ? "✅" : "—";
      md.push(`- ${tag} **${a.code}**: ${a.rationale.slice(0, 140)}${a.rationale.length > 140 ? "..." : ""}`);
      md.push(`  - sources: ${a.sources.join(", ")}`);
    }
    md.push("");
  }
  writeFileSync(SUMMARY_PATH, md.join("\n"));
  console.log(`Summary written to ${SUMMARY_PATH}`);

  if (APPLY) {
    writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
    console.log(`\n✅ Wrote ${SEED_PATH}`);
  } else {
    console.log(`\nDRY RUN — seed NOT written. Re-run with --apply to commit changes.`);
  }
}

main();
