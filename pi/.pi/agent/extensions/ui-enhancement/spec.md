# UI Enhancement Specification

## Layout

Header (replaces built-in `setHeader`):

```
pi v0.74.1                                          │ agent: pi
                                                    │ anthropic/claude-sonnet-4
                                                    │ ctx 12%/200k
<generated messages>                                │ mcp
<...>                                               │ <icon for running> obsidian
<...>                                               │ <icon for failed> neovim
<...>                                               │ todolist:
<...>                                               │ <icon for todo> implement sidebar extension
<...>                                               │ <icon for done> write spec for sidebar extension
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
<prompt input area>
───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

## Issues

Key binding helps, [Context], [Skills], [Extensions] may break the sidebar layout
=> solution to remove all components, just show what's needed for the sidebar
