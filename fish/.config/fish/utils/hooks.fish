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
     powershell.exe -NoProfile -Command "
       [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > \$null
       [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > \$null
       \$lineBreak = [Environment]::NewLine

       \$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
       \$textNodes = \$template.GetElementsByTagName('text')
       \$textNodes.Item(0).AppendChild(\$template.CreateTextNode('Fish Shell Notification')) > \$null
       \$textNodes.Item(1).AppendChild(\$template.CreateTextNode('Command: $argv[1]' + \$lineBreak + 'Duration: ' + ($CMD_DURATION / 1000) + ' seconds' + \$lineBreak + 'Exit Status: $exit_status')) > \$null

       \$toast = [Windows.UI.Notifications.ToastNotification]::new(\$template)
       \$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Fish Shell')
       \$notifier.Show(\$toast)
      "
   end
end
