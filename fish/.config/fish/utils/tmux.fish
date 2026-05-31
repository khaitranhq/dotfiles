function ta -d "Interactive tmux session selector using fzf"
    # Ensure fzf is available
    if not command -v fzf >/dev/null 2>&1
        echo "❌ Error: fzf command not found" >&2
        return 1
    end

    # Check if tmux server is running
    if not tmux has-session 2>/dev/null
        echo "No tmux server running. Starting a new session..."
        tmux new-session -A -s main
        return $status
    end

    # List sessions with format: session_name
    set -l sessions (tmux list-sessions -F "#{session_name}")
    if test -z "$sessions"
        echo "No tmux sessions found."
        return 1
    end

    # Auto-select if only one session
    set -l session_count (count $sessions)
    if test $session_count -eq 1
        set -l selected $sessions[1]
    else
        set -l selected (printf '%s\n' $sessions | fzf \
            --header="🎯 Select tmux session to attach" \
            --layout=reverse \
            --border \
            --height=12 \
            +s)

        set -l select_exit_code $status
        if test $select_exit_code -ne 0; or test -z "$selected"
            return 0
        end
    end

    # If already inside tmux, switch client; otherwise attach
    if set -q TMUX
        tmux switch-client -t "$selected"
    else
        tmux attach-session -t "$selected"
    end
end
