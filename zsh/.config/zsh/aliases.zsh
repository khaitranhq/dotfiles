# =============================================================================
# ZSH Aliases
# =============================================================================
# All command aliases and shortcuts

# =============================================================================
# TEXT EDITORS
# =============================================================================
alias v="nvim" # Quick nvim alias

# =============================================================================
# FILE MANAGEMENT
# =============================================================================
alias l='eza -lah --icons'               # Detailed list with icons and human-readable sizes
alias ls='eza -lah --icons --total-size' # Same as above with total directory size
alias cat="bat -p"                       # Use bat (syntax-highlighted cat) in plain mode
alias y='yazi'                           # Yazi file manager

# =============================================================================
# DEVELOPMENT TOOLS
# =============================================================================
alias ld='lazydocker' # Docker management TUI
alias lg='lazygit'    # Git management TUI

# =============================================================================
# SESSION MANAGEMENT
# =============================================================================
alias qq="exit" # Quick exit alias

# =============================================================================
# CLOUD & DEVOPS TOOLS
# =============================================================================
alias p='pulumi'   # Infrastructure as Code tool
