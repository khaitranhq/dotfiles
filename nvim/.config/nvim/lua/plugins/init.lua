local M = {}

local function setup_theme()
  require("everforest").setup({
    background = "soft",
  })
  vim.cmd("colorscheme everforest")

  -- Customize trailing whitespace highlighting
  vim.api.nvim_set_hl(0, "Whitespace", {
    fg = "#f7768e", -- Bright red/pink - very noticeable
  })
end

M.setup = function()
  vim.pack.add({
    "https://github.com/khaitranhq/nvim-web-devicons",
    "https://github.com/khaitranhq/snacks.nvim",
    "https://github.com/neanias/everforest-nvim",
    "https://github.com/neovim/nvim-lspconfig",
    "https://github.com/khaitranhq/gitsigns.nvim",
    "https://github.com/khaitranhq/blink.cmp",
    "https://codeberg.org/khaitranhq/leap.nvim",
    "https://github.com/khaitranhq/nvim-autopairs",
    "https://github.com/khaitranhq/lualine.nvim",
    "https://github.com/khaitranhq/nvim-surround",
    "https://github.com/khaitranhq/todo-comments.nvim",
    "https://github.com/khaitranhq/nvim-early-retirement",
    "https://github.com/khaitranhq/render-markdown.nvim",
    "https://github.com/khaitranhq/codediff.nvim",
    "https://github.com/khaitranhq/copilot.lua",
    "https://github.com/folke/lazydev.nvim.git",
    "https://github.com/khaitranhq/markview.nvim.git",
  })

  -- Load all setup() functions from plugins/configs folder
  local config_dir = vim.fn.stdpath("config") .. "/lua/plugins/configs"
  local configs = vim.fn.glob(config_dir .. "/*.lua", false, true)

  for _, config_file in ipairs(configs) do
    local module_name = vim.fn.fnamemodify(config_file, ":t:r")
    local ok, config = pcall(require, "plugins.configs." .. module_name)

    if ok and config and type(config.setup) == "function" then
      config.setup()
    elseif not ok then
      vim.notify("Failed to load config: " .. module_name, vim.log.levels.WARN)
    end
  end

  require("nvim-autopairs").setup({})
  require("early-retirement").setup({
    retirementAgeMins = 5
  })
  require("codediff").setup({
    explorer = {
      view_mode = "tree",
    },
  })
  require("copilot").setup({
    suggestion = {
      auto_trigger = true,
    },
    filetypes = {
      yaml = true,
      markdown = true,
    },
  })
  require("render-markdown").setup({
    checkbox = {
      unchecked = { icon = "" },
      checked = { icon = "", scope_highlight = "@markup.strikethrough" },
      custom = {
        doing = { raw = "[=]", rendered = "▶" },
      },
    },
  })
  require("todo-comments").setup({})

  setup_theme()
end

return M
