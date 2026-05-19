local M = {}

M.setup = function()
	local null_ls = require("null-ls")
	local augroup = vim.api.nvim_create_augroup("LspFormatting", {})

	null_ls.setup({
		sources = {
			null_ls.builtins.formatting.stylua,
			null_ls.builtins.formatting.gofumpt,
			null_ls.builtins.formatting.golines,
			null_ls.builtins.formatting.goimports,
			null_ls.builtins.formatting.shfmt,
			null_ls.builtins.formatting.prettier.with({
				filetypes = {
					"astro",
					"css",
					"graphql",
					"handlebars",
					"html",
					"json",
					"jsonc",
					"less",
					"markdown",
					"scss",
					"svelte",
					"vue",
					"yaml",
				},
			}),
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
end

--- Install none-ls tool dependencies.
--- Should be called once after plugins are loaded (e.g. via :InstallTools command).
function M.install_tools()
	local mason = require("plugins.configs.mason")
	local null_ls = require("null-ls")

	local sources = null_ls.get_sources()

	for _, source in ipairs(sources) do
		mason.install_package(source.name)
	end
end

return M
