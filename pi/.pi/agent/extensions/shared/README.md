# Shared

Utility module — not a real extension. Provides shared config, path guard, and command utilities.

| Module | Purpose |
|--------|---------|
| `config.ts` | Load/save `custom-settings.yaml` |
| `path-guard.ts` | `isPathAllowed()`, `isEnvFile()`, `expandPath()` |
| `command-utils.ts` | `extractAllCommandSegments()`, `isCommandApproved()`, `findRmIndex()` |

## Config Interface (`config.ts`)

```typescript
interface CustomSettings {
  always_approve?: AlwaysApproveConfig;
  subagent?: SubagentConfig;
  tools?: ToolsConfig;
  [key: string]: unknown; // extensible
}
```
