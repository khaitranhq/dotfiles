# =============================================================================
# ZSH Custom Functions
# =============================================================================
# Functions ported from Fish shell and custom utilities

# =============================================================================
# FILE SELECTION AND TMUX INTEGRATION
# =============================================================================
# Pick files with fzf and send to tmux pane
pick_files() {
  local pane_dir=$(tmux display-message -p '#{pane_current_path}')
  local pane_id=$(tmux display-message -p '#{pane_id}')

  cd "$pane_dir" || return 1

  local git_root=$(git rev-parse --show-toplevel 2>/dev/null)

  # If not in a git repo, use current directory
  if [[ -z "$git_root" ]]; then
    git_root="$pane_dir"
  fi

  # Determine realpath command based on OS (macOS compatibility)
  local realpath_cmd="realpath"

  # Use fd and fzf to select files, then make paths relative to git root
  local fzf_output
  fzf_output=$(
    rg --files --no-ignore --hidden \
      --glob '!.git/**' \
      --glob '!node_modules/**' \
      --glob '!dist/**' \
      --glob '!.venv/**' \
      --glob '!venv/**' \
      --glob '!.mypy_cache/**' \
      --glob '!.aider*/**' \
      --glob '!cdk.out/**' \
      --glob '!.vagrant/**' \
      --glob '!build/**' \
      --glob '!.chat_histories/**' \
      --glob '!.ruff_cache/**' \
      --ignore-file '.rgignore' \
      --follow |
      fzf --multi \
        --reverse \
        --prompt="Select files: " \
        --preview 'bat --style=numbers --color=always {} 2>/dev/null || cat {}' \
        --preview-window=right:60%
  )

  local fzf_exit_code=$?

  # Check if user cancelled (ESC or Ctrl+C)
  if [[ $fzf_exit_code -ne 0 ]]; then
    return 0
  fi

  # Process selected files
  local selected_files=()
  while IFS= read -r file; do
    if [[ -n "$file" ]]; then
      # Make path relative to git root
      local relative_path=$($realpath_cmd --relative-to="$git_root" "$pane_dir/$file" 2>/dev/null)
      if [[ -n "$relative_path" ]]; then
        selected_files+=("$relative_path")
      fi
    fi
  done <<<"$fzf_output"

  # Send selected files to tmux pane
  if [[ ${#selected_files[@]} -gt 0 ]]; then
    local files_oneline="${selected_files[*]}"
    tmux send-keys -t "$pane_id" "$files_oneline"
  fi
}

# =============================================================================
# NODE.JS VERSION MANAGEMENT
# =============================================================================
# Auto-switch Node version based on .nvmrc (optimized for lazy-loaded NVM)
chpwd_check_nvm() {
  if [[ -f .nvmrc ]]; then
    # Trigger NVM lazy load by calling nvm
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

# =============================================================================
# PROJECT SETUP AUTOMATION
# =============================================================================
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
  cat >.prettierrc.json <<'EOF'
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
  cat >eslint.config.mjs <<'EOF'
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

# =============================================================================
# COMMAND EXECUTION MONITORING
# =============================================================================
# Post-command notification for long-running commands (ZSH hook equivalent)
preexec_start_time() {
  export CMD_START_TIME=$(date +%s%3N) # Record start time in milliseconds
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
      printf '\a' # Bell sound notification
    fi

    unset CMD_START_TIME
  fi
}

add-zsh-hook preexec preexec_start_time
add-zsh-hook precmd precmd_notify_long_commands

# =============================================================================
# ENVIRONMENT MANAGEMENT
# =============================================================================
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
  done <"$1"
}

# =============================================================================
# AZURE CLOUD FUNCTIONS
# =============================================================================
# Azure Container App logs viewer
azure_container_logs() {
  # Check if required parameters are provided
  if [[ $# -lt 2 ]]; then
    cat <<'EOF'
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
  local time_range="${3:-5m}" # Default to 5m if not provided

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

# =============================================================================
# GO DEVELOPMENT TOOLS
# =============================================================================
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

# =============================================================================
# ZELLIJ SESSION MANAGEMENT
# =============================================================================
# Interactive Zellij session manager using fzf
zellij_session() {
  # Validate required dependencies
  if ! command -v zellij >/dev/null 2>&1; then
    echo "❌ Error: zellij command not found" >&2
    echo "   Install with: cargo install zellij" >&2
    return 1
  fi

  if ! command -v fzf >/dev/null 2>&1; then
    echo "❌ Error: fzf command not found" >&2
    echo "   Install with: brew install fzf" >&2
    return 1
  fi

  # Main action selection
  local action
  action=$(printf "📋 List & Attach to Session\n➕ Create New Session\n🗑️  Delete Session\n❌ Cancel" |
    fzf --prompt="🚀 Zellij Session Manager > " \
      --height=40% \
      --reverse \
      --border \
      --ansi)

  local fzf_exit_code=$?

  # Handle user cancellation (ESC key)
  if [[ $fzf_exit_code -ne 0 ]] || [[ "$action" == "❌ Cancel" ]]; then
    echo "🚫 Operation cancelled"
    return 0
  fi

  case "$action" in
  "📋 List & Attach to Session")
    # Get list of active sessions
    local sessions
    sessions=$(zellij list-sessions --short 2>/dev/null)

    if [[ -z "$sessions" ]]; then
      echo "ℹ️  No active Zellij sessions found"
      echo ""

      # Offer to create a new session
      if gum confirm "Would you like to create a new session?" --affirmative="✅ Yes" --negative="❌ No"; then
        local new_session_name
        new_session_name=$(gum input \
          --placeholder "Enter session name (or leave empty for default)" \
          --header="📝 New Session Name" \
          --char-limit=50)

        if [[ -n "$new_session_name" ]]; then
          echo "🚀 Creating and attaching to session: $new_session_name"
          zellij attach --create "$new_session_name"
        else
          echo "🚀 Creating new session with default name"
          zellij
        fi
      fi
      return 0
    fi

    # Let user select a session
    local selected_session
    selected_session=$(echo "$sessions" |
      fzf --prompt="Select a session to attach > " \
        --height=40% \
        --reverse \
        --border)

    local fzf_exit_code=$?

    # Handle user cancellation
    if [[ $fzf_exit_code -ne 0 ]] || [[ -z "$selected_session" ]]; then
      echo "🚫 Operation cancelled"
      return 0
    fi

    # Attach to selected session
    echo "🔗 Attaching to session: $selected_session"
    zellij attach "$selected_session"
    ;;

  "➕ Create New Session")
    # Prompt for session name
    local session_name
    session_name=$(gum input \
      --placeholder "Enter session name (or leave empty for default)" \
      --header="📝 New Session Name" \
      --char-limit=50)

    local gum_exit_code=$?

    # Handle user cancellation
    if [[ $gum_exit_code -ne 0 ]]; then
      echo "🚫 Operation cancelled"
      return 0
    fi

    # Optionally select a layout
    local layout_choice
    layout_choice=$(printf "Default (no layout)\nSpecify layout file/name" |
      fzf --prompt="Select layout (optional) > " \
        --height=40% \
        --reverse \
        --border)

    if [[ "$layout_choice" == "Specify layout file/name" ]]; then
      local layout_path
      layout_path=$(gum input \
        --placeholder "Enter layout name or path" \
        --header="📐 Layout Name/Path")

      if [[ -n "$layout_path" ]]; then
        if [[ -n "$session_name" ]]; then
          echo "🚀 Creating session '$session_name' with layout '$layout_path'"
          zellij --session "$session_name" --layout "$layout_path"
        else
          echo "🚀 Creating new session with layout '$layout_path'"
          zellij --layout "$layout_path"
        fi
        return 0
      fi
    fi

    # Create session without layout
    if [[ -n "$session_name" ]]; then
      echo "🚀 Creating session: $session_name"
      zellij attach --create "$session_name"
    else
      echo "🚀 Creating new session with default name"
      zellij
    fi
    ;;

  "🗑️  Delete Session")
    # Get list of active sessions
    local sessions
    sessions=$(zellij list-sessions --short 2>/dev/null)

    if [[ -z "$sessions" ]]; then
      echo "ℹ️  No active Zellij sessions found"
      return 0
    fi

    # Let user select session(s) to delete
    echo "⚠️  Select session(s) to delete (use TAB to select multiple, ENTER to confirm)"
    echo ""

    local sessions_to_delete
    sessions_to_delete=$(echo "$sessions" |
      fzf --prompt="Select sessions to delete > " \
        --multi \
        --height=40% \
        --reverse \
        --border)

    local fzf_exit_code=$?

    # Handle user cancellation
    if [[ $fzf_exit_code -ne 0 ]] || [[ -z "$sessions_to_delete" ]]; then
      echo "🚫 Operation cancelled"
      return 0
    fi

    # Count selected sessions
    local session_count
    session_count=$(echo "$sessions_to_delete" | wc -l | tr -d ' ')

    echo ""
    echo "📋 Sessions to delete ($session_count):"
    echo "$sessions_to_delete" | sed 's/^/  • /'
    echo ""

    # Confirm deletion
    if gum confirm "Are you sure you want to delete these session(s)?" \
      --affirmative="🗑️  Yes, delete" \
      --negative="❌ No, cancel"; then

      echo ""
      local delete_count=0
      local fail_count=0

      # Delete each selected session
      while IFS= read -r session; do
        if [[ -n "$session" ]]; then
          echo "🗑️  Deleting session: $session"
          if zellij delete-session "$session" 2>/dev/null; then
            ((delete_count++))
            echo "   ✅ Deleted successfully"
          else
            ((fail_count++))
            echo "   ❌ Failed to delete" >&2
          fi
        fi
      done <<<"$sessions_to_delete"

      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "📊 Summary: $delete_count deleted, $fail_count failed"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

      return $([[ $fail_count -eq 0 ]] && echo 0 || echo 1)
    else
      echo ""
      echo "🚫 Deletion cancelled"
      return 0
    fi
    ;;
  esac
}

# Alias for convenience
alias zj='zellij_session'

# =============================================================================
# AI-POWERED COMMAND GENERATION
# =============================================================================
# Generate git commit message from staged changes using AI
ai_commit() {
  # Validate required dependencies
  if ! command -v agentcrew >/dev/null 2>&1; then
    echo "❌ Error: agentcrew command not found" >&2
    echo "   Please install agentcrew first" >&2
    return 1
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "❌ Error: git command not found" >&2
    return 1
  fi

  # Check if we're in a git repository
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "❌ Error: Not in a git repository" >&2
    return 1
  fi

  # Get staged diff
  local diff_content
  diff_content=$(git diff --staged)

  # Validate that there are staged changes
  if [[ -z "$diff_content" ]]; then
    echo "❌ Error: No staged changes found" >&2
    echo "   Use 'git add' to stage files first" >&2
    return 1
  fi

  echo "🤖 Generating commit message from staged changes..."
  echo ""

  # Generate commit message using agentcrew
  # Use printf %q to properly escape the diff content for shell
  local generated_message
  generated_message=$(agentcrew job \
    --agent="CommitMessageGenerator" \
    --agent-config='https://raw.githubusercontent.com/saigontechnology/AgentCrew/refs/heads/main/examples/agents/jobs/commit-message-generator.toml' \
    --provider=openai \
    --model-id="gpt-4.1-mini" \
    "$diff_content" 2>&1)

  local agentcrew_exit_code=$?

  # Handle agentcrew execution errors
  if [[ $agentcrew_exit_code -ne 0 ]]; then
    echo "❌ Error: Failed to generate commit message" >&2
    echo "   Exit code: $agentcrew_exit_code" >&2
    echo "   Output: $generated_message" >&2
    return 1
  fi

  # Validate generated message is not empty
  if [[ -z "$generated_message" ]]; then
    echo "❌ Error: Generated commit message is empty" >&2
    return 1
  fi

  # Strip surrounding quotes and whitespace from JSON output
  generated_message=$(echo "$generated_message" | sed 's/^["'\''[:space:]]*//;s/["'\''[:space:]]*$//')

  # Display the generated commit message
  echo "📝 Generated commit message:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$generated_message"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "🚀 Committing changes..."

  # Commit using the generated message
  # Use -m flag to pass message directly (safer than using heredoc or temp files)
  local commit_exit_code=0
  if git commit -m "$generated_message"; then
    echo "✅ Successfully committed changes"
  else
    echo "❌ Error: git commit failed" >&2
    commit_exit_code=1
  fi

  echo ""
  echo "Press q to exit"

  # Wait for user to press 'q'
  while true; do
    read -sk 1 key
    if [[ "$key" == "q" ]]; then
      break
    fi
  done

  return $commit_exit_code
}

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
    --agent-config "https://raw.githubusercontent.com/khaitranhq/dotfiles/refs/heads/windows-wsl/AgentCrew/.AgentCrew/job-agents/BashAgent.toml" \
    --provider=github_copilot \
    --model-id="gpt-4.1" \
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

  # Strip surrounding quotes from JSON output
  generated_command=$(echo "$generated_command" | sed 's/^["'\''[:space:]]*//;s/["'\''[:space:]]*$//')

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
    # Use zsh -c to properly parse the command with redirects and pipes
    zsh -c "$generated_command"
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

# Generate code snippets using AI
code_snip() {
  # Validate required dependencies
  if ! command -v agentcrew >/dev/null 2>&1; then
    echo "❌ Error: agentcrew command not found" >&2
    echo "   Please install agentcrew first" >&2
    return 1
  fi

  # Validate prompt argument
  if [[ $# -eq 0 ]]; then
    echo "Usage: code_snip <code snippet request>" >&2
    echo "Example: code_snip 'python function to parse JSON file'" >&2
    return 1
  fi

  local prompt="$*"

  echo "🤖 Generating code snippet for: $prompt"
  echo ""

  # Call agentcrew to generate code snippet
  local generated_snippet
  generated_snippet=$(agentcrew job \
    --agent="CodeSnipper" \
    --agent-config "https://raw.githubusercontent.com/khaitranhq/dotfiles/refs/heads/windows-wsl/AgentCrew/.AgentCrew/job-agents/CodeSnipper.toml" \
    --provider=github_copilot \
    --model-id="claude-sonnet-4.5" \
    "$prompt" 2>&1)

  local agentcrew_exit_code=$?

  # Handle agentcrew execution errors
  if [[ $agentcrew_exit_code -ne 0 ]]; then
    echo "❌ Error: Failed to generate code snippet" >&2
    echo "   Exit code: $agentcrew_exit_code" >&2
    echo "   Output: $generated_snippet" >&2
    return 1
  fi

  # Validate generated snippet is not empty
  if [[ -z "$generated_snippet" ]]; then
    echo "❌ Error: Generated code snippet is empty" >&2
    return 1
  fi

  # Display the generated snippet
  echo "📝 Generated code snippet:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$generated_snippet"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  return 0
}
