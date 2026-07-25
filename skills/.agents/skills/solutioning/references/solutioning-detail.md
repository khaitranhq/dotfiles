# Solutioning Detail

## Phase 2: Generate Options

Present exactly 3 solutions as markdown sections:

### Solution 1: [Label]

**How it works**: [2-3 sentences]

**Pros**:
- [pro 1]
- [pro 2]

**Cons**:
- [con 1]
- [con 2]

**Effort**: Low/Med/High | **Risk**: Low/Med/High

### Solution 2: [Label]

(each solution labeled exactly 1, 2, 3 — no extra letters/version numbers)

**How it works**: [2-3 sentences]

**Pros**:
- ...

**Cons**:
- ...

**Effort**: Low/Med/High | **Risk**: Low/Med/High

### Solution 3: [Label]

**How it works**: [2-3 sentences]

**Pros**:
- ...

**Cons**:
- ...

**Effort**: Low/Med/High | **Risk**: Low/Med/High

**Recommendation**: [which + one-line why]

Ask user to pick one.

## Phase 3: Design + DoD

After user picks a solution, write to `solution.md`:

**Design** — cover only what the solution needs. Pick from:

- **API design**: endpoints, request/response shapes, auth, error codes
- **Data design**: schema, migrations, relations, indices
- **Test design**: test strategy, test cases, edge cases, integration points
- **Infra design**: resources, config, networking, scaling
- **Component design**: module structure, interfaces, data flow

Only produce the design sections relevant to the solution. Skip sections the solution doesn't touch.

**Definition of Done (DoD)** — concrete, verifiable checklist. Examples:

- Auto: Unit tests for all public functions pass
- Auto: Integration test covers happy path + 2 error paths
- Auto: API docs updated with new endpoints
- Manual: DB migration is reversible - run migration up, then down, then up again
- Auto: Linter + formatter pass
- Manual: smoke test [specific scenario]

## Phase 4: Approval Gate

Present design + DoD. Do NOT start implementation until user explicitly approves.
