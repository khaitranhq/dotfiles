local M = {}

M.setup = function()
	require("lualine").setup({
		sections = {
			lualine_c = {
				{
					"filename",
					path = 1, -- Show relative path
				},
			},
		},
	})
end

return M
