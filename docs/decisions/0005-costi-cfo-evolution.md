# ADR-0005 — Costi CFO evolution: full context, business memory, owner guidance

**Status**: Proposed
**Date**: 2026-07-06
**Authors**: coriiu
**Builds on**: ADR-0003 (modul antreprenor + Mapari Cashflow), ADR-0004 (period-scoped mappings), the Costi lock-step rules (AGENTS.md), the bilingual product rules (AGENTS.md)

## Summary

Costi today is a contabil's assistant: precise, backward-looking, reporting what happened. This ADR evolves him into the thing the market does not have: **a CFO who knows the firm** — its data, its story, its goals — and who can guide both audiences in their own language:

- **Contabilul** gets diagnostic depth: trends, concentration, margins per business line, scenario reasoning, with OMFP vocabulary intact.
- **Patronul** gets guidance with zero jargon. Owners do not understand KPIs and never will; worse, they do not know what to ask. Costi must **bring the agenda** ("3 lucruri luna asta"), translate every number into money, time, or a decision, and anchor advice to the owner's own goals.

Three capability families, built in stages:

1. **Full data context** — tools so Costi can query everything the UI shows (partners, mappings, trends). If the contabil can click it, Costi can answer it.
2. **Business memory** — a persistent, typed, audited profile per client: facts, story fragments, and a synthesized identity ("fingerprint"), gathered from conversation and confirmed by humans.
3. **CFO reasoning + owner voice** — playbooks, a response contract per audience, insight recipes with explicit data requirements, and an evaluation harness that enforces quality (including a jargon guard for owner-facing output) in CI.

## Principles

1. **Context engineering over training.** No fine-tuning, no "CFO manual" corpus dumps. The base model knows generic finance theory; what it lacks is *this firm's* data, story, and the discipline of a good answer. Tools + memory + playbooks + eval, all inspectable and fixable.
2. **Never ask what we can compute.** Recurring costs, seasonality, DSO, concentration, trends are derivable from the journal. Every derivable question deleted from an interview is trust earned. Questions are reserved for what only humans know: contracts, intentions, constraints, preferences, the story.
3. **Insights drive data gathering, not the other way around.** Every question Costi asks exists because a specific insight is blocked or degraded without it, and the user is told exactly what answering unlocks.
4. **One brain, two voices.** Same tools, same journal, same truth. The contabil hears OMFP; the patron hears money, weeks, and worry-levels. The rendering contract is enforced by CI (jargon guard), not by reviewer hope. Both phrasings are mandatory before any surface ships (AGENTS.md bilingual rule).
5. **Numbers from tools only.** Costi never states a figure without a tool call behind it. Missing data produces "nu stiu, imi lipseste X" plus the question that would fix it — never a guess.
6. **Memory is visible, typed, and consented.** Facts are saved in the open (chip + undo), provenance-tracked, supersede-not-update (append-only reflex), tenant-isolated, GDPR-erasable. Narrative is confirmed by a human before it becomes an interpretive lens.
7. **Lock-step applies to ourselves.** Every stage updates tools, handlers, `costify-app.json`, and tests in the same PR (AGENTS.md Costi rules).

## The Costi stack

```
7. EVALUATION      golden question set in CI + in-product feedback loop
6. DELIVERY        chat, monthly brief, unlock cards, forwardable outputs
5. ACQUISITION     gap-driven questions, interview mode, the "why" reflex
4. MEMORY          typed facts + story fragments + fingerprint (identity)
3. REASONING       CFO playbooks, response contract per audience, exemplars
2. DATA ACCESS     tools: everything the UI knows, Costi can query
1. IDENTITY        system prompt: who Costi is, modes, what he never does
```

## Key designs

### D1 — Data access completeness (layer 2)

Current 13 tools cover KPIs (financial + industry), balance, CPP (incl. business-line columns), journal, regimes, catalogs, mapping timeline, business lines. Gaps that block CFO reasoning:

- **`get_partner_analysis(client, year, month, cont?)`** — partners per cont or firm-wide: rulaj, share %, category exceptions, LOB pins, concentration (top1/top3/top5). Unlocks the single most CFO-relevant fact class (e.g. QHM21: ~89% of revenue from one partner) that Costi is blind to today. *(Implementation in flight: `loadPartnerTotalsForClient` exists.)*
- **`get_mappings_overview(client, year?, month?)`** — the full mapping picture in one call: lines of cost with their conts, splits and sources, coverage, unmapped, partner exception counts. Turns "ce conturi am pe Marfa?" from unanswerable into one call.
- **`get_trends(client, metric, months)`** — ready-made monthly series (venituri, cheltuieli, rezultat, cash, per business line, per linie de cost). Nearly every CFO question is a trend question; today it would take 6+ tool calls to reconstruct six months. Highest-ROI missing tool.
- Later: a scenario helper ("daca pierzi partenerul X...", "daca angajezi 2 oameni...").

### D2 — Business memory: typed facts (layer 4)

One fact = one row, natural Romanian sentence, typed and provenance-tracked. Never a notes blob (cannot dedupe, supersede, audit, or selectively inject).

```prisma
model ClientBusinessFact {
  id             String    @id @default(cuid())
  clientId       String    // tenant isolation, indexed
  category       String    // 'model_afacere' | 'clienti' | 'furnizori' | 'echipa'
                           // | 'operatiuni' | 'finantare' | 'planuri' | 'riscuri'
                           // | 'preferinte' | 'evenimente' | 'poveste'
  key            String?   // registry slug for upsertable/computable facts:
                           // 'contract_end.roche', 'dividend_target_yearly'
  content        String    // "Contractul cu Roche expira in iunie 2027."
  valueType      String?   // 'number' | 'date' | 'percent' | 'enum' | 'money'
  valueJson      Json?     // { "date": "2027-06" } — machine-usable form
  source         String    // 'costi' | 'contabil' | 'patron' | 'derivat'
  sourceRef      String?   // conversationId — where Costi learned it
  confidence     String    // 'declarat' | 'dedus'
  status         String    // 'activ' | 'arhivat' | 'inlocuit'
  supersededById String?
  relevantUntil  DateTime? // events expire; standing facts do not
  createdById    String
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([clientId, status, category])
  @@unique([clientId, key])
}
```

- **Dual representation**: `content` (for humans and the prompt) + `valueJson` (for projections/recipes). A **key registry** (versioned JSON, like the F20 structure file) defines each key's type, validation, and consuming insights.
- **Memory tools**: `remember_client_fact`, `update_client_fact`, `archive_client_fact`, `get_client_profile`. Costi saves live during conversation; the chat shows a "Costi a retinut: ..." chip with inline undo. No review queue (friction), but fully visible and reversible.
- **Prompt injection**: `buildClientProfileContext(clientId)` compiles active facts into a ~1.500-token block, standing facts by category then unexpired events; oldest `dedus` facts drop first.
- **Quality rules** (system prompt): save only what the journal cannot tell; one sentence per fact; never save numbers that go stale; mark `declarat` vs `dedus` honestly; when unsure, ask.
- Every mutation writes an `audit_event`. Archives satisfy erasure via the standard purge policy.

### D3 — The fingerprint: company identity (layer 4)

Facts feed computation; **the story feeds interpretation**. "89% de la Roche" means opposite things for a 10-year spin-off relationship vs. a contract renegotiated yearly — no KPI distinguishes them.

- Story fragments are facts with `category: 'poveste'`, captured through a **one-"de ce?"-per-conversation reflex** (curiosity, not interrogation).
- When 5+ new fragments accumulate, Costi drafts a new **`ClientIdentity`** version: half a page of narrative ("cine sunt"), shown as a diff, **confirmed by the contabil** before it becomes active. Versioned, never overwritten.
- Injected as *"portretul firmei asa cum l-am inteles, confirmat la <data>"* — a lens, never ground truth over the journal. Data-vs-story contradictions produce questions, not assumptions.
- Staleness: unconfirmed 12 months → re-verify.
- The most sensitive text we hold: never surfaces in owner-facing output; "uita asta" archives immediately.

### D4 — Insight recipes + completeness engine (layer 5)

```json
{
  "id": "cash_projection_6m",
  "name_contabil": "Proiectie cash 6 luni",
  "name_patron": "Cati bani vei avea in banca",
  "inputs": {
    "journal":  ["cash_position", "salary_runrate", "recurring_costs"],
    "derived":  ["dso_per_partner", "seasonality", "recurring_revenue"],
    "context":  ["contract_end.*", "pipeline_next_6m", "planned_hires"]
  },
  "degradesTo": "3-month projection with wider bands when context is missing"
}
```

- Per client, per insight: **ready / degraded / blocked**, plus which missing keys unblock the most insights. That ranking is the interview agenda and the UI's honest pitch: "Raspunde la 3 intrebari si deblochezi proiectia de cash pe 6 luni."
- **Graceful degradation, never silence**: missing context shortens the horizon and widens the bands, and Costi says why — every degraded insight is its own acquisition prompt at the exact moment the user cares.
- **Goals become standing targets**: "dividend_target_yearly = 10k EUR" is monitored monthly against profit and fiscal rules; insights become personal ("cu marja asta, tinta de dividende e in pericol din T4").
- **Feedback loop**: one-tap "util / gresit / stiam deja" per insight; a "gresit" with a reason is usually new context → becomes a fact → the insight recalculates.

### D5 — Interview mode (layer 5)

- **Data-aware, not a questionnaire**: questions anchored in the client's real numbers ("Vad ca ~89% din venituri vin de la Roche. Contract pe termen lung sau proiecte punctuale?").
- Question catalog in `training/cfo/structured/interview-questions.json`: ~25 entries with `category`, `fillsKeys`, optional `dataSignal` trigger, **both** `question_contabil` and `question_patron` phrasings, `whyItMatters`, `followUps`.
- Session state in `ProfileInterviewSession { clientId, audience, askedKeys[], skippedKeys[], status }`. **Coverage is computed from facts** (`fillsKeys` present = answered), never stored — no sync bugs by construction.
- Flow rules: one question at a time; max 5-7 per sitting; every answer saved immediately (chip + undo); "sari peste" is legitimate and re-askable in 3 months; data-signal questions first, then gaps in clienti/planuri/riscuri; preferences last. Outside interview mode: max one opportunistic question per conversation, opt-out via a `preferinte` fact.
- Entry points: post-first-import offer; profile UI ("Completeaza profilul cu Costi" + completeness bar); chat.
- **Audience: contabil-first.** Patron interview arrives with owner-facing Costi (Stage 8).

### D6 — CFO reasoning + response contract (layer 3)

- `training/cfo/structured/cfo-playbooks.json` (always loaded): ~15 compact playbooks — trigger question → tools to call → what to compute → how to phrase the recommendation. Romanian-SME-specific (micro vs profit, dividend timing, e-Factura reality), reusing the existing fiscal knowledge files.
- **Response contract, per audience**:
  - Contabil: verdict → the 2-3 numbers that prove it → recomandare → risc → oferta de drill-down.
  - Patron: verdict → *ce inseamna pentru tine* → *ce poti face* → oferta de detaliu. Percentages become "din fiecare 100 lei"; time-metrics become weeks; thresholds become worry-levels.
- Mode switch: decision questions ("pot / de ce / ce-ar fi daca") get CFO posture; lookup questions ("cat e / unde e") stay contabil. Audience follows the surface (accountant chat vs. /firma).
- 5-6 worked exemplars of *great* answers embedded in the prompt.

### D7 — Owner voice, enforced (layers 3+7)

Owners do not understand KPIs and do not know what to ask. Two consequences:

1. **Costi brings the agenda**: proactive "3 lucruri luna asta" leading with verdicts, not a Q&A surface waiting for questions that will never come.
2. **The jargon guard**: owner-mode outputs FAIL CI if they contain banned tokens — numeric account codes (`\b[1-7]\d{2}\b`), OMFP vocabulary (rulaj, balanta, debit/credit, analitic), KPI acronyms (DSO, EBITDA, marja bruta), or naked percentages with no money/time translation adjacent. Runtime post-check on owner surfaces rewrites violations before display.

Reference translations:

| Internal | Owner hears |
|---|---|
| DSO 52 zile | "Clientii te platesc in ~7 saptamani. Banii tai stau la ei aproape 2 luni." |
| Marja neta 8% | "Din fiecare 100 lei incasati, iti raman 8. Anul trecut ramaneau 14." |
| Concentrare 89% | "Aproape toti banii vin de la un singur client. E cel mai mare risc al firmei tale." |
| Runway 4,2 luni | "Daca maine n-ar mai intra nimic, firma traieste 4 luni din ce are." |

Acceptance test (from AGENTS.md, now operational): a person who has never read a balance sheet reads the answer and knows (a) if things are fine, (b) what to do next. "Ce inseamna asta?" in feedback is tracked as a hard quality metric.

### D8 — Evaluation harness (layer 7)

Without it, everything else is vibes. ~40 real questions against seeded qhm21 fixture data, from "cat cash am?" to "pot sa cresc salariile cu 10%?" to adversarial ones ("de ce am pierdut bani in 2024?" when the firm was profitable). Each case asserts: correct numbers cited (tool-verified), recommendation present, no invented figures, correct audience language (jargon guard), honest "nu stiu" when data is missing. Runs on every PR touching Costi — prompts and playbooks become safely iterable.

## Stages

Ordering rationale: data tools first (cheap, immediately visible), then reasoning + eval (lock in quality before adding complexity), then memory/acquisition/identity (the moat), then the owner surface (broadest blast radius, needs everything before it).

### Stage 0 — Data context completion *(in flight)*

- `get_partner_analysis` + `get_mappings_overview` tools, handlers, docs, tests.
- **Acceptance**: Costi answers "ce concentrare am pe clienti?", "ce parteneri am pinuiti pe 704?", "ce conturi sunt pe linia Marfa?" correctly on qhm21.

### Stage 1 — Trends tool

- `get_trends` returning monthly series for core metrics, per firm and per business line / linie de cost. Server-side single pass; no N×`get_cpp` chains.
- **Acceptance**: "de ce scade marja de 3 luni?" answered with one trends call + one drill-down call.

### Stage 2 — CFO identity, response contract, playbooks

- System-prompt CFO mode + audience contracts (D6), `cfo-playbooks.json`, worked exemplars.
- **Acceptance**: decision questions produce verdict-first answers with recommendation and risk; lookup questions unchanged.

### Stage 3 — Golden set v1 (gate for everything after)

- Eval harness (D8) incl. the jargon guard for owner-voice cases; wired into CI.
- **Acceptance**: 40 cases green; a deliberately-broken prompt fails the suite.

### Stage 4 — Memory: facts + tools + injection

- `ClientBusinessFact` schema + migrations, 4 memory tools, profile prompt injection, "Costi a retinut" chip with undo, profile UI section (list, source badges, edit/archive), audit events, tenant-boundary e2e tests.
- **Acceptance**: fact saved in one conversation is used in the next; cross-tenant leakage tests pass; golden set gains memory cases.

### Stage 5 — Acquisition: recipes, completeness, interview

- Key registry + insight recipes JSON, completeness engine (ready/degraded/blocked + unlock ranking), interview catalog + session state + flow rules, unlock cards in UI.
- **Acceptance**: on a fresh client, Costi's first three questions are data-anchored and answering them flips a named insight from blocked to ready.

### Stage 6 — Fingerprint

- `poveste` fragments + one-why-per-chat reflex, `ClientIdentity` versions with confirm-diff UI, staleness re-verification, contradiction-asks.
- **Acceptance**: after a seeded conversation set, the drafted fingerprint is coherent, requires confirmation, and post-confirmation answers visibly use it (golden cases).

### Stage 7 — Monthly brief (contabil edition)

- The flagship artifact: concentration + runway + trend + one recommendation, generated from recipes + memory, degraded-with-reason where inputs are missing. Feedback taps (util/gresit/stiam deja) feeding facts.
- **Acceptance**: brief generates for every active client with journal data; every claim traces to a tool call; degraded sections name their missing keys.

### Stage 8 — Owner-facing Costi + brief (patron edition)

- Costi on /firma: read-only tools, published data only, owner response contract, runtime jargon guard, proactive "3 lucruri luna asta", forwardable patron brief. Patron interview variant. Fingerprint-sensitive content excluded by construction.
- **Acceptance**: the non-accountant test passes on real owner questions; jargon guard shows zero violations in a week of staging output; the brief is something an owner would forward.

## Non-goals

- **No fine-tuning / custom model training** at any stage (Principle 1).
- **No KPI dashboard for owners.** The owner surface is guidance, not charts with simpler labels.
- **No autonomous actions.** Costi reads, remembers (visibly), asks, and recommends; he mutates nothing financial.
- **No cross-client learning.** A firm's facts, story, and identity never inform another tenant's answers.

## Risks

| Risk | Mitigation |
|---|---|
| Fact pollution (Costi saves trivia) | Prompt discipline (D2 rules), visible chips + undo, golden cases with adversarially chatty transcripts |
| Wrong narrative poisoning interpretation | Human-confirmed fingerprint versions, staleness re-verification, data-contradiction asks, lens-not-truth framing |
| Interview fatigue | Never-ask-the-derivable, 5-7 cap, unlock-value shown, skip is legitimate, one opportunistic question max |
| Owner-mode jargon leaks | CI jargon guard + runtime post-check, "ce inseamna asta?" tracked as a metric |
| Hallucinated numbers | Numbers-from-tools-only contract, golden set asserts tool-traceability |
| Prompt bloat / cost | ~1.5k-token profile cap, keyword-triggered deep knowledge (existing pattern), eval tracks token budgets |
| Sensitive story data | Tenant isolation tests, owner-surface exclusion, instant archive on request, standard purge policy |
