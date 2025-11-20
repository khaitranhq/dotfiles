-- popup.lua
-- Handles popup creation and display using nui.nvim

local Popup = require("nui.popup")
local event = require("nui.utils.autocmd").event

local M = {}

--- Create and configure popup
--- @param lines table Content lines to display
--- @param modified_lines table List of line indices (0-based) that are modified
--- @return table NUI Popup instance
function M.create_popup(lines, modified_lines)
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

	-- Highlight the selection keys and modified buffers
	M.apply_highlights(popup.bufnr, #lines, modified_lines or {})

	return popup
end

--- Apply syntax highlighting to buffer
--- @param bufnr number Buffer number
--- @param line_count number Number of lines
--- @param modified_lines table List of line indices (0-based) that are modified
function M.apply_highlights(bufnr, line_count, modified_lines)
	-- Create namespace for highlights
	local ns_id = vim.api.nvim_create_namespace("reach_buffer_selector")

	-- Convert modified_lines to a set for O(1) lookup
	local modified_set = {}
	for _, line_idx in ipairs(modified_lines) do
		modified_set[line_idx] = true
	end

	-- Highlight each line
	for i = 0, line_count - 1 do
		if modified_set[i] then
			-- Highlight entire line in yellow for modified buffers
			local line_text = vim.api.nvim_buf_get_lines(bufnr, i, i + 1, false)[1]
			vim.api.nvim_buf_set_extmark(bufnr, ns_id, i, 0, {
				end_col = #line_text,
				hl_group = "WarningMsg", -- Yellow/warning color
			})
		else
			-- Highlight [key] part in the line for non-modified buffers
			vim.api.nvim_buf_set_extmark(bufnr, ns_id, i, 0, {
				end_col = 3,
				hl_group = "Number",
			})
		end
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
