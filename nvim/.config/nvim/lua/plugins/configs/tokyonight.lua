local M = {}

M.setup = function()
	vim.cmd([[colorscheme tokyonight-night]])

	-- Customize trailing whitespace highlighting
	vim.api.nvim_set_hl(0, "Whitespace", {
		fg = "#f7768e", -- Bright red/pink - very noticeable
	})
end

return M
