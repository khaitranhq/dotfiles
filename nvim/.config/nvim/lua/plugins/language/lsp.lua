return {
	{
		"neovim/nvim-lspconfig",
		event = { "BufReadPre", "BufNewFile" }, -- Lazy load LSP
		dependencies = {
			{ "saghen/blink.cmp" },
		},
		opts = {
			servers = {
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
							staticcheck = true,
							analyses = {
                ST1000 = false,
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
						},
					},
				},
				clangd = {},
				bashls = {},
				cssls = {},
        csharp_ls = {},
				jsonls = {},
				docker_language_server = {},
				docker_compose_language_service = {},
				rust_analyzer = {
					settings = {
						["rust-analyzer"] = {
							diagnostics = {
								enable = false,
							},
						},
					},
				},
			},
		},
		config = function(_, opts)
			-- Configure each LSP server using the new vim.lsp.config API
			for server, config in pairs(opts.servers) do
				vim.lsp.config(server, config)
			end

			-- Enable all configured LSP servers using the new vim.lsp.enable API
			local servers = vim.tbl_keys(opts.servers)
			vim.lsp.enable(servers)

			-- Setup LSP autocommands
			vim.api.nvim_create_autocmd("LspAttach", {
				group = vim.api.nvim_create_augroup("UserLspConfig", {}),
				callback = function(ev)
					-- Enable completion triggered by <c-x><c-o>
					vim.bo[ev.buf].omnifunc = "v:lua.vim.lsp.omnifunc"
				end,
			})
		end,
	},
	{
		"saghen/blink.cmp",
		version = "*",
		opts = {
			keymap = {
				preset = "default",
			},
			completion = {
				documentation = { auto_show = true, auto_show_delay_ms = 200 },
			},

			appearance = {
				use_nvim_cmp_as_default = true,
				nerd_font_variant = "mono",
			},

			sources = {
				default = { "lazydev", "lsp", "path", "snippets", "buffer" },
				providers = {
					lazydev = {
						name = "LazyDev",
						module = "lazydev.integrations.blink",
						score_offset = 100,
					},
				},
			},
			fuzzy = { implementation = "prefer_rust" },
		},
		opts_extend = { "sources.default" },
		dependencies = {
			"rafamadriz/friendly-snippets",
			{
				"folke/lazydev.nvim",
				ft = "lua", -- only load on lua files
				opts = {
					library = {
						{ path = "${3rd}/luv/library", words = { "vim%.uv" } },
						{ path = "snacks.nvim", words = { "Snacks" } },
						{ path = "lazy.nvim", words = { "LazyVim" } },
					},
				},
			},
		},
	},
}
