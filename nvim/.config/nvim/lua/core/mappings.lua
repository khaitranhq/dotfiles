-- Neovim Key Mappings Configuration
-- This module defines all custom key mappings organized by functionality.
-- Mappings are loaded by core.utils.load_mappings() during Neovim startup.
--
-- Mode abbreviations: n = normal, v = visual, i = insert, t = terminal

local M = {}

-- CORE NAVIGATION & WINDOW MANAGEMENT

M.general = {
	n = {
		-- Window navigation - vim-like directional movement
		["<C-h>"] = { "<C-w>h", "Window left" },
		["<C-l>"] = { "<C-w>l", "Window right" },
		["<C-j>"] = { "<C-w>j", "Window down" },
		["<C-k>"] = { "<C-w>k", "Window up" },

		-- Quick actions
		["qq"] = { "<cmd>qa<CR>", "Quit Neovim" },
		[";"] = { ":", "Enter command mode" },
		["<leader>/"] = { "<cmd>nohlsearch<CR>", "Clear search highlights" },

		-- Buffer information
		["<leader>pwd"] = {
			function()
				local current_file = vim.api.nvim_buf_get_name(0)
				local relative_path = vim.fn.fnamemodify(current_file, ":~:.")
				print("Current buffer: " .. (relative_path ~= "" and relative_path or "[No Name]"))
			end,
			"Show current buffer path",
		},

		-- Copy buffer path (absolute/relative) to clipboard
		["<leader>cp"] = {
			function()
				local utils_ok, utils = pcall(require, "core.utils")
				if utils_ok and utils.copy_buffer_path then
					utils.copy_buffer_path()
				else
					vim.notify("Path copier not available", vim.log.levels.WARN)
				end
			end,
			"Copy buffer path (absolute/relative) to clipboard",
		},

		-- System clipboard integration
		["p"] = { '"+p', "Paste from system clipboard" },
	},

	v = {
		-- Visual mode enhancements
		["//"] = { "y/\\V<C-R>=escape(@\",'/')<CR><CR>", "Search with selected text" },
		["y"] = { '"+y', "Yank to system clipboard" },
		["d"] = { '"+d', "Cut to system clipboard" },
		["<leader>d"] = { '"_d', "Delete but not write to clipboard" },
		["x"] = { '"+x', "Cut character to system clipboard" },
		["<leader>x"] = { '"_x', "Delete but not write to clipboard" },
	},
}

-- NOTIFICATION MANAGEMENT

local notify = require("notify")
M.notify = {
	n = {
		["<leader>zh"] = { notify.dismiss, "Dismiss all notifications" },
	},
}

-- TAB MANAGEMENT

M.tabs = {
	n = {
		["<leader>tt"] = { "<cmd>tabnew<CR>", "Create new tab" },
		["<leader>tx"] = { "<cmd>tabclose<CR>", "Close current tab" },
		["<leader>tn"] = { "<cmd>tabnext<CR>", "Go to next tab" },
		["<leader>tp"] = { "<cmd>tabprevious<CR>", "Go to previous tab" },
		["<leader>tf"] = {
			function()
				local utils_ok, utils = pcall(require, "core.utils")
				if utils_ok and utils.select_tab then
					utils.select_tab()
				else
					vim.notify("Tab selector not available", vim.log.levels.WARN)
				end
			end,
			"Interactive tab picker",
		},
	},
}

-- FILE EXPLORATION & NAVIGATION

M.file_explorer = {
	n = {
		["<leader>b"] = {
			function()
				Snacks.explorer()
			end,
			"Toggle nvim tree",
		},
	},
}

-- FUZZY FINDING & SEARCH

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

-- ADVANCED NAVIGATION

M.navigate = {
	n = {
		["s"] = { "<Plug>(leap)", "Leap navigation" },
		["<leader>w"] = {
			SelectWindow,
			"Interactive window picker",
		},
		["<leader>tf"] = { require("core.utils").select_tab, "Pick window" },
		["<leader>s"] = { "<cmd>ReachOpen buffers<CR>", "Select buffers" },
	},
}

-- LSP & DIAGNOSTICS

M.lsp = {
	n = {
		-- Diagnostics navigation
		["<leader>dp"] = {
			function()
				vim.diagnostic.jump({ count = -1, float = true })
			end,
			"Previous diagnostic",
		},
		["<leader>dn"] = {
			function()
				vim.diagnostic.jump({ count = 1, float = true })
			end,
			"Next diagnostic",
		},
		["<leader>de"] = { vim.diagnostic.open_float, "Show diagnostic details" },

		-- LSP navigation
		["<leader>dd"] = { vim.lsp.buf.definition, "Go to definition" },
		["<leader>di"] = { vim.lsp.buf.implementation, "Go to implementation" },
		["<leader>dfd"] = { vim.lsp.buf.hover, "Show hover documentation" },

		-- LSP actions
		["<leader>dr"] = { vim.lsp.buf.rename, "Rename symbol" },
		["<leader>dca"] = { vim.lsp.buf.code_action, "Show code actions" },
	},
}

-- CODE FORMATTING

M.format = {
	n = {
		["<leader>fm"] = {
			function()
				if _G.Format then
					_G.Format()
				else
					-- Fallback to basic LSP formatting
					local clients = vim.lsp.get_clients({ bufnr = 0 })
					if #clients > 0 then
						vim.lsp.buf.format({ async = true })
						vim.notify("Formatted with LSP", vim.log.levels.INFO)
					else
						vim.notify("No formatter available", vim.log.levels.WARN)
					end
				end
			end,
			"Format current buffer",
		},
	},
}

-- GIT INTEGRATION

local gitsigns = require("gitsigns")
M.git = {
	n = {
		-- Git conflict resolution
		["<leader>gcc"] = { "<cmd>GitConflictChooseOurs<CR>", "Git: choose current change" },
		["<leader>gci"] = { "<cmd>GitConflictChooseTheirs<CR>", "Git: choose incoming change" },
		["<leader>gcb"] = { "<cmd>GitConflictChooseBoth<CR>", "Git: choose both changes" },
		["<leader>gcx"] = { "<cmd>GitConflictChooseNone<CR>", "Git: reject all changes" },

		-- Git conflict navigation
		["<leader>gcn"] = { "<cmd>GitConflictNextConflict<CR>", "Git: next conflict" },
		["<leader>gcp"] = { "<cmd>GitConflictPrevConflict<CR>", "Git: previous conflict" },

		-- Hunks actions
		["<leader>ghs"] = { gitsigns.stage_hunk, "Git: stage hunk" },
		["<leader>ghr"] = { gitsigns.reset_hunk, "Git: reset hunk" },
		["<leader>ghp"] = { gitsigns.preview_hunk_inline, "Git: preview hunk" },
		["<leader>ghd"] = { gitsigns.diffthis, "Git: diffthis" },

		-- Lazygit
		["<leader>gs"] = {
			function()
				Snacks.lazygit()
			end,
			"Open LazyGit",
		},
	},
}

return M
