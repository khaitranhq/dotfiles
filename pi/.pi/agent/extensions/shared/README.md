# Shared

Utility module — not a real extension. Provides shared config, path guard, and command utilities.

| Module             | Purpose                                                               |
| ------------------ | --------------------------------------------------------------------- |
| `config.ts`        | Load/save `custom-settings.yaml`                                      |
| `path-guard.ts`    | `isPathAllowed()`, `isEnvFile()`, `expandPath()`                      |
| `command-utils.ts` | `extractAllCommandSegments()`, `isCommandApproved()`, `findRmIndex()` |

## Config Interface (`config.ts`)

```typescript
interface CustomSettings {
  always_approve?: AlwaysApproveConfig;
  subagent?: SubagentConfig;
  mcp?: McpYamlConfig;
  agents?: AgentsConfig; // Agent definitions (new)
  tools?: ToolsConfig | ToolPermissions;
  [key: string]: unknown; // extensible
}
```

### Agent Types

```typescript
interface AgentYamlDefinition {
  mode: "subagent" | "primary";
  description: string;
  model?: string;
  tools?: string[] | Record<string, unknown>;
  prompt: string; // Supports ${file:/path/to/prompt.md}
}

type AgentsConfig = Record<string, AgentYamlDefinition>;
```

### Agent Loader

```typescript
// Load agents from custom-settings.yaml `agents` key.
// Resolves ${file:...} references in prompts.
loadAgentsConfig(): AgentsConfig

// Resolve ${file:/path/to/file} references in a YAML string.
resolveFileRefs(yaml: string, baseDir: string): string
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
