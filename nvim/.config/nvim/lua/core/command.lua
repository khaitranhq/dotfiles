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

  local resize_group = vim.api.nvim_create_augroup("FocusResize", { clear = true })

  vim.api.nvim_create_autocmd("WinEnter", {
    group = resize_group,
    callback = function()
      -- 1. Ignore floating windows
      if vim.api.nvim_win_get_config(0).relative ~= "" then
        -- If entering a floating window, keep layouts balanced below it
        vim.cmd("wincmd =")
        return
      end

      -- 2. Ignore specific sidebar filetypes
      local exclude_ft = { "NvimTree", "neo-tree", "undotree", "Outline", "toggleterm", "qf" }
      if vim.tbl_contains(exclude_ft, vim.bo.filetype) then
        return
      end

      -- 3. Check screen capacity vs window layout
      local current_win = vim.api.nvim_get_current_win()

      -- Calculate total screen lines/columns minus UI chrome (statuslines, cmdheight)
      local screen_height = vim.o.lines - vim.o.cmdheight - 2
      local screen_width = vim.o.columns

      local win_height = vim.api.nvim_win_get_height(current_win)
      local win_width = vim.api.nvim_win_get_width(current_win)

      -- 4. Apply resizing rules ONLY where splits structurally exist
      -- Only resize width if windows are side-by-side (width is less than full screen)
      if win_width < screen_width then
        vim.cmd("vertical resize 80")
      end

      -- Only resize height if windows are stacked top-and-bottom (height is less than full screen)
      if win_height < screen_height then
        vim.cmd("resize 35")
      end
    end,
  })
end


return M
