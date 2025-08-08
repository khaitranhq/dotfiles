function vim.window_picker_select()
    local window_id = require("window-picker").pick_window()
    if window_id == nil then
      print("No window selected")
      return
    end

    vim.api.nvim_set_current_win(window_id)
end

return {
    {
        "s1n7ax/nvim-window-picker",
        name = "window-picker",
        event = "VeryLazy",
        version = "2.*",
        config = function()
            require "window-picker".setup({hint = "floating-big-letter"})
        end
    }
}
