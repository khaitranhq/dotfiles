function vim.current_git_branch()
	local current_branch = require("neogit.lib.git").branch.current()
	vim.cmd.let(("@+='%s'"):format(current_branch))
	print("Copied current branch to clipboard: " .. current_branch)
end

return {
	{
		"lewis6991/gitsigns.nvim",
		config = function()
			require("gitsigns").setup({
				current_line_blame = true,
			})
		end,
	},
	{
		"akinsho/git-conflict.nvim",
		version = "*",
		config = true,
	},
	{
		"NeogitOrg/neogit",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-telescope/telescope.nvim",
		},
		config = true,
	},
	{
		"sindrets/diffview.nvim", -- Diff integration
	},
}
