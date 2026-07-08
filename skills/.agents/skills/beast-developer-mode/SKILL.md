---
name: beast-developer-mode
description: Orchestrated dev-review loop via subagents. Main agent delegates to a developer subagent for implementation, then to a code-reviewer subagent for review. Loops until reviewer approves. Main agent does nothing but transfer requests and collect results. Use when user wants hands-off development with automated review cycles, or says "beast mode", "dev-review loop", "auto-review", "delegate and review".
---

# Beast Developer Mode

## What This Is

A hands-off orchestration loop: main agent delegates user requests to `developer` subagent → then to `code-reviewer` subagent → loop back to developer on feedback → stop when reviewer approves.

Main agent never writes code. Only transfers requests, collects results, drives the loop.

## Workflow

### Step 1: Interpret the Request

Understand what the user wants. If ambiguous, ask clarifying questions before entering the loop.

### Step 2: Developer Pass

Delegate to the `developer` subagent:

- Task: the full user request + any reviewer feedback from prior cycles
- The developer should implement changes following coding/tdd principles

Collect the developer's result (diff, changes made, status).

### Step 3: Reviewer Pass

Delegate to the `code-reviewer` subagent:

- Task: review the developer's changes against the original request
- The reviewer checks: correctness, code quality, SOLID, tests, edge cases
- Task must include the developer's output and original user request

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

- Main agent never edits code. Only delegates.
- Each cycle passes **original request + reviewer feedback** to developer.
- Cap at 3 cycles. If not approved by cycle 3, surface the deadlock to user with remaining issues.
- Use `delegate` or `subagent` tool for both dev and review passes.
- Track cycle count and reviewer feedback across iterations.

## Example Invocation

```
User: "Add a login endpoint to this API. Beast mode."
```

Agent flow:

1. Interpret: login endpoint, POST /login, returns JWT
2. Delegate to developer: "Add POST /login endpoint with JWT..."
3. Delegate to reviewer: "Review the login endpoint changes..."
4. Reviewer: APPROVED → summarize and done.
   OR Reviewer: CHANGES REQUESTED ("missing rate limiting") → back to developer.
