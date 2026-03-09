return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
    config = function()
      local required_parsers = {
        "go",
        "yaml",
        "json",
        "html",
        "markdown",
        "markdown_inline",
        "bash",
        "fish",
        "lua",
        "gomod",
        "gosum",
        "dockerfile",
        "typescript",
        "javascript",
        "sql",
      }

      -- Check for missing parsers and install them
      local missing_parsers = {}
      for _, parser in ipairs(required_parsers) do
        local ok = pcall(vim.treesitter.language.inspect, parser)
        if not ok then
          table.insert(missing_parsers, parser)
        end
      end

      if #missing_parsers > 0 then
        require("nvim-treesitter").install(missing_parsers):wait(10000)
      end

      local function start_ts(buf)
        local ft = vim.bo[buf].filetype
        if ft == "" then
          return
        end

        local ok = pcall(vim.treesitter.language.inspect, ft)
        if ok then
          vim.treesitter.start()
        end
      end

      vim.api.nvim_create_autocmd("FileType", {
        group = vim.api.nvim_create_augroup("treesitter_setup", { clear = true }),
        callback = function(ev)
          start_ts(ev.buf)
        end,
      })

      -- Start treesitter for already loaded buffers
      for _, buf in ipairs(vim.api.nvim_list_bufs()) do
        if vim.api.nvim_buf_is_loaded(buf) then
          start_ts(buf)
        end
      end
    end,
  },
}
