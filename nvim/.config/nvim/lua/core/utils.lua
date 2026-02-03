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
    { label = "Absolute path",       value = abs_path },
    { label = "Filename only",       value = filename },
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

--- Removes all trailing whitespace from the current buffer.
--- Preserves cursor position after removal.
--- Displays notification with count of lines modified.
function M.remove_trailing_whitespace()
  -- Save current cursor position
  local cursor_pos = vim.api.nvim_win_get_cursor(0)
  local line_count = vim.api.nvim_buf_line_count(0)

  -- Count lines with trailing whitespace before removal
  local modified_count = 0
  for i = 1, line_count do
    local line = vim.api.nvim_buf_get_lines(0, i - 1, i, false)[1]
    if line and line:match("%s+$") then
      modified_count = modified_count + 1
    end
  end

  -- Remove trailing whitespace using substitute command
  vim.cmd([[%s/\s\+$//e]])

  -- Restore cursor position
  pcall(vim.api.nvim_win_set_cursor, 0, cursor_pos)

  -- Notify user of changes
  if modified_count > 0 then
    vim.notify(string.format("Removed trailing whitespace from %d line(s)", modified_count), vim.log.levels.INFO)
  else
    vim.notify("No trailing whitespace found", vim.log.levels.INFO)
  end
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

    -- If marking as done, move the line to the end of the file
    if state == "done" then
      -- Get the updated line
      local line_to_move = vim.api.nvim_buf_get_lines(0, row - 1, row, false)[1]
      -- Delete the current line
      vim.api.nvim_buf_set_lines(0, row - 1, row, false, {})
      -- Get the last line number
      local last_line = vim.api.nvim_buf_line_count(0)
      -- Append the line at the end
      vim.api.nvim_buf_set_lines(0, last_line, last_line, false, { line_to_move })
      -- Move cursor to the moved line
      vim.api.nvim_win_set_cursor(0, { last_line + 1, 0 })
    end

    -- Save the buffer
    vim.cmd("silent write")
  else
    vim.notify("Not on a markdown task line", vim.log.levels.WARN)
  end
end

return M
