local keymaps = {}

keymaps.general = {
  n = {
    -- Window navigation - vim-like directional movement
    ["<C-h>"] = { "<C-w>h", "Window left" },
    ["<C-l>"] = { "<C-w>l", "Window right" },
    ["<C-j>"] = { "<C-w>j", "Window down" },
    ["<C-k>"] = { "<C-w>k", "Window up" },

    -- Quick actions
    ["qq"] = {
      function()
        vim.cmd("qa")
      end,
      "Quit Neovim",
    },
    [";"] = { ":", "Enter command mode" },
    ["<leader>/"] = { "<cmd>nohlsearch<CR>", "Clear search highlights" },

    -- Copy buffer path (absolute/relative) to clipboard
    ["<leader>cp"] = {
      function()
        local utils_ok, utils = pcall(require, "core.utils")
        if utils_ok and utils.copy_buffer_path then
          utils.copy_buffer_path()
        else
          vim.notify("Path copier not available", vim.log.levels.WARN)
        end
      end,
      "Copy buffer path (absolute/relative) to clipboard",
    },
  },
}

keymaps.notify = {
  n = {
    ["<leader>zh"] = {
      function()
        require("snacks").notifier.hide()
      end,
      "Dismiss all notifications",
    },
  },
}

keymaps.file_explorer = {
  n = {
    ["<leader>b"] = {
      function()
        require("snacks").explorer()
      end,
      "Toggle file explorer",
    },
  },
}

keymaps.search = {
  n = {
    ["<leader>ff"] = {
      function()
        require("snacks").picker.files({
          hidden = true,
        })
      end,
      "Find files",
    },
    ["<leader>fg"] = {
      function()
        require("snacks").picker.grep({
          hidden = true,
        })
      end,
      "Find files",
    },
  },
}

keymaps.git = {
  n = {
    ["<leader>gs"] = {
      function()
        require("snacks").lazygit({ cwd = vim.fn.expand("%:p:h") })
      end,
      "Open Lazygit",
    },
    ["<leader>gho"] = {
      require("gitsigns").preview_hunk,
      "Preview hunk",
    },
    ["<leader>ghx"] = {
      require("gitsigns").reset_hunk,
      "Reset hunk",
    },
    ["<leader>ghs"] = {
      require("gitsigns").stage_hunk,
      "Stage hunk",
    },
    ["<leader>ghp"] = {
      function()
        require("gitsigns").nav_hunk("prev")
      end,
      "Previous hunk",
    },
    ["<leader>ghn"] = {
      function()
        require("gitsigns").nav_hunk("next")
      end,
      "Next hunk",
    },
    ["<leader>co"] = {
      function()
        require("core.git").resolve_ours()
      end,
      "Resolve conflict: ours",
    },
    ["<leader>ct"] = {
      function()
        require("core.git").resolve_theirs()
      end,
      "Resolve conflict: theirs",
    },
    ["<leader>cb"] = {
      function()
        require("core.git").resolve_both()
      end,
      "Resolve conflict: both",
    },
    ["]x"] = {
      function()
        require("core.git").next_conflict()
      end,
      "Next conflict",
    },
    ["[x"] = {
      function()
        require("core.git").prev_conflict()
      end,
      "Previous conflict",
    },
  },
}

keymaps.lsp = {
  n = {
    -- Diagnostics navigation
    ["gep"] = {
      function()
        vim.diagnostic.jump({ count = -1, float = true })
      end,
      "Previous diagnostic",
    },
    ["gen"] = {
      function()
        vim.diagnostic.jump({ count = 1, float = true })
      end,
      "Next diagnostic",
    },
    ["gef"] = {
      function()
        vim.diagnostic.open_float()
      end,
      "Show diagnostics in floating window",
    },
    ["gd"] = {
      function()
        vim.lsp.buf.definition()
      end,
      "Go to definition",
    },
    ["gD"] = {
      function()
        vim.cmd('rightbelow vsplit')
        vim.lsp.buf.definition()
      end,
      "Go to definition",
    },
  },
}

keymaps.navigate = {
  n = {
    ["s"] = { "<Plug>(leap)", "Leap navigation" },
    ["<leader>s"] = {
      function()
        require("core.utils").select_buffer()
      end,
      "Interactive buffer picker",
    },
  },
}

keymaps.markdown = {
  n = {
    ["<leader>mi"] = {
      function()
        require("core.markdown").fix_markdown_task_ids()
      end,
      "Fix markdown task IDs",
    },
  },
}

keymaps.ai = {
  i = {
    ["<C-o>"] = {
      function()
        require("copilot.suggestion").accept()
      end,
      opts = {
        expr = true,
        replace_keycodes = false,
      },
    },
  },
}

local M = {}

M.setup = function()
  vim.schedule(function()
    for _, sect in pairs(keymaps) do
      for mode, mode_values in pairs(sect) do
        local default_opts = vim.tbl_deep_extend("force", { mode = mode }, {})
        for keybind, mapping_info in pairs(mode_values) do
          -- merge default + user opts
          local opts = vim.tbl_deep_extend("force", default_opts, mapping_info.opts or {})

          mapping_info.opts, opts.mode = nil, nil
          opts.desc = mapping_info[2]

          vim.keymap.set(mode, keybind, mapping_info[1], opts)
        end
      end
    end
  end)
end

return M
