---
name: golang
description: Provides specialized instructions and workflows for Go/Golang programming tasks including code organization, struct design, error handling, testing, and production-grade implementation patterns.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: language
  triggers:
    - Go
    - Golang
    - Go programming
    - Go development
    - Go debugging
  role: specialist
  scope: implementation
  output-format: code
---

# Go (Golang) Skill

## Purpose

This skill provides specialized instructions and workflows for Go/Golang programming tasks including debugging, testing, building, and code organization.

## Key Workflows

### 1. Code Organization

#### Package Structure

- Organize code into packages following Go conventions
- Keep `main` package simple, put logic in separate packages

#### File Organization Order

**⚠️ CRITICAL: This ordering is mandatory and must be consistently applied to all Go source files. Maintaining strict file organization is essential for code maintainability, readability, and consistency across the codebase.**

Go source files must follow this strict order for optimal readability and consistency:

1. **Package declaration** - at the top
2. **Imports** - organized in groups (stdlib, third-party, local)
3. **Constants** - package-level constants
4. **Type definitions** - interfaces first, then structs
5. **Variables** - package-level variables
6. **Functions** - organized by logical grouping

##### Example

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

##### Key Principles

- **Interfaces before implementations** — Readers can understand contracts before seeing implementations
- **Constructors early** — `New*` functions should come before methods that use the type
- **Logical grouping** — Group related functions together (e.g., all `Service` methods, then helper functions)
- **Alphabetical within groups** — Constants and variables within their sections (struct fields in alphabetical order, see section 2)
- **Public before private** — Exported items before unexported ones within each section

### 2. Struct Organization and Design

- **Limit struct fields to 5-7 fields** for optimal readability and maintainability
- **Split large structs** into multiple smaller, focused structs when exceeding this limit
- **Group related fields** logically into separate structs
- **Use composition** to combine smaller structs instead of creating monolithic ones
- **Consider embedding** related structs for cleaner syntax
- Keep **number of small structs as few as possible** to avoid overcomplication
- Struct fields should be ordered in **alphabetical order** for consistency and readability

#### Example: Refactoring a Large Struct

**Before (Hard to maintain):**

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

**After (Well-organized with composition):**

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

Benefits:

- Easier to read and understand each concern
- Reusable components (e.g., `Address` can be used for other entities)
- Better organization of related data
- Improved maintainability and testability

### 3. Post-Implementation Steps

After implementing Go code, follow these steps to ensure code quality. Run every available formatter, linter, and static-analysis tool for the project and toolchain; if a tool is installed and applicable, do not skip it.

1. **Run Tests**

   ```bash
   go test ./...
   ```

   - Run tests for all packages in the project
   - Ensure all tests pass before moving to formatting

2. **Build and Verify Compilation**

   ```bash
   go build -o /dev/null ./...
   ```

   - Verify the code compiles without errors
   - Use `-o /dev/null` to discard the output binary

3. **Format Code**
   **MUST run all available formatters in the following order.** If a formatter is installed and applicable, run it; do not skip one because another formatter already ran.
   - **goimports**: Organize imports and fix missing/unused imports
     ```bash
     goimports -w .
     ```
   - **gofumpt**: Stricter formatting than gofmt
     ```bash
     gofumpt -w .
     ```
   - **gofmt**: Run if it is the only formatter available
     ```bash
     gofmt -w .
     ```

4. **Run Linters**
   - Run every available linter for the project and toolchain
   - `golangci-lint`
     ```bash
     golangci-lint run ./...
     ```
   - Fix any linting issues reported
   - Mark any false positives with `//nolint` comments, but use sparingly and add justifying comments for why the lint is being ignored
   - Ensure code follows best practices and conventions

5. **Run Static Analysis Tools**
   - Run every available static-analysis tool for the project and toolchain
   - **go vet**: Examines Go source code and reports suspicious constructs
     ```bash
     go vet ./...
     ```

### 4. Discovering Go Documentation and Types

When working with Go packages, use `go doc` commands to discover available types, functions, and their correct signatures:

#### List available types and functions in a package

```bash
go doc <package>
```

Example:

```bash
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2
```

This shows all exported types and functions in the package. Look for:

- **Constructors** - functions that create resources or values (e.g., `NewInstance`)
- **Args structs** - e.g., `InstanceArgs` that define properties
- **Result types** - structs returned by constructors (e.g., `*Instance`)

#### Get detailed information about a specific type or function

```bash
go doc <package> <type/func name>
```

Examples:

```bash
# Get details about a constructor function
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2 NewInstance

# Get details about an Args struct
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2 InstanceArgs

# Get details about a resource type
go doc github.com/pulumi/pulumi-aws/sdk/v6/go/aws/ec2 Instance
```

This shows:

- Function/type signature
- Documentation explaining purpose
- All fields in structs with their types and field tags
- Required vs optional parameters

#### Workflow when implementing with external packages

1. **Find the right package** - Determine which package you need (e.g., `pulumi-aws`, `pulumi-gcp`, or standard library packages)
2. **List available resources** - Run `go doc <package>` to see available constructors and types
3. **Choose the resource** - Identify the constructor function (e.g., `NewInstance`)
4. **Get Args struct details** - Run `go doc <package> <ResourceType>Args` to see all available properties
5. **Understand the return type** - Run `go doc <package> <ResourceType>` to see output fields and methods
6. **Implement with correct types** - Use the exact field names, types, and struct tag names from documentation

#### Common patterns

- Constructors typically follow the pattern `New<ResourceType>(ctx, name, args, opts...)`
- Args structs use pointer types for optional fields
- Output fields use typed outputs (e.g., `StringOutput`, `IntOutput`) for lazy evaluation
- Resource IDs are automatically managed; avoid hardcoding IDs

### 5. Common Issues and Solutions

## Constraints

### MUST DO

- **Follow strict File Organization Order** — Always organize Go source files with package declaration, imports, constants, types (interfaces first), variables, then functions in logical grouping. This is mandatory for consistency and maintainability
- **Add context.Context to all blocking operations** — Pass context through the call stack to enable graceful cancellation and timeout handling
- **Handle all errors explicitly** — Never use naked returns; return errors or use explicit error handling
- **Write table-driven tests with subtests** — Use `t.Run()` for parametrized tests; enables better test isolation and reporting
- **Propagate errors with fmt.Errorf("%w", err)** — Use error wrapping to preserve error chain for debugging
- **Use errors.New("") for sentinel errors** — Create package-level error variables for error comparison
- **Define clear interface contracts** — Keep interfaces small and focused; design around behavior, not implementation
- **Run all post-implementation steps** — Format, lint, test, and verify before committing
- **Document exported functions and types** — Add clear documentation comments for all public API
- **Use `go doc` commands** — Discover correct types, functions, and signatures before implementing with external packages

### MUST NOT DO

- **Ignore errors** — Avoid `_ = ` assignments without explicit justification; handle or propagate all errors
- **Use panic for normal error handling** — Reserve panic for truly exceptional conditions; use errors for control flow
- **Hardcode values** — Use configuration files, constants, or environment variables instead of hardcoded values
- **Create goroutines without lifecycle management** — Always ensure goroutines can be cancelled or have bounded lifetime

## Error Handling Example

```go
// Sentinel error for reuse
var ErrNotFound = errors.New("item not found")

func fetchUser(ctx context.Context, id string) (*User, error) {
    // Check context cancellation
    if err := ctx.Err(); err != nil {
        return nil, fmt.Errorf("fetch user: %w", err)
    }

    // Do work...
    user, err := db.GetUser(ctx, id)
    if err != nil {
        // Wrap errors with context
        if errors.Is(err, sql.ErrNoRows) {
            return nil, fmt.Errorf("fetch user %s: %w", id, ErrNotFound)
        }
        return nil, fmt.Errorf("fetch user %s: %w", id, err)
    }

    return user, nil
}
```

## Table-Driven Tests Example

```go
func TestFetchUser(t *testing.T) {
    tests := []struct {
        name    string
        userID  string
        want    *User
        wantErr bool
        errType error
    }{
        {
            name:   "valid user",
            userID: "123",
            want:   &User{ID: "123", Name: "John"},
        },
        {
            name:    "not found",
            userID:  "999",
            wantErr: true,
            errType: ErrNotFound,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctx := context.Background()
            got, err := fetchUser(ctx, tt.userID)

            if tt.wantErr {
                if !errors.Is(err, tt.errType) {
                    t.Fatalf("got error %v, want %v", err, tt.errType)
                }
                return
            }

            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }

            if got.ID != tt.want.ID {
                t.Errorf("got ID %s, want %s", got.ID, tt.want.ID)
            }
        })
    }
}
```

## Interface Design Guidelines

```go
// Good: Small, focused interfaces
type Reader interface {
    Read(ctx context.Context, key string) ([]byte, error)
}

type Writer interface {
    Write(ctx context.Context, key string, value []byte) error
}

// Composition over large interfaces
type Store interface {
    Reader
    Writer
}

// Avoid: Large monolithic interfaces
type BadStore interface {
    Read(key string) ([]byte, error)
    Write(key string, value []byte) error
    Delete(key string) error
    List() ([]string, error)
    Exists(key string) bool
    // ... many more methods
}
```

## When to Use This Skill

- Writing or debugging Go applications
- Setting up Go projects and dependencies
- Running tests and building binaries
- Troubleshooting Go-specific issues
