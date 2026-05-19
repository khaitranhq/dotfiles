local M = {}

M.setup = function()
  local augroup = vim.api.nvim_create_augroup("RemoveCarriageReturn", { clear = true })

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

  vim.api.nvim_create_user_command("InstallTools", function()
    require("plugins.configs.lsp").install_servers()
    require("plugins.configs.none-ls").install_tools()
  end, {})
end

return M
