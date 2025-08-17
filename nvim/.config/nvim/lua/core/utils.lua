local M = {}
local merge_tb = vim.tbl_deep_extend

M.load_mappings = function()
    vim.schedule(
        function()
            local function set_section_map(section_values)
                for mode, mode_values in pairs(section_values) do
                    local default_opts = merge_tb("force", {mode = mode}, {})
                    for keybind, mapping_info in pairs(mode_values) do
                        -- merge default + user opts
                        local opts = merge_tb("force", default_opts, mapping_info.opts or {})

                        mapping_info.opts, opts.mode = nil, nil
                        opts.desc = mapping_info[2]

                        vim.keymap.set(mode, keybind, mapping_info[1], opts)
                    end
                end
            end

            local mappings = require("core.mappings")

            for _, sect in pairs(mappings) do
                set_section_map(sect)
            end
        end
    )
end

M.select_tab = function()
    local tabs = vim.api.nvim_list_tabpages()
    local tab_names = {}

    for _, tab in ipairs(tabs) do
        local tabnr = vim.api.nvim_tabpage_get_number(tab)
        local tabname = "Tab " .. tabnr
        table.insert(tab_names, { tab = tab, name = tabname })
    end

    vim.ui.select(tab_names, {
        prompt = 'Select a tab:',
        format_item = function(item)
            return item.name
        end,
    }, function(choice)
        if choice then
            vim.api.nvim_set_current_tabpage(choice.tab)
        end
    end)
end

--- Prompt user to copy current buffer's absolute or relative path to clipboard.
--- Uses vim.ui.select for UI, copies result to system clipboard.
--- - Absolute: Full path to file.
--- - Relative: Path from current working directory.
function M.copy_buffer_path()
  local buf_path = vim.api.nvim_buf_get_name(0)
  if buf_path == "" then
    vim.notify("No file in current buffer.", vim.log.levels.WARN)
    return
  end

  local abs_path = buf_path
  local rel_path = vim.fn.fnamemodify(buf_path, ":~:.") -- relative to cwd and ~
  local choices = {
    { label = "Relative path (cwd)", value = rel_path },
    { label = "Absolute path", value = abs_path },
  }

  vim.ui.select(choices, {
    prompt = "Copy buffer path:",
    format_item = function(item) return item.label .. "\n" .. item.value end,
  }, function(choice)
    if choice and choice.value then
      vim.fn.setreg('+', choice.value)
      vim.notify("Copied to clipboard: " .. choice.value, vim.log.levels.INFO)
    end
  end)
end

return M
