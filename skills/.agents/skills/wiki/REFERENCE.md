# Knowledge Base Graph — Reference

## Directory structure (detailed)

```
kb/
├── AGENTS.md              # Schema for agents — the control file
├── wiki/                  # Agent-maintained markdown pages
│   ├── index.md           # Catalog of all pages by category
│   ├── log.md             # Chronological activity record
│   ├── overview.md        # High-level synthesis of the domain
│   ├── entities/          # Entity pages (people, orgs, tools, places)
│   │   └── {entity}.md
│   ├── concepts/          # Concept pages (ideas, theories, methods)
│   │   └── {concept}.md
│   ├── sources/           # Source summary pages (one per ingested source)
│   │   └── {source-slug}.md
│   ├── queries/           # Query answers filed as pages
│   │   └── {query-slug}.md
│   └── meta/              # Lint reports, stats, maintenance
│       └── lint-{date}.md
├── raw/                   # Immutable source documents
│   ├── articles/
│   ├── papers/
│   ├── transcripts/
│   ├── notes/
│   └── assets/            # Downloaded images (for Obsidian: set attachment folder)
├── scripts/               # Utility scripts (search, lint helpers, provenance)
│   ├── discover.sh        # Walk up tree to find kb root
│   ├── search.sh          # grep/rg wrapper with context and highlighting
│   └── provenance.sh      # sha256 check on raw sources
└── exports/               # Generated artifacts
    ├── slides/            # Marp slide decks
    ├── charts/            # Generated charts and diagrams
    └── reports/           # Long-form reports
```

## AGENTS.md conventions

AGENTS.md is the control file. It tells agents the domain-specific rules, page formats, and workflows. Co-evolve it with the agent over time. Minimum sections:

```markdown
# Knowledge Base Schema

## Domain
[What this knowledge base covers — one paragraph]

## Page types
- **entity**: A person, organization, tool, place, or thing. One page per entity.
- **concept**: An idea, theory, method, or pattern. Links to related entities and sources.
- **source**: Summary of one ingested source. Links to raw file and affected entities/concepts.
- **query**: A user question filed as a page. States the question, answer, and citations.
- **overview**: Top-level synthesis. Updated on major ingests.

## Page format

### Entity page template
```markdown
---
type: entity
tags: [tag1, tag2]
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_count: N
---

# Entity Name

## Summary
[One-paragraph summary]

## Key details
- [Fact 1]
- [Fact 2]

## Relationships
- [[other-entity]] — [nature of relationship]
- [[concept-page]] — [how this entity relates to the concept]

## Sources
- [[source-slug]] — [what this source contributed]
```

### Concept page template
...similar structure with ## Definitions, ## Examples, ## Related concepts, ## Sources...

### Source page template
```markdown
---
type: source
tags: [tag1, tag2]
ingested: YYYY-MM-DD
source_url: https://...
source_file: raw/articles/filename.md
source_sha256: abc123...
---

# Source Title

## Summary
[One-paragraph summary of key takeaways]

## Key points
- [Point 1]
- [Point 2]

## Entities mentioned
- [[entity-page]] — [context]

## Contradictions
- [Claim X contradicts existing page Y — resolved/unresolved]

## Raw
See [[raw/articles/filename|raw source]]
```

### Query page template
```markdown
---
type: query
tags: [tag1, tag2]
asked: YYYY-MM-DD
---

# Question

[The user's question]

## Answer

[Synthesized answer with inline citations]

## Sources cited
- [[source-page]]
- [[entity-page]]

## Related
- [[other-query]]
- [[concept-page]]
```

## Indexing strategies

### index.md format

```markdown
---
type: index
updated: YYYY-MM-DD
page_count: N
source_count: M
---

# Wiki Index

## Overview
- [[overview]] — High-level synthesis of the domain

## Entities
- [[entities/alice]] — Alice, engineer and project lead
- [[entities/project-x]] — Project X, the main product

## Concepts
- [[concepts/distributed-systems]] — Distributed systems theory and patterns

## Sources
- [[sources/article-slug]] — "Title" by Author (YYYY-MM-DD) — key takeaway

## Queries
- [[queries/compare-x-vs-y]] — Comparison of X and Y (asked YYYY-MM-DD)
```

### When to use index vs search

| Scale | Strategy |
|-------|----------|
| <50 pages | Scan index.md — it's readable and complete |
| 50–200 pages | Agent reads index.md first to find relevant pages, then reads those |
| 200+ pages | Use `mcp_obsidian_search_simple` or `rg` for keyword search, then drill in |

### log.md format

```markdown
---
type: log
---

# Activity Log

## [2026-05-26] ingest | Article: "Why Distributed Systems Are Hard"
- Wrote [[sources/distributed-systems-hard]]
- Updated [[entities/project-x]] with reliability implications
- Updated [[concepts/distributed-systems]] with CAP theorem details
- Flag: contradiction with [[sources/older-article]] re: consensus protocols
- Index updated: source_count now 12

## [2026-05-25] query | "Compare consensus algorithms for our use case"
- Filed answer as [[queries/compare-consensus]]
- Cites: [[sources/raft-paper]], [[sources/paxos-explained]], [[concepts/distributed-systems]]

## [2026-05-25] lint | Weekly health check
- 3 contradictions flagged (see [[meta/lint-2026-05-25]])
- 2 orphan pages found
- 1 missing cross-reference suggested
- Lint report filed as [[meta/lint-2026-05-25]]
```

Use consistent prefixes so the log is parseable: `grep "^## \[" log.md | tail -10`.

## Frontmatter conventions

Every wiki page carries YAML frontmatter for Dataview queries and tooling:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | yes | `entity`, `concept`, `source`, `query`, `overview`, `index`, `log`, `meta` |
| `tags` | list | yes | Categorization tags (no `#` prefix) |
| `created` | date | yes | ISO date of first creation |
| `updated` | date | yes | ISO date of last substantive update |
| `source_count` | number | entity/concept | How many sources reference this page |
| `source_url` | url | source | Original URL of the source |
| `source_file` | path | source | Path to raw source file |
| `source_sha256` | string | source | Body-only sha256 for drift detection |
| `ingested` | date | source | Date source was ingested |
| `asked` | date | query | Date query was asked |
| `page_count` | number | index | Total wiki pages |
| `source_count` | number | index | Total ingested sources |

## Provenance

Raw sources carry a body-only sha256 in frontmatter so agents can detect when a source has drifted from what was originally filed. The `scripts/provenance.sh` helper:

```bash
#!/usr/bin/env bash
# Compute sha256 of file body (skip frontmatter between --- delimiters)
sed -n '/^---$/,/^---$/!p' "$1" | sha256sum | cut -d' ' -f1
```

The lint workflow checks: stored sha256 vs current raw file sha256. Mismatch → flag for human review.

## Tooling

### Obsidian integration

When the knowledge base lives in an Obsidian vault, agents use `mcp_obsidian_*` tools:

- `mcp_obsidian_vault_read` — Read wiki pages, index, log, raw sources
- `mcp_obsidian_vault_write` — Create new wiki pages
- `mcp_obsidian_vault_patch` — Update sections of existing pages (append to index, update frontmatter)
- `mcp_obsidian_vault_append` — Append to log.md
- `mcp_obsidian_search_simple` — Keyword search across wiki
- `mcp_obsidian_search_query` — JsonLogic queries on frontmatter (e.g., find all sources with a given tag)
- `mcp_obsidian_vault_get_document_map` — Discover headings and blocks before patching
- `mcp_obsidian_tag_list` — See all tags in use

### Obsidian plugins

| Plugin | Use |
|--------|-----|
| **Graph view** (built-in) | Visualize connections between pages |
| **Web Clipper** | Clip web articles to markdown → drop into `raw/` |
| **Marp Slides** | Generate presentations from wiki content |
| **Dataview** | Run dynamic queries over frontmatter |
| **Note Refactor** | Extract sections into separate pages |

### Shell helpers

Agents can shell out for bulk operations:

- `rg -l 'pattern' wiki/` — Find pages mentioning a term
- `rg '^tags:' wiki/ --no-filename | sort | uniq -c | sort -rn` — Tag frequency
- `grep "^## \[" wiki/log.md | tail -10` — Recent activity
- `scripts/provenance.sh raw/articles/foo.md` — Check source integrity
