/**
 * Metadata for each owner sub-page: title, subtitle, and (for placeholders)
 * a preview list of what the page will show when built.
 *
 * Centralized so we can change copy in one place. As each page gets a real
 * implementation, its `preview` field becomes obsolete (the page renders real
 * data instead of the placeholder).
 */

import type { OwnerPageKey } from "./owner-layout";

interface OwnerPageMeta {
  key: OwnerPageKey;
  title: string;
  subtitle: string;
  /** Bullet points shown in EmptyPagePlaceholder until the page is built. */
  preview: string[];
}

export const OWNER_PAGES: Record<OwnerPageKey, OwnerPageMeta> = {
  home: {
    key: "home",
    title: "Cum sta firma",
    subtitle:
      "O privire rapida peste bani, clienti, datorii si profit. Datele sunt actualizate cand contabilul incarca un nou jurnal.",
    preview: [],
  },
  bani: {
    key: "bani",
    title: "Banii firmei",
    subtitle: "Cati bani are firma, cum se impart pe conturi si cum evolueaza in timp.",
    preview: [
      "Soldul fiecarui cont bancar si al casei",
      "Cati bani au intrat si au iesit luna asta",
      "Cum a evoluat cash-ul pe ultimul an",
      "Cati bani iti ajung daca nu mai intra nimic (cash runway)",
    ],
  },
  clienti: {
    key: "clienti",
    title: "Clientii firmei",
    subtitle: "Cine iti datoreaza bani si de cand astepti.",
    preview: [
      "Tabel complet cu toti clientii care iti datoreaza",
      "Cat dureaza in medie pana incasezi (DSO)",
      "Cine plateste la timp si cine intarzie",
      "Click pe un client → istoric facturi si plati",
    ],
  },
  furnizori: {
    key: "furnizori",
    title: "Furnizorii firmei",
    subtitle: "Cui datorezi bani si de cand.",
    preview: [
      "Tabel complet cu toti furnizorii neplatiti",
      "Cat dureaza in medie pana platesti (DPO)",
      "Top furnizori dupa suma datorata",
      "Click pe un furnizor → istoric facturi si plati",
    ],
  },
  cheltuieli: {
    key: "cheltuieli",
    title: "Pe ce se duc banii",
    subtitle: "Structura cheltuielilor, categorii principale si evolutie.",
    preview: [
      "Categoriile principale de cheltuieli (salarii, chirii, servicii, marfa)",
      "Cum au evoluat in ultimele 12 luni",
      "Top tranzactii pe fiecare categorie",
      "Alerte automate cand o categorie creste anormal",
    ],
  },
  venituri: {
    key: "venituri",
    title: "De unde vin banii",
    subtitle: "Structura veniturilor, top clienti si evolutie.",
    preview: [
      "Breakdown pe tipuri de vanzari (produse, servicii, chirii)",
      "Top clienti care iti aduc bani",
      "Cum au evoluat veniturile in ultimele 24 luni",
      "Comparatie cu aceeasi luna anul trecut",
    ],
  },
  profit: {
    key: "profit",
    title: "Profitul firmei",
    subtitle: "Cat castigi real, marja si impozitul estimat.",
    preview: [
      "Profitul lunar si cumulat pe an",
      "Marja operationala (cat din vanzari devine profit)",
      "Regimul fiscal aplicabil si impozitul estimat",
      "Lunile pe plus vs cele pe minus",
    ],
  },
  eu: {
    key: "eu",
    title: "Bani intre tine si firma",
    subtitle: "Dividende, avansuri, imprumuturi. Cat ai luat si cat mai poti lua.",
    preview: [
      "Dividende deja platite si dividende repartizate dar inca neluate",
      "Avansuri din trezorerie care trebuie justificate",
      "Bani lasati de tine in firma (creditare asociati)",
      "Estimare cat mai poti retrage ca dividend",
    ],
  },
  stat: {
    key: "stat",
    title: "Datorii la stat",
    subtitle: "TVA, salarii, contributii, impozit pe profit. Cand si cat trebuie sa platesti.",
    preview: [
      "TVA de plata si scadenta",
      "Contributii sociale (salarii nete + impozite)",
      "Estimarea impozitului pe profit pentru trimestru",
      "Calendar fiscal pentru luna curenta",
    ],
  },
  evolutie: {
    key: "evolutie",
    title: "Cum am evoluat",
    subtitle: "Toate metricile principale pe ultimii 2 ani.",
    preview: [
      "Venituri, cheltuieli, profit lunar pe 24 luni",
      "Comparatie an cu an (YoY) pe orice metrica",
      "Sezonalitate si tendinte",
      "Cea mai buna si cea mai slaba luna",
    ],
  },
  sanatate: {
    key: "sanatate",
    title: "Sanatatea firmei",
    subtitle: "Indicatori de risc si actiuni recomandate.",
    preview: [
      "Toate semnalele detectate in datele firmei",
      "Indicatori de risc: cash runway, dependenta de un client, marja sub prag",
      "Lucruri concrete de facut saptamana asta",
      "Sfaturi automate pe baza tendintelor recente",
    ],
  },
  patrimoniu: {
    key: "patrimoniu",
    title: "Patrimoniul firmei",
    subtitle: "Ce detine firma (Activ) si de unde vin banii (Pasiv) la data selectata. Versiunea simpla a bilantului.",
    preview: [],
  },
  istoric: {
    key: "istoric",
    title: "Istoric actiuni",
    subtitle: "Toate modificarile facute de contabilul tau pe firma — publicari, importuri, schimbari.",
    preview: [],
  },
};
