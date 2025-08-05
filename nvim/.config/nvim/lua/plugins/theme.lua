return {
	-- {
	-- 	"catppuccin/nvim",
	-- 	name = "catppuccin",
	-- 	priority = 1000,
	-- 	config = function()
	-- 		require("catppuccin").setup({
	-- 			flavour = "macchiato",
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
	-- 		vim.cmd.colorscheme("catppuccin")
	-- 	end,
	-- },
	{
		"https://gitlab.com/motaz-shokry/gruvbox.nvim",
		name = "gruvbox",
		priority = 1000,
		config = function()
			vim.cmd("colorscheme gruvbox")
		end,
	},
}
