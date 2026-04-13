local parser_filetype_map = {
	["go"] = { "go" },
	["gomod"] = { "gomod" },
	["gosum"] = { "gosum" },
	["bash"] = { "bash" },
	["yaml"] = { "yaml" },
}

local M = {}

M.setup = function()
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
