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
		["<leader>b"] = {
			function()
				require("mini.files").open()
			end,
			"Toggle mini files",
		},
		-- Copy relative path of current buffer to clipboard
		["<leader>yp"] = {
			MiniFilesCopyRelativePath,
			"Copy current buffer relative path to clipboard",
		},
	},
}

M.lsp = {
	n = {
		["<leader>dr"] = { vim.lsp.buf.rename, "Rename variable at cursor" },

		["<leader>dp"] = {
			function()
				vim.diagnostic.jump({ count = -1, float = true })
			end,
			"Previous diagnostic position",
		},
		["<leader>dn"] = {
			function()
				vim.diagnostic.jump({ count = 1, float = true })
			end,
			"Next diagnostic position",
		},
		["<leader>de"] = { vim.diagnostic.open_float, "Show diagnostic message in a float window" },

		["<leader>dfd"] = { vim.lsp.buf.hover, "Show document in float window" },

		-- Navigation mappings
		["<leader>dd"] = { vim.lsp.buf.definition, "Go to definition" },
		["<leader>di"] = { vim.lsp.buf.implementation, "Go to implementation" },

		-- Code action
		["<leader>dca"] = { vim.lsp.buf.code_action, "Code action" },
	},
}

-- local gitsigns = require("gitsigns")
M.git = {
	n = {
		["<leader>gcc"] = { "<cmd>GitConflictChooseOurs<CR>", "Git conflict: select current change" },
		["<leader>gci"] = { "<cmd>GitConflictChooseTheirs<CR>", "Git conflict: select incomming change" },
		["<leader>gcb"] = { "<cmd>GitConflictChooseBoth<CR>", "Git conflict: select both changes" },
		["<leader>gcx"] = { "<cmd>GitConflictChooseNone<CR>", "Git conflict: select none of the changes" },
		["<leader>gcn"] = { "<cmd>GitConflictNextConflict<CR>", "Git conflict: select next conflict" },
		["<leader>gcp"] = { "<cmd>GitConflictPrevConflict<CR>", "Git conflict: select previous conflict" },
	},
}

local mini_pick = require("mini.pick")
M.fuzzy = {
	n = {
		["<leader>ff"] = {
			function()
				OverrideRipgrepConfig(function()
					mini_pick.builtin.files({ tool = "rg" })
				end)
			end,
			"Find files (hidden + no-ignore)",
		},
		["<leader>fg"] = {
			function()
				OverrideRipgrepConfig(function()
					mini_pick.builtin.grep()
				end)
			end,
			"Grep in files",
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
		["m"] = { "<Plug>(leap)", "Navigate with leap" },
		["<leader>s"] = { "<cmd>ReachOpen buffers<CR>", "Select buffers" },
		["<leader>w"] = { vim.window_picker_select, "Pick window" },
		["<leader>tf"] = { require("core.utils").select_tab, "Pick window" },
	},
}

return M
