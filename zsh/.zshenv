export DOTNET_ROOT=$HOME/.dotnet
export PATH="$PATH:$HOME/.local/bin:$HOME/.local/share/nvm/versions/node/v24.18.0/bin:$HOME/.cargo/bin:$HOME/go/bin:$HOME/.dotnet/tools"
export PATH=$DOTNET_ROOT:$PATH

export SSH_AUTH_SOCK="$HOME/snap/bitwarden/159/.bitwarden-ssh-agent.sock"

# Editor Configuration
export KUBE_EDITOR=nvim # Default editor for kubectl edit commands
export VISUAL=nvim      # Editor for programs that need a visual editor
export EDITOR=nvim      # Default text editor for command line

# Kubernetes Configuration
export KUBECONFIG="$HOME/.config/kubectl/config.yaml" # Custom kubectl config location

# Zsh Completion System
export fpath=($HOME/.zsh/zsh-completions/src $fpath)

# Command History Configuration
export HISTFILE="$HOME/.zsh_history" # Location of history file
export HISTSIZE=10000                # Number of commands in memory
export SAVEHIST=10000                # Number of commands to save to file
setopt appendhistory                 # Append to history file instead of overwriting

# FZF Configuration - Oxocarbon Dark theme
export FZF_DEFAULT_COMMAND='rg --files --hidden --follow'
export FZF_DEFAULT_OPTS="$FZF_DEFAULT_OPTS \
  --highlight-line \
  --info=inline-right \
  --ansi \
  --layout=reverse \
  --border=none \
  --color=bg+:#404040 \
  --color=bg:#161616 \
  --color=border:#78a9ff \
  --color=fg:#d5d5d5 \
  --color=gutter:#161616 \
  --color=header:#ff7eb6 \
  --color=hl+:#08bdba \
  --color=hl:#42be65 \
  --color=info:#5c5c5c \
  --color=marker:#ee5396 \
  --color=pointer:#be95ff \
  --color=prompt:#78a9ff \
  --color=query:#d5d5d5:regular \
  --color=scrollbar:#78a9ff \
  --color=separator:#404040 \
  --color=spinner:#be95ff \
"

export STARSHIP_CONFIG="$HOME/.config/starship/config.toml"

export PI_SKIP_VERSION_CHECK=1
export RIPGREP_CONFIG_PATH="$HOME/.config/ripgrep/ripgreprc"
export GOMAXPROCS=6
# Issue: https://github.com/ajeetdsouza/zoxide/issues/626
export _ZO_FZF_OPTS='--no-sort --bind=ctrl-z:ignore,btab:up,tab:down --cycle --keep-right --border=sharp --height=45% --info=inline --layout=reverse --tabstop=1 --exit-0 --select-1 --preview="\\command -p ls -Cp --color=always --group-directories-first {2..}" --preview-window=down,30%,sharp'

# ── Bun ─────────────────────────────────────────────────────────────────────
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "/home/khaitran/.bun/_bun" ] && source "/home/khaitran/.bun/_bun"
