return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
    config = function()
      vim.api.nvim_create_autocmd("BufReadPost", {
        pattern = "*",
        callback = function()
          vim.treesitter.start()
        end,
      })
    end,
  },
}
