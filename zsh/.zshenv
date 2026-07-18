export DOTNET_ROOT=$HOME/.dotnet
export PATH="$PATH:$HOME/.local/bin:$HOME/.local/share/nvm/versions/node/v24.18.0/bin:$HOME/.cargo/bin:$HOME/go/bin:$HOME/.dotnet/tools"
export PATH=$DOTNET_ROOT:$PATH

export SSH_AUTH_SOCK="$HOME/.bitwarden-ssh-agent.sock"

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

# FZF Configuration - Everforest Dark Medium theme
export FZF_DEFAULT_OPTS="$FZF_DEFAULT_OPTS \
  --highlight-line \
  --info=inline-right \
  --ansi \
  --layout=reverse \
  --border=none \
  --color=bg+:#543a48 \
  --color=bg:#2d353b \
  --color=border:#7fbbb3 \
  --color=fg:#d3c6aa \
  --color=gutter:#2d353b \
  --color=header:#e69875 \
  --color=hl+:#83c092 \
  --color=hl:#a7c080 \
  --color=info:#859289 \
  --color=marker:#e67e80 \
  --color=pointer:#d699b6 \
  --color=prompt:#7fbbb3 \
  --color=query:#d3c6aa:regular \
  --color=scrollbar:#7fbbb3 \
  --color=separator:#7a8478 \
  --color=spinner:#d699b6 \
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
