# Tmux Ergonomic Key Bindings Reference

## Core Philosophy
This configuration prioritizes finger ergonomics by:
- Using `Ctrl+Space` as prefix (keeps fingers free for next commands)
- Keeping navigation on the home row (vim-style hjkl)
- Using intuitive symbols for splits (| and -)
- Adding prefix-free shortcuts for common actions

## Basic Commands

### Prefix Key
- **Prefix**: `Ctrl+Space` (ergonomic alternative to Ctrl+b)
- **Send prefix to application**: `Ctrl+Space Ctrl+Space`

### Configuration
- **Reload config**: `Prefix + r` (displays "Config reloaded!" message)

## Pane Management

### Splitting Panes (Intuitive)
- **Vertical split** (side by side): `Prefix + |` (think: vertical line)
- **Horizontal split** (top/bottom): `Prefix + -` (think: horizontal line)

### Legacy Splits (still available)
- **Horizontal split**: `Prefix + "` 
- **Vertical split**: `Prefix + /`

### Navigation (Home Row - No Hand Movement!)
- **Left pane**: `Prefix + h`
- **Down pane**: `Prefix + j`
- **Up pane**: `Prefix + k`
- **Right pane**: `Prefix + l`

### Resizing Panes
#### Coarse Resizing (5 units, repeatable)
- **Resize left**: `Prefix + H` (hold prefix, then keep pressing H)
- **Resize down**: `Prefix + J`
- **Resize up**: `Prefix + K`
- **Resize right**: `Prefix + L`

#### Fine Resizing (1 unit, no prefix needed!)
- **Resize left**: `Alt + h`
- **Resize down**: `Alt + j`
- **Resize up**: `Alt + k`
- **Resize right**: `Alt + l`

## Window Management

### Basic Window Operations
- **New window**: `Prefix + c` (creates in current directory)
- **Previous window**: `Prefix + p` (repeatable)
- **Next window**: `Prefix + n` (repeatable)

### Quick Window Switching (No Prefix!)
- **Window 1-9**: `Alt + 1` through `Alt + 9`
  - `Alt + 1` → Window 1
  - `Alt + 2` → Window 2
  - etc.

## Copy Mode (Vim-Style)

### Entering Copy Mode
- **Enter copy mode**: `Prefix + v` (like vim's visual mode)

### Copy Mode Navigation
- **Start selection**: `v` (while in copy mode)
- **Copy selection**: `y` (copies to system clipboard via xclip)
- **Rectangle selection**: `r` (toggle rectangular selection)

## Session Management

### Session Operations
- **Choose session**: `Prefix + s` (shows session list)
- **Kill current session**: `Prefix + q` (with confirmation)

### Quick Session Switching (No Prefix!)
- **Previous session**: `Ctrl + Alt + Left Arrow`
- **Next session**: `Ctrl + Alt + Right Arrow`

## Special Features

### Lazygit Integration
- **Open/toggle lazygit**: `Prefix + g` (floating popup)
- **Kill lazygit session**: `Prefix + G` (resets lazygit state)

### File Picker
- **Open file picker**: `Prefix + Ctrl + f`

## Mouse Support
- **Mouse enabled**: Click, scroll, and resize with mouse (optional)

## Key Ergonomic Benefits

1. **Ctrl+Space prefix**: Easiest to type, leaves fingers free for next command
2. **Home row navigation**: hjkl keeps hands in natural position
3. **Intuitive splits**: | and - symbols match the split direction
4. **No-prefix shortcuts**: Alt+number and Ctrl+Alt+arrows for speed
5. **Repeatable commands**: Many resize/navigation commands can be held
6. **Vim-style consistency**: Familiar patterns for vim users

## Tips for Maximum Efficiency

1. **Muscle Memory**: Practice the new splits (| and -) to replace old habits
2. **Use Alt shortcuts**: Alt+number for windows, Alt+hjkl for fine resizing
3. **Combine actions**: Use repeatable commands (like `Prefix + H H H`) for multiple resizes
4. **Mouse as backup**: When keyboard shortcuts feel awkward, mouse is there
5. **Copy mode**: `Prefix + v` then `v` to select, `y` to copy - flows naturally

---

*This configuration prioritizes reducing finger strain and keeping hands in natural positions. All changes are backward compatible - old bindings still work!*