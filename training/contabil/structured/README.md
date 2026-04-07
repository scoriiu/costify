# Structured Training Data — Schema & Update Guide

## Architecture

```
structured/          → Tier 1: JSON lookup tables (zero LLM, instant retrieval)
chunks/              → Tier 2: Pre-chunked content for RAG (vector search + small LLM)
```

## Tier 1 — Structured JSON Files

| File | Domain | Update frequency |
|---|---|---|
| `tax-rates.json` | All tax rates, thresholds, limits | Annually (January) + at each legislative change |
| `tax-calendar.json` | Filing deadlines, payment dates | Annually (January) |
| `chart-of-accounts.json` | Plan de conturi (account codes) | Rarely (OMFP changes) |
| `journal-entries.json` | Common nota contabila patterns | Rarely |
| `caen-rules.json` | CAEN codes with tax implications | At legislative changes |
| `penalties.json` | Fines, sanctions, amounts | At legislative changes |
| `corporate.json` | Capital social, AGA, dividende rules | At legislative changes |
| `payroll.json` | Salary calculation, contributions, Revisal | Annually + at legislative changes |

## How to Update

### Adding a new tax rate or threshold

1. Open the relevant JSON file (e.g., `tax-rates.json`)
2. Find the section (e.g., `tva.standard`)
3. Update the value
4. Add the old value to the `history` section
5. Update `_meta.updated` date

### Adding a completely new tax/concept

1. Add a new top-level key in the relevant JSON file
2. Follow the existing schema pattern:
```json
{
  "new_concept": {
    "rate": 0.05,
    "base": "description of what it applies to",
    "article": "art. XX CF/CPF/Legea YY",
    "conditions": ["condition 1", "condition 2"],
    "note": "any important nuance"
  }
}
```

### Adding a new year's constants

1. Duplicate `tax-rates.json`
2. Update `_meta.year` and `_meta.updated`
3. Move changed values to history sections
4. Update current values

## Tier 2 — Chunks for RAG

### Chunk format

Each chunk is a markdown file in `chunks/` with YAML frontmatter:

```markdown
---
id: "micro-conditions-2026"
topic: "micro"
task_types: ["tax_determination"]
articles: ["art. 47 CF", "art. 51 CF", "art. 52 CF"]
keywords: ["microintreprindere", "conditii micro", "1%", "100000 EUR"]
level: 3
---

[Content here — self-contained, 200-500 tokens]
```

### Chunk rules

1. **Self-contained**: each chunk must make sense alone, without reading other chunks
2. **200-500 tokens**: small enough for a fast model's context, large enough to be useful
3. **Tagged**: frontmatter enables filtered retrieval (e.g., "only chunks about TVA")
4. **Article references**: always cite the legal article
5. **One topic per chunk**: don't mix TVA with payroll in the same chunk

### Adding a new chunk

1. Create a new `.md` file in `chunks/`
2. Name it: `{domain}-{topic}.md` (e.g., `tva-reverse-charge.md`)
3. Add YAML frontmatter with id, topic, task_types, articles, keywords, level
4. Write the content — concise, factual, with legal references
5. Keep it under 500 tokens

### Updating an existing chunk

1. Edit the content
2. Update the frontmatter if articles or keywords changed
3. The chunk ID stays the same (so embeddings can be refreshed)

## Schema for JSON files

### Common patterns

Every JSON file has `_meta`:
```json
{
  "_meta": {
    "year": 2026,
    "updated": "2026-04-07",
    "source": "description of where this data comes from"
  }
}
```

Every rate/threshold has:
- `rate` or `amount` — the value
- `article` — legal reference
- `note` — important nuances (optional)
- `conditions` — array of conditions (optional)
- `history` — object with year keys and old values (optional)

### Extending with new domains

If you need a new domain not covered by existing files:
1. Create a new JSON file in `structured/`
2. Add `_meta` header
3. Follow the existing schema patterns
4. Add the file to this README's table
5. Add corresponding chunks in `chunks/` for reasoning questions about the new domain
