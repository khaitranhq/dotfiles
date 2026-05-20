local M = {}

function M.setup()
	require("codediff").setup({
		explorer = {
			view_mode = "tree",
		},
	})
end

return M
