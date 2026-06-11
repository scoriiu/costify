/**
 * Declarative KPI registry. Every KPI is defined once, with:
 *   - bilingual labels + formulas (contabil OMFP vocabulary / antreprenor plain Romanian)
 *   - the input aggregates it consumes (for the debug trace)
 *   - a pure compute returning the value AND the substituted calculation string
 *   - default thresholds (industry profiles may override, see profiles.ts)
 *
 * Source of the formulas and thresholds: docs/kpi/KPI_Formule_CFO.xlsx and
 * docs/kpi/Checklist_Controlling_Industrii.xlsx.
 */

import type {
  KpiBaseInputs,
  KpiFormat,
  KpiGroupId,
  KpiThreshold,
} from "./types";

export interface KpiDefinition {
  id: string;
  group: KpiGroupId;
  labelContabil: string;
  labelAntreprenor: string;
  formulaContabil: string;
  formulaAntreprenor: string;
  format: KpiFormat;
  /** Which base aggregates enter the formula — drives the inputs trace. */
  inputIds: Array<keyof Omit<KpiBaseInputs, "monthsElapsed">>;
  compute: (i: KpiBaseInputs) => { value: number | null; calculation: string | null };
  thresholds: KpiThreshold | null;
  interpretationContabil: string;
  interpretationAntreprenor: string;
  /** Set for KPIs that need data outside the journal. compute returns null. */
  unavailableReason?: string;
}

export function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Annualizes a YTD value: YTD / monthsElapsed * 12. */
function anual(ytd: number, months: number): number {
  return months > 0 ? (ytd / months) * 12 : 0;
}

const anualNote = (label: string, ytd: number, months: number) =>
  `${label} anualizat = ${fmtNum(ytd)} / ${months} luni × 12 = ${fmtNum(anual(ytd, months))}`;

const OPERATIONAL_REASON =
  "Nu se poate calcula din jurnal. Necesita date operationale care vor putea fi introduse manual intr-o versiune viitoare.";

/* -------------------------------------------------------------------------- */
/*                              ESSENTIAL KPIS                                */
/* -------------------------------------------------------------------------- */

export const KPI_REGISTRY: KpiDefinition[] = [
  // ---- PROFITABILITATE ----
  {
    id: "marjaBruta",
    group: "profitabilitate",
    labelContabil: "Marja bruta %",
    labelAntreprenor: "Cat castigi din vanzare, inainte de restul cheltuielilor",
    formulaContabil: "(Cifra de afaceri − Costuri directe gr. 60) / Cifra de afaceri × 100",
    formulaAntreprenor: "(Vanzari − costul direct al marfii / materialelor) impartit la vanzari",
    format: "percent",
    inputIds: ["cifraAfaceri", "cogs"],
    compute: (i) => {
      if (i.cifraAfaceri <= 0) return { value: null, calculation: null };
      const v = round2(((i.cifraAfaceri - i.cogs) / i.cifraAfaceri) * 100);
      return {
        value: v,
        calculation: `(${fmtNum(i.cifraAfaceri)} − ${fmtNum(i.cogs)}) / ${fmtNum(i.cifraAfaceri)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 30, alarm: 20, direction: "higher", label: "> 30%" },
    interpretationContabil:
      "Sanatatea de baza a modelului de business. COGS aproximat cu grupa 60 (nu include manopera directa); pentru servicii interpretati cu prudenta.",
    interpretationAntreprenor:
      "Din fiecare 100 lei vanduti, cati lei raman dupa ce platesti marfa sau materialele. Primul semn ca afacerea functioneaza.",
  },
  {
    id: "marjaEbitda",
    group: "profitabilitate",
    labelContabil: "Marja EBITDA %",
    labelAntreprenor: "Cat produce activitatea de baza, fara dobanzi si amortizare",
    formulaContabil: "EBITDA / Venituri totale × 100, unde EBITDA = Rezultat brut + 666 − 766 + 681",
    formulaAntreprenor: "Profitul operational (fara dobanzi, impozit si uzura echipamentelor) impartit la venituri",
    format: "percent",
    inputIds: ["ebitda", "venituriTotale", "rezultatBrut", "cheltuieliDobanzi", "venituriDobanzi", "amortizare"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.ebitda / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `EBITDA = ${fmtNum(i.rezultatBrut)} + ${fmtNum(i.cheltuieliDobanzi)} − ${fmtNum(i.venituriDobanzi)} + ${fmtNum(i.amortizare)} = ${fmtNum(i.ebitda)}; ${fmtNum(i.ebitda)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 15, alarm: 8, direction: "higher", label: "> 15%" },
    interpretationContabil:
      "Profitabilitate operationala pura, inainte de politica de finantare si amortizare. Comparabila intre firme.",
    interpretationAntreprenor:
      "Cat de profitabila e activitatea in sine, inainte de credite si de uzura echipamentelor.",
  },
  {
    id: "marjaEbit",
    group: "profitabilitate",
    labelContabil: "Marja EBIT %",
    labelAntreprenor: "Profitul operational, dupa uzura echipamentelor",
    formulaContabil: "EBIT / Venituri totale × 100, unde EBIT = Rezultat brut + 666 − 766",
    formulaAntreprenor: "Profitul dupa toate cheltuielile de functionare, inainte de dobanzi si impozit",
    format: "percent",
    inputIds: ["ebit", "venituriTotale"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.ebit / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.ebit)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 12, alarm: 5, direction: "higher", label: "> 12%" },
    interpretationContabil: "Profitabilitate dupa amortizare, inainte de costul finantarii.",
    interpretationAntreprenor: "Ce ramane dupa toate cheltuielile de zi cu zi, inclusiv uzura echipamentelor.",
  },
  {
    id: "marjaNeta",
    group: "profitabilitate",
    labelContabil: "Marja neta %",
    labelAntreprenor: "Cat ramane in final din fiecare 100 lei vanduti",
    formulaContabil: "Profit net / Venituri totale × 100",
    formulaAntreprenor: "Profitul final (dupa toate cheltuielile si impozitul) impartit la venituri",
    format: "percent",
    inputIds: ["profitNet", "venituriTotale"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.profitNet / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.profitNet)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 10, alarm: 3, direction: "higher", label: "> 10%" },
    interpretationContabil: "Ce ramane actionarilor din fiecare leu de vanzari, dupa toate costurile si impozitul.",
    interpretationAntreprenor: "Banii care raman efectiv ai tai din fiecare 100 lei incasati.",
  },
  {
    id: "roe",
    group: "profitabilitate",
    labelContabil: "ROE % (rentabilitatea capitalului propriu)",
    labelAntreprenor: "Cat produc banii investiti de tine in firma",
    formulaContabil: "Profit net anualizat / Capital propriu × 100",
    formulaAntreprenor: "Profitul pe un an intreg impartit la banii pusi de tine in firma",
    format: "percent",
    inputIds: ["profitNet", "capitalPropriu"],
    compute: (i) => {
      if (i.capitalPropriu <= 0) return { value: null, calculation: null };
      const pa = anual(i.profitNet, i.monthsElapsed);
      const v = round2((pa / i.capitalPropriu) * 100);
      return {
        value: v,
        calculation: `${anualNote("Profit net", i.profitNet, i.monthsElapsed)}; ${fmtNum(pa)} / ${fmtNum(i.capitalPropriu)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 15, alarm: 8, direction: "higher", label: "> 15%" },
    interpretationContabil: "Randamentul capitalului investit de actionari. Sub costul capitalului = distrugere de valoare.",
    interpretationAntreprenor: "Daca ai 100.000 lei in firma si ROE e 15%, firma iti produce 15.000 lei profit pe an.",
  },
  {
    id: "roa",
    group: "profitabilitate",
    labelContabil: "ROA % (rentabilitatea activelor)",
    labelAntreprenor: "Cat produce tot ce detine firma",
    formulaContabil: "Profit net anualizat / Total activ × 100",
    formulaAntreprenor: "Profitul anual impartit la valoarea a tot ce are firma (bani, stocuri, echipamente)",
    format: "percent",
    inputIds: ["profitNet", "totalActiv"],
    compute: (i) => {
      if (i.totalActiv <= 0) return { value: null, calculation: null };
      const pa = anual(i.profitNet, i.monthsElapsed);
      const v = round2((pa / i.totalActiv) * 100);
      return {
        value: v,
        calculation: `${anualNote("Profit net", i.profitNet, i.monthsElapsed)}; ${fmtNum(pa)} / ${fmtNum(i.totalActiv)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 5, alarm: 2, direction: "higher", label: "> 5%" },
    interpretationContabil: "Eficienta utilizarii tuturor activelor, indiferent de sursa de finantare.",
    interpretationAntreprenor: "Cat de bine pui la treaba tot ce detine firma.",
  },
  {
    id: "roce",
    group: "profitabilitate",
    labelContabil: "ROCE % (rentabilitatea capitalului angajat)",
    labelAntreprenor: "Cat produc banii investiti pe termen lung in firma",
    formulaContabil: "EBIT anualizat / (Capital propriu + Datorii pe termen lung) × 100",
    formulaAntreprenor: "Profitul din activitate impartit la banii care finanteaza firma pe termen lung",
    format: "percent",
    inputIds: ["ebit", "capitalPropriu", "datoriiTermenLung"],
    compute: (i) => {
      const capitalAngajat = i.capitalPropriu + i.datoriiTermenLung;
      if (capitalAngajat <= 0) return { value: null, calculation: null };
      const ebitA = anual(i.ebit, i.monthsElapsed);
      const v = round2((ebitA / capitalAngajat) * 100);
      return {
        value: v,
        calculation: `${anualNote("EBIT", i.ebit, i.monthsElapsed)}; capital angajat = ${fmtNum(i.capitalPropriu)} + ${fmtNum(i.datoriiTermenLung)} = ${fmtNum(capitalAngajat)}; ${fmtNum(ebitA)} / ${fmtNum(capitalAngajat)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 15, alarm: 8, direction: "higher", label: "> 15%" },
    interpretationContabil: "Randamentul intregului capital investit pe termen lung (propriu + imprumutat). Spre deosebire de ROE, nu e umflat de indatorare.",
    interpretationAntreprenor: "Cat produce fiecare leu investit in firma pe termen lung, indiferent ca e al tau sau imprumutat.",
  },

  // ---- LICHIDITATE ----
  {
    id: "currentRatio",
    group: "lichiditate",
    labelContabil: "Rata curenta (Current Ratio)",
    labelAntreprenor: "Poti plati ce ai de platit in urmatoarele luni?",
    formulaContabil: "Active curente / Datorii curente",
    formulaAntreprenor: "Ce poti transforma in bani (cont, incasari, stoc) impartit la ce ai de platit curand",
    format: "ratio",
    inputIds: ["activeCurente", "datoriiCurente"],
    compute: (i) => {
      if (i.datoriiCurente <= 0) return { value: null, calculation: null };
      const v = round2(i.activeCurente / i.datoriiCurente);
      return {
        value: v,
        calculation: `${fmtNum(i.activeCurente)} / ${fmtNum(i.datoriiCurente)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 2, alarm: 1, direction: "higher", label: "> 2.0" },
    interpretationContabil: "Capacitatea de plata a datoriilor sub 12 luni. Sub 1 = activele curente nu acopera datoriile curente.",
    interpretationAntreprenor: "Peste 2 = confortabil. Sub 1 = nu ai din ce plati tot ce vine la plata, risc imediat.",
  },
  {
    id: "quickRatio",
    group: "lichiditate",
    labelContabil: "Rata rapida (Quick Ratio)",
    labelAntreprenor: "Poti plati fara sa astepti sa vinzi stocul?",
    formulaContabil: "(Active curente − Stocuri) / Datorii curente",
    formulaAntreprenor: "Banii si incasarile asteptate, fara stoc, impartite la ce ai de platit curand",
    format: "ratio",
    inputIds: ["activeCurente", "stocuri", "datoriiCurente"],
    compute: (i) => {
      if (i.datoriiCurente <= 0) return { value: null, calculation: null };
      const v = round2((i.activeCurente - i.stocuri) / i.datoriiCurente);
      return {
        value: v,
        calculation: `(${fmtNum(i.activeCurente)} − ${fmtNum(i.stocuri)}) / ${fmtNum(i.datoriiCurente)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 1, alarm: 0.7, direction: "higher", label: "> 1.0" },
    interpretationContabil: "Test mai strict decat rata curenta: exclude stocurile, care se transforma greu in numerar.",
    interpretationAntreprenor: "Stocul se vinde greu cand ai nevoie urgenta de bani. Acest indicator il exclude.",
  },
  {
    id: "cashRatio",
    group: "lichiditate",
    labelContabil: "Rata cash (Cash Ratio)",
    labelAntreprenor: "Cat poti plati chiar acum, din banii din cont",
    formulaContabil: "Numerar si echivalente / Datorii curente",
    formulaAntreprenor: "Banii din banca si casa impartiti la ce ai de platit curand",
    format: "ratio",
    inputIds: ["cash", "datoriiCurente"],
    compute: (i) => {
      if (i.datoriiCurente <= 0) return { value: null, calculation: null };
      const v = round2(i.cash / i.datoriiCurente);
      return {
        value: v,
        calculation: `${fmtNum(i.cash)} / ${fmtNum(i.datoriiCurente)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 0.5, alarm: 0.2, direction: "higher", label: "> 0.5" },
    interpretationContabil: "Cel mai conservator test de lichiditate: doar disponibilitatile banesti.",
    interpretationAntreprenor: "Daca toate facturile ar veni azi, cat la suta ai putea plati pe loc.",
  },
  {
    id: "workingCapital",
    group: "lichiditate",
    labelContabil: "Capital de lucru net",
    labelAntreprenor: "Rezerva pentru functionarea de zi cu zi",
    formulaContabil: "Active curente − Datorii curente",
    formulaAntreprenor: "Ce poti transforma in bani minus ce ai de platit curand",
    format: "lei",
    inputIds: ["activeCurente", "datoriiCurente"],
    compute: (i) => {
      const v = round2(i.activeCurente - i.datoriiCurente);
      return {
        value: v,
        calculation: `${fmtNum(i.activeCurente)} − ${fmtNum(i.datoriiCurente)} = ${fmtNum(v)} lei`,
      };
    },
    thresholds: { target: 0.01, alarm: 0, direction: "higher", label: "Pozitiv" },
    interpretationContabil: "Resursele disponibile pentru operatiunile curente. Negativ = finantare pe termen scurt insuficienta.",
    interpretationAntreprenor: "Daca e negativ, firma functioneaza pe datorie de la o luna la alta.",
  },
  {
    id: "fcfAprox",
    group: "lichiditate",
    labelContabil: "Free Cash Flow aproximat (YTD)",
    labelAntreprenor: "Banii ramasi dupa cheltuieli, taxe si investitii",
    formulaContabil: "EBITDA − Impozit pe profit − CapEx (cumulat de la inceputul anului)",
    formulaAntreprenor: "Ce castigi din activitate, minus taxele si banii bagati in echipamente",
    format: "lei",
    inputIds: ["ebitda", "impozitProfit", "capexYtd"],
    compute: (i) => {
      const v = round2(i.ebitda - i.impozitProfit - i.capexYtd);
      return {
        value: v,
        calculation: `${fmtNum(i.ebitda)} − ${fmtNum(i.impozitProfit)} − ${fmtNum(i.capexYtd)} = ${fmtNum(v)} lei`,
      };
    },
    thresholds: { target: 0.01, alarm: 0, direction: "higher", label: "Pozitiv" },
    interpretationContabil: "Aproximare: nu include variatia capitalului de lucru (creante, stocuri, furnizori). Negativ sustinut = firma consuma numerar chiar daca e profitabila pe hartie.",
    interpretationAntreprenor: "Aproximativ: poti avea profit pe hartie si totusi sa ramai fara bani. Acest numar arata cati bani raman cu adevarat.",
  },

  // ---- EFICIENTA ----
  {
    id: "dso",
    group: "eficienta",
    labelContabil: "DSO, durata medie de incasare (zile)",
    labelAntreprenor: "In cate zile te platesc clientii",
    formulaContabil: "Creante clienti / (Cifra de afaceri anualizata / 365)",
    formulaAntreprenor: "Banii de incasat de la clienti impartiti la vanzarile unei zile",
    format: "days",
    inputIds: ["creanteClienti", "cifraAfaceri"],
    compute: (i) => {
      const caA = anual(i.cifraAfaceri, i.monthsElapsed);
      if (caA <= 0) return { value: null, calculation: null };
      const v = round2(i.creanteClienti / (caA / 365));
      return {
        value: v,
        calculation: `${anualNote("CA", i.cifraAfaceri, i.monthsElapsed)}; ${fmtNum(i.creanteClienti)} / (${fmtNum(caA)} / 365) = ${fmtNum(v, 1)} zile`,
      };
    },
    thresholds: { target: 45, alarm: 90, direction: "lower", label: "< 45 zile" },
    interpretationContabil: "Cate zile dureaza in medie incasarea creantelor. Peste 90 = risc de lichiditate.",
    interpretationAntreprenor: "Cu cat e mai mic, cu atat banii ajung mai repede la tine. Peste 90 de zile inseamna ca finantezi tu clientii.",
  },
  {
    id: "dpo",
    group: "eficienta",
    labelContabil: "DPO, durata medie de plata furnizori (zile)",
    labelAntreprenor: "In cate zile iti platesti furnizorii",
    formulaContabil: "Sold furnizori / (Costuri directe anualizate / 365)",
    formulaAntreprenor: "Datoriile catre furnizori impartite la cheltuielile directe ale unei zile",
    format: "days",
    inputIds: ["furnizori", "cogs"],
    compute: (i) => {
      const cogsA = anual(i.cogs, i.monthsElapsed);
      if (cogsA <= 0) return { value: null, calculation: null };
      const v = round2(i.furnizori / (cogsA / 365));
      return {
        value: v,
        calculation: `${anualNote("COGS", i.cogs, i.monthsElapsed)}; ${fmtNum(i.furnizori)} / (${fmtNum(cogsA)} / 365) = ${fmtNum(v, 1)} zile`,
      };
    },
    thresholds: { target: 30, alarm: 15, direction: "higher", label: "30-60 zile" },
    interpretationContabil: "Cate zile folosesti creditul comercial al furnizorilor. Prea mic = platesti prea repede; prea mare = risc de blocare a livrarilor.",
    interpretationAntreprenor: "Daca platesti furnizorii mult mai repede decat te platesc clientii, raman banii blocati.",
  },
  {
    id: "dio",
    group: "eficienta",
    labelContabil: "DIO, durata medie a stocului (zile)",
    labelAntreprenor: "Cate zile sta marfa pe raft",
    formulaContabil: "Stocuri / (Costuri directe anualizate / 365)",
    formulaAntreprenor: "Valoarea stocului impartita la costul marfii vandute intr-o zi",
    format: "days",
    inputIds: ["stocuri", "cogs"],
    compute: (i) => {
      const cogsA = anual(i.cogs, i.monthsElapsed);
      if (cogsA <= 0 || i.stocuri <= 0) return { value: null, calculation: null };
      const v = round2(i.stocuri / (cogsA / 365));
      return {
        value: v,
        calculation: `${anualNote("COGS", i.cogs, i.monthsElapsed)}; ${fmtNum(i.stocuri)} / (${fmtNum(cogsA)} / 365) = ${fmtNum(v, 1)} zile`,
      };
    },
    thresholds: { target: 60, alarm: 120, direction: "lower", label: "< 60 zile" },
    interpretationContabil: "Rotatia stocurilor in zile. Peste 120 = capital blocat si risc de devalorizare.",
    interpretationAntreprenor: "Marfa care sta pe raft inseamna bani blocati. Cu cat se vinde mai repede, cu atat mai bine.",
  },
  {
    id: "ccc",
    group: "eficienta",
    labelContabil: "Ciclul de conversie a numerarului (zile)",
    labelAntreprenor: "Cate zile stau banii blocati in afacere",
    formulaContabil: "DSO + DIO − DPO",
    formulaAntreprenor: "Zilele pana incasezi + zilele cu marfa pe raft − zilele in care platesti furnizorii",
    format: "days",
    inputIds: ["creanteClienti", "stocuri", "furnizori", "cifraAfaceri", "cogs"],
    compute: (i) => {
      const caA = anual(i.cifraAfaceri, i.monthsElapsed);
      const cogsA = anual(i.cogs, i.monthsElapsed);
      if (caA <= 0 || cogsA <= 0) return { value: null, calculation: null };
      const dso = i.creanteClienti / (caA / 365);
      const dio = i.stocuri > 0 ? i.stocuri / (cogsA / 365) : 0;
      const dpo = i.furnizori / (cogsA / 365);
      const v = round2(dso + dio - dpo);
      return {
        value: v,
        calculation: `DSO ${fmtNum(dso, 1)} + DIO ${fmtNum(dio, 1)} − DPO ${fmtNum(dpo, 1)} = ${fmtNum(v, 1)} zile`,
      };
    },
    thresholds: { target: 30, alarm: 90, direction: "lower", label: "< 30 zile" },
    interpretationContabil: "Cate zile e blocat numerarul in ciclul operational. Negativ = furnizorii finanteaza operatiunile.",
    interpretationAntreprenor: "Cu cat e mai mic, cu atat ai nevoie de mai putini bani ca sa functionezi.",
  },
  {
    id: "rotatieActive",
    group: "eficienta",
    labelContabil: "Rotatia activelor",
    labelAntreprenor: "Cati lei de vanzari produce fiecare leu din firma",
    formulaContabil: "Venituri totale anualizate / Total activ",
    formulaAntreprenor: "Veniturile pe un an impartite la valoarea a tot ce detine firma",
    format: "ratio",
    inputIds: ["venituriTotale", "totalActiv"],
    compute: (i) => {
      if (i.totalActiv <= 0) return { value: null, calculation: null };
      const vA = anual(i.venituriTotale, i.monthsElapsed);
      const v = round2(vA / i.totalActiv);
      return {
        value: v,
        calculation: `${anualNote("Venituri", i.venituriTotale, i.monthsElapsed)}; ${fmtNum(vA)} / ${fmtNum(i.totalActiv)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 1.5, alarm: 0.5, direction: "higher", label: "> 1.5" },
    interpretationContabil: "Eficienta utilizarii activelor in generarea de venituri.",
    interpretationAntreprenor: "Cat de harnici sunt banii si echipamentele firmei.",
  },

  // ---- INDATORARE ----
  {
    id: "debtToEquity",
    group: "indatorare",
    labelContabil: "Datorii / Capital propriu",
    labelAntreprenor: "Cat din firma e finantata pe datorie",
    formulaContabil: "(Datorii curente + Datorii pe termen lung) / Capital propriu",
    formulaAntreprenor: "Toate datoriile impartite la banii pusi de tine in firma",
    format: "ratio",
    inputIds: ["datoriiCurente", "datoriiTermenLung", "capitalPropriu"],
    compute: (i) => {
      if (i.capitalPropriu <= 0) return { value: null, calculation: null };
      const td = i.datoriiCurente + i.datoriiTermenLung;
      const v = round2(td / i.capitalPropriu);
      return {
        value: v,
        calculation: `(${fmtNum(i.datoriiCurente)} + ${fmtNum(i.datoriiTermenLung)}) / ${fmtNum(i.capitalPropriu)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 1, alarm: 2, direction: "lower", label: "< 1.0" },
    interpretationContabil: "Structura de finantare. Peste 2 = dependenta excesiva de creditori.",
    interpretationAntreprenor: "Sub 1 = firma e in principal a ta. Peste 2 = e in principal a creditorilor.",
  },
  {
    id: "debtToEbitda",
    group: "indatorare",
    labelContabil: "Datorie financiara neta / EBITDA",
    labelAntreprenor: "In cati ani ai putea plati creditele din profit",
    formulaContabil: "(Datorii financiare − Numerar) / EBITDA anualizat",
    formulaAntreprenor: "Creditele bancare (minus banii din cont) impartite la profitul operational anual",
    format: "ratio",
    inputIds: ["datoriiFinanciare", "cash", "ebitda"],
    compute: (i) => {
      const ebitdaA = anual(i.ebitda, i.monthsElapsed);
      if (ebitdaA <= 0) return { value: null, calculation: null };
      const netDebt = i.datoriiFinanciare - i.cash;
      if (netDebt <= 0) {
        return {
          value: 0,
          calculation: `Datorie neta = ${fmtNum(i.datoriiFinanciare)} − ${fmtNum(i.cash)} = ${fmtNum(netDebt)} (negativa: numerarul acopera datoriile financiare) → 0`,
        };
      }
      const v = round2(netDebt / ebitdaA);
      return {
        value: v,
        calculation: `(${fmtNum(i.datoriiFinanciare)} − ${fmtNum(i.cash)}) / EBITDA anualizat ${fmtNum(ebitdaA)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 3, alarm: 5, direction: "lower", label: "< 3.0" },
    interpretationContabil: "Cati ani de EBITDA ar acoperi datoria financiara neta. Peste 3.5 = risc de refinantare / covenant.",
    interpretationAntreprenor: "Daca tot profitul operational ar merge la credite, in cati ani le-ai stinge.",
  },
  {
    id: "interestCoverage",
    group: "indatorare",
    labelContabil: "Acoperirea dobanzilor (EBIT / Dobanzi)",
    labelAntreprenor: "De cate ori acopera profitul dobanzile la credite",
    formulaContabil: "EBIT / Cheltuieli cu dobanzi (666)",
    formulaAntreprenor: "Profitul operational impartit la dobanzile platite",
    format: "ratio",
    inputIds: ["ebit", "cheltuieliDobanzi"],
    compute: (i) => {
      if (i.cheltuieliDobanzi <= 0) return { value: null, calculation: null };
      const v = round2(i.ebit / i.cheltuieliDobanzi);
      return {
        value: v,
        calculation: `${fmtNum(i.ebit)} / ${fmtNum(i.cheltuieliDobanzi)} = ${fmtNum(v, 2)}`,
      };
    },
    thresholds: { target: 3, alarm: 1.5, direction: "higher", label: "> 3.0" },
    interpretationContabil: "Capacitatea de a sustine costul finantarii din rezultatul operational.",
    interpretationAntreprenor: "Sub 1.5 inseamna ca dobanzile mananca aproape tot profitul.",
  },
  {
    id: "gradIndatorare",
    group: "indatorare",
    labelContabil: "Grad de indatorare %",
    labelAntreprenor: "Ce procent din ce detine firma e datorat altora",
    formulaContabil: "Total datorii / Total activ × 100",
    formulaAntreprenor: "Toate datoriile impartite la valoarea a tot ce are firma",
    format: "percent",
    inputIds: ["datoriiCurente", "datoriiTermenLung", "totalActiv"],
    compute: (i) => {
      if (i.totalActiv <= 0) return { value: null, calculation: null };
      const td = i.datoriiCurente + i.datoriiTermenLung;
      const v = round2((td / i.totalActiv) * 100);
      return {
        value: v,
        calculation: `(${fmtNum(i.datoriiCurente)} + ${fmtNum(i.datoriiTermenLung)}) / ${fmtNum(i.totalActiv)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 40, alarm: 70, direction: "lower", label: "< 40%" },
    interpretationContabil: "Ponderea datoriilor in total activ. Riscul financiar global al firmei.",
    interpretationAntreprenor: "Peste 70% = aproape tot ce are firma e finantat din datorii.",
  },

  // ---- CRESTERE & PERSONAL ----
  {
    id: "revenueGrowth",
    group: "crestere",
    labelContabil: "Crestere cifra de afaceri YoY %",
    labelAntreprenor: "Cu cat ai crescut fata de anul trecut",
    formulaContabil: "(CA perioada curenta / CA aceeasi perioada an precedent − 1) × 100",
    formulaAntreprenor: "Vanzarile de anul asta comparate cu aceeasi perioada de anul trecut",
    format: "percent",
    inputIds: ["cifraAfaceri", "cifraAfaceriAnPrecedent"],
    compute: (i) => {
      if (i.cifraAfaceriAnPrecedent === null || i.cifraAfaceriAnPrecedent <= 0) {
        return { value: null, calculation: null };
      }
      const v = round2((i.cifraAfaceri / i.cifraAfaceriAnPrecedent - 1) * 100);
      return {
        value: v,
        calculation: `(${fmtNum(i.cifraAfaceri)} / ${fmtNum(i.cifraAfaceriAnPrecedent)} − 1) × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 10, alarm: 0, direction: "higher", label: "> 10%" },
    interpretationContabil: "Ritmul de crestere fata de aceeasi perioada a anului precedent (cumulat ianuarie → luna selectata).",
    interpretationAntreprenor: "Negativ doua perioade la rand = semnal strategic, nu doar o luna slaba.",
  },
  {
    id: "ruleOf40",
    group: "crestere",
    labelContabil: "Rule of 40 (crestere YoY + marja EBITDA) %",
    labelAntreprenor: "Crestere si profit, adunate",
    formulaContabil: "Crestere cifra de afaceri YoY % + Marja EBITDA %",
    formulaAntreprenor: "Cat ai crescut plus cat castigi, adunate. Peste 40 e excelent",
    format: "percent",
    inputIds: ["cifraAfaceri", "cifraAfaceriAnPrecedent", "ebitda", "venituriTotale"],
    compute: (i) => {
      if (
        i.cifraAfaceriAnPrecedent === null ||
        i.cifraAfaceriAnPrecedent <= 0 ||
        i.venituriTotale <= 0
      ) {
        return { value: null, calculation: null };
      }
      const growth = round2((i.cifraAfaceri / i.cifraAfaceriAnPrecedent - 1) * 100);
      const marja = round2((i.ebitda / i.venituriTotale) * 100);
      const v = round2(growth + marja);
      return {
        value: v,
        calculation: `crestere YoY ${fmtNum(growth, 1)}% + marja EBITDA ${fmtNum(marja, 1)}% = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 40, alarm: 20, direction: "higher", label: "> 40%" },
    interpretationContabil: "Echilibrul crestere-profitabilitate: o firma poate sacrifica marja pentru crestere sau invers, dar suma sub 20 inseamna ca nu face niciuna.",
    interpretationAntreprenor: "Poti creste repede cu profit mic sau incet cu profit mare. Adunate, ar trebui sa treaca de 40.",
  },
  {
    id: "costPersonal",
    group: "crestere",
    labelContabil: "Cheltuieli cu personalul / Venituri %",
    labelAntreprenor: "Ce procent din venituri merge catre echipa",
    formulaContabil: "Rulaj debitor grupa 64 / Venituri totale × 100",
    formulaAntreprenor: "Salariile si taxele pe munca impartite la veniturile firmei",
    format: "percent",
    inputIds: ["cheltuieliPersonal", "venituriTotale"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.cheltuieliPersonal / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.cheltuieliPersonal)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 25, alarm: 40, direction: "lower", label: "< 25%" },
    interpretationContabil: "Ponderea costului muncii in venituri. Pragul sanatos variaza puternic pe industrie.",
    interpretationAntreprenor: "Echipa e de obicei cea mai mare cheltuiala. Pragul bun depinde de tipul afacerii.",
  },

  // ---- INDUSTRIE: computable ----
  {
    id: "chirieVanzari",
    group: "industrie",
    labelContabil: "Chirii / Cifra de afaceri %",
    labelAntreprenor: "Cat din vanzari mananca chiria",
    formulaContabil: "Rulaj debitor 612 / Cifra de afaceri × 100",
    formulaAntreprenor: "Chiria platita impartita la vanzari",
    format: "percent",
    inputIds: ["chirii", "cifraAfaceri"],
    compute: (i) => {
      if (i.cifraAfaceri <= 0) return { value: null, calculation: null };
      const v = round2((i.chirii / i.cifraAfaceri) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.chirii)} / ${fmtNum(i.cifraAfaceri)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 8, alarm: 12, direction: "lower", label: "< 8%" },
    interpretationContabil: "Raport chirie/vanzari. In retail, peste 10-12% indica o locatie potential nerentabila.",
    interpretationAntreprenor: "Daca chiria ia mai mult de 10 lei din fiecare 100 lei vanduti, locatia merita reanalizata.",
  },
  {
    id: "rotatieStocuri",
    group: "industrie",
    labelContabil: "Rotatia stocurilor (ori/an)",
    labelAntreprenor: "De cate ori pe an se vinde si se reumple stocul",
    formulaContabil: "Costuri directe anualizate / Stocuri",
    formulaAntreprenor: "Costul marfii vandute pe un an impartit la valoarea stocului",
    format: "ratio",
    inputIds: ["cogs", "stocuri"],
    compute: (i) => {
      if (i.stocuri <= 0) return { value: null, calculation: null };
      const cogsA = anual(i.cogs, i.monthsElapsed);
      const v = round2(cogsA / i.stocuri);
      return {
        value: v,
        calculation: `${anualNote("COGS", i.cogs, i.monthsElapsed)}; ${fmtNum(cogsA)} / ${fmtNum(i.stocuri)} = ${fmtNum(v, 1)} ori/an`,
      };
    },
    thresholds: { target: 6, alarm: 2, direction: "higher", label: "> 6 ori/an" },
    interpretationContabil: "Frecventa rotatiei stocului. Sub 2 = stoc supradimensionat.",
    interpretationAntreprenor: "Stoc care se roteste repede = bani care lucreaza, nu stau pe raft.",
  },
  {
    id: "top3Concentration",
    group: "industrie",
    labelContabil: "Concentrare incasari top 3 clienti %",
    labelAntreprenor: "Cat de mult depinzi de cei mai mari 3 clienti",
    formulaContabil: "Rulaj creditor cumulat top 3 analitice 411 / Total rulaj creditor 411 × 100",
    formulaAntreprenor: "Incasarile de la cei mai mari 3 clienti impartite la toate incasarile",
    format: "percent",
    inputIds: ["top3ClientiPercent"],
    compute: (i) => {
      if (i.top3ClientiPercent === null) return { value: null, calculation: null };
      return {
        value: i.top3ClientiPercent,
        calculation: `Top 3 clienti dupa incasari cumulate = ${fmtNum(i.top3ClientiPercent, 1)}% din total incasari clienti`,
      };
    },
    thresholds: { target: 40, alarm: 60, direction: "lower", label: "< 40%" },
    interpretationContabil: "Risc de concentrare a portofoliului. Peste 40% = dependenta excesiva; pierderea unui client major devine existentiala.",
    interpretationAntreprenor: "Daca un singur client mare pleaca, ce procent din incasari dispare? Sub 40% e zona sigura.",
  },
  {
    id: "capexIntensity",
    group: "industrie",
    labelContabil: "Intensitate investitii (CapEx / Venituri) %",
    labelAntreprenor: "Cat din venituri se duce in echipamente si infrastructura",
    formulaContabil: "Rulaj debitor 20x+21x+23x / Venituri totale × 100",
    formulaAntreprenor: "Banii investiti in echipamente impartiti la venituri",
    format: "percent",
    inputIds: ["capexYtd", "venituriTotale"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.capexYtd / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.capexYtd)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 20, alarm: 25, direction: "lower", label: "< 20%" },
    interpretationContabil: "Aproximare din rulajul debitor al conturilor de imobilizari. In telecom, peste 22% cere monitorizarea finantarii.",
    interpretationAntreprenor: "Investitiile sunt sanatoase, dar peste un prag apasa pe banii disponibili.",
  },
  {
    id: "cir",
    group: "industrie",
    labelContabil: "Cost / Income Ratio (CIR) %",
    labelAntreprenor: "Cat cheltuiesti ca sa generezi 100 lei venit",
    formulaContabil: "Cheltuieli totale / Venituri totale × 100",
    formulaAntreprenor: "Toate cheltuielile impartite la toate veniturile",
    format: "percent",
    inputIds: ["cheltuieliTotale", "venituriTotale"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.cheltuieliTotale / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.cheltuieliTotale)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 55, alarm: 65, direction: "lower", label: "< 55%" },
    interpretationContabil: "Indicator standard de eficienta in servicii financiare. Peste 65% = ineficienta structurala.",
    interpretationAntreprenor: "Cu cat cheltuiesti mai putin pentru fiecare leu castigat, cu atat mai bine.",
  },

  {
    id: "pondereChirii",
    group: "industrie",
    labelContabil: "Pondere venituri din chirii %",
    labelAntreprenor: "Cat din venituri vine din chirii",
    formulaContabil: "Rulaj creditor 706 / Venituri totale × 100",
    formulaAntreprenor: "Veniturile din chirii impartite la toate veniturile",
    format: "percent",
    inputIds: ["venituriChirii", "venituriTotale"],
    compute: (i) => {
      if (i.venituriTotale <= 0) return { value: null, calculation: null };
      const v = round2((i.venituriChirii / i.venituriTotale) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.venituriChirii)} / ${fmtNum(i.venituriTotale)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 80, alarm: 50, direction: "higher", label: "> 80%" },
    interpretationContabil: "Gradul de specializare pe activitatea de inchiriere. Sub 50% inseamna ca firma are alta activitate dominanta si profilul de praguri poate fi nepotrivit.",
    interpretationAntreprenor: "Arata cat de mult depinde firma de chirii fata de alte activitati.",
  },
  {
    id: "randamentImobilizari",
    group: "industrie",
    labelContabil: "Randament brut active imobilizate %",
    labelAntreprenor: "Cat produc proprietatile tale intr-un an",
    formulaContabil: "Venituri din chirii anualizate / Imobilizari nete × 100",
    formulaAntreprenor: "Chiriile incasate pe un an impartite la valoarea proprietatilor",
    format: "percent",
    inputIds: ["venituriChirii", "imobilizariNete"],
    compute: (i) => {
      if (i.imobilizariNete <= 0) return { value: null, calculation: null };
      const chiriiA = anual(i.venituriChirii, i.monthsElapsed);
      const v = round2((chiriiA / i.imobilizariNete) * 100);
      return {
        value: v,
        calculation: `${anualNote("Venituri chirii", i.venituriChirii, i.monthsElapsed)}; ${fmtNum(chiriiA)} / ${fmtNum(i.imobilizariNete)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 8, alarm: 5, direction: "higher", label: "> 8%" },
    interpretationContabil: "Yield brut pe valoarea contabila neta a imobilizarilor. Sub 5% = activele produc mai putin decat alternativele fara risc. Atentie: valoarea contabila poate diferi de cea de piata.",
    interpretationAntreprenor: "Daca proprietatile produc sub 5% pe an, banii ar lucra mai bine in alta parte. Calculul foloseste valoarea din contabilitate, nu pretul pietei.",
  },
  {
    id: "intretinereChirii",
    group: "industrie",
    labelContabil: "Intretinere si reparatii / Venituri chirii %",
    labelAntreprenor: "Cat din chirii se duce pe intretinere si reparatii",
    formulaContabil: "Rulaj debitor 611 / Rulaj creditor 706 × 100",
    formulaAntreprenor: "Costurile de intretinere impartite la chiriile incasate",
    format: "percent",
    inputIds: ["reparatiiIntretinere", "venituriChirii"],
    compute: (i) => {
      if (i.venituriChirii <= 0) return { value: null, calculation: null };
      const v = round2((i.reparatiiIntretinere / i.venituriChirii) * 100);
      return {
        value: v,
        calculation: `${fmtNum(i.reparatiiIntretinere)} / ${fmtNum(i.venituriChirii)} × 100 = ${fmtNum(v, 1)}%`,
      };
    },
    thresholds: { target: 15, alarm: 25, direction: "lower", label: "< 15%" },
    interpretationContabil: "Costul mentinerii activelor in stare de inchiriere. Peste 25% sustinut indica active imbatranite sau chirii subdimensionate.",
    interpretationAntreprenor: "Reparatiile sunt normale, dar daca mananca un sfert din chirii, ori cladirea e obosita, ori chiria e prea mica.",
  },

  // ---- INDUSTRIE: operational (not computable from journal yet) ----
  {
    id: "gradOcupare",
    group: "industrie",
    labelContabil: "Grad de ocupare %",
    labelAntreprenor: "Cat din spatiu e inchiriat",
    formulaContabil: "Suprafata inchiriata / Suprafata totala disponibila × 100",
    formulaAntreprenor: "Spatiul inchiriat impartit la tot spatiul disponibil",
    format: "percent",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: { target: 90, alarm: 75, direction: "higher", label: "> 90%" },
    interpretationContabil: "KPI cheie in inchirieri: spatiul gol costa (intretinere, taxe) si nu produce.",
    interpretationAntreprenor: "Fiecare metru gol plateste intretinere fara sa aduca nimic.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "oreFacturabile",
    group: "industrie",
    labelContabil: "Rata ore facturabile %",
    labelAntreprenor: "Cat din timpul echipei e platit de clienti",
    formulaContabil: "Ore facturabile / Total ore lucrate × 100",
    formulaAntreprenor: "Orele facturate clientilor impartite la toate orele lucrate",
    format: "percent",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: { target: 70, alarm: 60, direction: "higher", label: "> 70%" },
    interpretationContabil: "KPI cheie de utilizare a capacitatii in servicii profesionale.",
    interpretationAntreprenor: "Timpul nefacturat e cost pur. Sub 60% inseamna supracapacitate.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "venitPerAngajat",
    group: "industrie",
    labelContabil: "Venituri per angajat",
    labelAntreprenor: "Cat venit produce fiecare om din echipa",
    formulaContabil: "Venituri totale / Numar mediu de angajati",
    formulaAntreprenor: "Veniturile impartite la numarul de oameni",
    format: "lei",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: null,
    interpretationContabil: "Productivitatea muncii. Urmariti trendul, nu valoarea absoluta.",
    interpretationAntreprenor: "Util ca trend: daca scade luna de luna, echipa creste mai repede decat veniturile.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "retentieClienti",
    group: "industrie",
    labelContabil: "Rata de retentie clienti %",
    labelAntreprenor: "Ce procent din clienti raman cu tine",
    formulaContabil: "Clienti activi perioada curenta / Clienti activi perioada anterioara × 100",
    formulaAntreprenor: "Cati din clientii de luna trecuta au ramas si luna aceasta",
    format: "percent",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: { target: 90, alarm: 85, direction: "higher", label: "> 90%" },
    interpretationContabil: "Stabilitatea veniturilor recurente.",
    interpretationAntreprenor: "Clientii care raman sunt mai ieftini decat clientii noi.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "vanzariPerMp",
    group: "industrie",
    labelContabil: "Vanzari pe metru patrat",
    labelAntreprenor: "Cat vinde fiecare metru de magazin",
    formulaContabil: "Vanzari / Suprafata de vanzare (mp)",
    formulaAntreprenor: "Vanzarile impartite la suprafata magazinului",
    format: "lei",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: null,
    interpretationContabil: "KPI fundamental in retail. Necesita suprafata de vanzare ca data operationala.",
    interpretationAntreprenor: "Spatiul costa. Fiecare metru trebuie sa isi castige chiria.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "bonMediu",
    group: "industrie",
    labelContabil: "Valoare medie tranzactie (bon mediu)",
    labelAntreprenor: "Cat cumpara in medie un client",
    formulaContabil: "Vanzari totale / Numar tranzactii",
    formulaAntreprenor: "Vanzarile impartite la numarul de bonuri",
    format: "lei",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: null,
    interpretationContabil: "Scaderea bonului mediu indica schimbare de mix sau promotii agresive.",
    interpretationAntreprenor: "Daca scade, clientii cumpara mai putin la fiecare vizita.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "mrr",
    group: "industrie",
    labelContabil: "MRR, venituri recurente lunare",
    labelAntreprenor: "Veniturile sigure, din abonamente",
    formulaContabil: "Numar abonati activi × ARPU mediu",
    formulaAntreprenor: "Cati abonati ai inmultit cu cat plateste fiecare pe luna",
    format: "lei",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: null,
    interpretationContabil: "Baza de predictibilitate a veniturilor.",
    interpretationAntreprenor: "Banii pe care te poti baza luna de luna.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "churn",
    group: "industrie",
    labelContabil: "Churn, rata de abandon abonati %",
    labelAntreprenor: "Ce procent din abonati pleaca lunar",
    formulaContabil: "Abonati pierduti / Total abonati la inceputul lunii × 100",
    formulaAntreprenor: "Cati clienti pleaca dintr-o suta, in fiecare luna",
    format: "percent",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: { target: 1.5, alarm: 2, direction: "lower", label: "< 1.5%" },
    interpretationContabil: "Peste 2% lunar = alerta strategica imediata.",
    interpretationAntreprenor: "Pierderea clientilor existenti e cel mai scump mod de a stagna.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "arpu",
    group: "industrie",
    labelContabil: "ARPU, venit mediu per utilizator",
    labelAntreprenor: "Cat plateste in medie un abonat",
    formulaContabil: "Venituri lunare / Numar mediu de abonati",
    formulaAntreprenor: "Veniturile lunare impartite la numarul de abonati",
    format: "lei",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: null,
    interpretationContabil: "Scadere > 3% = erodare de pret sau schimbare de mix.",
    interpretationAntreprenor: "Daca scade, fie ai redus preturile, fie clientii aleg pachete mai mici.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "nim",
    group: "industrie",
    labelContabil: "NIM, marja neta de dobanda %",
    labelAntreprenor: "Cat castigi din diferenta de dobanda",
    formulaContabil: "Venituri nete din dobanzi / Active productive medii × 100",
    formulaAntreprenor: "Diferenta dintre dobanda incasata si cea platita, raportata la banii plasati",
    format: "percent",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: { target: 3, alarm: 2.5, direction: "higher", label: "> 3%" },
    interpretationContabil: "Venitul principal in finantare. Necesita date de portofoliu.",
    interpretationAntreprenor: "Motorul de baza al unei afaceri de finantare.",
    unavailableReason: OPERATIONAL_REASON,
  },
  {
    id: "npl",
    group: "industrie",
    labelContabil: "NPL, rata creditelor neperformante %",
    labelAntreprenor: "Ce procent din creditele acordate au probleme",
    formulaContabil: "Credite neperformante / Portofoliu total × 100",
    formulaAntreprenor: "Creditele care nu se mai platesc impartite la toate creditele acordate",
    format: "percent",
    inputIds: [],
    compute: () => ({ value: null, calculation: null }),
    thresholds: { target: 3, alarm: 5, direction: "lower", label: "< 3%" },
    interpretationContabil: "Necesita date de portofoliu de credite (staging, restante).",
    interpretationAntreprenor: "Banii dati cu imprumut care risca sa nu se mai intoarca.",
    unavailableReason: OPERATIONAL_REASON,
  },
];

export const KPI_BY_ID: Map<string, KpiDefinition> = new Map(
  KPI_REGISTRY.map((k) => [k.id, k])
);
