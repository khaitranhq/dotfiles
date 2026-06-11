# Subagent

Spawns separate `pi` processes for subagent invocation with isolated context.
Also handles **tool permission gating** (formerly the `permission-request` extension),
**desktop notifications**, and **active tool management** for primary agents.

**Modes:** Single, Parallel (max 8, 4 concurrent), Chain (`{previous}` placeholder).

Agent definitions in `~/.pi/agent/custom-settings.yaml` under the `agents` key.

Built-in default primary agent: **pi** (always available, no config needed).

## Features

| Feature                     | Description                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| **Subagent spawning**       | Single, parallel, and chain modes for delegating tasks                   |
| **Primary agent switching** | Switch active agent via `/agent <name>`                                  |
| **Permission gating**       | Runtime prompt for tools set to "ask" in permissions                     |
| **Desktop notifications**   | Toast notifications for permission requests, questions, and agent idle   |
| **Active tool management**  | Denied tools are removed from active tools (not just blocked at runtime) |
| **Session approvals**       | Temporarily approve tools for the current session                        |
| **Persistent approvals**    | "Always approve" saves to `custom-settings.yaml`                         |

## Agent Config Format

```yaml
# In custom-settings.yaml:
agents:
  coder:
    mode: subagent | primary # required
    description: Brief description # required
    model: claude-sonnet-4-5 # optional model override
    tools: # optional
      - read # array of tool names, or
      # read: allow              # permission map (allow/deny/ask)
    prompt: | # required — supports ${file:/path/to/prompt.md}
      You are a coder subagent...
```

### Prompt File References

Use `${file:/absolute/path/to/prompt.md}` or `${file:relative/path.md}` (relative to the YAML file) to pull prompt content from an external file:

```yaml
agents:
  my-agent:
    mode: subagent
    description: Agent with external prompt
    prompt: |
      ${file:/home/user/prompts/my-agent.md}
```

## Commands

| Command         | Description                    |
| --------------- | ------------------------------ |
| `/agent <name>` | Switch primary agent           |
| `/agent pi`     | Reset to default primary agent |
| `/agent`        | List available primary agents  |

## Tool Restrictions

Each agent can specify a `tools` list in their definition to limit available tools.
For subagents, these are passed as `--tools` when spawning the pi subprocess.
For primary agents, `pi.setActiveTools()` is applied on switch.

## Desktop Notifications

Sends desktop toast notifications for key events:

| Event               | Trigger                                    |
| ------------------- | ------------------------------------------ |
| Permission required | "🔐 Permission required" prompt displayed  |
| Question by LLM     | LLM calls the `question` tool              |
| Agent done          | Primary agent finishes processing a prompt |

Windows only — skipped on all other platforms.

## Tool Permissions

Tool permissions are defined in `custom-settings.yaml` under the `tools` key:

```yaml
tools:
  read: allow
  write: allow
  edit: allow
  mcp_atlassian_*: deny # wildcard support
  bash:
    ls: allow
    rg: allow
    rm: deny
```

| Key            | Type                                   | Description                                      |
| -------------- | -------------------------------------- | ------------------------------------------------ |
| `tools.<tool>` | `allow \| deny \| ask`                 | Tool permission. `ask` means prompt.             |
| `tools.bash`   | `Record<string, allow \| deny \| ask>` | Bash command permissions (word-prefix matching). |

### Decision Order

1. **Agent config** (from agent definition `tools` field or `PI_AGENT_TOOL_PERMISSIONS` env var)
2. **Global config** (`custom-settings.yaml` `tools` key)
3. **Default** — `ask` (show prompt)

### Permission Prompt

When a tool call requires approval (`ask`), the user sees:

- **Allow** — Execute this one call
- **Deny (with reason)** — Block, optionally providing a reason
- **Always approve** — Allow and persist to custom settings
- **Approve in this session only** — Allow for the rest of this session

### Active Tools

Tools with `deny` permission are **removed from active tools** on session start.
They will not appear in the agent's tool list. Tools with `allow` or `ask` remain active.
