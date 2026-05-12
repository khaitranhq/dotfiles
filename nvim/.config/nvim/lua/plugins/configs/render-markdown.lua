local M = {}

M.setup = function()
	require("render-markdown").setup({
		checkbox = {
			unchecked = { icon = "" },
			checked = { icon = "", scope_highlight = "@markup.strikethrough" },
			custom = {
				doing = { raw = "[=]", rendered = "▶" },
			},
		},
	})
end

return M
