return {
	{
		"nvim-tree/nvim-web-devicons",
		config = function()
			require("nvim-web-devicons").setup({
				override = {
					gitignore = {
						icon = "",
						color = "#384d54",
						name = "Gitignore",
					},
				},
			})
		end,
	},
}
