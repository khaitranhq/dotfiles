---
name: coding
description: Provides coding principles, best practices, and design guidelines including SOLID, DRY, KISS, YAGNI, and other foundational software engineering patterns for writing clean, maintainable code.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: general
  triggers:
    - coding principles
    - best practices
    - SOLID
    - DRY
    - KISS
    - YAGNI
    - clean code
    - code review
    - design patterns
    - refactoring
    - code quality
  role: advisor
  scope: design
  output-format: text
---

# Coding Principles & Best Practices Skill

## Purpose

This skill provides a reference for foundational coding principles and best practices that apply across languages and domains. Use it to guide design decisions, refactoring, code reviews, and implementation. These principles complement language-specific skills (e.g., golang, typescript) by providing the overarching philosophy.

## Core Principles

### 1. SOLID Principles

#### S — Single Responsibility Principle (SRP)

> A class/module/function should have one, and only one, reason to change.

**Rules:**
- Each module or function should do exactly one thing
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

> Software entities should be open for extension but closed for modification.

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

> No client should be forced to depend on methods it does not use.

**Rules:**
- Keep interfaces small and focused (typically 1–3 methods)
- Break large "god interfaces" into role-based interfaces
- Clients should only depend on the interfaces they actually need

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

> High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Rules:**
- Depend on interfaces/abstract classes, not concrete implementations
- Use dependency injection to provide implementations at runtime
- Avoid `new` in business logic; let a DI container or factory wire dependencies
- High-level policy should define the interface; low-level modules implement it

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

### 2. DRY — Don't Repeat Yourself

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

### 3. KISS — Keep It Simple, Stupid

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

### 4. YAGNI — You Aren't Gonna Need It

> Always implement things when you actually need them, never when you just foresee that you need them.

**Rules:**
- Don't add features, abstractions, or flexibility "just in case"
- Every line of code has a maintenance cost — you pay for what you write
- Resist speculation-driven development; let real requirements drive implementation
- If a requirement isn't in the current sprint/iteration, don't build for it
- Refactoring later when you have concrete needs is cheaper than maintaining speculative code now

### 5. Composition Over Inheritance

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

### 6. Law of Demeter (Principle of Least Knowledge)

> A method should only talk to its immediate friends, not strangers.

**Rules:**
- A method `m` of object `O` should only call methods of: `O` itself, `m`'s parameters, objects created within `m`, `O`'s direct component objects
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

### 7. Separation of Concerns (SoC)

> A program should be separated into distinct sections, each addressing a separate concern.

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

### 8. Fail Fast

> Code should detect and report errors as early as possible.

**Rules:**
- Validate inputs at system boundaries (API, CLI, user input) before processing
- Use assertions and preconditions at function entry points
- Throw specific, descriptive errors immediately — don't let invalid state propagate
- Programming errors should be surfaced loudly, not silently swallowed

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

### 9. Naming Conventions

> Names should reveal intent. Good names save hours of documentation.

**Rules:**
- **Classes/Modules**: Noun phrases that describe what the thing *is* (e.g., `OrderRepository`, `EmailSender`)
- **Functions/Methods**: Verb phrases that describe what the thing *does* (e.g., `calculateTotal`, `findUserById`)
- **Booleans**: Predicate forms — `isValid`, `hasExpired`, `canRetry`
- **Avoid**: Abbreviations, single-letter names (except loop counters), misleading names, noise words (e.g., `Data`, `Info`, `Manager`, `Helper`)
- **Use domain language**: If the business calls it a "Policy", don't name it `InsuranceRule`
- **Length vs. scope**: Short names for short scopes, descriptive names for wide scopes

### 10. Code Smells (Recognize & Avoid)

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

## Design Workflow

### When Starting a New Feature

1. **Define the contract first** — What does it do? Inputs? Outputs?
2. **Apply SOLID** — Identify responsibilities; design interfaces; plan dependencies
3. **Keep it simple** (KISS) — What's the simplest thing that works?
4. **Avoid speculative generality** (YAGNI) — Only build what's needed now
5. **Name everything well** — Good names clarify intent before implementation

### When Refactoring

1. **Identify the smell** — What's wrong? Use the smell table above
2. **Ensure tests exist** — Refactor under the safety net of passing tests
3. **Apply the appropriate principle** — SOLID, DRY, KISS, etc.
4. **Take small steps** — Extract one method/class at a time; verify tests still pass
5. **Review against principles** — Is the result simpler? More testable? Better named?

### During Code Review

Use this checklist:

- [ ] **SRP**: Does each function/class have one reason to change?
- [ ] **DRY**: Is any knowledge duplicated?
- [ ] **KISS**: Is there a simpler approach that meets the same requirements?
- [ ] **YAGNI**: Is there code that isn't needed yet?
- [ ] **Naming**: Do names reveal intent? Are they domain-accurate?
- [ ] **Error handling**: Are errors caught early? Are they descriptive?
- [ ] **Coupling**: Are high-level modules protected from low-level changes?
- [ ] **Testability**: Can this be tested in isolation?
- [ ] **Comments**: Does the code explain itself, or are comments masking complexity?
- [ ] **No smells**: Does the code pass the smell checklist?

## Constraints

### MUST DO

- **Apply SRP** — Each function/class/module must have exactly one responsibility
- **Design to interfaces** — High-level modules must depend on abstractions, not concretions
- **Eliminate duplication** — Consolidate repeated knowledge (not just repeated syntax)
- **Keep it simple** — Choose the simplest solution that satisfies current requirements
- **Use meaningful names** — Names must reveal intent and use domain language
- **Validate early** — Check preconditions at function boundaries; fail fast
- **Separate concerns** — Business logic, presentation, persistence, and infrastructure must be in separate layers
- **Prefer composition** — Use composition over inheritance for behavior reuse (limit inheritance depth)
- **Apply Law of Demeter** — Methods should only talk to immediate dependencies; avoid method chaining
- **Review against this skill** — Use the code review checklist when reviewing PRs

### MUST NOT DO

- **Build speculative features** — Don't add code for hypothetical future requirements (YAGNI)
- **Mix concerns** — Don't put business logic in controllers, SQL in views, etc.
- **Create god objects** — Don't create classes or modules with large, unfocused interfaces (ISP)
- **Ignore error conditions** — Don't let invalid state propagate; catch errors early
- **Use magic numbers** — Don't embed unexplained literals in code; extract to named constants
- **Write "clever" code** — Don't sacrifice readability for cleverness or micro-optimization
- **Deep inheritance** — Don't create inheritance hierarchies deeper than 2 levels
- **Leak abstractions** — Low-level details (DB queries, HTTP status codes) should not leak into business logic
- **Rewrite without tests** — Don't refactor code without adequate test coverage
- **Ignore code smells** — Address smells when you encounter them; don't leave them for later

## When to Use This Skill

- Designing architecture for new features or projects
- Refactoring existing code
- Conducting code reviews
- Making implementation decisions
- Mentoring teammates on clean code practices
- Evaluating trade-offs between competing design approaches
- Supplementing language-specific skills with architectural guidance
