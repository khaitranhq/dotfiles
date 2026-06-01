function tw -d "Select or create a tmux workspace from saved list"
    set -l workspace_file "$HOME/.local/share/tmux/workspaces.json"

    # Ensure file exists
    if not test -f "$workspace_file"
        echo '{}' >"$workspace_file"
    end

    # Read saved workspace names
    set -l workspace_names (yq -r 'keys | .[]' "$workspace_file" 2>/dev/null)

    # Fuzzy-filter workspaces; --no-strict returns typed text when no match
    set -l selected (printf '%s\n' $workspace_names | gum filter \
        --header="📂 Filter workspace or type new name" \
        --placeholder="Search or create..." \
        --no-strict)

    if test $status -ne 0; or test -z "$selected"
        return 0
    end
    echo "Selected workspace: $selected"

    # ── Resolve: existing workspace or new ──
    set -l target_path (yq -r ".[\"$selected\"]" "$workspace_file" 2>/dev/null)
    set -l session_name

    if test -z "$target_path"; or test "$target_path" = null
        # ── New workspace ──
        set -l cwd (pwd)
        yq -i ".[\"$selected\"] = \"$cwd\"" "$workspace_file"
        echo "✅ Saved workspace '$selected' → $cwd"
        set session_name $selected
        set target_path $cwd
    else
        # ── Existing workspace ──
        set session_name $selected

        if not test -d "$target_path"
            echo "⚠️  Workspace path no longer exists: $target_path"
            if gum confirm "Remove this workspace?" --default=false
                yq -i "del(.[\"$selected\"])" "$workspace_file"
                echo "🗑️  Removed workspace '$selected'"
            end
            return 1
        end
    end

    # ── Attach or create tmux session ──
    if tmux has-session -t "$session_name" 2>/dev/null
        if set -q TMUX
            tmux switch-client -t "$session_name"
        else
            tmux attach-session -t "$session_name"
        end
    else
        tmux new-session -d -s "$session_name" -c "$target_path" -n v
        tmux new-window -t "$session_name" -c "$target_path" -n ai
        tmux select-window -t "$session_name":v
        if set -q TMUX
            tmux switch-client -t "$session_name"
        else
            tmux attach-session -t "$session_name"
        end
    end
end
