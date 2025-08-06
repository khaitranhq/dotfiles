-- nui-ui.lua
-- Enhanced UI implementations for vim.ui.input and vim.ui.select using nui.nvim
-- This module provides modern, floating window interfaces to replace Neovim's default UI components

local Input = require("nui.input")
local Menu = require("nui.menu")
local event = require("nui.utils.autocmd").event

local M = {}

-- Configuration for the UI components
M.config = {
	input = {
		-- Position in center both horizontally and vertically
		position = {
			row = "50%",
			col = "50%",
		},
		size = {
			width = 60,
			height = 1,
		},
		border = {
			style = "rounded", -- "single", "double", "rounded", "solid", "shadow"
			text = {
				top_align = "center",
			},
		},
		win_options = {
			-- Use consistent highlighting with your colorscheme
			winhighlight = "Normal:Normal,FloatBorder:FloatBorder",
		},
		prompt_prefix = "❯ ", -- Customize the prompt prefix
	},
	select = {
		-- Position in center both horizontally and vertically
		position = {
			row = "50%",
			col = "50%",
		},
		size = {
			width = 60,
			max_height = 15, -- Maximum height for the menu
		},
		border = {
			style = "rounded",
			text = {
				top_align = "center",
			},
		},
		win_options = {
			winhighlight = "Normal:Normal,FloatBorder:FloatBorder,CursorLine:Visual",
		},
		keymap = {
			focus_next = { "j", "<Down>", "<Tab>" },
			focus_prev = { "k", "<Up>", "<S-Tab>" },
			close = { "<Esc>", "<C-c>", "q" },
			submit = { "<CR>", "<Space>" },
		},
	},
}

-- Enhanced vim.ui.input implementation
-- Provides a floating input dialog with improved styling and UX
function M.input(opts, on_confirm)
	opts = opts or {}

	-- Extract prompt text for the border title
	local prompt_text = opts.prompt or "Input"
	-- Remove trailing colon and whitespace for cleaner display
	prompt_text = prompt_text:gsub(":?%s*$", "")

	-- Calculate width based on prompt length with minimum and maximum constraints
	local calculated_width = math.max(30, math.min(80, #prompt_text + 20))

	local input_config = vim.tbl_deep_extend("force", M.config.input, {
		position = {
			row = "50%",
			col = "50%",
		},
		size = {
			width = calculated_width,
			height = 1,
		},
		border = {
			text = {
				top = " " .. prompt_text .. " ",
			},
		},
	})

	local input_options = {
		prompt = M.config.input.prompt_prefix,
		default_value = opts.default or "",
		on_close = function()
			-- Call on_confirm with nil when input is cancelled
			if on_confirm then
				on_confirm(nil)
			end
		end,
		on_submit = function(value)
			-- Call on_confirm with the input value
			if on_confirm then
				on_confirm(value)
			end
		end,
	}

	local input = Input(input_config, input_options)

	-- Mount the input component
	input:mount()

	-- Auto-close on buffer leave to prevent orphaned windows
	input:on(event.BufLeave, function()
		input:unmount()
	end)

	-- Set up additional keymaps for better UX
	input:map("i", "<C-c>", function()
		input:unmount()
	end, { noremap = true })

	input:map("i", "<C-w>", function()
		-- Delete word backward (common shell behavior)
		local line = vim.api.nvim_get_current_line()
		local col = vim.api.nvim_win_get_cursor(0)[2]
		local before_cursor = line:sub(1, col)
		local after_cursor = line:sub(col + 1)
		local new_before = before_cursor:gsub("%w*%s*$", "")
		vim.api.nvim_set_current_line(new_before .. after_cursor)
		vim.api.nvim_win_set_cursor(0, { 1, #new_before })
	end, { noremap = true })
end

-- Enhanced vim.ui.select implementation
-- Provides a floating menu with improved navigation and styling
function M.select(items, opts, on_choice)
	opts = opts or {}

	if not items or #items == 0 then
		if on_choice then
			on_choice(nil, nil)
		end
		return
	end

	-- Extract prompt text for the border title
	local prompt_text = opts.prompt or "Select an option"
	prompt_text = prompt_text:gsub(":?%s*$", "")

	-- Build menu items with proper formatting
	local menu_items = {}
	local max_width = 20

	for i, item in ipairs(items) do
		local text
		if type(item) == "string" then
			text = item
		elseif opts.format_item then
			text = opts.format_item(item)
		else
			text = tostring(item)
		end

		max_width = math.max(max_width, #text + 4) -- Add padding
		table.insert(menu_items, Menu.item(text, { index = i, value = item }))
	end

	-- Calculate menu size with constraints
	local menu_height = math.min(#menu_items, M.config.select.size.max_height)
	local menu_width = math.min(max_width, M.config.select.size.width)

	-- Always use center position for consistency
	local menu_config = vim.tbl_deep_extend("force", M.config.select, {
		position = {
			row = "50%",
			col = "50%",
		},
		size = {
			width = menu_width,
			height = menu_height,
		},
		border = {
			text = {
				top = " " .. prompt_text .. " ",
			},
		},
	})

	local menu_options = {
		lines = menu_items,
		max_width = menu_width - 4, -- Account for borders and padding
		keymap = M.config.select.keymap,
		on_close = function()
			-- Call on_choice with nil when menu is cancelled
			if on_choice then
				on_choice(nil, nil)
			end
		end,
		on_submit = function(item)
			-- Call on_choice with the selected item and its index
			if on_choice then
				on_choice(item.value, item.index)
			end
		end,
	}

	-- Create menu with error handling
	local menu
	local success, err = pcall(function()
		menu = Menu(menu_config, menu_options)
		return menu
	end)

	if not success then
		-- Fallback to center position if there's an error
		vim.notify("Position error, using center fallback", vim.log.levels.WARN)
		menu_config.position = "50%"
		menu = Menu(menu_config, menu_options)
	end

	-- Mount the menu component with error handling
	success, err = pcall(function()
		menu:mount()
	end)

	if not success then
		vim.notify("Failed to mount menu: " .. tostring(err), vim.log.levels.ERROR)
		-- Fallback to vim's built-in select
		if M.original_select then
			M.original_select(items, opts, on_choice)
		end
		return
	end

	-- Auto-close on buffer leave to prevent orphaned windows
	menu:on(event.BufLeave, function()
		menu:unmount()
	end)

	-- Set up additional keymaps for numbers (quick selection for small lists)
	if #menu_items <= 9 then
		for i = 1, #menu_items do
			menu:map("n", tostring(i), function()
				if on_choice then
					on_choice(items[i], i)
				end
				menu:unmount()
			end, { noremap = true })
		end
	end
end

-- Store original functions for fallback
M.original_input = nil
M.original_select = nil

-- Setup function to override vim.ui with nui implementations
function M.setup(user_config)
	-- Merge user configuration with defaults
	if user_config then
		M.config = vim.tbl_deep_extend("force", M.config, user_config)
	end

	-- Store original functions for fallback
	M.original_input = vim.ui.input
	M.original_select = vim.ui.select

	-- Override vim.ui.input
	vim.ui.input = M.input

	-- Override vim.ui.select
	vim.ui.select = M.select

	-- Provide feedback that the UI has been enhanced
	vim.schedule(function()
		vim.notify("Enhanced UI loaded with nui.nvim", vim.log.levels.INFO, {
			title = "NUI UI",
		})
	end)
end

-- Utility function to test the input component
function M.test_input()
	vim.ui.input({
		prompt = "Enter your name: ",
		default = "John Doe",
	}, function(input)
		if input then
			vim.notify("Hello, " .. input .. "!", vim.log.levels.INFO)
		else
			vim.notify("Input cancelled", vim.log.levels.WARN)
		end
	end)
end

-- Utility function to test the select component
function M.test_select()
	vim.ui.select({
		"Option 1: Do something",
		"Option 2: Do something else",
		"Option 3: Do nothing",
		"Option 4: Exit",
	}, {
		prompt = "Choose an action:",
		format_item = function(item)
			return "▸ " .. item
		end,
	}, function(choice, idx)
		if choice then
			vim.notify("You selected: " .. choice .. " (index: " .. idx .. ")", vim.log.levels.INFO)
		else
			vim.notify("Selection cancelled", vim.log.levels.WARN)
		end
	end)
end

return M
