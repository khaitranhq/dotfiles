-- Pull in the wezterm API
local wezterm = require "wezterm"

local config = {}

if wezterm.config_builder then
    config = wezterm.config_builder()
end

-- Appearance
config.color_scheme = "Catppuccin Macchiato"
config.inactive_pane_hsb = {
    saturation = 0.24,
    brightness = 0.7
}
config.use_fancy_tab_bar = false

-- Window
config.window_decorations = "RESIZE"
config.window_close_confirmation = "AlwaysPrompt"

-- Keybinding
config.keys = {
    {key = "1", mods = "ALT", action = wezterm.action {ActivateTab = 0}},
    {key = "2", mods = "ALT", action = wezterm.action {ActivateTab = 1}},
    {key = "3", mods = "ALT", action = wezterm.action {ActivateTab = 2}},
    {key = "4", mods = "ALT", action = wezterm.action {ActivateTab = 3}},
    {key = "5", mods = "ALT", action = wezterm.action {ActivateTab = 4}},
    {key = "6", mods = "ALT", action = wezterm.action {ActivateTab = 5}},
    {key = "7", mods = "ALT", action = wezterm.action {ActivateTab = 6}},
    {key = "8", mods = "ALT", action = wezterm.action {ActivateTab = 7}},
    {key = "9", mods = "ALT", action = wezterm.action {ActivateTab = 8}},
    {key = "v", mods = "SHIFT|CTRL", action = wezterm.action.PasteFrom "Clipboard"},
    {key = "c", mods = "SHIFT|CTRL", action = wezterm.action.CopyTo "Clipboard"},
    {key = "H", mods = "ALT|SHIFT", action = wezterm.action {AdjustPaneSize = {"Left", 5}}},
    {key = "J", mods = "ALT|SHIFT", action = wezterm.action {AdjustPaneSize = {"Down", 5}}},
    {key = "K", mods = "ALT|SHIFT", action = wezterm.action {AdjustPaneSize = {"Up", 5}}},
    {key = "L", mods = "ALT|SHIFT", action = wezterm.action {AdjustPaneSize = {"Right", 5}}},
    {key = "h", mods = "ALT", action = wezterm.action {ActivatePaneDirection = "Left"}},
    {key = "j", mods = "ALT", action = wezterm.action {ActivatePaneDirection = "Down"}},
    {key = "k", mods = "ALT", action = wezterm.action {ActivatePaneDirection = "Up"}},
    {key = "l", mods = "ALT", action = wezterm.action {ActivatePaneDirection = "Right"}},
    {key = "t", mods = "ALT", action = wezterm.action {SpawnTab = "CurrentPaneDomain"}},
    {key = "-", mods = "ALT", action = wezterm.action {SplitVertical = {domain = "CurrentPaneDomain"}}},
    {key = "|", mods = "ALT|SHIFT", action = wezterm.action {SplitHorizontal = {domain = "CurrentPaneDomain"}}},
}

wezterm.on(
    "update-right-status",
    function(window, pane)
        window:set_right_status(window:active_workspace())
    end
)

return config
