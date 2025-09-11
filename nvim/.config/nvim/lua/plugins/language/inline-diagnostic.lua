return {
	{
		"rachartier/tiny-inline-diagnostic.nvim",
		event = "VeryLazy", -- Or `LspAttach`
		priority = 1000, -- needs to be loaded in first
		config = function()
			require("tiny-inline-diagnostic").setup({
				preset = "ghost",
				options = {
					multilines = {
						-- Enable multiline diagnostic messages
						enabled = true,
					},

					-- Enable diagnostics in Insert mode
					-- If enabled, it is better to set the `throttle` option to 0 to avoid visual artifacts
					enable_on_insert = false,
				},
			})
			vim.diagnostic.config({ virtual_text = false }) -- Only if needed in your configuration, if you already have native LSP diagnostics
		end,
	},
}
