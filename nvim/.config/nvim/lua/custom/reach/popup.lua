-- popup.lua
-- Handles popup creation and display using nui.nvim

local Popup = require("nui.popup")
local event = require("nui.utils.autocmd").event

local M = {}

--- Create and configure popup
--- @param lines table Content lines to display
--- @return table NUI Popup instance
function M.create_popup(lines)
	local popup = Popup({
		enter = true,
		focusable = true,
		border = {
			style = "rounded",
			text = {
				top = " Buffer Selector ",
				top_align = "center",
			},
		},
		position = "50%",
		size = {
			width = "60%",
			height = math.min(#lines + 2, 20), -- Max height of 20 lines
		},
		buf_options = {
			modifiable = false,
			readonly = true,
		},
	})

	-- Set content
	vim.api.nvim_buf_set_lines(popup.bufnr, 0, -1, false, lines)

	-- Highlight the selection keys
	M.apply_highlights(popup.bufnr, #lines)

	return popup
end

--- Apply syntax highlighting to buffer
--- @param bufnr number Buffer number
--- @param line_count number Number of lines
function M.apply_highlights(bufnr, line_count)
	-- Create namespace for highlights
	local ns_id = vim.api.nvim_create_namespace("reach_buffer_selector")

	-- Highlight each selection key (the part in brackets)
	for i = 0, line_count - 1 do
		-- Highlight [key] part in the line
		vim.api.nvim_buf_set_extmark(bufnr, ns_id, i, 0, {
			end_col = 3,
			hl_group = "Number",
		})
	end
end

--- Setup auto-close on buffer leave
--- @param popup table NUI Popup instance
function M.setup_auto_close(popup)
	popup:on(event.BufLeave, function()
		popup:unmount()
	end, { once = true })
end

return M
