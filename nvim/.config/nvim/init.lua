require("core.general")

local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

-- bootstrap lazy.nvim!
if not vim.loop.fs_stat(lazypath) then
	vim.api.nvim_echo({ { "  Installing lazy.nvim & plugins ...", "Bold" } }, true, {})
	local repo = "https://github.com/folke/lazy.nvim.git"
	vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", repo, lazypath })
	vim.opt.rtp:prepend(lazypath)
end

vim.opt.rtp:prepend(lazypath)
require("lazy").setup({
	rocks = {
		hererocks = true, -- recommended if you do not have global installation of Lua 5.1.
	},
	spec = {
		{ import = "plugins" },
	},
})
require("core.utils").load_mappings()
