local M = {}
local mason = require("plugins.configs.mason")

M.setup = function()
	local null_ls = require("null-ls")
	local augroup = vim.api.nvim_create_augroup("LspFormatting", {})

	null_ls.setup({
		sources = {
			null_ls.builtins.formatting.stylua,
			null_ls.builtins.formatting.gofmt,
			null_ls.builtins.formatting.golines,
			null_ls.builtins.formatting.gofumpt,
			null_ls.builtins.formatting.goimports,
			null_ls.builtins.formatting.prettier,
			null_ls.builtins.formatting.shfmt,
			null_ls.builtins.formatting.yamlfmt,
			null_ls.builtins.diagnostics.golangci_lint.with({
				timeout = 60000,
			}),
			require("none-ls.diagnostics.eslint"),
			require("none-ls.diagnostics.yamllint"),
		},
		on_attach = function(client, bufnr)
			if client:supports_method("textDocument/formatting") then
				vim.api.nvim_clear_autocmds({ group = augroup, buffer = bufnr })
				vim.api.nvim_create_autocmd("BufWritePre", {
					group = augroup,
					buffer = bufnr,
					callback = function()
						if vim.b.format_on_save ~= false then
							vim.lsp.buf.format({ async = false })
						end
					end,
				})
			end

			vim.api.nvim_buf_create_user_command(bufnr, "ToggleFormatOnSave", function()
				if vim.b.format_on_save == nil then
					vim.b.format_on_save = false
				else
					vim.b.format_on_save = not vim.b.format_on_save
				end
				vim.notify(string.format("Format on save: %s", vim.b.format_on_save and "enabled" or "disabled"))
			end, {})
		end,
	})

	local sources = null_ls.get_sources()

	local source_changes = {
		["gofmt"] = "",
		["eslint"] = "",
		["golangci_lint"] = "golangci-lint",
	}
	local filtered_sources = vim.tbl_filter(function(source)
		if source_changes[source.name] then
			-- If new value is empty, ignore this source
			if source_changes[source.name] == "" then
				return false
			end
			-- Replace with new value
			source.name = source_changes[source.name]
		end
		return true
	end, sources)

	for _, source in ipairs(filtered_sources) do
		mason.install_package(source.name)
	end
end

return M
