function history_search() {
    if ! command -v fzf >/dev/null 2>&1; then
        echo "❌ Error: fzf command not found" >&2
        return 1
    fi

    local current_buffer
    current_buffer="$BUFFER"

    local selected_command
    selected_command=$(fc -rl 1 | fzf \
        --cycle \
        --header="🔍 Search Command History" \
        --layout=reverse \
        --border \
        --height=12 \
        --query="$current_buffer" +s \
        --tac)
    local select_exit_code=$?

    if [[ $select_exit_code -ne 0 || -z "$selected_command" ]]; then
        zle reset-prompt
        return 0
    fi

    # Extract just the command (strip the leading number)
    selected_command=$(echo "$selected_command" | sed 's/^[[:space:]]*[0-9]\+[[:space:]]\+//')
    BUFFER="$selected_command"
    zle end-of-line
}
zle -N history_search
