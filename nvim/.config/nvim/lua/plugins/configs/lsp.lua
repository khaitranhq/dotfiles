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
}

local blink_config = {
	keymap = {
		preset = "default",
	},
	completion = {
		documentation = { auto_show = true, auto_show_delay_ms = 500 },
	},

	appearance = {
		nerd_font_variant = "normal",
	},

	sources = {
		default = { "lsp", "path", "buffer" },
		providers = {
			buffer = {
				max_items = 4, -- Limit buffer completion items
				min_keyword_length = 3, -- Require 3 chars before buffer completion
			},
		},
	},
	fuzzy = {
		implementation = "prefer_rust",
		prebuilt_binaries = {
			force_version = "v1.9.1",
		},
	},
}

local M = {}

M.setup = function()
	-- Configure each LSP server using the new vim.lsp.config API
	for server, config in pairs(lsp_config) do
		vim.lsp.config(server, config)
	end

	-- Enable all configured LSP servers using the new vim.lsp.enable API
	local servers = vim.tbl_keys(lsp_config)
	vim.lsp.enable(servers)

	vim.defer_fn(function()
		vim.lsp.inlay_hint.enable()
	end, 100)

	require("blink.cmp").setup(blink_config)
end

return M
