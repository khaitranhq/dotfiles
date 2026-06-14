---
name: coding
description: MANDATORY for ALL code work — writing, editing, refactoring, reviewing, or deleting code in any language. Load this skill for every code-related task. Always pair with the tdd skill for code changes. Non-negotiable baseline.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: general
  role: advisor
  scope: implementation
  output-format: text
---

# Coding Principles & Best Practices

## Activation (MANDATORY)

Load for every task that creates, modifies, refactors, reviews, or deletes code. Always pair with `tdd` for code changes: **red → green → refactor** is default. Skip full TDD only when automation is genuinely impractical (tooling gaps, legacy constraints, missing hooks); still make the change testable where possible, add nearest practical coverage, and explicitly explain the limitation.

**IaC exception**: Declarative infrastructure-as-code configs (Terraform HCL, Pulumi resource definitions, CDK Constructs, Bicep, CloudFormation) are exempt from TDD — they describe desired state, not executable logic. However, **helper/utility functions** within an IaC project (Go, Python, TypeScript code called by constructs or modules) must follow the full TDD workflow.

## Core Principles (ALL MANDATORY)

> Every principle below is a hard requirement. Violating any is a defect.

### 1. SOLID

**S — Single Responsibility**: One reason to change per module/function. If function name needs "and" (e.g., `saveAndNotify`), split it.

**O — Open/Closed**: Open for extension, closed for modification. Add via interfaces/composition/plugins, not by editing existing code. When adding a new case to `switch`, extract a strategy instead.

**L — Liskov Substitution**: Subtypes must be substitutable for base types. Must not violate parent contracts (preconditions, postconditions, invariants). Never throw `NotImplementedError` in overrides. Use composition when behavior diverges.

**I — Interface Segregation**: No client forced to depend on methods it doesn't use. Keep interfaces small (1-3 methods). Break fat interfaces into role-based ones.

**D — Dependency Inversion**: Depend on abstractions, not concretions. High-level defines interfaces; low-level implements them. Use DI; avoid `new` in business logic.

### 2. DRY — Don't Repeat Yourself

Single authoritative representation for each piece of knowledge. Rules:

- Extract repeated logic into shared functions/classes/modules
- Repeated _knowledge_ (business rules) matters more than repeated _syntax_ (boilerplate)
- **Rule of Three**: extract on 3rd repetition, not before (avoid premature abstraction)
- Don't DRY up coincidentally similar code that represents different concepts
- Configuration, constants, magic numbers belong in one place

### 3. KISS — Keep It Simple, Stupid

Simplest solution that meets requirements. Prefer stdlib over custom impl. If you can't explain in one sentence, it's too complex. Write code a junior dev can understand without explanation.

### 4. YAGNI — You Aren't Gonna Need It

No speculative features/abstractions/flexibility "just in case." Every line has maintenance cost. Let real requirements drive implementation. Refactoring later with concrete needs is cheaper than maintaining speculative code now.

### 5. Composition Over Inheritance

Use inheritance only for stable "is-a" relationships. Use composition (has-a) for behavior reuse. Prefer interfaces/traits/protocols over deep inheritance trees. Max inheritance depth: 1-2 levels.

### 6. Law of Demeter / Least Knowledge

Method `m` of object `O` may only call methods of: `O` itself, `m`'s parameters, objects created within `m`, `O`'s direct components. Avoid train wrecks (`a.getB().getC().doSomething()`). Tell, don't ask.

### 7. Separation of Concerns (SoC)

Separate: presentation, application, domain, infrastructure. Each layer depends only on the layer directly below (or abstractions). Don't mix concerns in one function/class.

### 8. Fail Fast

Detect and report errors as early as possible. Validate inputs at boundaries before processing. Assert preconditions at function entry. Throw specific, descriptive errors immediately. Never swallow errors silently.

### 9. TDD & Testability

Default workflow: **red → green → refactor**. Rules:

- Write tests against public interfaces and observable behavior, not private internals
- Design for testability: explicit dependencies, narrow interfaces, deterministic behavior, small I/O seams
- For bugs: reproduce with a failing test first
- For refactors: establish safety net of passing tests before changing behavior-critical code
- IaC declarative configs (Terraform, Pulumi resource definitions, CDK Constructs) are exempt from TDD; helper/utility functions in IaC projects are not
- If full TDD is impractical, state why, add nearest coverage, describe fallback validation

### 10. Naming Conventions

Names must reveal intent:

- **Classes/Modules**: Noun phrases (what it _is_) — `OrderRepository`, `EmailSender`
- **Functions/Methods**: Verb phrases (what it _does_) — `calculateTotal`, `findUserById`
- **Booleans**: Predicate forms — `isValid`, `hasExpired`, `canRetry`
- **Avoid**: abbreviations, single-letter names (except loops), misleading names, noise words (`Data`, `Info`, `Manager`, `Helper`)
- **Use domain language**: business says "Policy" → name it `Policy`, not `InsuranceRule`
- **Length vs scope**: short names for short scopes, descriptive for wide scopes

### 11. Code Smells — Recognize & Eliminate

| Smell                 | Description                            | Fix                               |
| --------------------- | -------------------------------------- | --------------------------------- |
| Long Method           | > 20-30 lines                          | Extract smaller methods           |
| Large Class           | Too many responsibilities              | Extract classes by responsibility |
| Long Parameter List   | > 3-4 params                           | Introduce parameter object/struct |
| Feature Envy          | Uses another's data more than own      | Move method to that object        |
| Shotgun Surgery       | One change → many classes              | Co-locate related behavior        |
| Divergent Change      | One class changes for multiple reasons | Split by responsibility           |
| Primitive Obsession   | Primitives for domain concepts         | Create value objects              |
| Comments as Deodorant | Code explained by comments             | Refactor to self-documenting      |
| Magic Numbers         | Hardcoded unexplained values           | Named constants                   |
| Dead Code             | Unused variables/functions/imports     | Delete                            |

## Mandatory Workflow

### New Feature

1. Define behavior — what should happen, how will you prove it?
2. Write failing test first (red → green → refactor)
3. Define contract (inputs, outputs, public interfaces)
4. Implement smallest slice to pass test
5. Apply SOLID: identify responsibilities, design interfaces, plan dependencies
6. Keep it simple (KISS)
7. Avoid speculative generality (YAGNI)
8. Refactor under green tests
9. Name everything well

### Refactoring

1. Identify the smell (use table above)
2. Ensure tests exist (add characterization tests if needed)
3. Apply appropriate principle (SOLID, DRY, KISS, etc.)
4. Take small steps — extract one at a time; verify tests pass after each
5. Review: Is it simpler? More testable? Better named?

### Code Review Checklist

- [ ] TDD flow followed or impracticality explained
- [ ] SRP: one reason to change per function/class
- [ ] DRY: no duplicated knowledge
- [ ] KISS: no simpler approach available
- [ ] YAGNI: no speculative code
- [ ] Naming reveals intent, domain-accurate
- [ ] Errors caught early, descriptive
- [ ] High-level modules protected from low-level changes
- [ ] Testable in isolation
- [ ] Behavior changes covered by tests or explained
- [ ] Code self-documents; comments don't mask complexity
- [ ] No smells from smell table

## Post-Change Validation (MANDATORY)

After every code change, run:

1. **Formatter** — consistent style (`gofmt`, `prettier`, `rustfmt`, `black`)
2. **Linter** — code quality, bugs, style (`golangci-lint`, `eslint`, `clippy`, `ruff`)
3. **Dry-build / type-check** — compiles without artifacts:
   - Go: `go build -o /dev/null ./...`
   - TypeScript: `tsc --noEmit`
   - Rust: `cargo check`
   - Python: `mypy .` or `pyright`

Load language-specific skill for exact tool commands and configuration.

## Constraints Summary

### MUST DO

- SRP: one responsibility per function/class/module
- Design to interfaces (abstractions over concretions)
- Eliminate duplicated knowledge (not just syntax)
- Simplest solution that works (KISS)
- Meaningful names with domain language
- Validate early, fail fast at boundaries
- TDD by default (red → green → refactor)
- Keep code testable via public interfaces and isolated I/O seams
- Add or update tests for behavior changes
- Explain when tests are missing (why + what replaced them)
- Separate concerns in distinct layers
- Prefer composition over inheritance (max 2 levels deep)
- Apply Law of Demeter: only talk to immediate dependencies
- Use code review checklist for all PRs
- Validate after changes: format, lint, dry-build

### MUST NOT DO

- Build speculative features (YAGNI)
- Mix concerns (business logic in controllers, SQL in views, etc.)
- Create god objects with large unfocused interfaces (ISP)
- Ignore error conditions or let invalid state propagate
- Use magic numbers (extract to named constants)
- Write "clever" code (sacrifice readability for micro-optimization)
- Deep inheritance (>2 levels)
- Leak abstractions (DB queries, HTTP codes must not enter business logic)
- Skip tests silently (explain or add coverage)
- Rewrite without test safety net
- Ignore code smells (address on encounter, don't defer)
