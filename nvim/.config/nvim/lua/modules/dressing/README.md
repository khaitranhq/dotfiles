# Extra Neovim Enhancements

This directory contains additional enhancements and customizations for Neovim that extend beyond the core configuration.

## NUI UI Enhancements

### Overview

The `nui-ui.lua` module provides enhanced UI implementations for `vim.ui.input` and `vim.ui.select` using the [nui.nvim](https://github.com/MunifTanjim/nui.nvim) library. These replace the default command-line prompts with modern, floating window interfaces.

### Features

#### Enhanced Input (`vim.ui.input`)
- **Floating Input Dialog**: Replaces command-line input with a centered floating window
- **Smart Sizing**: Automatically adjusts width based on prompt length
- **Custom Styling**: Rounded borders with prompt text as title
- **Improved UX**: Additional keybindings like `<C-w>` for word deletion
- **Auto-cleanup**: Automatically closes on buffer leave to prevent orphaned windows

#### Enhanced Select (`vim.ui.select`)
- **Centered Menus**: Always positioned in the center of the screen for consistency
- **Keyboard Navigation**: Intuitive `j`/`k` or arrow keys for navigation
- **Quick Selection**: Number keys (1-9) for rapid selection in small lists
- **Smart Sizing**: Adapts to content length with maximum height constraints
- **Rich Formatting**: Supports custom formatting functions for items

### Usage

The UI enhancements are automatically enabled when the configuration loads. They seamlessly replace the default `vim.ui.input` and `vim.ui.select` functions.

#### Examples

**Input Dialog** (automatically used by plugins):
```lua
vim.ui.input({
  prompt = "Enter filename: ",
  default = "example.txt"
}, function(input)
  if input then
    print("You entered: " .. input)
  end
end)
```

**Selection Menu** (automatically used by LSP, etc.):
```lua
vim.ui.select({'Option 1', 'Option 2', 'Option 3'}, {
  prompt = "Choose an option:",
  format_item = function(item)
    return "▸ " .. item
  end
}, function(choice, idx)
  if choice then
    print("Selected: " .. choice)
  end
end)
```

### Testing Commands

Two commands are available for testing the UI components:

- `:NuiTestInput` - Test the input dialog
- `:NuiTestSelect` - Test the selection menu

### Configuration

The UI components can be customized by modifying the configuration in `extra/init.lua`:

```lua
nui_ui.setup({
  input = {
    position = { row = "50%", col = "50%" },  -- Center position
    border = { style = "rounded" },
    prompt_prefix = "▸ ",
  },
  select = {
    position = { row = "50%", col = "50%" },  -- Center position
    border = { style = "rounded" },
    size = { max_height = 15 },
  },
})
```

### Benefits

1. **Better UX**: Modern floating windows instead of command-line prompts
2. **Context Awareness**: Menus appear near cursor for better workflow
3. **Consistency**: Unified styling across all input/select operations
4. **LSP Integration**: Enhanced code action menus and rename dialogs
5. **Plugin Compatibility**: Works with any plugin that uses `vim.ui.*` functions

### Dependencies

- [nui.nvim](https://github.com/MunifTanjim/nui.nvim) - Already included as a dependency of noice.nvim in your configuration

### Integration

The UI enhancements work seamlessly with:
- LSP code actions (`vim.lsp.buf.code_action()`)
- LSP rename operations (`vim.lsp.buf.rename()`)
- Plugin dialogs (any plugin using `vim.ui.input` or `vim.ui.select`)
- Custom scripts and commands

No changes are needed to existing plugins or workflows - they automatically benefit from the enhanced UI.