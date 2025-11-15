-- init.lua
-- Main entry point for the buffer selector

local buffer_list = require("custom.reach.buffer_list")
local popup_module = require("custom.reach.popup")
local keymaps = require("custom.reach.keymaps")

local M = {}

--- Open buffer selector popup
function M.open()
	-- Get list of buffers
	local buffers = buffer_list.get_buffers()

	if #buffers == 0 then
		vim.notify("No buffers to select", vim.log.levels.INFO)
		return
	end

	-- Format buffers for display and get key mapping
	local lines, key_map = buffer_list.format_buffers(buffers)

	-- Create popup
	local popup = popup_module.create_popup(lines)

	-- Setup keymaps for selection
	keymaps.setup_keymaps(popup, key_map)

	-- Setup auto-close on buffer leave
	popup_module.setup_auto_close(popup)

	-- Mount (show) the popup
	popup:mount()
end

--- Setup function to be called from init.vim/init.lua
function M.setup()
	-- Create user command
	vim.api.nvim_create_user_command("ReachBuffer", function()
		M.open()
	end, {
		desc = "Open buffer selector popup",
	})

	-- Optional: Setup default keymap (can be customized by user)
	-- vim.keymap.set("n", "<leader>bb", M.open, { desc = "Buffer selector" })
end

return M
