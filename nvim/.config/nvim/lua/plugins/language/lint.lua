local getArgs = function()
	-- Handle editing a standalone golang file that isn't apart of a normal setup where
	-- the go.mod file can't be found by golangci-lint. In this situation, we need to provide
	-- the current buffer path to golangci-lint instead of it's parent directory to allow
	-- the buffer content to be linted, otherwise golangci-lint will raise an error
	local ok, go_mod_location = pcall(vim.fn.system, { "go", "env", "GOMOD" })
	if not ok then
		return
	end
	local filename_modifier = ":h"
	-- Remove extra whitespace like newline characters
	go_mod_location = go_mod_location:gsub("%s+", "")
	-- No go.mod file was found, so just lint the buffer directly
	if go_mod_location == "/dev/null" or go_mod_location == "" then
		filename_modifier = ":p"
	end

	local homePath = vim.fn.expand("$HOME")

	return {
		"run",
		"--config=" .. homePath .. "/.config/golangci-lint/config.yaml",
		"--output.json.path=stdout",
		-- Overwrite values possibly set in .golangci.yml
		"--output.text.path=",
		"--output.tab.path=",
		"--output.html.path=",
		"--output.checkstyle.path=",
		"--output.code-climate.path=",
		"--output.junit-xml.path=",
		"--output.teamcity.path=",
		"--output.sarif.path=",
		"--issues-exit-code=0",
		"--show-stats=false",
		-- Get absolute path of the linted file
		"--path-mode=abs",
		function()
			return vim.fn.fnamemodify(vim.api.nvim_buf_get_name(0), filename_modifier)
		end,
	}
end

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

			require("lint").linters.golangcilint.args = getArgs()

			-- Setup autocmds for linting
			vim.api.nvim_create_autocmd({ "BufEnter", "BufWritePost", "InsertLeave" }, {
				callback = function()
					require("lint").try_lint()
				end,
			})
		end,
	},
}
