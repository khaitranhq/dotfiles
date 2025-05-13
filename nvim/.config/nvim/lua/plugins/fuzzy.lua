return {
	{
		"folke/snacks.nvim",
		priority = 1000,
		lazy = false,
		opts = {
			indent = {},
			-- input = {},
			lazygit = {},
			picker = {
				sources = {
					files = {
						ignored = true,
						hidden = true,
						exclude = { ".git", "node_modules", "dist", ".venv", "venv", ".mypy_cache", ".aider*", ".tmp" },
					},
				},
			},
		},
	},
}
