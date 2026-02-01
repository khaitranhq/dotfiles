return {
  {
    "sindrets/diffview.nvim",
  },
  { "lewis6991/gitsigns.nvim" },
  {
    "NeogitOrg/neogit",
    lazy = true,
    dependencies = {
      "nvim-lua/plenary.nvim",
      "sindrets/diffview.nvim",

      "folke/snacks.nvim",
    },
    cmd = "Neogit",
  },
}
