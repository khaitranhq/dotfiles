# Custom Settings & Commands Guide

Configuration for pi extensions installed at `~/.pi/agent/extensions/` (source: `.pi/agent/extensions/`).

---

## Configuration File

All extension settings live in **`~/.pi/agent/custom-settings.yaml`** (YAML format, migrated automatically from legacy `custom-settings.json` on first load).

The shared config module (`.pi/agent/extensions/shared/config.ts`) provides a central loader — all extensions read from this single file.

**Location:** `~/.pi/agent/custom-settings.yaml`

> Project-local equivalent: `.pi/agent/custom-settings.yaml` (not currently used by these extensions; settings are global only).

---

## Extension Overview

| Extension                                 | Purpose                                              | Settings                                       | Commands                                  |
| ----------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| [permission-request](#permission-request) | Tool execution gates                                 | `always_approve`                               | —                                         |
| [defender](#defender)                     | Block dangerous ops                                  | — (hardcoded)                                  | —                                         |
| [subagent](#subagent)                     | Subagent & primary agent orchestration               | `subagent`, `tools`, `always_approve.subagent` | `/agent`                                  |
| [mcp](#mcp)                               | MCP server integration                               | `mcp`                                          | `/mcp-status`, `/mcp-reload`, `/mcp-auth` |
| [input-ux](#input-ux)                     | `@` mention autocomplete & input history             | —                                              | —                                         |
| [question](#question)                     | Interactive questions tool                           | —                                              | —                                         |
| [notification](#notification)             | Desktop toast notifications                          | —                                              | —                                         |
| [shared](#shared)                         | Shared utilities (config, path-guard, command-utils) | —                                              | —                                         |

---

## Permission Request

**File:** `.pi/agent/extensions/permission-request/index.ts`

Gates every tool call. If a tool or bash command is not in the `always_approve` list, the user sees a 4-option prompt:

1. **Allow** — execute this one call
2. **Deny (with reason)** — block, optionally providing a reason
3. **Always approve** — allow and persist to `custom-settings.yaml`
4. **Approve in this session** — allow for the rest of this session

For compound bash commands (`&&`, `;`, `|`, `||`, `&`), **ALL** segments must be approved. Matching uses word-prefix: `"git diff"` matches `"git diff --cached"` but not `"git log"`.

### Settings

```yaml
always_approve:
  tools:
    - read
    - write
    - edit
    - subagent
    - question
  bashCommands:
    - find
    - ls
    - grep
    - cat
    - cd
    - pwd
    - rg
    - mkdir
    - git diff
    - git status
    - git log
    - git branch
    - go test
    - go build
    - go vet
    - npx tsc
    - yq
    - yamllint
```

| Key                           | Type       | Description                                         |
| ----------------------------- | ---------- | --------------------------------------------------- |
| `always_approve.tools`        | `string[]` | Tool names always allowed without prompt            |
| `always_approve.bashCommands` | `string[]` | Bash commands always allowed (word-prefix matching) |

### Commands

None. The extension works transparently — no slash commands needed.

---

## Defender

**File:** `.pi/agent/extensions/defender/index.ts`

Blocks dangerous bash commands and prevents reading/writing files outside `$HOME`. Relative paths are resolved against the current working directory. When a command is blocked, also sends a steering instruction telling the agent NOT to try workarounds.

**Protected operations:**

- `rm` targeting files outside `$HOME` (except `/tmp` — always allowed)
- `sudo`, `chmod`, `chown`, `dd`, `mkfs`, `fdisk`, `shutdown`, `reboot`
- Workaround patterns: `find ... -delete`, `find ... -exec rm`, `xargs rm`
- Read tool: any file outside `$HOME` (except `/tmp`)
- Write/Edit tools: any file outside `$HOME` (except `/tmp`)
- Any `.env` or `.*.env` file (read and write)

### Settings

No custom settings. Allowed prefixes are hardcoded in `shared/path-guard.ts`:

```typescript
export const DEFAULT_ALLOWED_PREFIXES = [HOME_DIR, "/tmp"];
```

Modify `DEFAULT_ALLOWED_PREFIXES` in the source if you need different boundaries.

### Commands

None.

---

## Subagent

**File:** `.pi/agent/extensions/subagent/index.ts`

Spawns separate `pi` processes for subagent invocation with isolated context. Supports three modes:

- **Single:** `{ agent: "name", task: "..." }`
- **Parallel:** `{ tasks: [{ agent: "name", task: "..." }, ...] }` (max 8 tasks, 4 concurrent)
- **Chain:** `{ chain: [{ agent: "name", task: "... {previous} ..." }, ...] }`

Agent definitions live in markdown files with YAML frontmatter:

- `~/.pi/agent/agents/*.md` (user-level)
- `.pi/agents/*.md` (project-level, travelled up from cwd)

### Settings

```yaml
subagent:
  defaultScope: "both"
  confirmProjectAgents: true

tools:
  global:
    allow: [read, bash, edit, write]
  agents:
    code-reviewer:
      allow: [read, grep, find, ls]
    planner:
      deny: [write]

always_approve:
  subagent:
    defaultScope: "both"
    confirmProjectAgents: false
```

| Key                             | Type                                | Default  | Description                                                                        |
| ------------------------------- | ----------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `subagent.defaultScope`         | `"user"` \| `"project"` \| `"both"` | `"user"` | Which agent directories to use                                                     |
| `subagent.confirmProjectAgents` | `boolean`                           | `true`   | Prompt before running project-local agents                                         |
| `tools.global.allow`            | `string[]`                          | —        | Whitelist: only these tools for primary agent + all subagents                      |
| `tools.global.deny`             | `string[]`                          | —        | Blacklist: block these tools globally (`allow` takes precedence)                   |
| `tools.agents.<name>.allow`     | `string[]`                          | —        | Per-agent whitelist (overrides agent's default tools from .md frontmatter)         |
| `tools.agents.<name>.deny`      | `string[]`                          | —        | Per-agent blacklist                                                                |
| `always_approve.subagent`       | `object`                            | —        | Defaults for the `subagent` tool when called by the LLM (same shape as `subagent`) |

### Commands

#### `/agent <name>`

Switch to a different primary agent.

```bash
/agent coder          # Switch to the coder primary agent
/agent                # List available primary agents
```

Primary agents are defined in markdown files with `mode: primary` in frontmatter.

### Tool Override Resolution

When a subagent spawns, its effective tool list is computed by layering three sources:

1. **Agent defaults** — `tools:` field in the agent's `.md` frontmatter (or all tools if unset)
2. **Per-agent override** — `tools.agents.<name>` in `custom-settings.yaml` (`allow` replaces, `deny` filters)
3. **Global override** — `tools.global` in `custom-settings.yaml` (`allow` restricts, `deny` filters)

Global `allow` also restricts the primary agent's tools immediately (via `setActiveTools`).

Changes to `custom-settings.yaml` take effect on next session start or after `/reload`.

### Agent Definition Format

`.pi/agents/<name>.md` (project-local) or `~/.pi/agent/agents/<name>.md` (user-level):

```markdown
---
name: coder
description: General-purpose coding subagent with full tool capabilities
mode: subagent
model: claude-sonnet-4-5
tools: read,bash,write,edit,grep,find,ls
---

System prompt body here. This is the agent's instructions.
```

| Field         | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `name`        | ✅       | Agent name (used in `@agent` and tool calls)   |
| `description` | ✅       | Short description (shown in agent lists)       |
| `mode`        | ❌       | `subagent` (default) or `primary`              |
| `model`       | ❌       | Model override (`provider/model-id`)           |
| `tools`       | ❌       | Comma-separated tool list (default: all tools) |

---

## MCP (Model Context Protocol)

**File:** `.pi/agent/extensions/mcp/index.ts`

Connects to MCP servers (stdio & SSE transports) and registers their tools as pi tools the LLM can call. Token efficiency features: truncated results (10KB/500 lines), lazy schema conversion, connection reuse.

### Settings

```yaml
mcp:
  toolPrefix: "mcp"
  maxResultBytes: 10240
  maxResultLines: 500
  reconnectEnabled: true
  reconnectMaxRetries: 3
  servers:
    - name: "filesystem"
      transport: "stdio"
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      enabled: true

    - name: "jira"
      transport: "http"
      url: "https://jira.example.com/mcp"
      oauth:
        enabled: true
        scopes:
          - "read:jira-work"
          - "write:jira-work"
      enabled: true
```

| Key                       | Type      | Default | Description                                |
| ------------------------- | --------- | ------- | ------------------------------------------ |
| `mcp.toolPrefix`          | `string`  | `"mcp"` | Prefix for registered tool names           |
| `mcp.maxResultBytes`      | `number`  | `10240` | Max result bytes before truncation (10 KB) |
| `mcp.maxResultLines`      | `number`  | `500`   | Max result lines before truncation         |
| `mcp.reconnectEnabled`    | `boolean` | `true`  | Attempt reconnection on failure            |
| `mcp.reconnectMaxRetries` | `number`  | `3`     | Max reconnection attempts                  |
| `mcp.servers`             | `array`   | `[]`    | MCP server configurations                  |

**Server config fields:**

| Field       | Type                  | Required | Description                               |
| ----------- | --------------------- | -------- | ----------------------------------------- |
| `name`      | `string`              | ✅       | Unique server name                        |
| `transport` | `"stdio"` \| `"http"` | ✅       | Transport type                            |
| `enabled`   | `boolean`             | ❌       | Set to `false` to skip this server        |
| `timeout`   | `number`              | ❌       | Connection timeout in ms (default: 30000) |

**Stdio transport:**

| Field     | Type       | Required | Description       |
| --------- | ---------- | -------- | ----------------- |
| `command` | `string`   | ✅       | Command to spawn  |
| `args`    | `string[]` | ❌       | Command arguments |

**HTTP (SSE) transport:**

| Field                  | Type       | Required | Description                 |
| ---------------------- | ---------- | -------- | --------------------------- |
| `url`                  | `string`   | ✅       | MCP server URL              |
| `oauth.enabled`        | `boolean`  | ❌       | Enable OAuth authentication |
| `oauth.scopes`         | `string[]` | ❌       | OAuth scopes to request     |
| `oauth.tokenStorePath` | `string`   | ❌       | Custom token storage path   |

### Commands

#### `/mcp-status`

Show connection status and registered tools for all MCP servers.

```bash
/mcp-status
```

Output: server name, version, connected tools list.

#### `/mcp-reload`

Reload MCP configuration and reconnect to all servers. Disconnects all existing connections first, then reloads `custom-settings.yaml`.

```bash
/mcp-reload
```

#### `/mcp-auth`

Manage OAuth authentication for MCP servers.

```bash
/mcp-auth                              # Show OAuth status for all servers
/mcp-auth login <server-name>          # Start OAuth login flow
/mcp-auth logout <server-name>         # Clear stored OAuth tokens
```

For single-server setups, `<server-name>` can be omitted.

### Registered Tool Naming

Tools from an MCP server named `jira` with prefix `mcp` become:

- `mcp_jira_getissue`
- `mcp_jira_searchissues`
- etc.

The format is: `<prefix>_<server>_<tool>` (sanitized: lowercase, `[^a-zA-Z0-9_]` → `_`).

---

## Input UX

**File:** `.pi/agent/extensions/input-ux/index.ts`

Provides unified input experience:

- **`@mention` autocomplete** — fuzzy match agents, files, and directories
- **`@mention` input transform** — `@codereview ...` → delegates to subagent, `@src/...` → reads/inspects
- **Cwd-scoped input history** — per-directory prompt history on `↑`/`↓`

### Settings

No custom settings. All defaults are hardcoded in the extension source.

### Commands

None.

### Usage

Type `@` in the input editor to trigger autocomplete with fuzzy matching:

| Prefix    | Matches         | Inserted               |
| --------- | --------------- | ---------------------- |
| `@agent ` | Subagent names  | Delegation instruction |
| `@file `  | File paths      | Read instruction       |
| `@dir `   | Directory paths | Inspect instruction    |

History is per-directory — each project has its own prompt history stored in `~/.pi/agent/input-history.json`.

---

## Question

**File:** `.pi/agent/extensions/question/index.ts`

Registers a `question` tool that lets the LLM ask the user structured questions. Supports three question types with tab-based navigation for multi-question sets.

**Question types:**

- **input** — free text
- **select** — single choice from options
- **multi_select** — multiple choices from options

### Settings

No custom settings.

### Commands

None (tool-only, no slash commands).

### LLM Tool Usage

The LLM calls the `question` tool with:

```json
{
  "questions": [
    {
      "id": "scope",
      "label": "Scope",
      "prompt": "What scope should this change have?",
      "type": "select",
      "options": [
        { "value": "full", "label": "Full refactor" },
        { "value": "partial", "label": "Targeted fix" }
      ],
      "allowOther": true
    }
  ]
}
```

---

## Notification

**File:** `.pi/agent/extensions/notification/index.ts`

Sends desktop toast notifications on Windows when the agent finishes processing a prompt. Non-Windows systems are skipped.

### Settings

No custom settings.

### Commands

None.

### Exported API

```typescript
import { notifyPermissionRequired } from "../notification/index";

// Called by permission-request extension
notifyPermissionRequired("bash: rm -rf /dangerous");
```

---

## Shared

**File:** `.pi/agent/extensions/shared/index.ts`

Utility module — not a real extension (empty default export). Provides:

| Module             | Purpose                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `config.ts`        | Load/save `custom-settings.yaml`, `always_approve`, `subagent` config                       |
| `path-guard.ts`    | Path validation: `isPathAllowed()`, `isEnvFile()`, `expandPath()`                           |
| `command-utils.ts` | Bash command parsing: `extractAllCommandSegments()`, `isCommandApproved()`, `findRmIndex()` |

### Settings

The config module defines the `CustomSettings` interface:

```typescript
export interface CustomSettings {
  always_approve?: AlwaysApproveConfig;
  subagent?: SubagentConfig;
  tools?: ToolsConfig;
  [key: string]: unknown; // Extensible for other extensions (e.g., "mcp")
}

export interface AlwaysApproveConfig {
  tools?: string[];
  bashCommands?: string[];
}

export interface SubagentConfig {
  defaultScope?: "user" | "project" | "both";
  confirmProjectAgents?: boolean;
}

export interface AgentToolOverride {
  allow?: string[];
  deny?: string[];
}

export interface ToolsConfig {
  global?: AgentToolOverride;
  agents?: Record<string, AgentToolOverride>;
}
```

---

## Full Example Configuration

```yaml
# ~/.pi/agent/custom-settings.yaml

# ── Permission Request ─────────────────────────────────────────────
always_approve:
  tools:
    - read
    - write
    - edit
    - subagent
    - question
  bashCommands:
    - find
    - ls
    - grep
    - cat
    - cd
    - pwd
    - rg
    - mkdir
    - which
    - echo
    - git diff
    - git status
    - git log
    - git branch
    - git show
    - go test
    - go build
    - go vet
    - gofmt
    - npx tsc
    - yq
    - yamllint
  subagent:
    defaultScope: "both"
    confirmProjectAgents: false

# ── Subagent ───────────────────────────────────────────────────────
subagent:
  defaultScope: "both"
  confirmProjectAgents: true

# ── Tool Toggles ───────────────────────────────────────────────────
tools:
  global:
    allow:
      - read
      - bash
      - edit
      - write
      - grep
      - find
      - ls
      - subagent
      - question
  agents:
    code-reviewer:
      allow:
        - read
        - grep
        - find
        - ls
    planner:
      deny:
        - write

# ── MCP ────────────────────────────────────────────────────────────
mcp:
  toolPrefix: "mcp"
  maxResultBytes: 10240
  maxResultLines: 500
  reconnectEnabled: true
  reconnectMaxRetries: 3
  servers:
    - name: "jira"
      transport: "http"
      url: "https://jira.example.com/mcp"
      oauth:
        enabled: true
        scopes:
          - "read:jira-work"
          - "write:jira-work"
      enabled: true

    - name: "github"
      transport: "stdio"
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      enabled: false
```

---

## Keybindings

Keybindings are configured separately in `~/.pi/agent/keybindings.json` (not `custom-settings.yaml`).

```json
{
  "tui.select.up": ["up", "ctrl+p"],
  "tui.select.down": ["down", "ctrl+n"],
  "app.model.cycleForward": []
}
```

See [keybindings.md](https://github.com/earendil-works/pi-mono/blob/main/docs/keybindings.md) for the full list of available keybinding IDs.

---

## Slash Commands Reference

| Command                             | Extension | Description                     |
| ----------------------------------- | --------- | ------------------------------- |
| `/agent <name>`                     | subagent  | Switch primary agent            |
| `/mcp-status`                       | mcp       | Show MCP server status          |
| `/mcp-reload`                       | mcp       | Reload MCP config and reconnect |
| `/mcp-auth [status\|login\|logout]` | mcp       | Manage MCP OAuth authentication |

Built-in pi commands (not from these extensions): `/model`, `/settings`, `/reload`, `/new`, `/resume`, `/fork`, `/clone`, `/compact`, `/tree`, `/skill:name`, `/template`.
