-- Mini.files configuration with Git integration
local utils = require("config.mini.utils")

local M = {}

-- Constants
local NAMESPACE_ID = vim.api.nvim_create_namespace("mini_files_git")
local CACHE_TIMEOUT_MS = 2000
-- Git status symbols matching nvim-tree defaults for consistency
local GIT_STATUS_SYMBOLS = {
	-- Working directory changes (unstaged)
	[" M"] = { symbol = "✗", hl_group = "MiniDiffSignChange" }, -- Modified in working dir
	["MM"] = { symbol = "✗", hl_group = "MiniDiffSignChange" }, -- Modified in both
	["??"] = { symbol = "★", hl_group = "MiniDiffSignAdd" }, -- Untracked (using Add color as it's new)
	["!!"] = { symbol = "!", hl_group = "MiniDiffSignDelete" }, -- Ignored

	-- Index changes (staged)
	["M "] = { symbol = "✓", hl_group = "MiniDiffSignChange" }, -- Modified in index (staged)
	["A "] = { symbol = "✓", hl_group = "MiniDiffSignAdd" }, -- Added to staging
	["AA"] = { symbol = "✓", hl_group = "MiniDiffSignAdd" }, -- Added in both
	["D "] = { symbol = "", hl_group = "MiniDiffSignDelete" }, -- Deleted from staging
	["R "] = { symbol = "➜", hl_group = "MiniDiffSignChange" }, -- Renamed in index

	-- Complex states
	["AM"] = { symbol = "✓", hl_group = "MiniDiffSignChange" }, -- Added + modified (show staged state)
	["AD"] = { symbol = "✓", hl_group = "MiniDiffSignChange" }, -- Added + deleted (show staged state)
	["U "] = { symbol = "", hl_group = "MiniDiffSignChange" }, -- Unmerged
	["UU"] = { symbol = "", hl_group = "MiniDiffSignChange" }, -- Unmerged conflict
	["UA"] = { symbol = "", hl_group = "MiniDiffSignChange" }, -- Unmerged + added
}

local SYMLINK_SYMBOL = "↩"
local SYMLINK_HL_GROUP = "MiniDiffSignDelete"

-- Cache for git status results
local git_status_cache = {}

-- UV handle for filesystem operations
local uv = vim.uv or vim.loop

---Check if a path is a symbolic link
---@param path string The filesystem path to check
---@return boolean True if path is a symlink, false otherwise
local function is_symlink(path)
	if not path or path == "" then
		return false
	end

	local stat = uv.fs_lstat(path)
	return stat and stat.type == "link"
end

---Get the appropriate Git repository root for a buffer
---@param buf_id integer Buffer ID
---@return string|nil Git root path or nil if not in a Git repository
local function get_git_root(buf_id)
	return vim.fs.root(buf_id, ".git")
end

---Clean Mini.files protocol prefix from path
---@param path string Path that may contain Mini.files protocol
---@return string Cleaned path
local function clean_minifiles_path(path)
	return path:gsub("^minifiles://%d+/", "")
end

---Map Git status and symlink information to display symbols and colors
---@param status string Git status code (e.g., "M ", "??")
---@param is_symlink_file boolean Whether the file is a symbolic link
---@return string symbol Combined display symbol
---@return string hl_group Highlight group for the symbol
local function get_status_display(status, is_symlink_file)
	local git_info = GIT_STATUS_SYMBOLS[status] or { symbol = "?", hl_group = "NonText" }

	if is_symlink_file then
		-- Combine symlink indicator with Git status
		local combined_symbol = SYMLINK_SYMBOL .. git_info.symbol
		return combined_symbol, SYMLINK_HL_GROUP
	end

	return git_info.symbol, git_info.hl_group
end

---Execute Git status command asynchronously
---@param git_root string Git repository root directory
---@param callback function Callback to execute with Git status output
local function fetch_git_status(git_root, callback)
	if not git_root or git_root == "" then
		return
	end

	local clean_root = clean_minifiles_path(git_root)

	---@param result table System command result
	local function on_exit(result)
		if result.code == 0 and result.stdout then
			callback(result.stdout)
		else
			-- Log error but don't interrupt user workflow
			vim.schedule(function()
				vim.notify("Git status failed: " .. (result.stderr or "Unknown error"), vim.log.levels.WARN)
			end)
		end
	end

	vim.system({ "git", "status", "--ignored", "--porcelain" }, { text = true, cwd = clean_root }, on_exit)
end

---Check if a path is inside an ignored directory
---@param path string The path to check
---@param status_map table<string, string> Map of ignored paths from git status
---@return boolean True if path is inside an ignored directory
local function is_path_ignored(path, status_map)
	-- Remove trailing slash for consistent comparison
	local clean_path = path:gsub("/$", "")

	-- Check if any ignored path is a parent of this path
	for ignored_path, status in pairs(status_map) do
		if status == "!!" then
			local clean_ignored = ignored_path:gsub("/$", "")
			-- Check if path starts with ignored directory
			if clean_path:find("^" .. vim.pesc(clean_ignored)) then
				return true
			end
		end
	end

	return false
end

---Parse Git status output into a structured map
---@param git_output string Raw Git status output
---@return table<string, string> Map of file paths to Git status codes
local function parse_git_status(git_output)
	local status_map = {}

	-- Process each line of Git status output
	for line in git_output:gmatch("[^\r\n]+") do
		local status, file_path = line:match("^(..)%s+(.*)")
		if status and file_path then
			-- Store both with and without trailing slash for directory matching
			status_map[file_path] = status

			-- If it's a directory (ends with /), also store without trailing slash
			if file_path:match("/$") then
				local without_slash = file_path:gsub("/$", "")
				status_map[without_slash] = status
			else
				-- If it doesn't end with /, also store with trailing slash for directories
				status_map[file_path .. "/"] = status
			end
		end
	end

	return status_map
end

---Update Mini.files buffer with Git status indicators
---@param buf_id integer Buffer ID
---@param status_map table<string, string> Map of paths to Git status
local function update_buffer_git_indicators(buf_id, status_map)
	vim.schedule(function()
		if not vim.api.nvim_buf_is_valid(buf_id) then
			return
		end

		local mini_files_ok, MiniFiles = pcall(require, "mini.files")
		if not mini_files_ok then
			return
		end

		local git_root = get_git_root(buf_id)
		if not git_root then
			return
		end

		local normalized_root = vim.fs.normalize(vim.pesc(git_root))
		local line_count = vim.api.nvim_buf_line_count(buf_id)

		-- Clear existing Git status marks
		vim.api.nvim_buf_clear_namespace(buf_id, NAMESPACE_ID, 0, -1)

		-- Build a list of newly added directories (untracked directories)
		local newly_added_dirs = {}
		for path, status in pairs(status_map) do
			if status == "??" and path:match("/$") then
				-- This is an untracked directory - remove trailing slash for matching
				local dir_path = path:gsub("/$", "")
				newly_added_dirs[dir_path] = true
			end
		end

		---Check if a path is inside a newly added directory
		---@param path string The path to check
		---@return boolean True if path is inside a newly added directory
		local function is_in_newly_added_dir(path)
			-- Remove trailing slash for consistent comparison
			local clean_path = path:gsub("/$", "")

			-- Check if any newly added directory is a parent of this path
			for added_dir, _ in pairs(newly_added_dirs) do
				-- Check if path starts with the added directory path
				if clean_path == added_dir or clean_path:find("^" .. vim.pesc(added_dir) .. "/") then
					return true
				end
			end

			return false
		end

		---Check if a directory contains modified or new items (excluding case where all items are new)
		---@param dir_path string The directory path to check
		---@param status_map table<string, string> Map of paths to Git status
		---@return string|nil Git status to apply to directory, or nil if no status should be applied
		local function get_directory_status_from_children(dir_path, status_map)
			local clean_dir_path = dir_path:gsub("/$", "")
			local has_modified_children = false
			local has_new_children = false
			local total_children = 0
			local new_children_count = 0

			-- Look through all status entries to find children of this directory
			for file_path, status in pairs(status_map) do
				local clean_file_path = file_path:gsub("/$", "")

				-- Check if this file/folder is a direct or indirect child of our directory
				if clean_file_path:find("^" .. vim.pesc(clean_dir_path) .. "/") then
					total_children = total_children + 1

					-- Check for modified states (including staged changes)
					if
						status:match("^[MAD]")
						or status:match("[MAD]$")
						or status == "MM"
						or status == "AA"
						or status == "UU"
					then
						has_modified_children = true
					end

					-- Check for new/untracked items
					if status == "??" then
						has_new_children = true
						new_children_count = new_children_count + 1
					end
				end
			end

			-- If directory has children with changes
			if total_children > 0 then
				-- Exception: if ALL children are new (untracked), don't mark parent as modified
				-- This preserves existing behavior for fully new directories
				if has_new_children and new_children_count == total_children then
					return nil -- Let existing logic handle this case
				end

				-- If directory contains modified children, mark as modified
				if has_modified_children then
					return " M" -- Modified in working directory
				end

				-- If directory contains new children (but not all are new), mark as modified
				if has_new_children then
					return " M" -- Modified in working directory (contains new items)
				end
			end

			return nil
		end

		for line_num = 1, line_count do
			local entry = MiniFiles.get_fs_entry(buf_id, line_num)
			if not entry then
				break
			end

			-- Calculate relative path from Git root
			local relative_path = entry.path:gsub("^" .. normalized_root .. "/", "")
			local git_status = status_map[relative_path]

			-- If no direct status found, check if it's inside a newly added directory
			if not git_status and is_in_newly_added_dir(relative_path) then
				git_status = "??" -- Show as untracked/added
			end

			-- If no direct status found and this is a directory, check if it contains modified/new children
			if not git_status and entry.fs_type == "directory" then
				git_status = get_directory_status_from_children(relative_path, status_map)
			end

			-- Check if path is inside ignored directory
			if not git_status and is_path_ignored(relative_path, status_map) then
				git_status = "!!"
			end

			if git_status then
				local is_symlink_file = is_symlink(entry.path)
				local symbol, hl_group = get_status_display(git_status, is_symlink_file)

				-- Add Git status indicator to sign column
				vim.api.nvim_buf_set_extmark(buf_id, NAMESPACE_ID, line_num - 1, 0, {
					sign_text = symbol,
					sign_hl_group = hl_group,
					priority = 2,
				})

				-- Optionally highlight the filename with status color
				local line_text = vim.api.nvim_buf_get_lines(buf_id, line_num - 1, line_num, false)[1]
				if line_text then
					local name_start = line_text:find(vim.pesc(entry.name))
					if name_start then
						vim.api.nvim_buf_set_extmark(buf_id, NAMESPACE_ID, line_num - 1, name_start - 1, {
							end_col = name_start + #entry.name - 1,
							hl_group = hl_group,
						})
					end
				end
			end
		end
	end)
end

---Update Git status for a Mini.files buffer (with caching)
---@param buf_id integer Buffer ID
local function update_git_status(buf_id)
	local git_root = get_git_root(buf_id)
	if not git_root then
		return
	end

	local current_time = vim.uv.hrtime() / 1000000 -- Convert to milliseconds
	local cached_data = git_status_cache[git_root]

	-- Use cache if it's still valid
	if cached_data and (current_time - cached_data.timestamp) < CACHE_TIMEOUT_MS then
		update_buffer_git_indicators(buf_id, cached_data.status_map)
		return
	end

	-- Fetch fresh Git status
	fetch_git_status(git_root, function(git_output)
		local status_map = parse_git_status(git_output)

		-- Update cache
		git_status_cache[git_root] = {
			timestamp = current_time,
			status_map = status_map,
		}

		update_buffer_git_indicators(buf_id, status_map)
	end)
end

---Clear all cached Git status data
local function clear_git_status_cache()
	git_status_cache = {}
end

---Create autocommand group with consistent naming
---@param name string Group name suffix
---@return integer Autocommand group ID
local function create_augroup(name)
	return vim.api.nvim_create_augroup("MiniFiles_" .. name, { clear = true })
end

---Configure buffer-specific keymaps for Mini.files
---@param buf_id integer Buffer ID
local function setup_buffer_keymaps(buf_id)
	vim.keymap.set("n", "<leader>y", utils.copy_relative_path, {
		buffer = buf_id,
		noremap = true,
		silent = true,
		desc = "Copy relative path from nvim root to clipboard",
	})
end

---Setup Mini.files with Git integration
function M.setup()
	-- Configure Mini.files
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

	-- Setup buffer creation handler
	vim.api.nvim_create_autocmd("User", {
		pattern = "MiniFilesBufferCreate",
		callback = function(args)
			setup_buffer_keymaps(args.data.buf_id)
		end,
		desc = "Setup Mini.files buffer keymaps",
	})

	-- Setup Git status integration autocommands
	vim.api.nvim_create_autocmd("User", {
		group = create_augroup("git_integration"),
		pattern = "MiniFilesExplorerOpen",
		callback = function()
			update_git_status(vim.api.nvim_get_current_buf())
		end,
		desc = "Update Git status when Mini.files opens",
	})

	vim.api.nvim_create_autocmd("User", {
		group = create_augroup("git_cleanup"),
		pattern = "MiniFilesExplorerClose",
		callback = clear_git_status_cache,
		desc = "Clear Git status cache when Mini.files closes",
	})

	vim.api.nvim_create_autocmd("User", {
		group = create_augroup("git_refresh"),
		pattern = "MiniFilesBufferUpdate",
		callback = function(args)
			local git_root = get_git_root(args.data.buf_id)
			local cached_data = git_status_cache[git_root]

			if cached_data then
				update_buffer_git_indicators(args.data.buf_id, cached_data.status_map)
			end
		end,
		desc = "Refresh Git status display on buffer update",
	})
end

return M
