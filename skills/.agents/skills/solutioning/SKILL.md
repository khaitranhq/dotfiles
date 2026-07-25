---
name: solutioning
description: Structured solutioning workflow: clarify requirements, generate 3 options with pros/cons, produce design + DoD, and gate on human approval before implementation. Use when planning a new feature, designing a solution, writing a spec, defining acceptance criteria, or when user says "solutioning", "spec", "design", "DoD", "Definition of Done", "plan before building".
---

# Solutioning

## Quick start

User provides high-level requirements → you run the solutioning loop:

```
Clarify → Generate 3 options → User picks → Design + DoD → User approves → Done
```

## Workflow

### Phase 1: Clarify Requirements

1. Read existing spec.md if present. If none, create from [spec template](references/spec-template.md).
2. Ask clarifying questions (gaps, edge cases, non-goals, constraints). Write answers into spec.md.
3. Confirm spec is complete before moving on.

### Phase 2-4: Options → Design → Approve

See [solutioning detail](references/solutioning-detail.md) for the full flow:

1. **Phase 2** — Generate 3 options with pros/cons, user picks one
2. **Phase 3** — Write design + DoD to `solution.md`
3. **Phase 4** — User reviews and approves; do NOT start implementation before approval

## Rules

- Never skip the approval gate. Human must approve design + DoD.
- Never generate fewer than 3 options unless the problem space genuinely has only 1-2 viable paths (state why).
- DoD items must be verifiable. No "code is clean" or "works well".
- Design documents go into the project tree, not the skill folder.
