-- Mini.nvim configuration with utilities
-- Global utility functions for Mini.pick customization

local M = {}

-- Gruvbox hard variant color palette
-- Extracted for reusability and maintainability
M.gruvbox_hard = {
	bg0 = "#1d2021", -- darkest background
	bg1 = "#3c3836", -- dark gray
	bg2 = "#504945", -- medium gray
	bg3 = "#665c54", -- light gray
	fg0 = "#ebdbb2", -- foreground
	fg1 = "#928374", -- muted foreground
	red = "#cc241d", -- error red
	green = "#98971a", -- success green
	yellow = "#d65d0e", -- warning orange
	blue = "#458588", -- info blue
	purple = "#b16286", -- replace mode
	aqua = "#689d6a", -- special
	orange = "#d65d0e", -- warning
}

-- File picker with icons using fd command
-- Excludes common build/cache directories for better performance
-- Grep with custom ripgrep configuration
-- Temporarily sets RIPGREP_CONFIG_PATH to use nvim-specific config
function OverrideRipgrepConfig(f)
	local rg_env = "RIPGREP_CONFIG_PATH"
	local cached_rg_config = vim.uv.os_getenv(rg_env) or ""
	vim.uv.os_setenv(rg_env, vim.fn.stdpath("config") .. "/.rg")
	f()
	vim.uv.os_setenv(rg_env, cached_rg_config)
end

-- Setup custom highlight groups for mini.statusline using Gruvbox colors
local function setup_statusline_highlights()
	local colors = M.gruvbox_hard

	-- Mode-specific highlights with bold styling
	local mode_highlights = {
		MiniStatuslineModeNormal = { fg = colors.bg0, bg = colors.blue, bold = true },
		MiniStatuslineModeInsert = { fg = colors.bg0, bg = colors.green, bold = true },
		MiniStatuslineModeVisual = { fg = colors.bg0, bg = colors.yellow, bold = true },
		MiniStatuslineModeReplace = { fg = colors.bg0, bg = colors.purple, bold = true },
		MiniStatuslineModeCommand = { fg = colors.bg0, bg = colors.red, bold = true },
		MiniStatuslineModeOther = { fg = colors.bg0, bg = colors.aqua, bold = true },
	}

	-- Section-specific highlights
	local section_highlights = {
		MiniStatuslineDevinfo = { fg = colors.fg0, bg = colors.bg2 },
		MiniStatuslineFilename = { fg = colors.fg0, bg = colors.bg1 },
		MiniStatuslineFileinfo = { fg = colors.fg1, bg = colors.bg2 },
		MiniStatuslineInactive = { fg = colors.bg3, bg = colors.bg1 },
	}

	-- Apply all highlights
	for name, opts in pairs(mode_highlights) do
		vim.api.nvim_set_hl(0, name, opts)
	end

	for name, opts in pairs(section_highlights) do
		vim.api.nvim_set_hl(0, name, opts)
	end
end

-- Mini.pairs configuration
local function setup_pairs()
	require("mini.pairs").setup()
end

-- Mini.surround configuration
local function setup_surround()
	require("mini.surround").setup()
end

-- Mini.pick configuration with custom registry
local function setup_pick()
	local win_config = function()
		local height = math.floor(0.618 * vim.o.lines)
		local width = math.floor(0.618 * vim.o.columns)
		return {
			anchor = "NW",
			height = height,
			width = width,
			row = math.floor(0.5 * (vim.o.lines - height)),
			col = math.floor(0.5 * (vim.o.columns - width)),
		}
	end
	require("mini.pick").setup({ window = { config = win_config } })
	-- Register custom file picker
	MiniPick.registry.files_fd = MiniPickFilesWithIcons
end

-- Mini.indentscope configuration
local function setup_indentscope()
	require("mini.indentscope").setup({
		symbol = "│",
	})
end

-- Mini.statusline configuration with custom Gruvbox styling
local function setup_statusline()
	require("mini.statusline").setup()

	-- Apply initial highlights
	setup_statusline_highlights()

	-- Reapply highlights when colorscheme changes
	vim.api.nvim_create_autocmd("ColorScheme", {
		pattern = "*",
		callback = setup_statusline_highlights,
		desc = "Apply Gruvbox hard variant colors to mini.statusline",
	})
end

-- Mini.tabline configuration with custom formatting
local function setup_tabline()
	require("mini.tabline").setup({
		format = function(buf_id, label)
			local suffix = vim.bo[buf_id].modified and "+ " or ""
			return " " .. buf_id .. MiniTabline.default_format(buf_id, label) .. suffix
		end,
	})
end

-- Mini.trailspace configuration
local function setup_trailspace()
	require("mini.trailspace").setup()
end

-- Copy current item path (relative to neovim startup directory) to clipboard
-- This function can be used within mini.files context
-- Uses the directory where Neovim was opened as the project root
function MiniFilesCopyRelativePath()
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

-- Mini.files configuration
local function setup_files()
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
			vim.keymap.set("n", "<leader>y", MiniFilesCopyRelativePath, {
				buffer = buf_id,
				noremap = true,
				silent = true,
				desc = "Copy relative path from nvim root to clipboard",
			})
		end,
	})
end

-- Mini.extra configuration
local function setup_extra()
	require("mini.extra").setup()

	-- Create MiniDiagnostic command to run MiniExtra.pickers.diagnostic()
	vim.api.nvim_create_user_command("MiniDiagnostic", function()
		require("mini.extra").pickers.diagnostic()
	end, {
		desc = "Open Mini.extra diagnostic picker",
	})
end

-- Main plugin configuration
return {
	{
		"echasnovski/mini.nvim",
		version = "*",
		config = function()
			-- Setup all mini modules
			setup_pairs()
			setup_surround()
			setup_pick()
			setup_indentscope()
			setup_statusline()
			setup_tabline()
			setup_trailspace()
			setup_files()
			setup_extra()
			require("mini.git").setup()
			require("mini.diff").setup({
				view = {
					style = "sign",
				},
			})
		end,
	},
}
