export KUBE_EDITOR=nvim
export KUBECONFIG="$HOME/.config/kubectl/config.yaml"
export VISUAL=nvim
export EDITOR=nvim
export fpath=($HOME/.zsh/zsh-completions/src $fpath)
export HISTFILE="$HOME/.zsh_history"
export HISTSIZE=10000
export SAVEHIST=10000
setopt appendhistory

eval "$(oh-my-posh init zsh --config '/home/lewis/.config/ohmyposh/tokyonigh.omp.json')"
source $HOME/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh
source $HOME/.zsh/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
eval "$(zoxide init zsh)"
autoload bashcompinit && bashcompinit
autoload -Uz compinit && compinit
complete -C '/usr/local/bin/aws_completer' aws
source <(fzf --zsh)

alias v="nvim"
alias l='eza -lah --icons'
alias ls='eza -lah --icons --total-size'
alias cat="bat -p"
alias ld='lazydocker'
alias lg='lazygit'
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"
alias t="tmux"
alias au="~/.config/fish/aws-utils.fish"
alias ssh='ssh.exe'
alias ssh-add='ssh-add.exe'
alias scp='scp.exe'
alias sftp='sftp.exe'
alias qq="exit"
alias k='kubectl'
alias kx='kubectx'
alias p='pulumi'

if [ -f $HOME/.zsh/ai.zsh ]; then
  source $HOME/.zsh/ai.zsh
fi

# Functions ported from Fish shell
# =================================
# Pick files with fzf and send to tmux pane
pick_files() {
    local pane_dir=$(tmux display-message -p '#{pane_current_path}')
    local pane_id=$(tmux display-message -p '#{pane_id}')

    cd "$pane_dir" || exit
    local git_root=$(git rev-parse --show-toplevel)

    # Determine realpath command based on OS
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

    if [[ ${#selected_files[@]} -gt 0 ]]; then
        local files_oneline="${selected_files[*]}"
        tmux send-keys -t "$pane_id" "$files_oneline"
    fi
}

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

# Setup PNPM project with TypeScript and ESLint
setup-pnpm-project() {
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

    npx tsc --init
}

# Post-command notification for long-running commands (ZSH hook equivalent)
preexec_start_time() {
    export CMD_START_TIME=$(date +%s%3N)  # milliseconds
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
            printf '\a'  # Bell sound
        fi

        unset CMD_START_TIME
    fi
}

# # Add hooks for pre/post command execution
# add-zsh-hook preexec preexec_start_time
# add-zsh-hook precmd precmd_notify_long_commands

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

    # Build the KQL query
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

# --WCGW_ENVIRONMENT_START--
if [ -n "$IN_WCGW_ENVIRONMENT" ]; then
 PROMPT_COMMAND='printf "◉ $(pwd)──➤ \r\e[2K"'
 prmptcmdwcgw() { eval "$PROMPT_COMMAND" }
 add-zsh-hook -d precmd prmptcmdwcgw
 precmd_functions+=prmptcmdwcgw
fi
# --WCGW_ENVIRONMENT_END--
