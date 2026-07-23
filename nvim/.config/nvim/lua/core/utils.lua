local M = {}

--- Resolve a path to its real filesystem path (follows symlinks).
--- @param p string Path to resolve
--- @return string|nil Real path, or nil if it doesn't exist or is a file
local function _realpath(p)
    if not p or p == "" then return nil end
    if not vim.loop or not vim.loop.fs_realpath then return nil end
    return vim.loop.fs_realpath(p)
end

--- Walk cwd directory to find which child path (including symlinked children) contains the buffer.
--- For each directory entry, resolve to real path and check if it matches the buffer's real path.
--- @param buf_real string Resolved real path of the buffer file (e.g. "/tmp/abc/xyz.go")
--- @param cwd_user string User-visible cwd path (e.g. "./" or "/home/user/project")
--- @return string|nil Relative path from cwd to the buffer, or nil if not found
local function _find_via_symlink_walk(buf_real, cwd_user)
    local function _walk(dir_user, parts, depth)
        if depth > 15 then return nil end

        local loop = vim.loop
        if not loop or not loop.fs_scandir then return nil end

        local handle = loop.fs_scandir(dir_user)
        if not handle then return nil end

        while true do
            local name, ftype = loop.fs_scandir_next(handle)
            if not name then break end

            -- Build the user-facing path for this child entry
            -- Normalize dir_user to always end with "/"
            local base = dir_user
            if base == "." or base == "./" then
                base = "./"
            elseif base:sub(-1) ~= "/" then
                base = base .. "/"
            end
            local child_user = base .. name

            -- Resolve this child path to its real filesystem path (follows symlinks)
            local child_real = _realpath(child_user)
            if not child_real or child_real == "" then
                -- Entry doesn't exist or can't resolve — skip
            elseif child_real == buf_real or buf_real:sub(1, #child_real + 1) == child_real .. "/" then
                -- Found: this child (or one under it) is our buffer
                local parts_copy = {}
                for _, v in ipairs(parts) do
                    table.insert(parts_copy, v)
                end
                table.insert(parts_copy, name)
                local display = table.concat(parts_copy, "/")

                -- Add the remainder of buf_real after child_real
                local rest = buf_real:sub(#child_real + 2) -- skip the "/" separator
                while rest:sub(1, 1) == "/" do
                    rest = rest:sub(2)
                end

                if rest == "" then
                    return display
                end
                return display .. "/" .. rest
            end

            -- Recurse into directories and symlinks to directories (skip files)
            if ftype == "directory" or ftype == "link" then
                parts[#parts + 1] = name
                local result = _walk(child_user, parts, depth + 1)
                table.remove(parts)
                if result then return result end
            end
        end

        return nil
    end

    return _walk(cwd_user, {}, 0)
end

--- Compute relative path from cwd to a buffer file, resolving symlinks.
--- If the buffer is under cwd (possibly via a symlink), returns a relative display path.
--- If not under cwd, returns the buffer name as-is (usually absolute).
--- @param buf_name string The buffer name (may be absolute, relative, or empty)
--- @return string The path to display
local function _get_relative_buf_name(buf_name)
    if buf_name == "" then
        return buf_name
    end

    -- 1. Direct relative conversion (works when buffer name is already accessible via cwd)
    local rel = vim.fn.fnamemodify(buf_name, ":.")
    if not rel:match("^/") then
        return rel
    end

    -- 2. Buffer name starts with "/" — try to find a user-visible cwd-relative path
    --    This handles the case where vim stores the resolved (real) path but the user
    --    accessed the file via a symlink (e.g. ./infra -> /tmp/abc)
    local buf_real = _realpath(buf_name)
    if not buf_real or buf_real == "" then
        -- File doesn't exist yet (new buffer) — can't resolve, return original
        return buf_name
    end

    return _find_via_symlink_walk(buf_real, vim.fn.getcwd()) or buf_name
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

--- Copy cursor location to clipboard as relative/path:line (normal) or relative/path:start...end (visual).
--- @param mode string "n" for cursor line, "v" for visual selection range
function M.copy_location(mode)
	local buf_path = vim.api.nvim_buf_get_name(0)
	if buf_path == "" then
		vim.notify("No file in current buffer.", vim.log.levels.WARN)
		return
	end
	local rel = vim.fn.fnamemodify(buf_path, ":.")
	local text
	if mode == "v" then
		local v_start = vim.fn.getpos("v")
		local v_end = vim.fn.getpos(".")
		local sl = v_start[2]
		local el = v_end[2]
		if sl > el then sl, el = el, sl end
		text = string.format("%s:%d...%d", rel, sl, el)
	else
		text = string.format("%s:%d", rel, vim.fn.line("."))
	end
	vim.fn.setreg("+", text)
	vim.notify("Copied: " .. text, vim.log.levels.INFO)
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
			local name = buf.name ~= "" and _get_relative_buf_name(buf.name) or "[No Name]"
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
