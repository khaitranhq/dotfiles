return {
	{
		"nvimtools/none-ls.nvim",
		config = function()
			local null_ls = require("null-ls")
			null_ls.setup({
				sources = {
					null_ls.builtins.formatting.stylua,
          null_ls.builtins.formatting.golines,
          null_ls.builtins.formatting.prettier,
          null_ls.builtins.formatting.shfmt,
          null_ls.builtins.formatting.yamlfmt,
					null_ls.builtins.completion.spell,
					null_ls.builtins.diagnostics.golangci_lint,
					null_ls.builtins.diagnostics.eslint,
					null_ls.builtins.diagnostics.yamllint,
				},
			})
		end,
	},
}
