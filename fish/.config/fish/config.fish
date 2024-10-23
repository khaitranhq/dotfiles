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
    set --function interactive_commands 'nvim', 'v'
    set --function command (string split ' ' $argv[1])
    if contains $command $interactive_commands
        # We quit interactive commands manually,
        # no need for a notification.
        return
    end

    if test $CMD_DURATION -gt 5000
        notify-send 'command finished' "$argv"
    end
end

fzf --fish | source

alias v="nvim"
alias fd='fdfind'
alias l='eza -lah --icons'
# alias ssh='kitten ssh'
alias cat="bat -p"
alias tf='terraform'
alias ld='lazydocker'
alias lg='lazygit'
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"
alias y='yazi'
alias t="tmux"
alias au="source ~/.config/fish/aws-utils.fish"
alias db="~/.config/fish/connect-db.fish"

source "$HOME/.config/fish/manage-tmux-sessions.fish"

export KUBECONFIG="$HOME/.config/kubectl/config.yml"
