local M = {}

M.setup = function()
  vim.pack.add({
    "https://github.com/nvim-tree/nvim-web-devicons",
    "https://github.com/folke/snacks.nvim",
    "https://github.com/nvimtools/none-ls.nvim",
    "https://github.com/nvimtools/none-ls-extras.nvim",
    -- TODO: remove this plugin in the future
    -- Ref:
    -- - https://github.com/nvim-lua/plenary.nvim#:~:text=This%20repository%20is%20no%20longer%20actively%20maintained%20and%20will%20be%20officially%20archived%20soon.
    -- - https://github.com/nvimtools/none-ls.nvim/issues/336
    "https://github.com/nvim-lua/plenary.nvim",
    "https://github.com/folke/tokyonight.nvim",
    "https://github.com/neovim/nvim-lspconfig",
    "https://github.com/lewis6991/gitsigns.nvim",
    "https://github.com/saghen/blink.cmp",
    "https://github.com/tpope/vim-repeat",
    "https://codeberg.org/andyg/leap.nvim",
    "https://github.com/github/copilot.vim",
    "https://github.com/windwp/nvim-autopairs",
    "https://github.com/nvim-lualine/lualine.nvim",
    "https://github.com/kylechui/nvim-surround",
    "https://github.com/folke/todo-comments.nvim",
    "https://github.com/rachartier/tiny-inline-diagnostic.nvim",
    "https://github.com/chrisgrieser/nvim-early-retirement.git",
    "https://github.com/khaitranhq/tree-sitter-manager.nvim",
    "https://github.com/khaitranhq/render-markdown.nvim",
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
end

return M
