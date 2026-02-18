return {
	{
		"github/copilot.vim",
		event = "InsertEnter",
		config = function()
			vim.g.copilot_no_tab_map = true
		end,
	},
	{
		"sudo-tee/opencode.nvim",
		config = function()
			require("opencode").setup({
				preferred_picker = "snacks", -- Use snacks.nvim for all pickers

				keymap = {
					editor = {
						["<leader>om"] = { "configure_provider", desc = "Select Opencode Model" },
						["<leader>oa"] = { "select_agent", desc = "Select Opencode Agent" },
					},
				},
			})
		end,
		dependencies = {
			"nvim-lua/plenary.nvim",
			{
				"MeanderingProgrammer/render-markdown.nvim",
				opts = {
					anti_conceal = { enabled = false },
					file_types = { "markdown", "opencode_output" },
				},
				ft = { "markdown", "Avante", "copilot-chat", "opencode_output" },
			},
			-- Optional, for file mentions and commands completion, pick only one
			"saghen/blink.cmp",

			-- Optional, for file mentions picker, pick only one
			"folke/snacks.nvim",
		},
	},
}
