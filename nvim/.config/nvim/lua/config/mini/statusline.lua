-- Mini.statusline configuration with custom Gruvbox styling
local colors = require("config.mini.colors").gruvbox_hard

local M = {}

-- Setup custom highlight groups for mini.statusline using Gruvbox colors
local function setup_statusline_highlights()
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

-- Setup Mini.statusline configuration
function M.setup()
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

return M