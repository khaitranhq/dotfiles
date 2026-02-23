function history_search -d "Interactive history search using fzf"
    # Ensure fzf is available
    if not command -v fzf >/dev/null 2>&1
        echo "❌ Error: fzf command not found" >&2
        return 1
    end

    # Collect history and bail out if empty
    set -l history_commands (history)
    if test -z "$history_commands"
        echo "No command history found."
        return 0
    end

    # Use current commandline as initial query
    set -l current_buffer (commandline)

    # Use fzf for interactive selection
    # --layout=reverse places the prompt on top, +s disables sorting so input order is preserved
    set -l selected_command (\
      printf '%s\n' $history_commands | \
      fzf \
        --header="🔍 Search Command History" \
        --layout=reverse \
        --border \
        --height=12 \
        --query="$current_buffer" +s \
    )
    set -l select_exit_code $status
    if test $select_exit_code -ne 0; or test -z "$selected_command"
        commandline -f repaint
        return 0
    end

    commandline --replace -- $selected_command
end
