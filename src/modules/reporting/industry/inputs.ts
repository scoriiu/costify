import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount } from "@/modules/accounts";
import type { KpiBaseInputs } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function lookupByBase(
  contBase: string,
  catalog: Map<string, CatalogAccount>
): CatalogAccount | undefined {
  for (let len = contBase.length; len >= 1; len--) {
    const match = catalog.get(contBase.slice(0, len));
    if (match) return match;
  }
  return undefined;
}

/**
 * Audit-trail description for every aggregate that can enter a KPI formula.
 * Shown verbatim in the debug view so the contabil can reproduce each
 * number from the Balanta de Verificare.
 */
export const INPUT_SOURCES: Record<keyof Omit<KpiBaseInputs, "monthsElapsed">, { label: string; source: string }> = {
  cifraAfaceri: {
    label: "Cifra de afaceri",
    source: "Rulaj total creditor 70x, minus rulaj debitor 709 (reduceri). Cumulat de la inceputul anului.",
  },
  venituriTotale: {
    label: "Venituri totale",
    source: "Rulaj total creditor clasa 7 (fara conturi de inchidere si extra-bilantiere).",
  },
  cheltuieliTotale: {
    label: "Cheltuieli totale",
    source: "Rulaj total debitor clasa 6, minus 609 (reduceri), fara impozit pe profit (691/698) si conturi de inchidere.",
  },
  cogs: {
    label: "Costuri directe (COGS aprox.)",
    source: "Rulaj total debitor grupa 60 (marfuri, materii prime, materiale, energie), minus rulaj creditor 609. Aproximare: nu include manopera directa.",
  },
  amortizare: {
    label: "Amortizare",
    source: "Rulaj total debitor 681 (amortizari si provizioane de exploatare).",
  },
  cheltuieliDobanzi: {
    label: "Cheltuieli cu dobanzi",
    source: "Rulaj total debitor 666.",
  },
  venituriDobanzi: {
    label: "Venituri din dobanzi",
    source: "Rulaj total creditor 766.",
  },
  cheltuieliPersonal: {
    label: "Cheltuieli cu personalul",
    source: "Rulaj total debitor grupa 64 (salarii, contributii, tichete, alte drepturi).",
  },
  chirii: {
    label: "Cheltuieli cu chirii",
    source: "Rulaj total debitor 612 (redevente, locatii de gestiune si chirii).",
  },
  impozitProfit: {
    label: "Impozit pe profit / venit",
    source: "Rulaj total debitor conturi marcate fiscal in catalog (691, 698).",
  },
  rezultatBrut: {
    label: "Rezultat brut",
    source: "Venituri totale minus cheltuieli totale (inainte de impozit).",
  },
  profitNet: {
    label: "Profit net",
    source: "Rezultat brut minus impozit pe profit / venit.",
  },
  ebit: {
    label: "EBIT",
    source: "Rezultat brut + cheltuieli cu dobanzi (666) − venituri din dobanzi (766).",
  },
  ebitda: {
    label: "EBITDA",
    source: "EBIT + amortizare (681).",
  },
  capexYtd: {
    label: "Investitii (CapEx aprox.)",
    source: "Rulaj total debitor 20x, 21x, 23x (intrari de imobilizari). Aproximare: include si transferurile intre conturi de imobilizari.",
  },
  stocuri: {
    label: "Stocuri",
    source: "Sold final debitor clasa 3, minus ajustari 39x.",
  },
  creanteClienti: {
    label: "Creante clienti",
    source: "Sold final debitor 411 + 413 + 418, minus 419 (clienti creditori).",
  },
  cash: {
    label: "Numerar si echivalente",
    source: "Sold final debitor 512 (fara 5125), 531, 532, 541, 542, 581.",
  },
  activeCurente: {
    label: "Active curente",
    source: "Numerar + creante clienti + alte creante (461, 4424, 4428, 409, 471) + stocuri.",
  },
  datoriiCurente: {
    label: "Datorii curente",
    source: "Sold final creditor furnizori (40x), salarii (42x), contributii (43x), fiscale (44x), asociati ct (455 fara 4551), dividende (457), creditori (462), credite pe termen scurt (519).",
  },
  datoriiTermenLung: {
    label: "Datorii pe termen lung",
    source: "Sold final creditor 162, 166, 167, 168, 4551.",
  },
  datoriiFinanciare: {
    label: "Datorii financiare",
    source: "Sold final creditor 162, 166, 167, 168, 519 (credite bancare si imprumuturi purtatoare de dobanda).",
  },
  furnizori: {
    label: "Furnizori",
    source: "Sold final creditor 401 + 403 + 404 + 408, minus 409 (furnizori debitori).",
  },
  capitalPropriu: {
    label: "Capital propriu",
    source: "Sold final creditor 101, 104, 105, 106 + rezultat (121, 117) − repartizari (129) − actiuni proprii (109).",
  },
  totalActiv: {
    label: "Total activ",
    source: "Imobilizari nete (20x-27x minus 28x/29x) + stocuri + creante + numerar + cheltuieli in avans (471).",
  },
  venituriChirii: {
    label: "Venituri din chirii",
    source: "Rulaj total creditor 706 (venituri din redevente, locatii de gestiune si chirii). Cumulat de la inceputul anului.",
  },
  reparatiiIntretinere: {
    label: "Intretinere si reparatii",
    source: "Rulaj total debitor 611 (cheltuieli cu intretinerea si reparatiile). Cumulat de la inceputul anului.",
  },
  imobilizariNete: {
    label: "Imobilizari nete",
    source: "Sold final debitor 20x, 21x, 23x, 26x, 27x, minus sold creditor 28x (amortizari) si 29x (ajustari).",
  },
  top3ClientiPercent: {
    label: "Concentrare top 3 clienti",
    source: "Suma rulajului total creditor (incasari cumulate) al primelor 3 analitice 411, impartita la rulajul total creditor al tuturor analiticelor 411.",
  },
  cifraAfaceriAnPrecedent: {
    label: "Cifra de afaceri an precedent",
    source: "Aceeasi formula a cifrei de afaceri, calculata pe perioada echivalenta a anului anterior (ianuarie -> aceeasi luna).",
  },
  numberOfEmployees: {
    label: "Numar mediu de angajati",
    source: "Introdus de contabil pentru luna selectata (din statul de plata / Revisal). Nu se poate deduce din jurnal.",
  },
};

/**
 * Extracts every raw aggregate the KPI registry needs, in a single pass
 * over the leaf rows. Pure. All conventions mirror compute.ts
 * (computeFinancialSummary / computePatrimoniu) so KPI values reconcile
 * with the rest of the owner snapshot.
 */
export function extractKpiBaseInputs(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  monthsElapsed: number,
  prevYearRows?: BalanceRowView[],
  numberOfEmployees: number | null = null
): KpiBaseInputs {
  const leaves = rows.filter((r) => r.isLeaf);

  let cifraAfaceri = 0;
  let venituriTotale = 0;
  let cheltuieliTotale = 0;
  let cogs = 0;
  let amortizare = 0;
  let cheltuieliDobanzi = 0;
  let venituriDobanzi = 0;
  let cheltuieliPersonal = 0;
  let chirii = 0;
  let impozitProfit = 0;
  let capexYtd = 0;
  let stocuri = 0;
  let creanteClienti = 0;
  let alteCreante = 0;
  let cash = 0;
  let datoriiCurente = 0;
  let datoriiTermenLung = 0;
  let datoriiFinanciare = 0;
  let furnizori = 0;
  let capitalPropriu = 0;
  let imobilizariNete = 0;
  let cheltuieliInAvans = 0;
  let venituriChirii = 0;
  let reparatiiIntretinere = 0;

  const clienti411: Array<{ incasari: number }> = [];

  for (const row of leaves) {
    const meta = lookupByBase(row.contBase, catalog);
    if (meta?.isExtraBilantier) continue;
    const b = row.contBase;
    const soldD = row.finD - row.finC;
    const soldC = row.finC - row.finD;

    // ---- P&L (YTD via totalDeb/totalCred) ----
    if (b.startsWith("7") && !meta?.isClosing) {
      if (b.startsWith("709")) {
        cifraAfaceri -= row.totalDeb;
        venituriTotale -= row.totalDeb;
      } else {
        if (b.startsWith("70")) cifraAfaceri += row.totalCred;
        venituriTotale += row.totalCred;
      }
      if (b.startsWith("766")) venituriDobanzi += row.totalCred;
      if (b.startsWith("706")) venituriChirii += row.totalCred;
    }
    if (b.startsWith("6") && !meta?.isClosing) {
      if (meta?.isProfitTax) {
        impozitProfit += row.totalDeb;
      } else if (b.startsWith("609")) {
        cheltuieliTotale -= row.totalCred;
        cogs -= row.totalCred;
      } else {
        cheltuieliTotale += row.totalDeb;
        if (b.startsWith("60")) cogs += row.totalDeb;
        if (b.startsWith("681")) amortizare += row.totalDeb;
        if (b.startsWith("666")) cheltuieliDobanzi += row.totalDeb;
        if (b.startsWith("64")) cheltuieliPersonal += row.totalDeb;
        if (b.startsWith("612")) chirii += row.totalDeb;
        if (b.startsWith("611")) reparatiiIntretinere += row.totalDeb;
      }
    }

    // ---- CapEx approximation ----
    if (b.startsWith("20") || b.startsWith("21") || b.startsWith("23")) {
      capexYtd += row.totalDeb;
    }

    // ---- Balance sheet (final balances) ----
    if (b.startsWith("3") && b[1] !== "9") stocuri += soldD;
    if (b.startsWith("39")) stocuri -= soldC;

    if (b.startsWith("411") || b.startsWith("413") || b.startsWith("418")) {
      creanteClienti += Math.max(soldD, 0);
    }
    if (b.startsWith("419")) creanteClienti -= Math.max(soldC, 0);
    if (b.startsWith("461") || b.startsWith("4424") || b.startsWith("4428")) {
      alteCreante += Math.max(soldD, 0);
    }
    if (b.startsWith("409")) alteCreante += Math.max(soldD, 0);
    if (b.startsWith("471")) cheltuieliInAvans += Math.max(soldD, 0);

    if (
      (b.startsWith("512") && !b.startsWith("5125")) ||
      b.startsWith("531") ||
      b.startsWith("532") ||
      b.startsWith("541") ||
      b.startsWith("542") ||
      b.startsWith("581")
    ) {
      cash += Math.max(soldD, 0);
    }

    if (b.startsWith("401") || b.startsWith("403") || b.startsWith("404") || b.startsWith("405") || b.startsWith("408")) {
      furnizori += Math.max(soldC, 0);
      datoriiCurente += Math.max(soldC, 0);
    }
    if (
      b.startsWith("421") || b.startsWith("423") || b.startsWith("425") ||
      b.startsWith("426") || b.startsWith("427") || b.startsWith("428") ||
      b.startsWith("431") || b.startsWith("436") || b.startsWith("437") || b.startsWith("438") ||
      b.startsWith("441") || b.startsWith("4423") || b.startsWith("4426") || b.startsWith("4427") ||
      b.startsWith("444") || b.startsWith("446") || b.startsWith("447") || b.startsWith("448") ||
      b.startsWith("457") || b.startsWith("462")
    ) {
      datoriiCurente += Math.max(soldC, 0);
    }
    if (b.startsWith("455") && !b.startsWith("4551")) datoriiCurente += Math.max(soldC, 0);
    if (b.startsWith("4428")) {
      // sold creditor on 4428 counts as datorie (already covered for debit above)
      datoriiCurente += Math.max(soldC, 0);
    }
    if (b.startsWith("519")) {
      datoriiCurente += Math.max(soldC, 0);
      datoriiFinanciare += Math.max(soldC, 0);
    }
    if (b.startsWith("162") || b.startsWith("166") || b.startsWith("167") || b.startsWith("168")) {
      datoriiTermenLung += Math.max(soldC, 0);
      datoriiFinanciare += Math.max(soldC, 0);
    }
    if (b.startsWith("4551")) datoriiTermenLung += Math.max(soldC, 0);

    if (b.startsWith("101") || b.startsWith("104") || b.startsWith("105") || b.startsWith("106")) {
      capitalPropriu += soldC;
    }
    if (b.startsWith("121") || b.startsWith("117")) capitalPropriu += soldC;
    if (b.startsWith("129")) capitalPropriu -= soldD;
    if (b.startsWith("109")) capitalPropriu -= soldD;

    if (b.startsWith("20") || b.startsWith("21") || b.startsWith("23") || b.startsWith("26") || b.startsWith("27")) {
      imobilizariNete += soldD;
    }
    if (b.startsWith("28") || b.startsWith("29")) imobilizariNete -= soldC;

    // ---- Top 3 client concentration (411 analytics, YTD incasari) ----
    if (b.startsWith("411") && row.cont !== row.contBase && row.totalCred > 0.01) {
      clienti411.push({ incasari: row.totalCred });
    }
  }

  const activeCurente = cash + creanteClienti + alteCreante + stocuri + cheltuieliInAvans;
  const totalActiv = imobilizariNete + activeCurente;
  const rezultatBrut = venituriTotale - cheltuieliTotale;
  const profitNet = rezultatBrut - impozitProfit;
  const ebit = rezultatBrut + cheltuieliDobanzi - venituriDobanzi;
  const ebitda = ebit + amortizare;

  let top3ClientiPercent: number | null = null;
  const totalIncasari = clienti411.reduce((s, c) => s + c.incasari, 0);
  if (totalIncasari > 0.01) {
    const top3 = clienti411
      .map((c) => c.incasari)
      .sort((a, b2) => b2 - a)
      .slice(0, 3)
      .reduce((s, v) => s + v, 0);
    top3ClientiPercent = round2((top3 / totalIncasari) * 100);
  }

  let cifraAfaceriAnPrecedent: number | null = null;
  if (prevYearRows) {
    let prev = 0;
    let any = false;
    for (const row of prevYearRows) {
      if (!row.isLeaf) continue;
      const meta = lookupByBase(row.contBase, catalog);
      if (meta?.isClosing || meta?.isExtraBilantier) continue;
      const b = row.contBase;
      if (b.startsWith("709")) {
        prev -= row.totalDeb;
        any = any || row.totalDeb !== 0;
      } else if (b.startsWith("70")) {
        prev += row.totalCred;
        any = any || row.totalCred !== 0;
      }
    }
    cifraAfaceriAnPrecedent = any ? round2(prev) : null;
  }

  return {
    monthsElapsed,
    cifraAfaceri: round2(cifraAfaceri),
    venituriTotale: round2(venituriTotale),
    cheltuieliTotale: round2(cheltuieliTotale),
    cogs: round2(cogs),
    amortizare: round2(amortizare),
    cheltuieliDobanzi: round2(cheltuieliDobanzi),
    venituriDobanzi: round2(venituriDobanzi),
    cheltuieliPersonal: round2(cheltuieliPersonal),
    chirii: round2(chirii),
    impozitProfit: round2(impozitProfit),
    rezultatBrut: round2(rezultatBrut),
    profitNet: round2(profitNet),
    ebit: round2(ebit),
    ebitda: round2(ebitda),
    capexYtd: round2(capexYtd),
    stocuri: round2(stocuri),
    creanteClienti: round2(creanteClienti),
    cash: round2(cash),
    activeCurente: round2(activeCurente),
    datoriiCurente: round2(datoriiCurente),
    datoriiTermenLung: round2(datoriiTermenLung),
    datoriiFinanciare: round2(datoriiFinanciare),
    furnizori: round2(furnizori),
    capitalPropriu: round2(capitalPropriu),
    totalActiv: round2(totalActiv),
    venituriChirii: round2(venituriChirii),
    reparatiiIntretinere: round2(reparatiiIntretinere),
    imobilizariNete: round2(imobilizariNete),
    top3ClientiPercent,
    cifraAfaceriAnPrecedent,
    numberOfEmployees,
  };
}
