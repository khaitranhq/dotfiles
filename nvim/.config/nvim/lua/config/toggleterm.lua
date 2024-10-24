function _G.set_terminal_keymaps()
	local opts = { buffer = 0 }
	vim.keymap.set("t", "<C-n>", [[<C-\><C-n>]], opts)
	vim.keymap.set("t", "<C-h>", [[<Cmd>wincmd h<CR>]], opts)
	vim.keymap.set("t", "<C-j>", [[<Cmd>wincmd j<CR>]], opts)
	vim.keymap.set("t", "<C-k>", [[<Cmd>wincmd k<CR>]], opts)
	vim.keymap.set("t", "<C-l>", [[<Cmd>wincmd l<CR>]], opts)
end

-- if you only want these mappings for toggle term use term://*toggleterm#* instead
vim.cmd("autocmd! TermOpen term://* lua set_terminal_keymaps()")

function vim.opencommit()
	local Terminal = require("toggleterm.terminal").Terminal
	local opencommit = Terminal:new({ cmd = "oco --yes", hidden = true, direction = "float" })
	opencommit:toggle()
end

return {
	{
		"akinsho/toggleterm.nvim",
		version = "*",
		config = function()
			require("toggleterm").setup({
				open_mapping = [[<c-\>]],
				size = 10,
				direction = "horizontal",
				float_opts = {
					-- The border key is *almost* the same as 'nvim_open_win'
					-- see :h nvim_open_win for details on borders however
					-- the 'curved' border is a custom border type
					-- not natively supported but implemented in this plugin.
					border = "curved",
					-- like `size`, width and height can be a number or function which is passed the current terminal
					winblend = 0,
				},
			})
		end,
	},
}
