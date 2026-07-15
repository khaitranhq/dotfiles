# ── Completion system (fast) ──────────────────────────────────────────────
fpath=(~/.config/zsh/completion $fpath)
autoload -Uz compinit
if [[ -n ${ZDOTDIR:-$HOME}/.zcompdump(#qN.mh+24) ]]; then
  compinit -i
else
  compinit -iC
fi

# ── Prompt & jump ──────────────────────────────────────────────────────────
eval "$(starship init zsh)"
eval "$(zoxide init zsh)"

# ── Load aliases & functions ────────────────────────────────────────────────
[[ -f ~/.config/zsh/aliases.zsh ]] && source ~/.config/zsh/aliases.zsh
[[ -f ~/.config/zsh/hidden.zsh ]] && source ~/.config/zsh/hidden.zsh
for f in ~/.config/zsh/functions/*.zsh(N); do source "$f"; done

# ── Plugins ─────────────────────────────────────────────────────────────────
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
_zplugin_load zdharma-continuum fast-syntax-highlighting

# ── FZF (defer to zvm_after_init) ──────────────────────────────────────────
zvm_after_init_commands+=('source <(fzf --zsh)')

# ── Keybindings ─────────────────────────────────────────────────────────────
bindkey -e
autoload -Uz edit-command-line
zle -N edit-command-line
bindkey '\ew' edit-command-line
bindkey '^[[1;5C' forward-word   # Ctrl+Right
bindkey '^[[1;5D' backward-word  # Ctrl+Left

# ── Lazy-load: nvm (~135ms saved) ──────────────────────────────────────────
export NVM_DIR="$HOME/.local/share/nvm"
nvm() {
  unset -f nvm
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm "$@"
}

# ── Lazy-load: bash completions ────────────────────────────────────────────
_comp_lazy_loaded=0
_ensure_bash_comp() {
  (( _comp_lazy_loaded )) && return
  _comp_lazy_loaded=1
  autoload -Uz bashcompinit && bashcompinit
  command -v aws_completer &>/dev/null && complete -C 'aws_completer' aws
  [[ -f /etc/bash_completion.d/azure-cli ]] && source /etc/bash_completion.d/azure-cli
  complete -o nospace -C /home/khaitran/.local/bin/terraform terraform
}
# Hook into first tab press to trigger lazy completion loading
_zshrc_expand_or_complete() {
  _ensure_bash_comp
  zle expand-or-complete
}
zle -N _zshrc_expand_or_complete
bindkey '^I' _zshrc_expand_or_complete

# ── Bun ─────────────────────────────────────────────────────────────────────
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[ -s "/home/khaitran/.bun/_bun" ] && source "/home/khaitran/.bun/_bun"
