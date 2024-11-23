# My current Linux set up

## System Level

- OS: Ubuntu 22.04
- DE: XFCE4
- Xorg
- `keyd` for remapping keys
- Using [script](https://github.com/khaitranhq/swap-xfce-workspaces) to swap workspaces on XFCE
- XFCE Plugins
    - Generic monitor with [scripts](https://github.com/xtonousou/xfce4-genmon-scripts)
- Required package: `libpango1.0-0`
- Uninstall incompatible packages: `sudo apt remove ayatana-indicator-application ayatana-indicator-common`

## Applications

### Browser

- Firefox with configured multiple containers
- Extensions
  - [Auto Tab Discard](https://addons.mozilla.org/en-US/firefox/addon/auto-tab-discard/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search)
  - [Bitwarden Password Manager](https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search)
  - [Ctrl+Number to switch tabs](https://addons.mozilla.org/en-US/firefox/addon/ctrl-number-to-switch-tabs/)
  - [Firefox Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/)
  - [Grammarly: AI Writing and Grammar Checker App](https://addons.mozilla.org/en-US/firefox/addon/grammarly-1/)
  - [Material Icons for Github](https://addons.mozilla.org/en-US/firefox/addon/material-icons-for-github/)
  - [Sidebery](https://addons.mozilla.org/en-US/firefox/addon/sidebery/)
  - [Simple Translate](https://addons.mozilla.org/en-US/firefox/addon/simple-translate/)
  - [Tab Numbers](https://addons.mozilla.org/en-US/firefox/addon/tab_numbers/)
  - [Vimium](https://addons.mozilla.org/en-US/firefox/addon/vimium-ff/)

### Terminal

- Terminal: Kitty
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
