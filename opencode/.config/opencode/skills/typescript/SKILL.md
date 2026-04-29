# TypeScript Skill

Provides specialized instructions and workflows for TypeScript development tasks including type checking, validation, and code quality.

## Validation

TypeScript validation is critical for catching type errors and ensuring code quality before runtime.

### Type Checking

Use `npx tsc --noEmit` to validate TypeScript without generating output JavaScript files. This command:
- Performs full type checking
- Avoids cluttering the project with compiled `.js` files
- Is ideal for CI/CD pipelines and pre-commit hooks
- Should always run successfully before committing changes

### Linting and Formatting

Always run comprehensive checks combining TypeScript type checking with linting and formatting tools:

**Preferred approach (if available):**
```bash
npx tsc --noEmit && npx biome check
```

**Fallback approach (if biome is not available):**
```bash
npx tsc --noEmit && npx prettier --check . && npx eslint .
```

**Minimal approach (if prettier and eslint are not available):**
```bash
npx tsc --noEmit
```

### Validation Workflow

Before committing or requesting review, ensure:
1. Type checking passes: `npx tsc --noEmit`
2. Code quality checks pass (biome, or prettier + eslint, or just tsc)
3. All tests pass (if applicable to the task)

This ensures consistent code quality and prevents runtime type errors.
