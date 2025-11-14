# =============================================================================
# ZSH Configuration File
# =============================================================================
# Main configuration loader for modular zsh setup
# This file loads environment, plugins, aliases, and custom functions

# =============================================================================
# SHELL INTEGRATIONS & PLUGINS
# =============================================================================

# Oh My Posh - Modern prompt theme engine
eval "$(oh-my-posh init zsh --config '/home/lewis/.config/ohmyposh/tokyonigh.omp.json')"

# Zsh Enhancements
source $HOME/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh         # Fish-like autosuggestions
source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh # Syntax highlighting

# Directory Navigation
eval "$(zoxide init zsh)" # Smart cd replacement

# Zellij
# eval "$(zellij setup --generate-auto-start zsh)"

# =============================================================================
# COMPLETION SYSTEM
# =============================================================================
# Cache completion system to speed up startup by ~0.3-0.5s

autoload bashcompinit && bashcompinit # Enable bash completions compatibility
autoload -Uz compinit

# Completion cache directory
ZSH_COMPDUMP="${ZDOTDIR:-$HOME}/.zcompdump-${ZSH_VERSION}"

# Only regenerate completion cache once per day
if [[ -n ${ZSH_COMPDUMP}(#qNmh+24) ]]; then
  compinit -d "$ZSH_COMPDUMP"
else
  compinit -C -d "$ZSH_COMPDUMP"
fi

# Tool-Specific Completions
if [ -f '/usr/local/bin/aws_completer' ]; then
  complete -C '/usr/local/bin/aws_completer' aws
fi

# FZF integration
if command -v fzf &> /dev/null; then
  source <(fzf --zsh)
fi

# =============================================================================
# KEY BINDINGS
# =============================================================================

# Command Line Editing
autoload -z edit-command-line   # Load command line editor function
zle -N edit-command-line        # Bind function to ZLE (Zsh Line Editor)
bindkey "^e" edit-command-line # Alt+E to edit current command in $EDITOR

# Word Movement
bindkey "^[[1;5C" forward-word  # Ctrl+Right Arrow: move forward by word
bindkey "^[[1;5D" backward-word # Ctrl+Left Arrow: move backward by word

# =============================================================================
# LOAD MODULAR CONFIGURATION
# =============================================================================
# Load aliases and custom functions from separate files

# Aliases - All command shortcuts
if [ -f "$HOME/.config/zsh/aliases.zsh" ]; then
  source "$HOME/.config/zsh/aliases.zsh"
fi

# Custom Functions - Shell functions and utilities
if [ -f "$HOME/.config/zsh/functions.zsh" ]; then
  source "$HOME/.config/zsh/functions.zsh"
fi

# AI Configuration - AI-related settings (optional)
if [ -f "$HOME/.config/zsh/ai.zsh" ]; then
  source "$HOME/.config/zsh/ai.zsh"
fi
