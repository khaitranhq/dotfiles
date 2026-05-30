-- Treesitter auto-enable: start highlighting on buffers where a parser is available.
-- Parsers are managed manually (no nvim-treesitter plugin).

local M = {}

--- Check if a treesitter language is available for the given filetype.
--- Falls back to the base filetype (e.g. "yaml" from "yaml.docker-compose").
--- @param ft string
--- @return string|nil lang
local function get_lang(ft)
  if not ft or ft == "" then
    return nil
  end
  -- Exact match
  if vim.treesitter.language.get_lang(ft) then
    return ft
  end
  -- Try base filetype (strip dotted suffix)
  local base = vim.split(ft, "%.")[1]
  if base ~= ft and vim.treesitter.language.get_lang(base) then
    return base
  end
  return nil
end

M.setup = function()
  vim.api.nvim_create_autocmd("FileType", {
    desc = "Auto-start treesitter highlighting when parser is available",
    callback = function(args)
      local buf = args.buf
      -- Skip non-file buffers (quickfix, picker previews, etc.)
      if vim.bo[buf].buftype ~= "" then
        return
      end
      local lang = get_lang(vim.bo[buf].filetype)
      if lang then
        -- pcall guards against stale language registrations without parser binaries
        pcall(vim.treesitter.start, buf, lang)
      end
    end,
  })
end

return M
