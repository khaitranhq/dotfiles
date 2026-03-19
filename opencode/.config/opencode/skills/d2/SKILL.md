---
name: d2
description: Create D2 diagrams as code for architecture, topology, container, icon, and sequence-diagram use cases, with guidance on syntax and CLI usage.
triggers:
  - d2
  - d2 diagram
  - diagram as code
  - architecture diagram d2
  - sequence diagram d2
role: specialist
scope: implementation, examples, reference
output-format: markdown, code
required-references:
  - references/basic-syntax.md
  - references/special-use-cases.md
  - references/command-usage.md
---

# D2 Diagramming

Create diagrams as code with D2 when the user wants architecture diagrams, service maps, system interactions, containers, icons, or sequence diagrams in a text format that can be version-controlled.

## When to Use This Skill

- The user asks for a D2 diagram, `.d2` file, or "diagram as code" using D2.
- The task involves software architecture, deployment topology, service dependencies, or infra diagrams.
- The user wants sequence diagrams but prefers D2 over Mermaid or PlantUML.
- The user needs render, validate, format, or export commands for D2.

## Core Workflow

1. Identify the diagram goal: structure, flow, deployment, or interaction order.
2. Choose the smallest fitting D2 construct: shapes, connections, containers, icons, or `sequence_diagram`.
3. Sketch the topology with stable object keys first.
4. Add labels, nesting, icons, and styling only after the structure is clear.
5. Validate and format with the D2 CLI before handing off commands or code.

## Reference Guide

Load the focused reference based on what the user needs:

| Topic             | Reference                         | Load When                                                      |
| ----------------- | --------------------------------- | -------------------------------------------------------------- |
| Basic syntax      | `references/basic-syntax.md`      | Shapes, object declarations, connections, containers, labels   |
| Special use cases | `references/special-use-cases.md` | Icons, images, markdown/code blocks, sequence diagrams         |
| Command usage     | `references/command-usage.md`     | Rendering, validation, formatting, watch mode, themes, exports |
| Icon Links        | `references/icon-links.txt`       | When the user wants to use specific icons in their diagrams.   |

## Working Rules

### Prefer

- Stable, descriptive object keys such as `api`, `worker`, `primary_db`.
- Simple structure first, then visual enhancements.
- Containers for grouping related services or domains.
- Sequence diagrams only when message order is important.
- CLI validation with `d2 validate` and formatting with `d2 fmt`.

### Avoid

- Referring to nodes by label inside connections.
- Over-styling before the diagram structure is readable.
- Using sequence diagrams for static topology views.
- Long arrowhead labels that are likely to collide visually.
- Deep nesting when a flatter diagram would read better.
- Assigning `shape` to containers that already contain nested items, which can break layout inheritance.

### Enforce Validation

Always run validation commands before finalizing output so syntax is guaranteed; the steps in `references/command-usage.md` describe this workflow in detail

- `d2 validate <diagram>.d2` .
- `d2 fmt <diagram>.d2` to ensure consistent formatting before sharing or rendering.
- `d2 <diagram>.d2 <output>.svg` then remove svg file to ensure the D2 code is correct and the user can run the command themselves.

## Icon Usage

- Assign an icon to every node by referencing `references/icon-links.txt` so diagrams consistently pair iconography with architecture elements.
- Run `rg "<keyword>" references/icon-links.txt` (or `grep` if needed) to find the best matching icon entry and copy its URL into the node’s `icon` attribute or `image` metadata.
- Prefer icon names that clearly describe the node’s role (e.g., search for "Database" before choosing an icon for data stores) and document the selected icon when sharing the `.d2` file.
- Use `shape: image` for leaf nodes (non container nodes) that should render the icon as the primary visual element

## Expected Output Style

When producing D2 artifacts:

1. Return a valid `.d2` snippet or file content.
2. Keep the initial version concise and structurally correct.
3. Include the exact `d2` commands needed to render or validate if relevant.
4. Prefer examples that are easy to extend rather than heavily styled one-offs.

## Quick Start

```d2
users -> api: HTTPS
api -> db: queries

platform: Platform {
  api
  db {
    shape: cylinder
  }
}
```

Typical validation/render loop:

```bash
d2 fmt diagram.d2
d2 validate diagram.d2
d2 diagram.d2 diagram.svg
```

## Knowledge Focus

D2 objects, shapes, connections, containers, icons, markdown labels, image nodes, sequence diagrams, CLI rendering, validation, formatting, watch mode, themes, exports.
