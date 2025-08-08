-- Mini.tabline configuration with custom formatting
local utils = require("config.mini.utils")

local M = {}

-- Setup Mini.tabline configuration
function M.setup()
	require("mini.tabline").setup({
		format = function(buf_id, label)
			local suffix = vim.bo[buf_id].modified and "+ " or ""

			local diag = utils.get_diagnostics(buf_id)
			local err = diag.error > 0 and ("  " .. diag.error) or ""
			local warn = diag.warn > 0 and ("  " .. diag.warn) or ""
			return " " .. buf_id .. err .. warn .. MiniTabline.default_format(buf_id, label) .. suffix
		end,
	})
end

return M