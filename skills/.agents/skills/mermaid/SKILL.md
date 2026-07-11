---
name: mermaid
description: Generate Mermaid sequence and flowchart diagrams, convert to ASCII via mermaid-ascii CLI. Use when user wants mermaid diagrams, ASCII diagrams, flowcharts, or sequence diagrams from mermaid syntax.
---

# Mermaid Diagrams

Generate mermaid diagrams and render them as ASCII via `mermaid-ascii`.

## Rules

- **Update**: when modifying an existing sequence diagram or flowchart, replace the **entire** diagram block. Do NOT surgically edit a single line or participant. Mermaid parse order and implicit participant ordering make partial edits fragile.

## Workflow

1. **Write** the mermaid source to `/tmp/<name>.mermaid`
2. **Convert** with `mermaid-ascii --file /tmp/<name>.mermaid`
3. **Capture** stdout and write to the target file the user specified
