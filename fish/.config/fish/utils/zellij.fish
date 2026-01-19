function zellij_session -d "Interactive Zellij session manager"
    # Validate required dependencies
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

    # Get list of active sessions
    set -l sessions "$(zellij list-sessions --short 2>/dev/null)"
    set sessions "$sessions\n✨ Create a new session"

    set -l selection "$(echo -e "$sessions" | \
        gum filter \
            --header="🚀 Zellij Session Manager" \
            --height=12 \
            --limit=1)"

    set -l select_exit_code $status

    # Handle user cancellation (ESC key)
    if test $select_exit_code -ne 0; or test -z "$selection"
        echo "🚫 Operation cancelled"
        return 0
    end

    # Check if user selected create new session
    if test "$selection" = "✨ Create a new session"
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
            gum filter \
                --header="Select layout (optional)" \
                --prompt="> " \
                --height=6 \
                --limit=1)
        set -l layout_exit_code $status
        if test $layout_exit_code -ne 0; or test -z "$layout_choice"
            echo "🚫 Operation cancelled"
            return 0
        end

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
    else
        # User selected an existing session - attach to it
        echo "🔗 Attaching to session: $selection"
        zellij attach "$selection"
        exit
    end
end

