-- This module defines all custom key mappings organized by functionality.
--
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
		["qq"] = {
			function()
				vim.cmd("qa")
			end,
			"Quit Neovim",
		},
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
		["x"] = { '"+x', "Cut character to system clipboard" },
	},

	t = {
		["<Esc>"] = {
			function()
				self.esc_timer = self.esc_timer or (vim.uv or vim.loop).new_timer()
				if self.esc_timer:is_active() then
					self.esc_timer:stop()
					vim.cmd("stopinsert")
				else
					self.esc_timer:start(200, 0, function() end)
					return "<esc>"
				end
			end,
			"Double escape to normal mode",
		},
	},
}

-- NOTIFICATION MANAGEMENT
M.notify = {
	n = {
		["<leader>zh"] = {
			function()
				Snacks.notifier.hide()
			end,
			"Dismiss all notifications",
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
			"Toggle file explorer",
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
		["<leader>fu"] = {
			function()
				Snacks.picker.buffers()
			end,
			"Find buffers",
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
		["<leader>dh"] = { vim.lsp.buf.hover, "Show hover documentation" },
		["<leader>df"] = { Snacks.picker.lsp_references, "Show references" },

		-- LSP actions
		["<leader>dr"] = { vim.lsp.buf.rename, "Rename symbol" },
		["<leader>dca"] = { vim.lsp.buf.code_action, "Show code actions" },
		["<leader>ds"] = {
			function()
				vim.lsp.buf.format({ async = false })
				vim.cmd("write")
			end,
			"Format and save buffer",
		},
	},
	i = {
		["<C-o>"] = {
			"copilot#Accept()",
			"Accept Copilot suggetsion",
			opts = {
				expr = true,
				replace_keycodes = false,
			},
		},
	},
}

-- MARKDOWN TASK MANAGEMENT
M.markdown = {
	n = {
		["<leader>mt"] = {
			function()
				require("core.utils").set_markdown_task_state("todo")
			end,
			"Mark task as todo",
		},
		["<leader>md"] = {
			function()
				require("core.utils").set_markdown_task_state("done")
			end,
			"Mark task as done",
		},
		["<leader>mg"] = {
			function()
				require("core.utils").set_markdown_task_state("doing")
			end,
			"Mark task as doing",
		},
		["<leader>mb"] = {
			function()
				require("core.utils").set_markdown_task_state("blocked")
			end,
			"Mark task as blocked",
		},
		["<leader>mp"] = {
			function()
				require("core.utils").set_markdown_task_state("pending")
			end,
			"Mark task as pending",
		},
		["<leader>mi"] = {
			function()
				require("core.utils").fix_markdown_task_ids()
			end,
			"Fix markdown task IDs",
		},

		-- Priority icons for tasks
		["<leader>mp1"] = {
			function()
				require("core.utils").set_markdown_priority("critical")
			end,
			"Add critical priority (🔴)",
		},
		["<leader>mp2"] = {
			function()
				require("core.utils").set_markdown_priority("high")
			end,
			"Add high priority (🟠)",
		},
		["<leader>mp3"] = {
			function()
				require("core.utils").set_markdown_priority("medium")
			end,
			"Add medium priority (🟡)",
		},
		["<leader>mp4"] = {
			function()
				require("core.utils").set_markdown_priority("low")
			end,
			"Add low priority (🟢)",
		},
	},
}

-- GIT INTEGRATION
local gitsigns = require("gitsigns")
local diffview = require("diffview")
M.git = {
	n = {
		["<leader>gs"] = {
			function()
				Snacks.lazygit({ cwd = vim.fn.expand("%:p:h") })
			end,
			"Open Lazygit",
		},
		["<leader>ghp"] = {
			gitsigns.preview_hunk,
			"Preview hunk",
		},
		["<leader>ghx"] = {
			gitsigns.reset_hunk,
			"Reset hunk",
		},
		["<leader>ghs"] = {
			gitsigns.stage_hunk,
			"Stage hunk",
		},
		["<leader>ghr"] = {
			function()
				gitsigns.nav_hunk("prev")
			end,
			"Previous hunk",
		},
		["<leader>ghn"] = {
			function()
				gitsigns.nav_hunk("next")
			end,
			"Next hunk",
		},
		["<leader>gd"] = {
			diffview.open,
			"Open Diffview",
		},
		["<leader>gD"] = {
			diffview.close,
			"Close Diffview",
		},
	},
}

M.ai = {
	n = {
		["<leader>oa"] = {
			function()
				require("opencode").ask()
			end,
			"Ask AI",
		},
		["<leader>oo"] = {
			function()
				require("opencode").toggle()
			end,
			"Toggle AI panel",
		},
	},
}

return M
