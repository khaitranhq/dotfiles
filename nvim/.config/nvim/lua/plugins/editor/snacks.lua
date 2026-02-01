return {
  {
    "folke/snacks.nvim",
    priority = 1000,
    lazy = false,
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    opts = {
      indent = {},
      input = {},
      lazygit = {},
      picker = {
        matcher = {
          frecency = true,
        },
        sources = (function()
          local common_exclude = {
            ".git",
            ".serena",
            "node_modules",
            "dist",
            ".venv",
            "venv",
            ".mypy_cache",
            ".aider*",
            "cdk.out",
            ".vagrant",
            "build",
            "**/chat_histories",
            ".agentcrew/pr-diff",
            "**/*.diff",
            ".ruff_cache",
          }

          -- Common configuration shared between files and grep
          local common_picker_config = {
            ignored = true,
            hidden = true,
            exclude = common_exclude,
            args = { "--ignore-file=.rgignore", "--follow" },
          }

          return {
            gh = {},
            files = vim.tbl_extend("force", common_picker_config, {
              cmd = "rg",
            }),
            grep = vim.tbl_extend("force", common_picker_config, {}),
            explorer = {
              hidden = true,
              ignored = true,
              auto_close = true,
              win = {
                list = {
                  keys = { ["Y"] = "copy_path", ["o"] = "confirm" },
                  wo = { number = true, relativenumber = true },
                },
              },
              layout = {
                cycle = true,
                preview = true, ---@diagnostic disable-line: assign-type-mismatch
                layout = {
                  box = "horizontal",
                  position = "float",
                  height = 0.95,
                  width = 0,
                  border = "rounded",
                  {
                    box = "vertical",
                    width = 40,
                    min_width = 40,
                    {
                      win = "input",
                      height = 1,
                      title = "{title} {live} {flags}",
                      border = "single",
                    },
                    { win = "list" },
                  },
                  { win = "preview", width = 0, border = "left" },
                },
              },
              actions = {
                copy_path = function(_, item)
                  local modify = vim.fn.fnamemodify
                  local filepath = item.file
                  local filename = modify(filepath, ":t")
                  local is_file = vim.fn.isdirectory(filepath) == 0

                  local values = {
                    modify(filepath, ":."),
                    filepath,
                    filename,
                    is_file and modify(filename, ":r") or nil,
                    is_file and modify(filename, ":e") or nil,
                  }

                  local items = {
                    "Path relative to CWD: " .. values[1],
                    "Absolute path: " .. values[2],
                    "Filename: " .. values[3],
                  }

                  if is_file then
                    table.insert(items, "Filename without extension: " .. values[4])
                    table.insert(items, "Extension of the filename: " .. values[5])
                  end

                  vim.ui.select(
                    items,
                    { prompt = "Choose to copy to clipboard:" },
                    function(choice, i)
                      if not choice or not i then
                        vim.notify(choice and "Invalid selection" or "Selection cancelled")
                        return
                      end
                      local result = values[i]
                      vim.fn.setreg('"', result)
                      vim.fn.setreg("+", result)
                      vim.notify("Copied: " .. result)
                    end
                  )
                end,
              },
            },
          }
        end)(),
      },
    },
  },
}
