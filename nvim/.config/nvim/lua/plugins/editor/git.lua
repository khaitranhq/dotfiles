return {
	{
		"akinsho/git-conflict.nvim",
		version = "*",
		config = true,
	},
	{
		"lewis6991/gitsigns.nvim",
		config = function()
			require("gitsigns").setup({
				current_line_blame = true, -- Toggle with `:Gitsigns toggle_current_line_blame`
			})
			vim.opt.statusline:append("%{get(b:,'gitsigns_status','')}")
		end,
	},
	{
		"NeogitOrg/neogit",
		dependencies = {
			"nvim-lua/plenary.nvim", -- required
			"sindrets/diffview.nvim", -- optional - Diff integration

			-- Only one of these is needed.
			"folke/snacks.nvim", -- optional
		},
	},
}
