---
name: golang
description: Enforcement rules (mandatory formatting, constraints, post-impl steps) and instructional guidance (pointer/value semantics, struct design, doc discovery) for Go. Use with .go files, Go projects, go test, go vet, golangci-lint, gofumpt, or any Go tooling.
---

# Go (Golang) Skill

## Enforcement

Rules that must always be followed. No exceptions.

### 1. File Organization Order

**⚠️ CRITICAL: This ordering is mandatory and must be consistently applied to all Go source files.**

Go source files must follow this strict order:

1. **Package declaration** — at the top
2. **Imports** — organized in groups (stdlib, third-party, local)
3. **Constants** — package-level constants
4. **Type definitions** — interfaces first, then structs
5. **Variables** — package-level variables
6. **Functions** — organized by logical grouping

#### Example

```go
package mypackage

import (
	"context"
	"fmt"

	"github.com/external/package"

	"myproject/internal/helper"
)

// Constants
const (
	DefaultTimeout = 30 * time.Second
	MaxRetries     = 3
)

// Interfaces (before concrete types)
type Reader interface {
	Read(ctx context.Context) ([]byte, error)
}

type Writer interface {
	Write(ctx context.Context, data []byte) error
}

// Structs
type Config struct {
	Host string
	Port int
}

type Service struct {
	config Config
	reader Reader
}

// Package-level variables
var (
	ErrInvalidConfig = errors.New("invalid configuration")
	defaultConfig    = Config{Host: "localhost", Port: 8080}
)

// Constructor functions first
func NewService(config Config, reader Reader) (*Service, error) {
	if config.Host == "" {
		return nil, ErrInvalidConfig
	}
	return &Service{config: config, reader: reader}, nil
}

// Methods and functions (grouped by receiver/purpose)
func (s *Service) Start(ctx context.Context) error {
	// implementation
}

func (s *Service) Stop() error {
	// implementation
}

// Helper functions
func parseConfig(raw string) (Config, error) {
	// implementation
}
```

#### Key Principles

- **Interfaces before implementations** — contracts before their concrete types
- **Constructors early** — `New*` functions before methods that use the type
- **Logical grouping** — group related functions together
- **Alphabetical within groups** — constants, variables, struct fields
- **Public before private** — exported items before unexported ones within each section

### 2. Post-Implementation Steps

Run every available formatter, linter, and static-analysis tool. If a tool is installed, do not skip it.

1. **Run Tests**

   ```bash
   go test ./...
   ```

2. **Build and Verify Compilation**

   ```bash
   go build -o /dev/null ./...
   ```

3. **Format Code** — run all available, in order:
   - `goimports -w .`
   - `gofumpt -w .`
   - `gofmt -w .` (only if no other formatter installed)

4. **Run linters** — e.g. `golangci-lint run ./...`. Fix issues. Mark false positives with `//nolint` + justification comment.

5. **Run Static Analysis**
   ```bash
   go vet ./...
   ```

### 3. Hard Constraints

#### MUST DO

- **Follow strict File Organization Order** — package, imports, constants, types (interfaces first), variables, functions
- **Add context.Context to all blocking operations** — enable graceful cancellation and timeout handling
- **Handle all errors explicitly** — never use naked returns
- **Write table-driven tests with subtests** — use `t.Run()` for parametrized tests
- **Propagate errors with fmt.Errorf("%w", err)** — use error wrapping to preserve the error chain
- **Use errors.New("") for sentinel errors** — package-level error variables for comparison
- **Define clear interface contracts** — small interfaces, behavior-focused
- **Run all post-implementation steps** — format, lint, test, vet before committing
- **Document exported functions and types** — doc comments for all public API
- **Use `any` instead of `interface{}`** — `any` is the Go 1.18+ alias; shorter, idiomatic, same semantics
- **Use `go doc` commands** — discover types and signatures before implementing with external packages

#### MUST NOT DO

- **Ignore errors** — no `_ = ` assignments without explicit justification
- **Inline error wrapping** — never wrap a function's error return directly in `fmt.Errorf`. Assign to `err` first, check `if err != nil`, then wrap.
  ✅ `err := fn(); if err != nil { return fmt.Errorf("msg: %w", err) }`
  ❌ `return x, fmt.Errorf("msg: %w", fn())`
- **Use panic for normal error handling** — use errors for control flow
- **Hardcode values** — use config, constants, or env vars
- **Create goroutines without lifecycle management** — ensure goroutines can be cancelled

## Instruction

Guidance and workflows. Use when relevant to the task.

### 1. Package Structure

- Organize code into packages following Go conventions
- Keep `main` package simple, put logic in separate packages

### 2. Struct Organization and Design

- **Limit struct fields to 5–7 fields**
- **Split large structs** into smaller, focused structs using composition
- **Group related fields** logically
- **Use composition** over monolithic structs; consider embedding
- Keep **number of small structs as few as possible**
- Struct fields ordered **alphabetically**

#### Example: Refactoring a Large Struct

**Before:**

```go
type User struct {
    ID          int
    Name        string
    Email       string
    Phone       string
    Street      string
    City        string
    State       string
    ZipCode     string
    Country     string
    CompanyName string
    JobTitle    string
    Department  string
}
```

**After (with composition):**

```go
type Address struct {
    Street  string
    City    string
    State   string
    ZipCode string
    Country string
}

type Contact struct {
    Email string
    Phone string
}

type Company struct {
    Name       string
    JobTitle   string
    Department string
}

type User struct {
    ID       int
    Name     string
    Contact  Contact
    Address  Address
    Company  Company
}
```

### 3. Pointer vs Value Semantics

**⚠️ CRITICAL: Semantic decision, not a micro-optimization. Wrong choice causes bugs or bloat.**

#### Use Pointer When

| Scenario                                                                             | Reason                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **Mutating the original data**                                                       | Value receiver copies the struct; changes are lost           |
| **Large struct**                                                                     | Avoid copying entire struct; cutoff: >~64 bytes or >5 fields |
| **Struct contains a `sync.Mutex`, `sync.RWMutex`, `sync.WaitGroup`, or `sync.Once`** | Must not be copied after first use (go vet warns)            |
| **Struct contains a `sync/atomic` field**                                            | Atomic operations require a stable address                   |
| **Method requires pointer receiver**                                                 | Consistency if any method uses a pointer receiver            |
| **Optional / nullable field semantics**                                              | `nil` = "not set", zero-value struct = "empty but present"   |
| **Interface satisfaction via pointer**                                               | If methods are on `*T`, only `*T` satisfies the interface    |
| **Resource handles (files, connections, etc.)**                                      | Copying causes double-close or use-after-close bugs          |

#### Use Value When

| Scenario                                                            | Reason                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Small struct (a few scalar fields)**                              | Copy is cheaper than pointer indirection + GC pressure                    |
| **Immutable / value-type semantics**                                | Time, coordinates, config snapshots — like `time.Time`                    |
| **No mutation needed**                                              | Simpler code, no nil-check boilerplate                                    |
| **Concurrency safety via copy**                                     | Each goroutine gets its own copy, no locks needed                         |
| **Returning from a constructor that configures everything upfront** | `return T{...}` avoids heap allocation; caller can take address if needed |
| **Map key or comparison needed**                                    | Pointers compared by address, value types give structural equality        |

#### Receiver Rules

```go
// ✅ Pointer receiver: mutates state, large struct, or contains sync primitives
type Cache struct {
    mu    sync.Mutex
    items map[string]Item
}
func (c *Cache) Set(k string, v Item) { /* mutates */ }

// ✅ Value receiver: small immutable struct
type Point struct{ X, Y int }
func (p Point) Distance() float64 { /* read-only */ }

// ⚠️ Be consistent: if any method needs a pointer receiver, use pointer for all
// methods on that type (unless deliberately mixed for interface reasons).
```

#### Function Parameters

Large struct or need mutation → pointer. Small immutable → value. When in doubt for a read-only function, **prefer value** — communicates immutability and avoids nil-dereference risk.

### 4. Discovering Go Documentation and Types

Use `go doc` to discover types, functions, and signatures before implementing.

#### List available types and functions

```bash
go doc <package>
```

Shows all exported types and functions. Look for constructors, Args structs, result types.

#### Get details on a specific type or function

```bash
go doc <package> <type/func name>
```

Shows signature, documentation, all struct fields with types and tags.

#### Workflow with external packages

1. **Find the right package**
2. **List available resources** — `go doc <package>`
3. **Choose the resource** — identify the constructor (e.g., `NewInstance`)
4. **Get Args struct details** — `go doc <package> <ResourceType>Args`
5. **Understand the return type** — `go doc <package> <ResourceType>`
6. **Implement with correct types** — use exact field names, types, and struct tag names

#### Common patterns

- Constructors: `New<ResourceType>(ctx, name, args, opts...)`
- Args structs use pointer types for optional fields
- Output fields use typed outputs (e.g., `StringOutput`, `IntOutput`)
- Resource IDs are auto-managed; avoid hardcoding IDs
