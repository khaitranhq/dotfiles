require("relative-motions"):setup({ show_numbers = "relative", show_motion = true })

-- You can configure your bookmarks by lua language
local bookmarks = {}

local home_path = ya.target_family() == "windows" and os.getenv("USERPROFILE") or os.getenv("HOME")
table.insert(bookmarks, {
	tag = "Downloads",
	path = home_path .. "/Downloads/",
	key = "d",
})
table.insert(bookmarks, {
	tag = "VantagePoint",
	path = home_path .. "/Workspaces/Vantagepoint/",
	key = "v",
})
table.insert(bookmarks, {
	tag = "Personal",
	path = home_path .. "/Workspaces/Personal/",
	key = "p",
})

require("yamb"):setup({
	-- Optional, the path ending with path seperator represents folder.
	bookmarks = bookmarks,
	-- Optional, recieve notification everytime you jump.
	jump_notify = true,
	-- Optional, the cli of fzf.
	cli = "fzf",
	-- Optional, a string used for randomly generating keys, where the preceding characters have higher priority.
	keys = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
	-- Optional, the path of bookmarks
	path = (ya.target_family() == "windows" and os.getenv("APPDATA") .. "\\yazi\\config\\bookmark")
		or (os.getenv("HOME") .. "/.config/yazi/bookmark"),
})

require("git"):setup()
require("full-border"):setup()
