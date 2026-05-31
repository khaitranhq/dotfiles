# Agent Instructions

## GNU Stow Setup

This dotfiles repo uses **GNU stow** to symlink configuration files into place.

- `nvim/` → stowed as `~/.config/nvim` and `~/.local/share/nvim`
- Other packages (fish, git, tmux, etc.) follow the same pattern
- To apply: `stow nvim` (from repo root)
- To remove: `stow -D nvim`

**Key implication**: When editing files under `nvim/.config/nvim/` or `nvim/.local/share/nvim/`, the changes are made directly to the symlinked targets (the live config). The stow directory structure mirrors the target filesystem from `~`.

## Treesitter Queries

Custom treesitter queries live in the standard Neovim runtime path:

```
nvim/.local/share/nvim/site/queries/<lang>/highlights.scm
```

These use Neovim 0.12 built-in treesitter capture names (NOT nvim-treesitter plugin captures). Common captures:
- `@label` / `@property` — object keys
- `@string`, `@string.escape`, `@string.special` — string variants
- `@number`, `@boolean`, `@constant.builtin` — literals
- `@punctuation.delimiter`, `@punctuation.bracket` — syntax
- `@comment` — comments

**⚠️ `@string.special.key` and `@escape` are NOT valid captures in Neovim 0.12.** Use `@label` and `@string.escape` instead.
