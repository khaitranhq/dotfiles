if status is-interactive
    # Commands to run in interactive sessions can go here
end

# Disable Fish Greeting
set -g fish_greeting

# for k9s
export KUBE_EDITOR="nvim"

fish_add_path $HOME/.local/bin
fish_add_path $HOME/.local/share/nvim/mason/bin
fish_add_path $HOME/.krew/bin
fish_add_path $HOME/.local/share/nvm/v20.12.1/bin
fish_add_path /home/linuxbrew/.linuxbrew/opt/postgresql@16/bin
fish_add_path /home/linuxbrew/.linuxbrew/opt/mysql@8.4/bin
fish_add_path /home/linuxbrew/.linuxbrew/opt/mysql-client@8.0/bin
fish_add_path $HOME/go/bin

eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

oh-my-posh init fish --config '/home/lewis/.config/ohmyposh/jandedobbeleer.omp.json' | source

zoxide init fish | source

function fish_user_key_bindings
  # ctrl-w
  bind \e\[3\;5~ kill-word
end

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
__check_nvm

if test -e $HOME/.config/fish/openai.fish
  source $HOME/.config/fish/openai.fish
end

complete -c aws -f -a '(begin; set -lx COMP_SHELL fish; set -lx COMP_LINE (commandline); /usr/local/bin/aws_completer; end)'

# This function allows you to switch to a different task
# when an interactive command takes too long
# by notifying you when it is finished.
#
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

    if test $CMD_DURATION -gt 5000
        paplay /usr/share/sounds/freedesktop/stereo/complete.oga & notify-send 'command finished' "$argv"
    end
end

function __get_aws_secret_to_env
   export $(aws secretsmanager get-secret-value --secret-id $argv[1] --query SecretString --output text | jq -r 'to_entries | map("\(.key)=\(.value)") | .[]')
end

fzf --fish | source

alias v="nvim"
alias fd='fdfind'
alias l='eza -lah --icons'
alias ls='eza -lah --icons --total-size'
# alias ssh='kitten ssh'
alias cat="bat -p"
alias tf='terraform'
alias ld='lazydocker'
alias lg='lazygit'
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"
# alias y='yazi'
alias n='nnn -d -e -H -r -a -P "p"'
alias t="tmux"
alias au="source ~/.config/fish/aws-utils.fish"
alias db="source ~/.config/fish/connect-db.fish"
alias current_branch="git rev-parse --abbrev-ref HEAD"
alias qq="exit"
alias k='kubectl'
alias kx='kubectx'
alias p='pulumi'
alias df='duf'
alias bwunlock='export BW_SESSION=$(bw unlock --raw)'
alias bwotp='bw get totp'
alias dt='devops-tools'
alias cl='clear'
alias ts='task'

export NNN_PLUG="p:preview-tui"
export KUBECONFIG="$HOME/.config/kubectl/config.yml"
export NNN_PAGER="bat -p"

export VISUAL="nvim"
export EDITOR="nvim"

# The next line updates PATH for the Google Cloud SDK.
if [ -f '/home/lewis/Downloads/google-cloud-sdk/path.fish.inc' ]; . '/home/lewis/Downloads/google-cloud-sdk/path.fish.inc'; end

function setup_monitor
  set setup_type "work" "home" "single"
  set selected_type (printf "%s\n" $setup_type | fzf --header "Select setup type" --cycle --ansi --layout=reverse --height=15)

  switch $selected_type
    case "work"
      # xrandr --output HDMI-1 --primary --auto --output eDP-1 --mode 0x52 --auto --left-of HDMI-1
      xrandr --output HDMI-1 --primary --auto --output eDP-1 --off
    case "home"
      xrandr --output DP-1 --pos 0x0 --auto --output HDMI-1 --pos 1080x371 --auto --output eDP-1 --off
    case "single"
      xrandr --output eDP-1 --auto
    case '*'
      echo "Unknown setup type"
  end
end
