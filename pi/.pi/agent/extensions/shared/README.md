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
  mcp?: McpYamlConfig;
  tools?: ToolsConfig | ToolPermissions;
  [key: string]: unknown; // extensible
}
```

### MCP Types

```typescript
interface McpYamlConfig {
  servers?: McpYamlServer[];
}

interface McpYamlServer {
  name: string;
  transport?: "http" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  lifecycle?: "keep-alive" | "lazy" | "eager";
  // ...
}
```
