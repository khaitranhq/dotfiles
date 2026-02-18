local M = {}
local merge_tb = vim.tbl_deep_extend

M.load_mappings = function()
	vim.schedule(function()
		local mappings = require("core.mappings")

		for _, sect in pairs(mappings) do
			for mode, mode_values in pairs(sect) do
				local default_opts = merge_tb("force", { mode = mode }, {})
				for keybind, mapping_info in pairs(mode_values) do
					-- merge default + user opts
					local opts = merge_tb("force", default_opts, mapping_info.opts or {})

					mapping_info.opts, opts.mode = nil, nil
					opts.desc = mapping_info[2]

					vim.keymap.set(mode, keybind, mapping_info[1], opts)
				end
			end
		end
	end)
end

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

--- Sets the markdown task checkbox state on the current line.
--- Supports: todo [ ], done [x], doing [=], blocked [!], pending [~]
--- If state is "done", moves the task line to the end of the file.
--- @param state string The task state: "todo", "done", "doing", "blocked", or "pending"
function M.set_markdown_task_state(state)
	local state_map = {
		todo = " ",
		done = "x",
		doing = "=",
		blocked = "!",
		pending = "~",
	}

	local checkbox = state_map[state]
	if not checkbox then
		vim.notify("Invalid state: " .. state, vim.log.levels.ERROR)
		return
	end

	local line = vim.api.nvim_get_current_line()
	local row = vim.api.nvim_win_get_cursor(0)[1]

	-- Match any markdown checkbox: - [ ], - [x], - [=], - [!], - [~]
	local new_line = line:gsub("- %[.%]", "- [" .. checkbox .. "]", 1)

	if new_line ~= line then
		vim.api.nvim_buf_set_lines(0, row - 1, row, false, { new_line })

		-- Save the buffer
		vim.cmd("silent write")
	else
		vim.notify("Not on a markdown task line", vim.log.levels.WARN)
	end
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

return M
