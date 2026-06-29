# Put this where compinit is called in your .zshrc
autoload -Uz compinit
if [[ -n ${ZDOTDIR:-$HOME}/.zcompdump(#qN.mh+24) ]]; then
  compinit
else
  compinit -C
fi

eval "$(starship init zsh)"
eval "$(zoxide init zsh)"
# Set up fzf key bindings and fuzzy completion
source <(fzf --zsh)

#=========================SSH Agent=========================
agent_ok=0

if [[ -n "$SSH_AUTH_SOCK" ]] && [[ -S "$SSH_AUTH_SOCK" ]]; then
    if [[ -n "$SSH_AGENT_PID" ]] && ps -p "$SSH_AGENT_PID" >/dev/null 2>&1; then
        agent_ok=1
    fi
fi

if [[ $agent_ok -ne 1 ]]; then
    if [[ -f "$HOME/.ssh/ssh-agent.zsh" ]]; then
        source "$HOME/.ssh/ssh-agent.zsh"
        if [[ -n "$SSH_AGENT_PID" ]] && ps -p "$SSH_AGENT_PID" >/dev/null 2>&1; then
            agent_ok=1
        else
            rm -f "$HOME/.ssh/ssh-agent.zsh"
        fi
    fi
fi

if [[ $agent_ok -ne 1 ]]; then
    mkdir -p "$HOME/.ssh"
    ssh-agent -s | awk -F'[=;]' '/=/{print "export " $1 "=" $2}' > "$HOME/.ssh/ssh-agent.zsh"
    source "$HOME/.ssh/ssh-agent.zsh"
fi

if [ -f ~/.config/zsh/aliases.zsh ]; then
  source ~/.config/zsh/aliases.zsh
fi

for f in ~/.config/zsh/functions/*.zsh(N); do
  source "$f"
done

ZPLUGINDIR="${ZDOTDIR:-$HOME/.config/zsh}/plugins"

_zplugin_load() {
  local plugin_path="${ZPLUGINDIR}/${2}"
  if [[ ! -d "$plugin_path" ]]; then
    mkdir -p "$ZPLUGINDIR"
    echo "Installing ${2}..."
    git clone --depth=1 "https://github.com/${1}/${2}" "$plugin_path" \
      || { echo "ERROR: failed to install ${2}" >&2; return 1; }
  fi
  source "${plugin_path}/${2}.plugin.zsh"
}

_zplugin_load zsh-users zsh-autosuggestions
_zplugin_load zsh-users zsh-history-substring-search
_zplugin_load jeffreytse zsh-vi-mode
_zplugin_load zdharma-continuum fast-syntax-highlighting

add-keys-ssh-agent

