# Permission Request

Gates every tool call with a 4-option prompt: Allow, Deny, Always Approve, Approve in Session.

Decision order for each tool call:
1. **Agent metadata** `tools` section (passed via `PI_AGENT_TOOL_PERMISSIONS` env var for subagents)
2. **Custom settings** `tools` section in `custom-settings.yaml`
3. **Default** to `ask` (show prompt)

## Settings (`tools` in `custom-settings.yaml`)

```yaml
tools:
  read: allow
  write: allow
  edit: allow
  mcp_atlassian_*: deny   # wildcard matching
  bash:
    ls: allow
    rg: allow
    rm: deny
    git diff: allow
```

| Key | Type | Description |
|-----|------|-------------|
| `tools.<tool>` | `allow \| deny \| ask` | Tool permission. `ask` means prompt. |
| `tools.bash` | `Record<string, allow \| deny \| ask>` | Bash command permissions (word-prefix matching). |

### Migration from `always_approve`

The old `always_approve` format is automatically migrated to `tools` on load if the `tools` key is in the new format:

```yaml
# Old
always_approve:
  tools: [read, write]
  bashCommands: [ls, cat]

# → Migrated to
tools:
  read: allow
  write: allow
  bash:
    ls: allow
    cat: allow
```

## Agent Metadata

Agents can define tool permissions in markdown frontmatter:

```markdown
---
name: atlassian
description: Atlassian specialist
mode: subagent
model: claude-sonnet-4-5
tools:
  bash: allow
  mcp_atlassian_*: allow
---
```

Permissions in agent metadata take precedence over custom-settings.yaml.

## Wildcards

Tool names support `*` wildcard matching:

- `mcp_atlassian_*` matches `mcp_atlassian_getpage`, `mcp_atlassian_search`, etc.
- `*` matches all tools
- Exact names match without wildcards
