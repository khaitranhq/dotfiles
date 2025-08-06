-- Mini.nvim configuration with utilities
-- Global utility functions for Mini.pick customization

local M = {}

-- Gruvbox hard variant color palette
-- Extracted for reusability and maintainability
M.gruvbox_hard = {
	bg0 = "#1d2021", -- darkest background
	bg1 = "#3c3836", -- dark gray
	bg2 = "#504945", -- medium gray
	bg3 = "#665c54", -- light gray
	fg0 = "#ebdbb2", -- foreground
	fg1 = "#928374", -- muted foreground
	red = "#cc241d", -- error red
	green = "#98971a", -- success green
	yellow = "#d65d0e", -- warning orange
	blue = "#458588", -- info blue
	purple = "#b16286", -- replace mode
	aqua = "#689d6a", -- special
	orange = "#d65d0e", -- warning
}

-- File picker with icons using fd command
-- Excludes common build/cache directories for better performance
function MiniPickFilesWithIcons()
	local command = {
		"fd",
		"--type=f",
		"--no-follow",
		"--color=never",
		"--hidden",
		"--no-ignore",
		"--exclude=.git",
		"--exclude=.cache",
		"--exclude=__pycache__",
		"--exclude=node_modules",
		"--exclude=vendor",
		"--exclude=.venv",
		"--exclude=.idea",
		"--exclude=.vscode",
		"--exclude=.DS_Store",
		"--exclude=venv",
		"--exclude=.tmp",
		"--exclude=dist",
	}

	local show_with_icons = function(buf_id, items, query)
		return MiniPick.default_show(buf_id, items, query, { show_icons = true })
	end

	local source = { name = "Files fd", show = show_with_icons }
	return MiniPick.builtin.cli({ command = command }, { source = source })
end

-- Grep with custom ripgrep configuration
-- Temporarily sets RIPGREP_CONFIG_PATH to use nvim-specific config
function MiniPickGrepWithConfig(f)
	local rg_env = "RIPGREP_CONFIG_PATH"
	local cached_rg_config = vim.uv.os_getenv(rg_env) or ""
	vim.uv.os_setenv(rg_env, vim.fn.stdpath("config") .. "/.rg")
	f()
	vim.uv.os_setenv(rg_env, cached_rg_config)
end

-- Setup custom highlight groups for mini.statusline using Gruvbox colors
local function setup_statusline_highlights()
	local colors = M.gruvbox_hard

	-- Mode-specific highlights with bold styling
	local mode_highlights = {
		MiniStatuslineModeNormal = { fg = colors.bg0, bg = colors.blue, bold = true },
		MiniStatuslineModeInsert = { fg = colors.bg0, bg = colors.green, bold = true },
		MiniStatuslineModeVisual = { fg = colors.bg0, bg = colors.yellow, bold = true },
		MiniStatuslineModeReplace = { fg = colors.bg0, bg = colors.purple, bold = true },
		MiniStatuslineModeCommand = { fg = colors.bg0, bg = colors.red, bold = true },
		MiniStatuslineModeOther = { fg = colors.bg0, bg = colors.aqua, bold = true },
	}

	-- Section-specific highlights
	local section_highlights = {
		MiniStatuslineDevinfo = { fg = colors.fg0, bg = colors.bg2 },
		MiniStatuslineFilename = { fg = colors.fg0, bg = colors.bg1 },
		MiniStatuslineFileinfo = { fg = colors.fg1, bg = colors.bg2 },
		MiniStatuslineInactive = { fg = colors.bg3, bg = colors.bg1 },
	}

	-- Apply all highlights
	for name, opts in pairs(mode_highlights) do
		vim.api.nvim_set_hl(0, name, opts)
	end

	for name, opts in pairs(section_highlights) do
		vim.api.nvim_set_hl(0, name, opts)
	end
end

-- Mini.pairs configuration
local function setup_pairs()
	require("mini.pairs").setup()
end

-- Mini.surround configuration
local function setup_surround()
	require("mini.surround").setup()
end

-- Mini.pick configuration with custom registry
local function setup_pick()
	require("mini.pick").setup()
	-- Register custom file picker
	MiniPick.registry.files_fd = MiniPickFilesWithIcons
end

-- Mini.indentscope configuration
local function setup_indentscope()
	require("mini.indentscope").setup({
		symbol = "│",
	})
end

-- Mini.statusline configuration with custom Gruvbox styling
local function setup_statusline()
	require("mini.statusline").setup()

	-- Apply initial highlights
	setup_statusline_highlights()

	-- Reapply highlights when colorscheme changes
	vim.api.nvim_create_autocmd("ColorScheme", {
		pattern = "*",
		callback = setup_statusline_highlights,
		desc = "Apply Gruvbox hard variant colors to mini.statusline",
	})
end

-- Mini.tabline configuration with custom formatting
local function setup_tabline()
	require("mini.tabline").setup({
		format = function(buf_id, label)
			local suffix = vim.bo[buf_id].modified and "+ " or ""
			return " " .. buf_id .. MiniTabline.default_format(buf_id, label) .. suffix
		end,
	})
end

-- Mini.trailspace configuration
local function setup_trailspace()
	require("mini.trailspace").setup()
end

-- Main plugin configuration
return {
	{
		"echasnovski/mini.nvim",
		version = "*",
		config = function()
			-- Setup all mini modules
			setup_pairs()
			setup_surround()
			setup_pick()
			setup_indentscope()
			setup_statusline()
			setup_tabline()
			setup_trailspace()
		end,
	},
}

