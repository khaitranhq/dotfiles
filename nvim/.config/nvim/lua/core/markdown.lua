local M = {}

-- ============ Tag Highlighting ============

local PALETTE = {
  { fg = "#e67e22", bg = "#3c2a1e" }, -- orange
  { fg = "#3498db", bg = "#1a2d3d" }, -- blue
  { fg = "#2ecc71", bg = "#1a3d2a" }, -- green
  { fg = "#e74c3c", bg = "#3d1a1a" }, -- red
  { fg = "#9b59b6", bg = "#2d1a3d" }, -- purple
  { fg = "#1abc9c", bg = "#1a3d3d" }, -- teal
  { fg = "#f39c12", bg = "#3d3d1a" }, -- gold
  { fg = "#e8e8e8", bg = "#2d2d3d" }, -- light
  { fg = "#e91e63", bg = "#3d1a2d" }, -- pink
  { fg = "#00bcd4", bg = "#1a3d3d" }, -- cyan
  { fg = "#ff5722", bg = "#3d2a1e" }, -- deep orange
  { fg = "#8bc34a", bg = "#2a3d1a" }, -- lime
  { fg = "#ffc107", bg = "#3d3d1a" }, -- amber
  { fg = "#607d8b", bg = "#2d3d3d" }, -- blue grey
  { fg = "#ff9800", bg = "#3d2a1e" }, -- deep orange 2
  { fg = "#cddc39", bg = "#3d3d1a" }, -- lime 2
}

local function tag_idx(name)
  local h = 0
  for i = 1, #name do
    h = h * 31 + string.byte(name, i)
  end
  return (h % #PALETTE) + 1
end

-- ============ Priority Maps ============

local prio_map = { p1 = "🔥", p2 = "⭐", p3 = "📋", p4 = "💤" }
local priority_order = { ["🔥"] = 1, ["⭐"] = 2, ["📋"] = 3, ["💤"] = 4 }

local set_priority_map = {
  critical = "🔴",
  high = "🟠",
  medium = "🟡",
  low = "🟢",
}

-- ============ Treesitter Code-Block Detection ============

--- Returns true if line lnum (0-indexed) is inside a fenced or indented code block.
--- @param bufnr number Buffer number
--- @param lnum number Line number (0-indexed)
local function in_code_block(bufnr, lnum)
  local ok, parser = pcall(vim.treesitter.get_parser, bufnr, "markdown")
  if not ok or not parser then
    return false
  end
  local tree = parser:parse()[1]
  if not tree then
    return false
  end

  for child in tree:root():iter_children() do
    local t = child:type()
    if t == "fenced_code_block" or t == "indented_code_block" then
      local sr, _, er, _ = child:range()
      if lnum >= sr and lnum < er then
        return true
      end
    end
  end
  return false
end

-- ============ Task ID Formatting ============

--- Format and renumber markdown task IDs in the buffer, skipping code blocks.
--- Sorts contiguous task blocks by priority, assigns sequential backtick IDs.
--- @param bufnr number Buffer number (0 for current)
local function format_task_ids(bufnr)
  bufnr = bufnr or 0
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local changed = false
  local parsed = {}

  for i, line in ipairs(lines) do
    -- Skip lines inside code blocks
    if in_code_block(bufnr, i - 1) then
      parsed[i] = false
    else
      local indent, status = line:match("^(%s*)%- %[(.)%]%s*")
      if not indent then
        parsed[i] = false
      else
        local rest = line:match("^%s*%- %[.%]%s*(.*)$") or ""

        -- Strip existing backtick ID (e.g. `03`)
        rest = rest:gsub("^`%d+`%s*", "")

        -- Check and remove priority marker
        local emoji
        for p, e in pairs(prio_map) do
          if rest:match("%f[%w]" .. p .. "%f[^%w]") then
            rest = rest:gsub("%s*" .. p .. "%f[^%w]%s*", " ")
            for _, old_e in pairs(prio_map) do
              rest = rest:gsub("^" .. old_e .. "%s*", "")
            end
            emoji = e
            break
          end
        end
        -- Fallback: detect priority from existing emoji directly
        if not emoji then
          for _, e in pairs(prio_map) do
            if rest:match("^" .. e) then
              emoji = e
              rest = rest:gsub("^" .. e .. "%s*", "")
              break
            end
          end
        end

        -- Normalize whitespace
        rest = rest:gsub("%s+", " ")
        rest = rest:gsub("^%s*(.-)%s*$", "%1")

        parsed[i] = { status = status, emoji = emoji, rest = rest, indent = indent }
      end
    end
  end

  -- Sort contiguous task blocks by priority
  local function prio_rank(p)
    return p.emoji and priority_order[p.emoji] or 5
  end

  local task_counter = 0
  local i = 1
  while i <= #lines do
    if parsed[i] then
      local start = i
      while i <= #lines and parsed[i] do
        i = i + 1
      end
      local block = {}
      for j = start, i - 1 do
        table.insert(block, { idx = j, p = parsed[j] })
      end
      table.sort(block, function(a, b)
        local ka, kb = prio_rank(a.p), prio_rank(b.p)
        if ka ~= kb then
          return ka < kb
        end
        return a.idx < b.idx
      end)
      for offset, entry in ipairs(block) do
        task_counter = task_counter + 1
        local p = entry.p
        local id_str = "`" .. string.format("%02d", task_counter) .. "`"
        local seg = p.emoji and (p.emoji .. " " .. p.rest) or p.rest
        seg = seg:gsub("%s+$", "")
        local new_line = p.indent .. "- [" .. p.status .. "] " .. id_str
        if seg ~= "" then
          new_line = new_line .. " " .. seg
        end
        if new_line ~= lines[start + offset - 1] then
          changed = true
        end
        lines[start + offset - 1] = new_line
      end
    else
      i = i + 1
    end
  end

  if changed then
    vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
  end
end

-- ============ Public API ============

--- Adds a priority icon after a markdown checkbox `- [ ]`.
--- Priority levels: critical (🔴), high (🟠), medium (🟡), low (🟢)
--- @param priority string The priority level: "critical", "high", "medium", or "low"
function M.set_markdown_priority(priority)
  local icon = set_priority_map[priority]
  if not icon then
    vim.notify("Invalid priority: " .. priority, vim.log.levels.ERROR)
    return
  end

  local row = vim.api.nvim_win_get_cursor(0)[1]
  if in_code_block(0, row - 1) then
    vim.notify("Cannot set priority inside a code block", vim.log.levels.WARN)
    return
  end

  local line = vim.api.nvim_get_current_line()
  local leading_space, checkbox, rest =
    line:match("^(%s*)- (%[.%])%s*[🔴🟠🟡🟢]?%s*(.*)")

  if checkbox then
    local new_line = leading_space .. "- " .. checkbox .. " " .. icon .. " " .. rest
    vim.api.nvim_buf_set_lines(0, row - 1, row, false, { new_line })
    vim.cmd("silent write")
  else
    vim.notify("Not on a markdown task line", vim.log.levels.WARN)
  end
end

--- Re-format markdown task IDs in the current buffer.
--- Skips checkboxes inside fenced/indented code blocks.
function M.fix_markdown_task_ids()
  if vim.bo.filetype ~= "markdown" then
    vim.notify("Not a markdown buffer", vim.log.levels.WARN)
    return
  end
  format_task_ids(0)
end

-- ============ Setup ============

M.setup = function()
  -- Tag highlighting
  local hl_groups = {}
  for i, c in ipairs(PALETTE) do
    local name = "MarkdownTag" .. i
    vim.api.nvim_set_hl(0, name, { fg = c.fg, bg = c.bg, bold = true })
    hl_groups[i] = name
  end

  local ns = vim.api.nvim_create_namespace("markdown_tags")
  local tag_group = vim.api.nvim_create_augroup("MarkdownTags", { clear = true })

  local function refresh_tags(buf)
    vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
    local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
    for line_i, line in ipairs(lines) do
      local pos = 1
      while pos <= #line do
        local s, e = line:find("#[%w_%-]+", pos)
        if not s then
          break
        end
        local tag = line:sub(s + 1, e)
        vim.api.nvim_buf_set_extmark(buf, ns, line_i - 1, s - 1, {
          end_col = e,
          hl_group = hl_groups[tag_idx(tag)],
          priority = 150,
        })
        pos = e + 1
      end
    end
  end

  vim.api.nvim_create_autocmd("FileType", {
    group = tag_group,
    pattern = "markdown",
    callback = function(args)
      refresh_tags(args.buf)
    end,
  })
  vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI" }, {
    group = tag_group,
    callback = function()
      local buf = vim.api.nvim_get_current_buf()
      if vim.bo[buf].filetype == "markdown" then
        refresh_tags(buf)
      end
    end,
  })

  -- Task ID formatting on save
  local task_group = vim.api.nvim_create_augroup("MarkdownTaskIds", { clear = true })
  vim.api.nvim_create_autocmd("BufWritePre", {
    group = task_group,
    pattern = "*.md",
    callback = function()
      format_task_ids(0)
    end,
  })
end

return M
