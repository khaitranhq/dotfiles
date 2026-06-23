local M = {}

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

M.setup = function()
  local hl_groups = {}
  for i, c in ipairs(PALETTE) do
    local name = "MarkdownTag" .. i
    vim.api.nvim_set_hl(0, name, { fg = c.fg, bg = c.bg, bold = true })
    hl_groups[i] = name
  end

  local ns = vim.api.nvim_create_namespace("markdown_tags")
  local grp = vim.api.nvim_create_augroup("MarkdownTags", { clear = true })

  local function refresh(buf)
    vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
    local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
    for line_i, line in ipairs(lines) do
      local pos = 1
      while pos <= #line do
        local s, e = line:find("#[%w_%-]+", pos)
        if not s then break end
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
    group = grp,
    pattern = "markdown",
    callback = function(args)
      refresh(args.buf)
    end,
  })
  vim.api.nvim_create_autocmd({ "TextChanged", "TextChangedI" }, {
    group = grp,
    callback = function()
      local buf = vim.api.nvim_get_current_buf()
      if vim.bo[buf].filetype == "markdown" then
        refresh(buf)
      end
    end,
  })
end

return M
