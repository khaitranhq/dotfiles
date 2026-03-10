function zellij_session -d "Interactive Zellij session manager"
    if not command -v zellij >/dev/null 2>&1
        echo "❌ Error: zellij command not found" >&2
        echo "   Install with: cargo install zellij" >&2
        return 1
    end

    if not command -v gum >/dev/null 2>&1
        echo "❌ Error: gum command not found" >&2
        echo "   Install with: brew install gum # or see https://github.com/charmbracelet/gum" >&2
        return 1
    end

    set -l sessions "$(zellij list-sessions --short 2>/dev/null)"
    set sessions "$sessions
✨ Create a new session"

    set -l selection (echo -e "$sessions" | gum filter --header="🚀 Zellij Session Manager" --prompt="> " --height=24)

    set -l select_exit_code $status

    if test $select_exit_code -ne 0; or test -z "$selection"
        echo "🚫 Operation cancelled"
        return 0
    end

    if test "$selection" = "✨ Create a new session"
        set -l session_name (gum input --prompt="📝 New Session Name: " --placeholder="Leave empty for default")

        if test -n "$session_name"
            echo "🚀 Creating session: $session_name"
            zellij attach --create "$session_name"
        else
            echo "🚀 Creating new session with default name"
            zellij
        end
    else
        echo "🔗 Attaching to session: $selection"
        zellij attach "$selection"
    end
end

function zellij_delete_session -d "Delete Zellij sessions interactively"
    if not command -v zellij >/dev/null 2>&1
        echo "❌ Error: zellij command not found" >&2
        echo "   Install with: cargo install zellij" >&2
        return 1
    end

    if not command -v gum >/dev/null 2>&1
        echo "❌ Error: gum command not found" >&2
        echo "   Install with: brew install gum # or see https://github.com/charmbracelet/gum" >&2
        return 1
    end

    set -l sessions "$(zellij list-sessions --short 2>/dev/null)"

    if test -z "$sessions"
        echo "ℹ️  No Zellij sessions found"
        return 0
    end

    set -l selection (echo -e "$sessions" | gum filter --header="🗑️  Select Zellij Session(s) to Delete" --prompt="Filter sessions... " --height=24 --no-limit)

    set -l select_exit_code $status

    if test $select_exit_code -ne 0; or test -z "$selection"
        echo "🚫 Operation cancelled"
        return 0
    end

    set -l sessions_to_delete (string split \n "$selection")

    echo ""
    echo "📋 Sessions to delete:"
    for session in $sessions_to_delete
        echo "   • $session"
    end
    echo ""

    set -l _confirm (gum input --prompt=(printf "Delete %d session(s)? [y/N] " (count $sessions_to_delete)))
    if test "$_confirm" != "y" -a "$_confirm" != "Y"
        echo "🚫 Deletion cancelled"
        return 0
    end

    set -l deleted_count 0
    set -l failed_count 0

    for session in $sessions_to_delete
        echo "🗑️  Deleting session: $session"
        if zellij delete-session --force "$session" 2>/dev/null
            set deleted_count (math $deleted_count + 1)
            echo "✅ Deleted: $session"
        else
            set failed_count (math $failed_count + 1)
            echo "❌ Failed to delete: $session" >&2
        end
    end

    echo ""
    echo "📊 Summary: $deleted_count deleted, $failed_count failed"

    if test $failed_count -gt 0
        return 1
    else
        return 0
    end
end
