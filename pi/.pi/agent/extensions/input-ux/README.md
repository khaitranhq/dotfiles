# Input UX

Unified input experience for pi: `@mention` autocomplete, input transforms, and per-directory prompt history.

## Commands

| Command         | Description                                   |
| --------------- | --------------------------------------------- |
| `/active-tools` | Show currently active tools grouped by source |

## Features

| Prefix        | Matches             | Action                           |
| ------------- | ------------------- | -------------------------------- |
| `@agent`      | Subagent names      | Delegation instruction           |
| `@file`       | File paths          | Read instruction                 |
| `@directory`  | Directory paths     | Inspect instruction              |
| `@fuzzy_name` | Fuzzy-matched agent | Resolves to best match on submit |

## History

Per-directory prompt history stored in `~/.pi/agent/input-history.json`. Navigate with `↑`/`↓` at the first/last input line.

## Architecture

| Module                 | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `index.ts`             | Extension entry point, wires components together     |
| `types.ts`             | Shared types, interfaces, and constants              |
| `mention-parser.ts`    | Extracts `@mention` context from cursor position     |
| `file-system-index.ts` | `FileSystemIndex` — project file/directory discovery |
| `candidate-ranker.ts`  | `CandidateRanker` — builds and ranks autocomplete    |
| `autocomplete.ts`      | Formatting utilities for autocomplete items          |
| `input-history.ts`     | `InputHistoryManager` — per-cwd persistence          |
| `editor-patcher.ts`    | TUI editor integration (history + autocomplete size) |
