return {
	{
		"stevearc/oil.nvim",
		---@module 'oil'
		---@type oil.SetupOpts
		opts = {},
		-- Optional dependencies
		dependencies = { "nvim-tree/nvim-web-devicons", "refractalize/oil-git-status.nvim" },
		-- Lazy loading is not recommended because it is very tricky to make it work correctly in all situations.
		lazy = false,
		config = function()
			require("oil").setup({
				columns = {
					"icon",
					"permissions",
					"size",
				},
				keymaps = {
					["q"] = { "actions.close", mode = "n" },
				},
				view_options = {
					-- Show files and directories that start with "."
					show_hidden = true,
				},
			})
			require("oil-git-status").setup()
		end,
	},
}
