local lsp_config = {
	lua_ls = {
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
	docker_language_server = {},
	bashls = {},
	yamlls = {
		settings = {
			yaml = {
				schemas = {
					["https://json.schemastore.org/github-workflow.json"] = ".github/workflows/*.{yml,yaml}",
					["/home/khaitran/.config/nvim/lua/plugins/configs/bitbucket-pipelines-schema.json"] = "**/bitbucket-pipelines.yml",
				},
			},
		},
	},
	ts_ls = {
		on_attach = function(client, _)
			client.server_capabilities.documentFormattingProvider = false
		end,
		settings = {
			typescript = {
				inlayHints = { includeInlayParameterNameHints = "all", includeInlayVariableTypeHints = true },
			},
			javascript = {
				inlayHints = { includeInlayParameterNameHints = "all", includeInlayVariableTypeHints = true },
			},
		},
	},
	oxfmt = {
		root_dir = function(bufnr, on_dir)
			local fname = vim.api.nvim_buf_get_name(bufnr)

			-- Oxfmt resolves configuration by walking upward and using the nearest config file
			-- to the file being processed. We therefore compute the root directory by locating
			-- the closest `.oxfmtrc.json` / `.oxfmtrc.jsonc` / `oxfmt.config.ts` (or `package.json` fallback) above the buffer.
			local util = require("lspconfig.util")
			local root_markers =
				util.insert_package_json({ ".oxfmtrc.json", ".oxfmtrc.jsonc", "oxfmt.config.ts" }, "oxfmt", fname)
			root_markers = util.insert_package_json(root_markers, "vite%-plus", fname)

			root_markers = util.root_markers_with_field(root_markers, { "vite.config.ts" }, "vite%-plus", fname)

			local found = vim.fs.find(root_markers, { path = fname, upward = true })[1]
			on_dir(found and vim.fs.dirname(found) or vim.fn.getcwd())
		end,
		filetypes = {
			"javascript",
			"javascriptreact",
			"typescript",
			"typescriptreact",
			"toml",
			"json",
			"jsonc",
			"json5",
			"yaml",
			"html",
			"vue",
			"handlebars",
			"css",
			"scss",
			"less",
			"graphql",
			"markdown",
		},
	},
	oxlint = {},
	golangci_lint_ls = {},
	just = {},
	roslyn_ls = {},
	gopls = {
		settings = {
			gopls = {
				completeUnimported = true,
				gofumpt = true,
				staticcheck = true,
				analyses = {
					ST1000 = false,
					ST1003 = false,
					ST1005 = false,
					QF1003 = true,
					QF1007 = true,
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
	efm = {
		init_options = { documentFormatting = true },
		filetypes = { "lua", "go", "sh", "bash", "fish" },
		settings = {
			languages = {
				lua = {
					{ formatCommand = "stylua -", formatStdin = true },
				},
				go = {
					{ formatCommand = "golines --max-len=120", formatStdin = true },
				},
				-- TOOD: test
				sh = {
					{ formatCommand = "shfmt -filename", formatStdin = true },
				},
				bash = {
					{ formatCommand = "shfmt -filename", formatStdin = true },
				},
				fish = {
					{ formatCommand = "fish_indent", formatStdin = true },
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
	vim.g.format_on_save_enabled = true

	vim.api.nvim_create_user_command("ToggleFormatOnSave", function()
		vim.g.format_on_save_enabled = not vim.g.format_on_save_enabled
		vim.notify("Format on save: " .. (vim.g.format_on_save_enabled and "enabled" or "disabled"))
	end, {})

	-- Configure each LSP server using the new vim.lsp.config API
	for server, config in pairs(lsp_config) do
		vim.lsp.config(server, config)
	end

	-- Enable all configured LSP servers using the new vim.lsp.enable API
	local servers = vim.tbl_keys(lsp_config)
	vim.lsp.enable(servers)

	vim.lsp.inlay_hint.enable(true)

	require("blink.cmp").setup(blink_config)

	vim.api.nvim_create_autocmd("BufWritePre", {
		pattern = "*.go",
		callback = function()
			if not vim.g.format_on_save_enabled then
				return
			end
			local params = vim.lsp.util.make_range_params(0, "utf-8")
			params.context = { only = { "source.organizeImports" } }
			-- buf_request_sync defaults to a 1000ms timeout. Depending on your
			-- machine and codebase, you may want longer. Add an additional
			-- argument after params if you find that you have to write the file
			-- twice for changes to be saved.
			-- E.g., vim.lsp.buf_request_sync(0, "textDocument/codeAction", params, 3000)
			local result = vim.lsp.buf_request_sync(0, "textDocument/codeAction", params)
			for cid, res in pairs(result or {}) do
				for _, r in pairs(res.result or {}) do
					if r.edit then
						local enc = (vim.lsp.get_client_by_id(cid) or {}).offset_encoding or "utf-16"
						vim.lsp.util.apply_workspace_edit(r.edit, enc)
					end
				end
			end
			vim.lsp.buf.format({ async = false })
		end,
	})

	vim.api.nvim_create_autocmd("LspAttach", {
		group = vim.api.nvim_create_augroup("my.lsp", {}),
		callback = function(ev)
			local client = assert(vim.lsp.get_client_by_id(ev.data.client_id))

			-- Auto-format ("lint") on save.
			-- Usually not needed if server supports "textDocument/willSaveWaitUntil".
			if
				not client:supports_method("textDocument/willSaveWaitUntil")
				and client:supports_method("textDocument/formatting")
			then
				vim.api.nvim_create_autocmd("BufWritePre", {
					group = vim.api.nvim_create_augroup("my.lsp", { clear = false }),
					buffer = ev.buf,
					callback = function()
						if not vim.g.format_on_save_enabled then
							return
						end
						vim.lsp.buf.format({ bufnr = ev.buf, id = client.id, timeout_ms = 1000 })
					end,
				})
			end
		end,
	})
end

return M
