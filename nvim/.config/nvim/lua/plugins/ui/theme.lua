return {
	-- {
	-- 	"catppuccin/nvim",
	-- 	name = "catppuccin",
	-- 	priority = 1000,
	-- 	config = function()
	-- 		require("catppuccin").setup({
	-- 			flavour = "mocha",
	-- 			integrations = {
	-- 				cmp = true,
	-- 				gitsigns = true,
	-- 				nvimtree = true,
	-- 				treesitter = true,
	-- 				leap = true,
	-- 				lsp_saga = true,
	-- 				markdown = true,
	-- 				mason = true,
	-- 				noice = true,
	-- 				copilot_vim = true,
	-- 				render_markdown = true,
	-- 			},
	-- 		})
	-- 		-- vim.cmd.colorscheme("catppuccin")
	-- 	end,
	-- },
	-- {
	-- 	"sainnhe/gruvbox-material",
	-- 	lazy = false,
	-- 	priority = 1000,
	-- 	config = function()
	-- 		-- Optionally configure and load the colorscheme
	-- 		-- directly inside the plugin declaration.
	-- 		-- vim.g.gruvbox_material_enable_italic = true
	-- 		-- vim.g.gruvbox_material_background = "hard"
	-- 		-- vim.cmd.colorscheme("gruvbox-material")
	-- 	end,
	-- },
	{
		"ellisonleao/gruvbox.nvim",
		priority = 1000,
		config = function()
			require("gruvbox").setup({
				contrast = "hard", -- can be "soft", or "hard"
			})
			vim.o.background = "dark" -- or "light" for light mode
			vim.cmd([[colorscheme gruvbox]])
		end,
	},
}
