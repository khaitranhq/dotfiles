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

function OpenCommitToggle()
	local Terminal = require("toggleterm.terminal").Terminal
	local opencommit = Terminal:new({
		cmd = "oco --yes",
		hidden = true,
		direction = "float",
		on_close = function(_)
			require("neogit").dispatch_refresh()
			print("Generate commit completed")
		end,
	})
	opencommit:toggle()
end

local function getRelativeFilepath(retries, delay)
	local relative_filepath
	for _ = 1, retries do
		relative_filepath = vim.fn.getreg("+")
		if relative_filepath ~= "" then
			return relative_filepath -- Return filepath if clipboard is not empty
		end
		vim.loop.sleep(delay) -- Wait before retrying
	end
	return nil -- Return nil if clipboard is still empty after retries
end

-- Function to handle editing from Lazygit
function LazygitEdit(original_buffer)
	local current_bufnr = vim.fn.bufnr("%")
	local channel_id = vim.fn.getbufvar(current_bufnr, "terminal_job_id")

	if not channel_id then
		vim.notify("No terminal job ID found.", vim.log.levels.ERROR)
		return
	end

	vim.fn.chansend(channel_id, "\15") -- \15 is <c-o>
	vim.cmd("close") -- Close Lazygit

	local relative_filepath = getRelativeFilepath(5, 50)
	if not relative_filepath then
		vim.notify("Clipboard is empty or invalid.", vim.log.levels.ERROR)
		return
	end

	local winid = vim.fn.bufwinid(original_buffer)

	if winid == -1 then
		vim.notify("Could not find the original window.", vim.log.levels.ERROR)
		return
	end

	vim.fn.win_gotoid(winid)
	vim.cmd("e " .. relative_filepath)
end

function LazygitToggle()
	local Terminal = require("toggleterm.terminal").Terminal
	local current_buffer = vim.api.nvim_get_current_buf()

	local lazygit = Terminal:new({
		cmd = "lazygit",
		dir = "git_dir",
		direction = "float",
		float_opts = {
			border = "double",
		},
		-- function to run on opening the terminal
		on_open = function(term)
			vim.cmd("startinsert!")
			vim.api.nvim_buf_set_keymap(
				term.bufnr,
				"t",
				"<c-e>",
				string.format([[<Cmd>lua LazygitEdit(%d)<CR>]], current_buffer),
				{ noremap = true, silent = true }
			)
		end,
	})
	lazygit:toggle()
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
