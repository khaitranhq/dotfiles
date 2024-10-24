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

return M
