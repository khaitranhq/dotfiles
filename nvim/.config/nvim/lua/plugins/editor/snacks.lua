return {
  {
    "folke/snacks.nvim",
    priority = 1000,
    lazy = false,
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    opts = {
      styles = {
        terminal = {
          keys = {
            term_normal = false,
          },
        },
      },
      indent = {},
      input = {},
      lazygit = {},
      notifier = {},
      statuscolumn = {
        folds = {
          open = true, -- show open fold icons
          git_hl = true, -- use Git Signs hl for fold icons
        },
      },
      picker = {
        matcher = {
          frecency = true,
        },
        sources = {
          gh = {},
          files = {
            cmd = "rg",
          },
          grep = {
            cmd = "rg",
            args = { "-g", "!**/*.diff" },
          },
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

                vim.ui.select(items, { prompt = "Choose to copy to clipboard:" }, function(choice, i)
                  if not choice or not i then
                    vim.notify(choice and "Invalid selection" or "Selection cancelled")
                    return
                  end
                  local result = values[i]
                  vim.fn.setreg('"', result)
                  vim.fn.setreg("+", result)
                  vim.notify("Copied: " .. result)
                end)
              end,
            },
          },
        },
      },
    },
    config = function(_, opts)
      require("snacks").setup(opts)

      vim.schedule(function()
        -- Copy from https://github.com/folke/snacks.nvim/blob/bc0630e43be5699bb94dadc302c0d21615421d93/lua/snacks/util/init.lua#L139-L141
        Snacks.util.icon = function(name, cat, opts)
          opts = opts or {}
          opts.fallback = opts.fallback or {}
          local try = {
            function()
              return MiniIcons.get(cat or "file", name)
            end,
            function()
              if cat == "directory" then
                return opts.fallback.dir or "󰉋 ", "Directory"
              end
              local Icons = require("nvim-web-devicons")
              if cat == "filetype" then
                return Icons.get_icon_by_filetype(name, { default = false })
              elseif cat == "file" then
                local basename = vim.fn.fnamemodify(name, ":t")
                local ext = basename:match("%w%.(%w+)$") -- NOTE: regex was changed
                return Icons.get_icon(basename, ext, { default = false })
                -- elseif cat == "file" then
                --   local ext = name:match("%.(%w+)$")
                --   return Icons.get_icon(name, ext, { default = false }) --[[@as string, string]]
              elseif cat == "extension" then
                return Icons.get_icon(nil, name, { default = false }) --[[@as string, string]]
              end
            end,
          }
          for _, fn in ipairs(try) do
            local ret = { pcall(fn) }
            if ret[1] and ret[2] then
              return ret[2], ret[3]
            end
          end
          return opts.fallback.file or "󰈔 "
        end
      end)
    end,
  },
}
