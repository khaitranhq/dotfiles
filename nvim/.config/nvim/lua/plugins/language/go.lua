return {
	{
		"ray-x/go.nvim",
		dependencies = { -- optional packages
			"ray-x/guihua.lua",
			"neovim/nvim-lspconfig",
			"nvim-treesitter/nvim-treesitter",
		},
		opts = {
			disable_defaults = true, -- true|false when true set false to all boolean settings and replace all tables
			go = "go",
			preludes = {
				default = function()
					return {}
				end,
				GoRun = function()
					return {}
				end,
			},
			lsp_inlay_hints = {
				enable = true,
			},
			lsp_cfg = true,
		},
		config = function(_, opts)
			require("go").setup(opts)
		end,
		event = { "CmdlineEnter" },
		ft = { "go", "gomod" },
		build = ':lua require("go.install").update_all_sync()', -- if you need to install/update all binaries
	},
}
