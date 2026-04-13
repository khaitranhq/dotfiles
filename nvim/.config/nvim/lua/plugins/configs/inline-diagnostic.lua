local M = {}

M.setup = function()
	require("tiny-inline-diagnostic").setup({
		options = {
			show_source = {
				enabled = true,
			},
		},
	})
end

return M
