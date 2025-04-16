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
	{
		"iamcco/markdown-preview.nvim",
		cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
		build = "cd app && yarn install",
		init = function()
			vim.g.mkdp_filetypes = { "markdown" }
			vim.g.mkdp_port = 42342
		end,
		ft = { "markdown" },
	},
	{
		-- support for image pasting
		"HakonHarnes/img-clip.nvim",
		event = "VeryLazy",
		opts = {
			-- recommended settings
			default = {
				embed_image_as_base64 = false,
				prompt_for_file_name = false,
				drag_and_drop = {
					insert_mode = true,
				},
				-- required for Windows users
				use_absolute_path = true,
			},
		},
	},
}
