-- Mini.extra configuration
local M = {}

-- Setup Mini.extra configuration
function M.setup()
	require("mini.extra").setup()

	-- Create MiniDiagnostic command to run MiniExtra.pickers.diagnostic()
	vim.api.nvim_create_user_command("MiniDiagnostic", function()
		require("mini.extra").pickers.diagnostic()
	end, {
		desc = "Open Mini.extra diagnostic picker",
	})
end

return M