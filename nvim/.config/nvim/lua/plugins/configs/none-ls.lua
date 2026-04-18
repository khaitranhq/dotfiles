local M = {}

local function install_package(package_name)
	local registry = require("mason-registry")
	-- Check if the package exists in the registry
	if registry.has_package(package_name) then
		local pkg = registry.get_package(package_name)

		-- Install only if not already installed
		if not pkg:is_installed() then
			print("Installing " .. package_name)
			pkg:install():once("closed", function()
				print(package_name .. " installed successfully!")
			end)
		end
	else
		print("Package " .. package_name .. " not found.")
	end
end

M.setup = function()
	local null_ls = require("null-ls")
	local augroup = vim.api.nvim_create_augroup("LspFormatting", {})

	-- Check if MasonInstall command exists, if not setup mason first
	if vim.fn.exists(":MasonInstall") == 0 then
		require("mason").setup()
	end

	-- List of tools to install via mason
	local tools_to_install = {
		"stylua",
		"golines",
		"gofumpt",
		"goimports",
		"prettier",
		"black",
		"shfmt",
		"yamlfmt",
		"golangci-lint",
		"yamllint",
	}

	for _, tool in ipairs(tools_to_install) do
		install_package(tool)
	end

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
end

return M
