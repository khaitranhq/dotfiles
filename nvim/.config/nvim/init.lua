require("vim._core.ui2").enable()

vim.filetype.add({
	pattern = {
		["docker-compose%.yml"] = "yaml.docker-compose",
		["go.work"] = "gowork",
		["%.mytemplate"] = "gotmpl",
	},
})

require("core.opts")
require("core.autocommand").setup()
require("plugins").setup()
require("core.keymap").setup()
require("core.keymap").setup()
require("core.keymap").setup()
