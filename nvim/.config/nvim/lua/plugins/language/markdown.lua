return {
  {
    "MeanderingProgrammer/render-markdown.nvim",
    opts = {
      checkbox = {
        unchecked = { icon = "" },
        checked = { icon = "", scope_highlight = "@markup.strikethrough" },
        bullet = true,
        custom = {
          doing = {
            raw = "[=]",
            rendered = "󰑮",
            highlight = "RenderMarkdownDoing",
          },
          pending = {
            raw = "[~]",
            rendered = "󰥔 ",
            highlight = "RenderMarkdownPending",
          },
          blocked = {
            raw = "[!]",
            rendered = " ",
            highlight = "RenderMarkdownBlocked",
          },
        },
      },
    },
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
  },
  {
    "iamcco/markdown-preview.nvim",
    cmd = { "MarkdownPreviewToggle", "MarkdownPreview", "MarkdownPreviewStop" },
    build = "cd app && yarn install",
    init = function()
      vim.g.mkdp_filetypes = { "markdown" }
      vim.g.mkdp_theme = "dark"
    end,
    ft = { "markdown" },
  },
  {
    "HakonHarnes/img-clip.nvim",
    event = "VeryLazy",
    opts = {},
  },
}
