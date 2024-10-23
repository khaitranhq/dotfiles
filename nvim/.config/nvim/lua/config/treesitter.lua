return {
	{
		"nvim-treesitter/nvim-treesitter",
		dependencies = {
			"windwp/nvim-ts-autotag",
		},
		config = function()
			require("nvim-treesitter.configs").setup({
        modules = {},
				ensure_installed = {},
        ignore_install = {},
				-- Install parsers synchronously (only applied to `ensure_installed`)
				sync_install = true,
				-- Automatically install missing parsers when entering buffer
				auto_install = true,

				highlight = {
					-- `false` will disable the whole extension
					enable = true,

					additional_vim_regex_highlighting = false,
				},
				autotag = {
					enable = true,
				},
			})
		end,
	},
}
