local M = {}

function setup_theme()
	vim.cmd([[colorscheme tokyonight-night]])

	-- Customize trailing whitespace highlighting
	vim.api.nvim_set_hl(0, "Whitespace", {
		fg = "#f7768e", -- Bright red/pink - very noticeable
	})
end

M.setup = function()
	vim.pack.add({
		"https://github.com/khaitranhq/nvim-web-devicons",
		"https://github.com/khaitranhq/snacks.nvim",
		"https://github.com/khaitranhq/none-ls.nvim",
		"https://github.com/khaitranhq/none-ls-extras.nvim",
		-- TODO: remove this plugin in the future
		-- Ref:
		-- - https://github.com/nvim-lua/plenary.nvim#:~:text=This%20repository%20is%20no%20longer%20actively%20maintained%20and%20will%20be%20officially%20archived%20soon.
		-- - https://github.com/nvimtools/none-ls.nvim/issues/336
		"https://github.com/nvim-lua/plenary.nvim",
		"https://github.com/khaitranhq/tokyonight.nvim",
		-- NOTE: Hope that this plugin won't be attacked :)
		"https://github.com/neovim/nvim-lspconfig",
		"https://github.com/khaitranhq/gitsigns.nvim",
		"https://github.com/khaitranhq/blink.cmp",
		"https://codeberg.org/khaitranhq/leap.nvim",
		"https://github.com/khaitranhq/nvim-autopairs",
		"https://github.com/khaitranhq/lualine.nvim",
		"https://github.com/khaitranhq/nvim-surround",
		"https://github.com/khaitranhq/todo-comments.nvim",
		"https://github.com/khaitranhq/nvim-early-retirement",
		"https://github.com/khaitranhq/tree-sitter-manager.nvim",
		"https://github.com/khaitranhq/render-markdown.nvim",
		"https://github.com/khaitranhq/codediff.nvim",
		"https://github.com/khaitranhq/copilot.lua",
		"https://github.com/folke/lazydev.nvim.git",
		"https://github.com/khaitranhq/markview.nvim.git",
	})

	-- Load all setup() functions from plugins/configs folder
	local config_dir = vim.fn.stdpath("config") .. "/lua/plugins/configs"
	local configs = vim.fn.glob(config_dir .. "/*.lua", false, true)

	for _, config_file in ipairs(configs) do
		local module_name = vim.fn.fnamemodify(config_file, ":t:r")
		local ok, config = pcall(require, "plugins.configs." .. module_name)

		if ok and config and type(config.setup) == "function" then
			config.setup()
		elseif not ok then
			vim.notify("Failed to load config: " .. module_name, vim.log.levels.WARN)
		end
	end

	require("nvim-autopairs").setup({})
	require("early-retirement").setup({})
	require("codediff").setup({
		explorer = {
			view_mode = "tree",
		},
	})
	require("copilot").setup({
		suggestion = {
			auto_trigger = true,
		},
		filetypes = {
			yaml = true,
			markdown = true,
		},
	})
	require("render-markdown").setup({
		checkbox = {
			unchecked = { icon = "" },
			checked = { icon = "", scope_highlight = "@markup.strikethrough" },
			custom = {
				doing = { raw = "[=]", rendered = "▶" },
			},
		},
	})
	require("todo-comments").setup({})
	require("tree-sitter-manager").setup({
		auto_install = true, -- Automatically install missing parsers when entering buffer
	})

	setup_theme()
end

return M
