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

local telescope_builtin = require("telescope.builtin")
M.telescope = {
	n = {
		["<leader>ff"] = {
			telescope_builtin.find_files,
			"Find files",
		},
		["<leader>fg"] = { telescope_builtin.live_grep, "Search text globally" },
		["<leader>fb"] = { telescope_builtin.buffers, "Search buffers" },
		["<leader>fc"] = { telescope_builtin.current_buffer_fuzzy_find, "Search text in current buffer" },
	},
	v = {
		["<leader>fs"] = { SearchWithSelectedText, "Search with selected text" },
	},
}

M.lsp = {
	n = {
		["<leader>dr"] = { vim.lsp.buf.rename, "Rename variable at cursor" },
		["<leader>dp"] = { vim.diagnostic.goto_prev, "Previous diagnostic position" },
		["<leader>dn"] = { vim.diagnostic.goto_next, "Next diagnostic position" },
		["<leader>dw"] = { telescope_builtin.diagnostics, "Show Diagnostic of Workspace" },
		["<leader>de"] = { vim.diagnostic.open_float, "Show diagnostic message in a float window" },
		["<leader>dfd"] = { vim.lsp.buf.hover, "Show document in float window" },
		["<leader>dd"] = { vim.lsp.buf.definition, "Show definition" },
		["<leader>dfe"] = { telescope_builtin.lsp_definitions, "Peek definition" },
		["<leader>dci"] = { telescope_builtin.lsp_incoming_calls, "Incoming call" },
		["<leader>dco"] = { telescope_builtin.lsp_outgoing_calls, "Outgoing call" },
		["<leader>dcm"] = { telescope_builtin.lsp_implementations, "Search and preview implementation" },
		["<leader>dca"] = { vim.lsp.buf.code_action, "Code action" },
		["<leader>di"] = { vim.lsp.buf.implementation, "Show implementation of function" },
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
		["<leader>gs"] = { LazygitToggle, "LazyGit" },
		["<leader>gcm"] = { OpenCommitToggle, "Git commit with OpenCommit" },
		["<leader>gcc"] = { "<cmd>GitConflictChooseOurs<CR>", "Git conflict: select current change" },
		["<leader>gci"] = { "<cmd>GitConflictChooseTheirs<CR>", "Git conflict: select incomming change" },
		["<leader>gcb"] = { "<cmd>GitConflictChooseBoth<CR>", "Git conflict: select both changes" },
		["<leader>gcx"] = { "<cmd>GitConflictChooseNone<CR>", "Git conflict: select none of the changes" },
		["<leader>gcn"] = { "<cmd>GitConflictNextConflict<CR>", "Git conflict: select next conflict" },
		["<leader>gcp"] = { "<cmd>GitConflictPrevConflict<CR>", "Git conflict: select previous conflict" },
	},
}

M.format = {
	n = {
		["<leader>fm"] = { Format, "Format file" },
	},
}

M.Navigate = {
	n = {
		["s"] = { "<Plug>(leap)", "Navigate with leap" },
		["<leader>s"] = { "<cmd>ReachOpen buffers<CR>", "Select buffers" },
		["<leader>w"] = { vim.window_picker_select, "Pick window" },
		["<leader>tf"] = { require("core.utils").select_tab, "Pick window" },
	},
}

return M
