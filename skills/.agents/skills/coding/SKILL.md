---
name: coding
description: MANDATORY baseline coding guardrails and design principles for safe, maintainable code changes across all languages. Load this skill for ANY coding task — when the user asks to write, create, fix, change, update, edit, modify, add, remove, delete, rewrite, refactor, review, clean up, implement, build, enhance, patch, or debug code. Also load when the user mentions code, coding, feature, bug, or any code-related work. For code changes, always pair with the tdd skill and default to red-green-refactor unless automation is impractical.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: general
  triggers:
    - fix
    - change
    - update
    - add
    - remove
    - delete
    - rewrite
    - write code
    - write
    - create code
    - create
    - modify code
    - modify
    - edit code
    - edit
    - implement
    - build
    - enhance
    - patch
    - debug
    - refactor
    - review code
    - clean up
    - code
    - coding
    - feature
    - bug
    - coding principles
    - best practices
    - SOLID
    - DRY
    - KISS
    - YAGNI
    - clean code
    - tidy
    - format
    - reformat
    - fmt
    - lint
    - code review
    - design patterns
    - refactoring
    - code quality
    - implement feature
    - bug fix
    - code change
  role: advisor
  scope: implementation
  output-format: text
---

# Coding Principles & Best Practices Skill

## Activation (MANDATORY)

This skill must be loaded for every task that creates, modifies, refactors, reviews, or deletes code. It is the baseline skill for code changes. Combine it with language- or framework-specific skills when relevant.

For any code change, the `tdd` skill must also be loaded. Use **red → green → refactor** as the default workflow. Do not treat TDD as optional. Only skip full test-first execution when automation is genuinely impractical because of tooling gaps, legacy constraints, or missing hooks; when that happens, still keep the change testable where possible, add the nearest practical coverage, and explicitly explain the limitation.

## Purpose

This skill defines **mandatory** coding principles that apply across languages and domains. Every principle in this skill is a **hard requirement** — not a suggestion, not a guideline, not "consider if convenient." Violating any principle is a defect. These principles complement language-specific skills (e.g., golang, typescript) by providing the overarching philosophy, while also making TDD the default execution model for code changes: define behavior, prove it with a failing test, make it pass with minimal code, then refactor safely.

## Core Principles

> **⚠️ These principles are MANDATORY. Every principle below is a hard requirement. Code that violates any of them is defective. No exceptions without explicit justification.**

### 1. SOLID Principles (MANDATORY)

#### S — Single Responsibility Principle (SRP)

> A class/module/function must have one, and only one, reason to change.

**Rules:**
- Each module or function must do exactly one thing
- A "responsibility" is a reason to change; isolate separate concerns
- If a function name requires "and" (e.g., `saveAndNotify`), it likely violates SRP

**Example:**

```go
// ❌ Bad: Two responsibilities — persistence and notification
func saveAndNotify(user User) error {
    if err := db.Save(user); err != nil {
        return err
    }
    return email.Send(user, "Welcome!")
}

// ✅ Good: One responsibility per function
func saveUser(user User) error {
    return db.Save(user)
}

func sendWelcomeEmail(user User) error {
    return email.Send(user, "Welcome!")
}
```

#### O — Open/Closed Principle (OCP)

> Software entities must be open for extension but closed for modification.

**Rules:**
- Add new behavior by extending (via interfaces, composition, plugins), not by modifying existing code
- Use strategy/plugin patterns, dependency injection, and polymorphism to avoid `switch`/`if-else` chains over types
- When you find yourself adding a new case to an existing `switch` block, consider extracting a strategy

**Example:**

```typescript
// ❌ Bad: Must modify calculateArea for every new shape
function calculateArea(shape: Shape): number {
  if (shape.type === "circle") return Math.PI * shape.radius ** 2;
  if (shape.type === "rectangle") return shape.width * shape.height;
  // Must add here for every new shape type
}

// ✅ Good: Extend via polymorphism
interface Shape {
  area(): number;
}
class Circle implements Shape { area() { return Math.PI * this.radius ** 2; } }
class Rectangle implements Shape { area() { return this.width * this.height; } }
// New shapes simply implement Shape — no existing code changes
```

#### L — Liskov Substitution Principle (LSP)

> Subtypes must be substitutable for their base types without altering program correctness.

**Rules:**
- A subclass or implementation must not violate the contracts (preconditions, postconditions, invariants) of its parent
- Overridden methods must accept all inputs the parent accepts (weaker preconditions) and must not produce results the parent wouldn't (stronger postconditions)
- Avoid throwing `NotImplementedError` or similar in overridden methods
- Composition over inheritance when behavior diverges significantly

**Example:**

```typescript
// ❌ Bad: Square breaks Rectangle's contract
class Rectangle {
    constructor(protected width: number, protected height: number) {}
    setWidth(w: number) { this.width = w; }
    setHeight(h: number) { this.height = h; }
    area(): number { return this.width * this.height; }
}
class Square extends Rectangle {
    constructor(side: number) { super(side, side); }
    setWidth(w: number) { this.width = w; this.height = w; } // Violates LSP!
    setHeight(h: number) { this.width = h; this.height = h; } // Violates LSP!
}

// ✅ Good: Separate shapes implementing a common interface
interface Shape { area(): number; }
class Rectangle implements Shape {
    constructor(private width: number, private height: number) {}
    area(): number { return this.width * this.height; }
}
class Square implements Shape {
    constructor(private side: number) {}
    area(): number { return this.side * this.side; }
}
```

#### I — Interface Segregation Principle (ISP)

> No client must be forced to depend on methods it does not use.

**Rules:**
- Keep interfaces small and focused (typically 1–3 methods)
- Break large "god interfaces" into role-based interfaces
- Clients must only depend on the interfaces they actually need

**Example:**

```go
// ❌ Bad: Fat interface
type Vehicle interface {
    Drive()
    Fly()
    Sail()
    Refuel()
    Honk()
}

// ✅ Good: Segregated by capability
type Drivable interface { Drive(); Refuel() }
type Flyable interface { Fly(); Refuel() }
type Sailable interface { Sail(); Refuel() }

// Compose only what's needed
type Car struct { /* implements Drivable */ }
type Plane struct { /* implements Drivable + Flyable */ }
```

#### D — Dependency Inversion Principle (DIP)

> High-level modules must not depend on low-level modules. Both must depend on abstractions.

**Rules:**
- Depend on interfaces/abstract classes, not concrete implementations
- Use dependency injection to provide implementations at runtime
- Avoid `new` in business logic; let a DI container or factory wire dependencies
- High-level policy must define the interface; low-level modules implement it

**Example:**

```typescript
// ❌ Bad: High-level depends on low-level concrete class
class NotificationService {
    private emailClient = new SmtpEmailClient(); // Direct dependency

    notify(user: User): void {
        this.emailClient.send(user.email, "Hello");
    }
}

// ✅ Good: Both depend on abstraction
interface MessageSender {
    send(address: string, body: string): void;
}

class NotificationService {
    constructor(private sender: MessageSender) {} // Dependency injected

    notify(user: User): void {
        this.sender.send(user.email, "Hello");
    }
}

// Low-level implements the interface
class SmtpEmailClient implements MessageSender {
    send(address: string, body: string): void { /* ... */ }
}
```

### 2. DRY — Don't Repeat Yourself (MANDATORY)

> Every piece of knowledge must have a single, unambiguous, authoritative representation within a system.

**Rules:**
- Extract repeated logic into shared functions, classes, or modules
- Repeated *knowledge* (business rules) matters more than repeated *syntax* (boilerplate)
- Use the **Rule of Three**: extract on the third repetition, not before (to avoid premature abstraction)
- Abstract at the right level — don't DRY up code that coincidentally looks similar but represents different concepts
- Configuration, constants, and magic numbers belong in one place

**Example:**

```typescript
// ❌ Bad: Repeated logic
function getFullPrice(items: Item[]): number {
    let total = 0;
    for (const item of items) total += item.price;
    return total * 1.1; // tax
}
function getFullWeight(items: Item[]): number {
    let total = 0;
    for (const item of items) total += item.weight;
    return total * 1.05; // packaging overhead
}

// ✅ Good: Extract the common pattern
function sumBy<T>(items: T[], key: keyof T): number {
    return items.reduce((total, item) => total + Number(item[key]), 0);
}
function getFullPrice(items: Item[]): number { return sumBy(items, "price") * 1.1; }
function getFullWeight(items: Item[]): number { return sumBy(items, "weight") * 1.05; }
```

### 3. KISS — Keep It Simple, Stupid (MANDATORY)

> Simplicity is a prerequisite for reliability, maintainability, and understandability.

**Rules:**
- Prefer the simplest solution that meets the requirements
- Avoid over-engineering — don't build for hypothetical future use cases
- Write code that a junior developer can understand without explanation
- Favor standard library over custom implementation; well-known patterns over clever hacks
- If you can't explain your solution in one sentence, it's probably too complex

**Example:**

```go
// ❌ Bad: Over-engineered
type Processor interface {
    Process([]int) []int
}

type EvenFilter struct{}
func (f EvenFilter) Process(numbers []int) []int {
    var result []int
    for _, n := range numbers {
        if n%2 == 0 {
            result = append(result, n)
        }
    }
    return result
}

func runPipeline(numbers []int, processors []Processor) []int {
    result := numbers
    for _, p := range processors {
        result = p.Process(result)
    }
    return result
}

// ✅ Good: Simple
func getEvens(numbers []int) []int {
    var result []int
    for _, n := range numbers {
        if n%2 == 0 {
            result = append(result, n)
        }
    }
    return result
}
```

### 4. YAGNI — You Aren't Gonna Need It (MANDATORY)

> Always implement things when you actually need them, never when you just foresee that you need them.

**Rules:**
- Don't add features, abstractions, or flexibility "just in case"
- Every line of code has a maintenance cost — you pay for what you write
- Resist speculation-driven development; let real requirements drive implementation
- If a requirement isn't in the current sprint/iteration, don't build for it
- Refactoring later when you have concrete needs is cheaper than maintaining speculative code now

### 5. Composition Over Inheritance (MANDATORY)

> Favor object composition over class inheritance for code reuse and flexibility.

**Rules:**
- Use inheritance only for "is-a" relationships that are stable and fundamental
- Use composition (has-a) for behavior reuse — delegate to collaborator objects
- Prefer interfaces/traits/protocols over deep inheritance trees
- Limit inheritance depth to 1–2 levels maximum

**Example:**

```typescript
// ❌ Bad: Deep inheritance chain
class Animal { eat() {} }
class Mammal extends Animal { breathe() {} }
class Dog extends Mammal { bark() {} }
class RobotDog extends Dog { charge() {} } // Is it really a Dog?

// ✅ Good: Composition
interface Breather { breathe(): void; }
interface Barker { bark(): void; }
interface Charger { charge(): void; }

class RobotDog implements Breather, Barker, Charger {
    constructor(private breather: Breather, private barker: Barker, private charger: Charger) {}
    breathe() { this.breather.breathe(); }
    bark() { this.barker.bark(); }
    charge() { this.charger.charge(); }
}
```

### 6. Law of Demeter / Principle of Least Knowledge (MANDATORY)

> A method must only talk to its immediate friends, not strangers.

**Rules:**
- A method `m` of object `O` must only call methods of: `O` itself, `m`'s parameters, objects created within `m`, `O`'s direct component objects
- Avoid method chaining: `a.getB().getC().doSomething()` — this is a "train wreck"
- Tell, don't ask: tell objects to perform actions rather than asking for their internals to do it yourself

**Example:**

```typescript
// ❌ Bad: Train wreck — knows too much about internals
function checkout(user: User, order: Order): void {
    user.getAccount().getPaymentMethod().charge(order.getTotal());
}

// ✅ Good: Tell, don't ask
class User {
    constructor(private account: Account) {}
    pay(amount: number): void {
        this.account.charge(amount);
    }
}

function checkout(user: User, order: Order): void {
    user.pay(order.total);
}
```

### 7. Separation of Concerns / SoC (MANDATORY)

> A program must be separated into distinct sections, each addressing a separate concern.

**Rules:**
- Separate business logic from presentation, persistence, and infrastructure
- Use layered architecture: presentation → application → domain → infrastructure
- Each layer depends only on the layer directly below it (or abstractions)
- Don't mix concerns within a single function or class

**Example:**

```go
// ❌ Bad: HTTP handling mixed with business logic and SQL
func createUserHandler(w http.ResponseWriter, r *http.Request) {
    name := r.FormValue("name")
    email := r.FormValue("email")
    db, _ := sql.Open("sqlite3", "db.sqlite3")
    db.Exec("INSERT INTO users (name, email) VALUES (?, ?)", name, email)
    w.WriteHeader(http.StatusCreated)
}

// ✅ Good: Separate concerns
// handler.go — HTTP layer
func createUserHandler(svc *UserService) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        name := r.FormValue("name")
        email := r.FormValue("email")
        user, err := svc.CreateUser(r.Context(), name, email)
        if err != nil {
            http.Error(w, err.Error(), http.StatusConflict)
            return
        }
        w.WriteHeader(http.StatusCreated)
        json.NewEncoder(w).Encode(user)
    }
}

// service.go — Business logic
type UserService struct {
    repo UserRepository
}

func (s *UserService) CreateUser(ctx context.Context, name, email string) (*User, error) {
    exists, err := s.repo.Exists(ctx, email)
    if err != nil {
        return nil, err
    }
    if exists {
        return nil, ErrUserExists
    }
    return s.repo.Insert(ctx, name, email)
}

// repository.go — Persistence
type UserRepository interface {
    Insert(ctx context.Context, name, email string) (*User, error)
    Exists(ctx context.Context, email string) (bool, error)
}
```

### 8. Fail Fast (MANDATORY)

> Code must detect and report errors as early as possible.

**Rules:**
- Validate inputs at system boundaries (API, CLI, user input) before processing
- Use assertions and preconditions at function entry points
- Throw specific, descriptive errors immediately — don't let invalid state propagate
- Programming errors must be surfaced loudly, not silently swallowed

**Example:**

```go
// ❌ Bad: Invalid state propagates, causing confusing nil pointer dereference later
func process(order *Order) {
    applyDiscount(order.Coupon) // Panics if Coupon is nil!
}

// ✅ Good: Validate early
func process(order *Order) error {
    if order == nil {
        return errors.New("order must not be nil")
    }
    if order.Coupon == nil {
        return errors.New("order requires a coupon")
    }
    applyDiscount(order.Coupon)
    return nil
}
```

### 9. TDD & Testability (MANDATORY)

> TDD is the default workflow for code changes: prove behavior with a failing test, make it pass with minimal code, then refactor safely.

**Rules:**
- Always load the `tdd` skill alongside this skill for code changes
- Start behavior changes with a failing automated test whenever a realistic test harness or automation hook exists
- Follow **red → green → refactor** in small vertical slices; do not batch many tests before implementation
- For bug fixes, reproduce the bug with a failing test first when practical
- For refactors, establish or extend a safety net before changing behavior-critical code
- Write tests against public interfaces and observable behavior, not private implementation details
- Design code for testability: explicit dependencies, narrow interfaces, deterministic behavior, and small seams around I/O
- If full TDD is genuinely impractical, state why, add the nearest practical automated coverage, and describe the fallback validation performed

### 10. Naming Conventions (MANDATORY)

> Names must reveal intent. Good names save hours of documentation.

**Rules:**
- **Classes/Modules**: Noun phrases that describe what the thing *is* (e.g., `OrderRepository`, `EmailSender`)
- **Functions/Methods**: Verb phrases that describe what the thing *does* (e.g., `calculateTotal`, `findUserById`)
- **Booleans**: Predicate forms — `isValid`, `hasExpired`, `canRetry`
- **Avoid**: Abbreviations, single-letter names (except loop counters), misleading names, noise words (e.g., `Data`, `Info`, `Manager`, `Helper`)
- **Use domain language**: If the business calls it a "Policy", don't name it `InsuranceRule`
- **Length vs. scope**: Short names for short scopes, descriptive names for wide scopes

### 11. Code Smells — Recognize & Eliminate (MANDATORY)

| Smell | Description | Fix |
|-------|-------------|-----|
| **Long Method** | Method > 20–30 lines | Extract smaller methods |
| **Large Class** | Class with too many responsibilities | Extract classes by responsibility |
| **Long Parameter List** | Function takes > 3–4 parameters | Introduce parameter object/struct |
| **Feature Envy** | Method uses another object's data more than its own | Move method to the other object |
| **Shotgun Surgery** | One change requires editing multiple classes | Co-locate related behavior |
| **Divergent Change** | One class changes for multiple reasons | Split by responsibility |
| **Primitive Obsession** | Using primitives (strings, ints) for domain concepts | Create value objects |
| **Comments as Deodorant** | Obscure code explained with comments | Refactor to be self-documenting |
| **Magic Numbers** | Hardcoded unexplained values | Extract to named constants |
| **Dead Code** | Unused variables, functions, imports | Delete it |

## Mandatory Workflow

### When Starting a New Feature

Follow these steps in order. Every step is required.

1. **Define the behavior first** — What should the system do, and how will you prove it?
2. **Write the first failing test first** — Default to a small red → green → refactor cycle for behavior changes
3. **Define the contract** — What are the inputs, outputs, and public interfaces?
4. **Implement the smallest slice** — Write only enough code to make the current test pass
5. **Apply SOLID** — Identify responsibilities; design interfaces; plan dependencies
6. **Keep it simple** (KISS) — What's the simplest thing that works?
7. **Avoid speculative generality** (YAGNI) — Only build what's needed now
8. **Refactor under green tests** — Improve structure only after the behavior is proven
9. **Name everything well** — Good names clarify intent before implementation

### When Refactoring

Follow these steps in order. Every step is required.

1. **Identify the smell** — What's wrong? Use the smell table above
2. **Ensure tests exist** — Refactor under the safety net of passing tests; add characterization tests first when needed
3. **Apply the appropriate principle** — SOLID, DRY, KISS, etc.
4. **Take small steps** — Extract one method/class at a time; verify tests still pass
5. **Review against principles** — Is the result simpler? More testable? Better named?

### During Code Review

Every code review must verify all items on this checklist. Missing any check is a review defect.

- [ ] **TDD flow**: Was behavior driven by failing tests, or is there a clear reason full TDD was impractical?
- [ ] **SRP**: Does each function/class have one reason to change?
- [ ] **DRY**: Is any knowledge duplicated?
- [ ] **KISS**: Is there a simpler approach that meets the same requirements?
- [ ] **YAGNI**: Is there code that isn't needed yet?
- [ ] **Naming**: Do names reveal intent? Are they domain-accurate?
- [ ] **Error handling**: Are errors caught early? Are they descriptive?
- [ ] **Coupling**: Are high-level modules protected from low-level changes?
- [ ] **Testability**: Can this be tested in isolation?
- [ ] **Tests**: Are behavior changes covered by automated tests, or is there a clear explanation for why they are not?
- [ ] **Comments**: Does the code explain itself, or are comments masking complexity?
- [ ] **No smells**: Does the code pass the smell checklist?

## Mandatory Validation After Code Changes

After every code change — whether implementing a new feature, refactoring, or fixing a bug — run validation tools to catch issues early. This step is not optional.

### Required Validation Steps

1. **Run the formatter** — Ensure code style is consistent (e.g., `gofmt`, `prettier`, `rustfmt`, `black`)
2. **Run the linter** — Catch code quality issues, potential bugs, and style violations (e.g., `golangci-lint`, `eslint`, `clippy`, `ruff`)
3. **Run a dry-build / type-check** — Verify the code compiles without producing output artifacts:
   - Go: `go build -o /dev/null ./...`
   - TypeScript: `tsc --noEmit`
   - Rust: `cargo check`
   - Python: `mypy .` or `pyright`
   - Other languages: use the equivalent no-output build/check command

### Finding the Right Tools

Each language has its own ecosystem of formatters, linters, and build tools. **Load the language-specific skill** (e.g., `golang`, `typescript`, `python`) for detailed information about the exact tools, their configuration, and invocation commands for that language. The language skill will also cover project-specific setup and conventions.

## Constraints (Derived from Core Principles)

> **These constraints are non-negotiable. Every code change must satisfy every applicable MUST DO and violate no MUST NOT DO.**

### MUST DO

- **Apply SRP** — Each function/class/module must have exactly one responsibility
- **Design to interfaces** — High-level modules must depend on abstractions, not concretions
- **Eliminate duplication** — Consolidate repeated knowledge (not just repeated syntax)
- **Keep it simple** — Choose the simplest solution that satisfies current requirements
- **Use meaningful names** — Names must reveal intent and use domain language
- **Validate early** — Check preconditions at function boundaries; fail fast
- **Use TDD by default** — For code changes, load `tdd` and work red → green → refactor unless automation is genuinely impractical
- **Keep code testable** — Structure code so behavior can be exercised through stable public interfaces and isolated seams around I/O
- **Add or update tests** — Behavior changes must ship with automated coverage when practical
- **Explain missing tests** — If automated tests are not added, explicitly state why and what validation replaced them
- **Separate concerns** — Business logic, presentation, persistence, and infrastructure must be in separate layers
- **Prefer composition** — Use composition over inheritance for behavior reuse (limit inheritance depth)
- **Apply Law of Demeter** — Methods must only talk to immediate dependencies; avoid method chaining
- **Review against this skill** — Use the code review checklist when reviewing PRs
- **Validate after changes** — After every code change, run the formatter, linter, and dry-build/type-check (e.g., `go build -o /dev/null`, `tsc --noEmit`) to catch issues early. Load the language-specific skill for exact tool commands

### MUST NOT DO

- **Build speculative features** — Don't add code for hypothetical future requirements (YAGNI)
- **Mix concerns** — Don't put business logic in controllers, SQL in views, etc.
- **Create god objects** — Don't create classes or modules with large, unfocused interfaces (ISP)
- **Ignore error conditions** — Don't let invalid state propagate; catch errors early
- **Use magic numbers** — Don't embed unexplained literals in code; extract to named constants
- **Write "clever" code** — Don't sacrifice readability for cleverness or micro-optimization
- **Deep inheritance** — Don't create inheritance hierarchies deeper than 2 levels
- **Leak abstractions** — Low-level details (DB queries, HTTP status codes) must not leak into business logic
- **Skip tests silently** — Don't ship behavior changes without automated tests or an explicit explanation
- **Rewrite without tests** — Don't refactor code without adequate test coverage
- **Ignore code smells** — Address smells when you encounter them; don't leave them for later

## When This Skill Applies

This skill is **always in effect** for any coding task. Load it for every task that creates, modifies, refactors, reviews, or deletes code. It is not optional — it is the baseline standard that all code must meet.

Applies to:
- Designing architecture for new features or projects
- Refactoring existing code
- Conducting code reviews
- Making implementation decisions
- Mentoring teammates on clean code practices
- Evaluating trade-offs between competing design approaches
- Supplementing language-specific skills with architectural guidance
