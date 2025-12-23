return {
  {
    "neovim/nvim-lspconfig",
    -- event = { "BufReadPre", "BufNewFile" }, -- Lazy load LSP
    dependencies = {
      { "saghen/blink.cmp" },
    },
    opts = {
      servers = {
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
          handlers = {
            -- Override the default rename handler to remove the `annotationId` from edits.
            --
            -- Pyright is being non-compliant here by returning `annotationId` in the edits, but not
            -- populating the `changeAnnotations` field in the `WorkspaceEdit`. This causes Neovim to
            -- throw an error when applying the workspace edit.
            --
            -- See:
            -- - https://github.com/neovim/neovim/issues/34731
            -- - https://github.com/microsoft/pyright/issues/10671
            [vim.lsp.protocol.Methods.textDocument_rename] = function(err, result, ctx)
              if err then
                vim.notify("Pyright rename failed: " .. err.message, vim.log.levels.ERROR)
                return
              end

              ---@cast result lsp.WorkspaceEdit
              for _, change in ipairs(result.documentChanges or {}) do
                for _, edit in ipairs(change.edits or {}) do
                  if edit.annotationId then
                    edit.annotationId = nil
                  end
                end
              end

              local client = assert(vim.lsp.get_client_by_id(ctx.client_id))
              vim.lsp.util.apply_workspace_edit(result, client.offset_encoding)
            end,
          },
        },
        ts_ls = {
          init_options = {
            preferences = {
              disableSuggestions = true,
            },
          },
          settings = {
            typescript = {
              inlayHints = {
                includeInlayParameterNameHints = "all",
                includeInlayParameterNameHintsWhenArgumentMatchesName = true,
                includeInlayFunctionParameterTypeHints = true,
                includeInlayVariableTypeHints = true,
                includeInlayVariableTypeHintsWhenTypeMatchesName = true,
                includeInlayPropertyDeclarationTypeHints = true,
                includeInlayFunctionLikeReturnTypeHints = true,
                includeInlayEnumMemberValueHints = true,
              },
            },
            javascript = {
              inlayHints = {
                includeInlayParameterNameHints = "all",
                includeInlayParameterNameHintsWhenArgumentMatchesName = true,
                includeInlayFunctionParameterTypeHints = true,
                includeInlayVariableTypeHints = true,
                includeInlayVariableTypeHintsWhenTypeMatchesName = true,
                includeInlayPropertyDeclarationTypeHints = true,
                includeInlayFunctionLikeReturnTypeHints = true,
                includeInlayEnumMemberValueHints = true,
              },
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
            },
          },
        },
        clangd = {},
        bashls = {},
        csharp_ls = {},
        jsonls = {},
        terraformls = {
          filetypes = { "tf", "tfvars", "terraform", "terragrunt" },
        },
        docker_language_server = {},
        docker_compose_language_service = {},
        rust_analyzer = {
          settings = {
            ["rust-analyzer"] = {
              diagnostics = {
                enable = true,
              },
              inlayHints = {
                bindingModeHints = {
                  enable = false,
                },
                chainingHints = {
                  enable = true,
                },
                closingBraceHints = {
                  enable = true,
                  minLines = 25,
                },
                closureReturnTypeHints = {
                  enable = "never",
                },
                lifetimeElisionHints = {
                  enable = "never",
                  useParameterNames = false,
                },
                maxLength = 25,
                parameterHints = {
                  enable = true,
                },
                reborrowHints = {
                  enable = "never",
                },
                renderColons = true,
                typeHints = {
                  enable = true,
                  hideClosureInitialization = false,
                  hideNamedConstructor = false,
                },
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

      vim.lsp.inlay_hint.enable()
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
            { path = "snacks.nvim",        words = { "Snacks" } },
            { path = "lazy.nvim",          words = { "LazyVim" } },
          },
        },
      },
    },
  },
}
