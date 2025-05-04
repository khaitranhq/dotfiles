# My current Linux set up

## System Level

- OS: Ubuntu 22.04
- DE: XFCE4
- Xorg
- `keyd` for remapping keys
- Terminal: m
- Using [script](https://github.com/khaitranhq/swap-xfce-workspaces) to swap workspaces on XFCE
- XFCE Plugins
  - Generic monitor with [scripts](https://github.com/xtonousou/xfce4-genmon-scripts)
- Required package: `libpango1.0-0`
- Uninstall incompatible packages: `sudo apt remove ayatana-indicator-application ayatana-indicator-common`

## Applications

### Browser

- Brave

### Terminal

- Terminal: Wezterm
- Shell: fish
- Prompt: Oh my posh
- Terminal Multiplexer: tmux
- Package manager: apt & homebrew

### Code Editor/IDE

- Neovim
- Extensions

### Email client

- Thunderbird
- Birdtray

### Centralized Notification

- Slack

### Utilities

- Ulauncher
- CopyQ
- Lazygit
- Lazydocker
- Yazi
- DBeaver
- Pgcli
- MyCLI
- k9s
- Remmina

## Notes

Create an `openai.fish` file with the following format to run `opencommit`

```fish
OPENAI_API_KEY="<openai_key>"
```
