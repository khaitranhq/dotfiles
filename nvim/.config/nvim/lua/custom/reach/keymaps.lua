-- keymaps.lua
-- Handles key input and buffer switching

local M = {}

--- Setup keymaps for buffer selection
--- @param popup table NUI Popup instance
--- @param key_map table Map of keys to buffer numbers
function M.setup_keymaps(popup, key_map)
	local function handle_selection(key)
		local bufnr = key_map[key]
		if bufnr then
			-- Close popup first
			popup:unmount()

			-- Switch to selected buffer
			vim.api.nvim_set_current_buf(bufnr)
		end
	end

	-- Map number keys (1-9)
	for i = 1, 9 do
		local key = tostring(i)
		popup:map("n", key, function()
			handle_selection(key)
		end, { noremap = true })
	end

	-- Map letter keys (a-z)
	for i = 0, 25 do
		local key = string.char(97 + i) -- 97 is 'a' in ASCII
		popup:map("n", key, function()
			handle_selection(key)
		end, { noremap = true })
	end

	-- Map escape and q to close
	popup:map("n", "<Esc>", function()
		popup:unmount()
	end, { noremap = true })

	popup:map("n", "q", function()
		popup:unmount()
	end, { noremap = true })
end

return M
