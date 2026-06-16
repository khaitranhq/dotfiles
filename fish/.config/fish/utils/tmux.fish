function tw -d "Select or create a tmux workspace from saved list"
    set -l workspace_file "$HOME/.local/share/tmux/workspaces.json"

    # Ensure file exists
    if not test -f "$workspace_file"
        echo '{}' >"$workspace_file"
    end

    # Read saved workspace names
    set -l workspace_names (yq -r 'keys | .[]' "$workspace_file" 2>/dev/null)

    # Build selection list: existing sessions + "Create new session" option
    set -l options $workspace_names
    set -a options "✨ Create new session"

    # Select session with gum filter
    set -l selected (printf '%s\n' $options | gum filter \
        --header="Select a tmux session" \
        --prompt="Session: " \
        --height=20)

    if test $status -ne 0; or test -z "$selected"
        return 0
    end

    set -l session_name
    set -l target_path

    if test "$selected" = "✨ Create new session"
        # ── Create new session via gum input ──
        set session_name (gum input --header="Create new tmux session" --prompt="Name: ")
        if test $status -ne 0; or test -z "$session_name"
            return 0
        end
        set target_path (pwd)
        yq -i ".[\"$session_name\"] = \"$target_path\"" "$workspace_file"
        echo "✅ Saved workspace '$session_name' → $target_path"
    else
        # ── Existing workspace ──
        set session_name "$selected"
        set target_path (yq -r ".[\"$session_name\"]" "$workspace_file" 2>/dev/null)

        if test -z "$target_path"; or test "$target_path" = null
            echo "⚠️  Workspace '$session_name' has no path defined."
            return 1
        end

        if not test -d "$target_path"
            echo "⚠️  Workspace path no longer exists: $target_path"
            if gum confirm "Remove this workspace?" --default=false
                yq -i "del(.[\"$session_name\"])" "$workspace_file"
                echo "🗑️  Removed workspace '$session_name'"
            end
            return 1
        end
    end

    echo "Selected workspace: $session_name"

    # ── Attach or create tmux session ──
    if tmux has-session -t="$session_name" 2>/dev/null
        if set -q TMUX
            tmux switch-client -t "$session_name"
        else
            tmux attach-session -t "$session_name"
        end
    else
        tmux new-session -d -s "$session_name" -c "$target_path" -n v
        tmux send-keys -t "$session_name":v nvim Enter
        tmux new-window -t "$session_name" -n ai -c "$target_path"
        if string match -q "$HOME/Workspaces/Radicle*" "$target_path"
            tmux send-keys -t "$session_name":ai c Enter
        else
            tmux send-keys -t "$session_name":ai cpi Enter
        end
        tmux select-window -t "$session_name":v
        if set -q TMUX
            tmux switch-client -t "$session_name"
        else
            tmux attach-session -t "$session_name"
        end
    end
end

function td -d "Delete a tmux workspace (kill session + remove from workspace list)"
    set -l workspace_file "$HOME/.local/share/tmux/workspaces.json"

    # Ensure file exists
    if not test -f "$workspace_file"
        echo '{}' >"$workspace_file"
        echo "📭 No workspaces to delete."
        return 0
    end

    # Read saved workspace names
    set -l workspace_names (yq -r 'keys | .[]' "$workspace_file" 2>/dev/null)

    if test -z "$workspace_names"
        echo "📭 No workspaces to delete."
        return 0
    end

    # Select workspace to delete with gum filter
    set -l selected (printf '%s\n' $workspace_names | gum filter \
        --header="🗑️  Select workspace to DELETE" \
        --prompt="Delete: " \
        --height=20)

    if test $status -ne 0; or test -z "$selected"
        return 0
    end

    # Confirm deletion
    if not gum confirm "Delete workspace '$selected'?" --default=false
        return 0
    end

    # Kill tmux session if it exists
    if tmux has-session -t="$selected" 2>/dev/null
        tmux kill-session -t "$selected"
        echo "💀 Killed tmux session: $selected"
    else
        echo "⚠️  No tmux session named '$selected' found."
    end

    # Remove workspace from JSON
    yq -i "del(.[\"$selected\"])" "$workspace_file"
    echo "🗑️  Removed workspace '$selected'"
end

function pick_files -d "Pick files with fzf and send to tmux pane"
    set -l pane_dir (tmux display-message -p '#{pane_current_path}')
    set -l pane_id (tmux display-message -p '#{pane_id}')

    cd "$pane_dir"; or return 1

    set -l git_root (git rev-parse --show-toplevel 2>/dev/null)

    # If not in a git repo, use current directory
    if test -z "$git_root"
        set git_root "$pane_dir"
    end

    # Use rg and fzf to select files, then make paths relative to git root
    set -l fzf_output (rg --files --no-ignore --hidden \
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
        --follow \
        | fzf --multi \
            --reverse \
            --prompt="Select files: " \
            --preview 'bat --style=numbers --color=always {} 2>/dev/null || cat {}' \
            --preview-window=right:60%)

    # Check if user cancelled (ESC or Ctrl+C)
    if test $status -ne 0
        return 0
    end

    # Process selected files
    set -l relative_paths
    for file in (printf '%s\n' $fzf_output)
        if test -n "$file"
            set -l relative_path (realpath --relative-to="$git_root" "$pane_dir/$file" 2>/dev/null)
            if test -n "$relative_path"
                set -a relative_paths "$relative_path"
            end
        end
    end

    # Send selected files to tmux pane
    if test (count $relative_paths) -gt 0
        set -l files_oneline (string join " " $relative_paths)
        tmux send-keys -t "$pane_id" "$files_oneline"
    end
end
