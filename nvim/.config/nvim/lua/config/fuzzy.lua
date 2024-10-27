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

function vim.search_with_selected_text()
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
						"/dist/",
						"^venv/",
						"^.venv/",
						"^.git/",
						"!^.github/",
            "^cdk.out"
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
				},
			})
		end,
	},
}
