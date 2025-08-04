local opt = vim.opt

------------------------options------------------------
-- tab indent
opt.tabstop = 2
opt.shiftwidth = 2
opt.expandtab = true

-- conceal level
opt.conceallevel = 2

-- show relative line number
opt.number = true
opt.relativenumber = true

-- Set clipboard
opt.clipboard = "unnamed,unnamedplus"

-- set termguicolors to enable highlight groups
opt.termguicolors = true

-- set foldmethod
opt.foldmethod = "expr"
opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
opt.foldtext = ""
opt.foldlevel = 99

-- set undodir
UNDODIR = os.getenv("HOME") .. "/.local/share/nvim/undo/"
if vim.fn.isdirectory(UNDODIR) == 0 then
	vim.fn.mkdir(UNDODIR, "p", "0o700")
end
opt.undodir = UNDODIR
opt.undofile = true

-- Performance optimizations
opt.swapfile = false -- Disable swap files since we have persistent undo
opt.backup = false -- Disable backup files
opt.writebackup = false -- Disable backup before overwriting
opt.updatetime = 250 -- Faster completion and diagnostics
opt.timeoutlen = 500 -- Faster which-key popup

-- set spell check (filetype-specific)
opt.spelllang = "en_us"
-- Enable spell check only for specific filetypes
vim.api.nvim_create_autocmd("FileType", {
	pattern = { "markdown", "text", "gitcommit", "tex" },
	callback = function()
		vim.opt_local.spell = true
	end,
})

-------------------------global-------------------------
vim.g.mapleader = " "

vim.o.autoread = true
vim.api.nvim_create_autocmd({ "BufEnter", "CursorHold", "CursorHoldI", "FocusGained" }, {
	command = "if mode() != 'c' | checktime | endif",
	pattern = { "*" },
})
