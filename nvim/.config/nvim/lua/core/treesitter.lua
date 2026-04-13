local parser_filetype_map = {
	["go"] = { "go" },
	["gomod"] = { "gomod" },
	["gosum"] = { "gosum" },
}

local M = {}

M.setup = function()
	local installed_parsers = vim.api.nvim_get_runtime_file("parser/*.so", true)

	vim.api.nvim_create_autocmd("FileType", {
		pattern = "*",
		callback = function()
			local ft = vim.bo.filetype
			if parser_filetype_map[ft] then
				vim.treesitter.start()
			end
		end,
	})
end

return M
