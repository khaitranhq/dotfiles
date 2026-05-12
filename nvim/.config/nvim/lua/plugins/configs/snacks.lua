local M = {}

M.setup = function()
	local opts = {
		styles = {
			terminal = {
				keys = {
					term_normal = false,
				},
			},
		},
		indent = {},
		input = {},
		explorer = {},
		lazygit = {},
		image = {
			enabled = false,
		},
		notifier = {},
		statuscolumn = {
			folds = {
				open = true, -- show open fold icons
				git_hl = true, -- use Git Signs hl for fold icons
			},
		},
		picker = {
			matcher = {
				frecency = true,
			},
			sources = {
				gh = {},
				files = {
					cmd = "rg",
				},
				grep = {
					cmd = "rg",
					args = { "-g", "!**/*.diff" },
				},
				explorer = {
					hidden = true,
					ignored = true,
					auto_close = true,
					layout = "default",
					win = {
						list = {
							keys = { ["Y"] = "copy_path", ["o"] = "confirm" },
							wo = { number = true, relativenumber = true },
						},
					},
					actions = {
						copy_path = function(_, item)
							local modify = vim.fn.fnamemodify
							local filepath = item.file
							local filename = modify(filepath, ":t")
							local is_file = vim.fn.isdirectory(filepath) == 0

							local values = {
								modify(filepath, ":."),
								filepath,
								filename,
								is_file and modify(filename, ":r") or nil,
								is_file and modify(filename, ":e") or nil,
							}

							local items = {
								"Path relative to CWD: " .. values[1],
								"Absolute path: " .. values[2],
								"Filename: " .. values[3],
							}

							if is_file then
								table.insert(items, "Filename without extension: " .. values[4])
								table.insert(items, "Extension of the filename: " .. values[5])
							end

							vim.ui.select(items, { prompt = "Choose to copy to clipboard:" }, function(choice, i)
								if not choice or not i then
									vim.notify(choice and "Invalid selection" or "Selection cancelled")
									return
								end
								local result = values[i]
								vim.fn.setreg('"', result)
								vim.fn.setreg("+", result)
								vim.notify("Copied: " .. result)
							end)
						end,
					},
				},
			},
		},
	}

	require("snacks").setup(opts)

	vim.api.nvim_create_user_command("Keymaps", ":lua Snacks.picker.keymaps()", {})
	vim.api.nvim_create_user_command("Commands", ":lua Snacks.picker.commands()", {})
	vim.api.nvim_create_user_command("Help", ":lua Snacks.picker.help()", {})

	vim.api.nvim_create_autocmd("LspProgress", {
		callback = function(ev)
			local spinner = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }
			vim.notify(vim.lsp.status(), "info", {
				id = "lsp_progress",
				title = "LSP Progress",
				opts = function(notif)
					notif.icon = ev.data.params.value.kind == "end" and " "
						or spinner[math.floor(vim.uv.hrtime() / (1e6 * 80)) % #spinner + 1]
				end,
			})
		end,
	})
end

return M
