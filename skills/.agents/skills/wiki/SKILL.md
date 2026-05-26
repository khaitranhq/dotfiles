---
name: wiki
description: Builds and maintains a persistent, compounding knowledge base as a graph of interlinked markdown files. Agents read, write, and cross-reference wiki pages so knowledge accumulates across sessions. Use when the user wants to build a personal wiki, research knowledge base, study companion, project documentation, or any long-lived structured knowledge store. Triggers by wiki, knowledge base, knowledge graph, KB, ingest source, query wiki, lint wiki, build wiki, maintain wiki, LLM wiki.
---

# Knowledge Base Graph

## Quick start

Tell the agent: "Initialize a knowledge base in `~/kb/`". The agent creates:

```
kb/
├── AGENTS.md          # Schema — conventions, workflows, page formats
├── wiki/              # LLM-maintained markdown pages
│   ├── index.md       # Catalog of all pages, organized by category
│   └── log.md         # Chronological append-only activity log
├── raw/               # Immutable source documents (articles, PDFs, transcripts)
│   └── assets/        # Downloaded images for sources
└── exports/           # Generated artifacts (slide decks, charts, reports)
```

## Core concept

Inspired by Karpathy's LLM Wiki. Three layers:

| Layer           | Owner      | Contents                                                                      |
| --------------- | ---------- | ----------------------------------------------------------------------------- |
| **Raw sources** | Human      | Immutable source documents — read, never modified                             |
| **Wiki**        | Agent      | Markdown pages with summaries, entities, concepts — agent writes, human reads |
| **Schema**      | Co-evolved | AGENTS.md — tells agent how wiki is structured and maintained                 |

The wiki **compounds**. New sources don't just get indexed — they update entity pages, revise summaries, flag contradictions, and add cross-references. Good queries get filed back as new pages. The knowledge grows richer every session.

## Workflows

### Init

Set up directory structure, write AGENTS.md with domain-specific conventions, create initial index.md and log.md. Ask user about domain, topic scope, and output preferences (Marp slides? charts?).

### Ingest

1. Read the source (URL, PDF, transcript, paste, or Obsidian Clipper markdown)
2. Discuss key takeaways with user — what to emphasize, what to skip
3. Write a summary page in `wiki/`
4. Update index.md — add entry with category, one-line summary
5. Update affected entity/concept pages across the wiki
6. Append to log.md — `## [YYYY-MM-DD] ingest | Title`
7. Flag contradictions with existing claims — surface for user decision

### Query

1. Read index.md to find relevant pages
2. Read those pages, synthesize answer with citations
3. Offer to file the answer as a new wiki page — good answers compound

### Lint

1. Scan all wiki pages for: contradictions, orphan pages (no inbound links), stale claims, missing cross-references, important concepts lacking pages
2. Report findings — let user decide what to fix
3. Suggest new sources or questions to investigate

## Integration with Obsidian

Use Obsidian MCP tools (`mcp_obsidian_*`) to read and write vault files. The knowledge base lives inside an Obsidian vault. Benefits: graph view shows connections, Dataview queries frontmatter, Marp plugin generates slides.

## Advanced

See [REFERENCE.md](REFERENCE.md) for page formats, frontmatter conventions, indexing strategies, and tooling.
See [EXAMPLES.md](EXAMPLES.md) for worked examples of init, ingest, query, and lint sessions.
