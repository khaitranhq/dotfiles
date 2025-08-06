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
		dependencies = {
			"nvim-treesitter/nvim-treesitter",
			"nvim-tree/nvim-web-devicons",
			-- {
			-- 	"3rd/image.nvim",
			-- 	config = function()
			-- 		require("image").setup({
			-- 			backend = "kitty",
			-- 			kitty_method = "normal", -- or "unicode-placeholders"
			-- 			processor = "magick_rock", -- or "magick_cli"
			-- 			integrations = {
			-- 				markdown = {
			-- 					enabled = true,
			-- 					only_render_image_at_cursor = true,
			-- 				},
			-- 			},
			-- 		})
			-- 	end,
			-- },
		},
	},
}
