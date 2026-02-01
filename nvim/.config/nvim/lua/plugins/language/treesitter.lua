return {
  {
    "nvim-treesitter/nvim-treesitter",
    lazy = false,
    build = ":TSUpdate",
    config = function()
      vim.api.nvim_create_autocmd("BufReadPost", {
        pattern = "*",
        callback = function(ev)
          -- get filetype for the buffer that triggered the event
          -- use the Lua option accessor for a specific buffer (preferred over the API wrapper)
          local ft = vim.bo[ev.buf].filetype
          if not ft or ft == "" then
            return
          end

          -- require parsers module safely
          local ok, parsers = pcall(require, "nvim-treesitter.parsers")
          if not ok or type(parsers.has_parser) ~= "function" then
            return
          end

          -- only start treesitter if a parser for this filetype is installed
          if not parsers.has_parser(ft) then
            return
          end

          pcall(vim.treesitter.start, ev.buf, ft)
        end,
      })
    end,
  },
}
