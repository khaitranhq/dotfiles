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
				ruby = { "rubyfmt" },
				go = { "golines" },
				rust = { "rustfmt" },
			},
		},
		config = function(_, opts)
			require("conform").setup(opts)
			require("conform").formatters.prettier = {
				append_args = { "--ignore-path", "" },
			}

			function Format()
				require("conform").format()
				vim.notify("Formatted", vim.log.levels.INFO, { title = "Conform" })
			end
		end,
	},
}
