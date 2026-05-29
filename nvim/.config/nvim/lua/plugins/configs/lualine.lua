local M = {}

M.setup = function()
  local custom_fname = require("lualine.components.filename"):extend()
  local highlight = require("lualine.highlight")
  local default_status_colors = { saved = "#9ece6a", modified = "#e0af68" }
  local fg = "#3b4261"

  function custom_fname:init(options)
    custom_fname.super.init(self, options)
    self.options.path = 1 -- Show relative path from cwd
    self.status_colors = {
      saved = highlight.create_component_highlight_group(
        { bg = default_status_colors.saved, fg = fg },
        "filename_status_saved",
        self.options
      ),
      modified = highlight.create_component_highlight_group(
        { bg = default_status_colors.modified, fg = fg },
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

  require("lualine").setup({
    options = {
      theme = "everforest",
    },
    sections = {
      lualine_a = {},
      lualine_b = { "diagnostics" },
      lualine_c = { custom_fname },
    },
  })
end

return M
