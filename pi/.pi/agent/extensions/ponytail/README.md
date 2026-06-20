# Ponytail Pi Extension

Lazy senior-dev mode for AI agents — channels the laziest correct solution
(YAGNI → stdlib → native → installed dependency → one line → minimum).
Ported from [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail)
to TypeScript and adapted for pi's `ExtensionAPI`.

Activation is persistent across the session and injected into every
`before_agent_start` system prompt. Deactivate anytime with
`stop ponytail` or `normal mode`.

The companion skill lives at `~/.agents/skills/ponytail/SKILL.md` and is
auto-discovered by pi; no `custom-settings.yaml` changes are required.

## Purpose

- Track the active ponytail mode (off / lite / full / ultra) per session.
- Inject the mode-specific ruleset into every agent turn.
- Expose slash commands for mode switching, status, and the five ponytail
  skill aliases (`ponytail-review`, `ponytail-audit`, `ponytail-debt`,
  `ponytail-gain`, `ponytail-help`).
- Persist mode changes as `ponytail-mode` custom session entries so they
  survive session reloads.

## Settings

No `custom-settings.yaml` keys are required. The default mode resolves from
(priority order):

1. `PONYTAIL_DEFAULT_MODE` env var (`off` / `lite` / `full` / `ultra` / `review`)
2. `defaultMode` in `$XDG_CONFIG_HOME/ponytail/config.json` (or platform
   equivalent: `~/.config/ponytail/config.json`, `%APPDATA%\ponytail\config.json`)
3. `full` (built-in default)

| Setting                 | Where                            | Values                                       | Default         |
| ----------------------- | -------------------------------- | -------------------------------------------- | --------------- |
| `PONYTAIL_DEFAULT_MODE` | env var                          | `off` / `lite` / `full` / `ultra` / `review` | unset → `full`  |
| `defaultMode`           | `~/.config/ponytail/config.json` | same                                         | unset → `full`  |
| `PONYTAIL_SKILL_PATH`   | env var (advanced)               | absolute path to `SKILL.md`                  | auto-discovered |

The SKILL.md is auto-discovered in this order (first match wins):
`$PONYTAIL_SKILL_PATH` → walk up from the extension looking for
`skills/ponytail/SKILL.md` → `$HOME/.agents/skills/ponytail/SKILL.md` →
`$XDG_CONFIG_HOME/../skills/ponytail/SKILL.md`.

## Commands

| Command                    | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `/ponytail`                | Show the current mode (no-op when defaulted)                    |
| `/ponytail lite`           | Switch to lite intensity                                        |
| `/ponytail full`           | Switch to full intensity (default)                              |
| `/ponytail ultra`          | Switch to ultra intensity                                       |
| `/ponytail off`            | Disable ponytail for this session                               |
| `/ponytail status`         | Notify current and configured-default mode                      |
| `/ponytail default <mode>` | Persist `<mode>` as the configured default (env var still wins) |
| `/ponytail-review`         | Alias for `/skill:ponytail-review`                              |
| `/ponytail-audit`          | Alias for `/skill:ponytail-audit`                               |
| `/ponytail-debt`           | Alias for `/skill:ponytail-debt`                                |
| `/ponytail-gain`           | Alias for `/skill:ponytail-gain`                                |
| `/ponytail-help`           | Alias for `/skill:ponytail-help`                                |

## Behavior

- The active mode is persisted to the session as a `ponytail-mode` custom
  entry on every change. `session_start` restores the latest entry on the
  current branch.
- `before_agent_start` appends the mode-specific ruleset to the system
  prompt. When the mode is `off`, the hook is a no-op.
- The `input` hook turns ponytail off when the **entire** user message is
  `stop ponytail` or `normal mode`. Mentions of "normal mode" inside a
  longer request (e.g. "add a normal mode toggle next to dark mode") do
  NOT deactivate.

## Files

```
extensions/ponytail/
├── index.ts                     # Extension entry point + parsePonytailCommand
├── ponytail-config.ts           # Default-mode resolution + XDG paths
├── ponytail-instructions.ts     # SKILL.md filtering + ruleset assembly
├── ponytail.spec.ts             # Vitest specs
├── fixtures/ponytail-skill.md   # Hermetic SKILL.md fixture for tests
└── README.md                    # This file
```

## Companion skill

Install the ponytail SKILL.md under `~/.agents/skills/ponytail/` (or any
directory pi auto-discovers as a skills source). The five sibling skills
(`ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`,
`ponytail-review`) follow the same pattern.
