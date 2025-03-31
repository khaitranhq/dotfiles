#=========================Functions=========================
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

function setup-pnpm-project
    pnpm install --save-dev \
        eslint \
        @eslint/js \
        typescript \
        typescript-eslint \
        eslint-plugin-prettier \
        eslint-config-prettier \
        prettier \
        @trivago/prettier-plugin-sort-imports

    npx tsc --init

    echo '{
  "trailingComma": "none",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports"]
}' > .prettierrc.json

    echo '// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
);' > eslint.config.mjs
end


#=========================Variables=========================
# Disable Fish Greeting
set -g fish_greeting

# for k9s
set -Ux KUBE_EDITOR nvim
set -Ux PYENV_ROOT "$HOME/.pyenv"

# for kubectl
set -Ux KUBECONFIG "$HOME/.config/kubectl/config.yaml"

# others
set -Ux VISUAL "nvim"
set -Ux EDITOR "nvim"

#=========================Path=========================
fish_add_path $HOME/.local/bin
fish_add_path $PYENV_ROOT/bin

fish_add_path $HOME/.local/share/nvim/mason/bin
fish_add_path $HOME/.local/share/nvm/v20.12.1/bin
fish_add_path $HOME/go/bin

#=========================Init apps=========================
oh-my-posh init fish --config '/home/lewis/.config/ohmyposh/jandedobbeleer.omp.json' | source
pyenv init - fish | source
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
alias fd='fdfind'
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
