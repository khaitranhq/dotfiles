local M = {}

M.setup = function()
  local augroup = vim.api.nvim_create_augroup("CoreAutocommands", { clear = true })

  local prio_map = { p1 = "🔥", p2 = "⭐", p3 = "📋", p4 = "💤" }
  local priority_order = { ["🔥"] = 1, ["⭐"] = 2, ["📋"] = 3, ["💤"] = 4 }

  vim.api.nvim_create_autocmd("BufWritePre", {
    group = augroup,
    pattern = "*",
    callback = function()
      if vim.fn.search("\r", "nw") ~= 0 then
        vim.cmd("%s/\\r//ge")
      end
    end,
  })

  vim.api.nvim_create_autocmd("BufWritePre", {
    group = augroup,
    pattern = "*.md",
    callback = function()
      local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
      local changed = false
      local parsed = {}

      -- Parse all lines: extract task structure
      for i, line in ipairs(lines) do
        local indent, status = line:match("^(%s*)%- %[(.)%]%s*")
        if not indent then
          parsed[i] = false
        else
          local rest = line:match("^%s*%- %[.%]%s*(.*)$")
          rest = rest or ""

          -- Strip existing backtick ID (e.g. `03`)
          rest = rest:gsub("^`%d+`%s*", "")

          -- Check and remove priority marker
          local emoji
          for p, e in pairs(prio_map) do
            if rest:match("%f[%w]" .. p .. "%f[^%w]") then
              rest = rest:gsub("%s*" .. p .. "%f[^%w]%s*", " ")
              -- Strip old priority emoji if present
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

      -- Sort contiguous task blocks by priority
      local function prio_rank(p)
        return p.emoji and priority_order[p.emoji] or 5
      end

      local i = 1
      while i <= #lines do
        if parsed[i] then
          local start = i
          while i <= #lines and parsed[i] do i = i + 1 end
          local block = {}
          for j = start, i - 1 do
            table.insert(block, { idx = j, p = parsed[j] })
          end
          table.sort(block, function(a, b)
            local ka, kb = prio_rank(a.p), prio_rank(b.p)
            if ka ~= kb then return ka < kb end
            return a.idx < b.idx
          end)
          -- Assign sequential IDs and reconstruct lines
          for offset, entry in ipairs(block) do
            local p = entry.p
            local id_str = "`" .. string.format("%02d", offset) .. "`"
            local seg = p.emoji and (p.emoji .. " " .. p.rest) or p.rest
            seg = seg:gsub("%s+$", "")
            local new_line = p.indent .. "- [" .. p.status .. "] " .. id_str
            if seg ~= "" then new_line = new_line .. " " .. seg end
            if new_line ~= lines[entry.idx] then changed = true end
            lines[entry.idx] = new_line
          end
        else
          i = i + 1
        end
      end

      if changed then
        vim.api.nvim_buf_set_lines(0, 0, -1, false, lines)
      end
    end,
  })

  vim.api.nvim_create_user_command("Trouble", vim.diagnostic.setqflist, {})

  vim.api.nvim_create_user_command("SaveWithoutFormat", function()
    vim.b.skip_format_on_save = true
    vim.cmd("write")
  end, { desc = "Save the current buffer without running formatters" })
end

--- Ensure markdown tasks have sequential IDs.
--- Triggers save which runs BufWritePre for full format fix.
function M.fix_markdown_task_ids()
  vim.cmd("write")
end

return M
