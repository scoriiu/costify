/**
 * @deprecated Use @/modules/accounts instead.
 * The canonical source is now seeds/omfp-1802.json + AccountCatalog table.
 * This file is kept only for legacy compatibility and will be removed.
 */
const ACCOUNT_NAMES: Record<string, string> = {
  "101": "Capital social", "1011": "Capital subscris nevarsat", "1012": "Capital subscris varsat",
  "104": "Prime de capital", "105": "Rezerve din reevaluare",
  "1061": "Rezerve legale", "1063": "Rezerve statutare", "1068": "Alte rezerve",
  "117": "Rezultatul reportat", "121": "Profit si pierdere", "129": "Repartizarea profitului",
  "1621": "Credite bancare pe termen lung", "167": "Alte imprumuturi si datorii asimilate",
  "201": "Cheltuieli de constituire", "203": "Cheltuieli de dezvoltare",
  "205": "Concesiuni, brevete, licente", "207": "Fond comercial", "208": "Alte imobilizari necorporale",
  "211": "Terenuri", "212": "Constructii",
  "2131": "Echipamente tehnologice", "2132": "Aparate si instalatii", "2133": "Mijloace de transport",
  "214": "Mobilier, birotica", "231": "Imobilizari corporale in curs",
  "261": "Actiuni detinute la filiale", "267": "Creante imobilizate",
  "280": "Amortizari imobilizari necorporale", "281": "Amortizari imobilizari corporale",
  "2811": "Amortizarea constructiilor", "2812": "Amortizarea echipamentelor",
  "2813": "Amortizarea instalatiilor", "2814": "Amortizarea altor imobilizari corporale",
  "301": "Materii prime", "302": "Materiale consumabile", "3022": "Combustibili",
  "303": "Materiale de natura ob. de inventar", "345": "Produse finite",
  "371": "Marfuri", "381": "Ambalaje",
  "401": "Furnizori", "404": "Furnizori de imobilizari",
  "408": "Furnizori - facturi nesosite", "409": "Furnizori - debitori",
  "411": "Clienti", "4111": "Clienti",
  "418": "Clienti - facturi de intocmit", "419": "Clienti - creditori",
  "421": "Personal - salarii datorate", "425": "Avansuri acordate personalului",
  "427": "Retineri din salarii datorate tertilor",
  "431": "Asigurari sociale", "4311": "Contributia unitatii la asigurari sociale",
  "4312": "Contributia personalului la asigurari sociale",
  "4411": "Impozitul pe profit", "4418": "Impozit pe venit/alte impozite",
  "4423": "TVA de plata", "4424": "TVA de recuperat",
  "4426": "TVA deductibila", "4427": "TVA colectata", "4428": "TVA neexigibila",
  "444": "Impozitul pe veniturile de natura salariilor",
  "446": "Alte impozite, taxe", "447": "Fonduri speciale",
  "455": "Sume datorate asociatilor", "4551": "Asociati - conturi curente",
  "456": "Decontari cu asociatii privind capitalul", "457": "Dividende de plata",
  "461": "Debitori diversi", "462": "Creditori diversi",
  "471": "Cheltuieli inregistrate in avans", "472": "Venituri inregistrate in avans",
  "473": "Decontari din operatii in curs de clarificare",
  "5121": "Conturi curente la banci in lei", "5124": "Conturi curente la banci in valuta",
  "519": "Credite bancare pe termen scurt", "5191": "Credite bancare pe termen scurt",
  "531": "Casa", "5311": "Casa in lei", "5314": "Casa in valuta",
  "542": "Avansuri de trezorerie", "581": "Viramente interne",
  "601": "Cheltuieli cu materialele consumabile",
  "604": "Cheltuieli cu materialele nestocate",
  "605": "Cheltuieli cu energia si apa", "607": "Cheltuieli cu marfurile",
  "609": "Reduceri comerciale primite",
  "611": "Cheltuieli cu intretinerea si reparatiile",
  "612": "Cheltuieli cu chiriile", "613": "Cheltuieli cu primele de asigurare",
  "621": "Cheltuieli cu colaboratorii", "622": "Cheltuieli cu comisioanele si onorariile",
  "623": "Cheltuieli de protocol, reclama", "624": "Cheltuieli cu transportul",
  "625": "Cheltuieli cu deplasari", "626": "Cheltuieli postale si telecomunicatii",
  "627": "Cheltuieli cu serviciile bancare", "628": "Alte cheltuieli cu servicii terti",
  "635": "Cheltuieli cu alte impozite, taxe",
  "641": "Cheltuieli cu salariile personalului",
  "6451": "Cheltuieli contributie asigurari sociale",
  "646": "Cheltuieli cu tichetele de masa",
  "654": "Pierderi din creante", "658": "Alte cheltuieli de exploatare",
  "665": "Cheltuieli din diferente de curs valutar",
  "666": "Cheltuieli cu dobanzile", "668": "Alte cheltuieli financiare",
  "6811": "Cheltuieli cu amortizarea imobilizarilor",
  "6812": "Cheltuieli cu provizioanele",
  "701": "Venituri din vanzarea produselor finite",
  "704": "Venituri din servicii prestate", "706": "Venituri din chirii",
  "707": "Venituri din vanzarea marfurilor", "708": "Venituri din activitati diverse",
  "709": "Reduceri comerciale acordate",
  "711": "Venituri aferente costurilor stocurilor",
  "741": "Venituri din subventii de exploatare",
  "754": "Venituri din creante reactivate", "758": "Alte venituri din exploatare",
  "765": "Venituri din diferente de curs valutar",
  "766": "Venituri din dobanzi", "768": "Alte venituri financiare",
  "781": "Venituri din provizioane si ajustari",
};

export function getAccountName(contBase: string): string {
  if (ACCOUNT_NAMES[contBase]) return ACCOUNT_NAMES[contBase];
  for (let len = contBase.length - 1; len >= 2; len--) {
    const prefix = contBase.slice(0, len);
    if (ACCOUNT_NAMES[prefix]) return ACCOUNT_NAMES[prefix];
  }
  return `Cont ${contBase}`;
}
