# AGENTS.md — Pi Extensions

> **Note:** Files under `/home/khaitran/dotfiles/pi/.pi/agent/**` are symlinked to `~/.pi/agent/`. The dotfiles repo is the canonical source. Changes made here are reflected immediately in pi's runtime.
> Run test commands (vitest) in`/home/khaitran/dotfiles/pi/.pi/agent/**` instead of `~/.pi/agent/**` to ensure changes are tracked in version control.

## Mandatory: Lint, Format, and Test After Code Changes

After any code change (edit, write, or file creation), you **MUST** run lint, format, and tests:

1. **Lint** — `pnpm lint` (runs `tsc --noEmit && oxlint`)
2. **Format** — `pnpm format` (oxfmt has no per-file flag; rewrites all files)
3. **Test** — `pnpm test [<path-filter>]` (runs `vitest run`)

`pnpm exec vitest` is **not** equivalent to `pnpm test` — `pnpm test` is the
canonical entry point. Always invoke via `pnpm test`.

Fix all errors before considering the change complete. Do not leave lint warnings or formatting issues behind.

---

## Mandatory: Update README.md on Extension Changes

When modifying any extension under `~/.pi/agent/extensions/`, you **MUST** update the corresponding `README.md` in that extension's folder.

### Extensions and their READMEs

| Extension            | README                                                |
| -------------------- | ----------------------------------------------------- |
| `permission-request` | `~/.pi/agent/extensions/permission-request/README.md` |
| `codegraph-hooks`    | `~/.pi/agent/extensions/codegraph-hooks/README.md`    |
| `defender`           | `~/.pi/agent/extensions/defender/README.md`           |
| `subagent`           | `~/.pi/agent/extensions/subagent/README.md`           |
| `mcp`                | `~/.pi/agent/extensions/mcp/README.md`                |
| `web-search`         | `~/.pi/agent/extensions/web-search/README.md`         |
| `input-ux`           | `~/.pi/agent/extensions/input-ux/README.md`           |
| `question`           | `~/.pi/agent/extensions/question/README.md`           |
| `shared`             | `~/.pi/agent/extensions/shared/README.md`             |

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
