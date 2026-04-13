local M = {}
--- Prompt user to copy current buffer's absolute or relative path to clipboard.
--- Uses vim.ui.select for UI, copies result to system clipboard.
--- - Absolute: Full path to file.
--- - Relative: Path from current working directory.
--- - Filename: Just the filename without path.
function M.copy_buffer_path()
	local buf_path = vim.api.nvim_buf_get_name(0)
	if buf_path == "" then
		vim.notify("No file in current buffer.", vim.log.levels.WARN)
		return
	end

	local abs_path = buf_path
	local rel_path = vim.fn.fnamemodify(buf_path, ":.") -- relative to cwd
	local filename = vim.fn.fnamemodify(buf_path, ":t") -- filename only
	local choices = {
		{ label = "Relative path (cwd)", value = rel_path },
		{ label = "Absolute path", value = abs_path },
		{ label = "Filename only", value = filename },
	}

	vim.ui.select(choices, {
		prompt = "Copy buffer path:",
		format_item = function(item)
			return item.label .. "\n" .. item.value
		end,
	}, function(choice)
		if choice and choice.value then
			vim.fn.setreg("+", choice.value)
			vim.notify("Copied to clipboard: " .. choice.value, vim.log.levels.INFO)
		end
	end)
end

--- Ensure markdown tasks have sequential IDs in the form: `- [ ] [ID: XX] ...`.
--- Scans the current buffer for markdown task lines (lines that start with `- [<char>]`) and
--- assigns or corrects a two-digit increasing ID for each task in order of appearance.
--- Preserves cursor position and saves the buffer when changes are made.
function M.fix_markdown_task_ids()
	-- Preserve cursor
	local cursor = vim.api.nvim_win_get_cursor(0)

	local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
	local changed = 0
	local task_index = 0

	for i, line in ipairs(lines) do
		-- Match a markdown task prefix like: optional space, "- [ ]" or "- [x]", capture prefix and trailing spacing
		local prefix = line:match("^(%s*%- %[.%]%s*)")
		if prefix then
			task_index = task_index + 1
			local new_id = string.format("%02d", task_index)

			-- remainder after the prefix
			local rest = line:sub(#prefix + 1)

			-- Check for existing ID and capture its number and the remainder after it
			local existing_num, after = rest:match("^%[ID:%s*(%d+)%]%s*(.*)$")
			if existing_num then
				-- If the numeric value differs, replace with the new zero-padded id
				if tonumber(existing_num) ~= tonumber(new_id) then
					-- rebuild the line with the corrected id; preserve spacing between id and remainder
					if after == "" then
						lines[i] = prefix .. "[ID: " .. new_id .. "]"
					else
						lines[i] = prefix .. "[ID: " .. new_id .. "] " .. after
					end
					changed = changed + 1
				end
			else
				-- No existing ID: insert one. If rest is empty or starts with space, don't add extra space.
				if rest == "" then
					lines[i] = prefix .. "[ID: " .. new_id .. "]"
				elseif rest:match("^%s") then
					lines[i] = prefix .. "[ID: " .. new_id .. "]" .. rest
				else
					lines[i] = prefix .. "[ID: " .. new_id .. "] " .. rest
				end
				changed = changed + 1
			end
		end
	end

	if changed > 0 then
		vim.api.nvim_buf_set_lines(0, 0, -1, false, lines)
		pcall(vim.api.nvim_win_set_cursor, 0, cursor)
		vim.cmd("silent write")
		vim.notify(string.format("Updated %d task id(s)", changed), vim.log.levels.INFO)
	else
		vim.notify("No markdown tasks found or no changes needed", vim.log.levels.INFO)
	end
end

--- Adds a priority icon after a markdown checkbox `- [ ]`.
--- Priority levels: critical (🔴), high (🟠), medium (🟡), low (🟢)
--- @param priority string The priority level: "critical", "high", "medium", or "low"
function M.set_markdown_priority(priority)
	local priority_map = {
		critical = "🔴",
		high = "🟠",
		medium = "🟡",
		low = "🟢",
	}

	local icon = priority_map[priority]
	if not icon then
		vim.notify("Invalid priority: " .. priority, vim.log.levels.ERROR)
		return
	end

	local line = vim.api.nvim_get_current_line()
	local row = vim.api.nvim_win_get_cursor(0)[1]

	-- Match markdown checkbox pattern: optional whitespace, "- [any char]", optional icon
	-- Capture: leading whitespace, checkbox content, and rest of line
	local leading_space, checkbox, rest = line:match("^(%s*)- (%[.%])%s*[🔴🟠🟡🟢]?%s*(.*)")

	if checkbox then
		-- Reconstruct with priority icon
		local new_line = leading_space .. "- " .. checkbox .. " " .. icon .. " " .. rest
		vim.api.nvim_buf_set_lines(0, row - 1, row, false, { new_line })
		vim.cmd("silent write")
	else
		vim.notify("Not on a markdown task line", vim.log.levels.WARN)
	end
end

--- Opens a centered floating window to select a buffer using keyboard shortcuts (a-z, 0-9).
--- Shows all loaded buffers with a modified indicator (yellow icon) for unsaved buffers.
--- Excludes the current buffer from the list.
--- @return nil
function M.select_buffer()
	local buffers = vim.fn.getbufinfo({ buflisted = true })
	local current_buf = vim.api.nvim_get_current_buf()

	if #buffers == 0 then
		vim.notify("No buffers available", vim.log.levels.WARN)
		return
	end

	-- Create list of buffer entries with keyboard shortcuts
	local entries = {}
	local buf_map = {} -- Maps key to buffer number
	local modified_lines = {} -- Track which lines are modified for highlighting
	local keys = "abcdefghijklmnopqrstuvwxyz0123456789"
	local entry_count = 0

	for _, buf in ipairs(buffers) do
		-- Skip the current buffer
		if buf.bufnr ~= current_buf then
			entry_count = entry_count + 1
			if entry_count > #keys then
				break -- Only show first 36 buffers (a-z, 0-9)
			end

			local key = keys:sub(entry_count, entry_count)
			local bufnr = buf.bufnr
			local name = buf.name ~= "" and vim.fn.fnamemodify(buf.name, ":t") or "[No Name]"
			local modified = buf.changed == 1
			local icon = modified and "●" or "○" -- Filled circle for modified, empty circle for normal
			local status = modified and " (modified)" or ""

			table.insert(entries, string.format("  %s  %s  %s%s", key, icon, name, status))
			buf_map[key] = bufnr
			if modified then
				modified_lines[entry_count] = true
			end
		end
	end

	-- Create window with Snacks.win
	require("snacks").win({
		title = "Select Buffer",
		width = 0.3,
		height = 0.4,
		minimal = true,
		position = "float",
		border = "rounded",
		text = entries,
		keys = {},
		on_buf = function(self)
			-- Apply yellow highlight to modified buffer lines
			for line_num, is_modified in pairs(modified_lines) do
				if is_modified then
					vim.api.nvim_buf_add_highlight(self.buf, -1, "WarningMsg", line_num - 1, 0, -1)
				end
			end

			-- Add keymaps for buffer selection
			for key, bufnr in pairs(buf_map) do
				vim.keymap.set("n", key, function()
					self:close()
					vim.api.nvim_set_current_buf(bufnr)
				end, { buffer = self.buf, noremap = true, silent = true })
			end

			-- Add quit key
			vim.keymap.set("n", "q", function()
				self:close()
			end, { buffer = self.buf, noremap = true, silent = true })
		end,
	})
end

return M
