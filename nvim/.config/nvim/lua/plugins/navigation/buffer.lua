return {
	{
		"toppair/reach.nvim",
		dependencies = {
			"nvim-tree/nvim-web-devicons",
		},
		config = function()
			-- default config
			require("reach").setup({
				notifications = true,
			})
		end,
	},
}
