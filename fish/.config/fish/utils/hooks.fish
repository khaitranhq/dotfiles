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
   set --function interactive_commands 'nvim' 'v' 'tmux' 't' 'n' 'nnn'
   for cmd in $interactive_commands
       if string match -q "$cmd*" $argv[1]
           # We quit interactive commands manually,
           # no need for a notification.
           return
       end
   end

   set --local exit_status $status

   if test $CMD_DURATION -gt 5000
     printf \\a
   end
end
