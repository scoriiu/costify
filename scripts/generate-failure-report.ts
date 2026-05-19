/**
 * Parses the verbose Vitest output captured in /tmp/full-output.txt and emits
 * an HTML report at temp/reconciliation-report.html with one card per failing
 * account, including the expected vs received delta and a hypothesized cause.
 *
 *   npx vitest run tests/unit/modules/balances/client-reconciliation \
 *     --reporter=verbose 2>&1 > /tmp/full-output.txt
 *   pnpm tsx scripts/generate-failure-report.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

interface Failure {
  client: string;
  period: string;
  dimension: "sold final" | "rulaj total" | "sold initial";
  account: string;
  expectedLine: string;
  expected: number;
  received: number;
  delta: number;
}

const FAIL_LINE = /^ × tests\/unit\/modules\/balances\/client-reconciliation\/(\S+\.test\.ts)\s+>\s+(.+?)\s+>\s+(sold final|rulaj total|sold initial)[^>]*>\s+(\S+)\s+(.+?)\s+\d+ms\s*$/;
// Two formats supported:
//   1) `→ expected X to be close to Y, received difference is Z, but expected ...`
//   2) `→ ACCT DIM: expected Y, got X, diff Z > ...`
const ASSERT_LINE_V1 = /→\s+expected\s+(\S+)\s+to be close to\s+(\S+?),\s+received difference is\s+(\S+),/;
const ASSERT_LINE_V2 = /→\s+\S+\s+\S+:\s+expected\s+(\S+),\s+got\s+(\S+),\s+diff\s+(\S+)\s+>/;

function parseNumber(s: string): number {
  if (s === "+0") return 0;
  if (s === "-0") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseFailures(text: string): Failure[] {
  const lines = text.split("\n");
  const failures: Failure[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(FAIL_LINE);
    if (!m) continue;
    const [, , suiteLabel, dimension, account, expectedLine] = m;
    let receivedStr: string | undefined;
    let expectedStr: string | undefined;
    let deltaStr: string | undefined;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v2 = lines[j].match(ASSERT_LINE_V2);
      if (v2) {
        // V2: expected = Saga, got = Costify, diff = abs(got - expected)
        expectedStr = v2[1]; receivedStr = v2[2]; deltaStr = v2[3];
        break;
      }
      const v1 = lines[j].match(ASSERT_LINE_V1);
      if (v1) {
        // V1: expected (first arg) = Costify (actual), to be close to (second) = Saga
        receivedStr = v1[1]; expectedStr = v1[2]; deltaStr = v1[3];
        break;
      }
    }
    if (!receivedStr || !expectedStr || !deltaStr) continue;
    const periodMatch = suiteLabel.match(/—\s+(.+)$/);
    const period = periodMatch ? periodMatch[1] : suiteLabel;
    const client = suiteLabel.split(" — ")[0];
    failures.push({
      client,
      period,
      dimension: dimension as Failure["dimension"],
      account,
      expectedLine: expectedLine.trim(),
      expected: parseNumber(expectedStr),
      received: parseNumber(receivedStr),
      delta: parseNumber(deltaStr),
    });
  }
  return failures;
}

interface FailureNote {
  category: string;
  severity: "blocker" | "data-issue" | "saga-anomaly" | "missing-data";
  explanation: string;
}

function classifyFailure(f: Failure): FailureNote {
  const acct = f.account;
  const baseAcct = acct.split(".")[0];

  if (acct === "4423" && f.expected < 0) {
    return {
      category: "Saga: sold negativ pe partea creditoare",
      severity: "saga-anomaly",
      explanation:
        "Saga afișează sold inițial negativ pe partea creditoare (sold_in_c = " +
        f.expected.toFixed(2) +
        "). Un sold creditor negativ nu are sens contabil — semnifică sold debitor pozitiv în realitate. " +
        "Costify normalizează la max(D-C, 0), matematic echivalent. Anomalia trebuie verificată în Saga: este un sold real D = " +
        Math.abs(f.expected).toFixed(2) +
        " (TVA de recuperat) sau eroare de închidere?",
    };
  }

  if (baseAcct === "1012" || baseAcct === "1015") {
    return {
      category: "Cont orfan: sold inițial fără înregistrări în jurnal",
      severity: "missing-data",
      explanation:
        "Contul " +
        baseAcct +
        " (capital social) apare în balanță cu sold inițial " +
        f.expected.toFixed(2) +
        " RON dar **nu există nicio înregistrare pe acest cont în registrul jurnal exportat**. " +
        "Saga tine soldul intern prin operatiuni de preluare sold anterioare exercitiului, dar nu le include in exportul standard. " +
        "Trebuie să decidem cum aducem aceste solduri de deschidere în Costify (înregistrare specială, fișier separat, etc).",
    };
  }

  if (baseAcct === "5311" && f.dimension === "sold inițial".replace("inițial", "initial") as "sold initial") {
    return {
      category: "Cont orfan: sold de casă fără înregistrări în jurnal",
      severity: "missing-data",
      explanation:
        "Contul 5311 (Casa în lei) apare în balanță cu sold " +
        f.expected.toFixed(2) +
        " RON dar nu are nicio înregistrare în registrul jurnal. " +
        "Soldul provine din exercițiile anterioare prin operațiuni Saga de preluare sold care nu sunt incluse în exportul standard.",
    };
  }

  if (acct === "5311") {
    return {
      category: "Cont 5311: diferență agregată din lipsă sold inițial",
      severity: "missing-data",
      explanation:
        "Costify calculează rulaj/sold final greșit pentru 5311 pentru că **soldul inițial al casei din exercițiul anterior lipsește din jurnal**. " +
        "Toate operațiile pe casă din perioada curentă sunt corecte în Costify, dar baza de pornire (sold inițial) e necunoscută. " +
        "Vezi nota pe sold inițial 5311 — aceeași cauză rădăcină.",
    };
  }

  if (acct === "542") {
    return {
      category: "Saga: cont 542 listat de două ori în balanță",
      severity: "saga-anomaly",
      explanation:
        "Saga exportă **două linii** distincte cu cont = '542' în balanță: o linie pentru sintetic (suma analiticelor netting-uite) și o a doua linie pentru analitic implicit fără sufix. " +
        "Costify agregă cele două variante diferit decât Saga (diferență ~3 RON). Trebuie clarificat cu Claudia ce reprezintă a doua linie 542 și cum o reconciliem.",
    };
  }

  if (acct === "5328") {
    return {
      category: "Saga: rulaj negativ pe partea creditoare",
      severity: "saga-anomaly",
      explanation:
        "Saga arată `rulaj_c = " +
        f.expected.toFixed(2) +
        "` (negativ pe partea credit). Costify normalizează la rulaj pozitiv pe partea opusă, matematic echivalent. " +
        "Aceeași anomalie ca 4423 — Saga ține semnul brut din exercițiul anterior.",
    };
  }

  if (acct === "4518") {
    return {
      category: "Jurnal incomplet: 91 RON lipsă pe contul 4518",
      severity: "data-issue",
      explanation:
        "Balanța Saga arată `rulaj_c = 12.162,37` cumulat în 2025. Jurnalul exportat conține doar **12.070,98 RON** în cele 21 înregistrări de 4518 din 2025. " +
        "Diferența de 91,39 RON sugerează că Saga are o înregistrare suplimentară (probabil regularizare, reevaluare la închidere de an, sau notă manuală) care nu apare în exportul standard al registrului jurnal.",
    };
  }

  if (acct.startsWith("167.")) {
    return {
      category: "Cont 167.x: diferență din sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (împrumut bancar/leasing) are sold inițial Saga = " +
        f.expected.toFixed(2) +
        " RON care provine din 2024. Jurnalul Titan începe în 2025 (firmă nouă din 2025), deci Costify nu vede soldul anterior. " +
        "Diferenta reflecta exact soldul preluat la 01.01.2025 prin operatiunea Saga de deschidere de an. Trebuie sa integram operatiunile de preluare in jurnal sau sa adaugam un mecanism separat de solduri initiale anuale.",
    };
  }

  if (acct.startsWith("121") || acct === "129") {
    return {
      category: "Cont 121/129: rezultat reportat din exercițiul anterior",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (profit/pierdere) are sold inițial " +
        f.expected.toFixed(2) +
        " RON din exercițiul anterior. " +
        "Costify nu vede operațiunile de închidere a anului precedent din jurnalul exportat — Saga le ține intern.",
    };
  }

  if (acct === "421") {
    return {
      category: "Cont 421: salarii cu sold inițial din 2024",
      severity: "missing-data",
      explanation:
        "Contul 421 (Personal - salarii datorate) are sold inițial " +
        f.expected.toFixed(2) +
        " RON la 01.01.2025 (salariile decembrie 2024 plătite în ianuarie 2025). " +
        "Costify nu vede operațiunile din 2024.",
    };
  }

  if (acct.startsWith("4091") || acct.startsWith("4092")) {
    return {
      category: "Avansuri furnizori: sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (avansuri către furnizori) cu sold inițial " +
        f.expected.toFixed(2) +
        " RON la 01.01.2025. Diferența pe rulaj total reflectă lipsa operațiunilor 2024.",
    };
  }

  if (acct === "463") {
    return {
      category: "Creanțe cu bugetul: sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Contul 463 (Creanțe cu bugetul statului) sold inițial " +
        f.expected.toFixed(2) +
        " RON la 01.01.2025 — sold preluat din exercițiul anterior.",
    };
  }

  if (acct === "2678" || acct === "2813" || acct === "2814") {
    return {
      category: "Imobilizări/amortizare: sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (imobilizare sau amortizare cumulată) cu sold inițial " +
        f.expected.toFixed(2) +
        " RON preluat din exercițiul 2024. Lipsa operațiunilor anterioare din jurnal generează diferența.",
    };
  }

  if (acct === "1061") {
    return {
      category: "Rezerve legale: sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Contul 1061 (Rezerve legale) sold inițial 40 RON la 01.01.2025 din exercițiul anterior.",
    };
  }

  if (acct === "4382" || acct === "419") {
    return {
      category: "Contribuții sociale: rulaj parțial",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " are rulaj Saga " +
        f.expected.toFixed(2) +
        " RON dar Costify vede 0. Probabil o categorie de contribuții/avans clienți a fost calculată direct în Saga prin operațiuni nepublicate în registrul jurnal exportat.",
    };
  }

  if (acct.startsWith("44")) {
    return {
      category: "Cont 44x (impozite/contribuții): sold inițial 2024",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (impozit/contribuție) sold inițial " +
        f.expected.toFixed(2) +
        " RON din 2024 — preluare sold care nu apare în jurnal.",
    };
  }

  if (acct.startsWith("33") || acct === "331") {
    return {
      category: "Producție în curs: sold inițial 2024",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (producție/lucrări în curs) sold inițial 2024 " +
        f.expected.toFixed(2) +
        " RON.",
    };
  }

  if (acct.startsWith("401.") || acct === "401") {
    return {
      category: "Furnizori: sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Cont furnizor " +
        acct +
        " cu sold inițial preluat din 2024 (datorii către furnizor). Diferența reflectă operațiuni vechi inaccesibile în jurnal.",
    };
  }

  if (acct.startsWith("471")) {
    return {
      category: "Cheltuieli înregistrate în avans: sold inițial",
      severity: "missing-data",
      explanation:
        "Contul 471 (Cheltuieli înregistrate în avans) cu sold inițial " +
        f.expected.toFixed(2) +
        " RON din 2024 — provizioane sau abonamente facturate în 2024 pentru 2025.",
    };
  }

  if (acct.startsWith("2131") || acct.startsWith("2133")) {
    return {
      category: "Imobilizari corporale: sold initial 2024 lipsa",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (imobilizare corporala — mijloace fixe) cu sold initial " +
        f.expected.toFixed(2) +
        " RON preluat din 2024. Achizitiile vechi nu apar in jurnalul 2025-2026.",
    };
  }

  if (acct.startsWith("427")) {
    return {
      category: "Retineri din salarii: sold initial 2024",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (retineri din salarii — popriri, alte) cu sold initial " +
        f.expected.toFixed(2) +
        " RON din decembrie 2024 (retineri din salariile lunii decembrie platibile in ianuarie).",
    };
  }

  if (acct === "4315" || acct === "4316") {
    return {
      category: "Contributii salariale (CAS/CASS): sold initial 2024",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (contributii salariale CAS/CASS) cu sold initial " +
        f.expected.toFixed(2) +
        " RON — contributii datorate pentru salariile decembrie 2024.",
    };
  }

  if (acct === "436") {
    return {
      category: "Contributii somaj: sold initial 2024",
      severity: "missing-data",
      explanation:
        "Contul 436 (Contributii asigurari somaj) sold initial " +
        f.expected.toFixed(2) +
        " RON pentru salariile decembrie 2024.",
    };
  }

  if (acct.startsWith("419")) {
    return {
      category: "Clienti creditori (avansuri primite): sold initial 2024",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (clienti creditori — avansuri primite de la clienti) cu sold initial " +
        f.expected.toFixed(2) +
        " RON la 01.01.2025.",
    };
  }

  if (acct.startsWith("5121")) {
    return {
      category: "Conturi bancare: sold inițial 2024 lipsă",
      severity: "missing-data",
      explanation:
        "Contul " +
        acct +
        " (cont curent în bancă) sold inițial " +
        f.expected.toFixed(2) +
        " RON la 01.01.2025 — sold real bancar la sfârșit de an care nu apare în registrul jurnal.",
    };
  }

  return {
    category: "Diferență neclasificată",
    severity: "data-issue",
    explanation:
      "Diferență între Saga și Costify pe " +
      f.dimension +
      ": așteptat " +
      f.expected.toFixed(2) +
      ", primit " +
      f.received.toFixed(2) +
      ", deltă " +
      f.delta.toFixed(2) +
      ". Necesită investigație manuală.",
  };
}

const SEVERITY_COLOR: Record<FailureNote["severity"], string> = {
  blocker: "#E63946",
  "data-issue": "#F0883E",
  "saga-anomaly": "#FDCB6E",
  "missing-data": "#58A6FF",
};

const SEVERITY_LABEL: Record<FailureNote["severity"], string> = {
  blocker: "Blocker",
  "data-issue": "Problemă de date",
  "saga-anomaly": "Anomalie Saga",
  "missing-data": "Date lipsă (sold anterior)",
};

function renderHTML(failures: Failure[]): string {
  const grouped = new Map<string, Failure[]>();
  for (const f of failures) {
    const key = `${f.client} — ${f.period}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  const summary = Array.from(grouped.entries())
    .map(([k, list]) => `<li><strong>${k}</strong>: ${list.length} diferențe</li>`)
    .join("\n      ");

  const sections = Array.from(grouped.entries())
    .map(([groupLabel, list]) => {
      const cards = list
        .map((f) => {
          const note = classifyFailure(f);
          const color = SEVERITY_COLOR[note.severity];
          return `
        <div class="card" style="border-left: 4px solid ${color}">
          <div class="card-head">
            <div class="account-line">
              <span class="dim">${f.dimension}</span>
              <code class="account">${f.account}</code>
              <span class="badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40">${SEVERITY_LABEL[note.severity]}</span>
            </div>
            <h3>${note.category}</h3>
          </div>
          <div class="numbers">
            <div><span class="label">Saga (așteptat):</span> <code>${f.expected.toFixed(2)}</code></div>
            <div><span class="label">Costify (calculat):</span> <code>${f.received.toFixed(2)}</code></div>
            <div><span class="label">Deltă:</span> <code class="delta">${f.delta.toFixed(2)}</code></div>
          </div>
          <p class="note">${note.explanation}</p>
        </div>`;
        })
        .join("\n");
      return `
    <section>
      <h2>${groupLabel}</h2>
      <div class="cards">
        ${cards}
      </div>
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <title>Reconciliation Failure Report — Costify vs Saga</title>
  <style>
    :root {
      --bg: #F0EFEA;
      --surface: #F7F6F2;
      --surface-2: #E6E4DE;
      --text: #1A1918;
      --text-secondary: #44413C;
      --text-muted: #7A766E;
      --primary: #0D6B5E;
      --primary-dark: #0A5A4F;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 40px 24px;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      letter-spacing: -0.02em;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 32px; letter-spacing: -0.04em; margin: 0 0 8px; }
    .subtitle { color: var(--text-muted); margin: 0 0 32px; }
    .overview {
      background: var(--surface);
      border: 1px solid var(--surface-2);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 40px;
    }
    .overview h2 { margin: 0 0 12px; font-size: 16px; letter-spacing: -0.04em; }
    .overview ul { margin: 0; padding-left: 20px; line-height: 1.7; }
    section { margin-bottom: 40px; }
    section h2 {
      font-size: 22px;
      letter-spacing: -0.04em;
      padding-bottom: 12px;
      margin: 0 0 20px;
      border-bottom: 1px solid var(--surface-2);
    }
    .cards { display: grid; gap: 16px; }
    .card {
      background: var(--surface);
      border: 1px solid var(--surface-2);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .card-head { margin-bottom: 12px; }
    .account-line {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .dim {
      font-family: ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }
    .account {
      font-family: ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace;
      font-size: 14px;
      font-weight: 600;
      background: var(--surface-2);
      padding: 2px 8px;
      border-radius: 6px;
    }
    .badge {
      font-family: ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 600;
    }
    h3 {
      font-size: 15px;
      letter-spacing: -0.04em;
      margin: 6px 0;
      font-weight: 600;
    }
    .numbers {
      display: flex; gap: 24px; flex-wrap: wrap;
      padding: 10px 0;
      border-top: 1px solid var(--surface-2);
      border-bottom: 1px solid var(--surface-2);
      margin: 10px 0;
    }
    .label {
      font-family: ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      margin-right: 6px;
    }
    .numbers code {
      font-family: ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace;
      font-size: 13px;
      font-weight: 600;
    }
    .delta { color: #B91C1C; }
    .note {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-secondary);
      margin: 0;
    }
    .note strong { color: var(--text); }
    code { font-family: ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reconciliation Failure Report</h1>
    <p class="subtitle">Costify vs Saga — diferențe pe perioada testată, generate automat din suita de teste.</p>

    <div class="overview">
      <h2>Sumar</h2>
      <ul>
      ${summary}
      </ul>
    </div>
    ${sections}
  </div>
</body>
</html>`;
}

function main(): void {
  const inputPath = "/tmp/full-output.txt";
  const outputPath = resolve(process.cwd(), "temp/reconciliation-report.html");
  const text = readFileSync(inputPath, "utf-8");
  const failures = parseFailures(text);
  console.log(`Parsed ${failures.length} failures`);
  const html = renderHTML(failures);
  writeFileSync(outputPath, html);
  console.log(`Report written: ${outputPath}`);
}

main();
