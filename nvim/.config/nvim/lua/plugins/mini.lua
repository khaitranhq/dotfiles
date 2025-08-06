function MiniPickFilesWithIcons()
	local command = {
		"fd",
		"--type=f",
		"--no-follow",
		"--color=never",
		"--hidden",
		"--no-ignore",
		"--exclude=.git",
		"--exclude=.cache",
		"--exclude=__pycache__",
		"--exclude=node_modules",
		"--exclude=vendor",
		"--exclude=.venv",
		"--exclude=.idea",
		"--exclude=.vscode",
		"--exclude=.DS_Store",
		"--exclude=venv",
		"--exclude=.tmp",
		"--exclude=dist",
	}
	local show_with_icons = function(buf_id, items, query)
		return MiniPick.default_show(buf_id, items, query, { show_icons = true })
	end
	local source = { name = "Files fd", show = show_with_icons }
	return MiniPick.builtin.cli({ command = command }, { source = source })
end

function MiniPickGrepWithConfig(f)
	local rg_env = "RIPGREP_CONFIG_PATH"
	local cached_rg_config = vim.uv.os_getenv(rg_env) or ""
	vim.uv.os_setenv(rg_env, vim.fn.stdpath("config") .. "/.rg")
	f()
	vim.uv.os_setenv(rg_env, cached_rg_config)
end

return {
	{
		"echasnovski/mini.nvim",
		version = "*",
		config = function()
			require("mini.pairs").setup()
			require("mini.surround").setup()
			require("mini.pick").setup()
			require("mini.notify").setup()
			require("mini.indentscope").setup({
				symbol = "│",
			})
			require("mini.statusline").setup()
			require("mini.tabline").setup({
				format = function(buf_id, label)
					local suffix = vim.bo[buf_id].modified and "+ " or ""
					return " " .. buf_id .. MiniTabline.default_format(buf_id, label) .. suffix
				end,
			})
			require("mini.trailspace").setup()

			MiniPick.registry.files_fd = MiniPickFilesWithIcons
		end,
	},
}
