# Shared

Utility module — not a real extension. Provides shared config, path guard, command utilities, env interpolation, text utilities, async helpers, and tool permission resolution.

## Consumer map

| Module             | Used by                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `config.ts`        | mcp, permission-request, subagent, web-search                                      |
| `path-guard.ts`    | defender                                                                            |
| `command-utils.ts` | defender, permission-request, subagent                                             |
| `env-utils.ts`     | mcp                                                                                 |
| `async-utils.ts`   | mcp (re-exported via `mcp/core/utils.ts`)                                          |
| `text-utils.ts`    | mcp                                                                                 |
| `tool-permissions.ts` | permission-request, subagent                                                     |

## Modules

### `config.ts` — Settings loader

Load/save `~/.pi/agent/custom-settings.yaml` (auto-migrates legacy JSON).

| Export                      | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `getAgentDir()`             | `~/.pi/agent` directory path                              |
| `getAgentPath(...segments)` | Join segments under agent dir                             |
| `configPath()`              | Full path to `custom-settings.yaml`                       |
| `loadCustomSettings()`      | Parse and return settings object                          |
| `saveCustomSettings(s)`     | Write settings back (atomic)                              |
| `updateCustomSettings(fn)`  | Read-modify-write helper                                  |
| `loadSubagentConfig()`      | `settings.subagent` with defaults                         |
| `loadAgentsConfig()`        | `settings.agents` with `${file:...}` resolution           |
| `loadToolPermissions()`     | `settings.tools` as `ToolPermissions`                     |
| `resolveFileRefs(yaml, dir)` | Replace `${file:/path}` refs with file content          |

**Types**: `CustomSettings`, `SubagentConfig`, `ToolPermission`, `BashPermissions`, `ToolPermissions`, `McpYamlServer`, `McpYamlConfig`, `AgentYamlDefinition`, `AgentsConfig`

### `path-guard.ts` — Safe path validation

Gates filesystem access to allowed prefixes (`$HOME`, `/tmp`).

| Export                         | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| `HOME_DIR`                     | Resolved home directory constant                     |
| `DEFAULT_ALLOWED_PREFIXES`     | `[$HOME, /tmp]` (absolute)                           |
| `ENV_FILE_RE`                  | Regex matching `.env` file paths                     |
| `expandPath(raw)`              | Expand `~`, `$HOME`, `${HOME}` tokens                |
| `normalizePath(raw, cwd?)`     | Resolve relative paths against cwd                   |
| `isPathAllowed(raw, cwd?, prefixes?)` | Check if path is within allowed prefixes      |
| `isEnvFile(raw)`               | Check if path matches .env pattern                   |

### `command-utils.ts` — Shell command parsing

Tree-sitter–based bash command introspection.

| Export                        | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `COMMAND_SEPARATORS`          | Set of shell separators (`&&`, `\|\|`, `;`, `\|`, `&`)  |
| `extractBaseCommand(cmd)`     | First base command name (e.g. `"git diff" → "git"`)     |
| `extractAllBaseCommands(cmd)` | All base command names across compound chains           |
| `extractAllCommandSegments(cmd)` | Full segment texts (e.g. `"cd /tmp && git diff"`)   |
| `extractCommandBasis(seg)`    | Command + subcommand, flags/paths stripped              |
| `isCommandApproved(seg, set)` | Bidirectional word-prefix matching against allow-list   |
| `findRmIndex(tokens)`         | Index of `rm` in tokenised command (skips prefixes)     |
| `extractRmPaths(cmd)`         | Target paths from `rm` invocation                       |
| `wildcardToRegex(pattern)`    | Convert `*` glob to RegExp                              |
| `matchesToolPattern(name, set)` | Check tool name against wildcard patterns            |

### `env-utils.ts` — Environment variable interpolation

| Export                        | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `interpolateEnvVars(value)`   | Replace `${VAR}`, `${VAR:-default}`, `$env:VAR`      |
| `interpolateEnvRecord(obj)`   | Apply `interpolateEnvVars` to every value in a record|
| `resolveConfigPath(value)`    | Expand `~` and env vars in path strings              |

### `async-utils.ts` — Concurrency control

| Export                        | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `parallelLimit(items, n, fn)` | Run async fn over items with concurrency limit       |

### `text-utils.ts` — Text helpers

| Export                        | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `truncateAtWord(text, target)`| Truncate to ~target chars at word boundary           |

### `tool-permissions.ts` — Permission resolution

Shared between `permission-request` and `subagent`.

| Export                            | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `isToolPermissions(obj)`          | Type guard for `ToolPermissions` map              |
| `lookupPermission(name, perms)`   | Look up tool name with wildcard support           |
| `resolveBashPermission(cmd, perms)` | Resolve bash command against `bash` sub-map    |
| `addToolPermission(settings, name, perm)` | Immutable add to `tools` map            |
| `addBashPermission(settings, cmd, perm)` | Immutable add to `bash` sub-map          |
