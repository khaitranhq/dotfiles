# Subagent

Spawns separate `pi` processes for subagent invocation with isolated context.

**Modes:** Single, Parallel (max 8, 4 concurrent), Chain (`{previous}` placeholder).

Agent definitions in `~/.pi/agent/custom-settings.yaml` under the `agents` key.

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

## Tool Restrictions

Each agent can specify a `tools` list in their definition to limit available tools.
For subagents, these are passed as `--tools` when spawning the pi subprocess.
For primary agents, `pi.setActiveTools()` is applied on switch.
