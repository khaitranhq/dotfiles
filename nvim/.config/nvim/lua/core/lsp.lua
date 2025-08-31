local M = {}

local lsp_servers = {
	lua_ls = {
		settings = {
			Lua = {
				diagnostics = {
					globals = { "vim" },
				},
			},
		},
	},
	pyright = {
		settings = {
			pyright = {
				-- Using Ruff's import organizer
				disableOrganizeImports = true,
			},
			python = {
				analysis = {
					-- Ignore all files for analysis to exclusively use Ruff for linting
					ignore = { "*" },
				},
			},
		},
	},
	ts_ls = {
		init_options = {
			preferences = {
				disableSuggestions = true,
			},
		},
	},
	gopls = {
		settings = {
			gopls = {
				completeUnimported = true,
				-- staticcheck = true,
				analysis = {
					QF1003 = true,
					QF1007 = true,
					ST1003 = true,
					fieldalignment = true,
					unusedparams = true,
					unusedfuncs = true,
					unreachable = true,
					useany = true,
				},
				hints = {
					assignVariableTypes = true,
					compositeLiteralFields = true,
					compositeLiteralTypes = true,
					constantValues = true,
					functionTypeParameters = true,
					parameterNames = true,
					rangeVariableTypes = true,
				},
			},
		},
	},
	bashls = {},
	jsonls = {},
	dockerls = {},
	csharp_ls = {},
	docker_compose_language_service = {},
}

M.setup = function()
	-- Enable all configured LSP servers using the new vim.lsp.enable API
	local servers = vim.tbl_keys(lsp_servers)
	vim.lsp.enable(servers)

	-- Configure each LSP server using the new vim.lsp.config API
	for server, config in pairs(lsp_servers) do
		vim.lsp.config(server, config)
	end

	-- Setup LSP autocommands
	vim.api.nvim_create_autocmd("LspAttach", {
		group = vim.api.nvim_create_augroup("UserLspConfig", {}),
		callback = function(ev)
			-- Enable completion triggered by <c-x><c-o>
			vim.bo[ev.buf].omnifunc = "v:lua.vim.lsp.omnifunc"
		end,
	})
end

return M
