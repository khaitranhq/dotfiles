return {
	{
		"folke/snacks.nvim",
		priority = 1000,
		lazy = false,
		opts = {
			indent = {},
			input = {},
			lazygit = {},
			picker = {
				sources = {
					files = {
						ignored = true,
						hidden = true,
						exclude = {
							".git",
							"node_modules",
							"dist",
							".venv",
							"venv",
							".mypy_cache",
							".aider*",
							".tmp",
							"cdk.out",
						},
					},
					explorer = {
						hidden = true,
						ignored = true,
						win = {
							list = {
								keys = {
									["Y"] = "copy_path",
									["o"] = "confirm",
								},
								wo = {
									number = true,
									relativenumber = true,
								},
							},
						},
						auto_close = true,
						layout = {
							cycle = true,
							preview = true, ---@diagnostic disable-line: assign-type-mismatch
							layout = {
								box = "horizontal",
								position = "float",
								height = 0.95,
								width = 0,
								border = "rounded",
								{
									box = "vertical",
									width = 40,
									min_width = 40,
									{ win = "input", height = 1, title = "{title} {live} {flags}", border = "single" },
									{ win = "list" },
								},
								{ win = "preview", width = 0, border = "left" },
							},
						},
						actions = {
							copy_path = function(_, item)
								local modify = vim.fn.fnamemodify
								local filepath = item.file
								local filename = modify(filepath, ":t")
								local values = {
									filepath,
									modify(filepath, ":."),
									modify(filepath, ":~"),
									filename,
									modify(filename, ":r"),
									modify(filename, ":e"),
								}
								local items = {
									"Absolute path: " .. values[1],
									"Path relative to CWD: " .. values[2],
									"Path relative to HOME: " .. values[3],
									"Filename: " .. values[4],
								}
								if vim.fn.isdirectory(filepath) == 0 then
									vim.list_extend(items, {
										"Filename without extension: " .. values[5],
										"Extension of the filename: " .. values[6],
									})
								end
								vim.ui.select(items, { prompt = "Choose to copy to clipboard:" }, function(choice, i)
									if not choice then
										vim.notify("Selection cancelled")
										return
									end
									if not i then
										vim.notify("Invalid selection")
										return
									end
									local result = values[i]
									vim.fn.setreg('"', result) -- Neovim unnamed register
									vim.fn.setreg("+", result) -- System clipboard
									vim.notify("Copied: " .. result)
								end)
							end,
						},
					},
				},
			},
		},
	},
}
