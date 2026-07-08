# REDSPARQ

## Application 1 "velocity": Cost Assessment & Implementation Plan

Guided picture workflows on the Salesforce platform • delivery model, timeline, one-time and running costs • v1.0, 6 July 2026 • Confidential

---

## 1. Executive Summary

Application 1 equips Customer Care agents with picture-based, step-by-step workflows for approximately 25 physical products, used live while handling a case. Our working assumption, still to be confirmed, is that "velocity" is the guided-workflow feature of the Salesforce platform Roche already uses (Salesforce Industries / OmniStudio). If that holds, no new software needs to be bought: we configure the existing platform, and the value comes from the validated content built on it.

The work starts with templates. A senior Salesforce/OmniStudio consultant designs the data model and the workflow templates, then stays on for eight months to build and improve the tool. Two process editors then copy those templates across the whole product catalog over twelve months. The specialist designs everything once; the editors do the high-volume work at a lower cost.

**Investment:** about €290–330K in one-time cost over roughly 13 months (consultant €88,000; two process editors €122,400; implementation and quality package €80–120K, fixed as a firm quote at the end of the pilot). Running costs are €43–70K per year, not counting licenses. The license cost depends on the scenario: it can be close to zero if the current licenses already cover the need, or a paid OmniStudio add-on quoted through the Salesforce agreement. A single conversation with the Salesforce Account Executive settles it.

> **Nothing needs to be bought to start.** The foundation work and a pilot on one product can begin under the existing MSA while the license question is sorted out in parallel.

---

## 2. Scope & Use Case

**Primary scenario (agent-assisted).** An agent handling a case opens the guided workflow for the product in question and follows validated, picture-based steps: which questions to ask, how to guide the customer, how to recognise whether the situation is a complaint or a PRI, and which details to record in the case. The workflow sits exactly where the agent already works: inside the Salesforce case.

**What is covered.** The baseline covers about 25 physical products. Digital products stay out of Phase 1 and are priced separately once the product list is confirmed. They bring subscription, set-up and usage rules that would change the design, so leaving them out of Phase 1 keeps the scope under control.

**Quality.** Every product workflow passes a defined review by subject-matter experts (SMEs) before release, with version history and an audit trail. In a medical products organisation, this kind of guidance counts as quality-relevant documentation and is managed with the same discipline as controlled documents.

**Possible later extension.** A self-service version for customers is technically possible later. In a regulated intake context it must be designed so that every potential complaint or PRI still ends up as a case.

---

## 3. How the Solution Is Built on the Existing Salesforce Platform

The solution is put together from standard building blocks of Salesforce Industries / OmniStudio. Everything is configured, not custom-coded:

- **OmniScripts:** the step-by-step guided workflows. The agent answers a question, irrelevant steps disappear, and the right instruction and pictures appear.
- **FlexCards:** product cards that show the agent, at a glance, the exact product with its workflows, manuals and pictures.
- **Product catalog attributes (EPC):** images and document links attached directly to the product record, so the right visuals follow the product automatically.
- **File upload & data mapping:** photos are uploaded inside the workflow and linked automatically to the correct case and product records.
- **Image hosting:** high-resolution pictures stored on an external CDN (content delivery network) and linked into Salesforce, avoiding extra platform storage fees.

*Build model: the consultant designs the structure and templates once; the editors repeat them 25 times. Adding product number 26 later takes an editor a few days, not a development project.*

---

## 4. License Cost: the Biggest Variable (Four Scenarios)

Salesforce charges per user, per month, on annual contracts. With around 600 users, Roche is firmly in enterprise discount territory. The scenarios below cover the realistic options; which one applies is confirmed with the Salesforce Account Executive based on the current licenses.

| Scenario | What it is | Incremental license cost (~600 users) | When it applies |
|----------|-----------|----------------------------------------|-----------------|
| **S1: Native platform** | Guided flows + embedded images on licenses agents already hold | ≈ €0 / year | Existing entitlements already cover the need |
| **S2: OmniStudio add-on (most likely)** | OmniStudio guided-workflow layer added for existing users through the Salesforce agreement | Per-user add-on quoted by the AE; typically low-to-mid six figures per year at this user count | Richer guided workflows than the native ones; users already on Salesforce |
| **S3: Full Industry Cloud seats** | Full Health / Life Sciences Cloud edition seats (list ≈ $325–500 per user/month; negotiated ≈ $160–230) | ≈ $1.17–1.64M / year (≈ €1.1–1.5M) | Only if a platform upgrade for 600 users is planned anyway; that is a platform decision, not a workflow decision |
| **S4: Separate third-party tool** | Dedicated visual work-instruction platform outside Salesforce | ≈ €90–140K / year + €10–25K setup | If "velocity" turns out to be a standalone product |

**Right-sizing.** Licenses can be added mid-contract but rarely removed. If a paid scenario applies, starting closer to 500 users and expanding on demand keeps the first-year budget lean. The quote should reflect the split between authors/editors (estimated 25–40) and viewers, and it should include the base license the add-on depends on, so there are no unexpected fees.

**Redsparq access.** Our consultant and editors work inside the Roche org on contractor accounts provided by Roche. This is standard enterprise practice and respects data-residency requirements. No separate tool procurement is needed on our side.

---

## 5. Delivery Model, Team & One-Time Costs

**Salesforce/OmniStudio consultant (8 months).** Designs the data model, the workflow templates and the integration logic, develops and updates the tool while the content is being built, and hands over a documented, easy-to-maintain structure.

**Process editors (2 × 12 months).** Copy the templates across the catalog: uploading pictures, building and checking the workflows product by product. Where workload allows, the editors come from the team already working on the Roche account, so they know the products from day one; if current commitments do not leave room, two dedicated editors are recruited for this project, so that neither the project nor the ongoing operation runs short of capacity.

**Product knowledge & validation.** Anchored by Redsparq's Training & Quality expert covering the full Roche product range, whose involvement will be aligned so that her current responsibilities remain fully covered. On request, Redsparq can also provide the trainer for the ~600 users, not only the training materials.

**Governance.** A joint steering review every three months: progress against plan, content quality, and priorities for the next quarter.

| Component | Sizing | One-time cost |
|-----------|--------|---------------|
| Salesforce/OmniStudio consultant — data model, templates, development & updates | 8 months | €88,000 |
| Process editors (2) — content build & validation across ~25 products | 12 months | €122,400 |
| Implementation & quality package — discovery, foundation & content model, validation & QA documentation, training materials & train-the-trainer, program coordination | across program | €80,000–120,000 |
| **Total one-time** | **~13 months** | **≈ €290,400–330,400** |

The range on the quality package reflects defined variables, not uncertainty. What moves it:

| Variable | Impact |
|----------|--------|
| Tool classified as a formally validated GxP system (formal CSV package) | +€20–35K, via change control |
| Product master data requires material cleanup | +€10–20K, via change control |
| Average exceeds ~12 workflows per product | +€2–4K per additional product |
| Net-new photography / graphic production required | Quoted separately |
| Additional languages beyond English | Quoted separately, per language |

The final figure is fixed as a firm quote at the end of the pilot (weeks 4–8), once workflow count, data quality and validation depth are calibrated on a real product. For budgeting purposes we recommend planning with the upper bound. Spend phases roughly 60% in the first six months (≈€170–190K, as discovery and foundation are front-loaded) and 40% in the second (≈€120–140K) — fitting the H2 2026 / H1 2027 budget cycles.

**Precondition.** Clean product master data is the single biggest cost driver; a one-week data-readiness check runs at project start.

---

## 6. Running Costs (Annual, Post Go-Live)

| Item | Annual (est.) | Why it exists |
|------|---------------|---------------|
| Content maintenance & governance retainer (~0.5 editor) | €25–40K | Products and workflows evolve; document control requires versioning and periodic revalidation |
| Release management & regression | €10–18K | Salesforce ships three releases per year; validated configurations require impact assessment and regression testing per release |
| Periodic review / audit readiness | €5–8K | Annual review evidence for quality-relevant configured processes |
| Media storage / CDN | €3–6K | Image-heavy content served via CDN instead of platform storage overages |
| **Total running (excl. licenses)** | **€43–70K** | ≈ 15–20% of implementation per year — firm proposal after the pilot |

*Licenses (per scenario S1–S4) come on top and flow through Roche's Salesforce agreement.*

---

## 7. Value & Success Metrics (Regulated-Environment Framing)

Success metrics are chosen for a regulated intake context — they measure quality of capture, not suppression of contact:

- **Average handling time (AHT):** agents follow the validated workflow instead of searching manuals — measurable reduction per case type.
- **Complaint & PRI capture rate at intake:** the share of cases where reportable events and required details are correctly identified first time — the same quality objective that Application 2 (PRI Tool) verifies downstream. Together they form one closed quality loop: prevent at intake, detect in review.
- **First-time-right case data:** completeness and consistency of captured case fields, reducing downstream correction effort.
- **Time-to-competence:** new agents reach proficiency faster when validated visual workflows replace tribal knowledge.

*Deliberately not a target: ticket deflection. In a regulated complaint-intake environment, discouraging contact risks losing reportable events; the objective is better-captured cases, not fewer cases.*

---

## 8. Recommendation & Decision Path

1. **Confirm the license scenario:** one conversation with the Salesforce Account Executive against current entitlements — this single answer moves the license line by up to two orders of magnitude.
2. **Start under the existing MSA (no purchase needed):** foundation package + one product piloted end-to-end in weeks 4–8, validated with SMEs — proves the format, calibrates effort per product, and converts the cost range into a firm quote.
3. **Baseline physical products;** digital as a separately priced option after the product list is confirmed.
4. **If a paid license scenario applies:** start near 500 seats, expand mid-contract; reflect the author/viewer split and base-license dependency in the AE quote.
5. **Delivery split:** licenses flow through Roche's Salesforce agreement; Redsparq delivers architecture, configuration, validated content build, governance and training.

---

## 9. Open Inputs

- Confirmation of what "velocity" refers to (Salesforce capability vs. separate product — vendor link if separate).
- Current Salesforce entitlements for the ~600 users (with the AE), and the author/editor vs. viewer split.
- Alignment on allocation for the product overview and validation shaping; confirmation that Phase 1 = physical products only.
- Target go-live expectation for the first products, to plan the ramp.

---

## Annex A — Working Assumptions

### Scope & content

1. Baseline covers ~25 physical products; digital products are out of Phase 1 and will be priced as a separate option once the product list is confirmed.
2. Average of up to ~12 workflows per product; volumes beyond this band are handled via change control at a pre-agreed per-workflow rate.
3. Content is authored and validated in English; additional languages are priced separately (translation plus SME re-validation per language).
4. Workflows are agent-facing (internal use); a customer-facing self-service variant is out of scope for Phase 1.

### Platform & licensing

5. "velocity" refers to the guided-workflow capability of the existing Salesforce platform (Salesforce Industries / OmniStudio); should it prove to be a separate third-party product, plan and costs will be re-baselined.
6. Required user licenses and entitlements are procured by Roche through its Salesforce agreement; Redsparq specialists work on provisioned contractor accounts within the Roche org.
7. Roche provides sandbox environments and a standard deployment path (change/release process) for the duration of the build.

### Data & inputs

8. Product master data is available and consistent; a one-week data-readiness check runs at project start — material cleanup, if needed, is scoped via change control.
9. Existing product imagery, manuals and work instructions are made available as source material; net-new photography or graphic production is quoted separately if required.
10. Named SMEs are available ~2–4 hours per week per active product, with review turnaround of ≤5 business days; longer cycles extend the timeline and may generate idle-time costs.

### Quality & validation

11. Baseline assumes a quality-relevant but not formally validated system ("GxP-lite"): documented SME approval per workflow, versioning and audit trail. Should Roche classify the tool as a validated GxP system (formal CSV package, IQ/OQ/PQ), the delta is handled via change control (indicatively +€20–35K).
12. Training is delivered as train-the-trainer plus materials for ~600 users; direct end-user training sessions, with a trainer provided by Redsparq, are available as an option.

### Commercial

13. The implementation & quality package is quoted as €80–120K; the final figure within this range is fixed as a firm quote at the end of the pilot (weeks 4–8), once workflow count, data quality and validation depth are calibrated on a real product.
14. Prices exclude VAT; offer validity 60 days; delivery model: 1 Salesforce/OmniStudio consultant (8 months) + 2 process editors (12 months); a joint steering review is held every three months.
