# docs/internal/

Internal-only documentation. **Not shipped to production** — excluded from the Docker image via `.dockerignore` (`docs/*` + `!docs/ro`).

Purpose: keep detailed technical reasoning (file paths, rationale, decision notes, resolved dubii) that is valuable as project audit trail but would only confuse end users.

## questions-tehnic/

Original, unabridged versions of the accountant Q&A docs before they were rewritten for the user-facing `/docs` site.

- `f20-detaliat.md` — full F20 questions including resolved and technical reasoning
- `conturi-nemapate.md` — full unmapped-accounts investigation including workflow decisions
- `plan-conturi.md` — original 9-section plan-de-conturi refactor document

The user-facing versions live in `docs/ro/intrebari-contabil-*.md` and are registered in `src/lib/docs-navigation.ts`.
