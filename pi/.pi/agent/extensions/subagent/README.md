# Subagent

Spawns separate `pi` processes for subagent invocation with isolated context.

**Modes:** Single, Parallel (max 8, 4 concurrent), Chain (`{previous}` placeholder).

Agent definitions in `custom-settings.yaml` under the `agents` key (user-level).
Project-level agents in `.pi/agents.yaml` (walked up from cwd).

Built-in default primary agent: **pi** (always available, no config needed).

## Agent Config Format

```yaml
# In custom-settings.yaml:
agents:
  coder:
    mode: subagent | primary     # required
    description: Brief description # required
    model: claude-sonnet-4-5     # optional model override
    tools:                       # optional
      - read                     # array of tool names, or
      # read: allow              # permission map (allow/deny/ask)
    prompt: |                    # required — supports ${file:/path/to/prompt.md}
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

| Command | Description |
|---------|-------------|
| `/agent <name>` | Switch primary agent |
| `/agent pi` | Reset to default primary agent |
| `/agent` | List available primary agents |

## Settings (`subagent`, `tools` in `custom-settings.yaml`)

```yaml
subagent:
  defaultScope: "both"          # "user" | "project" | "both"
  confirmProjectAgents: true

tools:
  global:
    allow: [read, bash, edit, write]
  agents:
    code-reviewer:
      allow: [read, grep, find, ls]
```

### Tool Override Resolution

1. Agent defaults (`tools:` in agent YAML definition)
2. Per-agent override (`tools.agents.<name>`)
3. Global override (`tools.global`)
