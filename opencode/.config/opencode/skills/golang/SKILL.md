# Go (Golang) Skill

## Purpose

This skill provides specialized instructions and workflows for Go/Golang programming tasks including debugging, testing, building, and code organization.

## Key Workflows

### 1. Code Organization

- Organize code into packages following Go conventions
- Keep `main` package simple, put logic in separate packages

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

After implementing Go code, follow these steps to ensure code quality:

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
   Apply formatting tools in the following order:
   - **golines**: Break long lines appropriately
     ```bash
     golines -w .
     ```
   - **gofmt**: Standard Go formatting
     ```bash
     gofmt -w .
     ```
   - **gofumpt**: Stricter formatting than gofmt
     ```bash
     gofumpt -w .
     ```
   - **goimports**: Organize imports and fix missing/unused imports
     ```bash
     goimports -w .
     ```

4. **Run Linter**

   ```bash
   golangci-lint run ./...
   ```

   - Fix any linting issues reported
   - Mark any false positives with `//nolint` comments, but use sparingly and add justifying comments for why the lint is being ignored
   - Ensure code follows best practices and conventions

5. **Run Static Analysis Tools**
   - **govet**: Examines Go source code and reports suspicious constructs
     ```bash
     go vet ./...
     ```

### 4. Common Issues and Solutions

## When to Use This Skill

- Writing or debugging Go applications
- Setting up Go projects and dependencies
- Running tests and building binaries
- Troubleshooting Go-specific issues
