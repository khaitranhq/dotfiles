function __check_nvm --on-variable PWD --description 'Do nvm stuff'
 if test -f .nvmrc
   set node_version_target (cat .nvmrc)
   set nvm_node_versions (nvm list)

   if string match -q "*$node_version_target*" $nvm_node_versions
     nvm use $node_version_target --silent
   else
     nvm install $node_version_target --silent
   end
 end
end

# It is invoked by the fish shell automatically using its event system.
function __postexec_notify_on_long_running_commands --on-event fish_postexec
   set --function interactive_commands 'nvim' 'v' 'tmux' 't' 'n' 'nnn' 'zj' 'zellij' 'oc' 'opencode' 'sqlit' 'lazygit'
   for cmd in $interactive_commands
       if string match -q "$cmd*" $argv[1]
           # We quit interactive commands manually,
           # no need for a notification.
           return
       end
   end

    set --local exit_status $status

    if test $CMD_DURATION -gt 5000
        set --local cmd_duration_seconds (math $CMD_DURATION / 1000)
        set --local notification_message "Command: $argv[1]\nDuration: $cmd_duration_seconds seconds\nExit Status: $exit_status"

         if type -q powershell.exe
             powershell.exe -NoProfile -Command "
                 [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > \$null
                 [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > \$null

                 \$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
                 \$xml.LoadXml(
                   '<toast><visual><binding template=\"ToastText02\">' +
                   '<text id=\"1\">Fish Shell - Command Complete</text>' +
                   '<text id=\"2\">Command: $argv[1]</text>' +
                   '<text id=\"3\">Duration: ' + ($CMD_DURATION / 1000) + ' seconds | Exit: $exit_status</text>' +
                   '</binding></visual></toast>'
                 )

                 \$toast = New-Object Windows.UI.Notifications.ToastNotification \$xml
                 \$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Fish Shell')
                 \$notifier.Show(\$toast)
             "
        else if type -q notify-send
            notify-send "Fish Shell Notification" $notification_message
        end
    end
end
