local M = {}

local HIGHLIGHT_NS = vim.api.nvim_create_namespace("gitconflict")

--- Find conflict boundaries around cursor (1-based lines).
--- Returns {start, sep, ["end"]} or nil.
local function find_conflict()
  local buf = vim.api.nvim_get_current_buf()
  local lnum = vim.fn.line(".")
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)

  -- Search backward for <<<<<<<
  local start
  for i = lnum, 1, -1 do
    if lines[i]:match("^<<<<<<<") then
      start = i
      break
    end
  end
  if not start then return nil end

  -- Search forward for =======
  local sep
  for i = start + 1, #lines do
    if lines[i]:match("^>>>>>>>") then return nil end
    if lines[i]:match("^=======") then
      sep = i
      break
    end
  end
  if not sep then return nil end

  -- Search forward for >>>>>>>
  local fin
  for i = sep + 1, #lines do
    if lines[i]:match("^<<<<<<<") then return nil end
    if lines[i]:match("^>>>>>>>") then
      fin = i
      break
    end
  end
  if not fin then return nil end

  return { start = start, sep = sep, ["end"] = fin }
end

--- Refresh conflict highlighting for a buffer.
function M.refresh_highlights(bufnr)
  bufnr = bufnr or vim.api.nvim_get_current_buf()
  vim.api.nvim_buf_clear_namespace(bufnr, HIGHLIGHT_NS, 0, -1)

  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local in_our = false
  local in_theirs = false

  for i, line in ipairs(lines) do
    if line:match("^<<<<<<< .+") then
      vim.api.nvim_buf_add_highlight(bufnr, HIGHLIGHT_NS, "DiffDelete", i - 1, 0, -1)
      in_our = true
      in_theirs = false
    elseif in_our and line:match("^=======.*") then
      vim.api.nvim_buf_add_highlight(bufnr, HIGHLIGHT_NS, "DiffText", i - 1, 0, -1)
      in_our = false
      in_theirs = true
    elseif line:match("^>>>>>>> .+") then
      vim.api.nvim_buf_add_highlight(bufnr, HIGHLIGHT_NS, "DiffDelete", i - 1, 0, -1)
      in_theirs = false
    elseif in_our then
      vim.api.nvim_buf_add_highlight(bufnr, HIGHLIGHT_NS, "DiffAdd", i - 1, 0, -1)
    elseif in_theirs then
      vim.api.nvim_buf_add_highlight(bufnr, HIGHLIGHT_NS, "DiffChange", i - 1, 0, -1)
    end
  end
end

--- Resolve: keep ours (<<<<<<< … =======).
function M.resolve_ours()
  local c = find_conflict()
  if not c then
    vim.notify("No conflict at cursor", vim.log.levels.WARN)
    return
  end
  local buf = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  local ours = {}
  for i = c.start + 1, c.sep - 1 do
    ours[#ours + 1] = lines[i]
  end
  vim.api.nvim_buf_set_lines(buf, c.start - 1, c["end"], false, ours)
  M.refresh_highlights(buf)
end

--- Resolve: keep theirs (======= … >>>>>>>).
function M.resolve_theirs()
  local c = find_conflict()
  if not c then
    vim.notify("No conflict at cursor", vim.log.levels.WARN)
    return
  end
  local buf = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  local theirs = {}
  for i = c.sep + 1, c["end"] - 1 do
    theirs[#theirs + 1] = lines[i]
  end
  vim.api.nvim_buf_set_lines(buf, c.start - 1, c["end"], false, theirs)
  M.refresh_highlights(buf)
end

--- Resolve: keep both sides concatenated (theirs + ours).
function M.resolve_both()
  local c = find_conflict()
  if not c then
    vim.notify("No conflict at cursor", vim.log.levels.WARN)
    return
  end
  local buf = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  local both = {}
  for i = c.start + 1, c.sep - 1 do
    both[#both + 1] = lines[i]
  end
  for i = c.sep + 1, c["end"] - 1 do
    both[#both + 1] = lines[i]
  end
  vim.api.nvim_buf_set_lines(buf, c.start - 1, c["end"], false, both)
  M.refresh_highlights(buf)
end

--- Jump to next conflict marker.
function M.next_conflict()
  local lnum = vim.fn.line(".")
  local total = vim.fn.line("$")
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  for i = lnum + 1, total do
    if lines[i] and lines[i]:match("^<<<<<<<") then
      vim.fn.cursor(i, 1)
      return
    end
  end
  vim.notify("No more conflicts", vim.log.levels.INFO)
end

--- Jump to previous conflict marker.
function M.prev_conflict()
  local lnum = vim.fn.line(".")
  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  for i = lnum - 1, 1, -1 do
    if lines[i] and lines[i]:match("^<<<<<<<") then
      vim.fn.cursor(i, 1)
      return
    end
  end
  vim.notify("No more conflicts", vim.log.levels.INFO)
end

function M.setup()
  vim.api.nvim_create_autocmd({ "BufReadPost", "BufWritePost" }, {
    group = vim.api.nvim_create_augroup("GitConflictHighlight", { clear = true }),
    callback = function(args)
      M.refresh_highlights(args.buf)
    end,
  })
end

return M
