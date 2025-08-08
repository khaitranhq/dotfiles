-- Mini.nvim configuration with utilities
-- Global utility functions for Mini.pick customization
local utils = require("config.mini.utils")

-- Expose global functions for compatibility
OverrideRipgrepConfig = utils.override_ripgrep_config
MiniFilesCopyRelativePath = utils.copy_relative_path

-- Setup all mini modules
local function setup_mini_modules()
	-- Basic modules with simple setup
	require("mini.pairs").setup()
	require("mini.surround").setup()
	require("mini.indentscope").setup({
		symbol = "│",
	})
	require("mini.trailspace").setup()
	require("mini.git").setup()
	require("mini.diff").setup({
		view = {
			style = "sign",
		},
	})

	-- Modules with custom configuration
	require("config.mini.pick").setup()
	require("config.mini.statusline").setup()
	require("config.mini.tabline").setup()
	require("config.mini.files").setup()
	require("config.mini.extra").setup()
end

-- Main plugin configuration
return {
	{
		"echasnovski/mini.nvim",
		version = "*",
		config = setup_mini_modules,
	},
}