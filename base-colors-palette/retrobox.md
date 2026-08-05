# Retrobox Color Palette

Source: [retrobox.vim](https://github.com/vim/colorschemes) (bundled with Neovim at `share/nvim/runtime/colors/retrobox.vim`) - gruvbox-inspired scheme by Maxim Kim, ported from gruvbox8 by Lifepillar.

## Overview

| Property        | Description                                          |
| --------------- | ---------------------------------------------------- |
| Variants        | 2: **Dark** (default) + **Light**                    |
| Base Colors     | 4 backgrounds + 4 foregrounds (gruvbox-style ramp)   |
| Accent Colors   | 8 accents × {dim, bright} + orange + cursor white    |
| Total Unique    | ~30 colors per variant                               |

---

## Base Palette — Dark

| Token    | Hex       | Role                                       | Preview                                           |
| -------- | --------- | ------------------------------------------ | ------------------------------------------------- |
| bg0      | `#1c1c1c` | Primary bg (Normal, SignColumn, FoldColumn)| ![](https://singlecolorimage.com/1c1c1c/FF/48x24) |
| bg1      | `#303030` | CursorLine, VertSplit, ToolbarButton       | ![](https://singlecolorimage.com/303030/FF/48x24) |
| bg2      | `#3c3836` | Pmenu, TabLine, StatusLineNC               | ![](https://singlecolorimage.com/3c3836/FF/48x24) |
| bg3      | `#504945` | PmenuSel, MatchParen, NonText              | ![](https://singlecolorimage.com/504945/FF/48x24) |
| fg0      | `#ebdbb2` | Primary fg (Normal text)                   | ![](https://singlecolorimage.com/ebdbb2/FF/48x24) |
| fg1      | `#a89984` | TabLine, PmenuBorder, DiffDelete fg        | ![](https://singlecolorimage.com/a89984/FF/48x24) |
| fg2      | `#928374` | Comment, FoldColumn, SpecialKey            | ![](https://singlecolorimage.com/928374/FF/48x24) |
| fg3      | `#7c6f64` | LineNr, PmenuThumb                         | ![](https://singlecolorimage.com/7c6f64/FF/48x24) |
| red_dim  | `#cc241d` | ANSI red                                   | ![](https://singlecolorimage.com/cc241d/FF/48x24) |
| red      | `#fb5944` | Keyword, Statement, Error, WarningMsg      | ![](https://singlecolorimage.com/fb5944/FF/48x24) |
| green_dim| `#98971a` | ANSI green                                 | ![](https://singlecolorimage.com/98971a/FF/48x24) |
| green    | `#b8bb26` | String, Function, Directory, Title         | ![](https://singlecolorimage.com/b8bb26/FF/48x24) |
| yellow_dim| `#d79921`| ANSI yellow                                | ![](https://singlecolorimage.com/d79921/FF/48x24) |
| yellow   | `#fabd2f` | Type, CursorLineNr, ModeMsg (accent)       | ![](https://singlecolorimage.com/fabd2f/FF/48x24) |
| blue_dim | `#458588` | ANSI blue                                  | ![](https://singlecolorimage.com/458588/FF/48x24) |
| blue     | `#83a598` | Identifier, SpellCap, Underlined (links)   | ![](https://singlecolorimage.com/83a598/FF/48x24) |
| purple_dim| `#b16286`| ANSI purple                                | ![](https://singlecolorimage.com/b16286/FF/48x24) |
| purple   | `#d3869b` | Number, Constant, Boolean, Float           | ![](https://singlecolorimage.com/d3869b/FF/48x24) |
| aqua_dim | `#689d6a` | ANSI aqua                                  | ![](https://singlecolorimage.com/689d6a/FF/48x24) |
| aqua     | `#8ec07c` | Operator, PreProc, Structure, Define       | ![](https://singlecolorimage.com/8ec07c/FF/48x24) |
| orange   | `#fe8019` | Special, Delimiter, Question, StorageClass | ![](https://singlecolorimage.com/fe8019/FF/48x24) |
| white    | `#fbf1c7` | Cursor bg, TabLineSel fg, ToolbarButton fg | ![](https://singlecolorimage.com/fbf1c7/FF/48x24) |

---

## Semantic Color Mapping (Dark)

| Semantic     | Token  | Hex       | Usage                                |
| ------------ | ------ | --------- | ------------------------------------ |
| bg           | bg0    | `#1c1c1c` | Main background (Normal)             |
| bg_alt       | bg1    | `#303030` | CursorLine, VertSplit                |
| bg_popup     | bg2    | `#3c3836` | Pmenu, TabLine                       |
| bg_popup_sel | bg3    | `#504945` | PmenuSel, MatchParen                 |
| fg           | fg0    | `#ebdbb2` | Primary text                         |
| fg_muted     | fg2    | `#928374` | Comments, line numbers, fold column  |
| accent_red   | red    | `#fb5944` | Errors, keywords, warnings, git del  |
| accent_green | green  | `#b8bb26` | Strings, functions, dirs, git add    |
| accent_yellow| yellow | `#fabd2f` | Types, current line nr, highlight    |
| accent_blue  | blue   | `#83a598` | Identifiers, info, links             |
| accent_purple| purple | `#d3869b` | Numbers, constants, booleans         |
| accent_aqua  | aqua   | `#8ec07c` | Operators, preproc, symbols          |
| accent_orange| orange | `#fe8019` | Specials, delimiters, storage class  |
| accent_white | white  | `#fbf1c7` | Max-contrast text (TabLineSel, Cursor)|

---

## Special / UI Colors (Dark)

| Token          | Hex       | Role                              |
| -------------- | --------- | --------------------------------- |
| visual         | `#2a405a` | Visual selection bg               |
| search         | `#3a4a3a` | Search highlight bg               |
| incsearch      | `#5f431f` | IncSearch bg                      |
| diff_add       | `#273923` | DiffAdd bg                        |
| diff_change    | `#37352f` | DiffChange bg                     |
| diff_delete    | `#2f1f1a` | DiffDelete bg                     |
| diff_text      | `#0f4f4f` | DiffText bg                       |
| folded         | `#121212` | Folded bg / dim surfaces          |
| quickfix       | `#4f2f4f` | QuickFixLine bg                   |
| statusline     | `#504945` on `#ebdbb2` | StatusLine (bold, reverse) |
| statusline_nc  | `#3c3836` on `#a89984` | StatusLineNC (reverse)   |

---

## Terminal Colors (dark ANSI)

| Index | Hex       | Index | Hex       |
| ----- | --------- | ----- | --------- |
| 0     | `#1c1c1c` | 8     | `#928374` |
| 1     | `#cc241d` | 9     | `#fb5944` |
| 2     | `#98971a` | 10    | `#b8bb26` |
| 3     | `#d79921` | 11    | `#fabd2f` |
| 4     | `#458588` | 12    | `#83a598` |
| 5     | `#b16286` | 13    | `#d3869b` |
| 6     | `#689d6a` | 14    | `#8ec07c` |
| 7     | `#a89984` | 15    | `#ebdbb2` |

---

## Light Variant (reference only)

| Token    | Hex       | Role                          |
| -------- | --------- | ----------------------------- |
| bg0      | `#fbf1c7` | Primary bg (Normal)           |
| bg1      | `#e5d4b1` | CursorLine                    |
| bg2      | `#bdae93` | PmenuSel                      |
| fg0      | `#3c3836` | Primary fg                    |
| fg1      | `#7c6f64` | LineNr                        |
| fg2      | `#928374` | Comment                       |
| red      | `#9d0006` | Errors, keywords              |
| green    | `#79740e` | Strings, functions            |
| yellow   | `#b57614` | Types, current line nr        |
| blue     | `#076678` | Identifiers, links            |
| purple   | `#8f3f71` | Numbers, constants            |
| aqua     | `#427b58` | Operators, preproc            |
| orange   | `#ff5f00` | Specials                      |

### Light ANSI

| Index | Hex       | Index | Hex       |
| ----- | --------- | ----- | --------- |
| 0     | `#3c3836` | 8     | `#928374` |
| 1     | `#cc241d` | 9     | `#9d0006` |
| 2     | `#98971a` | 10    | `#79740e` |
| 3     | `#d79921` | 11    | `#b57614` |
| 4     | `#458588` | 12    | `#076678` |
| 5     | `#b16286` | 13    | `#8f3f71` |
| 6     | `#689d6a` | 14    | `#427b58` |
| 7     | `#7c6f64` | 15    | `#fbf1c7` |
