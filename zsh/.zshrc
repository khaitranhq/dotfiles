# =============================================================================
# ZSH Configuration File
# =============================================================================
# This file configures Zsh shell behavior, environment variables, aliases,
# functions, and integrations with various tools and utilities.

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================

# Editor Configuration
# -------------------
# Set the default editors for various contexts
export KUBE_EDITOR=nvim        # Default editor for kubectl edit commands
export VISUAL=nvim             # Editor for programs that need a visual editor
export EDITOR=nvim             # Default text editor for command line

# Kubernetes Configuration
# ------------------------
export KUBECONFIG="$HOME/.config/kubectl/config.yaml"  # Custom kubectl config location

# Zsh Completion System
# --------------------
# Add custom completion directory to function path
export fpath=($HOME/.zsh/zsh-completions/src $fpath)

# Command History Configuration
# ----------------------------
export HISTFILE="$HOME/.zsh_history"  # Location of history file
export HISTSIZE=10000                  # Number of commands in memory
export SAVEHIST=10000                  # Number of commands to save to file
setopt appendhistory                   # Append to history file instead of overwriting

# =============================================================================
# SHELL INTEGRATIONS & PLUGINS
# =============================================================================

# Oh My Posh - Modern prompt theme engine
# --------------------------------------
eval "$(oh-my-posh init zsh --config '/home/lewis/.config/ohmyposh/tokyonigh.omp.json')"

# Zsh Enhancements
# ---------------
source $HOME/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh    # Fish-like autosuggestions
source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh  # Syntax highlighting for commands

# Directory Navigation
# -------------------
eval "$(zoxide init zsh)"  # Smart cd replacement that learns your habits

# Completion System Setup
# ----------------------
autoload bashcompinit && bashcompinit  # Enable bash completions compatibility
autoload -Uz compinit && compinit      # Initialize Zsh completion system

# Tool-Specific Completions
# -------------------------
complete -C '/usr/local/bin/aws_completer' aws  # AWS CLI completions
source <(fzf --zsh)                             # FZF fuzzy finder integration

# =============================================================================
# KEY BINDINGS
# =============================================================================

# Command Line Editing
# --------------------
autoload -z edit-command-line          # Load command line editor function
zle -N edit-command-line               # Bind function to ZLE (Zsh Line Editor)
bindkey "^[e" edit-command-line        # Alt+E to edit current command in $EDITOR

# Word Movement
# ------------
bindkey "^[[1;5C" forward-word         # Ctrl+Right Arrow: move forward by word
bindkey "^[[1;5D" backward-word        # Ctrl+Left Arrow: move backward by word

# =============================================================================
# ALIASES
# =============================================================================

# Text Editors
# -----------
alias v="nvim"                         # Quick nvim alias

# File Listing (using eza - modern ls replacement)
# ------------------------------------------------
alias l='eza -lah --icons'            # Detailed list with icons and human-readable sizes
alias ls='eza -lah --icons --total-size'  # Same as above with total directory size

# File Viewing
# -----------
alias cat="bat -p"                    # Use bat (syntax-highlighted cat) in plain mode

# Development Tools
# ----------------
alias ld='lazydocker'                 # Docker management TUI
alias lg='lazygit'                    # Git management TUI

# Utility Functions
# ----------------
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"  # Generate random password to clipboard

# Session Management
# -----------------
alias t="tmux"                        # Quick tmux alias
alias qq="exit"                       # Quick exit alias

# Cloud & DevOps Tools
# -------------------
alias k='kubectl'                     # Kubernetes CLI shorthand
alias kx='kubectx'                    # Kubernetes context switcher
alias p='pulumi'                      # Infrastructure as Code tool

# External Scripts
# ---------------
alias au="~/.config/fish/aws-utils.fish"  # AWS utility functions from Fish shell

# Windows WSL SSH Integration
# --------------------------
# Use Windows SSH binaries for better integration with Windows SSH agent
alias ssh='ssh.exe'
alias ssh-add='ssh-add.exe'
alias scp='scp.exe'
alias sftp='sftp.exe'

# =============================================================================
# CONDITIONAL CONFIGURATION
# =============================================================================

# AI Configuration
# ---------------
# Load AI-related configuration if available
if [ -f $HOME/.zsh/ai.zsh ]; then
  source $HOME/.zsh/ai.zsh
fi

# =============================================================================
# CUSTOM FUNCTIONS
# =============================================================================
# Functions ported from Fish shell for enhanced functionality

# File Selection and Tmux Integration
# -----------------------------------
# Pick files with fzf and send to tmux pane
pick_files() {
    local pane_dir=$(tmux display-message -p '#{pane_current_path}')
    local pane_id=$(tmux display-message -p '#{pane_id}')

    cd "$pane_dir" || exit
    local git_root=$(git rev-parse --show-toplevel)

    # Determine realpath command based on OS (macOS compatibility)
    local realpath_cmd="realpath"
    if [[ "$OSTYPE" == darwin* ]]; then
        if ! command -v grealpath >/dev/null 2>&1; then
            echo "grealpath not found. Install with: brew install coreutils" >&2
            return 1
        fi
        realpath_cmd="grealpath"
    fi

    # Use fd and fzf to select files, then make paths relative to git root
    local selected_files=()
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            selected_files+=("$($realpath_cmd --relative-to="$git_root" "$pane_dir/$file")")
        fi
    done < <(fd --type f --hidden | fzf --multi --reverse --preview 'bat --style=numbers --color=always {}')

    # Send selected files to tmux pane
    if [[ ${#selected_files[@]} -gt 0 ]]; then
        local files_oneline="${selected_files[*]}"
        tmux send-keys -t "$pane_id" "$files_oneline"
    fi
}

# Node.js Version Management
# -------------------------
# Auto-switch Node version based on .nvmrc (ZSH hook equivalent)
chpwd_check_nvm() {
    if [[ -f .nvmrc ]]; then
        local node_version_target=$(cat .nvmrc)
        local nvm_node_versions=$(nvm list 2>/dev/null)

        if echo "$nvm_node_versions" | grep -q "$node_version_target"; then
            nvm use "$node_version_target" --silent
        else
            nvm install "$node_version_target" --silent
        fi
    fi
}

# Add the function to chpwd_functions array to run on directory change
autoload -U add-zsh-hook
add-zsh-hook chpwd chpwd_check_nvm

# Project Setup Automation
# ------------------------
# Setup PNPM project with TypeScript and ESLint
setup-pnpm-project() {
    # Initialize PNPM project and install development dependencies
    pnpm init
    pnpm install --save-dev \
        eslint \
        @eslint/js \
        typescript \
        typescript-eslint \
        eslint-plugin-prettier \
        eslint-config-prettier \
        prettier \
        @trivago/prettier-plugin-sort-imports

    # Create Prettier configuration with import sorting
    cat > .prettierrc.json << 'EOF'
{
  "trailingComma": "none",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports"]
}
EOF

    # Create ESLint configuration with TypeScript support
    cat > eslint.config.mjs << 'EOF'
// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
);
EOF

    # Initialize TypeScript configuration
    npx tsc --init
}

# Command Execution Monitoring
# ----------------------------
# Post-command notification for long-running commands (ZSH hook equivalent)
preexec_start_time() {
    export CMD_START_TIME=$(date +%s%3N)  # Record start time in milliseconds
}

precmd_notify_long_commands() {
    if [[ -n $CMD_START_TIME ]]; then
        local CMD_DURATION=$(($(date +%s%3N) - $CMD_START_TIME))

        # List of interactive commands that don't need notifications
        local interactive_commands=('nvim' 'v' 'tmux' 't' 'n' 'nnn')
        local last_cmd=$(fc -ln -1 | awk '{print $1}')

        # Check if the last command was interactive
        local is_interactive=false
        for cmd in "${interactive_commands[@]}"; do
            if [[ "$last_cmd" == "$cmd"* ]]; then
                is_interactive=true
                break
            fi
        done

        # Notify if command took longer than 5 seconds and wasn't interactive
        if [[ $CMD_DURATION -gt 5000 && $is_interactive == false ]]; then
            printf '\a'  # Bell sound notification
        fi

        unset CMD_START_TIME
    fi
}

# NOTE: Command monitoring hooks are commented out by default
# Uncomment the following lines to enable long-running command notifications:
add-zsh-hook preexec preexec_start_time
add-zsh-hook precmd precmd_notify_long_commands

# Environment Management
# ----------------------
# Load environment variables from .env file
dotenv() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: dotenv <file>"
        return 1
    fi

    if [[ ! -f "$1" ]]; then
        echo "File not found: $1"
        return 1
    fi

    # Parse .env file and export variables
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue

        # Extract key and value
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            local key="${match[1]}"
            local val="${match[2]}"
            # Remove surrounding quotes
            val="${val%\"}"
            val="${val#\"}"
            export "$key"="$val"
        fi
    done < "$1"
}

# Azure Cloud Functions
# --------------------
# Azure Container App logs viewer
azure_container_logs() {
    # Check if required parameters are provided
    if [[ $# -lt 2 ]]; then
        cat << 'EOF'
Usage: azure_container_logs <workspace_id> <container_group_name> [time_range] [container_name]
  workspace_id: Azure Log Analytics workspace ID
  container_group_name: Name of the Container App
  time_range: Time range for logs (default: 5m). Examples: 5m, 1h, 1d
  container_name: Specific container name (optional)

Example: azure_container_logs myworkspace myapp 10m api
EOF
        return 1
    fi

    local workspace_id="$1"
    local container_group_name="$2"
    local time_range="${3:-5m}"  # Default to 5m if not provided

    # Build the KQL query for Azure Log Analytics
    local query="ContainerAppConsoleLogs_CL"
    query="$query | where ContainerGroupName_s contains \"$container_group_name\""

    # Add container name filter if provided
    if [[ $# -ge 4 ]]; then
        local container_name="$4"
        query="$query | where ContainerName_s == \"$container_name\""
    fi

    query="$query | where time_t >= ago($time_range)"
    query="$query | project time_t, Log_s"
    query="$query | order by time_t desc"

    echo "Executing query:"
    echo "=================="
    echo "$query"
    echo "=================="
    echo ""

    # Execute the query using Azure CLI
    az monitor log-analytics query \
        --workspace "$workspace_id" \
        --analytics-query "$query" \
        --output table
}

# Go Development Tools
# -------------------
# Go test with colorized output
gotest() {
    # Check if go is available
    if ! command -v go >/dev/null 2>&1; then
        echo "Error: go command not found" >&2
        return 1
    fi

    # Run go test with provided arguments and colorize the output
    go test "$@" | sed \
        -e "s/--- PASS:/$(printf "\033[32m✅--- PASS:\033[0m")/g" \
        -e "s/--- FAIL:/$(printf "\033[31m❌--- FAIL:\033[0m")/g" \
        -e "s/^PASS$/$(printf "\033[32mPASS\033[0m")/g" \
        -e "s/^FAIL$/$(printf "\033[31mFAIL\033[0m")/g" \
        -e "s/^FAIL[[:space:]]/$(printf "\033[31mFAIL\033[0m")\t/g" \
        -e "s/^[[:space:]]*ok[[:space:]]/$(printf "\033[32mok\033[0m")\t/g"
}

# AI-Powered Command Generation
# -----------------------------
# Generate and execute bash commands using AI
ai_bash() {
    # Validate required dependencies
    if ! command -v agentcrew >/dev/null 2>&1; then
        echo "❌ Error: agentcrew command not found" >&2
        echo "   Please install agentcrew first" >&2
        return 1
    fi

    if ! command -v gum >/dev/null 2>&1; then
        echo "❌ Error: gum command not found" >&2
        echo "   Install with: brew install gum" >&2
        return 1
    fi

    # Validate prompt argument
    if [[ $# -eq 0 ]]; then
        echo "Usage: ai_bash <prompt request command>" >&2
        echo "Example: ai_bash 'find all python files modified in last 7 days'" >&2
        return 1
    fi

    local prompt="$*"

    echo "🤖 Generating command for: $prompt"
    echo ""

    # Call agentcrew to generate command
    local generated_command
    generated_command=$(agentcrew job \
        --agent="BashAgent" \
        --provider=github_copilot \
        --model-id="gpt-4.1" \
        --output-schema='{"type": "string"}' \
        "$prompt" 2>&1)

    local agentcrew_exit_code=$?

    # Handle agentcrew execution errors
    if [[ $agentcrew_exit_code -ne 0 ]]; then
        echo "❌ Error: Failed to generate command" >&2
        echo "   Exit code: $agentcrew_exit_code" >&2
        echo "   Output: $generated_command" >&2
        return 1
    fi

    # Validate generated command is not empty
    if [[ -z "$generated_command" ]]; then
        echo "❌ Error: Generated command is empty" >&2
        return 1
    fi

    # Display the generated command with syntax highlighting
    echo "📝 Generated command:"
    echo "   $generated_command"
    echo ""

    # Ask user for confirmation using gum
    if gum confirm "Execute this command?" --affirmative="✅ Yes, run it" --negative="❌ No, cancel"; then
        echo ""
        echo "🚀 Executing command..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Execute the command and capture its exit code
        eval "$generated_command"
        local cmd_exit_code=$?

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Report execution status
        if [[ $cmd_exit_code -eq 0 ]]; then
            echo "✅ Command executed successfully"
        else
            echo "⚠️  Command exited with code: $cmd_exit_code" >&2
        fi

        return $cmd_exit_code
    else
        echo ""
        echo "🚫 Command execution cancelled"
        return 0
    fi
}
