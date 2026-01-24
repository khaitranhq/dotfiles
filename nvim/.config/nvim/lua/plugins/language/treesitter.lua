return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
    config = function()
      vim.api.nvim_create_autocmd("FileType", {
        pattern = {
          "markdown",
          "lua",
          "go",
          "yaml",
          "python",
          "rust",
          "typescript",
          "gomod",
          "gosum",
          "toml",
          "rust",
          "csharp",
          "mermaid",
        },
        callback = function()
          vim.treesitter.start()
        end,
      })
    end,
  },
}
