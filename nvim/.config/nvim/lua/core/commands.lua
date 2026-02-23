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

vim.api.nvim_create_autocmd({ "BufWritePre" }, {
	pattern = "*",
	callback = function()
		-- Save cursor position
		local cursor_pos = vim.api.nvim_win_get_cursor(0)
		-- Remove trailing spaces
		vim.cmd(":%s/\\s\\+$//ge")
		-- Restore cursor position
		pcall(vim.api.nvim_win_set_cursor, 0, cursor_pos)
	end,
	desc = "Remove trailing spaces before saving",
})

vim.api.nvim_create_user_command("GitBlame", ":lua Snacks.git.blame_line()", {})

vim.api.nvim_create_user_command("Trouble", ":lua Snacks.picker.diagnostics()", {})
vim.api.nvim_create_user_command("TroubleBuffer", ":lua Snacks.picker.diagnostics_buffer()", {})

vim.api.nvim_create_user_command("LspIncommingCalls", ":lua Snacks.picker.lsp_incoming_calls()", {})
vim.api.nvim_create_user_command("LspOutgoingCalls", ":lua Snacks.picker.lsp_outgoing_calls()", {})
vim.api.nvim_create_user_command("LspImplementations", ":lua Snacks.picker.lsp_implementations()", {})
vim.api.nvim_create_user_command("LspReferences", ":lua Snacks.picker.lsp_references()", {})
vim.api.nvim_create_user_command("LspTypeDefinitions", ":lua vim.lsp.buf.type_definition()", {})

vim.api.nvim_create_autocmd("VimResized", {
	command = "wincmd =",
})

vim.api.nvim_create_user_command("LspWorkspaceSymbols", ":lua Snacks.picker.lsp_workspace_symbols()", {})

vim.api.nvim_create_autocmd("LspProgress", {
	---@param ev {data: {client_id: integer, params: lsp.ProgressParams}}
	callback = function(ev)
		local spinner = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }
		vim.notify(vim.lsp.status(), "info", {
			id = "lsp_progress",
			title = "LSP Progress",
			opts = function(notif)
				notif.icon = ev.data.params.value.kind == "end" and " "
					or spinner[math.floor(vim.uv.hrtime() / (1e6 * 80)) % #spinner + 1]
			end,
		})
	end,
})
