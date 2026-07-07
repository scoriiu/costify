# CFO & Controlling Research for Costi

**Date**: 2026-07-07
**Purpose**: Source material for ADR-0005 Stage 2 (CFO identity, response contract, playbooks) and later stages (recipes, monthly brief, owner voice). Three research tracks: (1) fractional CFO practice for SMEs, (2) the European controlling discipline (IGC/ICV, IBCS), (3) the Romanian SME financial context. Everything here was fetched from real sources in July 2026; uncertain items are explicitly marked.

---

## 1. How real CFOs work with small businesses

### The fractional CFO 90-day arc (Blackpeak, Umbrex)

Three phases: **understand → build → optimize/advise**. The strongest lesson: a good CFO changes *nothing* in month 1. "The worst thing you can do in week one is start fixing an accounting system you haven't fully mapped."

- **Month 1**: access + document handoff, chart-of-accounts audit, 12-24 month historical trend review, run one close and document it. Deliverable: a "Day 7 flash" diagnostic (runway reality, margin leakage, one quick win) and a "top 5 financial priorities" memo.
- **Month 2**: reporting infrastructure. Management accounts with *variance commentary that names causes* ("Revenue down 8% vs plan because Project X slipped", never "revenue is $42,000"). KPI dashboard of **5-8 metrics only**. **13-week rolling cash forecast, updated weekly**, called "the one thing that changes an owner's life".
- **Month 3**: board-ready package, forward-looking work (budget, scenarios, "breakeven on that new hire"), tax planning coordination.

Cadence with the owner: one recurring **45-60 minute monthly review**. Weekly narrative discipline in three bullets: *what moved (deviations >5%) / why it matters / next action with owner and deadline*.

### The 13-week cash flow forecast (Atlar, Wall Street Prep)

- 13 weeks = one fiscal quarter; the sweet spot between forecastability (from AR/AP + patterns) and reaction time (enough runway to arrange financing or delay payments).
- **Direct method always**: opening balance → receipts by category → disbursements by category (customer receipts / supplier payments / payroll / tax / debt service / one-offs, each one-off with a mandatory note) → net per week → closing balance per week.
- Rolling, updated weekly; weekly forecast-vs-actual variance is the accuracy engine.
- Scenarios: baseline / biggest customer pays 15 days late / contract closes early.
- Alarm triggers: any week's projected closing balance below minimum reserve; runway < 6 months (urgent) / < 9 months (warning); forecast variance > 5%.

### The monthly review agenda (Eagle Rock, exact timings)

75 minutes: 5' headlines → 15' financial performance (vs budget AND vs prior year, exceptions only) → 10' cash & liquidity → 15' KPIs / leading indicators → 15' forward look → 10' decision items (always arrive with a recommendation) → 5' actions with owners and due dates. Last month's actions reviewed at the start. Exception-based (>10% or fixed floor). Held 10-15 days after month-end. Never cancelled.

### The CEO Flash Report (Blackpeak sample — the model for the monthly brief)

1. One-sentence verdict in plain language, addressed by name ("Jimmy — January was your best month in 7 years. Two items need your attention this week.")
2. Six KPI tiles with YoY deltas.
3. Condensed P&L vs prior year + trend + cash/working-capital box.
4. "Business verdicts": checklist of one-liners with checkmark/warning icons.
5. "Priority actions this week" ranked NOW / MED / FYI, each with amount, deadline, owner, and **consequence of inaction** ("Risk: write-off if hits 90 days").
6. Owner-world translations: "what you actually made" (net income → free cash → **distributable earnings vs draw actually taken**), estimated business value (EBITDA × multiples), 90-day forecast, tax calendar with amounts.

### What owners ask and misunderstand

- The #1 question verbatim: **"We made 100k profit, so why is there no cash in the bank?"** The answer must be the firm's actual bridge: profit → ΔAR, Δinventory, loan principal paid, distributions taken, assets bought, taxes due. Computed, not lectured.
- Recurring blind spots: distributions taken from "profit" instead of distributable cash; margin by service line unknown ("where you make money is not where you think"); DSO blindness ("every day over 30 is cash trapped in someone else's bank account"); believing revenue solves everything.
- Memorable framings worth adapting: "Profit is an accounting measurement. Cash flow is a survival measurement."

### Communication frameworks

- **Minto Pyramid / BLUF**: conclusion first, key arguments second, evidence last. The message must survive a reader who stops after sentence one.
- **What / So What / Now What**: fact → meaning → action. Maps 1:1 to variance commentary: number → cause → recommendation.

---

## 2. The controlling discipline (IGC / ICV / IBCS)

### Controller Mission Statement V4 (IGC 2024)

Controllers are "trusted partners of management... the driving force for sustainable success and guardians of financial integrity". They *co-own* the management process (goal setting, planning, control) — not a bookkeeping function. Always pair a negative signal with an option to act; pair oversight with a forward look.

### IGC Controlling Process Model 2.0 — the 10 processes

1. Strategic Planning, 2. Operational Planning/Budgeting/**Forecasting**, 3. Investment Controlling, 4. Cost Accounting, 5. **Management Reporting**, 6. **Business Partnering**, 7. Project Controlling, 8. Risk Controlling, 9. Data Management, 10. Further Development. Function Controlling (sales/HR/production) is a cross-cutting layer.

Core five: Planning/Budgeting/Forecasting, Investment Controlling, Cost Accounting, Management Reporting, Business Partnering. **Costify today covers cost accounting + management reporting; forecasting, risk controlling, and business partnering are Costi's expansion axes. "Data management" (unmapped accounts, coverage) is itself a first-class controlling process we already surface.**

Management Reporting anatomy: a report is complete only when it carries "a specific message for the management... and possibly already specific suggestions for measures", and the process *ends when countermeasures have been approved*. Reporting dimensions: **Actual, Actual previous year, Planned, Target, Forecast**.

### Variance analysis (Abweichungsanalyse)

- Defined as "a preparatory activity for deriving measures" — output is action, not explanation.
- Canonical decomposition: **price variance vs volume variance** (both sides), plus mix for multi-product; consumption + capacity variances in production.
- **Management by exception**: comment only unusual/significant deviations. DACH convention: **dual threshold — relative (±5-10% of plan) AND absolute floor (fixed amount scaled to entity), both breached** before a comment is due. (Convention, not a cited standard — treat exact numbers as configurable policy.)
- Variances matter most **on a trend**: a variance changing regime month-over-month beats its level. Recurring exceptions need root-cause work, not repeated boilerplate.
- Model comment sentence: *magnitude → primary cause → business reason → measure*.
- Monthly cost-centre-by-cost-centre review of overheads "frequently does not make much sense" — comment at driver level.

### IBCS — SUCCESS rules + notation (now ISO 24896)

- **S**AY (every report has one explicit message), **U**NIFY (semantic notation), **C**ONDENSE, **C**HECK (visual integrity), **E**XPRESS, **S**IMPLIFY, **S**TRUCTURE.
- Scenario vocabulary: **AC / PY / PL / FC** (Romanian: Realizat / An precedent / Buget / Forecast). Never mix "plan"/"buget"/"tinta" as synonyms in one surface.
- Notation: solid fill = actual, gray = previous year, outline = plan, hatched = forecast. Green/red only for variances, **semantically signed** (cost overrun = red even though the number is positive). Time horizontal, structure vertical. Title = Subject · Measure with unit · Period. Show absolute AND relative variance together.

### Driver trees (DuPont / Kennzahlenpyramide)

- ROE = margin × asset turnover × leverage (3-factor); 5-factor adds tax and interest burden.
- The modern use: an **explanation engine**. When "rezultat" moves, walk the tree (revenue drivers → variable costs → fixed costs; or margin → turnover → leverage) and report the single largest contributing branch first, in plain language.

### Rolling forecast

- **Forecast = actuals YTD + qualified estimate for the remainder, always including countermeasures. The plan stays frozen** as the commitment; the forecast carries current truth. Report plan-vs-actual and plan-vs-forecast side by side.
- Cadence: quarterly minimum, monthly for volatile businesses; horizon 12 months rolling. Forecast at **driver level**, not full chart-of-accounts granularity.
- Never tie forecasts to targets/bonuses (sandbagging corrupts them). Measure forecast accuracy afterwards.

### Working capital controlling

- **CCC = DIO + DSO − DPO**. Negative CCC = suppliers finance the operation. Interpretation is industry-relative and trend-first.
- Fixed lever lists: DSO ↓ (invoice immediately, dunning discipline, early-pay discounts, stop-shipment for chronic late payers); DIO ↓ (drop dead stock, purchasing cadence); DPO ↑ (pay per contract terms, never earlier, without burning suppliers).
- Owner translation: "banii tai stau N zile blocati in facturi neincasate."

### Cost behavior classification (added 2026-07-08, practitioner discussion)

Standard cost-accounting foundation, and the basis of the German flexible-marginal-costing tradition (Grenzplankostenrechnung) referenced by the IGC model. Four behaviors, not three:

- **Fixed** — independent of volume: rent (612), depreciation (6811), back-office salaries, subscriptions.
- **Variable** — proportional to volume: marfa (607), materii prime (601/602), commissions, piece-rate labor.
- **Step-fixed ("sprungfix")** — fixed within a capacity band, jumps at thresholds: one manager per ~10 people (the 11th hire triggers a second manager), one machine per N units. The classic hidden trap in hiring scenarios.
- **Semi-variable (mixed)** — fixed base + variable component: utilities (605), sales salary + commission.

What it unlocks: **contribution margin** (revenue − variable costs, per business line — we already have the axes), **break-even** ("de la ce venit lunar firma e pe plus" = fixed costs / contribution margin %), **operating leverage** ("if revenue drops 20%, result drops X%" — high-fixed-cost firms are fragile in downturns), and honest **hiring scenarios** (a new hire = new fixed cost vs incremental contribution margin, plus the step warning).

Depreciation's dual role: it is a **fixed cost** in break-even AND a **non-cash add-back** in the cash-vs-profit bridge and distributable earnings. Both roles must be encoded or the two most important owner answers come out wrong.

Costi application (theory is in the base model; the value is per-client application):
- Default cost-behavior per cont from the account catalog (607 variable, 612/6811 fixed, 605 semi-variable...), overridable per client — a lightweight classification axis, NOT a new mapping UI by default.
- **Personnel (641) is undecidable from the journal**: the same cont is 100% fixed at a consultancy and mostly variable with piece-rate factory operators or zilieri. This is a flagship Stage 5 interview question ("salariile din productie sunt legate de volum sau fixe?") whose answer unlocks break-even — the exact insight-driven-acquisition pattern from ADR-0005 D4/D5.

### Asset utilization / investment controlling (added 2026-07-08, practitioner discussion)

IGC process #3 (Investment Controlling) applied to SMEs. Two standard concepts:

- **Nutzkosten vs Leerkosten** (used vs idle capacity cost): a server bought as CapEx at 10% utilization means ~90% of its depreciation + running costs is idle-capacity cost. Quantify it in lei/year, don't moralize.
- **Investitionsnachrechnung** (post-investment audit): 6-12 months after a CapEx purchase, check whether the investment's premises held. Almost never done at SRL level — high-value, low-effort advisory.

Costi application:
- The journal sees half the story: the asset (class 2), depreciation (6811), purchase timing. It can detect **candidates**: depreciation heavy relative to revenue, imobilizari growing without revenue growth, declining asset turnover (the DuPont asset-turnover branch).
- **Utilization is invisible in the journal** — operational knowledge only the human has. Data-anchored interview question: "Vad echipamente de 120.000 lei cu amortizare 24.000 lei/an. Cat din capacitatea lor folositi efectiv?" → typed fact → unlocks the idle-cost insight.
- Fixed measure list for the playbook: sell and right-size, rent out spare capacity, sale-and-leaseback, replace owned with rented/cloud (converts fixed cost into variable cost — ties directly into cost-behavior analysis).

### Team structure as organic context (added 2026-07-08, practitioner discussion)

The pattern behind both discussions above generalizes: **the journal records money, not structure**. Cont 641 is one opaque number; the business reality behind it (who does what) is the highest-leverage fact category for ADR-0005 Stage 4 memory, because it correlates with nearly every insight:

- **Cost behavior of 641** (fixed / step / variable split) → break-even, operating leverage, downturn fragility.
- **Per-line assignment** ("operatorii lucreaza doar pe Outsourcing") → the business-line split of salaries. Real observed gap: on QHM21, 641 (1.63M lei, the firm's biggest expense) resolves to the default vertical because the split is team knowledge, not journal knowledge — the per-line rezultat is distorted until someone answers one question.
- **Management ratios** ("un manager la ~10 oameni") → the step-cost warning in hiring scenarios.
- **Productive vs overhead headcount** → revenue per productive employee (sharper than plain revenue/employee).
- **Seasonal/day labor** → payroll cash-spike planning, seasonality interpretation.

Today Costify holds only `EmployeeCount` (monthly average, manually entered). Team-structure facts belong in the Stage 4 `ClientBusinessFact` registry under `echipa`, with candidate keys: `team.productive_count`, `team.overhead_count`, `team.line_assignment.<vertical>`, `team.pay_volume_linked` (bool/percent), `team.management_ratio`, `team.seasonal_pattern`. Each key exists because a named insight is blocked without it (D4 discipline); the interview questions are data-anchored ("Salariile sunt 1,6M lei si merg toate pe Toata firma. Cati oameni lucreaza pe fiecare linie?").

---

## 3. The Romanian context (numbers Costi can cite)

### Payment behavior (Atradius CEE Barometer 2024, via cursdeguvernare.ro)

- **47% of B2B sales in Romania are on credit; 49% of B2B sales are paid late.** Average payment terms ~**60 days** — among the most lenient in CEE.
- Bad debts: **5% of B2B credit sales** (construction and pharma worst; metallurgy least).
- Contagion: **30% of firms delay paying suppliers because they were paid late** ("blocaj financiar").
- **DSO calibration for Costi: <= 60 days normal, 60-90 watch, > 90 alarm**, sector-adjusted. Textbook "30 days" thresholds are wrong for Romania.

### Insolvency and failure (Sierra Quadrant 2024, CITR Q1 2026)

- 2024: record **155,207 firms in difficulty**; 46,205 dissolutions (+18%, highest since 2008); 7,274 insolvencies.
- Named causes, in order: sales volume drop, **blocaj financiar**, tax/minimum-wage increases + restricted credit, wrong growth bets (over-borrowing), **>25% of closing firms are "zombies" with negative equity**.
- Q1 2026: 1,829 insolvencies (+14,3% y/y); **big companies now failing too** (19 with assets > EUR 4M vs 2 a year earlier) — a large partner is no longer a safe partner.
- Sector risk per 10,000 firms: **construction most vulnerable; IT most stable (4,3/10,000)**; HoReCa runs 3-5% real margins.
- CITR's core message: **early restructuring beats late heroics** — sustained negative operating cash + stretching payables + eroding equity means "discuta acum despre restructurare", not another month of watching.

### Indicators creditors look at (MF's own Nota 9 set)

- **Lichiditate curenta** = active curente / datorii curente, **official recommended value ~2**.
- Lichiditate imediata (acid test), grad de indatorare, **acoperirea dobanzilor** (EBIT / dobanzi), DSO (sold mediu clienti / CA × 365), DPO, rotatie stocuri, ROCE, marja bruta.
- **Negative/thin equity is the strongest structural red flag**: activ net < 1/2 capital social is a legal problem (dividends blocked per Legea 239/2025) and the zombie-firm marker. Compute activ net every period.
- Specific internal bank cutoffs are NOT published — present the MF anchors as "ce se uita creditorii", never invent bank thresholds.

### Dividend planning 2026 (contzilla.ro)

- **Dividend tax 16%** from 1 Jan 2026 (was 10%). Withheld by the company, paid by the 25th of the following month.
- **CASS 10% on the 6/12/24 minimum-salary plafoane** (min. salary 4.050 lei on 1 Jan 2026): bands at **24.300 / 48.600 / 97.200 lei** → CASS 2.430 / 4.860 / 9.720 lei. Step function: 1 leu over a plafon can cost thousands. CASS on 2026 dividends is paid in **2027** via declaratia unica — a cash-planning item owners always forget.
- Quarterly interim dividends (Legea 163/2018) with **year-end regularization risk**: a bad Q4 can force owners to *return* dividends. Stress-test interim distributions against YTD volatility.
- **Legea 239/2025 blocks**: pierdere reportata must be covered first; activ net < 1/2 capital social blocks all distributions.

### Micro vs profit 2026 (contzilla.ro)

- **Plafon EUR 100.000** (halving trajectory 500k→250k→100k), **including linked enterprises** (>25% ownership aggregation). Single rate **1%** from 2026. Above plafon → 16% profit tax.
- Break-even intuition: crossing means 1% of revenue → 16% of profit, so the decision hinges on net margin (**~6,25% margin is the pivot**).
- OUG 8/2026: 90 days (was 30) for the first employee at new firms; plafon now measured on **cifra de afaceri contabila**; re-entry to micro possible. ANAF communication by 31 March.
- Monitoring is a **monthly job**: project cumulated revenue, warn at ~80% of plafon, estimate the tax delta with the client's actual margin, check the 1-employee condition and linked-enterprise structure before any optimization advice.
- Adjacent 2026 thresholds: TVA registration 395.000 lei; TVA la incasare 5.000.000 lei.

### e-Factura / SAF-T (2026 state)

- SAF-T D406 covers **all** taxpayer sizes since Jan 2025 (small firms' first "SAF-T active" due 2 June 2026). e-Factura near-universal; CNP-supplier carve-out ended 1 June 2026.
- Rationale: Romania's **VAT gap was 30% in 2023, the EU's worst**.
- The pitch this enables: **"ANAF already sees everything about your firm in real time — you should too."**

### Financial literacy / market structure (RBL/Guda 2026)

- ~700.000 active firms, **~75% have at most 2 employees** — subsistence entrepreneurship. The average firm plateaus at ~2,6M RON turnover after 10 years, mostly inflation.
- Chronic subcapitalization; value added per employee EUR 16.500 vs EUR 40.000 EU average.
- Formal financial education is only now entering schools — **the current generation of owners was never trained**. Assume zero financial vocabulary; the accountant is structurally the only advisor these firms will ever have (nobody with 2 employees hires a CFO).
- Uncertain (do not state as fact): the "~21% financial literacy rate" figure; Intrum EPR day counts; specific bank cutoffs; Coface RO study numbers.

---

## 4. Synthesis: what Costi encodes from this

### Identity (Stage 2 system prompt)

1. Costi's posture = the IGC controller mission: trusted partner, co-owner of the management process, guardian of financial integrity. Never a report generator.
2. A response about performance is **incomplete without a suggested measure** (IGC: reporting ends when countermeasures are approved).
3. Diagnose before advising, like a CFO's month 1: understand the data range, mapping coverage, seasonality, and the firm's story before recommending anything. An assistant that gives advice before diagnosing loses trust like the CFO who "fixes" the chart of accounts on day three.
4. Always pair a negative signal with an option to act, and oversight with a forward look.

### Response contract (Stage 2)

5. **Verdict first (Minto/BLUF)**, then evidence, then action. The message must survive a reader who stops after one sentence.
6. Every commentary = **What / So What / Now What**: number → cause (named, not restated) → recommendation with amount, deadline, owner, and consequence of inaction (NOW / MED / FYI ranking).
7. **Owner ordering**: cash → who owes me → what do I owe → did I make money. **Accountant ordering**: revenue → margin → opex → result. Same data, two walk orders.
8. Fixed scenario vocabulary AC/PY/PL/FC (Realizat / An precedent / Buget / Forecast); comparisons always three ways: vs plan (when it exists), vs prior year, vs 3-6 month trend.

### Playbook thresholds (Stage 2 playbooks JSON)

9. **Exception rule**: comment a variance only if > 5-10% AND above an absolute floor scaled to the client; otherwise one line: "in linie cu asteptarile". Escalate variances that change regime on the trend.
10. **Romanian DSO bands**: <=60 normal / 60-90 watch / >90 alarm (sector-adjusted: construction+pharma lenient, IT strict). AR items: 60 days = "suna azi", 90 days = provision risk.
11. **Cash alarms**: projected week below minimum reserve; runway < 6 months urgent, < 9 warning.
12. **Concentration**: one partner > 30-40% of revenue or receivables = named risk with quantified default impact (2026 lesson: large partners fail too).
13. **Structural red flags**: activ net vs 1/2 capital social (legal dividend block + zombie marker); lichiditate curenta vs ~2 (MF anchor); interest coverage < 1.
14. **Micro plafon watch**: monthly projection, warn at 80% of EUR 100k (linked entities included), pivot analysis at ~6,25% net margin.
15. **Dividend check order**: pierdere reportata → activ net → CASS band position (24.300/48.600/97.200 for 2026) → regularization risk for interim → "CASS se plateste anul viitor" reminder.
16. **Blocaj financiar contagion check**: when receivables age, immediately inspect the client's own payables stretching; warn about the chain before penalties.
17. **Early-restructuring trigger**: sustained negative operating cash + stretching payables + eroding equity → recommend the restructuring conversation now.

### The canned cash-vs-profit bridge (highest-frequency owner question)

18. "Am profit, unde sunt banii?" gets a **computed bridge** from this firm's journal: rezultat → Δ creante (4111) → Δ stocuri → rate de credit platite (principal) → dividende ridicate → active cumparate → taxe datorate. Never a generic lecture.
19. Track **distributable earnings** as a first-class owner concept (profit + amortizare − rate credit − rezerva = ce poti scoate) vs what was actually taken.

### Later stages (brief, forecast, KPIs)

20. The monthly brief (Stage 7-8) is the CEO Flash Report: verdict addressed by name → KPI tiles → business verdicts checklist → NOW/MED/FYI actions → owner-world translations. Delivered 10-15 days after month-end, follows up on last month's actions.
21. The 13-week direct-method cash view is the long-term owner deliverable (post-roadmap candidate; requires payment-date data from e-Factura/bank, not just the journal).
22. Rolling forecast principle when we add projections: plan frozen, forecast separate, driver-level granularity, never tied to targets.
23. KPI surfaces stay at 5-8 metrics; IBCS semantics for any new chart (solid=actual, outline=plan, hatched=forecast, green/red only for signed variances).
24. Position "data management" (coverage, unmapped, mapping hygiene) explicitly as part of the controlling value Costi delivers — it already exists in the product; the IGC model legitimizes it as a first-class process.

### From practitioner discussions (2026-07-08)

25. **Cost-behavior axis** (fix / trepte / semi-variabil / variabil): catalog defaults per cont + per-client override; 641 decided by interview, never assumed. Unlocks break-even, contribution margin, operating leverage, honest hiring scenarios with the step warning. Amortizarea encoded with BOTH roles (fixed cost in break-even, non-cash add-back in the cash bridge).
26. **Idle-capacity playbook**: detect candidates from the journal (heavy 6811 vs revenue, imobilizari up without revenue, falling asset turnover), ask the utilization question, quantify Leerkosten in lei/year, offer the fixed measure list (sell/right-size, rent out, sale-and-leaseback, owned → rented/cloud). Post-investment audit 6-12 months after any big CapEx.
27. **Team structure = flagship memory category** (`echipa`): productive/overhead counts, per-line assignment, pay-volume linkage, management ratio, seasonality. Each key tied to a named insight it unlocks; questions anchored in the client's own numbers (the QHM21 641-on-default example).

---

## Sources

**Track 1 — CFO practice**: blackpeakcfo.com (first-90-days, CEO flash report sample), umbrex.com (fractional CFO playbook), atlar.com + wallstreetprep.com (13-week cash flow), eaglerockcfo.com (monthly review agenda), preferredcfo.com (monthly checklist), durity.com + pwawco.com (cash vs profit), untools.co (Minto), liberatingstructures.com (W³).

**Track 2 — Controlling**: igc-controlling.org (Controlling Process Model 2.0 full PDF; Controller Mission Statement V4 2024), ibcs.com (SUCCESS 1.2, 2.0/ISO 24896), zebrabi.com (IBCS notation), Wikipedia (IBCS, DuPont), corporatefinanceinstitute.com (rolling forecast, CCC, variance analysis), accountingtools.com (variance analysis, exception reports), jedox.com (rolling forecast), icv-controlling.com (knowledge base).

**Track 3 — Romania**: cursdeguvernare.ro (Atradius CEE Barometer 2024 coverage; CITR Q1 2026 insolvency analysis; Sierra Quadrant 2024/2025 barometer; RBL/Guda SME scaling study Apr 2026), contzilla.ro (dividende + CASS 2026; Legea 239/2025 restrictions; plafoane CASS 2026-2027; micro 2026 + OUG 8/2026; Nota explicativa 9 indicators; scadente 2026; SAF-T small firms), coface.ro (orientation only).
