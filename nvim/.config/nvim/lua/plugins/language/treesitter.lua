return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
    config = function()
      local function start_ts(buf)
        local ft = vim.bo[buf].filetype
        if ft == "" then
          return
        end

        local ok, parsers = pcall(require, "nvim-treesitter.parsers")
        if ok and parsers.has_parser(ft) then
          pcall(vim.treesitter.start, buf, ft)
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
