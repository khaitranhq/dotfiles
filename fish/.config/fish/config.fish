#=========================Functions=========================
# Load all fish files from utils directory
for file in $HOME/.config/fish/utils/*.fish
    source $file
end

#=========================Variables=========================
# Disable Fish Greeting
set -g fish_greeting

# for k9s

# for kubectl
set -Ux KUBECONFIG "$HOME/.config/kubectl/config.yaml"

# others
set -Ux KUBE_EDITOR nvim
set -Ux VISUAL nvim
set -Ux EDITOR nvim

set -x OPENCODE_EXPERIMENTAL_LSP_TOOL true
set -x RIPGREP_CONFIG_PATH "$HOME/.config/ripgrep/ripgreprc"
set -x BROWSER '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
set -x DOTNET_ROOT "$HOME/.dotnet"

set -x GOMAXPROCS 8
set -x GOMEMLIMIT 20GiB
set -x PI_SKIP_VERSION_CHECK 1

if test -d $HOME/.linuxbrew
    # Homebrew is installed on Linux
    set -gx HOMEBREW_PREFIX "$HOME/.linuxbrew"
    set -gx HOMEBREW_CELLAR "$HOME/.linuxbrew/Cellar"
    set -gx HOMEBREW_REPOSITORY "$HOME/.linuxbrew/Homebrew"
    set -gx PATH "$HOME/.linuxbrew/bin" "$HOME/.linuxbrew/sbin" $PATH
    set -q MANPATH; or set MANPATH ''
    set -gx MANPATH "$HOME/.linuxbrew/share/man" $MANPATH
    set -q INFOPATH; or set INFOPATH ''
    set -gx INFOPATH "$HOME/.linuxbrew/share/info" $INFOPATH

    # Homebrew asked for this in order to `brew upgrade`
    set -gx HOMEBREW_GITHUB_API_TOKEN {api token goes here, don't remember where that's created}
else if test -d /opt/homebrew
    # Homebrew is installed on MacOS
    $HOME/.linuxbrew/Homebrew/bin/brew shellenv | source
end

#=========================Path=========================
fish_add_path $HOME/.local/bin
fish_add_path $HOME/.local/share/nvm/v22.16.0/bin
fish_add_path $HOME/.pulumi/bin
fish_add_path $HOME/go/bin
fish_add_path $HOME/.dotnet
fish_add_path $HOME/.dotnet/tools/

#=========================SSH Agent=========================
# Reuse a running ssh-agent when possible. If none is available,
# start one and write fish-friendly env exports to ~/.ssh/ssh-agent.fish
set agent_ok 0

if set -q SSH_AUTH_SOCK
    if test -S $SSH_AUTH_SOCK
        if set -q SSH_AGENT_PID
            if ps -p $SSH_AGENT_PID >/dev/null 2>&1
                set agent_ok 1
            end
        end
    end
end

if test $agent_ok -ne 1
    if test -f $HOME/.ssh/ssh-agent.fish
        source $HOME/.ssh/ssh-agent.fish
        if set -q SSH_AGENT_PID
            if ps -p $SSH_AGENT_PID >/dev/null 2>&1
                set agent_ok 1
            else
                rm -f $HOME/.ssh/ssh-agent.fish
            end
        end
    end
end

if test $agent_ok -ne 1
    mkdir -p $HOME/.ssh
    # produce fish "set -x VAR 'value'" lines from sh output
    # Use awk to avoid quoting issues in fish
    ssh-agent -s | awk -F'[=;]' '/=/{print "set -x " $1 " \047" $2 "\047"}' >$HOME/.ssh/ssh-agent.fish
    source $HOME/.ssh/ssh-agent.fish
end

#=========================Initialize=========================
oh-my-posh init fish --config "$HOME/.config/ohmyposh/everforest.omp.json" | source
zoxide init fish | source
complete -c aws -f -a '(begin; set -lx COMP_SHELL fish; set -lx COMP_LINE (commandline); /usr/local/bin/aws_completer; end)'
add-keys-ssh-agent

#=========================Run other scripts=========================
if test -e $HOME/.config/fish/ai.fish
    source $HOME/.config/fish/ai.fish
end

#=========================Aliases=========================
alias v='nvim'
alias t='tmux'
alias l='eza -lah --sort modified --icons --group-directories-first --git'
alias cat="bat -p"
alias ld='lazydocker'
alias lg='lazygit'
alias randompass="cat /dev/random | tr -dc '[:alnum:]' | head -c 40 | xsel -b"
alias au="~/.config/fish/aws-utils.fish"
alias qq="exit"
alias k='kubectl'
alias kx='kubectx'
alias p='pulumi'
alias acg='agentcrew chat'
alias ppd='pulumi preview --diff'
alias pp='pulumi preview'
alias pup='pulumi up --yes --skip-preview'
alias dbc='db_connect'
alias tf='terraform'
alias y='yazi'
alias rpi='pi --provider github-copilot --model gpt-5.4'
alias cpi='pi --provider commandcode --model deepseek-v4-pro'
alias c='claude'
alias j='just'
alias tf='terraform'

#=========================Key Bindings=========================
bind alt-w edit_command_buffer
bind \cr history_search
