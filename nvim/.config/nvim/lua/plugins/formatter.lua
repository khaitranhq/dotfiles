function Format()
	require("conform").format()
	vim.notify("Formatted", vim.log.levels.INFO, { title = "Conform" })
end

return {
	{
		"stevearc/conform.nvim",
		opts = {
			formatters_by_ft = {
				lua = { "stylua" },
				css = { "prettier" },
				html = { "prettier" },
				javascript = { "prettier" },
				json = { "prettier" },
				typescript = { "prettier" },
				typescriptreact = { "prettier" },
				markdown = { "prettier" },
				python = { "ruff" },
				sh = { "shfmt" },
				cpp = { "clang-format" },
				yaml = { "yamlfmt" },
				-- terraform = { "terraform_fmt" },
				go = { "golines" },
				-- rust = { "rustfmt", lsp_format = "fallback" },
			},
		},
	},
}
