local M = {}

M.setup = function()
	require("copilot").setup({
		suggestion = {
			auto_trigger = true,
		},
		filetypes = {
			yaml = true,
		},
	})
end

return M
