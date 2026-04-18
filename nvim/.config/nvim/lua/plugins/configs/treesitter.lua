local M = {}

M.setup = function()
	require("tree-sitter-manager").setup({
		auto_install = true, -- Automatically install missing parsers when entering buffer
	})
end

return M
