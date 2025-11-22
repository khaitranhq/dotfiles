function zellij_session -d "Interactive Zellij session manager using fzf"
    # Validate required dependencies
    if not command -v zellij >/dev/null 2>&1
        echo "❌ Error: zellij command not found" >&2
        echo "   Install with: cargo install zellij" >&2
        return 1
    end

    if not command -v fzf >/dev/null 2>&1
        echo "❌ Error: fzf command not found" >&2
        echo "   Install with: brew install fzf" >&2
        return 1
    end

    # Main action selection
    set -l action (printf "📋 List & Attach to Session\n➕ Create New Session\n🗑️  Delete Session\n❌ Cancel" | \
        fzf --prompt="🚀 Zellij Session Manager > " \
            --height=40% \
            --reverse \
            --border \
            --ansi)

    set -l fzf_exit_code $status

    # Handle user cancellation (ESC key)
    if test $fzf_exit_code -ne 0; or test "$action" = "❌ Cancel"
        echo "🚫 Operation cancelled"
        return 0
    end

    switch "$action"
        case "📋 List & Attach to Session"
            # Get list of active sessions
            set -l sessions (zellij list-sessions --short 2>/dev/null)

            if test -z "$sessions"
                echo "ℹ️  No active Zellij sessions found"
                echo ""

                # Offer to create a new session
                if gum confirm "Would you like to create a new session?" --affirmative="✅ Yes" --negative="❌ No"
                    set -l new_session_name (gum input \
                        --placeholder "Enter session name (or leave empty for default)" \
                        --header="📝 New Session Name" \
                        --char-limit=50)

                    if test -n "$new_session_name"
                        echo "🚀 Creating and attaching to session: $new_session_name"
                        zellij attach --create "$new_session_name"
                    else
                        echo "🚀 Creating new session with default name"
                        zellij
                    end
                end
                return 0
            end

            # Let user select a session
            set -l selected_session (echo "$sessions" | \
                fzf --prompt="Select a session to attach > " \
                    --height=40% \
                    --reverse \
                    --border)

            set -l fzf_exit_code $status

            # Handle user cancellation
            if test $fzf_exit_code -ne 0; or test -z "$selected_session"
                echo "🚫 Operation cancelled"
                return 0
            end

            # Attach to selected session
            echo "🔗 Attaching to session: $selected_session"
            zellij attach "$selected_session"
            exit

        case "➕ Create New Session"
            # Prompt for session name
            set -l session_name (gum input \
                --placeholder "Enter session name (or leave empty for default)" \
                --header="📝 New Session Name" \
                --char-limit=50)

            set -l gum_exit_code $status

            # Handle user cancellation
            if test $gum_exit_code -ne 0
                echo "🚫 Operation cancelled"
                return 0
            end

            # Optionally select a layout
            set -l layout_choice (printf "Default (no layout)\nSpecify layout file/name" | \
                fzf --prompt="Select layout (optional) > " \
                    --height=40% \
                    --reverse \
                    --border)

            if test "$layout_choice" = "Specify layout file/name"
                set -l layout_path (gum input \
                    --placeholder "Enter layout name or path" \
                    --header="📐 Layout Name/Path")

                if test -n "$layout_path"
                    if test -n "$session_name"
                        echo "🚀 Creating session '$session_name' with layout '$layout_path'"
                        zellij --session "$session_name" --layout "$layout_path"
                    else
                        echo "🚀 Creating new session with layout '$layout_path'"
                        zellij --layout "$layout_path"
                    end
                    exit
                end
            end

            # Create session without layout
            if test -n "$session_name"
                echo "🚀 Creating session: $session_name"
                zellij attach --create "$session_name"
            else
                echo "🚀 Creating new session with default name"
                zellij
            end
            exit

        case "🗑️  Delete Session"
            # Get list of active sessions
            set -l sessions (zellij list-sessions --short 2>/dev/null)

            if test -z "$sessions"
                echo "ℹ️  No active Zellij sessions found"
                return 0
            end

            # Let user select session(s) to delete
            echo "⚠️  Select session(s) to delete (use TAB to select multiple, ENTER to confirm)"
            echo ""

            set -l sessions_to_delete (echo "$sessions" | \
                fzf --prompt="Select sessions to delete > " \
                    --multi \
                    --height=40% \
                    --reverse \
                    --border)

            set -l fzf_exit_code $status

            # Handle user cancellation
            if test $fzf_exit_code -ne 0; or test -z "$sessions_to_delete"
                echo "🚫 Operation cancelled"
                return 0
            end

            # Count selected sessions
            set -l session_count (echo "$sessions_to_delete" | wc -l | string trim)

            echo ""
            echo "📋 Sessions to delete ($session_count):"
            echo "$sessions_to_delete" | sed 's/^/  • /'
            echo ""

            # Confirm deletion
            if gum confirm "Are you sure you want to delete these session(s)?" \
                    --affirmative="🗑️  Yes, delete" \
                    --negative="❌ No, cancel"

                echo ""
                set -l delete_count 0
                set -l fail_count 0

                # Delete each selected session
                for session in (string split \n $sessions_to_delete)
                    if test -n "$session"
                        echo "🗑️  Deleting session: $session"
                        if zellij delete-session "$session" 2>/dev/null
                            set delete_count (math $delete_count + 1)
                            echo "   ✅ Deleted successfully"
                        else
                            set fail_count (math $fail_count + 1)
                            echo "   ❌ Failed to delete" >&2
                        end
                    end
                end

                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "📊 Summary: $delete_count deleted, $fail_count failed"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

                if test $fail_count -eq 0
                    return 0
                else
                    return 1
                end
            else
                echo ""
                echo "🚫 Deletion cancelled"
                return 0
            end
    end
end
