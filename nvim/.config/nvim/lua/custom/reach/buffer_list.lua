-- buffer_list.lua
-- Handles buffer listing and formatting

local M = {}

--- Get list of valid buffers
--- @return table List of buffer info tables
function M.get_buffers()
  local buffers = {}
  local buf_list = vim.api.nvim_list_bufs()
  local current_bufnr = vim.api.nvim_get_current_buf()

  for _, bufnr in ipairs(buf_list) do
    -- Skip current buffer
    if bufnr == current_bufnr then
      goto continue
    end

    -- Only include listed, valid buffers
    if vim.api.nvim_buf_is_valid(bufnr) and vim.api.nvim_get_option_value("buflisted", { buf = bufnr }) then
      local name = vim.api.nvim_buf_get_name(bufnr)

      -- Skip empty buffers
      if name ~= "" then
        local is_modified = vim.api.nvim_get_option_value("modified", { buf = bufnr })
        table.insert(buffers, {
          bufnr = bufnr,
          name = name,
          modified = is_modified,
        })
      end
    end

    ::continue::
  end

  return buffers
end

--- Format buffer list with selection keys (1-9, a-z)
--- @param buffers table List of buffer info tables
--- @return table Formatted lines for display
--- @return table Map of keys to buffer numbers
--- @return table List of line indices (0-based) that are modified
function M.format_buffers(buffers)
  local lines = {}
  local key_map = {}
  local modified_lines = {}
  local cwd = vim.fn.getcwd()

  -- Generate selection keys: prioritize home row (asdf) first, then surrounding keys
  -- Order: a, s, d, f, g, h, j, k, l, q, w, e, r, t, y, u, i, o, p, z, x, c, v, b, n, m
  local function get_selection_key(index)
    -- Optimized key sequence for easy reach (home row first, then top/bottom rows)
    local keys = {
      -- Home row (asdf cluster + surrounding)
      "a",
      "s",
      "d",
      "f", -- primary home row left
      "g",
      "h",
      "j",
      "k",
      "l", -- primary home row right
      -- Top row (surrounding keys)
      "q",
      "w",
      "e",
      "r",
      "t",
      "y",
      "u",
      "i",
      "o",
      "p",
      -- Bottom row
      "z",
      "x",
      "c",
      "v",
      "b",
      "n",
      "m",
    }

    if index <= #keys then
      return keys[index]
    end
    return nil
  end

  -- Build formatted lines
  for i, buf in ipairs(buffers) do
    local key = get_selection_key(i)
    if not key then
      break -- Max 27 buffers (optimized key sequence)
    end

    -- Get relative path from cwd
    local display_path = buf.name
    if vim.startswith(buf.name, cwd) then
      display_path = vim.fn.fnamemodify(buf.name, ":.")
    end

    -- Add modified indicator if buffer is modified
    local modified_icon = buf.modified and " ●" or ""

    -- Format: [key] path ●
    local line = string.format("[%s] %s%s", key, display_path, modified_icon)
    table.insert(lines, line)

    -- Track modified buffers by line index (0-based for nvim API)
    if buf.modified then
      table.insert(modified_lines, #lines - 1)
    end

    -- Store mapping
    key_map[key] = buf.bufnr
  end

  return lines, key_map, modified_lines
end

return M
