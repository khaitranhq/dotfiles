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
}
