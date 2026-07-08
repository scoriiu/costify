# Application 2: PRI Tool — Business Case & Delivery Roadmap

> REDSPARQ · APPLICATION 2
> AI-assisted quality review of Rexis and SFDC cases · Business Case & Delivery Roadmap · H2 Project Funding Request

| Field | Detail |
|---|---|
| Scope | AI-assisted quality review of Rexis and SFDC cases, up to 100% coverage, with people making every decision |
| Prepared by | Redsparq |
| Prepared for | Roche |
| Version / date | v1.0, 6 July 2026 |
| Status | For review with sponsor; submission target: before 31 July 2026 |
| Classification | Confidential. Roche and Redsparq internal use. |

---

## 1. Executive Summary

Today only a fraction of Rexis and SFDC cases gets a second quality check. Cases are picked by keyword lists, not by risk. The result is uncomfortable: Inquiries, the queue where wrongly labelled complaints are most likely to hide, gets the least attention. Missed complaints, missed PRIs and missing case details surface late or not at all. That means regulatory exposure, audit risk and rework. The exact coverage numbers, per queue, will be measured from your data as the first deliverable of Stage 0.

We propose an AI layer that reads all Inquiries and Complaints in Rexis and SFDC, up to 100% of both queues. It flags suspected wrongly labelled complaints, missed PRIs and missing details, and sends each flag with its reasoning to the PRI specialists. The idea is not new to us: since taking over the operation, our team has been checking Inquiries by hand for hidden complaints. The tool scales that proven practice to every case. **One rule is fixed: the AI searches and prepares, a person always decides. No record is ever changed automatically.**

**The simple logic behind it.** Covering both queues fully with people alone would mean multiplying today's review team many times over. That is neither affordable nor realistic to hire in the medical device safety job market, whatever the exact number turns out to be. Stage 0 calculates it precisely from real volumes and measured workloads; the conclusion does not depend on the decimals. The real alternative to this program is not a bigger team. It is a permanent blind spot on most cases.

The commercial model follows what was already agreed with management: we build in stages, each stage is paid only against agreed proof that it works, and at the end the application licence transfers to Roche at no extra cost. Roche owns the asset. Redsparq runs and maintains it for a monthly fee.

**Investment.** €2.45–2.85M for development, spread over roughly 18–20 months in four stages, plus €45–55K per month for operations after go-live. Estimated five-year total cost of ownership (TCO): €4.3–5.2M, with no ongoing licence fees.

> Full review of both queues at a fraction of today's cost per case; the certified numbers are the first deliverable of Stage 0. Measured against management's own €25M savings estimate, the program pays back in about 2.4 months at full value, and in under 12 months even if only 20% of that value is real.

Application 1 (velocity) is covered in a separate document. Together, the two applications close one quality loop: prevent errors at intake, catch the rest in review, both drawing on the same product knowledge.

**Decision requested:** approve the H2 funding envelope for Stages 1–3, and authorise Stage 0 (€75K, 6–8 weeks) now under the existing MSA, so that firm, validated numbers are ready the moment the funding is released.

---

## 2. Problem & Opportunity

Manual quality control has a built-in ceiling. A sample covers only part of the volume, findings arrive weeks after the case was handled, and more coverage always means more people. The consequences are lopsided: one missed reportable complaint found during an audit usually means a finding, a remediation program and closer regulatory scrutiny, at a cost far above the cost of prevention.

Today's selection is not even a manual sample. Cases reach the PRI team through keyword lists, and Salesforce allocates the queue. Keyword matching is blind to anything it cannot literally match: new phrasings, typos, other languages, complaints described without the trigger words, and cases labelled wrongly at intake. Modern language models upgrade exactly this selection layer, from matching words to understanding meaning, while the way of working stays the same: the tool feeds the same Salesforce queue the team already uses. The queue simply gets smarter. The approach is proven in neighbouring regulated safety fields: AI-assisted case processing in pharmacovigilance typically cuts intake and triage times by 40–60%, with people staying in control, and regulators themselves now use AI to summarise adverse event information. A well-governed AI layer reads every case, checks it against the agreed rules, and explains every flag. Specialists stop searching for errors and spend their time deciding on them.

---

## 3. Proposed Solution

**Scope.** All Inquiry and Complaint records in Rexis and SFDC: one analysis layer over both queues, because wrongly labelled complaints sit mostly in the Inquiry queue. Case types, languages and affiliates are prioritised in Stage 0 with the PRI team. APAC volumes are scoped as an extension.

**Core functions.** Detect suspected missed complaints, including complaints hiding in the Inquiry queue. Detect suspected missed PRIs. Detect missing or inconsistent case details. Send every flag, with its reasoning and source reference, into the existing Salesforce queue. Show where labelling errors come from (by case type, product and team) and turn that into concrete retraining and intake improvement suggestions. Dashboards, workload management, and a full audit trail of model versions, prompts and decisions.

**Design principles.** A strength multiplier for every PRI specialist: the AI screens everything and prepares each flagged case, a person always takes the decision. The system runs inside Roche's Google Cloud environment, using the platform's approved AI services (for example Vertex AI), so case data never leaves the Roche environment. Anything outside the Google-compatible stack is validated with Roche IT before use. Every model version and every decision is logged and traceable, as a regulated environment requires.

**Explicitly out of scope (this phase).** No automated correction of records, no medical assessment, no reporting or submission decisions. Those stay with people. This boundary also keeps the tool a quality-system application rather than medical device software (SaMD), which would trigger a far heavier validation regime.

---

## 4. Value & Benefits

### 4.1 What the alternative would cost, measured in Stage 0

This part of the case is built bottom-up from operational data. On purpose, we publish no figure here that only your systems can certify. Stage 0 produces the certified baseline together with your teams, covering:

- Review coverage per queue (Inquiries vs Complaints) and total case volumes.
- Measured review workload per specialist, and the resulting cost per reviewed case.
- The capacity factor: how many reviewers full human-only coverage would really need.
- The hit rate of the team's manual Inquiry checks: how many hidden complaints the unreviewed queue likely contains.

The direction of the answer is already clear from how the operation works. The human-only route is not just expensive, it is unrealistic: the job market simply does not supply device safety QC specialists at that scale. In the target state, the AI screens everything and routes only flagged cases to people. The current specialist team stays as the decision layer and grows with what the tool finds. Once Stage 0 certifies the baseline, the payback on this anchor becomes a simple, checkable division, separate from and on top of the €25M estimate below.

### 4.2 Where the money comes from

Three mechanisms carry the quantified benefit: **productivity** (each specialist works an AI-prepared queue instead of sampling by hand), **avoided error costs** (problems found early cost less than problems found late), and **compliance value** (100% coverage with a documented method is a much stronger audit position).

The €25M estimate is management's figure. Its perimeter (annual or cumulative), its composition and its validation by Finance are confirmed as the first deliverable of Stage 0. The sensitivity below shows the case does not depend on that figure being precise:

| How much of the estimate is real | Annual value | Payback (against 5-year TCO of about €5.0M) | Return over 3 years |
|---|---|---|---|
| 100% (as estimated) | €25.0M | ~2.4 months | ~12x |
| 50% (conservative) | €12.5M | ~4.8 months | ~6x |
| 20% (stress case) | €5.0M | ~12 months | ~2.5x |

*For reference, companies routinely approve projects with a 12–24 month payback. Every scenario here clears that bar.*

### 4.3 Benefits beyond the money

- **Audit and inspection confidence:** the quality story moves from "we check a sample" to "we check everything, with a documented and versioned method". A much stronger position in any inspection.
- **Specialists upgraded, not replaced:** the team stops digging through haystacks and decides on prepared cases. Better use of expertise, better retention, faster onboarding of new reviewers.
- **Surge capacity without hiring:** volume peaks are absorbed by the screening layer, not by emergency recruitment.
- **Company knowledge captured:** decision rules and special cases move from people's heads into a governed, auditable asset owned by Roche.
- **A closed quality loop with Application 1:** the error patterns found in review feed straight back into the guided intake workflows and into targeted agent retraining. Detection shows exactly where prevention should improve.
- **Future option, trend and signal insight:** once 100% of cases are reviewed, you can spot emerging product issues across the whole population, something sampling can never do. Available as a later extension once the review layer is live.

---

## 5. Delivery Model & Roadmap

**Commercial model (as aligned with management).** Fixed-price stages, invoiced only against agreed proof of validation. At program completion, the application licence transfers to Roche at no extra cost. Redsparq provides operations and maintenance for a monthly fee. Roche owns the application and everything built specifically for this project. Generic building blocks that existed before the project remain Redsparq's, and Roche receives a permanent, free licence to use them as part of the application. This is standard practice, and it protects Roche's unrestricted use.

| Stage | Scope & key deliverables | Duration | Acceptance basis | Cost (est.) |
|---|---|---|---|---|
| 0. Discovery & Value Baseline | Requirements with the PRI knowledge cell. Certified baseline from your data: coverage per queue, volumes incl. APAC, measured workloads, cost per reviewed case, Inquiry check hit rate. Savings measurement method agreed with Finance. First version of the golden dataset (a reference set of already-judged cases used to measure the tool). Target architecture. GxP classification. Firm fixed quotes for Stages 1–3 | 6–8 wks | Signed-off scope, value baseline, roadmap | €75K |
| 1. MVP, one system | A first working version (MVP) on one system (SFDC or Rexis), 2–3 priority case types, one language. A review workspace where specialists confirm or reject flags. Detection quality measured on the golden dataset and compared against the current keyword-based selection | 4–5 mo | Agreed accuracy targets met on the golden dataset; nothing scales without measured proof | €600–700K |
| 2. Development & testing, full scope | Both systems. Priority case types. Multiple languages. Hardened integrations. Performance at production volume | 5–6 mo | Acceptance criteria per case type and language | €850–1,000K |
| 3. Validation & global rollout | Validation package per the GxP classification. Security review. Training and change management. Three months of intensive support (hypercare) | 4–6 mo | Validated release live; rollout complete | €800–950K |
| **Total development** | | **~18–20 mo** | | **€2.45–2.85M** |

**Operations from go-live (€45–55K per month, initial term 36 months, with a yearly price adjustment).** Covers first and second line support, plus AI operations: we watch the model's quality, update prompts and models, and re-test after every Rexis or SFDC release. Includes 8–10 days per month for continuous improvement. AI compute (token) usage is billed at cost with a quarterly true-up, estimated at €5–10K per month at full volume, to be confirmed against real case volumes in Stage 0. For context: the operations fee protects a review capacity worth millions per year, for well under 1% of that value.

**Governance.** A joint steering review every quarter: progress against plan, detection quality, value delivered against the Stage 0 baseline, and priorities for the next quarter. Stage-gate acceptance reviews come on top.

**Why staged funding protects Roche.** No stage is invoiced without its agreed proof. Acceptance criteria are signed before each stage starts. And nothing scales before the evidence is in: the MVP must prove its detection quality before Stage 2 is released.

---

## 6. Investment Summary: Five-Year View

| Component | Amount | Character |
|---|---|---|
| Development, Stages 0–3 | €2.45–2.85M | One-time, staged, paid on proof |
| Operations & maintenance (36 months) | €1.62–1.98M | Monthly fee, adjusted yearly |
| AI compute (billed at cost, no markup) | €0.2–0.4M | Depends on volume, quarterly true-up |
| **Total 5-year TCO** | **€4.3–5.2M** | No ongoing licence fees; Roche owns the application |

*For comparison, similar global AI tools in regulated environments are typically quoted by large system integrators at €2–8M for implementation alone, before owning the asset and before operations.*

---

## 7. Governance, Risk & Compliance

**GxP.** System classification is confirmed in Stage 0. Validation follows medical device QMS software validation requirements (ISO 13485), using GAMP 5 as the method, with the formal documents (URS, functional specification, traceability, IQ/OQ/PQ where applicable) delivered in Stage 3.

**Data privacy.** All processing happens inside Roche's Google Cloud environment, through approved model endpoints. No case data leaves the Roche environment. Data protection terms follow Roche standards, including transparency on any subprocessors.

**Model risk.** A person always decides. Measurable quality gates at every stage. Versioned prompts and models with a full audit trail. In operations, we monitor for quality drift and revalidate periodically.

**Security.** Roche InfoSec review checkpoints at the Stage 1 and Stage 3 gates.

| Risk | Impact if unmanaged | Mitigation built into the plan |
|---|---|---|
| Savings baseline not validated | The value debate returns at every review | Stage 0 delivers a measurement method agreed with Finance, anchored in current review costs |
| Detection quality below target | The tool flags too much or too little | Hard stage gates on the golden dataset; no scale-up without measured proof |
| GxP scope broader than assumed | Stage 3 takes longer and costs more | Explicit classification in Stage 0; changes go through change control with transparent pricing |
| Data access delays | The timeline slips | Access requests start in week 1 of Stage 0 |
| Vendor dependency | Continuity concern | Roche owns the application; full documentation is a deliverable; source code held in escrow; 90-day handover commitment |

---

## 8. Delivery Organisation

Redsparq is the single accountable partner: program management, medical device safety (PRI) domain and process expertise, requirements and acceptance, validation and quality documentation, training, and first and second line operations.

At the core sits a dedicated PRI knowledge cell drawn from the 13-specialist team that works these cases every day, the same team that started checking Inquiries by hand for hidden complaints. They provide the decision rules, the special cases and the documentation, they build and maintain the golden dataset, and they judge detection quality at every stage gate. This keeps the tool grounded in how the work actually happens: the people who know exactly where details get missed teach the system what to look for, and then judge whether it has learned.

The specialised AI engineering is done by Redsparq's AI development partner, working under Redsparq's quality system and full contractual responsibility. All Roche requirements (confidentiality, audit rights, data protection) flow down in full, and the partner goes through Roche's standard subcontractor approval. The structure is deliberate: deep domain knowledge close to the client, with dedicated AI engineering capacity behind it.

---

## 9. Assumptions & Dependencies

1. The €25M savings figure is a management estimate. Its perimeter (annual or cumulative), its composition and its validation by Finance are confirmed in Stage 0. The verifiable baseline is built bottom-up from the current review operation (13 specialists at €4,700 per specialist per month), with coverage certified from your data.
2. Case volumes per queue (including APAC), the language mix, and the effort difference between reviewing an Inquiry and a Complaint are certified in Stage 0 from Roche data. They drive compute cost, timeline and the operations fee band.
3. The hit rate of the team's manual Inquiry checks (complaints and PRIs found per reviewed Inquiry) is being compiled from current operations and will quantify the hidden risk pool as part of the Stage 0 value baseline.
4. Costs assume the GxP classification confirmed in Stage 0. If the tool is formally classified as a validated system, Stage 3 effort may grow by roughly 20–30%, handled through change control.
5. Read access to a representative set of historical cases (anonymised where required) is available during Stages 0 and 1.
6. PRI subject matter experts (the knowledge cell, coordinated with Li Li Lim) are available part-time during Stages 0 to 2 for rules, golden dataset work and evaluation.
7. The system runs in Roche's Google Cloud environment with approved model endpoints (for example Vertex AI). Any deviation from the Google-compatible stack is validated with Roche IT.
8. All figures are planning estimates (±20%). Firm fixed prices per stage are delivered at the end of Stage 0. Prices exclude VAT.

---

## 10. Decision Requested & Timeline

**Requested now:** (a) include the program in the H2 funding round, with a development envelope of €2.45–2.85M plus the operations budget; (b) authorise Stage 0 (€75K) immediately under the existing MSA. Stage 0 runs during the approval window and hands Finance firm, validated numbers instead of estimates. It de-risks the funding decision; it does not pre-empt it.

| Milestone | Indicative timing |
|---|---|
| Review with sponsor | Week of 6 July 2026 |
| Alignment meeting with Tuan | 8–10 July 2026 |
| Business case submission (finance deadline) | Before 31 July 2026 |
| Stage 0: Discovery & Value Baseline | August to September 2026 |
| Stage 1: MVP on one system (gate: golden dataset targets) | October 2026 to February 2027 |
| Stage 2: Development & testing, full scope | March to August 2027 |
| Stage 3: Validation & global rollout | September 2027 to February 2028 |
| Steady-state operations (quarterly steering reviews continue) | From Q1 2028 |

---

## Annex A: Stage Acceptance Framework (what "validation proof" means)

So that paying per validated stage stays friction-free for both sides, every stage follows the same mechanism:

- Acceptance criteria are agreed and signed before the stage starts, never discovered at the end.
- Every stage has a deliverable checklist. From Stage 1 onward, measurable accuracy targets (precision and recall on the golden dataset built and maintained by the PRI knowledge cell) are part of the criteria.
- Review window: 10 business days from delivery. Within that window, either acceptance or a documented rejection with specific deficiencies. The acceptance certificate triggers invoicing.
- Scope changes go only through change control, with transparent pricing. That protects both the budget and the timeline.
