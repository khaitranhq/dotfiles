# Subagent

Spawns separate `pi` processes for subagent invocation with isolated context.

**Modes:** Single, Parallel (max 8, 4 concurrent), Chain (`{previous}` placeholder).

Agent definitions in `~/.pi/agent/agents/*.md` (user) or `.pi/agents/*.md` (project) — markdown with YAML frontmatter.

## Commands

| Command | Description |
|---------|-------------|
| `/agent <name>` | Switch primary agent |
| `/agent` | List available primary agents |

## Settings (`subagent`, `tools`, `always_approve.subagent` in `custom-settings.yaml`)

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

always_approve:
  subagent:
    defaultScope: "both"
    confirmProjectAgents: false
```

### Tool Override Resolution

1. Agent defaults (`tools:` in `.md` frontmatter)
2. Per-agent override (`tools.agents.<name>`)
3. Global override (`tools.global`)
