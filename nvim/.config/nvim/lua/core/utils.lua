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

return M
