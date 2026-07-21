autoload -Uz add-zsh-hook

function add-keys-ssh-agent() {
    if ! ssh-add -l >/dev/null 2>&1; then
        local BW_SESSION
        BW_SESSION=$(bw unlock --raw)
        export BW_SESSION

        local FOLDER_ID
        FOLDER_ID=$(bw list folders --search "SSH keys" | yq -r '.[0].id')

        bw list items --folderid "$FOLDER_ID" | yq -r '.[].sshKey.privateKey | @base64' | while read -r b64; do
            printf '%s' "$b64" | base64 -d | ssh-add -
        done

        unset BW_SESSION
    fi
}

# Notify on long-running commands
__preexec_notify_start() {
    __cmd_start=$SECONDS
    __cmd_line="$1"
}

__precmd_notify_on_long_running() {
    local exit_status=$?
    local interactive_commands=(nvim v tmux t n nnn zj oc opencode sqlit lazygit)

    for cmd in "${interactive_commands[@]}"; do
        if [[ "${__cmd_line}" == "$cmd"* ]]; then
            return
        fi
    done

    if [[ -n "$__cmd_start" ]]; then
        local elapsed=$((SECONDS - __cmd_start))
        if [[ $elapsed -gt 5 ]]; then
            local sanitized_command="${__cmd_line//\'/}"
            notify-send "Zsh - Command Complete" "Command: $sanitized_command\nDuration: $elapsed seconds | Exit: $exit_status" --hint=string:sound-name:complete
        fi
    fi
    unset __cmd_start __cmd_line
}
add-zsh-hook preexec __preexec_notify_start
add-zsh-hook precmd __precmd_notify_on_long_running
