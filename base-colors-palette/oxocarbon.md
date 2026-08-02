# Oxocarbon Color Palette

Source: [oxocarbon.nvim](https://github.com/nyoom-engineering/oxocarbon.nvim) (`lua/oxocarbon/init.lua`)

## Overview

| Property        | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| Variants        | 2: **Dark** (default) + **Light**                                             |
| Base Colors     | 17 colors per variant                                                         |
| Background      | base00-blend, base01-base06 via HSLUV blending of `#161616` → `#ffffff`       |
| Accent Colors   | 9 hand-picked accent colors (base07-base15)                                   |

---

## Base Palette — Dark

| Token   | Hex       | Role                                      | Preview                                           |
| ------- | --------- | ----------------------------------------- | ------------------------------------------------- |
| base00  | `#161616` | Primary background (Normal, StatusLine)   | ![](https://singlecolorimage.com/161616/FF/48x24) |
| base01  | `#2a2a2a` | Secondary bg (CursorLine, Pmenu, Folded)  | ![](https://singlecolorimage.com/2a2a2a/FF/48x24) |
| base02  | `#404040` | Elevated bg (Visual, PmenuSel, Telescope) | ![](https://singlecolorimage.com/404040/FF/48x24) |
| base03  | `#5c5c5c` | Muted fg (Comment, LineNr, FoldColumn)    | ![](https://singlecolorimage.com/5c5c5c/FF/48x24) |
| base04  | `#d5d5d5` | Primary fg (Normal text, CursorLineNr)    | ![](https://singlecolorimage.com/d5d5d5/FF/48x24) |
| base05  | `#f3f3f3` | Bright fg (NormalFloat)                   | ![](https://singlecolorimage.com/f3f3f3/FF/48x24) |
| base06  | `#ffffff` | Max contrast white                        | ![](https://singlecolorimage.com/ffffff/FF/48x24) |
| base07  | `#08bdba` | Cyan (methods, macros, DiffAdded)         | ![](https://singlecolorimage.com/08bdba/FF/48x24) |
| base08  | `#3ddbd9` | Teal (functions, punctuation, links)      | ![](https://singlecolorimage.com/3ddbd9/FF/48x24) |
| base09  | `#78a9ff` | Blue — primary accent (keywords, types)   | ![](https://singlecolorimage.com/78a9ff/FF/48x24) |
| base10  | `#ee5396` | Magenta (errors, properties, headings)    | ![](https://singlecolorimage.com/ee5396/FF/48x24) |
| base11  | `#33b1ff` | Light blue (numbers, StatusTerminal)      | ![](https://singlecolorimage.com/33b1ff/FF/48x24) |
| base12  | `#ff7eb6` | Pink (functions, StatusInsert)            | ![](https://singlecolorimage.com/ff7eb6/FF/48x24) |
| base13  | `#42be65` | Green (strings, success, StatusCommand)   | ![](https://singlecolorimage.com/42be65/FF/48x24) |
| base14  | `#be95ff` | Purple (constants, warnings, diagnostics) | ![](https://singlecolorimage.com/be95ff/FF/48x24) |
| base15  | `#82cfff` | Light cyan (labels, numbers, StatusNormal)| ![](https://singlecolorimage.com/82cfff/FF/48x24) |
| blend   | `#131313` | Float/modal bg (NormalFloat, FloatBorder) | ![](https://singlecolorimage.com/131313/FF/48x24) |
| none    | `NONE`    | Transparent                               |                                                   |

---

## Semantic Color Mapping

| Semantic     | Token  | Hex       | Usage                                    |
| ------------ | ------ | --------- | ---------------------------------------- |
| bg           | base00 | `#161616` | Main background                          |
| bg_alt       | base01 | `#2a2a2a` | Secondary surfaces (cursorline, pmenu)   |
| bg_highlight | base02 | `#404040` | Elevated surfaces (visual, selection)    |
| fg_dark      | base03 | `#5c5c5c` | Comments, line numbers, muted elements   |
| fg           | base04 | `#d5d5d5` | Primary foreground / text                |
| fg_bright    | base05 | `#f3f3f3` | Bright text (floats)                     |
| fg_max       | base06 | `#ffffff` | Max contrast                             |
| accent_cyan  | base07 | `#08bdba` | Methods, macros, added diffs             |
| accent_teal  | base08 | `#3ddbd9` | Functions, punctuation, search highlights|
| accent_blue  | base09 | `#78a9ff` | Keywords, types, operators               |
| accent_red   | base10 | `#ee5396` | Errors, properties, headings             |
| accent_blue2 | base11 | `#33b1ff` | Light blue accent                        |
| accent_pink  | base12 | `#ff7eb6` | Function declarations, bold              |
| accent_green | base13 | `#42be65` | Strings, success states                  |
| accent_purple| base14 | `#be95ff` | Constants, warnings                      |
| accent_cyan2 | base15 | `#82cfff` | Labels, symbols, numbers                |

---

## Terminal Colors (dark)

| Index | Hex       | Token  |
| ----- | --------- | ------ |
| 0     | `#2a2a2a` | base01 |
| 1     | `#33b1ff` | base11 |
| 2     | `#be95ff` | base14 |
| 3     | `#42be65` | base13 |
| 4     | `#78a9ff` | base09 |
| 5     | `#82cfff` | base15 |
| 6     | `#3ddbd9` | base08 |
| 7     | `#f3f3f3` | base05 |
| 8     | `#5c5c5c` | base03 |
| 9     | `#33b1ff` | base11 |
| 10    | `#be95ff` | base14 |
| 11    | `#42be65` | base13 |
| 12    | `#78a9ff` | base09 |
| 13    | `#82cfff` | base15 |
| 14    | `#08bdba` | base07 |
| 15    | `#ffffff` | base06 |

---

## Light Variant (reference only)

| Token   | Hex       |
| ------- | --------- |
| base00  | `#ffffff` |
| base01  | `#f3f3f3` |
| base02  | `#d5d5d5` |
| base03  | `#161616` |
| base04  | `#37474F` |
| base05  | `#90A4AE` |
| base06  | `#525252` |
| base07  | `#08bdba` |
| base08  | `#ff7eb6` |
| base09  | `#ee5396` |
| base10  | `#FF6F00` |
| base11  | `#0f62fe` |
| base12  | `#673AB7` |
| base13  | `#42be65` |
| base14  | `#be95ff` |
| base15  | `#FFAB91` |
| blend   | `#FAFAFA` |
