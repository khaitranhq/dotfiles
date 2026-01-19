function gum_filter_history_search -d "Interactive history search using gum filter"
    # Validate required dependencies
    if not command -v gum >/dev/null 2>&1
        echo "❌ Error: gum command not found" >&2
    end

    # Get command history
    set -l history_commands (history)
    if test -z "$history_commands"
        echo "No command history found."
        return 0
    end

    # Use gum filter for interactive selection
    set -l selected_command (printf '%s\n' $history_commands | gum filter --header="🔍 Search Command History" --height=12 --limit=1)
    set -l select_exit_code $status
    if test $select_exit_code -ne 0; or test -z "$selected_command"
        commandline -f repaint
        return 0
    end

    commandline --replace -- $selected_command
end
