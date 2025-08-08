-- extra/init.lua
-- Initialize extra Neovim enhancements and custom UI components
-- This module loads and configures additional features beyond the core setup

local M = {}

-- Setup nui-based UI enhancements
function M.setup_nui_ui()
	local ok, nui_ui = pcall(require, "modules.dressing.nui-ui")
	if not ok then
		vim.notify("Failed to load nui-ui module", vim.log.levels.ERROR)
		return
	end

	-- Configure nui-ui with custom settings
	nui_ui.setup({
		input = {
			-- Center position for input dialogs
			position = {
				row = "50%",
				col = "50%",
			},
			border = {
				style = "rounded",
				text = {
					top_align = "center",
				},
			},
			win_options = {
				winhighlight = "Normal:Normal,FloatBorder:Comment",
			},
			prompt_prefix = "▸ ",
		},
		select = {
			-- Center position for selection menus
			position = {
				row = "50%",
				col = "50%",
			},
			border = {
				style = "rounded",
			},
			win_options = {
				winhighlight = "Normal:Normal,FloatBorder:Comment,CursorLine:Visual",
			},
		},
	})

	-- Create user commands for testing
	vim.api.nvim_create_user_command("NuiTestInput", function()
		nui_ui.test_input()
	end, { desc = "Test nui.nvim input component" })

	vim.api.nvim_create_user_command("NuiTestSelect", function()
		nui_ui.test_select()
	end, { desc = "Test nui.nvim select component" })
end

-- Main setup function
function M.setup()
	-- Setup nui UI enhancements
	M.setup_nui_ui()

	-- Add any other extra features here in the future
	-- Example: M.setup_other_feature()
end

return M
