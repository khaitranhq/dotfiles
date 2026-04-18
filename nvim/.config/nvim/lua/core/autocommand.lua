local M = {}

M.setup = function()
  local augroup = vim.api.nvim_create_augroup("RemoveCarriageReturn", { clear = true })

  vim.api.nvim_create_autocmd("BufWritePre", {
    group = augroup,
    pattern = "*",
    callback = function()
      -- Remove ^M (carriage return) characters before saving
      vim.cmd("%s/\\r//ge")
    end,
  })
end

return M
