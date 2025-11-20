return {
	{
		"mfussenegger/nvim-lint",
		config = function()
			require("lint").linters_by_ft = {
				javascript = { "eslint" },
				typescript = { "eslint" },
				typescriptreact = { "eslint" },
				python = { "mypy" },
				yaml = { "yamllint" },
				rust = { "clippy" },
				go = { "golangcilint" },
			}

			require("lint").linters.mypy.args = {
				"--ignore-missing-imports",
				"--show-column-numbers",
			}

			require("lint").linters.clippy.args = {
				"clippy",
				"--message-format=json",
				"--all-targets",
				"--all-features",
			}

			-- Function to find go.mod directory
			local function find_go_mod_root()
				local current_file = vim.api.nvim_buf_get_name(0)
				if current_file == "" then
					return vim.fn.getcwd()
				end

				local current_dir = vim.fs.dirname(current_file)
				-- Search upwards for go.mod
				local go_mod_path = vim.fs.find("go.mod", {
					path = current_dir,
					upward = true,
					type = "file",
				})[1]

				if go_mod_path then
					return vim.fs.dirname(go_mod_path)
				end

				-- Fallback to current working directory
				return vim.fn.getcwd()
			end

			-- Configure golangci-lint to run from module root
			require("lint").linters.golangcilint.args = {
				"run",
        "--config=~/.config/golangci-lint/config.yaml",
				"--output.json.path=stdout",
				"--show-stats=false",
				function()
					return find_go_mod_root()
				end,
			}

			-- Setup autocmds for linting
			vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave" }, {
				callback = function()
					require("lint").try_lint()
				end,
			})
		end,
	},
}
