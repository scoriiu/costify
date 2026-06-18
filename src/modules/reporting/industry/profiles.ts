/**
 * Industry profiles: which industry-specific KPIs each profile surfaces and
 * which thresholds it overrides on the essential KPIs. The essential set
 * (profitabilitate, lichiditate, eficienta, indatorare, crestere) is shown
 * for EVERY industry; only the bands and the "industrie" group differ.
 *
 * Thresholds source: docs/kpi/Checklist_Controlling_Industrii.xlsx.
 */

import type { IndustryId, KpiGroupId, KpiThreshold } from "./types";

export interface IndustryProfile {
  id: IndustryId;
  /** KPI ids (group "industrie") surfaced for this profile, in order.
   *  Computable ones first, operational placeholders last. */
  industryKpiIds: string[];
  /** Essential-KPI threshold overrides: id -> replacement band. */
  thresholdOverrides: Record<string, KpiThreshold>;
  /** Explainer for the "industrie" group, per audience. */
  industryGroupContabil: string;
  industryGroupAntreprenor: string;
}

export const INDUSTRY_PROFILES: Record<IndustryId, IndustryProfile> = {
  inchirieri: {
    id: "inchirieri",
    industryKpiIds: [
      "pondereChirii",
      "randamentImobilizari",
      "intretinereChirii",
      "top3Concentration",
      "gradOcupare",
    ],
    thresholdOverrides: {
      marjaEbitda: { target: 60, alarm: 40, direction: "higher", label: "> 60%" },
      marjaNeta: { target: 25, alarm: 10, direction: "higher", label: "> 25%" },
      dso: { target: 30, alarm: 60, direction: "lower", label: "< 30 zile" },
      gradIndatorare: { target: 60, alarm: 80, direction: "lower", label: "< 60%" },
      debtToEbitda: { target: 6, alarm: 8, direction: "lower", label: "< 6.0" },
    },
    industryGroupContabil:
      "Driveri specifici inchirierilor: ponderea veniturilor din chirii (706), randamentul brut pe imobilizari nete, costul de intretinere raportat la chirii si concentrarea chiriasilor. Marjele tipice sunt mult peste media economiei (EBITDA > 60%), iar gradul de indatorare tolerat e mai mare, fiind garantat cu active.",
    industryGroupAntreprenor:
      "Intr-o afacere de inchirieri, banii stau in proprietati. Conteaza cat produc proprietatile pe an, cat mananca intretinerea din chirii si cat de mult depinzi de cativa chiriasi mari.",
  },
  general: {
    id: "general",
    industryKpiIds: ["top3Concentration", "venitPerAngajat", "profitPerAngajat"],
    thresholdOverrides: {},
    industryGroupContabil:
      "Indicatori suplimentari general aplicabili: concentrarea portofoliului de clienti si productivitatea muncii.",
    industryGroupAntreprenor:
      "Cativa indicatori in plus, utili pentru orice firma: cat depinzi de clientii mari si cat produce echipa.",
  },
  consultanta: {
    id: "consultanta",
    industryKpiIds: [
      "top3Concentration",
      "oreFacturabile",
      "venitPerAngajat",
      "profitPerAngajat",
      "retentieClienti",
    ],
    thresholdOverrides: {
      costPersonal: { target: 55, alarm: 65, direction: "lower", label: "< 55%" },
      dso: { target: 60, alarm: 90, direction: "lower", label: "< 60 zile" },
      marjaBruta: { target: 40, alarm: 25, direction: "higher", label: "> 40%" },
    },
    industryGroupContabil:
      "Driveri specifici serviciilor profesionale: utilizarea capacitatii (ore facturabile), productivitatea per consultant, retentia portofoliului. In consultanta, costul personalului poate ajunge sanatos pana la 55% din venituri, iar DSO tipic e mai lung (sub 60 zile).",
    industryGroupAntreprenor:
      "Intr-o firma de servicii, marfa ta e timpul oamenilor. Conteaza cat din timp e platit de clienti, cat produce fiecare om si daca clientii raman cu tine.",
  },
  retail: {
    id: "retail",
    industryKpiIds: [
      "rotatieStocuri",
      "chirieVanzari",
      "vanzariPerMp",
      "bonMediu",
    ],
    thresholdOverrides: {
      costPersonal: { target: 18, alarm: 25, direction: "lower", label: "< 18%" },
      dio: { target: 45, alarm: 90, direction: "lower", label: "30-45 zile" },
      marjaBruta: { target: 35, alarm: 25, direction: "higher", label: "35-45%" },
      dso: { target: 15, alarm: 45, direction: "lower", label: "< 15 zile" },
    },
    industryGroupContabil:
      "Driveri specifici comertului: rotatia stocului (capital blocat), raportul chirie/vanzari (rentabilitatea locatiei), vanzari/mp si bon mediu. In retail costul personalului trebuie sa stea sub 18% din vanzari, iar stocul sub 45 de zile.",
    industryGroupAntreprenor:
      "In comert, banii stau in marfa si in spatiu. Conteaza cat de repede se vinde stocul, cat din vanzari mananca chiria si cat cumpara in medie un client.",
  },
  telecom: {
    id: "telecom",
    industryKpiIds: [
      "capexIntensity",
      "mrr",
      "churn",
      "arpu",
    ],
    thresholdOverrides: {
      marjaEbitda: { target: 30, alarm: 25, direction: "higher", label: "> 30%" },
      debtToEbitda: { target: 3, alarm: 3.5, direction: "lower", label: "< 3.0" },
    },
    industryGroupContabil:
      "Driveri specifici telecom: intensitatea investitiilor (CapEx/venituri, tipic 15-20%), veniturile recurente (MRR), churn si ARPU. Marja EBITDA matura e 35-45%; sub 30% cere restructurare de costuri. Datorie neta/EBITDA peste 3.5 = risc de covenant.",
    industryGroupAntreprenor:
      "O retea costa mult inainte sa produca. Conteaza cat investesti raportat la venituri, cati abonati raman si cat plateste fiecare.",
  },
  banking: {
    id: "banking",
    industryKpiIds: [
      "cir",
      "nim",
      "npl",
    ],
    thresholdOverrides: {
      roe: { target: 12, alarm: 10, direction: "higher", label: "> 12%" },
      roa: { target: 1, alarm: 0.8, direction: "higher", label: "> 1%" },
    },
    industryGroupContabil:
      "Driveri specifici serviciilor financiare: eficienta operationala (CIR sub 55%), marja de dobanda (NIM) si calitatea portofoliului (NPL). ROE tinta 12-15%, ROA peste 1%. Indicatorii reglementari (LCR, CAR, NSFR) necesita date de portofoliu si nu se calculeaza din jurnal.",
    industryGroupAntreprenor:
      "Intr-o afacere de finantare conteaza trei lucruri: cat de ieftin operezi, cat castigi din dobanzi si cat de sanatoase sunt creditele acordate.",
  },
  servicii_contabile: {
    id: "servicii_contabile",
    industryKpiIds: [
      "top3Concentration",
      "oreFacturabile",
      "venitPerAngajat",
      "profitPerAngajat",
      "retentieClienti",
    ],
    thresholdOverrides: {
      costPersonal: { target: 50, alarm: 60, direction: "lower", label: "< 50%" },
      dso: { target: 45, alarm: 60, direction: "lower", label: "< 45 zile" },
    },
    industryGroupContabil:
      "Driveri specifici cabinetelor de contabilitate: concentrarea portofoliului (top 3 clienti sub 40% din venituri), rata orelor facturabile (peste 70%), productivitatea per contabil si retentia clientilor (peste 90%). Costul personalului sanatos sta sub 50% din venituri.",
    industryGroupAntreprenor:
      "Un cabinet sanatos nu depinde de 2-3 clienti mari, isi factureaza timpul si isi pastreaza clientii de la an la an.",
  },
};

export const GROUP_INFO: Record<
  KpiGroupId,
  { label: string; contabil: string; antreprenor: string }
> = {
  profitabilitate: {
    label: "Profitabilitate",
    contabil:
      "Marjele si randamentele: cat ramane din venituri la fiecare nivel al contului de profit si pierdere (brut, EBITDA, EBIT, net) si ce randament produce capitalul (ROE, ROA). Calculate din rulajele claselor 6 si 7, cumulat de la inceputul anului.",
    antreprenor:
      "Cat castigi cu adevarat. De la ce ramane dupa costul marfii pana la profitul final care e al tau, si cat produc banii investiti in firma.",
  },
  lichiditate: {
    label: "Lichiditate",
    contabil:
      "Capacitatea de plata pe termen scurt: soldurile finale ale activelor curente (clasa 3, 411, 512, 531) raportate la datoriile curente (40x, 42x-44x, 519). Sub 1 la rata curenta = activele curente nu acopera datoriile exigibile.",
    antreprenor:
      "Poti plati ce ai de platit? Acesti indicatori compara banii si incasarile asteptate cu facturile, salariile si taxele care vin la plata.",
  },
  eficienta: {
    label: "Eficienta operationala",
    contabil:
      "Vitezele de rotatie: in cate zile se incaseaza creantele (DSO), se platesc furnizorii (DPO) si se roteste stocul (DIO). Ciclul de conversie (DSO + DIO − DPO) arata cate zile e blocat numerarul in operatiuni. Valorile YTD sunt anualizate pentru comparabilitate.",
    antreprenor:
      "Cat de repede circula banii prin firma: cat astepti dupa clienti, cat sta marfa pe raft si cat credit iti dau furnizorii.",
  },
  indatorare: {
    label: "Indatorare",
    contabil:
      "Structura de finantare si sustenabilitatea datoriei: raportul datorii/capital propriu, datoria financiara neta raportata la EBITDA, acoperirea dobanzilor din EBIT. Soldurile 16x si 519 sunt considerate datorii purtatoare de dobanda.",
    antreprenor:
      "Cat din firma e construita pe datorie si cat de usor o poti duce. Datoria nu e rea, dar trebuie sa fie platibila din profit.",
  },
  crestere: {
    label: "Crestere si personal",
    contabil:
      "Dinamica cifrei de afaceri fata de aceeasi perioada a anului precedent si ponderea costului muncii (grupa 64) in venituri. Pragul sanatos pentru costul personalului e specific industriei.",
    antreprenor:
      "Cresti sau stagnezi, si cat din venituri merge catre echipa. Amandoua trebuie privite impreuna: cresterea sanatoasa nu vine din taierea oamenilor.",
  },
  industrie: {
    label: "Specifici industriei",
    contabil: "",
    antreprenor: "",
  },
};
