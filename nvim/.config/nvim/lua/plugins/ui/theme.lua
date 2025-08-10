return {
	{
		"ellisonleao/gruvbox.nvim",
		priority = 1000,
		opts = {
			contrast = "hard",
		},
		config = function()
			vim.cmd("colorscheme gruvbox")
			vim.o.background = "dark"
		end,
	},
}
