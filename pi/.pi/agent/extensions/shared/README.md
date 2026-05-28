# Shared

Utility module — not a real extension. Provides shared config, path guard, command utilities, env interpolation, text utilities, async helpers, and tool permission resolution.

## Consumer map

| Module                | Used by                                   |
| --------------------- | ----------------------------------------- |
| `config.ts`           | mcp, subagent, web-search                 |
| `path-guard.ts`       | defender                                  |
| `command-utils.ts`    | defender, subagent                        |
| `env-utils.ts`        | mcp                                       |
| `async-utils.ts`      | mcp (re-exported via `mcp/core/utils.ts`) |
| `text-utils.ts`       | mcp                                       |
| `tool-permissions.ts` | subagent                                  |

## Modules

### `config.ts` — Settings loader

Load/save `~/.pi/agent/custom-settings.yaml`

#### `Config` class

Primary API. Each instance owns its agent directory and in-memory cache.

| Member (instance)                        | Description                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| `getAgentDir(): string`                  | Agent directory bound to this instance               |
| `getAgentPath(...segments): string`      | Join segments under `agentDir`                       |
| `configPath(): string`                   | Full path to `custom-settings.yaml`                  |
| `loadCustomSettings(): CustomSettings`   | Parse and return cached settings (shallow clone)     |
| `saveCustomSettings(s): void`            | Serialize to YAML and update cache                   |
| `updateCustomSettings(fn): void`         | Atomic read-modify-write helper                      |
| `invalidateConfigCache(): void`          | Force next `loadCustomSettings` to re-read from disk |
| `loadSubagentConfig(): SubagentConfig`   | `settings.subagent` with defaults                    |
| `loadAgentsConfig(): AgentsConfig`       | `settings.agents` with `${file:...}` resolution      |
| `loadToolPermissions(): ToolPermissions` | `settings.tools` as `ToolPermissions`                |

| Static member                       | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `Config.resolveFileRefs(yaml, dir)` | Replace `${file:/path}` refs with file content |

#### Standalone utilities

| Export          | Description                                      |
| --------------- | ------------------------------------------------ |
| `defaultConfig` | Pre-built `Config` singleton (default agent dir) |

**Types**: `CustomSettings`, `SubagentConfig`, `ToolPermission`, `BashPermissions`, `ToolPermissions`, `McpYamlServer`, `McpYamlConfig`, `AgentYamlDefinition`, `AgentsConfig`

### `path-guard.ts` — Safe path validation

Gates filesystem access to allowed prefixes (`$HOME`, `/tmp`).

| Export                                | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `HOME_DIR`                            | Resolved home directory constant         |
| `DEFAULT_ALLOWED_PREFIXES`            | `[$HOME, /tmp]` (absolute)               |
| `ENV_FILE_RE`                         | Regex matching `.env` file paths         |
| `expandPath(raw)`                     | Expand `~`, `$HOME`, `${HOME}` tokens    |
| `normalizePath(raw, cwd?)`            | Resolve relative paths against cwd       |
| `isPathAllowed(raw, cwd?, prefixes?)` | Check if path is within allowed prefixes |
| `isEnvFile(raw)`                      | Check if path matches .env pattern       |

### `command-utils.ts` — Shell command parsing

Tree-sitter–based bash command introspection.

| Export                           | Description                                            |
| -------------------------------- | ------------------------------------------------------ |
| `COMMAND_SEPARATORS`             | Set of shell separators (`&&`, `\|\|`, `;`, `\|`, `&`) |
| `extractBaseCommand(cmd)`        | First base command name (e.g. `"git diff" → "git"`)    |
| `extractAllBaseCommands(cmd)`    | All base command names across compound chains          |
| `extractAllCommandSegments(cmd)` | Full segment texts (e.g. `"cd /tmp && git diff"`)      |
| `extractCommandBasis(seg)`       | Command + subcommand, flags/paths stripped             |
| `isCommandApproved(seg, set)`    | Bidirectional word-prefix matching against allow-list  |
| `findRmIndex(tokens)`            | Index of `rm` in tokenised command (skips prefixes)    |
| `extractRmPaths(cmd)`            | Target paths from `rm` invocation                      |
| `wildcardToRegex(pattern)`       | Convert `*` glob to RegExp                             |
| `matchesToolPattern(name, set)`  | Check tool name against wildcard patterns              |

### `env-utils.ts` — Environment variable interpolation

| Export                      | Description                                           |
| --------------------------- | ----------------------------------------------------- |
| `interpolateEnvVars(value)` | Replace `${VAR}`, `${VAR:-default}`, `$env:VAR`       |
| `interpolateEnvRecord(obj)` | Apply `interpolateEnvVars` to every value in a record |
| `resolveConfigPath(value)`  | Expand `~` and env vars in path strings               |

### `async-utils.ts` — Concurrency control

| Export                        | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `parallelLimit(items, n, fn)` | Run async fn over items with concurrency limit |

### `text-utils.ts` — Text helpers

| Export                         | Description                                |
| ------------------------------ | ------------------------------------------ |
| `truncateAtWord(text, target)` | Truncate to ~target chars at word boundary |

### `tool-permissions.ts` — Permission resolution

Shared between `permission-request` and `subagent`.

| Export                                    | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| `isToolPermissions(obj)`                  | Type guard for `ToolPermissions` map        |
| `lookupPermission(name, perms)`           | Look up tool name with wildcard support     |
| `resolveBashPermission(cmd, perms)`       | Resolve bash command against `bash` sub-map |
| `addToolPermission(settings, name, perm)` | Immutable add to `tools` map                |
| `addBashPermission(settings, cmd, perm)`  | Immutable add to `bash` sub-map             |
