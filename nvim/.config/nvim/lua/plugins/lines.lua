return {
	{
		"nvim-lualine/lualine.nvim",
		lazy = false,
		dependencies = {
			"nvim-tree/nvim-web-devicons",
		},
		config = function()
			require("lualine").setup({
				options = {
					-- theme = "catppuccin",
					theme = "gruvbox",
				},
				sections = {
					lualine_b = { "diagnostics" },
					lualine_z = { "selectioncount", "location" },
				},
			})
		end,
	},
	{
		"akinsho/bufferline.nvim",
		version = "*",
		dependencies = "nvim-tree/nvim-web-devicons",
		after = "catppuccin",
		config = function()
			require("bufferline").setup({
				-- highlights = require("c.groups.integrations.bufferline").get(),
				options = {
					numbers = "buffer_id",
					diagnostics = "nvim_lsp",
					diagnostics_indicator = function(count, level, diagnostics_dict, context)
						local s = " "
						for e, n in pairs(diagnostics_dict) do
							local sym = e == "error" and " " or (e == "warning" and " " or "")
							s = s .. n .. sym
						end
						return s
					end,
				},
			})
		end,
	},
	{
		"lukas-reineke/indent-blankline.nvim",
		main = "ibl",
		---@module "ibl"
		---@type ibl.config
		opts = {},
	},
}
