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
				python = { "black" },
				sh = { "shfmt" },
				cpp = { "clang-format" },
				yaml = { "yamlfmt" },
				terraform = { "terraform_fmt" },
				go = { "golines" },
				rust = { "rustfmt", lsp_format = "fallback" },
			},
		},
	},
}
