local M = {}

M.setup = function()
  local custom_fname = require("lualine.components.filename"):extend()
  local highlight = require("lualine.highlight")

  -- oxocarbon dark palette
  local c = {
    bg       = "#161616", -- base00
    bg_alt   = "#2a2a2a", -- base01
    bg_hi    = "#404040", -- base02
    fg_muted = "#5c5c5c", -- base03
    fg       = "#d5d5d5", -- base04
    cyan     = "#08bdba", -- base07
    blue     = "#78a9ff", -- base09
    magenta  = "#ee5396", -- base10
    light_blue = "#33b1ff", -- base11
    pink     = "#ff7eb6", -- base12
    green    = "#42be65", -- base13
    purple   = "#be95ff", -- base14
  }

  local status_colors = {
    saved    = { bg = c.green,  fg = c.bg },
    modified = { bg = c.purple, fg = c.bg },
  }

  function custom_fname:init(options)
    custom_fname.super.init(self, options)
    self.options.path = 1 -- Show relative path from cwd
    self.status_colors = {
      saved = highlight.create_component_highlight_group(
        status_colors.saved,
        "filename_status_saved",
        self.options
      ),
      modified = highlight.create_component_highlight_group(
        status_colors.modified,
        "filename_status_modified",
        self.options
      ),
    }
    if self.options.color == nil then
      self.options.color = ""
    end
  end

  function custom_fname:update_status()
    local data = custom_fname.super.update_status(self)
    data = highlight.component_format_highlight(
      vim.bo.modified and self.status_colors.modified or self.status_colors.saved
    ) .. data
    return data
  end

  local oxocarbon = {
    normal = {
      a = { fg = c.bg,   bg = c.blue },
      b = { fg = c.fg,   bg = c.bg_hi },
      c = { fg = c.fg,   bg = c.bg_alt },
    },
    insert = {
      a = { fg = c.bg,   bg = c.green },
      b = { fg = c.fg,   bg = c.bg_hi },
      c = { fg = c.fg,   bg = c.bg_alt },
    },
    visual = {
      a = { fg = c.bg,   bg = c.purple },
      b = { fg = c.fg,   bg = c.bg_hi },
      c = { fg = c.fg,   bg = c.bg_alt },
    },
    replace = {
      a = { fg = c.bg,   bg = c.magenta },
      b = { fg = c.fg,   bg = c.bg_hi },
      c = { fg = c.fg,   bg = c.bg_alt },
    },
    command = {
      a = { fg = c.bg,   bg = c.cyan },
      b = { fg = c.fg,   bg = c.bg_hi },
      c = { fg = c.fg,   bg = c.bg_alt },
    },
    inactive = {
      a = { fg = c.fg_muted, bg = c.bg_alt },
      b = { fg = c.fg_muted, bg = c.bg_alt },
      c = { fg = c.fg_muted, bg = c.bg },
    },
  }

  require("lualine").setup({
    options = {
      theme = oxocarbon,
    },
    sections = {
      lualine_a = {},
      lualine_b = { "diagnostics" },
      lualine_c = { custom_fname },
    },
  })
end

return M
