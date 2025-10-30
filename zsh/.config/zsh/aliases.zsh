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
# UTILITY FUNCTIONS
# =============================================================================
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b" # Generate random password to clipboard

# =============================================================================
# SESSION MANAGEMENT
# =============================================================================
alias t="tmux"  # Quick tmux alias
alias qq="exit" # Quick exit alias

# =============================================================================
# CLOUD & DEVOPS TOOLS
# =============================================================================
alias k='kubectl'  # Kubernetes CLI shorthand
alias kx='kubectx' # Kubernetes context switcher
alias p='pulumi'   # Infrastructure as Code tool

# =============================================================================
# EXTERNAL SCRIPTS
# =============================================================================
alias au="~/.config/fish/aws-utils.fish" # AWS utility functions from Fish shell

# =============================================================================
# WINDOWS WSL SSH INTEGRATION
# =============================================================================
# Use Windows SSH binaries for better integration with Windows SSH agent
alias ssh='ssh.exe'
alias ssh-add='ssh-add.exe'
alias scp='scp.exe'
alias sftp='sftp.exe'
