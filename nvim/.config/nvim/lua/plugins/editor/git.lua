return {
	{
		"NeogitOrg/neogit",
		opts = {
			disable_line_numbers = false,
			disable_relative_line_numbers = false,
			sections = {
				recent = {
					folded = false,
				},
			},
		},
		dependencies = {
			"nvim-lua/plenary.nvim", -- required
			"sindrets/diffview.nvim", -- optional - Diff integration

			-- Only one of these is needed.
			"folke/snacks.nvim", -- optional
		},
	},
	{ "lewis6991/gitsigns.nvim" },
}
