-- buffer_list.lua
-- Handles buffer listing and formatting

local M = {}

--- Get list of valid buffers
--- @return table List of buffer info tables
function M.get_buffers()
	local buffers = {}
	local buf_list = vim.api.nvim_list_bufs()

	for _, bufnr in ipairs(buf_list) do
		-- Only include listed, valid buffers
		if vim.api.nvim_buf_is_valid(bufnr) and vim.api.nvim_get_option_value("buflisted", { buf = bufnr }) then
			local name = vim.api.nvim_buf_get_name(bufnr)

			-- Skip empty buffers
			if name ~= "" then
				table.insert(buffers, {
					bufnr = bufnr,
					name = name,
				})
			end
		end
	end

	return buffers
end

--- Format buffer list with selection keys (1-9, a-z)
--- @param buffers table List of buffer info tables
--- @return table Formatted lines for display
--- @return table Map of keys to buffer numbers
function M.format_buffers(buffers)
	local lines = {}
	local key_map = {}
	local cwd = vim.fn.getcwd()

	-- Generate selection keys: 1-9, then a-z
	local function get_selection_key(index)
		if index <= 9 then
			return tostring(index)
		else
			-- a=10, b=11, ..., z=35 (26 letters)
			local char_index = index - 10
			if char_index < 26 then
				return string.char(97 + char_index) -- 97 is 'a' in ASCII
			end
		end
		return nil
	end

	-- Build formatted lines
	for i, buf in ipairs(buffers) do
		local key = get_selection_key(i)
		if not key then
			break -- Max 35 buffers (9 numbers + 26 letters)
		end

		-- Get relative path from cwd
		local display_path = buf.name
		if vim.startswith(buf.name, cwd) then
			display_path = vim.fn.fnamemodify(buf.name, ":.")
		end

		-- Format: [key] path
		local line = string.format("[%s] %s", key, display_path)
		table.insert(lines, line)

		-- Store mapping
		key_map[key] = buf.bufnr
	end

	return lines, key_map
end

return M
