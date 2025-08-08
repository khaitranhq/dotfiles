# Neovim Lua Configuration Structure

This document outlines the organization of the Neovim configuration in the `lua/` directory.

## Directory Structure

```
lua/
├── core/                 # Core Neovim configuration
│   ├── general.lua       # General settings, options, and globals
│   ├── mappings.lua      # Key mappings organized by category
│   └── utils.lua         # Utility functions for mappings and configuration
├── extra/                # Custom enhancements and UI components
│   ├── init.lua          # Main extra module loader
│   ├── nui-ui.lua        # Custom NUI-based UI components
│   ├── demo.lua          # Demo/testing functionality
│   ├── debug-test.lua    # Debug utilities
│   └── README.md         # Extra module documentation
└── plugins/              # Plugin configurations organized by category
    ├── language/         # Language support and development tools
    │   ├── lsp.lua       # LSP configuration and completion
    │   ├── treesitter.lua # Syntax highlighting and parsing
    │   └── markdown.lua  # Markdown rendering enhancements
    ├── editor/           # Text editing enhancements
    │   ├── ai.lua        # AI-powered coding assistance
    │   ├── formatter.lua # Code formatting tools
    │   ├── mini.lua      # Multi-purpose editing utilities
    │   ├── nvim-lint.lua # Code linting integration
    │   └── todo-comments.lua # TODO comment management
    ├── ui/               # User interface enhancements
    │   ├── theme.lua     # Color schemes and themes
    │   ├── noice.lua     # Enhanced UI components
    │   ├── dim.lua       # Window focus enhancement
    │   ├── reactive.lua  # Reactive visual feedback
    │   └── nvim-colorizer.lua # Color code visualization
    ├── navigation/       # Movement and navigation tools
    │   ├── leap.lua      # Fast motion and jumping
    │   ├── buffer.lua    # Buffer management
    │   └── nvim-window-picker.lua # Window selection
    └── tools/            # Utility tools and workflow helpers
        └── nvim-early-retirement.lua # Buffer lifecycle management
```

## Configuration Philosophy

### 1. **Separation of Concerns**
- **Core**: Fundamental Neovim settings that don't require plugins
- **Plugins**: External functionality organized by purpose
- **Extra**: Custom enhancements and experimental features

### 2. **Category-Based Plugin Organization**
- **Language**: Everything related to programming language support
- **Editor**: Core text editing enhancements and productivity tools
- **UI**: Visual improvements and interface enhancements
- **Navigation**: Movement, searching, and file/buffer navigation
- **Tools**: Workflow utilities and development helpers

### 3. **Lazy Loading Strategy**
- Plugins are configured for optimal startup performance
- Event-driven loading for better responsiveness
- Minimal impact on Neovim initialization time

## Key Features

### Language Support
- **LSP Integration**: Multi-language support with nvim-lspconfig
- **Modern Completion**: Blink.cmp for fast, intelligent completions
- **Syntax Highlighting**: Tree-sitter for accurate, fast highlighting
- **Markdown Enhancement**: Rich markdown rendering with custom features

### Editor Enhancements
- **AI Assistance**: GitHub Copilot integration for code suggestions
- **Multi-Language Formatting**: Support for 10+ languages and formatters
- **Essential Editing**: Auto-pairs, surround, indentation guides
- **Code Quality**: Integrated linting for JavaScript, TypeScript, Python
- **Project Management**: Built-in file explorer and git integration

### User Interface
- **Modern Theme**: Gruvbox with custom statusline integration
- **Enhanced UI**: Beautiful command line and message interfaces
- **Focus Management**: Visual dimming of inactive windows
- **Visual Feedback**: Reactive cursor and UI elements

### Navigation & Workflow
- **Lightning-Fast Movement**: Leap for instant jumps to any location
- **Efficient Fuzzy Finding**: Mini.pick for files and content search
- **Buffer Management**: Elegant buffer switching and automatic cleanup
- **Window Control**: Interactive window picker for complex layouts

## Configuration Loading

The configuration is loaded in this order:

1. **Performance Optimizations** (`init.lua` - lines 1-25)
2. **Core Settings** (`core/general.lua`)
3. **Plugin Manager Bootstrap** (`init.lua` - lazy.nvim setup)
4. **Plugin Specifications** (all `plugins/*/` directories)
5. **Key Mappings** (`core/utils.lua` - loaded after plugins)
6. **Extra Enhancements** (`extra/init.lua` - loaded asynchronously)

## Customization Guidelines

### Adding New Plugins

1. **Determine Category**: Place plugins in the appropriate directory
2. **Follow Naming**: Use descriptive filenames (prefer plugin name)
3. **Include Documentation**: Add purpose and configuration details
4. **Optimize Loading**: Use appropriate lazy loading events
5. **Update Index**: Add to the relevant `init.lua` documentation

### Modifying Existing Configuration

1. **Preserve Structure**: Maintain the categorical organization
2. **Keep Mappings Centralized**: Use `core/mappings.lua` for new keybinds
3. **Document Changes**: Update relevant documentation
4. **Test Thoroughly**: Ensure changes don't break existing functionality

### Performance Considerations

- Plugins are lazy-loaded where possible
- Startup time is optimized with disabled providers and plugins
- Heavy operations are scheduled to avoid blocking initialization
- Configuration complexity is balanced with maintainability

## Dependencies

- **Neovim 0.10+**: Required for modern Lua features and APIs
- **Lazy.nvim**: Plugin manager for efficient loading
- **External Tools**: Various formatters, linters, and LSP servers (auto-installed)

This structure provides a maintainable, organized, and performant Neovim configuration that scales well with additional plugins and customizations.