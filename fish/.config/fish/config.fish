#=========================Functions=========================
# Load all fish files from utils directory
for file in $HOME/.config/fish/utils/*.fish
    source $file
end

#=========================Variables=========================
# Disable Fish Greeting
set -g fish_greeting

# for k9s
set -Ux KUBE_EDITOR nvim

# for kubectl
set -Ux KUBECONFIG "$HOME/.config/kubectl/config.yaml"

# others
set -Ux VISUAL "nvim"
set -Ux EDITOR "nvim"

set -Ux MANPAGER "nvim +Man!"

set -x OPENCODE_EXPERIMENTAL_LSP_TOOL "true"
#=========================Path=========================
fish_add_path $HOME/.local/bin
fish_add_path $HOME/.local/share/nvm/v22.16.0/bin
fish_add_path $HOME/.pulumi/bin
fish_add_path $HOME/go/bin

#=========================Init apps=========================
# oh-my-posh init fish --config '/home/lewis/.config/ohmyposh/jandedobbeleer.omp.json' | source
oh-my-posh init fish --config '/home/lewis/.config/ohmyposh/tokyonigh.omp.json' | source
zoxide init fish | source
__check_nvm
complete -c aws -f -a '(begin; set -lx COMP_SHELL fish; set -lx COMP_LINE (commandline); /usr/local/bin/aws_completer; end)'

#=========================Run other scripts=========================
if test -e $HOME/.config/fish/ai.fish
  source $HOME/.config/fish/ai.fish
end

#=========================Aliases=========================
alias v="nvim"
alias l='eza -lah --icons'
alias ls='eza -lah --icons --total-size'
alias cat="bat -p"
alias ld='lazydocker'
alias lg='lazygit'
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"
alias au="~/.config/fish/aws-utils.fish"
alias qq="exit"
alias k='kubectl'
alias kx='kubectx'
alias p='pulumi'
alias zj='zellij_session'
alias ac='agentcrew chat --console'
alias acg='agentcrew chat'
alias ppd='pulumi preview --diff'
alias pp='pulumi preview'
alias pup='pulumi up --yes --skip-preview'
alias dbc='db_connect'
alias tf='terraform'
alias y='yazi'
alias oc='opencode'
alias ta='task-add'

#=========================Key Bindings=========================
bind alt-w edit_command_buffer
bind \cr gum_filter_history_search
