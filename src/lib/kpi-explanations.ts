/**
 * Tooltip texts for KPI cards and balance table column headers.
 *
 * Single source of truth — used by the UI directly, and could be exposed to
 * Costi via a future tool. Romanian, no diacritics, accountant-grade
 * vocabulary mixed with one-line plain-language summary.
 *
 * Keep each entry under ~280 chars so it fits the Tooltip primitive
 * (max-width 280px).
 */

export interface Explanation {
  /** Short, used as the visible label/header. */
  short: string;
  /** Tooltip body. Plain Romanian, no diacritics. */
  body: string;
}

export const KPI_EXPLANATIONS = {
  cashBank: {
    short: "Cash & Banca",
    body: "Lichiditati directe ale firmei. Suma soldurilor pe conturi de banca (5121 lei, 5124 valuta), casa (5311, 5314), alte valori (5328 tichete), valori de incasat (5113/5114/5118) si avansuri trezorerie (542). Exclude 5125 (sume in tranzit) si 581 (viramente interne).",
  },
  clientiCreante: {
    short: "Creante clienti",
    body: "Bani datorati de clienti firmei. (4111 + 413 efecte primit + 4118 incerti + 418 facturi de intocmit) finD minus 419 finC (avansuri primite de la clienti). Daca creste mai repede decat veniturile, e semn ca facturezi dar nu incasezi.",
  },
  furnizoriDatorii: {
    short: "Datorii furnizori",
    body: "Bani datorati de firma furnizorilor. (401 + 403 efecte de platit + 404 imobilizari + 405 + 408 facturi nesosite) finC minus (409 + 4093) finD (avansuri platite la furnizori).",
  },
  tvaDePlata: {
    short: "TVA de plata",
    body: "Pozitiv = datorie catre stat. Negativ = TVA de recuperat. POST-CLOSE (luna inchisa lunar in Saga): sold 4423 minus sold 4424. PRE-CLOSE (luna in curs): 4427 finC minus 4426 finD minus 4428 (net).",
  },
  totalVenituri: {
    short: "Venituri totale",
    body: "Suma rulajelor pe clasa 7 cumulate de la inceputul anului. Exclude 121 (inchidere) si clasa 8/9 (extra-bilantier). Folosim rulaj total credit, nu sold — dupa inchidere lunara contul 7xx are sold zero, dar veniturile reale sunt in rulaj.",
  },
  totalCheltuieli: {
    short: "Cheltuieli totale",
    body: "Suma rulajelor pe clasa 6 cumulate de la inceputul anului. Exclude 121 (inchidere), 691/694/695/697/698 (impozit profit — raportate separat) si clasa 8/9. Toate cheltuielile operationale ale firmei.",
  },
  rezultat: {
    short: "Rezultat",
    body: "Venituri totale minus Cheltuieli totale. Profit brut inainte de impozit. Pozitiv = profit (verde), negativ = pierdere (rosu). Pentru profit net dupa impozit, vezi CPP rd. 35.",
  },
  marjaOperationala: {
    short: "Marja operationala",
    body: "Rezultat / Venituri totale × 100. Procentul din vanzari care ramane ca profit brut. Sub 5% = stricta, 10-20% = sanatoasa, peste 20% = excelenta. Depinde mult de industrie (servicii peste, retail sub).",
  },
} satisfies Record<string, Explanation>;

export type KpiKey = keyof typeof KPI_EXPLANATIONS;

export const BALANCE_COLUMN_EXPLANATIONS = {
  cont: {
    short: "Cont",
    body: "Codul contului OMFP 1802. Codurile cu punct (ex: 5121.BT, 401.00023) sunt analitice — sub-conturi create de contabil pentru a separa banci, furnizori sau clienti individuali.",
  },
  denumire: {
    short: "Denumire",
    body: "Numele contului. Sintetic (din catalogul OMFP) sau, pentru analitice, numele extras din Saga sau din explicatia operatiunilor. Triunghiul galben semnaleaza un cont nemapat in catalog.",
  },
  soldInD: {
    short: "Sold in D",
    body: "Sold initial pe debit la inceputul perioadei (1 ianuarie pentru anul curent, sau 1 ale lunii daca te uiti la o singura luna). Pentru conturi de Activ, e soldul normal cu care s-a inceput.",
  },
  soldInC: {
    short: "Sold in C",
    body: "Sold initial pe credit la inceputul perioadei. Pentru conturi de Pasiv, e soldul normal cu care s-a inceput. Un cont nu poate avea simultan Sold in D si Sold in C — unul e mereu zero.",
  },
  rulajD: {
    short: "Rulaj D",
    body: "Total miscari pe debit DOAR in luna curenta. Iti spune cat s-a inregistrat pe debit luna asta, fara cumulat. Pentru un cont de cheltuieli (clasa 6), egal cu valoarea cheltuielilor lunii.",
  },
  rulajC: {
    short: "Rulaj C",
    body: "Total miscari pe credit DOAR in luna curenta. Pentru un cont de venituri (clasa 7), egal cu valoarea veniturilor lunii.",
  },
  totalD: {
    short: "Total D",
    body: "Sold in D + suma rulajelor D de la inceputul anului pana la finalul lunii curente. Cumulativ. Daca privesti aprilie, Total D = ce era in ianuarie 1 + tot ce s-a debitat in ianuarie + februarie + martie + aprilie.",
  },
  totalC: {
    short: "Total C",
    body: "Sold in C + suma rulajelor C de la inceputul anului. Aceeasi logica ca Total D dar pe partea credit.",
  },
  soldFinD: {
    short: "Sold fin D",
    body: "Soldul la sfarsitul lunii curente, pe debit. Se calculeaza: daca Total D > Total C, atunci Sold fin D = diferenta. Un cont nu poate avea simultan Sold fin D si Sold fin C — unul e mereu zero.",
  },
  soldFinC: {
    short: "Sold fin C",
    body: "Soldul la sfarsitul lunii curente, pe credit. Daca Total C > Total D, atunci Sold fin C = diferenta. Pentru un cont de Pasiv (datorii), e cifra principala — cat datoreaza firma in acel cont la sfarsitul perioadei.",
  },
} satisfies Record<string, Explanation>;

export type BalanceColumnKey = keyof typeof BALANCE_COLUMN_EXPLANATIONS;
