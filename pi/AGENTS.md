# AGENTS.md — Pi Extensions

## Mandatory: Update README.md on Extension Changes

When modifying any extension under `~/.pi/agent/extensions/`, you **MUST** update the corresponding `README.md` in that extension's folder.

### Extensions and their READMEs

| Extension | README |
|-----------|--------|
| `permission-request` | `~/.pi/agent/extensions/permission-request/README.md` |
| `defender` | `~/.pi/agent/extensions/defender/README.md` |
| `subagent` | `~/.pi/agent/extensions/subagent/README.md` |
| `mcp` | `~/.pi/agent/extensions/mcp/README.md` |
| `web-search` | `~/.pi/agent/extensions/web-search/README.md` |
| `input-ux` | `~/.pi/agent/extensions/input-ux/README.md` |
| `question` | `~/.pi/agent/extensions/question/README.md` |
| `notification` | `~/.pi/agent/extensions/notification/README.md` |
| `shared` | `~/.pi/agent/extensions/shared/README.md` |

### What to update

- **New setting added** → add to README settings table/YAML example
- **Setting removed/retyped** → update README accordingly
- **New command added** → add to commands table
- **Behavior change** → reflect in description

### README format

Keep it brief. Each README should cover:

1. **Purpose** — 1-2 lines
2. **Settings** — key YAML example + table of supported keys
3. **Commands** — slash commands table (if any)

The master reference is `pi/CUSTOM-SETTINGS.md` in this repo — keep READMEs consistent with it.
