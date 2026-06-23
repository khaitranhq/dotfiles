local M = {}

M.setup = function()
  local augroup = vim.api.nvim_create_augroup("CoreAutocommands", { clear = true })

  local priority_map = { p1 = "🔥", p2 = "⭐", p3 = "📋", p4 = "💤" }

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

      for i, line in ipairs(lines) do
        if not line:match("^%s*%- %[[ =]%]") then goto continue end -- luacheck: ignore

        for p, emoji in pairs(priority_map) do
          if line:match("%f[%w]" .. p .. "%f[^%w]") then
            local indent = line:match("^(%s*)")
            local status = line:match("%[(.)%]")
            local rest = line:gsub("^%s*%- %[[ =]%]%s*", "")
            rest = rest:gsub("%s*" .. p .. "%f[^%w]%s*", " ")
            rest = rest:gsub("%s+", " ")
            rest = rest:gsub("^%s*(.-)%s*$", "%1")
            lines[i] = (indent .. "- [" .. status .. "] " .. emoji .. " " .. rest):gsub("%s+$", "")
            changed = true
            break
          end
        end
        ::continue:: -- luacheck: ignore
      end

      -- Sort contiguous task blocks by priority
      local priority_order = { ["🔥"] = 1, ["⭐"] = 2, ["📋"] = 3, ["💤"] = 4 }

      local function priority_rank(line)
        for _, e in ipairs({ "🔥", "⭐", "📋", "💤" }) do
          if line:find(e, 1, true) then return priority_order[e] end
        end
        return 5
      end

      local i = 1
      while i <= #lines do
        if lines[i]:match("^%s*%- %[[ =x]%]") then
          local start = i
          while i <= #lines and lines[i]:match("^%s*%- %[[ =x]%]") do i = i + 1 end
          local block = {}
          for j = start, i - 1 do
            table.insert(block, { text = lines[j], idx = j })
          end
          table.sort(block, function(a, b)
            local ka, kb = priority_rank(a.text), priority_rank(b.text)
            if ka ~= kb then return ka < kb end
            return a.idx < b.idx
          end)
          for j = start, i - 1 do
            local prev = lines[j]
            lines[j] = block[j - start + 1].text
            if lines[j] ~= prev then changed = true end
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

return M
