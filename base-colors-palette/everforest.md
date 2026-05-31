# Everforest Color Palette

Source: [everforest-nvim](https://github.com/neanias/everforest-nvim) (`lua/everforest/colours.lua`)

## Overview

| Property            | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| Variants            | 6 combinations: **Dark × {Hard, Medium, Soft}** + **Light × {Hard, Medium, Soft}** |
| Base Colors         | 14 colors shared across all background variants per theme (Dark/Light)             |
| Background Colors   | 13 surface colors per variant, independent per (hardness, theme) pair              |
| Total Unique Colors | 14×2 + 13×2×3 = 28 + 78 = **106**                                                  |

---

## Base Palette — Dark

Shared across all dark background variants (Hard, Medium, Soft).

| Token         | Hex       | Preview                                           |
| ------------- | --------- | ------------------------------------------------- |
| `fg`          | `#d3c6aa` | ![](https://singlecolorimage.com/d3c6aa/FF/48x24) |
| `red`         | `#e67e80` | ![](https://singlecolorimage.com/e67e80/FF/48x24) |
| `orange`      | `#e69875` | ![](https://singlecolorimage.com/e69875/FF/48x24) |
| `yellow`      | `#dbbc7f` | ![](https://singlecolorimage.com/dbbc7f/FF/48x24) |
| `green`       | `#a7c080` | ![](https://singlecolorimage.com/a7c080/FF/48x24) |
| `aqua`        | `#83c092` | ![](https://singlecolorimage.com/83c092/FF/48x24) |
| `blue`        | `#7fbbb3` | ![](https://singlecolorimage.com/7fbbb3/FF/48x24) |
| `purple`      | `#d699b6` | ![](https://singlecolorimage.com/d699b6/FF/48x24) |
| `grey0`       | `#7a8478` | ![](https://singlecolorimage.com/7a8478/FF/48x24) |
| `grey1`       | `#859289` | ![](https://singlecolorimage.com/859289/FF/48x24) |
| `grey2`       | `#9da9a0` | ![](https://singlecolorimage.com/9da9a0/FF/48x24) |
| `statusline1` | `#a7c080` | ![](https://singlecolorimage.com/a7c080/FF/48x24) |
| `statusline2` | `#d3c6aa` | ![](https://singlecolorimage.com/d3c6aa/FF/48x24) |
| `statusline3` | `#e67e80` | ![](https://singlecolorimage.com/e67e80/FF/48x24) |
| `none`        | `NONE`    | (transparent)                                     |

---

## Base Palette — Light

Shared across all light background variants (Hard, Medium, Soft).

| Token         | Hex       | Preview                                           |
| ------------- | --------- | ------------------------------------------------- |
| `fg`          | `#5c6a72` | ![](https://singlecolorimage.com/5c6a72/FF/48x24) |
| `red`         | `#f85552` | ![](https://singlecolorimage.com/f85552/FF/48x24) |
| `orange`      | `#f57d26` | ![](https://singlecolorimage.com/f57d26/FF/48x24) |
| `yellow`      | `#dfa000` | ![](https://singlecolorimage.com/dfa000/FF/48x24) |
| `green`       | `#8da101` | ![](https://singlecolorimage.com/8da101/FF/48x24) |
| `aqua`        | `#35a77c` | ![](https://singlecolorimage.com/35a77c/FF/48x24) |
| `blue`        | `#3a94c5` | ![](https://singlecolorimage.com/3a94c5/FF/48x24) |
| `purple`      | `#df69ba` | ![](https://singlecolorimage.com/df69ba/FF/48x24) |
| `grey0`       | `#a6b0a0` | ![](https://singlecolorimage.com/a6b0a0/FF/48x24) |
| `grey1`       | `#939f91` | ![](https://singlecolorimage.com/939f91/FF/48x24) |
| `grey2`       | `#829181` | ![](https://singlecolorimage.com/829181/FF/48x24) |
| `statusline1` | `#93b259` | ![](https://singlecolorimage.com/93b259/FF/48x24) |
| `statusline2` | `#708089` | ![](https://singlecolorimage.com/708089/FF/48x24) |
| `statusline3` | `#e66868` | ![](https://singlecolorimage.com/e66868/FF/48x24) |
| `none`        | `NONE`    | (transparent)                                     |

---

## Background Variants — Hard

### Hard Dark

| Token       | Hex       | Preview                                           |
| ----------- | --------- | ------------------------------------------------- |
| `bg_dim`    | `#1e2326` | ![](https://singlecolorimage.com/1e2326/FF/48x24) |
| `bg0`       | `#272e33` | ![](https://singlecolorimage.com/272e33/FF/48x24) |
| `bg1`       | `#2e383c` | ![](https://singlecolorimage.com/2e383c/FF/48x24) |
| `bg2`       | `#374145` | ![](https://singlecolorimage.com/374145/FF/48x24) |
| `bg3`       | `#414b50` | ![](https://singlecolorimage.com/414b50/FF/48x24) |
| `bg4`       | `#495156` | ![](https://singlecolorimage.com/495156/FF/48x24) |
| `bg5`       | `#4f5b58` | ![](https://singlecolorimage.com/4f5b58/FF/48x24) |
| `bg_visual` | `#4c3743` | ![](https://singlecolorimage.com/4c3743/FF/48x24) |
| `bg_red`    | `#493b40` | ![](https://singlecolorimage.com/493b40/FF/48x24) |
| `bg_green`  | `#3c4841` | ![](https://singlecolorimage.com/3c4841/FF/48x24) |
| `bg_blue`   | `#384b55` | ![](https://singlecolorimage.com/384b55/FF/48x24) |
| `bg_yellow` | `#45443c` | ![](https://singlecolorimage.com/45443c/FF/48x24) |
| `bg_purple` | `#463f48` | ![](https://singlecolorimage.com/463f48/FF/48x24) |

### Hard Light

| Token       | Hex       | Preview                                           |
| ----------- | --------- | ------------------------------------------------- |
| `bg_dim`    | `#f2efdf` | ![](https://singlecolorimage.com/f2efdf/FF/48x24) |
| `bg0`       | `#fffbef` | ![](https://singlecolorimage.com/fffbef/FF/48x24) |
| `bg1`       | `#f8f5e4` | ![](https://singlecolorimage.com/f8f5e4/FF/48x24) |
| `bg2`       | `#f2efdf` | ![](https://singlecolorimage.com/f2efdf/FF/48x24) |
| `bg3`       | `#edeada` | ![](https://singlecolorimage.com/edeada/FF/48x24) |
| `bg4`       | `#e8e5d5` | ![](https://singlecolorimage.com/e8e5d5/FF/48x24) |
| `bg5`       | `#bec5b2` | ![](https://singlecolorimage.com/bec5b2/FF/48x24) |
| `bg_visual` | `#f0f2d4` | ![](https://singlecolorimage.com/f0f2d4/FF/48x24) |
| `bg_red`    | `#ffe7de` | ![](https://singlecolorimage.com/ffe7de/FF/48x24) |
| `bg_green`  | `#f3f5d9` | ![](https://singlecolorimage.com/f3f5d9/FF/48x24) |
| `bg_blue`   | `#ecf5ed` | ![](https://singlecolorimage.com/ecf5ed/FF/48x24) |
| `bg_yellow` | `#fef2d5` | ![](https://singlecolorimage.com/fef2d5/FF/48x24) |
| `bg_purple` | `#fceced` | ![](https://singlecolorimage.com/fceced/FF/48x24) |

---

## Background Variants — Medium (Default)

### Medium Dark

| Token       | Hex       | Preview                                           |
| ----------- | --------- | ------------------------------------------------- |
| `bg_dim`    | `#232a2e` | ![](https://singlecolorimage.com/232a2e/FF/48x24) |
| `bg0`       | `#2d353b` | ![](https://singlecolorimage.com/2d353b/FF/48x24) |
| `bg1`       | `#343f44` | ![](https://singlecolorimage.com/343f44/FF/48x24) |
| `bg2`       | `#3d484d` | ![](https://singlecolorimage.com/3d484d/FF/48x24) |
| `bg3`       | `#475258` | ![](https://singlecolorimage.com/475258/FF/48x24) |
| `bg4`       | `#4f585e` | ![](https://singlecolorimage.com/4f585e/FF/48x24) |
| `bg5`       | `#56635f` | ![](https://singlecolorimage.com/56635f/FF/48x24) |
| `bg_visual` | `#543a48` | ![](https://singlecolorimage.com/543a48/FF/48x24) |
| `bg_red`    | `#514045` | ![](https://singlecolorimage.com/514045/FF/48x24) |
| `bg_green`  | `#425047` | ![](https://singlecolorimage.com/425047/FF/48x24) |
| `bg_blue`   | `#3a515d` | ![](https://singlecolorimage.com/3a515d/FF/48x24) |
| `bg_yellow` | `#4d4c43` | ![](https://singlecolorimage.com/4d4c43/FF/48x24) |
| `bg_purple` | `#4a444e` | ![](https://singlecolorimage.com/4a444e/FF/48x24) |

### Medium Light

| Token       | Hex       | Preview                                           |
| ----------- | --------- | ------------------------------------------------- |
| `bg_dim`    | `#efebd4` | ![](https://singlecolorimage.com/efebd4/FF/48x24) |
| `bg0`       | `#fdf6e3` | ![](https://singlecolorimage.com/fdf6e3/FF/48x24) |
| `bg1`       | `#f4f0d9` | ![](https://singlecolorimage.com/f4f0d9/FF/48x24) |
| `bg2`       | `#efebd4` | ![](https://singlecolorimage.com/efebd4/FF/48x24) |
| `bg3`       | `#e6e2cc` | ![](https://singlecolorimage.com/e6e2cc/FF/48x24) |
| `bg4`       | `#e0dcc7` | ![](https://singlecolorimage.com/e0dcc7/FF/48x24) |
| `bg5`       | `#bdc3af` | ![](https://singlecolorimage.com/bdc3af/FF/48x24) |
| `bg_visual` | `#eaedc8` | ![](https://singlecolorimage.com/eaedc8/FF/48x24) |
| `bg_red`    | `#fde3da` | ![](https://singlecolorimage.com/fde3da/FF/48x24) |
| `bg_green`  | `#f0f1d2` | ![](https://singlecolorimage.com/f0f1d2/FF/48x24) |
| `bg_blue`   | `#e9f0e9` | ![](https://singlecolorimage.com/e9f0e9/FF/48x24) |
| `bg_yellow` | `#faedcd` | ![](https://singlecolorimage.com/faedcd/FF/48x24) |
| `bg_purple` | `#fae8e2` | ![](https://singlecolorimage.com/fae8e2/FF/48x24) |

---

## Background Variants — Soft

### Soft Dark

| Token       | Hex       | Preview                                           |
| ----------- | --------- | ------------------------------------------------- |
| `bg_dim`    | `#293136` | ![](https://singlecolorimage.com/293136/FF/48x24) |
| `bg0`       | `#333c43` | ![](https://singlecolorimage.com/333c43/FF/48x24) |
| `bg1`       | `#3a464c` | ![](https://singlecolorimage.com/3a464c/FF/48x24) |
| `bg2`       | `#434f55` | ![](https://singlecolorimage.com/434f55/FF/48x24) |
| `bg3`       | `#4d5960` | ![](https://singlecolorimage.com/4d5960/FF/48x24) |
| `bg4`       | `#555f66` | ![](https://singlecolorimage.com/555f66/FF/48x24) |
| `bg5`       | `#5d6b66` | ![](https://singlecolorimage.com/5d6b66/FF/48x24) |
| `bg_visual` | `#5c3f4f` | ![](https://singlecolorimage.com/5c3f4f/FF/48x24) |
| `bg_red`    | `#59464c` | ![](https://singlecolorimage.com/59464c/FF/48x24) |
| `bg_green`  | `#48584e` | ![](https://singlecolorimage.com/48584e/FF/48x24) |
| `bg_blue`   | `#3f5865` | ![](https://singlecolorimage.com/3f5865/FF/48x24) |
| `bg_yellow` | `#55544a` | ![](https://singlecolorimage.com/55544a/FF/48x24) |
| `bg_purple` | `#4e4953` | ![](https://singlecolorimage.com/4e4953/FF/48x24) |

### Soft Light

| Token       | Hex       | Preview                                           |
| ----------- | --------- | ------------------------------------------------- |
| `bg_dim`    | `#e5dfc5` | ![](https://singlecolorimage.com/e5dfc5/FF/48x24) |
| `bg0`       | `#f3ead3` | ![](https://singlecolorimage.com/f3ead3/FF/48x24) |
| `bg1`       | `#eae4ca` | ![](https://singlecolorimage.com/eae4ca/FF/48x24) |
| `bg2`       | `#e5dfc5` | ![](https://singlecolorimage.com/e5dfc5/FF/48x24) |
| `bg3`       | `#ddd8be` | ![](https://singlecolorimage.com/ddd8be/FF/48x24) |
| `bg4`       | `#d8d3ba` | ![](https://singlecolorimage.com/d8d3ba/FF/48x24) |
| `bg5`       | `#b9c0ab` | ![](https://singlecolorimage.com/b9c0ab/FF/48x24) |
| `bg_visual` | `#e1e4bd` | ![](https://singlecolorimage.com/e1e4bd/FF/48x24) |
| `bg_red`    | `#fadbd0` | ![](https://singlecolorimage.com/fadbd0/FF/48x24) |
| `bg_green`  | `#e5e6c5` | ![](https://singlecolorimage.com/e5e6c5/FF/48x24) |
| `bg_blue`   | `#e1e7dd` | ![](https://singlecolorimage.com/e1e7dd/FF/48x24) |
| `bg_yellow` | `#f1e4c5` | ![](https://singlecolorimage.com/f1e4c5/FF/48x24) |
| `bg_purple` | `#f1ddd4` | ![](https://singlecolorimage.com/f1ddd4/FF/48x24) |

---

## Semantic Color Mapping

| Semantic      | Dark Hex  | Light Hex | Usage                            |
| ------------- | --------- | --------- | -------------------------------- |
| `fg`          | `#d3c6aa` | `#5c6a72` | Primary foreground / text        |
| `red`         | `#e67e80` | `#f85552` | Errors, keywords, conditionals   |
| `orange`      | `#e69875` | `#f57d26` | Storage classes, tags, operators |
| `yellow`      | `#dbbc7f` | `#dfa000` | Types, special chars, warnings   |
| `green`       | `#a7c080` | `#8da101` | Strings, functions, diffs added  |
| `aqua`        | `#83c092` | `#35a77c` | Constants, macros, symbols       |
| `blue`        | `#7fbbb3` | `#3a94c5` | Identifiers, info, links         |
| `purple`      | `#d699b6` | `#df69ba` | Booleans, numbers, preprocessors |
| `grey0`       | `#7a8478` | `#a6b0a0` | UI contrast (high setting)       |
| `grey1`       | `#859289` | `#939f91` | Comments, ignored text           |
| `grey2`       | `#9da9a0` | `#829181` | Tab, fold column                 |
| `statusline1` | `#a7c080` | `#93b259` | Status line / tab active         |
| `statusline2` | `#d3c6aa` | `#708089` | Status line secondary            |
| `statusline3` | `#e67e80` | `#e66868` | Status line tertiary (errors)    |

## Background Roles

| Token       | Role                                                            |
| ----------- | --------------------------------------------------------------- |
| `bg_dim`    | Dimmed background (inactive windows, dim float style)           |
| `bg0`       | Primary background (Normal, Terminal)                           |
| `bg1`       | Slightly elevated (CursorLine, ColorColumn, Folded)             |
| `bg2`       | Elevated surface (StatusLine, WinBar, Pmenu, TreesitterContext) |
| `bg3`       | Further elevated (TabLine)                                      |
| `bg4`       | Further elevated (FloatTitle bright, NonText foreground)        |
| `bg5`       | Further elevated (LineNr low contrast, Conceal)                 |
| `bg_visual` | Visual selection background                                     |
| `bg_red`    | Red-tinted background (errors, diff delete)                     |
| `bg_green`  | Green-tinted background (diff add, success)                     |
| `bg_blue`   | Blue-tinted background (info, diff change)                      |
| `bg_yellow` | Yellow-tinted background (warnings)                             |
| `bg_purple` | Purple-tinted background (hints)                                |
