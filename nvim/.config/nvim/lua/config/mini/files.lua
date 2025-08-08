-- Mini.files configuration
local utils = require("config.mini.utils")

local M = {}

-- Setup Mini.files configuration
function M.setup()
	require("mini.files").setup({
		windows = {
			preview = true,
			width_preview = 40,
		},
		mappings = {
			go_in_plus = "<CR>",
			reveal_cwd = ".",
		},
	})

	-- Add autocmd to set up buffer-local keymaps when mini.files opens
	vim.api.nvim_create_autocmd("User", {
		pattern = "MiniFilesBufferCreate",
		callback = function(args)
			local buf_id = args.data.buf_id
			-- Copy relative path from nvim startup directory keymap within mini.files buffer
			vim.keymap.set("n", "<leader>y", utils.copy_relative_path, {
				buffer = buf_id,
				noremap = true,
				silent = true,
				desc = "Copy relative path from nvim root to clipboard",
			})
		end,
	})
end

return M