function tw() {
    local workspace_file="$HOME/.local/share/tmux/workspaces.json"

    if [[ ! -f "$workspace_file" ]]; then
        echo '{}' >"$workspace_file"
    fi

    local workspace_names
    workspace_names=$(yq -r 'keys | .[]' "$workspace_file" 2>/dev/null)

    local options
    options=(${(f)workspace_names})
    options+=("✨ Create new session")

    local selected
    selected=$(print -l $options | gum filter \
        --header="Select a tmux session" \
        --prompt="Session: " \
        --height=20)

    if [[ $? -ne 0 || -z "$selected" ]]; then
        return 0
    fi

    local session_name target_path

    if [[ "$selected" = "✨ Create new session" ]]; then
        session_name=$(gum input --header="Create new tmux session" --prompt="Name: ")
        if [[ $? -ne 0 || -z "$session_name" ]]; then
            return 0
        fi
        session_name="${session_name//./_}"
        target_path=$(pwd)
        yq -i ".[\"$session_name\"] = \"$target_path\"" "$workspace_file"
        echo "✅ Saved workspace '$session_name' → $target_path"
    else
        session_name="$selected"
        target_path=$(yq -r ".[\"$session_name\"]" "$workspace_file" 2>/dev/null)

        if [[ -z "$target_path" || "$target_path" = null ]]; then
            echo "⚠️  Workspace '$session_name' has no path defined."
            return 1
        fi

        if [[ ! -d "$target_path" ]]; then
            echo "⚠️  Workspace path no longer exists: $target_path"
            if gum confirm "Remove this workspace?" --default=false; then
                yq -i "del(.[\"$session_name\"])" "$workspace_file"
                echo "🗑️  Removed workspace '$session_name'"
            fi
            return 1
        fi
    fi

    echo "Selected workspace: $session_name"

    local tmux_name="${session_name//./_}"

    if tmux has-session -t="$tmux_name" 2>/dev/null; then
        if [[ -n "$TMUX" ]]; then
            tmux switch-client -t "$tmux_name"
        else
            tmux attach-session -t "$tmux_name"
        fi
    else
        tmux new-session -d -s "$tmux_name" -c "$target_path" -n v
        tmux send-keys -t "$tmux_name":v nvim Enter
        tmux new-window -t "$tmux_name" -n ai -c "$target_path"
        if [[ "$target_path" == "$HOME/Workspaces/Radicle"* ]]; then
            tmux send-keys -t "$tmux_name":ai 'rpi' Enter
        else
            tmux send-keys -t "$tmux_name":ai 'cpi' Enter
        fi
        tmux select-window -t "$tmux_name":v
        if [[ -n "$TMUX" ]]; then
            tmux switch-client -t "$tmux_name"
        else
            tmux attach-session -t "$tmux_name"
        fi
    fi
}

function td() {
    local workspace_file="$HOME/.local/share/tmux/workspaces.json"

    if [[ ! -f "$workspace_file" ]]; then
        echo '{}' >"$workspace_file"
        echo "📭 No workspaces to delete."
        return 0
    fi

    local workspace_names
    workspace_names=$(yq -r 'keys | .[]' "$workspace_file" 2>/dev/null)

    if [[ -z "$workspace_names" ]]; then
        echo "📭 No workspaces to delete."
        return 0
    fi

    local selected
    selected=$(print -l $workspace_names | gum filter \
        --header="🗑️  Select workspace to DELETE" \
        --prompt="Delete: " \
        --height=20)

    if [[ $? -ne 0 || -z "$selected" ]]; then
        return 0
    fi

    if ! gum confirm "Delete workspace '$selected'?" --default=false; then
        return 0
    fi

    local tmux_name="${selected//./_}"
    if tmux has-session -t="$tmux_name" 2>/dev/null; then
        tmux kill-session -t "$tmux_name"
        echo "💀 Killed tmux session: $selected"
    else
        echo "⚠️  No tmux session named '$selected' found."
    fi

    yq -i "del(.[\"$selected\"])" "$workspace_file"
    echo "🗑️  Removed workspace '$selected'"
}

function pick_files() {
    local pane_id="$1"
    local pane_dir
    pane_dir=$(tmux display-message -t "$pane_id" -p '#{pane_current_path}')

    cd "$pane_dir" || return 1

    local git_root
    git_root=$(git rev-parse --show-toplevel 2>/dev/null)

    if [[ -z "$git_root" ]]; then
        git_root="$pane_dir"
    fi

    local fzf_output
    fzf_output=$(rg --files --no-ignore --hidden \
        | fzf --multi \
            --cycle \
            --reverse \
            --prompt="Select files: " \
            --preview 'bat --style=numbers --color=always {} 2>/dev/null || cat {}' \
            --preview-window=right:60%)

    if [[ $? -ne 0 ]]; then
        return 0
    fi

    local relative_paths=()
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            local relative_path
            relative_path=$(realpath --relative-to="$git_root" "$pane_dir/$file" 2>/dev/null)
            if [[ -n "$relative_path" ]]; then
                relative_paths+=("$relative_path")
            fi
        fi
    done <<< "$fzf_output"

    if [[ ${#relative_paths[@]} -gt 0 ]]; then
        local files_oneline="${relative_paths[*]}"
        tmux send-keys -t "$pane_id" "$files_oneline"
    fi
}
