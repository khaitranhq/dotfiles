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
            powershell_path='/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
            "$powershell_path" -NoProfile -Command "
                  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > \$null
                  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > \$null

                  \$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
                  \$toastXml = @'
<toast>
<visual>
  <binding template=\"ToastText02\">
    <text id=\"1\">Zsh - Command Complete</text>
    <text id=\"2\"></text>
    <text id=\"3\"></text>
  </binding>
</visual>
</toast>
'@
                  \$xml.LoadXml(\$toastXml)

                  \$xml.SelectSingleNode('//text[@id=\"2\"]').InnerText = 'Command: $sanitized_command'
                  \$xml.SelectSingleNode('//text[@id=\"3\"]').InnerText = 'Duration: $elapsed seconds | Exit: $exit_status'

                  \$toast = New-Object Windows.UI.Notifications.ToastNotification \$xml
                  \$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Zsh')
                  \$notifier.Show(\$toast)
              "
        fi
    fi
    unset __cmd_start __cmd_line
}
add-zsh-hook preexec __preexec_notify_start
add-zsh-hook precmd __precmd_notify_on_long_running
