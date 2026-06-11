import type { IndustryId, IndustryOption } from "./types";

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  {
    id: "general",
    label: "Generala",
    description: "Indicatori financiari esentiali, valabili pentru orice firma.",
  },
  {
    id: "consultanta",
    label: "Consultanta si servicii profesionale",
    description: "IT, management, inginerie, marketing, alte servicii B2B.",
  },
  {
    id: "retail",
    label: "Comert si retail",
    description: "Vanzare cu amanuntul sau ridicata, magazine, e-commerce.",
  },
  {
    id: "telecom",
    label: "Telecomunicatii",
    description: "Operatori si furnizori de servicii de comunicatii.",
  },
  {
    id: "banking",
    label: "Servicii financiare",
    description: "IFN-uri, brokeraj, asigurari, intermediere financiara.",
  },
  {
    id: "servicii_contabile",
    label: "Contabilitate si audit",
    description: "Cabinete de contabilitate, expertiza, audit, consultanta fiscala.",
  },
  {
    id: "inchirieri",
    label: "Imobiliare si inchirieri",
    description: "Inchiriere si administrare de imobile, leasing operational, inchiriere de bunuri.",
  },
];

export function industryLabel(id: IndustryId): string {
  return INDUSTRY_OPTIONS.find((o) => o.id === id)?.label ?? "Generala";
}

/**
 * CAEN Rev.2 division (first 2 digits) -> industry profile.
 * 69.20 (contabilitate) is the only subclass-level rule and is checked
 * before the division map (division 69 also contains legal services,
 * which map to consultanta).
 */
const SUBCLASS_MAP: Record<string, IndustryId> = {
  "6920": "servicii_contabile",
};

const DIVISION_MAP: Record<string, IndustryId> = {
  // Comert: auto, ridicata, amanuntul
  "45": "retail",
  "46": "retail",
  "47": "retail",
  // Telecomunicatii
  "61": "telecom",
  // Servicii financiare si asigurari
  "64": "banking",
  "65": "banking",
  "66": "banking",
  // Imobiliare si inchirieri de bunuri
  "68": "inchirieri",
  "77": "inchirieri",
  // Servicii profesionale, stiintifice si tehnice + IT
  "62": "consultanta",
  "63": "consultanta",
  "69": "consultanta",
  "70": "consultanta",
  "71": "consultanta",
  "72": "consultanta",
  "73": "consultanta",
  "74": "consultanta",
  "78": "consultanta",
  "82": "consultanta",
};

/**
 * Maps a CAEN code ("6920", "69.20", "4711", "47") to an industry profile.
 * Returns null when the code is empty or maps to no known profile (caller
 * falls back to "general").
 */
export function industryFromCaen(caen: string | null | undefined): IndustryId | null {
  if (!caen) return null;
  const digits = caen.replace(/\D/g, "");
  if (digits.length < 2) return null;
  const subclass = digits.slice(0, 4);
  if (subclass.length === 4 && SUBCLASS_MAP[subclass]) return SUBCLASS_MAP[subclass];
  return DIVISION_MAP[digits.slice(0, 2)] ?? null;
}
