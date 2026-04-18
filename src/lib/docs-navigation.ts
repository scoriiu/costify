/**
 * Static docs navigation structure. Safe for client components.
 * No filesystem access here.
 */

export interface DocPage {
  slug: string;
  title: string;
  description?: string;
  tbd?: boolean;
  interactive?: boolean;
}

export interface DocCategory {
  id: string;
  label: string;
  description: string;
  pages: DocPage[];
}

export const DOC_NAVIGATION: DocCategory[] = [
  {
    id: "start",
    label: "Start",
    description: "Primii pasi cu Costify",
    pages: [
      { slug: "bun-venit", title: "Bun venit la Costify", description: "Ce este platforma si pentru cine e construita" },
      { slug: "ce-inseamna-control-financiar", title: "Ce inseamna control financiar", description: "Filosofia din spatele platformei" },
      { slug: "primii-pasi", title: "Primii pasi", description: "De la cont nou la primul raport in 5 minute" },
    ],
  },
  {
    id: "ghiduri",
    label: "Ghiduri",
    description: "Cum sa folosesti Costify pas cu pas",
    pages: [
      { slug: "creeaza-client", title: "Creeaza un client nou", description: "Adauga o firma in portofoliul tau" },
      { slug: "importa-jurnal", title: "Importa jurnalul din Saga C", description: "Urcarea si procesarea fisierelor XLSX" },
      { slug: "deduplicare-import", title: "Deduplicarea la reimport", description: "Cum gestioneaza Costify importurile repetate" },
      { slug: "corecteaza-date-istorice", title: "Corecteaza date istorice", description: "Sterge si reimporta intrari pentru perioade trecute" },
      { slug: "citeste-balanta", title: "Citeste balanta de verificare", description: "Cum sa folosesti tab-ul Balanta" },
      { slug: "analizeaza-cpp", title: "Analizeaza Cont Profit si Pierdere", description: "Cum sa folosesti tab-ul CPP" },
      { slug: "intelege-kpi", title: "Intelege KPI-urile", description: "Ce semnifica fiecare indicator" },
      { slug: "foloseste-costi", title: "Foloseste asistentul Costi", description: "Cum sa-l intrebi ce vrei si cum raspunde" },
    ],
  },
  {
    id: "arhitectura",
    label: "Cum functioneaza",
    description: "Arhitectura si principiile platformei",
    pages: [
      { slug: "arhitectura-platformei", title: "Arhitectura platformei", description: "Multi-tenant, module, flux de date" },
      { slug: "principiul-jurnal-centric", title: "Principiul jurnal-centric", description: "De ce jurnalul este sursa de adevar" },
      { slug: "calcul-balanta", title: "Calculul balantei in timp real", description: "Algoritmul pas cu pas" },
      { slug: "calcul-cpp", title: "Calculul CPP", description: "Structura OMFP 1802 si cum o construim" },
      { slug: "maparea-conturilor", title: "Maparea conturilor", description: "Standard OMFP + analitice per client" },
      { slug: "audit-si-trasabilitate", title: "Audit si trasabilitate", description: "Jurnalul de audit inviolabil" },
      { slug: "securitate-izolare", title: "Securitate si izolare", description: "Cum sunt protejate datele" },
      { slug: "costi-ai", title: "Costi AI — tool use si scoping", description: "Cum acceseaza AI-ul datele tale in siguranta" },
    ],
  },
  {
    id: "faq",
    label: "FAQ & Clarificari",
    description: "Intrebari frecvente si discutii deschise",
    pages: [
      { slug: "intrebari-contabil-plan-conturi", title: "Intrebari pentru contabil: plan de conturi", description: "Clarificari necesare pentru refactorizarea maparii conturilor", interactive: true },
      { slug: "intrebari-contabil-f20-detaliat", title: "Intrebari pentru contabil: F20 detaliat", description: "Dubii si decizii deschise despre CPP F20 detaliat (D17 din ADR-0001)", interactive: true },
      { slug: "intrebari-contabil-conturi-nemapate", title: "Intrebari pentru contabil: conturi nemapate", description: "Workflow de investigare si dubii despre conturile analitice care nu sunt in OMFP 1802", interactive: true },
    ],
  },
  {
    id: "competitori",
    label: "Competitori",
    description: "Analiza platformelor similare din piata romaneasca",
    pages: [
      { slug: "finlight", title: "Finlight.ro", description: "Platforma de raportare financiara pentru manageri si antreprenori" },
    ],
  },
  {
    id: "bazele",
    label: "Bazele contabilitatii",
    description: "Notiuni optionale de contabilitate pentru non-contabili",
    pages: [
      { slug: "de-ce-exista-contabilitatea", title: "De ce exista contabilitatea", description: "O introducere prietenoasa pentru antreprenori" },
      { slug: "document-justificativ", title: "Documentul justificativ", description: "Factura, chitanta, extras bancar — ce sunt si cum se folosesc" },
      { slug: "nota-contabila", title: "Nota contabila", description: "Cum se traduc documentele in limbajul contabil" },
      { slug: "debit-credit", title: "Debit si credit", description: "Cele doua parti ale oricarei operatii contabile" },
      { slug: "plan-de-conturi", title: "Planul de conturi OMFP 1802", description: "Catalogul oficial al conturilor din Romania" },
      { slug: "clase-de-conturi", title: "Clasele de conturi (1-9)", description: "Ce semnifica fiecare clasa: capital, imobilizari, stocuri, etc." },
      { slug: "tipuri-conturi-apb", title: "Tipuri de conturi: A, P, B", description: "Active, Pasive si Bifunctionale — ce inseamna" },
      { slug: "conturi-sintetice-analitice", title: "Conturi sintetice vs analitice", description: "Diferenta dintre 5121 si 5121.BT" },
      { slug: "registrul-jurnal", title: "Registrul jurnal", description: "Cronologia tuturor operatiilor contabile" },
      { slug: "balanta-de-verificare", title: "Balanta de verificare", description: "Tabloul de bord al contabilitatii" },
      { slug: "cont-profit-si-pierdere", title: "Cont Profit si Pierdere", description: "Cum se calculeaza rezultatul firmei" },
      { slug: "bilantul", title: "Bilantul contabil", description: "Fotografia financiara la un moment dat" },
      { slug: "glosar", title: "Glosar", description: "Definitii rapide pentru termeni contabili" },
    ],
  },
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface DocHeading {
  level: 2 | 3;
  text: string;
  id: string;
}
