require("core.options")

-- bootstrap lazy.nvim!
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
	local lazyrepo = "https://github.com/folke/lazy.nvim.git"
	local out = vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
	if vim.v.shell_error ~= 0 then
		vim.api.nvim_echo({
			{ "Failed to clone lazy.nvim:\n", "ErrorMsg" },
			{ out, "WarningMsg" },
			{ "\nPress any key to exit..." },
		}, true, {})
		vim.fn.getchar()
		os.exit(1)
	end
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
	rocks = {
		hererocks = true, -- recommended if you do not have global installation of Lua 5.1.
	},
	spec = {
		{ import = "plugins.language" },
		{ import = "plugins.editor" },
		{ import = "plugins.ui" },
		{ import = "plugins.navigation" },
		{ import = "plugins.tools" },
	},
	change_detection = {
		-- automatically check for config file changes and reload the ui
		enabled = false,
		notify = false, -- get a notification when changes are found
	},
})
require("core.utils").load_mappings()
require("modules.dressing.init").setup()

-- Setup extra enhancements (nui UI, etc.)
vim.schedule(function()
	local ok, extra = pcall(require, "extra")
	if ok then
		extra.setup()
	else
		vim.notify("Failed to load extra enhancements", vim.log.levels.WARN)
	end
end)
