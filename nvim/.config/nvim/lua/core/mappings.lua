-- n, v, i, t = mode names

local M = {}

M.general = {
	n = {
		-- switch between windows
		["<C-h>"] = { "<C-w>h", "Window left" },
		["<C-l>"] = { "<C-w>l", "Window right" },
		["<C-j>"] = { "<C-w>j", "Window down" },
		["<C-k>"] = { "<C-w>k", "Window up" },
		-- quit
		["qq"] = { "<cmd>qa<CR>", "Quit Neovim" },
		-- short key to run commands
		[";"] = { ":", "Short key to run commands" },
		["<leader>pwd"] = {
			function()
				print("Current directory: " .. vim.api.nvim_buf_get_name(0))
			end,
			"Show directory of current buffer",
		},
		["<leader>/"] = { "<cmd>nohlsearch<CR>", "Disable search highlight" },

		["p"] = { '"+p', "Paste" },

		["<leader>tt"] = { "<cmd>tabnew<CR>", "New tab" },
		["<leader>tx"] = { "<cmd>tabclose<CR>", "Close tab" },
		["<leader>tn"] = { "<cmd>tabnext<CR>", "Next tab" },
		["<leader>tp"] = { "<cmd>tabprevious<CR>", "Previous tab" },
	},
	v = {
		["//"] = { "y/\\V<C-R>=escape(@\",'/')<CR><CR>", "Search with selected text" },
		["y"] = { '"+y', "Yank" },
		["d"] = { '"+d', "Cut" },
		["x"] = { '"+x', "Cut single character" },
	},
}

M.file_explorer = {
	n = {
		["<leader>ls"] = { "<cmd>NvimTreeToggle<CR>", "Toggle nvim tree" },
		["<leader>lf"] = { "<cmd>NvimTreeFocus<CR>", "Toggle nvim tree" },
		["<leader>lv"] = { ChangeViewFileExplorer, "Change View of File Explorer" },
	},
}

M.lsp = {
	n = {
		["<leader>dr"] = { vim.lsp.buf.rename, "Rename variable at cursor" },

		["<leader>dp"] = { vim.diagnostic.goto_prev, "Previous diagnostic position" },
		["<leader>dn"] = { vim.diagnostic.goto_next, "Next diagnostic position" },
		["<leader>de"] = { vim.diagnostic.open_float, "Show diagnostic message in a float window" },

		["<leader>dfd"] = { vim.lsp.buf.hover, "Show document in float window" },

		["<leader>dd"] = { Snacks.picker.lsp_definitions, "Show definition" },
		["<leader>di"] = { Snacks.picker.lsp_implementations, "Show implementation" },
		["<leader>dca"] = { vim.lsp.buf.code_action, "Code action" },
	},
}

local notify = require("notify")
M.notify = {
	n = {
		["<leader>zh"] = { notify.dismiss, "Dismiss all notifications" },
	},
}

M.git = {
	n = {
		["<leader>gs"] = {
			Snacks.lazygit.open,
			"Git conflict: select current change",
		},
		["<leader>gcc"] = { "<cmd>GitConflictChooseOurs<CR>", "Git conflict: select current change" },
		["<leader>gci"] = { "<cmd>GitConflictChooseTheirs<CR>", "Git conflict: select incomming change" },
		["<leader>gcb"] = { "<cmd>GitConflictChooseBoth<CR>", "Git conflict: select both changes" },
		["<leader>gcx"] = { "<cmd>GitConflictChooseNone<CR>", "Git conflict: select none of the changes" },
		["<leader>gcn"] = { "<cmd>GitConflictNextConflict<CR>", "Git conflict: select next conflict" },
		["<leader>gcp"] = { "<cmd>GitConflictPrevConflict<CR>", "Git conflict: select previous conflict" },
	},
}

M.fuzzy = {
	n = {
		["<leader>ff"] = {
			function()
				Snacks.picker.files({
					hidden = true,
				})
			end,
			"Find files",
		},
		["<leader>fg"] = {
			function()
				Snacks.picker.grep({
					hidden = true,
				})
			end,
			"Find files",
		},
	},
}

M.format = {
	n = {
		["<leader>fm"] = { Format, "Format file" },
	},
}

M.navigate = {
	n = {
		["s"] = { "<Plug>(leap)", "Navigate with leap" },
		["<leader>s"] = { "<cmd>ReachOpen buffers<CR>", "Select buffers" },
		["<leader>w"] = { vim.window_picker_select, "Pick window" },
		["<leader>tf"] = { require("core.utils").select_tab, "Pick window" },
	},
}

return M
