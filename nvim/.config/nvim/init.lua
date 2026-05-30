vim.loader.enable()

require("vim._core.ui2").enable()

vim.filetype.add({
	pattern = {
		["docker-compose%.yml"] = "yaml.docker-compose",
		["go.work"] = "gowork",
		["%.mytemplate"] = "gotmpl",
		["%.d2"] = "d2",
	},
})

require("core.opts")
require("core.command").setup()
require("plugins").setup()
require("core.keymap").setup()
