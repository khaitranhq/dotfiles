local function getVisualSelection()
	vim.cmd('noau normal! "vy"')
	local text = vim.fn.getreg("v")
	vim.fn.setreg("v", {})

	text = string.gsub(text, "\n", "")
	if #text > 0 then
		return text
	else
		return ""
	end
end

function SearchWithSelectedText()
	local text = getVisualSelection()
	local telescope_builtin = require("telescope.builtin")
	telescope_builtin.live_grep({ default_text = text })
end

return {
	{
		"nvim-telescope/telescope.nvim",
		tag = "0.1.8",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			require("telescope").setup({
				defaults = {
					file_ignore_patterns = {
						"node_modules/",
						"^dist/",
						"^venv/",
						"^.venv/",
						"^.git/",
						"!^.github/",
						"cdk.out/",
						".mypy/",
						".serverless/",
						".build/",
					},
					file_previewer = require("telescope.previewers").vim_buffer_vimgrep.new,
					layout_strategy = "vertical",
					-- sorting_strategy = "ascending",
					layout_config = {
						-- prompt_position = "top",
					},
				},
				pickers = {
					find_files = {
						hidden = true,
						no_ignore = true,
					},
					live_grep = {
						file_ignore_patterns = { "node_modules", "^.git/", ".venv" },
						additional_args = function(_)
							return { "--hidden" }
						end,
					},
				},
			})
		end,
	},
	{
		"folke/snacks.nvim",
		---@type snacks.Config
		opts = {
			animate = {
				enabled = vim.fn.has("nvim-0.10") == 1,
				style = "out",
				easing = "linear",
				duration = {
					step = 20, -- ms per step
					total = 500, -- maximum duration
				},
			},
			indent = {},
			input = {},
			lazygit = {},
			picker = {
				-- your picker configuration comes here
				-- or leave it empty to use the default settings
				-- refer to the configuration section below
			},
		},
		keys = {
			{
				"<leader>gs",
				function()
					Snacks.lazygit()
				end,
				desc = "Lazygit",
			},
			{
				"<leader>ff",
				function()
					Snacks.picker.files()
				end,
				desc = "Find Files",
			},
			{
				"<leader>fg",
				function()
					Snacks.picker.grep()
				end,
				desc = "Grep",
			},
		},
	},
}
