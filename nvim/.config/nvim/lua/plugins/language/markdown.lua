return {
	{
		"MeanderingProgrammer/render-markdown.nvim",
		opts = {
			checkbox = {
				unchecked = { icon = "" },
				checked = { icon = "", scope_highlight = "@markup.strikethrough" },
				custom = {
					doing = {
						raw = "[_]",
						rendered = "󰄮",
						highlight = "RenderMarkdownDoing",
					},
					wontdo = {
						raw = "[~]",
						rendered = "󰅗",
						highlight = "RenderMarkdownWontdo",
					},
				},
			},
		},
		dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
	},
	{
		"iamcco/markdown-preview.nvim",
		cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
		build = "cd app && yarn install",
		init = function()
			vim.g.mkdp_filetypes = { "markdown" }
			vim.g.mkdp_theme = "dark"
		end,
		ft = { "markdown" },
	},
	{
		"HakonHarnes/img-clip.nvim",
		event = "VeryLazy",
		opts = {
			-- default = {
			-- 	prompt_for_file_name = false,
			-- },
			-- add options here
			-- or leave it empty to use the default settings
		},
	},
}
