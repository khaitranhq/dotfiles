local lsp_config = {
	lua_ls = {
		mason_package = "lua-language-server",
		settings = {
			Lua = {
				diagnostics = {
					globals = { "vim", "Linemode" },
				},
				hint = {
					enable = true, -- necessary
				},
			},
		},
	},
	docker_language_server = {
		mason_package = "dockerfile-language-server",
	},
	bashls = {
		mason_package = "bash-language-server",
	},
	ts_ls = {
		mason_package = "typescript-language-server",
	},
	omnisharp = {},
	oxfmt = {},
	oxlint = {},
	golangci_lint_ls = {},
	roslyn_ls = {},
	gopls = {
		settings = {
			gopls = {
				completeUnimported = true,
				staticcheck = true,
				analyses = {
					ST1000 = false,
					ST1005 = false,
					QF1003 = true,
					QF1007 = true,
					ST1003 = true,
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
				codelenses = {
					gc_details = false,
					generate = false,
					regenerate_cgo = false,
					test = false,
					tidy = false,
					upgrade_dependency = false,
					vendor = false,
				},
			},
		},
	},
}

local blink_config = {
	keymap = {
		preset = "default",
	},

	completion = {
		documentation = { auto_show = true, auto_show_delay_ms = 500 },
	},

	cmdline = {
		enabled = true,
	},

	appearance = {
		nerd_font_variant = "normal",
	},

	sources = {
		default = { "lsp", "path", "buffer", "cmdline", "snippets", "omni" },
		providers = {
			buffer = {
				max_items = 4, -- Limit buffer completion items
				min_keyword_length = 3, -- Require 3 chars before buffer completion
			},
		},
	},
	fuzzy = {
		prebuilt_binaries = {
			force_version = "v1.10.2",
		},
	},
}

local M = {}

M.setup = function()
	local mason = require("plugins.configs.mason")

	-- Install LSP servers
	for server in pairs(lsp_config) do
		if lsp_config[server].mason_package then
			mason.install_package(lsp_config[server].mason_package)
		else
			mason.install_package(server)
		end
	end

	-- Configure each LSP server using the new vim.lsp.config API
	for server, config in pairs(lsp_config) do
		vim.lsp.config(server, config)
	end

	-- Enable all configured LSP servers using the new vim.lsp.enable API
	local servers = vim.tbl_keys(lsp_config)
	vim.lsp.enable(servers)

	vim.lsp.inlay_hint.enable(true)

	require("blink.cmp").setup(blink_config)
end

return M
