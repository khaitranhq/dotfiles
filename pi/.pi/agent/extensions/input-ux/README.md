# Input UX

Unified input experience:

- **`@mention` autocomplete** — fuzzy match agents, files, directories
- **`@mention` input transform** — `@agent` delegates to subagent, `@file` reads file
- **Cwd-scoped input history** — per-directory prompt history on `↑`/`↓`

## Usage

| Prefix | Matches | Action |
|--------|---------|--------|
| `@agent ` | Subagent names | Delegation instruction |
| `@file ` | File paths | Read instruction |
| `@dir ` | Directory paths | Inspect instruction |

History stored in `~/.pi/agent/input-history.json`, per-directory.
