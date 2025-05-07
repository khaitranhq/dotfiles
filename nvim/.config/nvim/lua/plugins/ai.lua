return {
	{
		"olimorris/codecompanion.nvim",
		opts = {
			strategies = {
				chat = {
					adapter = "copilot",
					slash_commands = {
						["file"] = {
							-- Location to the slash command in CodeCompanion
							callback = "strategies.chat.slash_commands.file",
							description = "Select a file using Snacks",
							opts = {
								provider = "snacks", -- Other options include 'default', 'mini_pick', 'fzf_lua', snacks
								contains_code = true,
							},
						},
					},
				},
			},
			opts = {
				-- Set debug logging
				log_level = "DEBUG",
			},
		},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
			-- {
			-- 	"github/copilot.vim",
			-- 	config = function()
			-- 		vim.g.copilot_no_tab_map = true
			-- 		vim.keymap.set(
			-- 			"i",
			-- 			"<M-Enter>",
			-- 			'copilot#Accept("<CR>")',
			-- 			{ expr = true, silent = true, replace_keycodes = false }
			-- 		)
			-- 	end,
			-- },
		},
	},
	{
		"yetone/avante.nvim",
		event = "VeryLazy",
		lazy = false,
		version = false, -- set this if you want to always pull the latest change
		opts = {
			provider = "copilot",
			-- provider = "claude",
			claude = {
				-- model = "claude-3-5-sonnet-20241022",
				model = "claude-3-7-sonnet-20250219",
				disable_tools = true, -- disable tools!
			},
			dual_boost = {
				enabled = false,
				first_provider = "claude",
				second_provider = "copilot",
			},
			file_selector = {
				provider = "snacks",
			},
			behaviour = {
				enable_token_counting = true, -- Whether to enable token counting. Default to true.
			},
		},
		-- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
		build = "make",
		-- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			"stevearc/dressing.nvim",
			--- The below dependencies are optional,
			"nvim-tree/nvim-web-devicons", -- or echasnovski/mini.icons
			{
				"zbirenbaum/copilot.lua",
				cmd = "Copilot",
				event = "InsertEnter",
				config = function()
					require("copilot").setup({
						suggestion = {
							enabled = true,
							auto_trigger = true,
							keymap = {
								accept = "<M-CR>",
							},
						},
					})
				end,
			},
			-- {
			-- 	-- support for image pasting
			-- 	"HakonHarnes/img-clip.nvim",
			-- 	event = "VeryLazy",
			-- 	opts = {
			-- 		-- recommended settings
			-- 		default = {
			-- 			embed_image_as_base64 = false,
			-- 			prompt_for_file_name = false,
			-- 			drag_and_drop = {
			-- 				insert_mode = true,
			-- 			},
			-- 			-- required for Windows users
			-- 			use_absolute_path = true,
			-- 		},
			-- 	},
			-- },
			{
				-- Make sure to set this up properly if you have lazy=true
				"MeanderingProgrammer/render-markdown.nvim",
				opts = {
					file_types = { "markdown", "Avante" },
				},
				ft = { "markdown", "Avante" },
			},
		},
	},
}
