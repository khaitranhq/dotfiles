---
name: eraser
description: Create Eraser cloud architecture diagrams as code. Use when working with Eraser, cloud architecture diagrams, .eraser files, or when user mentions Eraser diagrams, AWS architecture diagrams, GCP diagrams, Azure diagrams, or infrastructure diagrams in Eraser syntax.
---

# Eraser Cloud Architecture Diagrams

Create Eraser cloud architecture diagrams as code when the user wants infrastructure diagrams, service maps, or cloud topology views.

## When to Use This Skill

- User asks for an Eraser diagram, `.eraser` file, or "diagram as code" using Eraser
- User wants cloud architecture diagrams (AWS, GCP, Azure, K8s)
- User wants infrastructure topology or service dependency diagrams

## Core Workflow

1. Identify diagram goal: structure, cloud topology, or service relationships
2. Choose node names with appropriate icons from `references/icon-list.md`
3. Build structure: nodes → groups → connections → styling
4. Validate all icon names exist in the icon list

## Quick Start

```eraser
direction right

VPC [icon: aws-virtual-private-cloud] {
  ALB [icon: aws-elastic-load-balancing]
  App [icon: aws-ec2]
  DB [icon: aws-rds]
}

User > ALB: HTTPS
ALB > App: HTTP
App > DB: SQL
```

## Reference Guide

| Topic                     | Reference                             | Load When                                  |
| ------------------------- | ------------------------------------- | ------------------------------------------ |
| Syntax rules              | `references/cloud-architecture-syntax.md` | Nodes, groups, properties, connections, direction, styling |
| Icon list                 | `references/icon-list.md`             | Search with `rg`/`grep` for keywords       |

## Working Rules

### Prefer

- Descriptive, unique node names
- Groups for logical containers (VPC, Subnet, Region)
- `direction` statement early in the file
- One icon per node matching its cloud service
- Escape names with spaces or special chars in double quotes

### Avoid

- Duplicate node/group names
- Unvalidated icon names (must exist in icon list)
- Deep nesting when a flatter diagram reads better
- Over-styling before structure is correct

### Icon Selection

- **Never read the full `references/icon-list.md`** — it is 1000+ lines. Always use `rg` or `grep` to search.
- Assign an icon to every node from `references/icon-list.md`
- Run `rg -i "<keyword>" references/icon-list.md` to find matching icons
- Prefer icons that describe the node's exact cloud service (e.g., aws-ec2, gcp-cloud-run, azure-kubernetes-services)

### Validation Checklist

- [ ] All node and group names are unique
- [ ] All icon names exist in the icon list
- [ ] Connections use valid node/group names
- [ ] Direction statement is placed once
- [ ] Hex colors wrapped in quotes (e.g., `"#FF5733"`)

## Knowledge Focus

Eraser cloud architecture syntax, nodes, groups, connections, icons, properties, direction, styling, AWS icons, GCP icons, Azure icons, Kubernetes icons, tech logos.
