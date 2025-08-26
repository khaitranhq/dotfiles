local M = {}
local merge_tb = vim.tbl_deep_extend

M.load_mappings = function()
	vim.schedule(function()
		local function set_section_map(section_values)
			for mode, mode_values in pairs(section_values) do
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

		local mappings = require("core.mappings")

		for _, sect in pairs(mappings) do
			set_section_map(sect)
		end
	end)
end

M.select_tab = function()
	local tabs = vim.api.nvim_list_tabpages()
	local tab_names = {}

	for _, tab in ipairs(tabs) do
		local tabnr = vim.api.nvim_tabpage_get_number(tab)
		local tabname = "Tab " .. tabnr
		table.insert(tab_names, { tab = tab, name = tabname })
	end

	vim.ui.select(tab_names, {
		prompt = "Select a tab:",
		format_item = function(item)
			return item.name
		end,
	}, function(choice)
		if choice then
			vim.api.nvim_set_current_tabpage(choice.tab)
		end
	end)
end

--- Prompt user to copy current buffer's absolute or relative path to clipboard.
--- Uses vim.ui.select for UI, copies result to system clipboard.
--- - Absolute: Full path to file.
--- - Relative: Path from current working directory.
function M.copy_buffer_path()
	local buf_path = vim.api.nvim_buf_get_name(0)
	if buf_path == "" then
		vim.notify("No file in current buffer.", vim.log.levels.WARN)
		return
	end

	local abs_path = buf_path
	local rel_path = vim.fn.fnamemodify(buf_path, ":~:.") -- relative to cwd and ~
	local choices = {
		{ label = "Relative path (cwd)", value = rel_path },
		{ label = "Absolute path", value = abs_path },
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

--- Runs a shell command and displays the result in a floating terminal window.
--- @param command string|table: The shell command to run (string or table of args)
--- @param opts table|nil: Optional configuration
---   - title: string - Window title (default: "Shell Command")
---   - width: number - Window width ratio (default: 0.8)
---   - height: number - Window height ratio (default: 0.7)
---   - cwd: string - Working directory for command (default: current)
---   - close_on_exit: boolean - Auto-close on command completion (default: false)
---   - post_command_func: function - Function to call after window is closed (default: nil)
function M.run_shell_in_float(command, opts)
	if not command then
		vim.notify("No command provided", vim.log.levels.ERROR)
		return
	end

	local api = vim.api
	opts = opts or {}

	-- Default options
	local title = opts.title or "Shell Command"
	local width_ratio = opts.width or 0.8
	local height_ratio = opts.height or 0.7
	local cwd = opts.cwd or vim.fn.getcwd()
	local close_on_exit = opts.close_on_exit or false
	local post_command_func = opts.post_command_func

	-- Calculate window dimensions
	local width = math.floor(vim.o.columns * width_ratio)
	local height = math.floor(vim.o.lines * height_ratio)
	local row = math.floor((vim.o.lines - height) / 2)
	local col = math.floor((vim.o.columns - width) / 2)

	-- Create a scratch buffer for the terminal
	local buf = api.nvim_create_buf(false, true)

	-- Configure floating window options
	local win_opts = {
		relative = "editor",
		width = width,
		height = height,
		row = row,
		col = col,
		style = "minimal",
		border = "rounded",
		title = " " .. title .. " ",
		title_pos = "center",
	}

	-- Open the floating window
	local win = api.nvim_open_win(buf, true, win_opts)

	-- Set buffer options
	vim.bo[buf].buftype = "nofile"
	vim.bo[buf].bufhidden = "wipe"
	vim.bo[buf].swapfile = false

	-- Declare job_id here so it's available in the terminal callback
	local job_id

	-- Open terminal in the buffer
	local term_chan = api.nvim_open_term(buf, {
		on_input = function(_, _, _, data)
			-- Handle terminal input if needed - validate job_id and channel
			if job_id and job_id > 0 then
				-- Check if the job is still running before sending data
				local job_info = vim.fn.jobwait({ job_id }, 0)
				if job_info[1] == -1 then -- Job is still running
					vim.fn.chansend(job_id, data)
				end
			end
		end,
	})

	-- Prepare command for execution
	local cmd_args
	if type(command) == "string" then
		-- Use shell to execute string commands
		cmd_args = { "sh", "-c", command }
	else
		cmd_args = command
	end

	-- Start the command
	job_id = vim.fn.jobstart(cmd_args, {
		cwd = cwd,
		on_stdout = function(_, data)
			if data and term_chan and api.nvim_buf_is_valid(buf) and api.nvim_win_is_valid(win) then
				for _, line in ipairs(data) do
					if line ~= "" then
						-- Safely send output to terminal with error handling
						local success, _ = pcall(api.nvim_chan_send, term_chan, line .. "\r\n")
						if not success then
							-- Terminal channel might be closed, stop trying to send
							break
						end
					end
				end
			end
		end,
		on_stderr = function(_, data)
			if data and term_chan and api.nvim_buf_is_valid(buf) and api.nvim_win_is_valid(win) then
				for _, line in ipairs(data) do
					if line ~= "" then
						-- Safely send error output to terminal with error handling
						local success, _ = pcall(api.nvim_chan_send, term_chan, "\027[31m" .. line .. "\027[0m\r\n")
						if not success then
							-- Terminal channel might be closed, stop trying to send
							break
						end
					end
				end
			end
		end,
		on_exit = function(_, exit_code)
			if term_chan and api.nvim_buf_is_valid(buf) and api.nvim_win_is_valid(win) then
				local status_msg = "\r\n"
				if exit_code == 0 then
					status_msg = status_msg .. "\027[32m✓ Command completed successfully\027[0m"
				else
					status_msg = status_msg .. "\027[31m✗ Command failed with exit code: " .. exit_code .. "\027[0m"
				end

				if not close_on_exit then
					status_msg = status_msg .. "\r\n\r\nPress q or ESC to close"
				end

				-- Safely send the exit status message
				local _, _ = pcall(api.nvim_chan_send, term_chan, status_msg .. "\r\n")

				-- Switch to normal mode when command is done
				vim.schedule(function()
					if api.nvim_win_is_valid(win) and api.nvim_get_current_win() == win then
						vim.cmd("stopinsert")
					end
				end)

				-- Auto-close if requested
				if close_on_exit then
					vim.defer_fn(function()
						if api.nvim_win_is_valid(win) then
							api.nvim_win_close(win, true)
							-- Call post_command_func if provided
							if post_command_func and type(post_command_func) == "function" then
								post_command_func()
							end
						end
					end, 2000) -- Close after 2 seconds
				else
					-- Set up keymaps to close the window
					local function close_window()
						if api.nvim_win_is_valid(win) then
							api.nvim_win_close(win, true)

							-- Call post_command_func if provided
							if post_command_func and type(post_command_func) == "function" then
								post_command_func()
							end
						end
					end

					-- Set keymaps for normal mode only to avoid conflicts with terminal input
					vim.keymap.set("n", "q", close_window, { buffer = buf, nowait = true })
					vim.keymap.set("n", "<Esc>", close_window, { buffer = buf, nowait = true })
				end
			end
		end,
		stdout_buffered = false,
		stderr_buffered = false,
		pty = true, -- Enable PTY for better terminal behavior
	})

	-- Handle job start failure
	if job_id <= 0 then
		vim.notify("Failed to start command: " .. vim.inspect(command), vim.log.levels.ERROR)
		if api.nvim_win_is_valid(win) then
			api.nvim_win_close(win, true)
			-- Call post_command_func if provided
			if post_command_func and type(post_command_func) == "function" then
				post_command_func()
			end
		end
		return
	end

	-- Enter terminal mode
	vim.cmd("startinsert")

	return {
		job_id = job_id,
		term_chan = term_chan,
		buffer = buf,
		window = win,
	}
end

return M
