# CodeGraph Hooks

Keeps [CodeGraph](https://codegraph.local) in sync with the session's
working directory — auto-init on first session, sync on shutdown. No
agent involvement, no tokens spent.

## Purpose

- `session_start` (new / resume / fork): if `<cwd>/.codegraph/` is
  absent, run `codegraph init <cwd>`.
- `session_shutdown` (any reason): if `<cwd>/.codegraph/` exists, run
  `codegraph sync -q <cwd>`.
- Both hooks are **fire-and-forget**. They never block the session and
  never inject anything into the LLM prompt.

## Settings

None. The extension requires no `custom-settings.yaml` entries; it is
auto-discovered from `~/.pi/agent/extensions/codegraph-hooks/`.

| Env var (optional) | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `HOME`             | Used to resolve `~/.pi/agent/codegraph-hooks.log` |

If the `codegraph` binary is not on `$PATH`, the extension silently
no-ops (errors are logged, never raised).

## Commands

None.

## Behavior

- **Why these events?** `session_start` carries no `cwd` of its own but
  `ctx.cwd` is always populated. `session_shutdown` covers quit, reload,
  and session replacement — the "session is done" cases the user asked
  for.
- **Why skip `startup`/`reload` on session_start?** Init is idempotent
  but expensive; skipping avoids re-running on every pi startup and on
  extension reloads in unchanged directories.
- **Token cost: zero.** Hooks do not call `sendUserMessage`, do not
  modify `systemPrompt`, and do not block the session lifecycle.
- **Failure mode: silent.** A missing CLI or spawn error is written to
  `~/.pi/agent/codegraph-hooks.log` and otherwise ignored.

## Files

```
extensions/codegraph-hooks/
├── index.ts                     # Hook handlers + extension entry
├── codegraph-hooks.spec.ts      # Vitest specs
└── README.md                    # This file
```
