-- AUTOCOMMANDS
-- Automatic commands that trigger on specific events

-- Remove carriage returns on save
-- This autocmd removes DOS-style line endings (\r) when saving any file
vim.api.nvim_create_autocmd({ "BufWritePre" }, {
	pattern = "*",
	callback = function()
		-- Save cursor position
		local cursor_pos = vim.api.nvim_win_get_cursor(0)
		-- Remove all carriage returns
		vim.cmd(":%s/\r//ge")
		-- Restore cursor position (accounting for potential line changes)
		pcall(vim.api.nvim_win_set_cursor, 0, cursor_pos)
	end,
	desc = "Remove carriage returns before saving",
})
