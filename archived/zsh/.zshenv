export PATH="$PATH:$HOME/.local/bin:$HOME/.nvm/v22.16.0/bin:$HOME/.pulumi/bin:$HOME/.cargo/bin:$HOME/.local/share/goenv/bin"

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

# FZF Configuration - Theme and appearance settings
export FZF_DEFAULT_OPTS="$FZF_DEFAULT_OPTS \
  --highlight-line \
  --info=inline-right \
  --ansi \
  --layout=reverse \
  --border=none \
  --color=bg+:#283457 \
  --color=bg:#16161e \
  --color=border:#27a1b9 \
  --color=fg:#c0caf5 \
  --color=gutter:#16161e \
  --color=header:#ff9e64 \
  --color=hl+:#2ac3de \
  --color=hl:#2ac3de \
  --color=info:#545c7e \
  --color=marker:#ff007c \
  --color=pointer:#ff007c \
  --color=prompt:#2ac3de \
  --color=query:#c0caf5:regular \
  --color=scrollbar:#27a1b9 \
  --color=separator:#ff9e64 \
  --color=spinner:#ff007c \
"
