require("core.general")

local lazypath = vim.fn.stdpath "data" .. "/lazy/lazy.nvim"

local function get_file_name(file_path)
    -- Use Lua's string.match function with a pattern to extract the filename stem
    local filename_stem = file_path:match(".+/([^/]+)%.lua$") -- Pattern to capture the filename stem before '.lua'
    return filename_stem
end

local function load_plugins_from_folder(folder_path)
    local plugins = {}

    -- Iterate over files in the specified folder
    ---@diagnostic disable-next-line: param-type-mismatch
    local files = vim.fn.globpath(folder_path, "*.lua", 0, 1)

    ---@diagnostic disable-next-line: param-type-mismatch
    for _, file in ipairs(files) do
        local file_name = get_file_name(file)
        -- Load each Lua file as a module
        local file_plugins = require("config." .. file_name)

        for _, plugin in ipairs(file_plugins) do
            table.insert(plugins, plugin)
        end
    end

    return plugins
end

-- bootstrap lazy.nvim!
if not vim.loop.fs_stat(lazypath) then
    vim.api.nvim_echo({{"  Installing lazy.nvim & plugins ...", "Bold"}}, true, {})
    local repo = "https://github.com/folke/lazy.nvim.git"
    vim.fn.system({"git", "clone", "--filter=blob:none", "--branch=stable", repo, lazypath})
    vim.opt.rtp:prepend(lazypath)
end

vim.opt.rtp:prepend(lazypath)
local config_path = vim.fn.stdpath("config") .. "/lua/config"
local plugins = load_plugins_from_folder(config_path)
require("lazy").setup(plugins)
require("core.utils").load_mappings()
