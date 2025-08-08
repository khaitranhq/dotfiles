-- Mini.nvim utility functions
local M = {}

-- Grep with custom ripgrep configuration
-- Temporarily sets RIPGREP_CONFIG_PATH to use nvim-specific config
function M.override_ripgrep_config(f)
	local rg_env = "RIPGREP_CONFIG_PATH"
	local cached_rg_config = vim.uv.os_getenv(rg_env) or ""
	vim.uv.os_setenv(rg_env, vim.fn.stdpath("config") .. "/.rg")
	f()
	vim.uv.os_setenv(rg_env, cached_rg_config)
end

-- Copy current item path (relative to neovim startup directory) to clipboard
-- This function can be used within mini.files context
-- Uses the directory where Neovim was opened as the project root
function M.copy_relative_path()
	local mini_files = require("mini.files")
	-- Get the current entry (file or directory)
	local curr_entry = mini_files.get_fs_entry()
	if curr_entry then
		-- Use the directory where Neovim was started as project root
		local project_root = vim.fn.getcwd()

		-- Calculate relative path from neovim startup directory
		local relative_path = vim.fn.fnamemodify(curr_entry.path, ":.")

		-- If the simple :. modifier doesn't work (file outside cwd), try manual calculation
		if vim.startswith(relative_path, "/") then
			-- Ensure project_root ends with /
			local root_with_slash = project_root:match("/$") and project_root or project_root .. "/"
			-- Remove the project root prefix from the file path
			if vim.startswith(curr_entry.path, root_with_slash) then
				relative_path = curr_entry.path:sub(#root_with_slash + 1)
			elseif curr_entry.path == project_root then
				relative_path = "."
			else
				-- File is outside the neovim startup directory, use absolute path
				relative_path = curr_entry.path
			end
		end

		-- Copy the relative path to the system clipboard
		vim.fn.setreg("+", relative_path)

		-- Provide clear feedback about what was copied
		vim.notify("Path copied to clipboard (from nvim root): " .. relative_path, vim.log.levels.INFO)
	else
		vim.notify("No file or directory selected", vim.log.levels.WARN)
	end
end

-- Get diagnostics count for a buffer
function M.get_diagnostics(bufnr)
	local diagnostics = vim.diagnostic.get(bufnr)
	local counts = { error = 0, warn = 0 }
	for _, d in ipairs(diagnostics) do
		if d.severity == vim.diagnostic.severity.ERROR then
			counts.error = counts.error + 1
		elseif d.severity == vim.diagnostic.severity.WARN then
			counts.warn = counts.warn + 1
		end
	end
	return counts
end

return M