return {
	{
		"williamboman/mason-lspconfig.nvim",
		dependencies = "williamboman/mason.nvim",
		config = function()
			require("mason").setup()
			require("mason-lspconfig").setup({
				automatic_installation = true,
			})
		end,
	},
	{
		"WhoIsSethDaniel/mason-tool-installer.nvim",

		dependencies = "williamboman/mason.nvim",

		config = function()
			require("mason-tool-installer").setup({
				-- a list of all tools you want to ensure are installed upon
				-- start
				ensure_installed = {
					"stylua",
					"prettier",
					"shfmt",
					"yamlfmt",
				},
			})
		end,
	},
}
