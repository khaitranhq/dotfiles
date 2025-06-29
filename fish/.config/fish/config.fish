#=========================Functions=========================
source ~/.config/fish/functions.fish

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

#=========================Path=========================
fish_add_path $HOME/.local/bin

fish_add_path $HOME/.local/share/nvim/mason/bin
fish_add_path $HOME/.local/share/nvm/v22.16.0/bin
fish_add_path $HOME/go/bin
fish_add_path $HOME/.pulumi/bin
fish_add_path $HOME/.cargo/bin

#=========================Init apps=========================
oh-my-posh init fish --config '/home/lewis/.config/ohmyposh/jandedobbeleer.omp.json' | source
zoxide init fish | source
__check_nvm
complete -c aws -f -a '(begin; set -lx COMP_SHELL fish; set -lx COMP_LINE (commandline); /usr/local/bin/aws_completer; end)'
fzf --fish | source

#=========================Run other scripts=========================
if test -e $HOME/.config/fish/ai.fish
  source $HOME/.config/fish/ai.fish
end

#=========================Aliases=========================
alias v="nvim"
# alias fd='fdfind'
alias l='eza -lah --icons'
alias ls='eza -lah --icons --total-size'
alias cat="bat -p"
alias ld='lazydocker'
alias lg='lazygit'
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"
alias t="tmux"
alias au="~/.config/fish/aws-utils.fish"
## alias db="source ~/.config/fish/connect-db.fish"
alias qq="exit"
alias k='kubectl'
alias kx='kubectx'
alias p='pulumi'
alias sai='aider \
  --openai-api-key $COPILOT_KEY_STS \
  --openai-api-base https://api.githubcopilot.com'

alias rai='aider \
  --openai-api-key $COPILOT_KEY_RH \
  --openai-api-base https://api.githubcopilot.com'
