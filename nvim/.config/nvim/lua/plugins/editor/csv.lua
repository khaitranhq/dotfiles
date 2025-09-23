return {
	{
		"hat0uma/csvview.nvim",
		---@module "csvview"
		---@type CsvView.Options
		opts = {
			view = {
				display_mode = "border",
			},
		},
		cmd = { "CsvViewEnable", "CsvViewDisable", "CsvViewToggle" },
	},
}
