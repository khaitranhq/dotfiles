return {
  {
    "github/copilot.vim",
    config = function()
      vim.g.copilot_no_tab_map = true
    end,
  },
  {
    "NickvanDyke/opencode.nvim",
    dependencies = {
      { "folke/snacks.nvim", opts = { input = {}, picker = {}, terminal = {} } },
    },
    config = function()
      -- Required for `opts.events.reload`.
      vim.o.autoread = true
    end,
  },
}
