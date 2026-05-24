# Permission Request

Gates every tool call with a 4-option prompt: Allow, Deny, Always Approve, Approve in Session.

For compound bash commands (`&&`, `;`, `|`), **all** segments must be approved. Matching uses word-prefix.

## Settings (`always_approve` in `custom-settings.yaml`)

```yaml
always_approve:
  tools: [read, write, edit, subagent, question]
  bashCommands: [find, ls, grep, cat, cd, pwd, rg, mkdir, git diff, git status, ...]
```

| Key | Type | Description |
|-----|------|-------------|
| `always_approve.tools` | `string[]` | Tools always allowed |
| `always_approve.bashCommands` | `string[]` | Bash commands always allowed (word-prefix match) |
