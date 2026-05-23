-- Neovim Core Options Configuration
-- This module sets up fundamental Neovim editor behavior and performance optimizations.
-- All settings are organized by functionality for better maintainability.

local opt = vim.opt
local g = vim.g

opt.winborder = "rounded" -- Use single line borders for floating windows

-- Indentation and formatting
opt.tabstop = 2 -- Number of spaces that a <Tab> in the file counts for
opt.shiftwidth = 2 -- Number of spaces to use for each step of (auto)indent
opt.expandtab = true -- Use spaces instead of tabs
opt.smartindent = true -- Smart autoindenting when starting a new line

-- Line numbers and visual guides
opt.relativenumber = true -- Show relative line numbers
opt.signcolumn = "yes" -- Always show sign column to prevent layout shifts

opt.wrap = true
opt.showbreak = "↪ "

-- Whitespace visualization
opt.list = true -- Show invisible characters
opt.listchars = {
	trail = "·", -- Show trailing spaces with a middle dot
	tab = "▎ ",
} -- Hide end-of-buffer tildes

-- SYSTEM INTEGRATION

opt.clipboard = "unnamedplus" -- Use system clipboard for all operations

-- Terminal and color support
opt.termguicolors = true -- Enable 24-bit RGB color support
opt.mouse = "a" -- Enable mouse support in all modes

-- Auto-read external file changes
opt.autoread = true
vim.api.nvim_create_autocmd({ "BufEnter", "CursorHold", "CursorHoldI", "FocusGained" }, {
	desc = "Check for external file changes",
	command = "if mode() != 'c' | checktime | endif",
	pattern = "*",
})

-- FOLDING CONFIGURATION

opt.foldmethod = "expr" -- Use expression-based folding
opt.foldexpr = "v:lua.vim.treesitter.foldexpr()" -- Use Treesitter for folding
opt.foldtext = "" -- Use default fold text (cleaner appearance)
opt.foldlevel = 99 -- Start with all folds open
opt.foldlevelstart = 99 -- Always start editing with all folds open

-- PERSISTENT UNDO CONFIGURATION

local function setup_undo_directory()
	local undo_dir = vim.fn.stdpath("state") .. "/undo"

	-- Create undo directory if it doesn't exist
	if vim.fn.isdirectory(undo_dir) == 0 then
		vim.fn.mkdir(undo_dir, "p", 448) -- 0700 in octal = 448 in decimal
	end

	opt.undodir = undo_dir
	opt.undofile = true -- Enable persistent undo
	opt.undolevels = 10000 -- Maximum number of undos
	opt.undoreload = 10000 -- Maximum lines to save for undo on buffer reload
end

setup_undo_directory()

-- PERFORMANCE OPTIMIZATIONS

-- File handling
opt.swapfile = false -- Disable swap files (we have persistent undo)
opt.backup = false -- Disable backup files

-- Timing and responsiveness
opt.updatetime = 250 -- Faster completion and diagnostics (default: 4000ms)
opt.timeoutlen = 500 -- Faster which-key popup (default: 1000ms)
opt.ttimeoutlen = 10 -- Faster key sequence completion

-- SPELL CHECKING

opt.spelllang = { "en_us" } -- Spell check language
opt.spellsuggest = "best,9" -- Suggest 9 best corrections

-- Enable spell check for specific file types
vim.api.nvim_create_autocmd("FileType", {
	desc = "Enable spell check for text-based files",
	pattern = { "markdown", "text", "gitcommit", "tex", "rst", "asciidoc" },
	callback = function()
		vim.opt_local.spell = true
	end,
})

-- GLOBAL SETTINGS

g.markdown_recommended_style = 0

-- Leader key
g.mapleader = " " -- Set space as leader key
-- g.maplocalleader = "\\" -- Set backslash as local leader

-- PROVIDER CONFIGURATION
-- Disable unnecessary providers for faster startup

g.loaded_perl_provider = 0 -- Disable Perl provider
g.loaded_ruby_provider = 0 -- Disable Ruby provider
g.loaded_node_provider = 0 -- Disable Node.js provider
g.loaded_python3_provider = 0 -- Disable Python 3 provider (enable if using Python-based plugins)

-- BUILT-IN PLUGIN MANAGEMENT
-- Disable unused built-in plugins for faster startup

local disabled_built_ins = {
	"gzip",
	"zip",
	"zipPlugin",
	"tar",
	"tarPlugin",
	"getscript",
	"getscriptPlugin",
	"vimball",
	"vimballPlugin",
	"2html_plugin",
	"logipat",
	"rrhelper",
	"spellfile_plugin",
	"matchit",
	-- "netrw",
	-- "netrwPlugin",
	-- "netrwSettings",
	-- "netrwFileHandlers",
}

for _, plugin in ipairs(disabled_built_ins) do
	g["loaded_" .. plugin] = 1
end

-- ADDITIONAL EDITOR ENHANCEMENTS

-- Completion options
opt.completeopt = { "menu", "menuone", "noselect", "popup" } -- Better completion experience
opt.pumheight = 10 -- Maximum items in popup menu
opt.pumblend = 10 -- Popup menu transparency

-- Command line
opt.cmdheight = 1 -- Command line height
opt.showmode = false -- Don't show mode (handled by statusline)

-- Session handling
opt.sessionoptions = {
	"buffers",
	"curdir",
	"tabpages",
	"winsize",
	"help",
	"globals",
	"skiprtp",
	"folds",
}

-- Wildmenu (command completion)
opt.wildmode = { "longest:full", "full" } -- Command completion behavior
opt.wildignore:append({
	"*.o",
	"*.obj",
	"*.dylib",
	"*.bin",
	"*.dll",
	"*.exe",
	"*/.git/*",
	"*/.svn/*",
	"*/__pycache__/*",
	"*/build/**",
	"*.jpg",
	"*.png",
	"*.jpeg",
	"*.gif",
	"*.ico",
	"*.pdf",
	"*.pyc",
	"*.pyo",
	"*.class",
	"*.cache",
})

-- Diff options
opt.diffopt:append({ "iwhite", "algorithm:patience", "indent-heuristic" })

-- Lsp signs
local signs = {
	Error = "󰅚",
	Warn = "󰀪",
	Hint = "󰌶",
	Info = "ℹ",
}

vim.diagnostic.config({
	signs = {
		text = {
			[vim.diagnostic.severity.ERROR] = signs.Error,
			[vim.diagnostic.severity.WARN] = signs.Warn,
			[vim.diagnostic.severity.HINT] = signs.Hint,
			[vim.diagnostic.severity.INFO] = signs.Info,
		},
		linehl = {
			[vim.diagnostic.severity.ERROR] = "DiagnosticSignError",
			[vim.diagnostic.severity.WARN] = "DiagnosticSignWarn",
			[vim.diagnostic.severity.HINT] = "DiagnosticSignHint",
			[vim.diagnostic.severity.INFO] = "DiagnosticSignInfo",
		},
		numhl = {
			[vim.diagnostic.severity.ERROR] = "DiagnosticSignError",
			[vim.diagnostic.severity.WARN] = "DiagnosticSignWarn",
			[vim.diagnostic.severity.HINT] = "DiagnosticSignHint",
			[vim.diagnostic.severity.INFO] = "DiagnosticSignInfo",
		},
	},
	virtual_text = true,
})
