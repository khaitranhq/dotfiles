# Knowledge Base Graph — Examples

## Example 1: Init — Start a research knowledge base

**User**: "Initialize a knowledge base for my research on distributed systems. I read papers weekly and want to track my understanding."

**Agent**:

1. Creates directory structure in `~/kb/` (or inside Obsidian vault)
2. Writes `AGENTS.md` with domain-specific schema:

```markdown
# Knowledge Base Schema

## Domain
Distributed systems — consensus algorithms, replication, fault tolerance,
CAP theorem, consistency models. Reading academic papers and engineering blogs.

## Page types
- **entity**: People (researchers, authors), systems (etcd, Zookeeper, Spanner),
  companies (Google, Meta)
- **concept**: Algorithms (Raft, Paxos, PBFT), principles (CAP, PACELC, linearizability)
- **source**: Papers and articles with summaries and key equations
- **query**: Comparative analyses filed for future reference
- **overview**: Evolving thesis on consensus trade-offs in practice

## Output formats
- Markdown pages (default)
- Marp slide decks for presenting findings
- Comparison tables for algorithm trade-offs
```

3. Creates `wiki/index.md`, `wiki/log.md`, `wiki/overview.md`
4. Reports: "Knowledge base ready at `~/kb/`. Schema covers entities, concepts, sources, queries. Use graph view to visualize connections."

---

## Example 2: Ingest — Process a new paper

**User**: "I just read the Raft paper. Ingest it. File is at `~/Downloads/raft.pdf`."

**Agent**:

1. Reads `raw/papers/raft.pdf` (or asks user to provide the markdown/text)
2. Discusses key takeaways: "The paper introduces leader election, log replication, and safety. Key insight: Raft decomposes consensus into independent subproblems. This is simpler than Paxos. What should I emphasize?"
3. User: "Focus on the leader election mechanism and how it compares to Paxos."
4. Writes `wiki/sources/raft-paper.md` with summary, key points, entities (Diego Ongaro, John Ousterhout), concepts (leader election, log replication, safety)
5. Updates `wiki/index.md` — adds entry under Sources
6. Creates `wiki/concepts/raft.md` — concept page for Raft algorithm
7. Updates `wiki/concepts/paxos.md` — adds comparison section
8. Updates `wiki/concepts/consensus.md` — adds Raft as sub-concept
9. Creates `wiki/entities/diego-ongaro.md` — entity page
10. Appends to `wiki/log.md`:

```
## [2026-05-26] ingest | Paper: "In Search of an Understandable Consensus Algorithm" (Ongaro, Ousterhout 2014)
- Wrote [[sources/raft-paper]]
- Created [[concepts/raft]], [[entities/diego-ongaro]], [[entities/john-ousterhout]]
- Updated [[concepts/consensus]], [[concepts/paxos]]
- Flag: Raft's leader election vs Paxos leaderless approach — added comparison table
- Index updated: source_count now 5
```

11. Reports: "Ingested Raft paper. Created 3 new pages, updated 2 existing. One comparison table added to Paxos page. Ready for review."

---

## Example 3: Query — Ask a synthesis question

**User**: "Compare Raft and Paxos for a system that needs strong consistency but also high availability during network partitions."

**Agent**:

1. Reads `wiki/index.md` → finds relevant pages: `concepts/raft`, `concepts/paxos`, `concepts/cap-theorem`, `concepts/consensus`, `sources/raft-paper`, `sources/paxos-explained`
2. Reads those pages, synthesizes:

> **Comparison: Raft vs Paxos for consistency + availability**
>
> | Aspect | Raft | Paxos |
> |--------|------|-------|
> | Understandability | High — decomposed into independent subproblems | Low — single monolithic algorithm |
> | Leader model | Strong leader — all writes through leader | Leaderless — any node can propose |
> | Availability during partition | Requires majority partition with leader | Requires majority partition (any node) |
> | Consistency guarantee | Linearizable reads from leader (with lease) | Linearizable with Multi-Paxos optimizations |
> | Recovery | Explicit — logs, snapshots, membership changes | Implicit — needs external mechanisms |
>
> **Verdict**: Raft for this use case. The explicit leader model doesn't hurt availability (still needs majority), and the operational simplicity (log repair, snapshotting, membership changes) reduces implementation bugs. The trade-off is leader bottleneck on write throughput — if that's critical, consider EPaxos.
>
> Sources: [[sources/raft-paper]], [[sources/paxos-explained]], [[concepts/cap-theorem]]

3. Offers: "File this as a wiki page?"
4. User: "Yes."
5. Writes `wiki/queries/raft-vs-paxos-availability.md`, updates index.md, appends log.md

---

## Example 4: Lint — Health check

**User**: "Lint the wiki."

**Agent**:

1. Scans all pages in `wiki/`
2. Reports:

```
## Lint Report — 2026-05-26

### Contradictions (2)
- [[concepts/raft]] says "Raft always uses majority quorum"
  vs [[sources/raft-extensions]] says "Raft can use flexible quorums"
  → Resolution: Update raft page to note flexible quorums as extension

- [[concepts/cap-theorem]] says "choose 2 of 3"
  vs [[sources/cap-reconsidered]] says "CAP is misleading — you always have P, choose C or A"
  → Resolution: Update CAP page with modern interpretation

### Orphan pages (1)
- [[entities/alice]] — no inbound links from any other page
  → Suggested: link from [[concepts/distributed-systems]] or create project page

### Stale claims (1)
- [[concepts/consensus]] mentions "ZooKeeper is industry standard" — last updated 3 months ago
  → Suggested: check if etcd has superseded

### Missing cross-references (3)
- [[entities/diego-ongaro]] not linked from [[concepts/raft]]
- [[sources/paxos-explained]] not linked from [[concepts/paxos]]
- [[concepts/linearizability]] mentioned in [[concepts/raft]] but no page exists

### Suggested investigations
- No page for Byzantine fault tolerance — search for PBFT papers?
- Low source count on [[concepts/cap-theorem]] (1 source) — find more?
```

3. User: "Fix contradictions 1 and 2, and create the linearizability concept page."
4. Agent patches the flagged pages and reports done.

---

## Example 5: Batch ingest from Obsidian Web Clipper

**User**: "I clipped 5 articles into `raw/articles/` this week. Batch ingest them all."

**Agent**:

1. Lists files in `raw/articles/` — finds 5 new `.md` files
2. For each article:
   - Reads it
   - Writes brief summary (1 paragraph)
   - Updates index.md
   - Identifies affected entities/concepts → updates or creates pages
   - Appends to log.md
3. Reports summary: "Ingested 5 articles. Created 2 new entity pages, updated 7 existing concept pages. 3 contradictions flagged for review."
4. Suggests: "3 articles touched [[concepts/consensus]] — worth a dedicated comparison page?"
