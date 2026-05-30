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

## Member Ordering

Declarations in files and classes must follow this strict top-to-bottom order.

### In Files

1. **Imports** — all `import` statements
2. **Interfaces** — `interface` declarations
3. **Types** — `type` alias declarations
4. **Constants** — `const` declarations
5. **Exported functions / classes** — `export function`, `export class`, `export default`
6. **Internal functions / classes** — non-exported functions and classes

```typescript
// ✅ Correct: imports → interfaces → types → const → export → internal
import { … } from "…";

interface Config { … }

type Status = "active" | "inactive";

const DEFAULT_TIMEOUT = 5000;

export function loadConfig(): Config { … }
export default function entryPoint(): void { … }

function normalizePath(p: string): string { … }
function internalHelper(): void { … }
```

```typescript
// ❌ Incorrect: internal function before export, const before types
import { … } from "…";

function privateHelper(): void { … }  // ← internal before export

const CACHE = new Map();               // ← const before types/interfaces

type Options = { … };

export function publicApi(): void { … }
```

### In Classes

1. **Fields** — instance properties
2. **Constructor** — the class constructor
3. **Static public methods** — `static` methods that are public
4. **Public methods** — public instance methods and accessors (getters/setters)
5. **Private methods** — `private` instance methods

```typescript
// ✅ Correct: fields → constructor → static public → public → private
class Service {
  // Fields
  private cache = new Map<string, unknown>();
  private timeout: number;

  // Constructor
  constructor(timeout: number) {
    this.timeout = timeout;
  }

  // Static public methods
  static create(): Service { … }

  // Public methods
  get status(): string { … }
  async connect(): Promise<void> { … }
  disconnect(): void { … }

  // Private methods
  private async handshake(): Promise<void> { … }
  private cleanup(): void { … }
}
```

```typescript
// ❌ Incorrect: private field after public methods, private methods before public
class Service {
  async connect(): Promise<void> { … }

  private cache = new Map();  // ← field after public method

  private handshake(): Promise<void> { … }  // ← private before public

  disconnect(): void { … }
}
```

### For Extension Entry Points

When a file's primary purpose is an `export default function` that serves as an extension entry point, place it after imports and before supporting declarations (interfaces, types, constants, internal helpers):

```typescript
// ✅ Correct: imports → default export → supporting declarations
import { … } from "…";

export default function (pi: ExtensionAPI) {
  // Entry point implementation
}

// Supporting declarations
interface Options { … }
const HELPERS = [ … ];
function internalUtil(): void { … }
```
