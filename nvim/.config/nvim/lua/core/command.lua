local M = {}

M.setup = function()
  local augroup = vim.api.nvim_create_augroup("CoreAutocommands", { clear = true })

  vim.api.nvim_create_autocmd("BufWritePre", {
    group = augroup,
    pattern = "*",
    callback = function()
      if vim.fn.search("\r", "nw") ~= 0 then
        vim.cmd("%s/\\r//ge")
      end
    end,
  })

  vim.api.nvim_create_user_command("Trouble", vim.diagnostic.setqflist, {})

  vim.api.nvim_create_user_command("SaveWithoutFormat", function()
    vim.b.skip_format_on_save = true
    vim.cmd("write")
  end, { desc = "Save the current buffer without running formatters" })
end


return M
