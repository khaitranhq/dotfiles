# Reach Buffer Selector

A Neovim buffer selector popup using [nui.nvim](https://github.com/MunifTanjim/nui.nvim).

## Features

- Display all listed buffers in a popup window
- Quick selection using keys 1-9 and a-z (up to 35 buffers)
- Shows buffer paths relative to current working directory
- Rounded border with clear visual design
- Auto-close on buffer leave or ESC/q

## Requirements

- Neovim >= 0.7.0
- [nui.nvim](https://github.com/MunifTanjim/nui.nvim)

## Installation

Make sure you have `nui.nvim` installed:

```lua
-- Using lazy.nvim
{
  "MunifTanjim/nui.nvim",
}
```

## Setup

Add to your Neovim configuration:

```lua
-- In your init.lua
require("custom.reach").setup()
```

This will create the `:ReachBuffer` command.

## Usage

### Via Command

```vim
:ReachBuffer
```

### Via Keymap (Optional)

Add a custom keymap in your config:

```lua
vim.keymap.set("n", "<leader>bb", function()
  require("custom.reach").open()
end, { desc = "Buffer selector" })
```

### In the Popup

- Press `1-9` or `a-z` to select and open the corresponding buffer
- Press `ESC` or `q` to close without selecting
- Buffer automatically closes when focus leaves

## File Structure

```
reach/
├── init.lua         # Main entry point and setup
├── buffer_list.lua  # Buffer listing and formatting
├── popup.lua        # Popup creation using nui.nvim
├── keymaps.lua      # Key input handling
└── README.md        # This file
```

## Customization

### Popup Appearance

Edit `popup.lua` to customize:

```lua
-- Change popup size
size = {
  width = "60%",
  height = math.min(#lines + 2, 20),
}

-- Change border style
border = {
  style = "rounded", -- Options: "rounded", "solid", "double", "single"
  text = {
    top = " Buffer Selector ",
  },
}

-- Change position
position = "50%", -- Options: "50%", {row = 10, col = 20}, etc.
```

### Key Mappings

Edit `keymaps.lua` to add or modify key mappings.

### Buffer Filtering

Edit `buffer_list.lua` to customize which buffers are shown:

```lua
-- Example: Filter out specific file types
if not vim.endswith(name, ".git") then
  table.insert(buffers, {
    bufnr = bufnr,
    name = name,
  })
end
```

## Troubleshooting

### "No buffers to select" message

This means no valid, listed buffers with names are available. Open some files first.

### Popup doesn't show

Ensure `nui.nvim` is properly installed and loaded before calling `require("custom.reach").setup()`.

### Keys don't work

Make sure you're in normal mode (`ESC`) when pressing selection keys.

## License

MIT
