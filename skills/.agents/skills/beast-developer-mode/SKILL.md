---
name: beast-developer-mode
description: Orchestrated dev-review loop. Main agent implements changes directly (loading coding/tdd/language skills), then delegates to code-reviewer subagent. Loops until reviewer approves. Use when user wants hands-off development with automated review cycles, or says "beast mode", "dev-review loop", "auto-review", "delegate and review".
---

# Beast Developer Mode

## What This Is

A hands-off orchestranded dev-review loop: main agent implements user request → delegates to `code-reviewer` subagent → fixes reviewer feedback → repeat until approved.

Main agent writes code directly (loading `coding`, `tdd`, and relevant language skills). Only review is delegated.

## Workflow

### Step 1: Interpret the Request

Understand what the user wants. If ambiguous, ask clarifying questions before entering the loop.

### Step 2: Implementation Pass

Main agent implements the changes directly:

1. **Load skills**: Load `coding`, `tdd`, and relevant language skills (e.g., `typescript`, `golang`, `rust`).
2. **Explore**: Use `codegraph_explore` to understand affected code.
3. **Plan**: Create a `todowrite` plan. Each task must have verifiable success criteria.
4. **Implement**: Write code following coding/tdd principles. Surgical changes only. Match existing style.
5. **Verify**: Run lint, tests, and confirm the change works.

On subsequent cycles: apply reviewer feedback on top of current changes.

### Step 3: Reviewer Pass

Delegate to the `code-reviewer` subagent:

- Task: review the changes against the original request
- The reviewer checks: correctness, code quality, tests, edge cases
- Task must include the diff/changes and original user request

Collect the reviewer's verdict: **APPROVED** or **CHANGES REQUESTED** with specific feedback items.

### Step 4: Loop Decision

| Reviewer verdict      | Action                                                |
| --------------------- | ----------------------------------------------------- |
| **APPROVED**          | Done. Report summary to user.                         |
| **CHANGES REQUESTED** | Return to Step 2 with reviewer feedback as new input. |

### Step 5: Summarize

When approved, present the final result:

- What was implemented
- Changes made across all cycles
- Any remaining notes from final review

## Rules

- Main agent writes code directly. Loads `coding`, `tdd`, and language skills.
- Only the reviewer is delegated.
- Each cycle passes **original request + reviewer feedback** for the next implementation pass.
- Cap at 2 cycles. If not approved by cycle 2, surface the deadlock to user with remaining issues.
- Use `delegate` or `subagent` tool for the code-reviewer pass.
- Track cycle count and reviewer feedback across iterations.

## Example Invocation

```
User: "Add a login endpoint to this API. Beast mode."
```

Agent flow:

1. Interpret: login endpoint, POST /login, returns JWT
2. Implement: load coding + tdd + typescript, write endpoint + tests
3. Delegate to reviewer: "Review the login endpoint changes..."
4. Reviewer: APPROVED → summarize and done.
   OR Reviewer: CHANGES REQUESTED ("missing rate limiting") → go back to implement.
