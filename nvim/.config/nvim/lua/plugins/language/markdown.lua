return {
  {
    "MeanderingProgrammer/render-markdown.nvim",
    ft = "markdown",
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
    -- set highlight colors for the custom checkbox icons
    config = function(_, opts)
      -- warm yellow for "doing"
      vim.api.nvim_set_hl(0, "RenderMarkdownDoing", { fg = "#f6c177", bg = "NONE" })
      -- pale blue for "pending"
      vim.api.nvim_set_hl(0, "RenderMarkdownPending", { fg = "#7cc7ff", bg = "NONE" })
      -- soft red for "blocked"
      vim.api.nvim_set_hl(0, "RenderMarkdownBlocked", { fg = "#ff6b6b", bg = "NONE", bold = true })

      require("render-markdown").setup(opts)
    end,
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
  },
  {
    "HakonHarnes/img-clip.nvim",
    event = "VeryLazy",
    opts = {},
  },
}
