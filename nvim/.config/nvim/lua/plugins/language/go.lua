return {
	{
		"ray-x/go.nvim",
		dependencies = { -- optional packages
			"ray-x/guihua.lua",
			"neovim/nvim-lspconfig",
			"nvim-treesitter/nvim-treesitter",
		},
		opts = {
			lsp_gofumpt = false, -- true: set default gofmt in gopls format to gofumpt

			lsp_keymaps = false, -- set to false to disable gopls/lsp keymap
			lsp_codelens = false, -- set to false to disable codelens, true by default, you can use a function
			-- function(bufnr)
			--    vim.api.nvim_buf_set_keymap(bufnr, "n", "<space>F", "<cmd>lua vim.lsp.buf.formatting()<CR>", {noremap=true, silent=true})
			-- end
			-- to setup a table of codelens
			lsp_document_formatting = false,

			dap_debug = false, -- set to false to disable dap

			dap_debug_keymap = false, -- true: use keymap for debugger defined in go/dap.lua
			-- false: do not use keymap in go/dap.lua.  you must define your own.
			-- Windows: Use Visual Studio keymap
			dap_debug_gui = {}, -- bool|table put your dap-ui setup here set to false to disable
			dap_debug_vt = { enabled = false, enabled_commands = false, all_frames = false }, -- bool|table put your dap-virtual-text setup here set to false to disable
			lsp_inlay_hints = {
				enable = true,
			},
			textobjects = false, -- enable default text objects through treesittter-text-objects

			lsp_cfg = true, -- false: do nothing
			-- true: apply non-default gopls setup defined in go/lsp.lua
			-- if lsp_cfg is a table, merge table with with non-default gopls setup in go/lsp.lua, e.g.
		},
		config = function(_, opts)
			require("go").setup(opts)
		end,
		event = { "CmdlineEnter" },
		ft = { "go", "gomod" },
		build = ':lua require("go.install").update_all_sync()', -- if you need to install/update all binaries
	},
}
