vim.api.nvim_create_autocmd({ "BufWritePost" }, {
	callback = function()
		require("lint").try_lint()
	end,
})

return {
	{
		"mfussenegger/nvim-lint",
		config = function()
			require("lint").linters_by_ft = {
				javascript = { "eslint" },
				typescript = { "eslint" },
				typescriptreact = { "eslint" },
				python = { "mypy" },
			}

			require("lint").linters.mypy.args = {
				"--ignore-missing-imports",
				"--show-column-numbers",
			}
		end,
	},
}
