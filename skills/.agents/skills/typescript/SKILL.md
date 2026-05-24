---
name: typescript
description: Provides specialized instructions and workflows for TypeScript development tasks including type checking, validation, and code quality.
license: MIT
metadata:
  author: OpenCode
  version: "1.0.0"
  domain: frontend
  triggers:
    - TypeScript
    - TS
    - types
    - tsc
    - type checking
  role: specialist
  scope: implementation
  output-format: code
---

# TypeScript Skill

## Dependency Versioning

When adding or updating dependencies in `package.json`, always pin exact versions:

- Use exact versions (e.g., `"1.2.3"`) instead of caret ranges (e.g., `"^1.2.3"`)
- Never use `"latest"` or `"*"` as a version specifier
- This ensures reproducible builds and prevents unexpected breaking changes from semver-minor or patch updates

## Validation

TypeScript validation is critical for catching type errors and ensuring code quality before runtime.

### Type Checking

Use `npx tsc --noEmit` to validate TypeScript without generating output JavaScript files. This command:
- Performs full type checking
- Avoids cluttering the project with compiled `.js` files
- Is ideal for CI/CD pipelines and pre-commit hooks
- Should always run successfully before committing changes

### Linting and Formatting

Always run comprehensive checks combining TypeScript type checking with linting and formatting tools.

**Tool priority — detect and use the first matching approach:**

1. **oxlint + oxfmt (required if config exists):** If the project has an oxlint config (`.oxlintrc.json`, `.oxlintrc`, `oxlintrc.json`, `oxlintrc.yaml`, `oxlintrc.yml`, or `oxlint` key in `package.json`) or an oxfmt config (`.oxfmtrc.json`, `.oxfmtrc`, `oxfmtrc.json`, `oxfmtrc.yaml`, `oxfmtrc.yml`, or `oxfmt` key in `package.json`), oxlint and oxfmt are mandatory — use them:
   ```bash
   npx tsc --noEmit && npx oxlint && npx oxfmt --check .
   ```
   If only oxlint config exists, use oxlint; if only oxfmt config exists, use oxfmt. When both exist, use both.

2. **biome (if available):** If biome is configured (e.g. `biome.json`, `biome.jsonc`) and no oxlint/oxfmt config exists:
   ```bash
   npx tsc --noEmit && npx biome check
   ```

3. **prettier + eslint (fallback):** If neither oxlint/oxfmt nor biome is available:
   ```bash
   npx tsc --noEmit && npx prettier --check . && npx eslint .
   ```

4. **tsc only (minimal):** If no linter or formatter is available:
   ```bash
   npx tsc --noEmit
   ```

### Validation Workflow

Before committing or requesting review, ensure:
1. Type checking passes: `npx tsc --noEmit`
2. Code quality checks pass (biome, or prettier + eslint, or just tsc)
3. All tests pass (if applicable to the task)

This ensures consistent code quality and prevents runtime type errors.
